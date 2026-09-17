/**
 * Gemini model pool + quota state (centralized model-selection logic).
 *
 * Design notes:
 * - QUALITY-FIRST selection: models are always tried in `priority` order.
 *   Quota only decides ELIGIBILITY — it never promotes a lower-quality model.
 * - Google does NOT expose an official "remaining RPD" endpoint for AI Studio
 *   API keys (no quota-read API on the Generative Language API; Cloud
 *   Monitoring metrics are not reachable for AI-Studio-issued keys). Per spec,
 *   quota state is therefore a CONSERVATIVE server-side estimate:
 *     a local request counter per UTC day + real API error signals (429/5xx).
 *   `usageMetadata` is explicitly NOT used as quota (it is per-call token usage).
 * - Everything is in-process (no Redis): this app is single-instance by design.
 *   Future providers (e.g. OpenRouter) can slot in beside this pool without
 *   touching the selection loop.
 */

export type GeminiModelConfig = {
  /** Exact Generative Language API model ID (verified via ListModels). */
  model: string;
  /** Human-readable name shown to users. */
  displayName: string;
  /** 1 = highest quality. Lower number wins whenever it is eligible. */
  priority: number;
  /**
   * ESTIMATE of the Free-Tier daily request budget used by the conservative
   * local counter. Google does not publish a machine-readable RPD for this
   * key — tune these numbers to observed limits. Not presented as official.
   */
  estimatedRpd: number;
};

/**
 * Verified against this API key on 2026-09-15:
 * - All four IDs below appear in ListModels with `generateContent` support AND
 *   answer a real generateContent call.
 * - `gemini-2.5-pro` / `gemini-2.5-flash` return 404 "no longer available to
 *   new users" on this key → deliberately excluded (re-add ONLY if the API
 *   starts serving them again).
 * - Excluded by policy: Gemini 3 Flash Preview, Deep Research*, all
 *   Flash-Lite variants, image/TTS/live/embedding/veo/lyria/robotics models.
 */
export const GEMINI_MODEL_PRIORITY: GeminiModelConfig[] = [
  { model: "gemini-3.8-flash", displayName: "Gemini 3.8 Flash", priority: 1, estimatedRpd: 200 },
  { model: "gemini-3.7-flash", displayName: "Gemini 3.7 Flash", priority: 2, estimatedRpd: 200 },
  { model: "gemini-3.6-flash", displayName: "Gemini 3.6 Flash", priority: 3, estimatedRpd: 200 },
  { model: "gemini-3.5-flash", displayName: "Gemini 3.5 Flash", priority: 4, estimatedRpd: 200 },
];

/** Tunables (spec §7/§10: short cache, configurable cooldowns). */
export const MODEL_AVAILABILITY_CACHE_TTL_MS = 60_000;
export const SERVICE_COOLDOWN_MS = 60_000;
/** Per-minute 429s are transient — bench briefly, not until midnight. */
export const RATE_LIMIT_COOLDOWN_MS = 45_000;
export const TIMEOUT_COOLDOWN_MS = 30_000;
export const INVALID_MODEL_COOLDOWN_MS = 24 * 60 * 60_000;

type ModelRuntimeState = {
  dayKey: string;
  usedToday: number;
  inFlight: number;
  /** Epoch ms until which the model is skipped (temporary cooldown). */
  cooldownUntil: number;
  /** Epoch ms until which the model is skipped (day quota exhausted / invalid). */
  exhaustedUntil: number;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastErrorCode: string | null;
  updatedAt: number;
};

const states = new Map<string, ModelRuntimeState>();

function utcDayKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

function getState(model: string, now: number): ModelRuntimeState {
  let state = states.get(model);
  if (!state) {
    state = {
      dayKey: utcDayKey(now), usedToday: 0, inFlight: 0,
      cooldownUntil: 0, exhaustedUntil: 0,
      lastSuccessAt: null, lastErrorAt: null, lastErrorCode: null, updatedAt: now,
    };
    states.set(model, state);
  }
  // UTC-day rollover: reset the conservative counter (in-flight cannot survive a
  // day boundary in practice, but reset defensively).
  if (state.dayKey !== utcDayKey(now)) {
    state.dayKey = utcDayKey(now);
    state.usedToday = 0;
    state.inFlight = 0;
    state.exhaustedUntil = 0;
    state.updatedAt = now;
  }
  return state;
}

/**
 * Ordered by priority (1 first). The optional GEMINI_MODEL env var re-orders
 * the pool (pinned model first) instead of disabling fallback — set it only
 * when you want to force a specific model to be tried first while keeping the
 * safety net of the remaining pool.
 */
export function getOrderedPool(): GeminiModelConfig[] {
  const pinned = process.env.GEMINI_MODEL?.trim().replace(/^models\//, "");
  if (!pinned) return [...GEMINI_MODEL_PRIORITY].sort((a, b) => a.priority - b.priority);
  const known = GEMINI_MODEL_PRIORITY.find((entry) => entry.model === pinned);
  const pinnedEntry = known ?? { model: pinned, displayName: pinned, priority: 1, estimatedRpd: Number.POSITIVE_INFINITY };
  const rest = GEMINI_MODEL_PRIORITY.filter((entry) => entry.model !== pinned).sort((a, b) => a.priority - b.priority);
  return [pinnedEntry, ...rest];
}

// ---------------------------------------------------------------------------
// Availability (official ListModels endpoint, cached)
// ---------------------------------------------------------------------------

let availabilityCache: { ids: Set<string>; fetchedAt: number } | null = null;

/**
 * Set of model IDs the current API key can actually call for generateContent,
 * per the official ListModels endpoint. Returns null when the check cannot run
 * (missing key / network failure) — callers must then treat all pool models as
 * potentially available and rely on per-call fallback.
 */
export async function getAvailableModelIds(): Promise<Set<string> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const now = Date.now();
  if (availabilityCache && now - availabilityCache.fetchedAt < MODEL_AVAILABILITY_CACHE_TTL_MS) {
    return availabilityCache.ids;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
      { headers: { "x-goog-api-key": apiKey }, signal: controller.signal },
    ).finally(() => clearTimeout(timeout));
    if (!response.ok) return availabilityCache?.ids ?? null;
    const payload = (await response.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    const ids = new Set<string>();
    for (const model of payload.models ?? []) {
      if (!model.supportedGenerationMethods?.includes("generateContent")) continue;
      if (model.name) ids.add(model.name.replace(/^models\//, ""));
    }
    availabilityCache = { ids, fetchedAt: now };
    return ids;
  } catch {
    return availabilityCache?.ids ?? null;
  }
}

export function invalidateAvailabilityCache() {
  availabilityCache = null;
}

// ---------------------------------------------------------------------------
// Eligibility / reservations (concurrency guard, spec §11)
// ---------------------------------------------------------------------------

/** Side-effect-free check used for diagnostics and pre-filtering. */
export function isModelEligible(model: string, now = Date.now()): boolean {
  const state = getState(model, now);
  if (now < state.cooldownUntil || now < state.exhaustedUntil) return false;
  const config = getOrderedPool().find((entry) => entry.model === model);
  const rpd = config?.estimatedRpd ?? Number.POSITIVE_INFINITY;
  return rpd - state.usedToday - state.inFlight >= 1;
}

/**
 * Atomically reserve one request slot for `model`. Returns false when the model
 * is cooling down, exhausted, or the conservative counter says no budget is
 * left — including requests currently in flight from concurrent users.
 */
export function reserveRequest(model: string, now = Date.now()): boolean {
  if (!isModelEligible(model, now)) return false;
  const state = getState(model, now);
  state.usedToday += 1;
  state.inFlight += 1;
  state.updatedAt = now;
  return true;
}

/** Resolve a reservation made by `reserveRequest`. Failures stay counted (conservative). */
export function resolveReservation(model: string, success: boolean, now = Date.now()) {
  const state = getState(model, now);
  state.inFlight = Math.max(0, state.inFlight - 1);
  if (success) state.lastSuccessAt = now;
  state.updatedAt = now;
}

// ---------------------------------------------------------------------------
// Error-driven state transitions (spec §9/§10)
// ---------------------------------------------------------------------------

/** 429 / quota exceeded: skip until the UTC daily window rolls over. */
export function markRateLimited(model: string, now = Date.now()) {
  const state = getState(model, now);
  const tomorrow = Date.parse(`${utcDayKey(now)}T00:00:00.000Z`) + 24 * 60 * 60_000;
  state.exhaustedUntil = Math.max(state.exhaustedUntil, tomorrow);
  state.lastErrorAt = now;
  state.lastErrorCode = "RATE_LIMITED";
  state.updatedAt = now;
}

/** 5xx / network: short cooldown so we stop hammering a struggling model. */
export function markServiceUnavailable(model: string, cooldownMs = SERVICE_COOLDOWN_MS, code = "PROVIDER", now = Date.now()) {
  const state = getState(model, now);
  state.cooldownUntil = Math.max(state.cooldownUntil, now + cooldownMs);
  state.lastErrorAt = now;
  state.lastErrorCode = code;
  state.updatedAt = now;
}

/** 404 invalid/inaccessible model: long cooldown + forget cached availability. */
export function markModelInvalid(model: string, now = Date.now()) {
  const state = getState(model, now);
  state.exhaustedUntil = Math.max(state.exhaustedUntil, now + INVALID_MODEL_COOLDOWN_MS);
  state.lastErrorAt = now;
  state.lastErrorCode = "MODEL_INVALID";
  state.updatedAt = now;
  invalidateAvailabilityCache();
}

// ---------------------------------------------------------------------------
// Development diagnostics (spec §15) — never includes credentials or content.
// ---------------------------------------------------------------------------

export type ModelDiagnostics = {
  model: string;
  displayName: string;
  priority: number;
  estimatedRpd: number | null;
  observedUsage: number;
  inFlight: number;
  estimatedRemaining: number | null;
  /** When the conservative counter was last updated (quota info is an ESTIMATE). */
  observedAt: string;
  cooldownUntil: string | null;
  exhaustedUntil: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  /** Short human-readable reason when the model is currently ineligible. */
  ineligibleReason: string | null;
  eligibleNow: boolean;
  listedByApi: boolean | null;
};

export function getDiagnosticsSnapshot(availableIds: Set<string> | null): ModelDiagnostics[] {
  const now = Date.now();
  return getOrderedPool().map((config) => {
    const state = states.get(config.model);
    const rpd = Number.isFinite(config.estimatedRpd) ? config.estimatedRpd : null;
    const cooling = state !== undefined && state.cooldownUntil > now;
    const exhausted = state !== undefined && state.exhaustedUntil > now;
    const overBudget = rpd !== null && rpd - (state?.usedToday ?? 0) - (state?.inFlight ?? 0) < 1;
    const ineligibleReason =
      exhausted && state.lastErrorCode === "RATE_LIMITED" ? "일일 한도 도달(429)"
      : exhausted && state.lastErrorCode === "MODEL_INVALID" ? "모델 사용 불가"
      : exhausted ? "예산 소진(보수적 카운터)"
      : cooling && state.lastErrorCode === "RATE_LIMITED_MINUTE" ? "분당 한도(일시)"
      : cooling ? "일시 장애 대기"
      : overBudget ? "예산 소진(보수적 카운터)"
      : availableIds && !availableIds.has(config.model) ? "API 키에서 미지원"
      : null;
    return {
      model: config.model,
      displayName: config.displayName,
      priority: config.priority,
      estimatedRpd: rpd,
      observedUsage: state?.usedToday ?? 0,
      inFlight: state?.inFlight ?? 0,
      estimatedRemaining: rpd === null ? null : Math.max(0, rpd - (state?.usedToday ?? 0) - (state?.inFlight ?? 0)),
      observedAt: new Date(state?.updatedAt ?? now).toISOString(),
      cooldownUntil: cooling ? new Date(state.cooldownUntil).toISOString() : null,
      exhaustedUntil: exhausted ? new Date(state.exhaustedUntil).toISOString() : null,
      lastSuccessAt: state?.lastSuccessAt ? new Date(state.lastSuccessAt).toISOString() : null,
      lastErrorAt: state?.lastErrorAt ? new Date(state.lastErrorAt).toISOString() : null,
      lastErrorCode: state?.lastErrorCode ?? null,
      ineligibleReason,
      eligibleNow: !ineligibleReason,
      listedByApi: availableIds ? availableIds.has(config.model) : null,
    };
  });
}

/**
 * The model the NEXT generation request would use, with the Korean reason when
 * the top pick is unavailable and fallback is expected. Pure — no API calls.
 */
export function previewNextModel(availableIds: Set<string> | null, now = Date.now()): {
  model: string;
  displayName: string;
  fallback: boolean;
  fallbackReason: string | null;
} | null {
  for (const entry of getOrderedPool()) {
    if (availableIds && !availableIds.has(entry.model)) continue;
    if (!isModelEligible(entry.model, now)) continue;
    const reason = getDiagnosticsSnapshot(availableIds).find((d) => d.model === entry.model)?.ineligibleReason ?? null;
    const higherBlocked = entry.priority > 1;
    return {
      model: entry.model,
      displayName: entry.displayName,
      fallback: higherBlocked,
      fallbackReason: higherBlocked ? (reason ?? "상위 모델 일시 사용 불가") : null,
    };
  }
  return null;
}

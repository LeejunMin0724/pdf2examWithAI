/**
 * OpenRouter model pool (SECOND provider — used only when every Gemini model
 * is unavailable). Mirrors gemini-models.ts so AIProviderManager can walk both
 * pools with the same quality-first policy.
 *
 * Design notes:
 * - QUALITY-FIRST: models are always tried in `priority` order. Availability
 *   only decides ELIGIBILITY — it never promotes a lower-quality model.
 * - Slugs verified against the live public catalog
 *   (GET https://openrouter.ai/api/v1/models, 2026-09-16): every entry below
 *   exists as a `:free` variant with 0/0 prompt/completion pricing.
 * - The free pool is DYNAMIC: at selection time we re-check the catalog —
 *   if a model lost its free variant or disappeared, it is skipped, never
 *   substituted with a paid model.
 * - `openrouter/free` (the auto-router) is deliberately NOT used: this app
 *   needs deterministic quality-first selection. The architecture keeps a
 *   slot (OPENROUTER_AUTO_FALLBACK below) to enable it later as a last resort.
 * - Free-plan request limits are shared across ALL free models and are not
 *   published per model, so state is: a conservative POOL-LEVEL daily counter
 *   (tunable budget) + per-model cooldowns driven by real API errors.
 * - Everything is in-process (single-instance app, no Redis).
 */

export type OpenRouterModelConfig = {
  /** Exact OpenRouter model slug (free variant). Verified via the catalog API. */
  model: string;
  /** Human-readable name shown to users. */
  displayName: string;
  /** 1 = highest quality. Lower number wins whenever it is eligible. */
  priority: number;
};

/**
 * Priority per the app spec (quality for long lecture PDFs → academic question
 * generation → structured JSON). Verified free slugs, 2026-09-16:
 */
export const OPENROUTER_MODEL_PRIORITY: OpenRouterModelConfig[] = [
  { model: "nvidia/nemotron-3-ultra-550b-a55b:free", displayName: "NVIDIA Nemotron 3 Ultra", priority: 1 },
  { model: "nvidia/nemotron-3-super-120b-a12b:free", displayName: "NVIDIA Nemotron 3 Super", priority: 2 },
  { model: "thinkingmachines/inkling:free", displayName: "Thinking Machines Inkling", priority: 3 },
  { model: "google/gemma-4-31b-it:free", displayName: "Google Gemma 4 31B", priority: 4 },
  { model: "google/gemma-4-26b-a4b-it:free", displayName: "Google Gemma 4 26B A4B", priority: 5 },
  { model: "nvidia/nemotron-3.5-lightning:free", displayName: "NVIDIA Nemotron 3.5 Lightning", priority: 6 },
  { model: "thinkingmachines/inkling-small:free", displayName: "Thinking Machines Inkling Small", priority: 7 },
  { model: "inclusionai/ling-3.0-flash-vl:free", displayName: "inclusionAI Ling 3.0 Flash VL", priority: 8 },
];

/** Tunables (mirroring the Gemini pool's cooldown/cache policy). */
export const OR_CATALOG_CACHE_TTL_MS = 300_000; // public catalog — cache longer than ListModels
export const OR_SERVICE_COOLDOWN_MS = 60_000;
/** OpenRouter free-tier 429s reset daily, not per minute — bench the model, keep walking the pool. */
export const OR_RATE_LIMIT_COOLDOWN_MS = 300_000;
export const OR_TIMEOUT_COOLDOWN_MS = 30_000;
export const OR_INVALID_MODEL_COOLDOWN_MS = 24 * 60 * 60_000;
/**
 * ESTIMATE of the shared OpenRouter free-plan daily request budget for this
 * server (free tier: ~50/day without credits, ~1000/day with ≥10 credits).
 * Not published by OpenRouter per key — tune to your account tier. When the
 * pool budget is spent, ALL free models become ineligible (clean error) —
 * we never fall through to paid models.
 */
export const OR_POOL_DAILY_BUDGET = 45;
/**
 * Emergency last-resort switch (spec: "keep the architecture flexible enough
 * that openrouter/free could be enabled later"). OFF by default — the explicit
 * priority list is the only OpenRouter selection path today.
 */
export const OPENROUTER_AUTO_FALLBACK_ENABLED = false;
export const OPENROUTER_AUTO_FALLBACK_SLUG = "openrouter/free";
/** Generation prompts carry ~120k chars of PDF text → need generous context. */
export const OR_MIN_CONTEXT_TOKENS = 100_000;

const OPENROUTER_CATALOG_URL = "https://openrouter.ai/api/v1/models";

// ---------------------------------------------------------------------------
// Public catalog (no API key needed) — availability + capability cache
// ---------------------------------------------------------------------------

export type OpenRouterCatalogEntry = {
  id: string;
  free: boolean;
  contextLength: number;
  /** Whether the model accepts `response_format` / structured outputs. */
  supportsJsonResponseFormat: boolean;
  /** Whether the model produces text output (vs image/audio-only). */
  textOutput: boolean;
};

type CatalogCache = { entries: Map<string, OpenRouterCatalogEntry>; fetchedAt: number } | null;
let catalogCache: CatalogCache = null;

type RawCatalogModel = {
  id?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { output_modalities?: string[]; modality?: string };
  supported_parameters?: string[];
};

/**
 * Fetch (cached) the OpenRouter catalog and reduce it to what selection needs.
 * Returns null when the check cannot run (network failure) — callers must then
 * treat all pool models as potentially available and rely on per-call fallback.
 */
export async function getOpenRouterCatalog(): Promise<Map<string, OpenRouterCatalogEntry> | null> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.fetchedAt < OR_CATALOG_CACHE_TTL_MS) {
    return catalogCache.entries;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(OPENROUTER_CATALOG_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (!response.ok) return catalogCache?.entries ?? null;
    const payload = (await response.json()) as { data?: RawCatalogModel[] };
    const entries = new Map<string, OpenRouterCatalogEntry>();
    for (const model of payload.data ?? []) {
      if (!model.id) continue;
      const pricing = model.pricing ?? {};
      entries.set(model.id, {
        id: model.id,
        free: Number(pricing.prompt ?? 1) === 0 && Number(pricing.completion ?? 1) === 0,
        contextLength: model.context_length ?? 0,
        supportsJsonResponseFormat:
          (model.supported_parameters ?? []).includes("response_format") ||
          (model.supported_parameters ?? []).includes("structured_outputs"),
        textOutput:
          !model.architecture?.output_modalities || model.architecture.output_modalities.includes("text"),
      });
    }
    catalogCache = { entries, fetchedAt: now };
    return entries;
  } catch {
    return catalogCache?.entries ?? null;
  }
}

export function invalidateOpenRouterCatalog() {
  catalogCache = null;
}

// ---------------------------------------------------------------------------
// Runtime state — per-model cooldowns + conservative POOL-LEVEL daily counter
// ---------------------------------------------------------------------------

type OrModelRuntimeState = {
  cooldownUntil: number;
  exhaustedUntil: number;
  inFlight: number;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastErrorCode: string | null;
  updatedAt: number;
};

type OrPoolState = { dayKey: string; usedToday: number; inFlight: number };

const modelStates = new Map<string, OrModelRuntimeState>();
const poolState: OrPoolState = { dayKey: "", usedToday: 0, inFlight: 0 };

function utcDayKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

function getModelState(model: string, now: number): OrModelRuntimeState {
  let state = modelStates.get(model);
  if (!state) {
    state = {
      cooldownUntil: 0, exhaustedUntil: 0, inFlight: 0,
      lastSuccessAt: null, lastErrorAt: null, lastErrorCode: null, updatedAt: now,
    };
    modelStates.set(model, state);
  }
  return state;
}

function syncPoolDay(now: number) {
  const key = utcDayKey(now);
  if (poolState.dayKey !== key) {
    poolState.dayKey = key;
    poolState.usedToday = 0;
    poolState.inFlight = 0;
  }
}

function isModelEligible(model: string, catalog: Map<string, OpenRouterCatalogEntry> | null, now: number): {
  ok: boolean;
  reason: string | null;
} {
  const state = getModelState(model, now);
  if (now < state.cooldownUntil) return { ok: false, reason: "일시 사용 불가(쿨다운)" };
  if (now < state.exhaustedUntil) return { ok: false, reason: state.lastErrorCode === "MODEL_INVALID" ? "모델 사용 불가" : "무료 한도 도달" };

  // Catalog checks (free variant, text output, context length). A null catalog
  // means the check could not run — fall through and rely on per-call fallback.
  if (catalog) {
    const entry = catalog.get(model);
    if (!entry) return { ok: false, reason: "카탈로그에서 제거됨" };
    if (!entry.free) return { ok: false, reason: "무료 변형 종료(유료화)" };
    if (!entry.textOutput) return { ok: false, reason: "텍스트 출력 미지원" };
    if (entry.contextLength > 0 && entry.contextLength < OR_MIN_CONTEXT_TOKENS) {
      return { ok: false, reason: "컨텍스트 길이 부족" };
    }
  }

  // Conservative shared free-plan budget (incl. concurrent in-flight requests).
  syncPoolDay(now);
  if (OR_POOL_DAILY_BUDGET - poolState.usedToday - poolState.inFlight < 1) {
    return { ok: false, reason: "무료 플랜 일일 예산 소진(보수적 카운터)" };
  }
  return { ok: true, reason: null };
}

/** Atomically reserve one request slot. Returns the failure reason, or null on success. */
export function reserveOpenRouterRequest(
  model: string,
  catalog: Map<string, OpenRouterCatalogEntry> | null,
  now = Date.now(),
): string | null {
  const check = isModelEligible(model, catalog, now);
  if (!check.ok) return check.reason;
  syncPoolDay(now);
  poolState.usedToday += 1;
  poolState.inFlight += 1;
  const state = getModelState(model, now);
  state.inFlight += 1;
  state.updatedAt = now;
  return null;
}

/** Resolve a reservation made by `reserveOpenRouterRequest`. Failures stay counted (conservative). */
export function resolveOpenRouterReservation(model: string, success: boolean, now = Date.now()) {
  syncPoolDay(now);
  poolState.inFlight = Math.max(0, poolState.inFlight - 1);
  const state = getModelState(model, now);
  state.inFlight = Math.max(0, state.inFlight - 1);
  if (success) state.lastSuccessAt = now;
  state.updatedAt = now;
}

// ---------------------------------------------------------------------------
// Error-driven state transitions (mirrors the Gemini pool policy)
// ---------------------------------------------------------------------------

/** Free-tier rate limit: bench the model, keep walking the pool (never paid models). */
export function markOpenRouterRateLimited(model: string, now = Date.now()) {
  const state = getModelState(model, now);
  state.cooldownUntil = Math.max(state.cooldownUntil, now + OR_RATE_LIMIT_COOLDOWN_MS);
  state.lastErrorAt = now;
  state.lastErrorCode = "RATE_LIMITED";
  state.updatedAt = now;
}

export function markOpenRouterServiceUnavailable(model: string, now = Date.now()) {
  const state = getModelState(model, now);
  state.cooldownUntil = Math.max(state.cooldownUntil, now + OR_SERVICE_COOLDOWN_MS);
  state.lastErrorAt = now;
  state.lastErrorCode = "PROVIDER";
  state.updatedAt = now;
}

export function markOpenRouterTimeout(model: string, now = Date.now()) {
  const state = getModelState(model, now);
  state.cooldownUntil = Math.max(state.cooldownUntil, now + OR_TIMEOUT_COOLDOWN_MS);
  state.lastErrorAt = now;
  state.lastErrorCode = "TIMEOUT";
  state.updatedAt = now;
}

export function markOpenRouterModelInvalid(model: string, now = Date.now()) {
  const state = getModelState(model, now);
  state.exhaustedUntil = Math.max(state.exhaustedUntil, now + OR_INVALID_MODEL_COOLDOWN_MS);
  state.lastErrorAt = now;
  state.lastErrorCode = "MODEL_INVALID";
  state.updatedAt = now;
  invalidateOpenRouterCatalog();
}

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

export function getOrderedOpenRouterPool(): OpenRouterModelConfig[] {
  return [...OPENROUTER_MODEL_PRIORITY].sort((a, b) => a.priority - b.priority);
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

/**
 * The OpenRouter model the NEXT fallback request would use (priority order,
 * catalog + cooldown checks only). Pure with respect to the API — the catalog
 * itself is cached. Returns null when nothing is currently eligible.
 */
export function previewNextOpenRouterModel(
  catalog: Map<string, OpenRouterCatalogEntry> | null,
  now = Date.now(),
): { model: string; displayName: string } | null {
  for (const entry of getOrderedOpenRouterPool()) {
    if (isModelEligible(entry.model, catalog, now).ok) {
      return { model: entry.model, displayName: entry.displayName };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Development diagnostics — never includes credentials or content.
// ---------------------------------------------------------------------------

export type OpenRouterModelDiagnostics = {
  model: string;
  displayName: string;
  priority: number;
  inFlight: number;
  cooldownUntil: string | null;
  exhaustedUntil: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  ineligibleReason: string | null;
  eligibleNow: boolean;
  inCatalog: boolean | null;
  freeNow: boolean | null;
  contextLength: number | null;
  supportsJsonResponseFormat: boolean | null;
};

export function getOpenRouterDiagnostics(
  catalog: Map<string, OpenRouterCatalogEntry> | null,
): { models: OpenRouterModelDiagnostics[]; pool: { usedToday: number; inFlight: number; dailyBudget: number } } {
  const now = Date.now();
  syncPoolDay(now);
  return {
    pool: { usedToday: poolState.usedToday, inFlight: poolState.inFlight, dailyBudget: OR_POOL_DAILY_BUDGET },
    models: getOrderedOpenRouterPool().map((config) => {
      const state = getModelState(config.model, now);
      const reason = isModelEligible(config.model, catalog, now);
      const entry = catalog?.get(config.model);
      return {
        model: config.model,
        displayName: config.displayName,
        priority: config.priority,
        inFlight: state.inFlight,
        cooldownUntil: state.cooldownUntil > now ? new Date(state.cooldownUntil).toISOString() : null,
        exhaustedUntil: state.exhaustedUntil > now ? new Date(state.exhaustedUntil).toISOString() : null,
        lastSuccessAt: state.lastSuccessAt ? new Date(state.lastSuccessAt).toISOString() : null,
        lastErrorAt: state.lastErrorAt ? new Date(state.lastErrorAt).toISOString() : null,
        lastErrorCode: state.lastErrorCode,
        ineligibleReason: reason.ok ? null : reason.reason,
        eligibleNow: reason.ok,
        inCatalog: catalog ? Boolean(entry) : null,
        freeNow: entry ? entry.free : null,
        contextLength: entry?.contextLength ?? null,
        supportsJsonResponseFormat: entry?.supportsJsonResponseFormat ?? null,
      };
    }),
  };
}

/** Dev-only test hook: clear all runtime state (used by the diagnostics route). */
export function resetOpenRouterState() {
  modelStates.clear();
  poolState.usedToday = 0;
  poolState.inFlight = 0;
  poolState.dayKey = "";
  invalidateOpenRouterCatalog();
}

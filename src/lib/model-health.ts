import {
  INVALID_MODEL_COOLDOWN_MS,
  RATE_LIMIT_COOLDOWN_MS,
  SERVICE_COOLDOWN_MS,
  TIMEOUT_COOLDOWN_MS,
  markModelInvalid,
  markRateLimited,
  markServiceUnavailable,
} from "@/lib/gemini-models";
import {
  OR_INVALID_MODEL_COOLDOWN_MS,
  OR_RATE_LIMIT_COOLDOWN_MS,
  OR_SERVICE_COOLDOWN_MS,
  OR_TIMEOUT_COOLDOWN_MS,
  markOpenRouterModelInvalid,
  markOpenRouterRateLimited,
  markOpenRouterServiceUnavailable,
  markOpenRouterTimeout,
} from "@/lib/openrouter-models";
import { prisma } from "@/lib/prisma";

/**
 * Shared model health (why this exists).
 *
 * Model eligibility lives in per-process memory, so on Vercel every request that
 * lands on a cold instance starts from "all models look perfect": it retries the
 * top-priority model that Google rejected a minute ago, spends budget on it, and
 * the model shown in the UI keeps disagreeing with the model that actually
 * answers. The DB is the only storage the instances share, so each rejection is
 * recorded in AIRequestLog and replayed into the in-memory state before the next
 * walk — the pool, and therefore the UI prediction, then start from the same
 * truth the previous request learned.
 */

/** Rejections older than this say nothing about a model's health right now. */
export const MODEL_HEALTH_WINDOW_MS = 10 * 60_000;

/** Failure codes recorded per rejected model, mapped to how long we bench it. */
export type ModelRejectionCode =
  | "RATE_LIMITED_DAY"
  | "RATE_LIMITED_MINUTE"
  | "PROVIDER"
  | "TIMEOUT"
  | "MODEL_INVALID";

export type ModelRejection = { provider: string; model: string; code: ModelRejectionCode };

/**
 * Records one per-model rejection so other instances can skip it. Fire-and-forget:
 * logging must never slow down or fail a generation walk.
 */
export function recordModelRejection(rejection: ModelRejection) {
  void prisma.aIRequestLog
    .create({
      data: {
        operation: "MODEL_REJECTION",
        provider: rejection.provider,
        model: rejection.model,
        success: false,
        errorCode: rejection.code,
      },
    })
    .catch(() => undefined);
}

export type ModelHealthSnapshot = {
  /** Models that failed recently and have not succeeded since. */
  failures: Array<ModelRejection & { failedAt: number }>;
  /** Most recent successful question generation, if any. */
  lastSuccess: { provider: string; model: string; at: Date } | null;
};

/**
 * Reads what other instances learned: recent per-model rejections plus the last
 * successful generation. Returns null when the DB cannot be reached — health
 * sharing is best-effort and must never break a request.
 */
export async function loadModelHealth(now = Date.now()): Promise<ModelHealthSnapshot | null> {
  try {
    const [rows, lastSuccess] = await Promise.all([
      prisma.aIRequestLog.findMany({
        where: { createdAt: { gte: new Date(now - MODEL_HEALTH_WINDOW_MS) } },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { provider: true, model: true, errorCode: true, success: true, createdAt: true },
      }),
      prisma.aIRequestLog.findFirst({
        where: { operation: "GENERATE_QUESTIONS", success: true, model: { not: "pool-exhausted" } },
        orderBy: { createdAt: "desc" },
        select: { provider: true, model: true, createdAt: true },
      }),
    ]);

    // Newest first: a model that succeeded after failing is healthy again, so it
    // must not be benched by an older rejection.
    const recovered = new Set<string>();
    const failures: ModelHealthSnapshot["failures"] = [];
    for (const row of rows) {
      // Route-level failures name no single model when the whole walk ran out of budget.
      if (!row.model || row.model === "pool-exhausted") continue;
      const key = `${row.provider}:${row.model}`;
      if (row.success) {
        recovered.add(key);
        continue;
      }
      if (recovered.has(key)) continue;
      failures.push({ provider: row.provider, model: row.model, code: (row.errorCode ?? "PROVIDER") as ModelRejectionCode, failedAt: row.createdAt.getTime() });
    }
    return { failures, lastSuccess: lastSuccess ? { provider: lastSuccess.provider, model: lastSuccess.model, at: lastSuccess.createdAt } : null };
  } catch {
    return null;
  }
}

/**
 * Applies a shared health snapshot to this process's model state. Cooldowns are
 * computed from the original failure time, so a rejection two minutes ago still
 * benched now is applied with whatever time is left — not a fresh full cooldown.
 */
export function applyModelHealth(snapshot: ModelHealthSnapshot | null, now = Date.now()) {
  if (!snapshot) return;
  for (const failure of snapshot.failures) {
    const ageMs = now - failure.failedAt;
    if (ageMs < 0 || ageMs > MODEL_HEALTH_WINDOW_MS) continue;
    if (failure.provider === "openrouter") {
      // OpenRouter free-tier 429s reset daily — bench long, keep walking the pool.
      if (failure.code === "RATE_LIMITED_DAY" || failure.code === "RATE_LIMITED_MINUTE") {
        if (ageMs < OR_RATE_LIMIT_COOLDOWN_MS) markOpenRouterRateLimited(failure.model, failure.failedAt);
      } else if (failure.code === "TIMEOUT") {
        if (ageMs < OR_TIMEOUT_COOLDOWN_MS) markOpenRouterTimeout(failure.model, failure.failedAt);
      } else if (failure.code === "MODEL_INVALID") {
        if (ageMs < OR_INVALID_MODEL_COOLDOWN_MS) markOpenRouterModelInvalid(failure.model, failure.failedAt);
      } else if (ageMs < OR_SERVICE_COOLDOWN_MS) {
        markOpenRouterServiceUnavailable(failure.model, failure.failedAt);
      }
      continue;
    }
    if (failure.code === "RATE_LIMITED_DAY") {
      markRateLimited(failure.model, failure.failedAt);
    } else if (failure.code === "RATE_LIMITED_MINUTE") {
      if (ageMs < RATE_LIMIT_COOLDOWN_MS) markServiceUnavailable(failure.model, RATE_LIMIT_COOLDOWN_MS, "RATE_LIMITED_MINUTE", failure.failedAt);
    } else if (failure.code === "TIMEOUT") {
      if (ageMs < TIMEOUT_COOLDOWN_MS) markServiceUnavailable(failure.model, TIMEOUT_COOLDOWN_MS, "TIMEOUT", failure.failedAt);
    } else if (failure.code === "MODEL_INVALID") {
      markModelInvalid(failure.model, failure.failedAt);
    } else if (ageMs < SERVICE_COOLDOWN_MS) {
      markServiceUnavailable(failure.model, SERVICE_COOLDOWN_MS, "PROVIDER", failure.failedAt);
    }
  }
}

/**
 * Convenience for callers that only need the side effect: read the shared health
 * and push it into this process before starting a model walk.
 */
export async function syncModelHealthFromRecentFailures(now = Date.now()) {
  const snapshot = await loadModelHealth(now);
  applyModelHealth(snapshot, now);
  return snapshot;
}

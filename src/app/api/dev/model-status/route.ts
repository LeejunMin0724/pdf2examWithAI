import {
  getAvailableModelIds,
  getDiagnosticsSnapshot,
  MODEL_AVAILABILITY_CACHE_TTL_MS,
  RATE_LIMIT_COOLDOWN_MS,
  SERVICE_COOLDOWN_MS,
  TIMEOUT_COOLDOWN_MS,
} from "@/lib/gemini-models";
import {
  getOpenRouterCatalog,
  getOpenRouterDiagnostics,
  OPENROUTER_MODEL_PRIORITY,
  OPENROUTER_AUTO_FALLBACK_ENABLED,
  OR_CATALOG_CACHE_TTL_MS,
  OR_POOL_DAILY_BUDGET,
  OR_RATE_LIMIT_COOLDOWN_MS,
  OR_SERVICE_COOLDOWN_MS,
  OR_TIMEOUT_COOLDOWN_MS,
} from "@/lib/openrouter-models";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Development-only AI/model diagnostics (spec §15).
 * Disabled outside `next dev` — in production this route answers 404.
 * Exposes model pool state only; never credentials, prompts, or user data.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not Found", { status: 404 });
  }

  const [availableIds, catalog, recentLogs] = await Promise.all([
    getAvailableModelIds(),
    getOpenRouterCatalog(),
    prisma.aIRequestLog.findMany({ orderBy: { createdAt: "desc" }, take: 12, select: { operation: true, provider: true, model: true, success: true, errorCode: true, createdAt: true } }),
  ]);

  const openRouter = getOpenRouterDiagnostics(catalog);

  return Response.json({
    generatedAt: new Date().toISOString(),
    quotaSource: "conservative-server-counter",
    quotaNote:
      "Google does not expose an official remaining-RPD endpoint for AI Studio keys, and OpenRouter does not publish per-key free-plan limits. observedUsage/usedToday are this server's own request counts and the budgets are tunable estimates — treat both as approximate.",
    providerHierarchy: "google(gemini pool) -> openrouter(free pool) -> clean error",
    openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    tunables: {
      MODEL_AVAILABILITY_CACHE_TTL_MS,
      RATE_LIMIT_COOLDOWN_MS,
      SERVICE_COOLDOWN_MS,
      TIMEOUT_COOLDOWN_MS,
      OR_CATALOG_CACHE_TTL_MS,
      OR_RATE_LIMIT_COOLDOWN_MS,
      OR_SERVICE_COOLDOWN_MS,
      OR_TIMEOUT_COOLDOWN_MS,
      OR_POOL_DAILY_BUDGET,
      OPENROUTER_AUTO_FALLBACK_ENABLED,
      openRouterPoolSize: OPENROUTER_MODEL_PRIORITY.length,
    },
    gemini: { models: getDiagnosticsSnapshot(availableIds) },
    openRouter,
    recentRequests: recentLogs,
  });
}

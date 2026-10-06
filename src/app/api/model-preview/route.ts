import { GEMINI_MODEL_PRIORITY, getAvailableModelIds, previewNextModel } from "@/lib/gemini-models";
import { OPENROUTER_MODEL_PRIORITY, getOpenRouterCatalog, previewNextOpenRouterModel } from "@/lib/openrouter-models";
import { syncModelHealthFromRecentFailures } from "@/lib/model-health";

export const runtime = "nodejs";

/** Human-readable name for a model ID recorded in the request log. */
function displayNameFor(model: string) {
  return (
    GEMINI_MODEL_PRIORITY.find((entry) => entry.model === model)?.displayName ??
    OPENROUTER_MODEL_PRIORITY.find((entry) => entry.model === model)?.displayName ??
    model
  );
}

/**
 * Which model the NEXT generation would use — shown before the user clicks 문제
 * 생성하기. Makes no model API calls, but it does consult the SHARED model health
 * (AIRequestLog) first: eligibility lives in per-process memory, so without that
 * step a cold instance promises the top-priority model while the previous request
 * already learned Google rejects it right now. The answer is still a prediction,
 * so it is labelled as one in the UI — plus the last model that really answered.
 */
export async function GET() {
  const health = await syncModelHealthFromRecentFailures();
  const lastSuccess = health?.lastSuccess
    ? { provider: health.lastSuccess.provider, model: health.lastSuccess.model, displayName: displayNameFor(health.lastSuccess.model), at: health.lastSuccess.at.toISOString() }
    : undefined;

  const availableIds = await getAvailableModelIds();
  const preview = previewNextModel(availableIds);
  if (preview) {
    return Response.json({
      available: true as const,
      provider: "google" as const,
      model: preview.model,
      displayName: preview.displayName,
      fallback: preview.fallback,
      fallbackReason: preview.fallbackReason ?? undefined,
      skipped: preview.skipped ?? undefined,
      lastSuccess,
    });
  }

  // Every Gemini model is currently ineligible — the next request falls through
  // to OpenRouter (only when a key is configured; otherwise unavailable).
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return Response.json({ available: false as const, lastSuccess });
  }
  const catalog = await getOpenRouterCatalog();
  const openRouterPreview = previewNextOpenRouterModel(catalog);
  if (!openRouterPreview) {
    return Response.json({ available: false as const, lastSuccess });
  }
  return Response.json({
    available: true as const,
    provider: "openrouter" as const,
    model: openRouterPreview.model,
    displayName: openRouterPreview.displayName,
    fallback: true,
    fallbackReason: "all_gemini_models_unavailable",
    lastSuccess,
  });
}

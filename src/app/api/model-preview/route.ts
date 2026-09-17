import { getAvailableModelIds, previewNextModel } from "@/lib/gemini-models";
import { getOpenRouterCatalog, previewNextOpenRouterModel } from "@/lib/openrouter-models";

export const runtime = "nodejs";

/**
 * Lightweight prefetch endpoint: which model the NEXT generation would use.
 * The frontend shows this before the user clicks 문제 생성하기. Uses the cached
 * availability checks + local quota state only — makes no model API calls.
 * Provider hierarchy mirrors ai.ts: Gemini pool first, OpenRouter free pool
 * only when every Gemini model is unavailable.
 */
export async function GET() {
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
    });
  }

  // Every Gemini model is currently ineligible — the next request falls through
  // to OpenRouter (only when a key is configured; otherwise unavailable).
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return Response.json({ available: false as const });
  }
  const catalog = await getOpenRouterCatalog();
  const openRouterPreview = previewNextOpenRouterModel(catalog);
  if (!openRouterPreview) {
    return Response.json({ available: false as const });
  }
  return Response.json({
    available: true as const,
    provider: "openrouter" as const,
    model: openRouterPreview.model,
    displayName: openRouterPreview.displayName,
    fallback: true,
    fallbackReason: "all_gemini_models_unavailable",
  });
}

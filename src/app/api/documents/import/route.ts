import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PDF_STORAGE_BUCKET } from "@/lib/pdf-storage";
import { MAX_PDF_SIZE_BYTES, MAX_PDF_SIZE_MB, MIN_EXTRACTED_TEXT_LENGTH, PdfExtractionError, extractPdfPages, isPdfSignature } from "@/lib/pdf-extractor";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient, getAuthUserId } from "@/lib/supabase-server";

export const runtime = "nodejs";
// Downloading + parsing a large lecture PDF outlives the serverless default.
export const maxDuration = 60;

const importSchema = z.object({
  storagePath: z.string().min(1).max(512),
  originalName: z.string().min(1).max(255),
});

/**
 * Completes an upload the browser sent straight to Supabase Storage.
 *
 * The 4.5MB request-body cap on hosted functions means big PDFs can never reach
 * this app's own upload route, so the client stores the file in the user's own
 * folder first and sends only { storagePath, originalName } here. We download
 * it with the caller's session (row level security keeps it private), run the
 * exact same extraction pipeline as the multipart route, and record the pages.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "가져올 파일 정보가 올바르지 않습니다." }, { status: 400 });

  const { storagePath, originalName } = parsed.data;
  if (!originalName.toLowerCase().endsWith(".pdf")) return Response.json({ error: "PDF 파일만 업로드할 수 있습니다." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthUserId();
  if (!supabase || !userId) {
    return Response.json({ error: "큰 파일은 로그인 후 업로드할 수 있습니다." }, { status: 401 });
  }
  // Objects live under "<user id>/<document id>.pdf" — never read someone else's.
  if (!storagePath.startsWith(`${userId}/`)) {
    return Response.json({ error: "다른 사용자의 파일에는 접근할 수 없습니다." }, { status: 403 });
  }

  const { data: blob, error: downloadError } = await supabase.storage.from(PDF_STORAGE_BUCKET).download(storagePath);
  if (downloadError || !blob) {
    console.error("[documents/import] download failed:", downloadError?.message);
    return Response.json({ error: "업로드한 파일을 찾을 수 없습니다. 다시 시도해 주세요." }, { status: 422 });
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const discard = () => supabase.storage.from(PDF_STORAGE_BUCKET).remove([storagePath]).catch(() => undefined);

  if (bytes.length === 0 || bytes.length > MAX_PDF_SIZE_BYTES) {
    await discard();
    return Response.json({ error: `PDF는 1바이트 이상, ${MAX_PDF_SIZE_MB}MB 이하만 업로드할 수 있습니다.` }, { status: 400 });
  }
  if (!isPdfSignature(bytes)) {
    await discard();
    return Response.json({ error: "올바른 PDF 파일이 아닙니다." }, { status: 400 });
  }

  try {
    const pages = await extractPdfPages(bytes);
    const extractedCharacterCount = pages.reduce((total, page) => total + page.text.length, 0);
    if (extractedCharacterCount < MIN_EXTRACTED_TEXT_LENGTH) {
      await discard();
      return Response.json({ error: "추출할 텍스트가 거의 없습니다. 현재는 스캔 PDF/OCR을 지원하지 않습니다." }, { status: 422 });
    }

    const documentId = randomUUID();
    await prisma.document.create({
      data: {
        id: documentId,
        userId,
        originalName,
        storageKey: storagePath,
        extractionState: "COMPLETE",
        pageCount: pages.length,
        extractedAt: new Date(),
        pages: {
          create: pages.map((page) => ({
            pageNumber: page.pageNumber,
            text: page.text,
          })),
        },
      },
    });

    return Response.json({ documentId, originalName, pageCount: pages.length, extractedCharacterCount });
  } catch (error) {
    await discard();
    if (error instanceof PdfExtractionError) return Response.json({ error: error.message }, { status: 422 });
    console.error("[documents/import] failed:", error);
    return Response.json({ error: "PDF 처리 중 오류가 발생했습니다. 다시 시도해 주세요." }, { status: 500 });
  }
}

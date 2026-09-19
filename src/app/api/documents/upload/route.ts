import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/supabase-server";
import { MAX_PDF_SIZE_BYTES, MIN_EXTRACTED_TEXT_LENGTH, PdfExtractionError, extractPdfPages, isPdfSignature } from "@/lib/pdf-extractor";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "업로드할 PDF를 선택해 주세요." }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".pdf")) return Response.json({ error: "PDF 파일만 업로드할 수 있습니다." }, { status: 400 });
  if (file.size === 0 || file.size > MAX_PDF_SIZE_BYTES) {
    return Response.json({ error: `PDF는 1바이트 이상, ${MAX_PDF_SIZE_BYTES / 1024 / 1024}MB 이하만 업로드할 수 있습니다.` }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdfSignature(bytes)) return Response.json({ error: "올바른 PDF 파일이 아닙니다." }, { status: 400 });

  // Associate the upload with the signed-in user (null when auth is disabled).
  const userId = await getAuthUserId();

  const documentId = randomUUID();
  const uploadsDirectory = path.join(process.cwd(), "storage", "uploads");
  const pdfPath = path.join(uploadsDirectory, `${documentId}.pdf`);
  const extractionPath = path.join(uploadsDirectory, `${documentId}.json`);

  try {
    const pages = await extractPdfPages(bytes);
    const extractedCharacterCount = pages.reduce((total, page) => total + page.text.length, 0);
    if (extractedCharacterCount < MIN_EXTRACTED_TEXT_LENGTH) {
      return Response.json({ error: "추출할 텍스트가 거의 없습니다. 현재는 스캔 PDF/OCR을 지원하지 않습니다." }, { status: 422 });
    }

    await mkdir(uploadsDirectory, { recursive: true });
    await writeFile(pdfPath, bytes);
    await writeFile(extractionPath, JSON.stringify({ originalName: file.name, pages }, null, 2));

    try {
      await prisma.document.create({
        data: {
          id: documentId,
          userId,
          originalName: file.name,
          storageKey: `uploads/${documentId}.pdf`,
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
    } catch (error) {
      await Promise.allSettled([rm(pdfPath, { force: true }), rm(extractionPath, { force: true })]);
      throw error;
    }

    return Response.json({ documentId, originalName: file.name, pageCount: pages.length, extractedCharacterCount });
  } catch (error) {
    if (error instanceof PdfExtractionError) return Response.json({ error: error.message }, { status: 422 });
    return Response.json({ error: "PDF 처리 중 오류가 발생했습니다. 다시 시도해 주세요." }, { status: 500 });
  }
}

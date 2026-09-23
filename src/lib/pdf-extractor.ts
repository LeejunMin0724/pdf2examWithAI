import path from "node:path";
import { getDocument, type PDFDocumentLoadingTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import { MAX_PDF_PAGES, MIN_EXTRACTED_TEXT_LENGTH } from "@/lib/pdf-limits";

// Limits live in a client-safe module; re-exported here for existing callers.
export { MAX_PDF_PAGES, MAX_PDF_SIZE_BYTES, MAX_PDF_SIZE_MB, MIN_EXTRACTED_TEXT_LENGTH } from "@/lib/pdf-limits";

export type ExtractedPdfPage = { pageNumber: number; text: string };

export class PdfExtractionError extends Error {}

// pdf.js transfers (detaches) the buffer passed as `data`, so extraction must
// run on a copy and the caller keeps the original for storage.
export async function extractPdfPages(pdfBytes: Uint8Array): Promise<ExtractedPdfPage[]> {
  const extractionBytes = pdfBytes.slice();
  let pdf;
  let loadingTask: PDFDocumentLoadingTask;
  try {
    loadingTask = getDocument({
      data: extractionBytes,
      standardFontDataUrl: path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts") + path.sep,
    });
    pdf = await loadingTask.promise;
  } catch (error) {
    console.error("[pdf-extractor] getDocument failed:", error);
    throw new PdfExtractionError("PDF 파일을 읽을 수 없습니다.");
  }

  if (pdf.numPages > MAX_PDF_PAGES) {
    await loadingTask.destroy();
    throw new PdfExtractionError(`PDF는 최대 ${MAX_PDF_PAGES}페이지까지 업로드할 수 있습니다.`);
  }

  try {
    const pages: ExtractedPdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push({ pageNumber, text });
    }
    return pages;
  } catch (error) {
    console.error("[pdf-extractor] page extraction failed:", error);
    throw new PdfExtractionError("PDF 텍스트 추출 중 오류가 발생했습니다.");
  } finally {
    await loadingTask.destroy();
  }
}

export function isPdfSignature(bytes: Uint8Array) {
  return bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

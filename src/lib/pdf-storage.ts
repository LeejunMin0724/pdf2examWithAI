/**
 * Supabase Storage handoff for large PDFs.
 *
 * Hosted serverless functions reject any request body above 4.5MB, so a PDF
 * bigger than that can never reach our own API route. Instead the browser sends
 * it straight to Supabase Storage and then tells the server where to find it.
 * Small files keep using the direct multipart route (one round trip, no bucket
 * required), so local development without Supabase still works.
 *
 * Bucket layout: "<user id>/<document id>.pdf" — the folder makes the
 * row-level-security policies a one-liner (`foldername[1] = auth.uid()`).
 */
export const PDF_STORAGE_BUCKET = "pdf-uploads";

/** Stay under the 4.5MB function body cap with room for multipart overhead. */
export const DIRECT_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

export function pdfStoragePath(userId: string, documentId: string): string {
  return `${userId}/${documentId}.pdf`;
}

/** Turns Supabase Storage errors into something a user can act on. */
export function translateStorageUploadError(message: string): string {
  if (/bucket not found/i.test(message)) {
    return "파일 저장소가 아직 준비되지 않았습니다. Supabase SQL Editor에서 supabase/storage-setup.sql을 한 번 실행해 주세요.";
  }
  if (/row-level security|violates row-level|not allowed|unauthorized|permission/i.test(message)) {
    return "파일 저장소 권한이 설정되지 않았습니다. supabase/storage-setup.sql을 실행해 주세요.";
  }
  if (/exceeded the maximum allowed size|maximum allowed size|payload too large|entity too large/i.test(message)) {
    return "PDF가 파일 저장소의 업로드 한도를 넘었습니다. 더 작은 파일로 시도해 주세요.";
  }
  return "파일 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

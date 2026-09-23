/**
 * Upload limits shared by the browser (pre-flight checks) and the server
 * (enforcement). Kept free of Node-only imports so client components can use
 * the same numbers the API routes enforce.
 */
export const MAX_PDF_SIZE_MB = 20;
export const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;
export const MAX_PDF_PAGES = 200;
export const MIN_EXTRACTED_TEXT_LENGTH = 30;

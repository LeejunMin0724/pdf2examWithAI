import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js resolves its worker with a dynamic import that bundlers rewrite
  // into a missing chunk. Keep it external so the import resolves natively.
  serverExternalPackages: ["pdfjs-dist"],
  // pdf.js loads its worker at runtime via `await import("./pdf.worker.mjs")`,
  // relative to its own file. That import is invisible to Next's file tracing,
  // so the serverless bundle shipped to Vercel omitted pdf.worker.mjs and every
  // upload failed with `Setting up fake worker failed`. Force the worker (and
  // the standard-font data it looks up) into the upload function's bundle.
  outputFileTracingIncludes: {
    // Every route that parses a PDF must be listed here.
    "/api/documents/upload": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
    ],
    "/api/documents/import": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
    ],
  },
};

export default nextConfig;

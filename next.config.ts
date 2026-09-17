import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js resolves its worker with a dynamic import that bundlers rewrite
  // into a missing chunk. Keep it external so the import resolves natively.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;

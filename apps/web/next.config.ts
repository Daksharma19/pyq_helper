import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@pyq/shared", "@pyq/db"],
  // PDF reading and OCR run in the Node server. unpdf (pdf.js) and tesseract.js locate their
  // own files at runtime (import.meta.url, worker threads) and
  // @napi-rs/canvas is a native addon, so all three load from node_modules, not bundled.
  serverExternalPackages: ["unpdf", "tesseract.js", "@napi-rs/canvas"],
  // Paper PDFs go through server actions; the storage bucket caps them at 20 MiB.
  experimental: { serverActions: { bodySizeLimit: "21mb" } },
};

export default config;

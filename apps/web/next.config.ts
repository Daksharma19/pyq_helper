import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@pyq/shared", "@pyq/db"],
  // PDF reading, OCR and conversion run in the Node server. unpdf (pdf.js) and tesseract.js
  // locate their own files at runtime (import.meta.url, worker threads) and @napi-rs/canvas
  // is a native addon, so they load from node_modules instead of being bundled. (sharp,
  // pg and @prisma/client are on Next's default external list.)
  serverExternalPackages: ["unpdf", "tesseract.js", "@napi-rs/canvas"],
  // Vercel only ships files the tracer finds. tesseract.js starts its worker script and
  // loads its wasm core by computed paths, so include them for the admin (upload) routes.
  outputFileTracingRoot: path.join(process.cwd(), "../.."), // repo root; builds run in apps/web
  outputFileTracingIncludes: {
    "/admin/**": [
      "../../node_modules/.pnpm/tesseract.js@*/node_modules/tesseract.js/src/**",
      "../../node_modules/.pnpm/tesseract.js-core@*/node_modules/tesseract.js-core/*.{js,wasm}",
    ],
  },
  // Uploads go through server actions; files are capped at 20 MB (see upload-formats.ts).
  experimental: { serverActions: { bodySizeLimit: "21mb" } },
  async headers() {
    return [
      {
        // pdf.js assets live under a versioned path (scripts/copy-pdfjs.mjs): cache forever.
        source: "/pdfjs/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default config;

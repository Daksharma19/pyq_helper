import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@pyq/shared", "@pyq/db"],
  // Paper PDFs go through server actions; the storage bucket caps them at 20 MiB.
  experimental: { serverActions: { bodySizeLimit: "21mb" } },
};

export default config;

import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@pyq/shared", "@pyq/db"],
};

export default config;

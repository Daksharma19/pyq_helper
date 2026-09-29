import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src,
      // `server-only` throws outside Next's server bundle; in unit tests it's a no-op.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    passWithNoTests: true,
    environment: "node",
    // Public env is validated at import time; tests never talk to Supabase.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test",
    },
    testTimeout: 30_000,
  },
});

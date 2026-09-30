import { z } from "zod";

// The only place web env vars are read.

// Public by design (anon key + RLS); safe in the browser and in middleware.
export const env = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  })
  .parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

// Server-only settings, parsed on first use by the code that needs them.
let server: { DATABASE_URL: string } | undefined;
export function serverEnv() {
  server ??= z
    .object({ DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a Postgres URL") })
    .parse({ DATABASE_URL: process.env.DATABASE_URL });
  return server;
}

/** Set by Vercel at build and run time. Its filesystem is read-only except the temp dir. */
export const onVercel = process.env.VERCEL === "1";

/** Document conversion. SOFFICE_PATH is optional: LibreOffice is also found in usual places. */
export function converterEnv() {
  return z
    .object({ SOFFICE_PATH: z.string().min(1).optional() })
    .parse({ SOFFICE_PATH: process.env.SOFFICE_PATH || undefined });
}

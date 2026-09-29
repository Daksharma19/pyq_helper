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

// Secrets: parsed on first use, only by server code (lib/db.ts imports "server-only").
let server: { DATABASE_URL: string } | undefined;
export function serverEnv() {
  server ??= z
    .object({ DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a Postgres URL") })
    .parse({ DATABASE_URL: process.env.DATABASE_URL });
  return server;
}

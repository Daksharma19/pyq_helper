import "server-only";
import { createClient } from "@supabase/supabase-js";
import { PAPERS_BUCKET } from "@pyq/db";
import { env } from "@/env";

// Supabase is used for Auth and Storage only; database queries go through Prisma (lib/db.ts).
const publicStorage = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false },
  },
).storage.from(PAPERS_BUCKET);

/** Public URL of a paper PDF; with `download`, the browser saves it under that name. */
export function paperUrl(storagePath: string, download?: string): string {
  return publicStorage.getPublicUrl(storagePath, download ? { download } : undefined).data
    .publicUrl;
}

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { PAPERS_BUCKET, type Client } from "@pyq/db";
import { env } from "@/env";

export function db(): Client {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

export function paperUrl(storagePath: string, download?: string): string {
  return db()
    .storage.from(PAPERS_BUCKET)
    .getPublicUrl(storagePath, download ? { download } : undefined).data.publicUrl;
}

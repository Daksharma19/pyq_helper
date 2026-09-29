import type { SupabaseClient } from "@supabase/supabase-js";
import { PAPERS_BUCKET } from "./queries";

// PDFs live in Supabase Storage (bucket "papers"). Calls use the signed-in user's Supabase
// client, so storage RLS (admin-only writes) applies.

export async function uploadPdf(storage: SupabaseClient, path: string, file: Blob): Promise<void> {
  const { error } = await storage.storage.from(PAPERS_BUCKET).upload(path, file, {
    contentType: "application/pdf",
    // Paths are unique per upload and never overwritten (upsert: false), so browsers and
    // CDNs may cache a PDF for a year.
    cacheControl: String(60 * 60 * 24 * 365),
    upsert: false,
  });
  if (error) throw error;
}

/** Best-effort: an orphaned file is harmless, a failed request shouldn't mask the real result. */
export async function removePdf(storage: SupabaseClient, ...paths: string[]): Promise<void> {
  if (paths.length) await storage.storage.from(PAPERS_BUCKET).remove(paths);
}

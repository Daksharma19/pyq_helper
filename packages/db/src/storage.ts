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

// Admin uploads are first staged by the browser in the private "uploads" bucket (so big
// files never go through a request body), then read back here by path.
export const UPLOADS_BUCKET = "uploads";
/** Staged paths are a random UUID chosen by the browser; anything else is refused. */
export const STAGED_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function downloadStaged(storage: SupabaseClient, path: string): Promise<Blob | null> {
  if (!STAGED_PATH_RE.test(path)) return null;
  const { data, error } = await storage.storage.from(UPLOADS_BUCKET).download(path);
  return error ? null : data;
}

/** Best-effort, like removePdf. */
export async function removeStaged(storage: SupabaseClient, ...paths: string[]): Promise<void> {
  const valid = paths.filter((p) => STAGED_PATH_RE.test(p));
  if (valid.length) await storage.storage.from(UPLOADS_BUCKET).remove(valid);
}

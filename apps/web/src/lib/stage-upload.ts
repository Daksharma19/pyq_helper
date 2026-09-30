"use client";

import { createBrowserClient } from "@supabase/ssr";
import { UPLOADS_BUCKET } from "@pyq/db/storage";
import { env } from "@/env";

// Admin uploads go straight from the browser to the private "uploads" bucket (storage RLS:
// admins only), and server actions receive just the path. Request bodies on Vercel are
// capped at 4.5 MB; papers can be 20 MB.

let client: ReturnType<typeof createBrowserClient> | undefined;
const supabase = () =>
  (client ??= createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY));

/** Uploads the file and returns its staged path. Throws if the upload fails. */
export async function stageUpload(file: File): Promise<string> {
  const path = crypto.randomUUID();
  const { error } = await supabase()
    .storage.from(UPLOADS_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message);
  return path;
}

/** Form fields the server actions read a staged file from (see stagedFile() in actions). */
export async function stagedFields(form: FormData, file: File): Promise<void> {
  form.set("staged", await stageUpload(file));
  form.set("name", file.name);
}

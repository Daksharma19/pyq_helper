// Seeds a hosted Supabase project: applies migrations + seed.sql, creates the public
// papers bucket and uploads the sample PDFs. Reads packages/db/.env.
import { execSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const { SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_DB_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Set SUPABASE_DB_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in packages/db/.env",
  );
  process.exit(1);
}

execSync(`supabase db push --workdir . --db-url "${SUPABASE_DB_URL}" --include-seed --yes`, {
  cwd: pkg,
  stdio: "inherit",
});

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { error: bucketErr } = await admin.storage.createBucket("papers", {
  public: true,
  fileSizeLimit: "20MB",
  allowedMimeTypes: ["application/pdf"],
});
if (bucketErr && !/already exists/i.test(bucketErr.message)) throw bucketErr;

const root = join(pkg, "supabase", "seed-papers");
async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}
for await (const file of walk(root)) {
  const path = relative(root, file).replaceAll("\\", "/");
  const { error } = await admin.storage
    .from("papers")
    .upload(path, await readFile(file), { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  console.log("uploaded", path);
}

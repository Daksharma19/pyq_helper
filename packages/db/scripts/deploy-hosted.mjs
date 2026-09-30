// Sets up or updates a hosted Supabase project. Safe to re-run after every new migration.
//   1. applies pending migrations (tables, RLS, storage buckets and policies);
//   2. loads the course list (courses.sql; existing courses are kept);
//   3. with PRISMA_DB_PASSWORD: creates/updates the `prisma` login role the web app uses;
//   4. with ADMIN_EMAIL: makes that (already signed-up) Supabase Auth user an admin.
// Local sample papers and the local admin in seed.sql are never applied here.
// Reads packages/db/.env.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const { SUPABASE_DB_URL, PRISMA_DB_PASSWORD, ADMIN_EMAIL } = process.env;
if (!SUPABASE_DB_URL) {
  console.error("Set SUPABASE_DB_URL in packages/db/.env (see .env.example).");
  process.exit(1);
}
if (/127\.0\.0\.1|localhost/.test(SUPABASE_DB_URL)) {
  console.error("SUPABASE_DB_URL points at a local database; this script is for hosted projects.");
  process.exit(1);
}

console.log("Applying migrations…");
execFileSync("supabase", ["db", "push", "--workdir", ".", "--db-url", SUPABASE_DB_URL, "--yes"], {
  cwd: pkg,
  stdio: "inherit",
  shell: process.platform === "win32", // supabase is a .cmd shim on Windows
});

const db = new pg.Client({ connectionString: SUPABASE_DB_URL });
await db.connect();
try {
  console.log("Loading courses…");
  await db.query(await readFile(join(pkg, "supabase", "courses.sql"), "utf8"));

  if (PRISMA_DB_PASSWORD) {
    if (PRISMA_DB_PASSWORD.length < 16) throw new Error("PRISMA_DB_PASSWORD: use 16+ characters.");
    console.log("Setting up the prisma role…");
    // Logs in, but can only act as anon/authenticated (RLS applies). See docs/decisions/0004.
    await db.query(`do $$ begin
      if not exists (select from pg_roles where rolname = 'prisma') then create role prisma; end if;
    end $$`);
    await db.query(`alter role prisma login password ${db.escapeLiteral(PRISMA_DB_PASSWORD)}`);
    await db.query("grant anon, authenticated to prisma");
  }

  if (ADMIN_EMAIL) {
    const { rowCount } = await db.query(
      `insert into public.admins (user_id)
       select id from auth.users where lower(email) = lower($1)
       on conflict do nothing`,
      [ADMIN_EMAIL],
    );
    const { rows } = await db.query(
      "select 1 from public.admins a join auth.users u on u.id = a.user_id where lower(u.email) = lower($1)",
      [ADMIN_EMAIL],
    );
    if (!rows.length) {
      throw new Error(
        `No Supabase Auth user ${ADMIN_EMAIL}. Add it under Authentication -> Users first, then re-run.`,
      );
    }
    console.log(rowCount ? `${ADMIN_EMAIL} is now an admin.` : `${ADMIN_EMAIL} was already an admin.`);
  }
} finally {
  await db.end();
}
console.log("Done.");

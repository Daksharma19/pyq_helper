# Notes: defaults chosen without asking

## Phase 1

- **pnpm 12 / Node 24 / Next 15 / Tailwind 4 / zod 4 / Vitest.** Latest stable at the time.
- **No ORM**: supabase-js + generated `Database` types (see docs/decisions/0001).
- **Local Supabase in Docker is the dev database** (`db:start`). Sample PDFs are seeded through `[storage.buckets.papers] objects_path`. The hosted flow (`seed:hosted`) is there for when we deploy.
- **`database.types.ts` is generated** (`db:types`) and excluded from lint and prettier.
- **`apps/web/.env.local`** holds Supabase's well-known local demo anon key. It is gitignored anyway.
- **Course list**: `18B11EC213 Digital Systems` is from the brief. The other codes and titles are best-effort JIIT codes and **must be checked against the official course list**. Course code format is enforced as `^\d{2}[A-Z]\d{2}[A-Z]{2}\d{3}$`.
- **Sample PDFs** are generated placeholders (`seed:pdfs`), not real papers.
- **Year** is checked as 2000–2100 in the DB. A "not in the future" check belongs in the admin upload validation (Phase 2), because Postgres CHECK constraints can't use `now()`.
- **Data pages are dynamic** (rendered per request), so `build` never needs a live DB. CI uses placeholder env vars. Caching and ISR can come later if traffic needs it.
- **Invalid filter params are dropped silently**, not turned into errors, so a stale or shared URL still shows results.
- **Mobile PDF preview**: phones don't render embedded PDFs well, so the inline preview only shows on ≥ sm screens. Phones get "Open PDF" (native viewer) and "Download".
- **Pagination**: capped at 30 results. Real pagination comes once there are enough papers.

## Phase 2

- **Admins = rows in `public.admins`**, checked by `is_admin()` in RLS (tables + storage). No service-role key in the web app. See docs/decisions/0002.
- **Email + password login** via `@supabase/ssr` cookies. No sign-up UI. Non-admins who sign in are signed straight back out.
- **Semester is not stored per paper.** It comes from the course. On the upload form, semester only filters the course list.
- **Unpublish = `published` flag**, hidden by RLS from non-admins and filtered in public queries.
- **Year ≤ current year** is checked in the shared zod schema (`paperInputSchema`), used by the form and the CSV.
- **Storage key** `<code>/<year>-<term>-<stamp>.pdf`: a new key per upload, so replaced PDFs never serve stale.
- **Course codes can't be edited** (they are the key). Courses with papers can't be deleted (FK); the UI hides the button.
- **Bulk upload** calls the same `createPaper` server action row by row, so it has one validation path.
- **`turbo build` now depends on `typecheck`**: running both in parallel raced on `.next/types`.
- **Real scans in `/papers` and `/toput`** are gitignored: they show students' names and enrollment numbers. They were loaded into the local DB only, through the admin upload pipeline.

### Phase 2b: upload pipeline, hash ids, Prisma (owner's requests)

- **Paper identity = `paper_hash` = SHA-256 of `COURSE|TERM|YEAR`**, computed from the extracted metadata (owner's choice). It is a Postgres generated column, so the DB owns it. `file_hash` (SHA-256 of the bytes) is kept as a second unique check against re-uploading the same file. See docs/decisions/0003.
- **Full 64-hex hashes in URLs** (not a shortened prefix): unambiguous, with no collision handling needed. Malformed ids return 404 before any query runs.
- **OCR = tesseract.js in the Next server**, used only when a PDF has no usable text layer (under 40 characters). Pages 1–2 at 2× scale. One shared worker. Language data is cached in `apps/web/.cache/tesseract`.
- **Question count** = max(highest OCR-tolerant `Q<n>`, number of `[nM]` marks tags). The maths T2 2023 paper has **6** questions (Q6 is on page 2). An earlier manual reading of 5 was wrong.
- **Never hold a DB transaction across OCR**: pdf.js rendering blocks the event loop, and the first version timed out (Prisma P2028). Courses are loaded before OCR, and transactions get explicit `maxWait`/`timeout`.
- **`unpdf`, `tesseract.js`, `@napi-rs/canvas` are `serverExternalPackages`**: they locate their own files or native binaries at runtime, and bundling them broke `import.meta` use.
- **Prisma 7.10 (stable)**, not the 8.0 RC that npm's `latest` tag points to. Prisma is used for queries only; SQL migrations remain the schema source of truth, and `schema.prisma` is introspected. RLS is enforced via `withCaller` (role and JWT claims set per transaction). See docs/decisions/0004.
- **`prisma.config.ts` reads `DATABASE_URL` optionally** so `prisma generate` (postinstall, CI) works without a database.
- **Deleting papers**: from the list (row button, or checkboxes → Delete selected, up to 200) and from the edit page. It's all or nothing: if any paper is missing or refused, nothing is deleted. Rows are deleted first, then the PDFs (best effort).

### Search, speed, cleanup

- **Subject search (`?q=`)** is matched in code over the course list (`searchCourses` in `@pyq/shared`), not with SQL `LIKE`. Every word must match the name, a stem ("maths"), an acronym ("PRP"; ambiguous ones like "DS" return every match), a numeral ("sdf 1" finds Fundamentals-I) or the course code. Short numbers only match numbers in the title, so "mathematics 1" doesn't also find Mathematics-2. The course list is small; revisit with Postgres full-text search if it grows to thousands.
- **Public data is cached** (`unstable_cache` in `apps/web/src/lib/public-data.ts`) with tags `papers`/`courses`. Every admin action invalidates them; there's a 1-hour fallback for edits made outside the app. Pages stay dynamic so `next build` needs no database. Measured on a production build: median 30 ms before, 16.5 ms after.
- **Public queries return `PublicPaper`**: no uuid, file hash or timestamps. It leaks less and is JSON-safe for caching.
- **`@pyq/shared` is `"sideEffects": false`** so client bundles drop unused modules (zod). `/papers` JS went from 134 kB to 108 kB.
- **Dev uses Turbopack** (`next dev --turbopack`). First-visit compiles went from about 18 s to 2–8 s. `@prisma/client` and `pg` are direct web dependencies so Turbopack can load them as server externals under pnpm.
- **PDFs are uploaded with a 1-year `Cache-Control`**. Storage paths are unique per upload and never overwritten.
- **Local Supabase runs 4 containers** (db, auth, storage, kong). PostgREST, Realtime, Edge Functions, Analytics/Vector, Studio/pg-meta and Mailpit are disabled in `config.toml` because the app doesn't use them. Set `enabled = true` to bring one back (e.g. Studio for browsing the DB, or SMTP for Phase 3 magic links).
- **Em dashes removed** from code, UI and config. Course labels read "Title (CODE)". En dashes in number ranges ("2000–2100") are kept.
- **RLS integration test uses its own fixtures** (course `99Z99ZZ999`) and cleans up, so it passes with any data in the DB.

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
- **Real scans in `/papers`** are gitignored: they show students' names and enrollment numbers. Metadata was read from the scanner's embedded OCR text layer and loaded into the local DB only.

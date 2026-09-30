# PYQ Helper

Past-year exam papers for JIIT Noida students. Browse, filter and download, no login. Admins manage papers and courses at `/admin`.

## Layout

```
apps/web          Next.js (App Router) + Tailwind: public site + admin area (/admin)
packages/db       SQL migrations + seed (Supabase), Prisma client, queries, hashing
packages/shared   zod schemas, domain types, CSV parsing, metadata extraction from paper text
packages/config   shared tsconfig, eslint, prettier
```

Stack: Next.js, Supabase (Postgres, Auth, Storage), Prisma 7 for queries (RLS still enforced,
see `docs/decisions/0004`), tesseract.js for OCR of scanned papers.

## URLs

| URL                                          | What                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/papers?q=prp&semester=3&term=T3&year=2018` | browse; every filter is an optional query param. `q` searches subject names, acronyms (PRP) and course codes |
| `/papers/<paper_hash>`                       | one paper; `paper_hash` = SHA-256 of `COURSE\|TERM\|YEAR`                                                    |
| `/admin`, `/admin/papers/<paper_hash>`       | admin list / edit                                                                                            |

## Setup

Requires Node 24 and pnpm 12. `pnpm install` also generates the Prisma client.

```bash
pnpm install
```

### Database: hosted Supabase (default)

Development and production both use hosted Supabase; no Docker needed. Ideally use two
projects (dev and prod); the steps are the same.

1. Create a Supabase project. Under Authentication -> Sign In / Providers, turn **off**
   "Allow new users to sign up" (only admins log in). Under Authentication -> Users, add your
   admin user (email + password, auto-confirm).
2. Copy `packages/db/.env.example` to `packages/db/.env` and fill in `SUPABASE_DB_URL`,
   `PRISMA_DB_PASSWORD` and `ADMIN_EMAIL`.
3. `pnpm --filter @pyq/db db:deploy`: applies migrations (tables, RLS, storage buckets), loads
   the course list, creates the `prisma` login role (can only act as `anon`/`authenticated`,
   so RLS applies) and makes `ADMIN_EMAIL` an admin. Re-run it after adding a migration.
   Local sample papers and the local admin in `seed.sql` are never sent to a hosted project.
4. Fill `apps/web/.env.local` from `apps/web/.env.example`.

`pnpm --filter @pyq/db db:pull` re-introspects `schema.prisma` after a migration.

The schema lives in `packages/db/supabase/migrations` (SQL: tables, RLS, generated columns,
buckets). `packages/db/prisma/schema.prisma` is introspected from it. Don't edit models by hand.

### Database: local (optional, needs Docker)

```bash
pnpm --filter @pyq/db db:start   # prints API URL + anon key
pnpm --filter @pyq/db db:reset   # migrations + courses.sql + seed.sql (sample PDFs, local admin)
```

The RLS integration test runs only when `TEST_DATABASE_URL` is set in `packages/db/.env`.
Point it at a local or throwaway database, never production.

## Deploy (Vercel)

1. Import the GitHub repo in Vercel. **Root Directory: `apps/web`** (framework Next.js is
   detected; install runs at the repo root with pnpm).
2. Environment variables (Production): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (transaction pooler, port 6543, user
   `prisma.<ref>`), and `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses the pinned pnpm.
3. Deploy. Then in Supabase -> Authentication -> URL Configuration, set **Site URL** to the
   Vercel URL (or your domain).

On Vercel, uploads go browser -> private `uploads` bucket -> server action (Vercel caps
request bodies at 4.5 MB), OCR runs with up to 300 s per request, and Word/PowerPoint
conversion is unavailable (no LibreOffice): admins upload PDFs or images instead.

## Admin

- Hosted: `ADMIN_EMAIL` + `db:deploy` (above). To add another admin later, create the user in
  Supabase Auth, set `ADMIN_EMAIL` and re-run `db:deploy`.
- Local Docker: `db:reset` seeds `admin@pyq.test`; the password is in `seed.sql` (local only).

- `/admin/papers/new`: **drag and drop papers** (or pick them). See Uploads below and
  `docs/decisions/0003`.
- `/admin`: search and filter papers; delete one (row button) or several (checkboxes → Delete
  selected); open a paper to edit, replace its file, unpublish or delete it.
- `/admin/courses`: manage the course list.
- `/admin/bulk`: PDFs (or a folder) plus a CSV with the columns
  `file,course_code,term,year,total_marks,num_questions`, for backlogs that already have metadata.

Writes are enforced by RLS (`is_admin()`) on tables and storage. See `docs/decisions/0002`.

### Uploads

Every upload (drag and drop, bulk, replace) goes through the same pipeline:

1. **Check** size (20 MB max), then **detect the real type from the file's bytes** (not its name).
2. **Stop early** if this exact file is already stored (SHA-256 of the uploaded bytes).
3. **Convert to PDF locally** if needed. Nothing is sent to other services.
   - PDF: used as is.
   - Images (JPG, PNG, WebP, TIFF incl. multi-page, GIF, AVIF): fixes phone rotation, scales
     to A4 at 300 dpi, one page per image. HEIC (iPhone) isn't supported: export as JPEG.
   - Documents (DOCX, DOC, ODT, RTF, PPTX, PPT, ODP): converted with **LibreOffice**, which
     must be installed on the server (see below). Without it, admins get a clear message.
   - Anything else (text, spreadsheets, archives, video…) is rejected with a message saying why.
4. **Validate the PDF**: opens, isn't password-protected, 1 to 50 pages.
5. **Read** course, term, year, marks and questions (PDF text layer, or OCR), then check
   whether that paper (course/term/year hash) already exists. Review and Save.

**Enabling Word/PowerPoint conversion:** install LibreOffice on the machine that runs the web
app. It's found automatically in its default location or on `PATH`, or set `SOFFICE_PATH`.

```bash
winget install --id TheDocumentFoundation.LibreOffice -e
```

On Debian/Ubuntu: `apt-get install -y libreoffice-writer-nogui libreoffice-impress-nogui`.
Serverless hosts (e.g. Vercel) can't run LibreOffice; there, document conversion belongs in
the Phase 3 pipeline service.

## Commands (from the root)

| Command          | What                            |
| ---------------- | ------------------------------- |
| `pnpm dev`       | run the web app on :3000        |
| `pnpm check`     | lint + typecheck + test + build |
| `pnpm lint` etc. | individual turbo tasks          |

Tests include `packages/db/src/rls.test.ts`, an integration test against the local database
proving RLS applies to Prisma queries. It skips when `DATABASE_URL` isn't set.

CI (`.github/workflows/ci.yml`) runs the same checks on every push/PR.

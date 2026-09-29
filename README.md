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

### Database: local (needs Docker)

```bash
pnpm --filter @pyq/db db:start   # prints API URL + anon key
pnpm --filter @pyq/db db:reset   # re-apply migrations + seed (incl. sample PDFs)
pnpm --filter @pyq/db db:pull    # after a migration: re-introspect schema.prisma + regenerate client
```

Env files (copy from the `.env.example` next to each):

- `apps/web/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (server-only), optional `SOFFICE_PATH` (see Uploads)
- `packages/db/.env`: `DATABASE_URL` (for `db:pull` and the RLS integration test)

The schema lives in `packages/db/supabase/migrations` (SQL: tables, RLS, generated columns).
`packages/db/prisma/schema.prisma` is introspected from it. Don't edit models by hand.

### Database: hosted Supabase

1. Create a Supabase project.
2. Copy `packages/db/.env.example` to `packages/db/.env` and fill it in (server-side only).
3. Apply the schema, seed data and sample PDFs: `pnpm --filter @pyq/db seed:hosted`.
4. Create a login role for Prisma that can switch to the RLS roles, and use it in `DATABASE_URL`:

   ```sql
   create role prisma login password '<strong password>';
   grant anon, authenticated to prisma;
   ```

5. Fill `apps/web/.env.local` (or the host's env) with the project URL, the **anon** key and `DATABASE_URL`.

## Admin

- Local: `db:reset` seeds an admin, `admin@pyq.test`. The password is in `packages/db/supabase/seed.sql` (local only).
- Hosted: create the user in Supabase Auth, then run in the SQL editor:

  ```sql
  insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
  ```

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

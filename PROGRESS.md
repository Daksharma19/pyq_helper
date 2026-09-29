# Progress (handoff for next session)

## Status

- **Phase 1 DONE** (`ecf2246`). **Phase 2 DONE** (`eaf2658`), plus owner requests since: upload pipeline with OCR, hash ids/URLs, Prisma, list deletes (`337539f`); subject search, caching, lean dev stack (`617072a`); smooth PDF viewer and conversion of other formats to PDF (latest commit). Phases 3-5 not started (specs: `phase-N-*.md`).
- `pnpm check` (lint, typecheck, test, build) is green.

## What exists

- Turborepo + pnpm: `apps/web` (Next 15, Tailwind 4, Turbopack in dev), `packages/{db,shared,config}`. CI in `.github/workflows/ci.yml`.
- DB (SQL migrations in `packages/db/supabase/migrations/` are the source of truth): `courses`, `papers` (+ `published`, `updated_at`, generated `paper_hash` = sha256(`COURSE|TERM|YEAR`), `file_hash` = sha256 of the uploaded file, both unique), `admins`; `is_admin()`; RLS public-read (published only), admin-only writes on tables and the `papers` bucket.
- Local Supabase runs only db, auth, storage and kong (other services disabled in `config.toml`, unused by the app).
- Data access: **Prisma 7.10** client introspected into `packages/db/prisma/schema.prisma`. All queries go through `withCaller()` (role and JWT claims per transaction) so RLS applies; proven by `packages/db/src/rls.test.ts` (own fixtures). Supabase handles Auth and Storage. See docs/decisions/0004.
- Public data is cached (`apps/web/src/lib/public-data.ts`, tags `papers`/`courses`, invalidated by every admin action).
- Seed: 16 courses, 7 placeholder papers, local admin `admin@pyq.test` (password in seed.sql).
- Web public: `/`, `/papers?q=&semester=&term=&year=&course=` (`q` = subject search: name, acronym, stem, numeral, code), `/papers/<paper_hash>` with a pdf.js viewer (lazy, pre-sized, smooth zoom, works on phones).
- Web admin (`/admin`, guarded by middleware → layout `requireAdmin` → RLS):
  - `/admin`: search/filter, per-row and multi-select delete.
  - `/admin/papers/new`: drag and drop any paper file. Pipeline: size → source hash (duplicate?) → detect type → convert to PDF locally (images: sharp + pdf-lib; documents: LibreOffice if installed) → validate PDF → text layer or tesseract OCR → extract → paper hash (duplicate?) → review → save. See docs/decisions/0003 and README "Uploads".
  - `/admin/papers/<paper_hash>`: edit, replace file (URL kept), change course/term/year (URL changes, redirected), unpublish, delete.
  - `/admin/courses`, `/admin/bulk` (CSV + files of any supported type).
  - Server actions in `apps/web/src/app/admin/actions.ts`.
- Shared: `paperInputSchema`, `courseInputSchema`, `parseBulkCsv`, `extractPaperMeta`/`countQuestions`, `searchCourses` (all unit-tested). Web: `classifyUpload`, `readPaperFile` (tested with in-memory conversions).
- Local DB currently holds one real paper (Maths-1 T2 2023), uploaded by the owner. Sources of real scans are in `/papers` and `/toput` (gitignored).

## Run

```
pnpm --filter @pyq/db db:start   # Docker Desktop must be running
pnpm dev                          # needs apps/web/.env.local (incl. DATABASE_URL)
pnpm --filter @pyq/db db:reset    # reseed
pnpm --filter @pyq/db db:pull     # after a migration: re-introspect Prisma schema + generate
```

## Open items / caveats

- **LibreOffice is not installed** on the dev machine, so Word/PowerPoint uploads show a "not installed" message. Install it to enable them (README "Uploads"); that path is untested end to end.
- Confirmed course codes (from real papers): `18B11EC213`, `15B11MA111`, `15B11PH111`, `15B11MA301`, `15B11CI111`. Verify the rest.
- Real scans include student names/enrollment numbers: they need redaction before going public (Phase 3 pipeline candidate).
- OCR and document conversion run in the web server process. Move them to `apps/pipeline` + a queue for student uploads (Phase 3); serverless hosts can't run LibreOffice.
- Hosted: create a `prisma` login role granted `anon, authenticated` (see README). `seed:hosted` is untested and there's no hosted project yet.
- Pagination: public 30 rows, admin 200 rows.
- Working rules: after each step run checks and open the app; don't ask unless blocked; commit at phase end. Log defaults in `NOTES.md`.

# Progress (handoff for next session)

## Status

- **Phase 1 DONE** (`ecf2246`). **Phase 2 DONE** (`eaf2658`), then **Phase 2b** (owner requests): drag-and-drop upload pipeline with OCR, hash ids and URLs, Prisma, list deletes. Phases 3-5 not started (specs: `phase-N-*.md`).
- `pnpm check` (lint, typecheck, test, build) is green.

## What exists

- Turborepo + pnpm: `apps/web` (Next 15, Tailwind 4), `packages/{db,shared,config}`. CI in `.github/workflows/ci.yml`.
- DB (SQL migrations in `packages/db/supabase/migrations/` are the source of truth): `courses`, `papers` (+ `published`, `updated_at`, generated `paper_hash` = sha256(`COURSE|TERM|YEAR`), `file_hash` = sha256 of the PDF, both unique), `admins`; `is_admin()`; RLS public-read (published only), admin-only writes on tables and the `papers` bucket.
- Data access: **Prisma 7.10** client introspected into `packages/db/prisma/schema.prisma`. All queries go through `withCaller()` (sets role and JWT claims per transaction) so RLS applies. Proven by `packages/db/src/rls.test.ts`. Supabase still handles Auth and Storage. See docs/decisions/0004.
- Seed: 16 courses, 7 placeholder papers (with file hashes), local admin `admin@pyq.test` (password in seed.sql).
- Web public: `/`, `/papers?semester=&term=&year=&course=`, `/papers/<paper_hash>`.
- Web admin (`/admin`, guarded by middleware → layout `requireAdmin` → RLS):
  - `/admin`: list/filter, per-row and multi-select delete.
  - `/admin/papers/new`: drag-and-drop pipeline (validate → file hash → text layer or tesseract OCR → extract → paper hash → duplicate checks → review → save). See docs/decisions/0003.
  - `/admin/papers/<paper_hash>`: edit, replace PDF (URL kept), change course/term/year (URL changes, redirected), unpublish, delete.
  - `/admin/courses`, `/admin/bulk` (CSV + PDFs).
  - Server actions in `apps/web/src/app/admin/actions.ts`.
- Shared: `paperInputSchema`, `courseInputSchema`, `parseBulkCsv`, `looksLikePdf`, `extractPaperMeta`/`countQuestions` (tested on real paper text, including OCR output).
- Local DB also holds 5 real papers loaded through the pipeline: Maths-1 and Physics-1 T2 2023, PRP T3 2016 and 2018 (OCR), and SDF-1 T2 2023 (added by the owner during testing). Sources are in `/papers` and `/toput` (gitignored). `db:reset` removes them.

## Run

```
pnpm --filter @pyq/db db:start   # Docker Desktop must be running
pnpm dev                          # needs apps/web/.env.local (incl. DATABASE_URL)
pnpm --filter @pyq/db db:reset    # reseed
pnpm --filter @pyq/db db:pull     # after a migration: re-introspect Prisma schema + generate
```

## Open items / caveats

- Confirmed course codes (from real papers): `18B11EC213`, `15B11MA111`, `15B11PH111`, `15B11MA301`, `15B11CI111`. Verify the rest.
- Real scans include student names/enrollment numbers: they need redaction before going public (Phase 3 pipeline candidate).
- OCR runs in the web server process (5–15 s/page, blocks the event loop while rendering). Move it to `apps/pipeline` + a queue for student uploads (Phase 3).
- Hosted: create a `prisma` login role granted `anon, authenticated` (see README). `seed:hosted` is untested and there's no hosted project yet.
- Pagination: public 30 rows, admin 200 rows.
- Working rules: after each step run checks and open the app; don't ask unless blocked; commit at phase end as "phase N: <summary>". Log defaults in `NOTES.md`.

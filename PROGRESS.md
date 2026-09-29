# Progress (handoff for next session)

## Status

- **Phase 1 DONE** (`ecf2246`). **Phase 2 DONE** (commit "phase 2: …"). Phases 3-5 not started (specs: `phase-N-*.md`).
- `pnpm check` (lint, typecheck, test, build) is green.

## What exists

- Turborepo + pnpm: `apps/web` (Next 15, Tailwind 4), `packages/{db,shared,config}`. CI in `.github/workflows/ci.yml`.
- DB: `courses`, `papers` (+ `published`, `updated_at`), `admins`; `is_admin()`; RLS public-read (published only), admin-only writes on tables and the `papers` bucket. Migrations in `packages/db/supabase/migrations/`.
- Seed: 16 courses, 7 placeholder papers, local admin `admin@pyq.test` (password in seed.sql).
- Web public: `/`, `/papers`, `/papers/[id]`.
- Web admin (`/admin`, guarded by middleware → layout `requireAdmin` → RLS): papers list/filter, upload (`/admin/papers/new`), edit/replace PDF/unpublish/delete (`/admin/papers/[id]`), courses CRUD, bulk CSV + PDFs (`/admin/bulk`). Server actions in `apps/web/src/app/admin/actions.ts`.
- Shared: `paperInputSchema`, `courseInputSchema`, `parseBulkCsv`, `looksLikePdf` (tested).
- Local DB currently also has 2 real papers (15B11MA111 / 15B11PH111, T2 2023) from `/papers` (gitignored). `db:reset` removes them.

## Run

```
pnpm --filter @pyq/db db:start   # Docker Desktop must be running
pnpm dev                          # needs apps/web/.env.local
pnpm --filter @pyq/db db:reset    # reseed
pnpm --filter @pyq/db db:types    # regen types after schema changes
```

## Open items / caveats

- Only `18B11EC213`, `15B11MA111`, `15B11PH111` are confirmed course codes (from real papers); verify the rest.
- Real scans include student names/enrollment numbers: need redaction before going public (Phase 3 pipeline candidate).
- OCR metadata extraction is not in the app yet (Phase 3 pipeline).
- `seed:hosted` untested; no hosted project yet. Hosted admin grant: see README.
- Pagination: public 30 rows, admin 200 rows.
- Working rules: after each step run checks and open the app; don't ask unless blocked; commit at phase end as "phase N: <summary>". Log defaults in `NOTES.md`.

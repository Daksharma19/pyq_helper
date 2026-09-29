# PYQ Helper

Past-year exam papers (PYQs) for students of Jaypee Institute of Information Technology (JIIT), Noida. Anyone can browse, filter and download papers without logging in. Admins upload papers directly; students log in to submit papers, which pass through a validation pipeline before going public. Long term, the platform predicts "hot" questions for upcoming exams.

## Domain

- A paper: course code (e.g. `18B11EC213` Digital Systems), course title, program (B.Tech), semester, exam term (`T1`, `T2`, `T3`), year, total marks, number of questions, the PDF.
- A paper is unique by course code + term + year. Never store duplicates.
- A list of valid courses is the source of truth for codes and titles.

## Monorepo (Turborepo + pnpm)

Suggested shape; adjust when there is a good reason and note why in `docs/decisions/`.

```
apps/web          Next.js (App Router, TypeScript): public site, student area, admin
apps/pipeline     Python service for validation, extraction and later AI work (from Phase 3)
packages/db       schema, migrations, seed, generated types
packages/shared   zod schemas and domain types used by more than one app
packages/ui       shared components, only once something is actually shared
packages/config   shared tsconfig, eslint, prettier
```

Default stack: Next.js + Tailwind, Supabase (Postgres, Auth, Storage), Python + FastAPI for the pipeline. These are defaults, not rules. Pick libraries and patterns you think fit, and explain notable choices in a short decision note.

## Principles

- Keep it simple and production-like. Don't build ahead of the current phase.
- Validate external input at the boundary. Enforce access in the database (RLS), not only in the UI.
- Secrets stay server-side; env vars are validated in one place per app.
- Every change leaves lint, typecheck and tests green through `turbo`. Test the logic that matters, not everything.
- Small commits with clear messages. Update the README when setup changes.
- Ask me before big or irreversible decisions; decide small ones yourself.

# PYQ Helper

Past-year exam papers for JIIT Noida students. Browse, filter and download, no login. Admins manage papers and courses at `/admin`.

## Layout

```
apps/web          Next.js (App Router) + Tailwind: public site + admin area (/admin)
packages/db       Supabase migrations, seed data, typed queries
packages/shared   zod schemas + domain types (browse filters, terms, course codes)
packages/config   shared tsconfig, eslint, prettier
```

## Setup

Requires Node 24 and pnpm 12.

```bash
pnpm install
```

### Database: hosted Supabase

1. Create a Supabase project.
2. Copy `packages/db/.env.example` to `packages/db/.env` and fill it in (DB URL + service role key; server-side only).
3. Apply the schema, seed data and sample PDFs:

   ```bash
   pnpm --filter @pyq/db seed:hosted
   ```

4. Copy `apps/web/.env.example` to `apps/web/.env.local` with the project URL and **anon** key.

### Database: local (needs Docker)

```bash
pnpm --filter @pyq/db db:start   # prints API URL + anon key for apps/web/.env.local
pnpm --filter @pyq/db db:reset   # re-apply migrations + seed (incl. sample PDFs)
pnpm --filter @pyq/db db:types   # regenerate src/database.types.ts
```

## Admin

- Local: `db:reset` seeds an admin, `admin@pyq.test`. The password is in `packages/db/supabase/seed.sql` (local only).
- Hosted: create the user in Supabase Auth, then run in the SQL editor:

  ```sql
  insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
  ```

- `/admin`: list, edit, unpublish, delete papers. `/admin/papers/new`: single upload.
  `/admin/courses`: manage the course list.
- `/admin/bulk`: pick PDFs (or a folder) plus a CSV with the columns
  `file,course_code,term,year,total_marks,num_questions`. Rows are validated before upload.
  Existing papers are skipped and linked.

Writes are enforced by RLS (`is_admin()`), see `docs/decisions/0002`.

## Commands (from the root)

| Command          | What                            |
| ---------------- | ------------------------------- |
| `pnpm dev`       | run the web app on :3000        |
| `pnpm check`     | lint + typecheck + test + build |
| `pnpm lint` etc. | individual turbo tasks          |

CI (`.github/workflows/ci.yml`) runs the same checks on every push/PR.

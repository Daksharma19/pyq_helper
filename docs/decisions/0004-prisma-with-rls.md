# 0004: Prisma for database access, with RLS kept

**Status:** accepted. Supersedes 0001 (supabase-js, no ORM) for database queries.

## Context

The owner asked for Prisma. CLAUDE.md requires access to be enforced in the database (RLS),
not only in the UI. Prisma connects to Postgres directly as a privileged role, so by default
every Prisma query **bypasses RLS**.

## Decision

- **SQL migrations stay the source of truth** in `packages/db/supabase/migrations`. RLS
  policies, `auth`/`storage` integration, `is_admin()` and the generated `paper_hash` column
  are Postgres/Supabase features that `schema.prisma` can't express. `prisma/schema.prisma`
  is **introspected** (`pnpm --filter @pyq/db db:pull`) and only used to generate the typed
  client. Prisma Migrate is not used.
- **Every app query runs through `withCaller(prisma, caller, fn)`**. That starts a
  transaction, runs `set_config('role', 'anon'|'authenticated', true)` and sets
  `request.jwt.claims` (`sub` = the user id), then runs `fn`. RLS, `auth.uid()` and
  `is_admin()` therefore behave exactly as they did through PostgREST. The settings are
  transaction-local, so pooled connections never leak them.
- The caller's user id comes only from `supabase.auth.getUser()`, which verifies the session
  with Supabase Auth.
- The web app exposes only `publicQuery()` (anon) and `requireAdmin().query()` (the signed-in
  user). The raw PrismaClient is never used for app queries.
- **Supabase is still used for Auth and Storage** (PDFs). Storage writes use the user's
  Supabase session, so storage RLS applies too.
- `auth` is listed in the Prisma datasource `schemas` only because `admins.user_id`
  references `auth.users`. App code doesn't query auth tables through Prisma.
- Stable **Prisma 7.10** (`prisma-client` generator, `@prisma/adapter-pg`). npm's `latest` tag
  currently points at an 8.0 release candidate, which we don't use.

## Verification

`packages/db/src/rls.test.ts` runs against the local database. It checks that anon and
non-admins can't write, can't delete, and can't see unpublished papers; that admins can; that a
bulk delete with one bad id rolls back; and that the DB's `paper_hash` equals `paperHash()`.
It skips when `DATABASE_URL` isn't set (CI has no database).

## Consequences

- `DATABASE_URL` is a new server-side secret for the web app.
- In hosted Supabase, use a dedicated login role that can `SET ROLE` to `anon` and
  `authenticated`, not `postgres`. Use the session pooler (port 5432), or the transaction
  pooler with `pgbouncer=true`:

  ```sql
  create role prisma login password '<strong password>';
  grant anon, authenticated to prisma;
  ```

- Each request is one short transaction. Slow work (OCR, uploads) must happen outside `fn`.
- After a migration: `db:reset`, then `db:pull`. Relation field renames in `schema.prisma`
  (`papers.course`, `admins.user`) survive re-introspection.

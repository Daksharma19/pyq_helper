# 0002: Admin role and admin writes

**Status:** accepted (Phase 2)

## Context

Admins upload, edit, unpublish and delete papers and manage courses. Access must be enforced in
the database, not only in the UI.

## Decision

- **Supabase Auth (email + password)** for admin login, with `@supabase/ssr` keeping the session
  in cookies. There is no public sign-up UI; admins are created in Supabase.
- **`public.admins` table** lists admin user ids. `public.is_admin()` (security definer) is used
  by RLS policies. The table itself isn't readable through the API.
- **All admin writes run as the signed-in user** with the anon key. RLS on `courses`, `papers`
  and `storage.objects` (bucket `papers`) allows insert/update/delete only when `is_admin()`.
  The web app never holds the service-role key.
- Server actions also check `requireAdmin()` first for clear errors and redirects. RLS is the
  real guard.
- **Unpublish** is a `published` flag. The public select policy hides unpublished rows except
  from admins, and public queries also filter `published = true`.
- **PDFs go through server actions** (limit raised to 21 MB; the bucket caps at 20 MiB). The
  server checks size and the `%PDF-` magic bytes before uploading. Each upload gets a new storage
  key (`<code>/<year>-<term>-<stamp>.pdf`), so replacing a PDF never serves a stale cached file.
- **Bulk upload** parses and validates the CSV in the browser (the same zod schema as the single
  form), then calls the same `createPaper` action once per row. Each row is checked again on the
  server, and duplicates are reported per row, not as a failed batch.

## Why a table and not a JWT claim

A custom access-token hook adds setup on every environment, and a claim stays stale until the
token refreshes. At this scale, one indexed lookup per policy check costs nothing. Revisit when
students log in (Phase 3) and roles grow.

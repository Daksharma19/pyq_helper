# 0005: Hosted Supabase for dev and prod, web app on Vercel

## Context

Local Supabase needed Docker. We are going to production, and the owner chose Vercel for
the web app.

## Decision

- **Hosted Supabase everywhere.** `db:deploy` (packages/db/scripts/deploy-hosted.mjs) applies
  migrations, loads `courses.sql`, creates the `prisma` role and marks `ADMIN_EMAIL` an admin.
  It never loads `seed.sql` (sample PDFs and a local admin with a known password). Local
  Docker still works but is optional.
- **Storage buckets are created by a migration**, so a new project is complete after `db push`.
- **Uploads are staged in a private `uploads` bucket by the browser**, and server actions get
  only the path. Vercel rejects request bodies over 4.5 MB; papers can be 20 MB. Storage RLS
  allows only admins to stage, read and delete. Staged files are deleted after a successful
  save; files from abandoned analyses stay in the private bucket (harmless, can be cleared
  from the dashboard).
- **Admin upload routes set `maxDuration = 300`** for OCR, and tesseract's language data is
  cached in the temp dir on Vercel.
- **The RLS integration test reads `TEST_DATABASE_URL`**, not `DATABASE_URL`, so it can never
  write fixtures into production.

## Consequences

- Word/PowerPoint conversion needs LibreOffice, which Vercel can't run. Admins upload PDFs or
  images; conversion can move to the Phase 3 pipeline service.
- `DATABASE_URL` uses Supavisor's transaction pooler (port 6543). `withCaller` only uses
  transaction-local settings, which is what transaction pooling supports.

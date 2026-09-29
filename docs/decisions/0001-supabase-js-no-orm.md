# 0001: supabase-js with generated types, no ORM

**Context.** Phase 1 needs only public, read-only queries. Access control lives in Postgres RLS.

**Decision.** Query through `@supabase/supabase-js` with the anon key and the generated `Database` types. The queries live in `packages/db/src/queries.ts`. The schema is managed as plain SQL migrations under `packages/db/supabase/migrations`.

**Why.**
- Every web request runs as `anon` or `authenticated`, so RLS is the real enforcement layer.
- An ORM connecting as the table owner would bypass RLS.
- SQL migrations keep constraints (such as the unique course+term+year key) explicit.

**Revisit if** we need complex server-side transactions that PostgREST can't express. Postgres functions (RPC) are the first option to reach for then.

import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma is used for the typed client only. The schema itself (tables, RLS policies,
// generated columns, auth/storage integration) lives in supabase/migrations as SQL and
// prisma/schema.prisma is introspected from it with `pnpm db:pull`. See docs/decisions/0004.
export default defineConfig({
  schema: "prisma/schema.prisma",
  // Optional so `prisma generate` (postinstall, CI) works without a database; db:pull needs it.
  datasource: { url: process.env.DATABASE_URL },
});

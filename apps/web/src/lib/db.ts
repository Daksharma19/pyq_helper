import "server-only";
import { ANON, createPrisma, withCaller, type Db } from "@pyq/db";
import { serverEnv } from "@/env";

// One Prisma client per server process (kept on globalThis so dev hot reloads don't open
// a new pool each time). Never query it directly: go through withCaller so RLS applies.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrisma> };

export function prisma() {
  globalForPrisma.prisma ??= createPrisma(serverEnv().DATABASE_URL);
  return globalForPrisma.prisma;
}

/** Runs queries as the anonymous public (RLS: published papers, courses). */
export function publicQuery<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return withCaller(prisma(), ANON, fn);
}

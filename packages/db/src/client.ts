import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/prisma/client";

/**
 * Who a query runs as. RLS policies see exactly what PostgREST would give them:
 * - `anon`: the public site;
 * - `authenticated`: a signed-in user, identified by their **verified** user id (from
 *   Supabase Auth's getUser(), never from unverified client input).
 */
export type Caller = { role: "anon" } | { role: "authenticated"; userId: string };

export const ANON: Caller = { role: "anon" };

/** A Prisma client scoped to one caller's transaction. All app queries take this. */
export type Db = Prisma.TransactionClient;

export function createPrisma(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Runs `fn` in a transaction that first drops to the caller's role and sets the JWT claims
 * Supabase's `auth.uid()` reads. RLS therefore applies to every Prisma query, although the
 * connection itself belongs to a privileged role. The settings are transaction-local
 * (`set_config(..., true)`), so a pooled connection never leaks them to the next caller.
 *
 * Never use the raw PrismaClient for app queries: it would bypass RLS.
 */
export function withCaller<T>(
  prisma: PrismaClient,
  caller: Caller,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const claims =
    caller.role === "anon"
      ? { role: "anon" }
      : { role: "authenticated", sub: caller.userId, aud: "authenticated" };
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`select set_config('role', ${caller.role}, true),
        set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
      return fn(tx);
    },
    // Prisma's defaults (2s to acquire a connection, 5s to finish) are tight when the server
    // is also doing CPU-heavy work such as OCR. Keep transactions short regardless: never
    // await slow non-DB work inside `fn`.
    { maxWait: 10_000, timeout: 15_000 },
  );
}

/** Prisma error codes the UI turns into friendly messages. */
export const DB_ERROR = { uniqueViolation: "P2002", foreignKeyViolation: "P2003" } as const;

export function dbErrorCode(e: unknown): string | undefined {
  return e instanceof Prisma.PrismaClientKnownRequestError ? e.code : undefined;
}

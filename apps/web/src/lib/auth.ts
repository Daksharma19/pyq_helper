import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin, withCaller, type Caller, type Db } from "@pyq/db";
import { env } from "@/env";
import { prisma } from "@/lib/db";

/** Supabase client for the signed-in user (session in cookies): Auth and Storage. */
export async function supabaseForUser(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Components can't set cookies; middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Runs queries as this (verified) user, so RLS sees their auth.uid(). */
export function queryAs(userId: string) {
  const caller: Caller = { role: "authenticated", userId };
  return <T>(fn: (db: Db) => Promise<T>) => withCaller(prisma(), caller, fn);
}

/** Current admin session, or null. Cached per request. */
export const getAdmin = cache(async () => {
  const storage = await supabaseForUser();
  // getUser() verifies the session with Supabase Auth; the id is safe to put in claims.
  const {
    data: { user },
  } = await storage.auth.getUser();
  if (!user) return null;
  const query = queryAs(user.id);
  if (!(await query(isAdmin))) return null;
  return { user, query, storage };
});

/**
 * Gate for admin pages and server actions. Server actions are public endpoints, so every
 * action calls this; RLS still blocks non-admin writes if a check is ever missed.
 */
export async function requireAdmin(next = "/admin") {
  const admin = await getAdmin();
  if (!admin) redirect(`/login?next=${encodeURIComponent(next)}`);
  return admin;
}

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { isAdmin, type Client } from "@pyq/db";
import { env } from "@/env";

/** Supabase client acting as the signed-in user (session in cookies). RLS applies. */
export async function userDb(): Promise<Client> {
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

/** Current admin session, or null. Cached per request. */
export const getAdmin = cache(async () => {
  const db = await userDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user || !(await isAdmin(db))) return null;
  return { db, user };
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

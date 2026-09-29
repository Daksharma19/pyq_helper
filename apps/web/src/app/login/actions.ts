"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAdmin } from "@pyq/db";
import { queryAs, supabaseForUser } from "@/lib/auth";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
  // Only redirect inside the admin area (no open redirects).
  next: z
    .string()
    .regex(/^\/admin([/?]|$)/)
    .catch("/admin"),
});

export type LoginState = { error?: string; email?: string };

export async function signIn(_: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: "Enter your email and password.", email };

  const supabase = await supabaseForUser();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Wrong email or password.", email };
  if (!(await queryAs(data.user.id)(isAdmin))) {
    await supabase.auth.signOut();
    return { error: "This account is not an admin.", email };
  }
  redirect(parsed.data.next);
}

export async function signOut() {
  await (await supabaseForUser()).auth.signOut();
  redirect("/");
}

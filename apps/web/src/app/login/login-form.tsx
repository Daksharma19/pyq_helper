"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import { btnPrimary, inputCls } from "@/components/admin/styles";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/admin"} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={state.email}
          className={inputCls}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

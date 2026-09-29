import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  if (await getAdmin()) redirect("/admin");
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <h1 className="text-2xl font-bold">Admin sign in</h1>
      <LoginForm next={next} />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const nav = [
  ["/admin", "Papers"],
  ["/admin/papers/new", "Upload"],
  ["/admin/bulk", "Bulk upload"],
  ["/admin/courses", "Courses"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <nav className="flex flex-wrap gap-1 text-sm font-medium">
          {nav.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="flex items-center gap-2 text-sm text-slate-500">
          <span className="hidden sm:inline">{user.email}</span>
          <button className="rounded-md px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-900">
            Sign out
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}

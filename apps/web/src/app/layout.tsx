import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PYQ Helper · JIIT past year papers", template: "%s · PYQ Helper" },
  description:
    "Browse and download past year question papers (T1, T2, T3) for JIIT Noida courses. Free, no login.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <header className="border-b border-slate-200 dark:border-slate-800">
          <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold text-brand-600 dark:text-blue-400">
              PYQ Helper
            </Link>
            <Link href="/papers" className="text-sm font-medium hover:underline">
              Browse papers
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500 dark:border-slate-800">
          For JIIT Noida students. Free to use. ·{" "}
          <Link href="/admin" className="hover:underline">
            Admin
          </Link>
        </footer>
      </body>
    </html>
  );
}

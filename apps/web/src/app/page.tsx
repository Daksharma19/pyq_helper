import Link from "next/link";
import { listPapers } from "@pyq/db";
import { SEMESTERS } from "@pyq/shared";
import { publicQuery } from "@/lib/db";
import { PaperCard } from "@/components/paper-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const recent = await publicQuery((db) => listPapers(db, {}, 6));

  return (
    <div className="space-y-10">
      <section className="space-y-4 pt-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          JIIT past year papers, free.
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          T1, T2 and T3 papers for every course. No login, just find and download.
        </p>
        <form action="/papers" method="get" className="flex gap-2">
          <input
            name="course"
            placeholder="Course code, e.g. 18B11EC213"
            autoCapitalize="characters"
            aria-label="Course code"
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base dark:border-slate-700 dark:bg-slate-900"
          />
          <button className="rounded-md bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700">
            Search
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">By semester</h2>
        <div className="grid grid-cols-4 gap-2">
          {SEMESTERS.map((s) => (
            <Link
              key={s}
              href={`/papers?semester=${s}`}
              className="rounded-md border border-slate-200 py-3 text-center font-medium hover:border-brand-600 dark:border-slate-800"
            >
              Sem {s}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Recent papers</h2>
          <Link
            href="/papers"
            className="text-sm text-brand-600 hover:underline dark:text-blue-400"
          >
            View all
          </Link>
        </div>
        <ul className="space-y-2">
          {recent.map((p) => (
            <PaperCard key={p.id} paper={p} />
          ))}
        </ul>
      </section>
    </div>
  );
}

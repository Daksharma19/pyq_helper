import type { Metadata } from "next";
import Link from "next/link";
import { listCourses, listPapers, listYears, PAGE_SIZE } from "@pyq/db";
import { parseBrowseFilters } from "@pyq/shared";
import { publicQuery } from "@/lib/db";
import { FiltersForm } from "@/components/filters-form";
import { PaperCard } from "@/components/paper-card";

export const metadata: Metadata = { title: "Browse papers" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BrowsePage({ searchParams }: Props) {
  const filters = parseBrowseFilters(await searchParams);
  const [courses, years, papers] = await publicQuery((db) =>
    Promise.all([listCourses(db), listYears(db), listPapers(db, filters)]),
  );
  const hasFilters = Object.values(filters).some((v) => v !== undefined);
  const count = papers.length === PAGE_SIZE ? `${PAGE_SIZE}+` : papers.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Browse papers</h1>
      <FiltersForm filters={filters} courses={courses} years={years} />
      <div className="flex items-center justify-between text-sm text-slate-500">
        <p>
          {count} paper{papers.length === 1 ? "" : "s"}
        </p>
        {hasFilters && (
          <Link href="/papers" className="text-brand-600 hover:underline dark:text-blue-400">
            Clear filters
          </Link>
        )}
      </div>
      {papers.length ? (
        <ul className="space-y-2">
          {papers.map((p) => (
            <PaperCard key={p.id} paper={p} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          No papers match these filters yet.
        </p>
      )}
    </div>
  );
}

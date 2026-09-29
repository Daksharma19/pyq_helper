import type { Metadata } from "next";
import Link from "next/link";
import { PAGE_SIZE } from "@pyq/db";
import { parseBrowseFilters, searchCourses } from "@pyq/shared";
import { getCourses, getPapers, getYears } from "@/lib/public-data";
import { FiltersForm } from "@/components/filters-form";
import { PaperCard } from "@/components/paper-card";

export const metadata: Metadata = { title: "Browse papers" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BrowsePage({ searchParams }: Props) {
  const filters = parseBrowseFilters(await searchParams);
  const { q, ...rest } = filters;
  const [courses, years] = await Promise.all([getCourses(), getYears()]);
  // The subject search resolves to course codes in code (acronyms, stems, numerals).
  const courseIn = q ? searchCourses(courses, q) : undefined;
  const papers = await getPapers({ ...rest, courseIn });
  const hasFilters = Object.values(filters).some((v) => v !== undefined);
  const count = papers.length === PAGE_SIZE ? `${PAGE_SIZE}+` : papers.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Browse papers</h1>
      <FiltersForm filters={filters} courses={courses} years={years} />
      <div className="flex items-center justify-between text-sm text-slate-500">
        <p aria-live="polite">
          {count} paper{papers.length === 1 ? "" : "s"}
          {q && <> for &ldquo;{q}&rdquo;</>}
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
            <PaperCard key={p.paper_hash} paper={p} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          {q && courseIn?.length === 0
            ? `No subject matches “${q}”. Try part of the name, an acronym like PRP, or a course code.`
            : "No papers match these filters yet."}
        </p>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SEMESTERS, TERMS, type BrowseFilters, type Course } from "@pyq/shared";

type Props = { filters: BrowseFilters; courses: Course[]; years: number[] };

const selectCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base dark:border-slate-700 dark:bg-slate-900";

/** GET form: works without JS; with JS, applies filters on change. */
export function FiltersForm({ filters, courses, years }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const visibleCourses = filters.semester
    ? courses.filter((c) => c.semester === filters.semester)
    : courses;

  function onChange(e: React.FormEvent<HTMLFormElement>) {
    const sp = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget)) if (v) sp.set(k, String(v));
    // A new semester can make the chosen course invalid, so drop it.
    if ((e.target as HTMLSelectElement).name === "semester") sp.delete("course");
    const qs = sp.toString();
    startTransition(() => router.replace(`/papers${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  return (
    <form
      action="/papers"
      method="get"
      onChange={onChange}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      aria-busy={pending}
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium">Semester</span>
        <select name="semester" defaultValue={filters.semester ?? ""} className={selectCls}>
          <option value="">All</option>
          {SEMESTERS.map((s) => (
            <option key={s} value={s}>
              Sem {s}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Term</span>
        <select name="term" defaultValue={filters.term ?? ""} className={selectCls}>
          <option value="">All</option>
          {TERMS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="col-span-2 text-sm sm:col-span-1">
        <span className="mb-1 block font-medium">Course</span>
        <select
          name="course"
          key={filters.semester ?? "all"}
          defaultValue={filters.course ?? ""}
          className={selectCls}
        >
          <option value="">All courses</option>
          {visibleCourses.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>
      </label>
      <label className="col-span-2 text-sm sm:col-span-1">
        <span className="mb-1 block font-medium">Year</span>
        <select name="year" defaultValue={filters.year ?? ""} className={selectCls}>
          <option value="">All</option>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      <noscript>
        <button className="rounded-md bg-brand-600 px-4 py-2.5 font-medium text-white">
          Apply filters
        </button>
      </noscript>
    </form>
  );
}

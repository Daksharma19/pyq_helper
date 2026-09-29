"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { matchesSubject, SEMESTERS, TERMS, type BrowseFilters, type Course } from "@pyq/shared";

type Props = { filters: BrowseFilters; courses: Course[]; years: number[] };

const selectCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base dark:border-slate-700 dark:bg-slate-900";
const SEARCH_DELAY_MS = 250;

/**
 * GET form: works without JS. With JS, selects apply immediately and the subject search
 * applies after a short pause in typing (or on Enter).
 */
export function FiltersForm({ filters, courses, years }: Props) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [pending, startTransition] = useTransition();

  // Controlled so typing isn't interrupted when the URL updates. Sync from the URL only
  // when it changes for another reason (e.g. "Clear filters").
  const [q, setQ] = useState(filters.q ?? "");
  const lastPushed = useRef(filters.q ?? "");
  useEffect(() => {
    const fromUrl = filters.q ?? "";
    if (fromUrl !== lastPushed.current) {
      lastPushed.current = fromUrl;
      setQ(fromUrl);
    }
  }, [filters.q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const visibleCourses = courses.filter(
    (c) => (!filters.semester || c.semester === filters.semester) && matchesSubject(c, q),
  );

  function apply(changed?: string) {
    clearTimeout(timer.current);
    if (!form.current) return;
    const sp = new URLSearchParams();
    for (const [k, v] of new FormData(form.current)) {
      const value = String(v).trim();
      if (value) sp.set(k, value);
    }
    // A new semester can make the chosen course invalid, so drop it.
    if (changed === "semester") sp.delete("course");
    lastPushed.current = sp.get("q") ?? "";
    const qs = sp.toString();
    startTransition(() => router.replace(`/papers${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  return (
    <form
      ref={form}
      action="/papers"
      method="get"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      aria-busy={pending}
    >
      <label className="col-span-2 text-sm sm:col-span-4">
        <span className="mb-1 block font-medium">Search subject</span>
        <span className="relative block">
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400"
          >
            <path
              fill="currentColor"
              d="M8.5 3a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65a.75.75 0 1 1-1.06 1.06l-3.65-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
            />
          </svg>
          <input
            type="search"
            name="q"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => apply(), SEARCH_DELAY_MS);
            }}
            placeholder="Subject name, acronym (PRP) or course code"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={100}
            className={`${selectCls} pr-24 pl-10`}
          />
          {pending && (
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-400">
              Searching…
            </span>
          )}
        </span>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Semester</span>
        <select
          name="semester"
          defaultValue={filters.semester ?? ""}
          onChange={() => apply("semester")}
          className={selectCls}
        >
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
        <select
          name="term"
          defaultValue={filters.term ?? ""}
          onChange={() => apply()}
          className={selectCls}
        >
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
          onChange={() => apply()}
          className={selectCls}
        >
          <option value="">{q ? `All matching (${visibleCourses.length})` : "All courses"}</option>
          {visibleCourses.map((c) => (
            <option key={c.code} value={c.code}>
              {c.title} ({c.code})
            </option>
          ))}
        </select>
      </label>
      <label className="col-span-2 text-sm sm:col-span-1">
        <span className="mb-1 block font-medium">Year</span>
        <select
          name="year"
          defaultValue={filters.year ?? ""}
          onChange={() => apply()}
          className={selectCls}
        >
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

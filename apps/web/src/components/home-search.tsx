"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const SEARCH_DELAY_MS = 200;

/**
 * GET form to /papers (works without JS). With JS, typing goes straight to the results page,
 * where the search box keeps focus and every keystroke keeps filtering.
 */
export function HomeSearch() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <form action="/papers" method="get" role="search" className="flex gap-2">
      <input
        type="search"
        name="q"
        placeholder="Subject, e.g. Digital Systems, PRP or 18B11EC213"
        aria-label="Search subject"
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
        onChange={(e) => {
          const q = e.target.value.trim();
          clearTimeout(timer.current);
          if (q)
            timer.current = setTimeout(
              () => router.push(`/papers?q=${encodeURIComponent(q)}&focus=1`),
              SEARCH_DELAY_MS,
            );
        }}
        className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base dark:border-slate-700 dark:bg-slate-900"
      />
      <button className="rounded-md bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700">
        Search
      </button>
    </form>
  );
}

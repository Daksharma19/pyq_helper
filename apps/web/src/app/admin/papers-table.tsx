"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { removePapers, type FormState } from "@/app/admin/actions";
import { Notice } from "@/components/admin/notice";
import { btnDanger } from "@/components/admin/styles";

export type PaperRow = {
  hash: string;
  title: string;
  code: string;
  term: string;
  year: number;
  marks: number;
  questions: number;
  published: boolean;
};

/** Admin papers list with per-row and multi-select delete. */
export function PapersTable({ rows }: { rows: PaperRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<FormState>();
  const [pending, start] = useTransition();

  // Rows can disappear after a delete or a filter change; ignore stale selections.
  const visible = new Set(rows.map((r) => r.hash));
  const chosen = [...selected].filter((h) => visible.has(h));
  const allChosen = rows.length > 0 && chosen.length === rows.length;

  function toggle(hash: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }

  function remove(hashes: string[], what: string) {
    if (
      !confirm(
        `Delete ${what} and the PDF${hashes.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    )
      return;
    start(async () => {
      const res = await removePapers(hashes);
      setResult(res);
      if (res.ok) setSelected(new Set());
    });
  }

  return (
    <div className="space-y-3">
      {result?.message && <Notice>{result.message}</Notice>}
      {result?.errors?._ && <Notice kind="error">{result.errors._}</Notice>}

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <p>
          {rows.length} paper{rows.length === 1 ? "" : "s"}
          {chosen.length > 0 && ` · ${chosen.length} selected`}
        </p>
        {chosen.length > 0 && (
          <button
            disabled={pending}
            onClick={() =>
              remove(chosen, `${chosen.length} paper${chosen.length === 1 ? "" : "s"}`)
            }
            className={`${btnDanger} py-1.5 text-sm`}
          >
            {pending ? "Deleting…" : `Delete selected (${chosen.length})`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all papers"
                  checked={allChosen}
                  disabled={!rows.length}
                  onChange={() =>
                    setSelected(allChosen ? new Set() : new Set(rows.map((r) => r.hash)))
                  }
                />
              </th>
              <th className="px-3 py-2 font-medium">Course</th>
              <th className="px-3 py-2 font-medium">Term</th>
              <th className="px-3 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Marks / Qs</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((p) => (
              <tr
                key={p.hash}
                className={
                  selected.has(p.hash)
                    ? "bg-brand-50 dark:bg-slate-900"
                    : "hover:bg-slate-50 dark:hover:bg-slate-900"
                }
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.code} ${p.term} ${p.year}`}
                    checked={selected.has(p.hash)}
                    onChange={() => toggle(p.hash)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/papers/${p.hash}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <span className="block text-xs text-slate-500">{p.code}</span>
                </td>
                <td className="px-3 py-2">{p.term}</td>
                <td className="px-3 py-2">{p.year}</td>
                <td className="px-3 py-2">
                  {p.marks} / {p.questions}
                </td>
                <td className="px-3 py-2">
                  {p.published ? (
                    <span className="text-green-700 dark:text-green-400">Published</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">Unpublished</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    disabled={pending}
                    onClick={() => remove([p.hash], `${p.code} ${p.term} ${p.year}`)}
                    className="rounded px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-6 text-center text-slate-500">No papers.</p>}
      </div>
    </div>
  );
}

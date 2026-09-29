import Link from "next/link";
import type { PaperWithCourse } from "@pyq/shared";

export function PaperCard({ paper }: { paper: PaperWithCourse }) {
  return (
    <li>
      <Link
        href={`/papers/${paper.paper_hash}`}
        className="block rounded-lg border border-slate-200 p-4 hover:border-brand-600 active:bg-slate-50 dark:border-slate-800 dark:active:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{paper.course.title}</p>
            <p className="text-sm text-slate-500">
              {paper.course_code} · Sem {paper.course.semester}
            </p>
          </div>
          <span className="shrink-0 rounded bg-brand-50 px-2 py-0.5 text-sm font-semibold text-brand-700 dark:bg-slate-800 dark:text-blue-300">
            {paper.term} {paper.year}
          </span>
        </div>
      </Link>
    </li>
  );
}

import Link from "next/link";
import { listAllPapers, listCourses } from "@pyq/db";
import { parseBrowseFilters } from "@pyq/shared";
import { requireAdmin } from "@/lib/auth";
import { Notice } from "@/components/admin/notice";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const selectCls =
  "rounded-md border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900";

export default async function AdminPapersPage({ searchParams }: Props) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const { course } = parseBrowseFilters(sp);
  const status = sp.status === "draft" || sp.status === "live" ? sp.status : "";
  const [courses, papers] = await Promise.all([
    listCourses(db),
    listAllPapers(db, { course, published: status ? status === "live" : undefined }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Papers</h1>
        <form className="flex flex-wrap gap-2 text-sm">
          <select name="course" defaultValue={course ?? ""} className={selectCls}>
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} className={selectCls}>
            <option value="">Any status</option>
            <option value="live">Published</option>
            <option value="draft">Unpublished</option>
          </select>
          <button className="rounded-md border border-slate-300 px-3 py-1.5 dark:border-slate-700">
            Filter
          </button>
        </form>
      </div>
      {sp.deleted && <Notice>Paper deleted.</Notice>}
      <p className="text-sm text-slate-500">
        {papers.length} paper{papers.length === 1 ? "" : "s"}
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2 font-medium">Course</th>
              <th className="px-3 py-2 font-medium">Term</th>
              <th className="px-3 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Marks / Qs</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {papers.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                <td className="px-3 py-2">
                  <Link href={`/admin/papers/${p.id}`} className="font-medium hover:underline">
                    {p.course.title}
                  </Link>
                  <span className="block text-xs text-slate-500">{p.course_code}</span>
                </td>
                <td className="px-3 py-2">{p.term}</td>
                <td className="px-3 py-2">{p.year}</td>
                <td className="px-3 py-2">
                  {p.total_marks} / {p.num_questions}
                </td>
                <td className="px-3 py-2">
                  {p.published ? (
                    <span className="text-green-700 dark:text-green-400">Published</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">Unpublished</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!papers.length && <p className="p-6 text-center text-slate-500">No papers.</p>}
      </div>
    </div>
  );
}

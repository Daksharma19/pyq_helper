import { listAllPapers, listCourses } from "@pyq/db";
import { parseBrowseFilters } from "@pyq/shared";
import { requireAdmin } from "@/lib/auth";
import { Notice } from "@/components/admin/notice";
import { PapersTable } from "./papers-table";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const selectCls =
  "rounded-md border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900";

export default async function AdminPapersPage({ searchParams }: Props) {
  const { query } = await requireAdmin();
  const sp = await searchParams;
  const { course } = parseBrowseFilters(sp);
  const status = sp.status === "draft" || sp.status === "live" ? sp.status : "";
  const published = status ? status === "live" : undefined;
  const [courses, papers] = await query((db) =>
    Promise.all([listCourses(db), listAllPapers(db, { course, published })]),
  );

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
      <PapersTable
        rows={papers.map((p) => ({
          hash: p.paper_hash,
          title: p.course.title,
          code: p.course_code,
          term: p.term,
          year: p.year,
          marks: p.total_marks,
          questions: p.num_questions,
          published: p.published,
        }))}
      />
    </div>
  );
}

import { listAllPapers, listCourses } from "@pyq/db";
import { parseBrowseFilters, searchCourses } from "@pyq/shared";
import { requireAdmin } from "@/lib/auth";
import { Notice } from "@/components/admin/notice";
import { PapersTable } from "./papers-table";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const selectCls =
  "rounded-md border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900";

export default async function AdminPapersPage({ searchParams }: Props) {
  const { query } = await requireAdmin();
  const sp = await searchParams;
  const { course, q } = parseBrowseFilters(sp);
  const status = sp.status === "draft" || sp.status === "live" ? sp.status : "";
  const published = status ? status === "live" : undefined;
  const [courses, papers] = await query(async (db) => {
    const all = await listCourses(db);
    const courseIn = q ? searchCourses(all, q) : undefined;
    return [all, await listAllPapers(db, { course, courseIn, published })] as const;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Papers</h1>
        <form role="search" className="flex flex-wrap gap-2 text-sm">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search subject"
            aria-label="Search subject"
            maxLength={100}
            className={`${selectCls} w-44`}
          />
          <select name="course" defaultValue={course ?? ""} className={selectCls}>
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.title} ({c.code})
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

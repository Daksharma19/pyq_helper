import type { Metadata } from "next";
import { courseUsage, listCourses } from "@pyq/db";
import { requireAdmin } from "@/lib/auth";
import { CourseForm, DeleteCourse } from "./course-form";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage() {
  const { query } = await requireAdmin("/admin/courses");
  const [courses, usage] = await query((db) => Promise.all([listCourses(db), courseUsage(db)]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Courses</h1>
      <section className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="font-semibold">Add a course</h2>
        <CourseForm />
      </section>

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {courses.map((c) => {
          const papers = usage.get(c.code) ?? 0;
          return (
            <li key={c.code}>
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.title}</span>
                    <span className="text-sm text-slate-500">
                      {c.code} · {c.program} · Sem {c.semester}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-slate-500">
                    {papers} paper{papers === 1 ? "" : "s"}
                  </span>
                </summary>
                <div className="space-y-3 border-t border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <CourseForm course={c} />
                  {papers === 0 && <DeleteCourse code={c.code} />}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

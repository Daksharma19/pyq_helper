import type { Metadata } from "next";
import { listCourses } from "@pyq/db";
import { requireAdmin } from "@/lib/auth";
import { createPaper } from "@/app/admin/actions";
import { PaperForm } from "@/components/admin/paper-form";

export const metadata: Metadata = { title: "Upload paper" };

export default async function NewPaperPage() {
  const { db } = await requireAdmin("/admin/papers/new");
  const courses = await listCourses(db);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Upload a paper</h1>
      <p className="text-sm text-slate-500">
        Papers go live as soon as they are uploaded. Course, term and year stay filled in for the
        next one.
      </p>
      <PaperForm courses={courses} action={createPaper} mode="create" />
    </div>
  );
}

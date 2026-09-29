import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getAnyPaper, listCourses } from "@pyq/db";
import { requireAdmin } from "@/lib/auth";
import { paperUrl } from "@/lib/supabase";
import { editPaper } from "@/app/admin/actions";
import { PaperForm } from "@/components/admin/paper-form";
import { PaperControls } from "./paper-controls";

export const metadata: Metadata = { title: "Edit paper" };

type Props = { params: Promise<{ id: string }> };

export default async function EditPaperPage({ params }: Props) {
  const { id } = await params;
  const { db } = await requireAdmin(`/admin/papers/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const [paper, courses] = await Promise.all([getAnyPaper(db, id), listCourses(db)]);
  if (!paper) notFound();

  const initial = {
    course_code: paper.course_code,
    term: paper.term,
    year: String(paper.year),
    total_marks: String(paper.total_marks),
    num_questions: String(paper.num_questions),
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/admin" className="text-sm text-brand-600 hover:underline dark:text-blue-400">
          ← All papers
        </Link>
        <h1 className="text-2xl font-bold">
          {paper.course.title} · {paper.term} {paper.year}
        </h1>
        <p className="text-sm text-slate-500">
          {paper.published ? "Published" : "Unpublished (hidden from the public site)"} ·{" "}
          <a
            href={paperUrl(paper.storage_path)}
            target="_blank"
            rel="noopener"
            className="underline"
          >
            Current PDF
          </a>
          {paper.published && (
            <>
              {" · "}
              <Link href={`/papers/${paper.id}`} className="underline">
                Public page
              </Link>
            </>
          )}
        </p>
      </div>
      <PaperForm
        courses={courses}
        action={editPaper.bind(null, id)}
        initial={initial}
        mode="edit"
      />
      <PaperControls id={id} published={paper.published} />
    </div>
  );
}

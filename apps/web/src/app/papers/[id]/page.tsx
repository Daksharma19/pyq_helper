import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getPaper, paperFileName } from "@pyq/db";
import { db, paperUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return getPaper(db(), id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const paper = await load((await params).id);
  if (!paper) return { title: "Paper not found" };
  const title = `${paper.course.title} (${paper.course_code}) ${paper.term} ${paper.year}`;
  return { title, openGraph: { title } };
}

export default async function PaperPage({ params }: Props) {
  const paper = await load((await params).id);
  if (!paper) notFound();

  const fileName = paperFileName(paper);
  const viewUrl = paperUrl(paper.storage_path);
  const downloadUrl = paperUrl(paper.storage_path, fileName);
  const stats: [string, string | number][] = [
    ["Term", paper.term],
    ["Year", paper.year],
    ["Max marks", paper.total_marks],
    ["Questions", paper.num_questions],
  ];

  return (
    <article className="space-y-5">
      <Link href="/papers" className="text-sm text-brand-600 hover:underline dark:text-blue-400">
        ← All papers
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{paper.course.title}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {paper.course_code} · {paper.course.program} · Semester {paper.course.semester}
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-md bg-slate-100 p-3 dark:bg-slate-900">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-lg font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex gap-2">
        <a
          href={downloadUrl}
          download={fileName}
          className="flex-1 rounded-md bg-brand-600 px-4 py-3 text-center font-medium text-white hover:bg-brand-700 sm:flex-none"
        >
          Download PDF
        </a>
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener"
          className="flex-1 rounded-md border border-slate-300 px-4 py-3 text-center font-medium sm:flex-none dark:border-slate-700"
        >
          Open PDF
        </a>
      </div>
      {/* Mobile browsers rarely render embedded PDFs; phones use "Open PDF" instead. */}
      <object
        data={viewUrl}
        type="application/pdf"
        className="hidden h-[80vh] w-full rounded-lg border border-slate-200 sm:block dark:border-slate-800"
        aria-label="Paper preview"
      >
        <p className="p-4 text-sm">
          Preview unavailable. <a href={viewUrl}>Open the PDF</a>.
        </p>
      </object>
    </article>
  );
}

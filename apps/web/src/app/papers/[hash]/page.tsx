import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { paperFileName } from "@pyq/db";
import { PAPER_HASH_RE } from "@pyq/shared";
import { getPublicPaper } from "@/lib/public-data";
import { paperUrl } from "@/lib/supabase";
import { PdfViewer } from "@/components/pdf-viewer";

export const dynamic = "force-dynamic";

// A paper's URL is /papers/<paper_hash>, the SHA-256 of "COURSE|TERM|YEAR".
type Props = { params: Promise<{ hash: string }> };

async function load(hash: string) {
  if (!PAPER_HASH_RE.test(hash)) return null;
  return getPublicPaper(hash);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const paper = await load((await params).hash);
  if (!paper) return { title: "Paper not found" };
  const title = `${paper.course.title} (${paper.course_code}) ${paper.term} ${paper.year}`;
  return { title, openGraph: { title }, alternates: { canonical: `/papers/${paper.paper_hash}` } };
}

export default async function PaperPage({ params }: Props) {
  const paper = await load((await params).hash);
  if (!paper) notFound();

  const fileName = paperFileName(paper);
  const viewUrl = paperUrl(paper.storage_path);
  const downloadUrl = paperUrl(paper.storage_path, fileName);
  // Start downloading the PDF with the HTML, in parallel with the viewer's JavaScript.
  // Matches pdf.js's request (CORS, same-origin credentials) so the browser reuses it.
  preload(viewUrl, { as: "fetch", crossOrigin: "anonymous" });
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
      <PdfViewer url={viewUrl} title={`${paper.course.title} ${paper.term} ${paper.year}`} />
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { listCourses } from "@pyq/db";
import { requireAdmin } from "@/lib/auth";
import { UploadQueue } from "./upload-queue";

export const metadata: Metadata = { title: "Upload papers" };
// Server actions here read, convert and OCR uploads: allow up to 5 minutes (Vercel).
export const maxDuration = 300;

export default async function NewPaperPage() {
  const { query } = await requireAdmin("/admin/papers/new");
  const courses = await query(listCourses);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Upload papers</h1>
      <p className="text-sm text-slate-500">
        Each PDF is hashed, read and checked for duplicates before anything is stored. Fields
        outlined green were read from the PDF, amber ones need filling in. Saved papers go live
        straight away. For a backlog with a metadata sheet, use{" "}
        <Link href="/admin/bulk" className="underline">
          bulk upload
        </Link>
        .
      </p>
      <UploadQueue courses={courses} />
    </div>
  );
}

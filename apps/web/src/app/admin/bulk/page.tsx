import type { Metadata } from "next";
import { BULK_COLUMNS } from "@pyq/shared";
import { requireAdmin } from "@/lib/auth";
import { BulkUpload } from "./bulk-upload";

export const metadata: Metadata = { title: "Bulk upload" };

export default async function BulkPage() {
  await requireAdmin("/admin/bulk");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Bulk upload</h1>
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
        <p>
          Pick the PDFs (or a whole folder) and a CSV with one row per paper. The <code>file</code>{" "}
          column must match a PDF&apos;s file name. Columns:
        </p>
        <pre className="overflow-x-auto rounded-md bg-slate-100 p-3 text-xs dark:bg-slate-900">
          {BULK_COLUMNS.join(",")}
          {"\n"}ds-2025-t1.pdf,18B11EC213,T1,2025,20,5
        </pre>
        <p>
          Every row is checked before anything is uploaded. Papers that already exist are skipped
          and linked.
        </p>
      </div>
      <BulkUpload />
    </div>
  );
}

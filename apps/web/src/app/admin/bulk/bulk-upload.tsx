"use client";

import Link from "next/link";
import { useState } from "react";
import { parseBulkCsv, type BulkRow } from "@pyq/shared";
import { createPaper } from "@/app/admin/actions";
import { stagedFields } from "@/lib/stage-upload";
import { ACCEPT, hasSupportedExtension } from "@/lib/upload-formats";
import { Notice } from "@/components/admin/notice";
import { btnPrimary } from "@/components/admin/styles";

type Status =
  | { kind: "pending" }
  | { kind: "uploading" }
  | { kind: "done"; hash: string }
  | { kind: "exists"; hash?: string }
  | { kind: "failed"; message: string };

const fileInputCls =
  "block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium dark:file:bg-slate-800";

export function BulkUpload() {
  const [pdfs, setPdfs] = useState<Map<string, File>>(new Map());
  const [csvText, setCsvText] = useState("");
  const [status, setStatus] = useState<Record<number, Status>>({});
  const [running, setRunning] = useState(false);

  const parsed = csvText ? parseBulkCsv(csvText, pdfs.keys()) : undefined;
  const rows = parsed?.rows ?? [];
  const valid = rows.filter((r): r is Extract<BulkRow, { ok: true }> => r.ok);
  const done = Object.values(status).filter((s) => s.kind === "done").length;
  const started = Object.keys(status).length > 0;

  function pickPdfs(files: FileList | null) {
    const map = new Map<string, File>();
    // PDFs, images and documents; other files in a picked folder (CSV, notes) are ignored.
    for (const f of files ?? []) if (hasSupportedExtension(f.name)) map.set(f.name, f);
    setPdfs(map);
    setStatus({});
  }

  async function upload() {
    setRunning(true);
    // One at a time: keeps request sizes bounded and the progress easy to follow.
    for (const row of valid) {
      if (status[row.line]?.kind === "done" || status[row.line]?.kind === "exists") continue;
      setStatus((s) => ({ ...s, [row.line]: { kind: "uploading" } }));
      const form = new FormData();
      for (const [k, v] of Object.entries(row.input)) form.set(k, String(v));
      let next: Status;
      try {
        await stagedFields(form, pdfs.get(row.file)!);
        const res = await createPaper(null, form);
        if (res.ok && res.created) next = { kind: "done", hash: res.created };
        else if (res.existing) next = { kind: "exists", hash: res.existing };
        else next = { kind: "failed", message: Object.values(res.errors ?? {}).join("; ") };
      } catch {
        next = { kind: "failed", message: "Request failed" };
      }
      setStatus((s) => ({ ...s, [row.line]: next }));
    }
    setRunning(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Paper files</span>
          <input
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(e) => pickPdfs(e.target.files)}
            className={fileInputCls}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">…or a whole folder</span>
          <input
            type="file"
            // Non-standard but supported by all major browsers.
            {...{ webkitdirectory: "" }}
            onChange={(e) => pickPdfs(e.target.files)}
            className={fileInputCls}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Metadata CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              setCsvText((await e.target.files?.[0]?.text()) ?? "");
              setStatus({});
            }}
            className={fileInputCls}
          />
        </label>
      </div>

      <p className="text-sm text-slate-500">
        {pdfs.size} file{pdfs.size === 1 ? "" : "s"} selected
        {parsed && !parsed.error && ` · ${rows.length} rows · ${valid.length} ready`}
      </p>
      {parsed?.error && <Notice kind="error">{parsed.error}</Notice>}

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Line</th>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Paper</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.line}>
                    <td className="px-3 py-2 text-slate-500">{r.line}</td>
                    <td className="max-w-48 truncate px-3 py-2">{r.file}</td>
                    <td className="px-3 py-2">
                      {r.ok && `${r.input.course_code} ${r.input.term} ${r.input.year}`}
                    </td>
                    <td className="px-3 py-2">
                      <RowStatus row={r} status={status[r.line]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={upload}
              disabled={running || valid.length === 0}
              className={btnPrimary}
            >
              {running
                ? `Uploading… (${done}/${valid.length})`
                : `Upload ${valid.length} paper${valid.length === 1 ? "" : "s"}`}
            </button>
            {started && !running && (
              <span className="text-sm text-slate-500">
                {done} uploaded.{" "}
                <Link href="/admin" className="underline">
                  View papers
                </Link>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RowStatus({ row, status }: { row: BulkRow; status?: Status }) {
  if (!row.ok)
    return <span className="text-red-600 dark:text-red-400">{row.errors.join("; ")}</span>;
  switch (status?.kind) {
    case "uploading":
      return <span className="text-slate-500">Uploading…</span>;
    case "done":
      return (
        <Link
          href={`/admin/papers/${status.hash}`}
          className="text-green-700 underline dark:text-green-400"
        >
          Uploaded
        </Link>
      );
    case "exists":
      return status.hash ? (
        <Link
          href={`/admin/papers/${status.hash}`}
          className="text-amber-700 underline dark:text-amber-400"
        >
          Already exists
        </Link>
      ) : (
        <span className="text-amber-700 dark:text-amber-400">Already exists</span>
      );
    case "failed":
      return <span className="text-red-600 dark:text-red-400">{status.message}</span>;
    default:
      return <span className="text-slate-500">Ready</span>;
  }
}

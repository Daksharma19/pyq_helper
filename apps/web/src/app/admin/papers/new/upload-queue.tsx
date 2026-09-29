"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { paperInputSchema, TERMS, type Course, type ExtractedMeta } from "@pyq/shared";
import { analyzePaper, createPaper, type Analysis } from "@/app/admin/actions";
import type { TextSource } from "@/lib/pipeline";
import { btnPrimary, btnSecondary, inputCls } from "@/components/admin/styles";

type Fields = Record<"course_code" | "term" | "year" | "total_marks" | "num_questions", string>;

type Item = {
  key: string;
  file: File;
  status: "analyzing" | "review" | "saving" | "saved" | "duplicate" | "error";
  values: Fields;
  /** Fields the pipeline read from the PDF (the rest need typing in). */
  found: Set<keyof Fields>;
  source?: TextSource;
  /** SHA-256 of the PDF bytes, from the server. */
  fileHash?: string;
  /** SHA-256 of course|term|year: the paper's id, once those were read. */
  paperHash?: string;
  message?: string;
  /** Hash of the related paper (the saved one, or the duplicate). */
  link?: string;
  errors?: Record<string, string>;
};

const SOURCE_NOTE: Record<TextSource, string> = {
  "text-layer": "read from the PDF's text",
  ocr: "read by OCR, check carefully",
  none: "nothing readable, fill in by hand",
};

const FIELDS: (keyof Fields)[] = ["course_code", "term", "year", "total_marks", "num_questions"];

function toFields(meta: ExtractedMeta): Fields {
  return Object.fromEntries(
    FIELDS.map((f) => [f, meta[f] === undefined ? "" : String(meta[f])]),
  ) as Fields;
}

/**
 * Drop PDFs → each goes through the pipeline (hash, text/OCR-layer extraction, duplicate
 * check) → admin reviews the pre-filled fields → save. Nothing is stored before "Save".
 */
export function UploadQueue({ courses }: { courses: Course[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));

  async function add(files: Iterable<File>) {
    const fresh: Item[] = [...files]
      .filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
      .map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        status: "analyzing",
        values: toFields({}),
        found: new Set(),
      }));
    setItems((list) => [...fresh, ...list]);
    // One at a time keeps the server load and the UI predictable.
    for (const it of fresh) {
      const form = new FormData();
      form.set("file", it.file);
      let res: Analysis;
      try {
        res = await analyzePaper(form);
      } catch {
        res = { error: "Could not analyse this file." };
      }
      if ("error" in res) {
        patch(it.key, { status: "error", message: res.error });
        continue;
      }
      const values = toFields(res.meta);
      patch(it.key, {
        values,
        found: new Set(FIELDS.filter((f) => values[f] !== "")),
        source: res.duplicate?.reason === "file" ? undefined : res.source,
        fileHash: res.fileHash,
        paperHash: res.paperHash,
        status: res.duplicate ? "duplicate" : "review",
        link: res.duplicate?.hash,
        message: res.duplicate
          ? res.duplicate.reason === "file"
            ? `This exact PDF is already stored as ${res.duplicate.label}.`
            : `${res.duplicate.label} already exists.`
          : undefined,
      });
    }
  }

  async function save(it: Item) {
    patch(it.key, { status: "saving", errors: undefined, message: undefined });
    const form = new FormData();
    for (const f of FIELDS) form.set(f, it.values[f]);
    form.set("file", it.file);
    try {
      const res = await createPaper(null, form);
      if (res.ok) patch(it.key, { status: "saved", link: res.created, message: res.message });
      else
        patch(it.key, {
          status: res.existing ? "duplicate" : "review",
          link: res.existing,
          errors: res.errors,
          message: res.errors?._,
        });
    } catch {
      patch(it.key, { status: "review", message: "Save failed. Try again." });
    }
  }

  const schema = paperInputSchema();
  const ready = items.filter((it) => it.status === "review" && schema.safeParse(it.values).success);

  async function saveAll() {
    for (const it of ready) await save(it);
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-brand-600 bg-brand-50 dark:bg-slate-900"
            : "border-slate-300 hover:border-brand-600 dark:border-slate-700"
        }`}
      >
        <p className="font-medium">Drop paper PDFs here, or click to choose</p>
        <p className="mt-1 text-sm text-slate-500">
          Course, term, year, marks and questions are read from each PDF. Check them, then save.
        </p>
        <input
          ref={input}
          type="file"
          multiple
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {ready.length > 1 && (
        <button className={btnPrimary} onClick={saveAll}>
          Save all {ready.length} ready papers
        </button>
      )}

      <ul className="space-y-3">
        {items.map((it) => (
          <QueueItem
            key={it.key}
            item={it}
            courses={courses}
            onChange={(values) => patch(it.key, { values })}
            onSave={() => save(it)}
            onRemove={() => setItems((l) => l.filter((x) => x.key !== it.key))}
          />
        ))}
      </ul>
    </div>
  );
}

const badge: Record<Item["status"], [string, string]> = {
  analyzing: ["Analysing…", "text-slate-500"],
  review: ["Review", "text-brand-600 dark:text-blue-400"],
  saving: ["Saving…", "text-slate-500"],
  saved: ["Saved", "text-green-700 dark:text-green-400"],
  duplicate: ["Already exists", "text-amber-700 dark:text-amber-400"],
  error: ["Rejected", "text-red-600 dark:text-red-400"],
};

function QueueItem({
  item,
  courses,
  onChange,
  onSave,
  onRemove,
}: {
  item: Item;
  courses: Course[];
  onChange: (v: Fields) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const { values: v, found, errors = {} } = item;
  const editable = item.status === "review";
  const course = courses.find((c) => c.code === v.course_code);
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...v, [k]: e.target.value });
  const hint = (k: keyof Fields) =>
    found.has(k) ? "ring-1 ring-green-500/40" : editable ? "ring-1 ring-amber-500/50" : "";
  const [label, color] = badge[item.status];

  return (
    <li className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{item.file.name}</p>
          <p className="text-xs text-slate-500">
            {(item.file.size / 1024 / 1024).toFixed(2)} MB
            {item.paperHash && (
              <span className="font-mono" title={`paper id (course|term|year): ${item.paperHash}`}>
                {" "}
                · id {item.paperHash.slice(0, 12)}…
              </span>
            )}
            {item.fileHash && (
              <span className="font-mono" title={`file sha256: ${item.fileHash}`}>
                {" "}
                · file {item.fileHash.slice(0, 12)}…
              </span>
            )}
            {item.source && ` · ${SOURCE_NOTE[item.source]}`}
          </p>
        </div>
        <span className={`shrink-0 text-sm font-medium ${color}`}>{label}</span>
      </div>

      {item.status === "analyzing" && (
        <p className="text-sm text-slate-500">
          Hashing, checking for duplicates and reading the paper. Scans without a text layer go
          through OCR, which takes a few seconds per page.
        </p>
      )}

      {item.message && (
        <p className="text-sm">
          {item.message}{" "}
          {item.link && (
            <Link href={`/admin/papers/${item.link}`} className="underline">
              Open
            </Link>
          )}
        </p>
      )}

      {item.status !== "analyzing" && item.status !== "error" && (
        <fieldset disabled={!editable} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <label className="col-span-2 text-sm sm:col-span-3">
            <span className="mb-1 block font-medium">
              Course{" "}
              {course && (
                <span className="font-normal text-slate-500">· Sem {course.semester}</span>
              )}
            </span>
            <select
              value={v.course_code}
              onChange={set("course_code")}
              className={`${inputCls} ${hint("course_code")}`}
            >
              <option value="">Choose a course</option>
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
            {errors.course_code && <Err>{errors.course_code}</Err>}
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Term</span>
            <select value={v.term} onChange={set("term")} className={`${inputCls} ${hint("term")}`}>
              <option value="">—</option>
              {TERMS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {errors.term && <Err>{errors.term}</Err>}
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Year</span>
            <input
              type="number"
              value={v.year}
              onChange={set("year")}
              className={`${inputCls} ${hint("year")}`}
            />
            {errors.year && <Err>{errors.year}</Err>}
          </label>
          <label className="text-sm sm:col-span-3">
            <span className="mb-1 block font-medium">Total marks</span>
            <input
              type="number"
              value={v.total_marks}
              onChange={set("total_marks")}
              className={`${inputCls} ${hint("total_marks")}`}
            />
            {errors.total_marks && <Err>{errors.total_marks}</Err>}
          </label>
          <label className="text-sm sm:col-span-3">
            <span className="mb-1 block font-medium">Questions</span>
            <input
              type="number"
              value={v.num_questions}
              onChange={set("num_questions")}
              className={`${inputCls} ${hint("num_questions")}`}
            />
            {errors.num_questions && <Err>{errors.num_questions}</Err>}
          </label>
        </fieldset>
      )}

      <div className="flex gap-2">
        {editable && (
          <button onClick={onSave} className={btnPrimary}>
            Save paper
          </button>
        )}
        {item.status !== "saving" && item.status !== "analyzing" && (
          <button onClick={onRemove} className={btnSecondary}>
            {item.status === "saved" ? "Dismiss" : "Remove"}
          </button>
        )}
      </div>
    </li>
  );
}

function Err({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block text-sm text-red-600 dark:text-red-400">{children}</span>;
}

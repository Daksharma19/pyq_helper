"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  courseInputSchema,
  paperInputSchema,
  semesterOf,
  SEMESTERS,
  TERMS,
  type Course,
  type ExtractedMeta,
} from "@pyq/shared";
import {
  addCourse,
  analyzePaper,
  createPaper,
  type Analysis,
  type FormState,
} from "@/app/admin/actions";
import type { TextSource } from "@/lib/pipeline";
import { stageUpload } from "@/lib/stage-upload";
import { ACCEPT, precheckUpload } from "@/lib/upload-formats";
import { btnPrimary, btnSecondary, inputCls } from "@/components/admin/styles";

type Fields = Record<"course_code" | "term" | "year" | "total_marks" | "num_questions", string>;

/** A course typed in by the admin because it isn't in the list yet. */
type NewCourse = { code: string; title: string; semester: string };
const NEW = "__new";

type Item = {
  key: string;
  file: File;
  /** Path in the private "uploads" bucket, once the file is staged (reused by Save). */
  staged?: string;
  status: "analyzing" | "review" | "saving" | "saved" | "duplicate" | "error";
  values: Fields;
  /** Set while the admin is adding a course that isn't in the list. */
  newCourse?: NewCourse;
  /** Fields the pipeline read from the PDF (the rest need typing in). */
  found: Set<keyof Fields>;
  source?: TextSource;
  /** Set when the upload was converted to PDF, e.g. "JPEG image". */
  convertedFrom?: string;
  pages?: number;
  /** SHA-256 of the uploaded file, from the server. */
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
 * Drop files (PDFs, photos, documents) → each goes through the pipeline (hash, duplicate
 * check, conversion to PDF, validation, text/OCR extraction, identity hash) → admin reviews
 * the pre-filled fields → save. Nothing is stored before "Save".
 */
export function UploadQueue({ courses: initialCourses }: { courses: Course[] }) {
  const [courses, setCourses] = useState(initialCourses);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));

  async function add(files: Iterable<File>) {
    // Every file gets a card; the server decides what's supported. Only empty and oversized
    // files are rejected here, before wasting an upload.
    const fresh: Item[] = [...files].map((file) => {
      const problem = precheckUpload(file);
      return {
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        status: problem ? "error" : "analyzing",
        message: problem ?? undefined,
        values: toFields({}),
        found: new Set(),
      };
    });
    setItems((list) => [...fresh, ...list]);
    // One at a time keeps the server load and the UI predictable.
    for (const it of fresh.filter((f) => f.status === "analyzing")) {
      const form = new FormData();
      let res: Analysis;
      try {
        const staged = await stageUpload(it.file);
        patch(it.key, { staged });
        form.set("staged", staged);
        form.set("name", it.file.name);
        res = await analyzePaper(form);
      } catch {
        res = { error: "Could not analyse this file." };
      }
      if ("error" in res) {
        patch(it.key, { status: "error", message: res.error });
        continue;
      }
      const values = toFields(res.meta);
      // A course code read from the paper but missing from the list: offer to add it.
      const unknown = values.course_code && !courses.some((c) => c.code === values.course_code);
      patch(it.key, {
        values,
        newCourse: unknown
          ? {
              code: values.course_code,
              title: res.meta.course_title ?? "",
              semester: res.meta.semester ? String(res.meta.semester) : "",
            }
          : undefined,
        found: new Set(FIELDS.filter((f) => values[f] !== "")),
        source: res.duplicate?.reason === "file" ? undefined : res.source,
        convertedFrom: res.convertedFrom,
        pages: res.pages,
        fileHash: res.fileHash,
        paperHash: res.paperHash,
        status: res.duplicate ? "duplicate" : "review",
        link: res.duplicate?.hash,
        message: res.duplicate
          ? res.duplicate.reason === "file"
            ? `This exact file is already stored as ${res.duplicate.label}.`
            : `${res.duplicate.label} already exists.`
          : undefined,
      });
    }
  }

  async function save(it: Item) {
    patch(it.key, { status: "saving", errors: undefined, message: undefined });
    let values = it.values;
    if (it.newCourse) {
      const nc = it.newCourse;
      let res: FormState;
      try {
        res = await addCourse({ code: nc.code, title: nc.title, semester: nc.semester });
      } catch {
        res = { errors: { _: "Could not add the course. Try again." } };
      }
      if (!res.ok) {
        const e = res.errors ?? {};
        const errors: Record<string, string> = {};
        if (e.code) errors.new_code = e.code;
        if (e.title) errors.new_title = e.title;
        if (e.semester) errors.new_semester = e.semester;
        patch(it.key, { status: "review", errors, message: e._ });
        return;
      }
      const code = nc.code.trim().toUpperCase();
      setCourses((list) => [
        ...list,
        { code, title: nc.title.trim(), program: "B.Tech", semester: Number(nc.semester) },
      ]);
      values = { ...values, course_code: code };
      // Other cards waiting on the same new course can now just pick it.
      setItems((list) =>
        list.map((x) =>
          x.newCourse?.code.trim().toUpperCase() === code
            ? { ...x, newCourse: undefined, values: { ...x.values, course_code: code } }
            : x,
        ),
      );
    }
    const form = new FormData();
    for (const f of FIELDS) form.set(f, values[f]);
    try {
      form.set("staged", it.staged ?? (await stageUpload(it.file)));
      form.set("name", it.file.name);
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
  const ready = items.filter(
    (it) =>
      it.status === "review" &&
      schema.safeParse(it.newCourse ? { ...it.values, course_code: it.newCourse.code } : it.values)
        .success &&
      (!it.newCourse || courseInputSchema.safeParse(it.newCourse).success),
  );

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
        <p className="font-medium">Drop papers here, or click to choose</p>
        <p className="mt-1 text-sm text-slate-500">
          PDFs, photos or scans (JPG, PNG, WebP, TIFF) and documents (DOCX, ODT, PPTX…). Other
          formats are converted to PDF first. Course, term, year, marks and questions are read from
          each paper; check them, then save.
        </p>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
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
            onNewCourse={(newCourse) => patch(it.key, { newCourse })}
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
  onNewCourse,
  onSave,
  onRemove,
}: {
  item: Item;
  courses: Course[];
  onChange: (v: Fields) => void;
  onNewCourse: (c: NewCourse | undefined) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const { values: v, found, newCourse: nc, errors = {} } = item;
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
            {item.convertedFrom && ` · converted from ${item.convertedFrom}`}
            {item.pages !== undefined && ` · ${item.pages} page${item.pages === 1 ? "" : "s"}`}
            {item.source && ` · ${SOURCE_NOTE[item.source]}`}
          </p>
        </div>
        <span className={`shrink-0 text-sm font-medium ${color}`}>{label}</span>
      </div>

      {item.status === "analyzing" && (
        <p className="text-sm text-slate-500">
          Checking the file, converting it to PDF if needed, and reading the paper. Scans without a
          text layer go through OCR, which takes a few seconds per page.
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
              value={nc ? NEW : course ? v.course_code : ""}
              onChange={(e) => {
                if (e.target.value === NEW)
                  onNewCourse({
                    code: v.course_code,
                    title: "",
                    semester: String(semesterOf(v.course_code) ?? ""),
                  });
                else {
                  onNewCourse(undefined);
                  set("course_code")(e);
                }
              }}
              className={`${inputCls} ${hint("course_code")}`}
            >
              <option value="">Choose a course</option>
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.title} ({c.code})
                </option>
              ))}
              <option value={NEW}>+ Course not listed, add it…</option>
            </select>
            {errors.course_code && <Err>{errors.course_code}</Err>}
          </label>
          {nc && (
            <div className="col-span-2 grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-3 sm:col-span-6 sm:grid-cols-6 dark:bg-slate-900">
              <p className="col-span-2 text-xs text-slate-500 sm:col-span-6">
                New course. It is added to the course list when you save this paper.
              </p>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium">Course code</span>
                <input
                  value={nc.code}
                  placeholder="e.g. 15B11CI111"
                  onChange={(e) => onNewCourse({ ...nc, code: e.target.value })}
                  className={inputCls}
                />
                {errors.new_code && <Err>{errors.new_code}</Err>}
              </label>
              <label className="text-sm sm:col-span-3">
                <span className="mb-1 block font-medium">Course title</span>
                <input
                  value={nc.title}
                  onChange={(e) => onNewCourse({ ...nc, title: e.target.value })}
                  className={inputCls}
                />
                {errors.new_title && <Err>{errors.new_title}</Err>}
              </label>
              <label className="col-span-2 text-sm sm:col-span-1">
                <span className="mb-1 block font-medium">Semester</span>
                <select
                  value={nc.semester}
                  onChange={(e) => onNewCourse({ ...nc, semester: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select</option>
                  {SEMESTERS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                {errors.new_semester && <Err>{errors.new_semester}</Err>}
              </label>
            </div>
          )}
          <label className="text-sm">
            <span className="mb-1 block font-medium">Term</span>
            <select value={v.term} onChange={set("term")} className={`${inputCls} ${hint("term")}`}>
              <option value="">Select</option>
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

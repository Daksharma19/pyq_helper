"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { SEMESTERS, TERMS, type Course } from "@pyq/shared";
import type { FormState } from "@/app/admin/actions";
import { Notice } from "./notice";
import { btnPrimary, errorCls, inputCls } from "./styles";

type Props = {
  courses: Course[];
  action: (state: FormState, form: FormData) => Promise<FormState>;
  initial?: Record<string, string>;
  mode: "create" | "edit";
};

/** Upload / edit form. Semester only narrows the course list; a paper's semester is its course's. */
export function PaperForm({ courses, action, initial = {}, mode }: Props) {
  const [state, formAction, pending] = useActionState(action, { values: initial });
  const v = state.values ?? initial;
  const courseSemester = (code?: string) => courses.find((c) => c.code === code)?.semester;
  const [semester, setSemester] = useState(String(courseSemester(v.course_code) ?? ""));
  const formRef = useRef<HTMLFormElement>(null);

  // After a successful create, clear the file input so the next paper can be added quickly.
  useEffect(() => {
    if (mode === "create" && state.ok) {
      const file = formRef.current?.elements.namedItem("file") as HTMLInputElement | null;
      if (file) file.value = "";
    }
  }, [state, mode]);

  const visible = semester ? courses.filter((c) => String(c.semester) === semester) : courses;
  const err = state.errors ?? {};
  // Remount inputs when the server echoes new values, so defaultValue applies.
  const k = JSON.stringify(v);

  return (
    <form
      ref={formRef}
      // Submit manually: React's automatic form reset would drop the chosen file on errors.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-4"
    >
      {state.message && (
        <Notice>
          {state.message}{" "}
          {state.createdId && (
            <Link href={`/admin/papers/${state.createdId}`} className="underline">
              View
            </Link>
          )}
        </Notice>
      )}
      {err._ && (
        <Notice kind="error">
          {err._}{" "}
          {state.existingId && (
            <Link href={`/admin/papers/${state.existingId}`} className="font-medium underline">
              Open the existing paper
            </Link>
          )}
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Semester</span>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className={inputCls}
          >
            <option value="">All</option>
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>
                Sem {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Course</span>
          <select
            name="course_code"
            required
            key={`${k}-${semester}`}
            defaultValue={v.course_code ?? ""}
            className={inputCls}
          >
            <option value="" disabled>
              Choose a course
            </option>
            {visible.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.title} (Sem {c.semester})
              </option>
            ))}
          </select>
          {err.course_code && <span className={errorCls}>{err.course_code}</span>}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" key={k}>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Term</span>
          <select name="term" required defaultValue={v.term ?? ""} className={inputCls}>
            <option value="" disabled>
              —
            </option>
            {TERMS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {err.term && <span className={errorCls}>{err.term}</span>}
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Year</span>
          <input
            name="year"
            type="number"
            required
            min={2000}
            max={new Date().getFullYear()}
            defaultValue={v.year}
            className={inputCls}
          />
          {err.year && <span className={errorCls}>{err.year}</span>}
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Total marks</span>
          <input
            name="total_marks"
            type="number"
            required
            min={1}
            defaultValue={v.total_marks}
            className={inputCls}
          />
          {err.total_marks && <span className={errorCls}>{err.total_marks}</span>}
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Questions</span>
          <input
            name="num_questions"
            type="number"
            required
            min={1}
            defaultValue={v.num_questions}
            className={inputCls}
          />
          {err.num_questions && <span className={errorCls}>{err.num_questions}</span>}
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          {mode === "create" ? "PDF" : "Replace PDF (optional)"}
        </span>
        <input
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required={mode === "create"}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium dark:file:bg-slate-800"
        />
        {err.file && <span className={errorCls}>{err.file}</span>}
      </label>

      <button disabled={pending} className={btnPrimary}>
        {pending ? "Saving…" : mode === "create" ? "Upload paper" : "Save changes"}
      </button>
    </form>
  );
}

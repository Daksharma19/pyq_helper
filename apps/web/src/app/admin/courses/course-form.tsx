"use client";

import { useActionState, useState, useTransition } from "react";
import { SEMESTERS, type Course } from "@pyq/shared";
import { removeCourse, saveCourse, type FormState } from "@/app/admin/actions";
import { Notice } from "@/components/admin/notice";
import { btnDanger, btnPrimary, errorCls, inputCls } from "@/components/admin/styles";

/** Add a course (no `course`) or edit one. The code is the key, so it can't be edited. */
export function CourseForm({ course }: { course?: Course }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCourse, {});
  const v = state.values ?? course;
  const err = state.errors ?? {};

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="mode" value={course ? "edit" : "new"} />
      {state.message && <Notice>{state.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-6">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Code</span>
          {course ? (
            <>
              <input type="hidden" name="code" value={course.code} />
              <input value={course.code} disabled className={inputCls} />
            </>
          ) : (
            <input
              name="code"
              required
              placeholder="e.g. 18B11EC213 or CS101"
              defaultValue={v?.code}
              className={`${inputCls} uppercase`}
            />
          )}
          {err.code && <span className={errorCls}>{err.code}</span>}
        </label>
        <label className="text-sm sm:col-span-4">
          <span className="mb-1 block font-medium">Title</span>
          <input name="title" required defaultValue={v?.title} className={inputCls} />
          {err.title && <span className={errorCls}>{err.title}</span>}
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Program</span>
          <input name="program" defaultValue={v?.program ?? "B.Tech"} className={inputCls} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Semester</span>
          <select name="semester" required defaultValue={v?.semester ?? ""} className={inputCls}>
            <option value="" disabled>
              Select
            </option>
            {SEMESTERS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {err.semester && <span className={errorCls}>{err.semester}</span>}
        </label>
        <div className="flex items-end sm:col-span-2">
          <button disabled={pending} className={`${btnPrimary} w-full`}>
            {pending ? "Saving…" : course ? "Save" : "Add course"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function DeleteCourse({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-2">
      {error && <Notice kind="error">{error}</Notice>}
      <button
        disabled={pending}
        className={btnDanger}
        onClick={() =>
          confirm(`Delete course ${code}?`) &&
          start(async () => setError((await removeCourse(code)).errors?._))
        }
      >
        Delete course
      </button>
    </div>
  );
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  deleteCourse,
  deletePaper,
  findPaper,
  getAnyPaper,
  insertPaper,
  newStoragePath,
  pgCode,
  PG,
  removePdf,
  updatePaper,
  uploadPdf,
  upsertCourse,
} from "@pyq/db";
import {
  courseInputSchema,
  firstIssues,
  looksLikePdf,
  MAX_PDF_BYTES,
  paperInputSchema,
} from "@pyq/shared";
import { requireAdmin } from "@/lib/auth";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Set when the paper already exists, so the UI can link to it. */
  existingId?: string;
  createdId?: string;
  values?: Record<string, string>;
};

const DUPLICATE = "A paper for this course, term and year already exists.";
const uuid = z.uuid();

function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form) if (typeof v === "string") out[k] = v;
  return out;
}

/** Validates an uploaded PDF. Returns an error message, or null if it's fine / absent-and-optional. */
async function checkPdf(
  file: FormDataEntryValue | null,
  required: boolean,
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return required ? "Choose a PDF file." : null;
  if (file.size > MAX_PDF_BYTES) return "PDF is larger than 20 MB.";
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return looksLikePdf(head) ? null : "That file is not a PDF.";
}

export async function createPaper(_: FormState | null, form: FormData): Promise<FormState> {
  const { db } = await requireAdmin();
  const values = formValues(form);
  const parsed = paperInputSchema().safeParse(values);
  const fileError = await checkPdf(form.get("file"), true);
  if (!parsed.success || fileError) {
    const errors = parsed.success ? {} : firstIssues(parsed.error);
    if (fileError) errors.file = fileError;
    return { errors, values };
  }
  const input = parsed.data;

  const existing = await findPaper(db, input);
  if (existing) return { errors: { _: DUPLICATE }, existingId: existing.id, values };

  const path = newStoragePath(input);
  try {
    await uploadPdf(db, path, form.get("file") as File);
  } catch {
    return { errors: { file: "Upload failed. Try again." }, values };
  }
  try {
    const { id } = await insertPaper(db, { ...input, storage_path: path });
    revalidatePath("/admin");
    return {
      ok: true,
      createdId: id,
      message: `Added ${input.course_code} ${input.term} ${input.year}.`,
      // Keep course and term for the next paper; clear the rest.
      values: { course_code: input.course_code, term: input.term, year: String(input.year) },
    };
  } catch (e) {
    await removePdf(db, path);
    if (pgCode(e) === PG.uniqueViolation) {
      const dup = await findPaper(db, input);
      return { errors: { _: DUPLICATE }, existingId: dup?.id, values };
    }
    if (pgCode(e) === PG.foreignKeyViolation)
      return { errors: { course_code: "Unknown course. Add it under Courses first." }, values };
    throw e;
  }
}

export async function editPaper(id: string, _: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireAdmin(`/admin/papers/${id}`);
  const values = formValues(form);
  const current = uuid.safeParse(id).success ? await getAnyPaper(db, id) : null;
  if (!current) return { errors: { _: "Paper not found." } };

  const parsed = paperInputSchema().safeParse(values);
  const fileError = await checkPdf(form.get("file"), false);
  if (!parsed.success || fileError) {
    const errors = parsed.success ? {} : firstIssues(parsed.error);
    if (fileError) errors.file = fileError;
    return { errors, values };
  }
  const input = parsed.data;

  const clash = await findPaper(db, input);
  if (clash && clash.id !== id) return { errors: { _: DUPLICATE }, existingId: clash.id, values };

  const file = form.get("file");
  const newPath = file instanceof File && file.size > 0 ? newStoragePath(input) : undefined;
  if (newPath) await uploadPdf(db, newPath, file as File);
  try {
    await updatePaper(db, id, { ...input, ...(newPath && { storage_path: newPath }) });
  } catch (e) {
    if (newPath) await removePdf(db, newPath);
    if (pgCode(e) === PG.uniqueViolation) return { errors: { _: DUPLICATE }, values };
    throw e;
  }
  if (newPath) await removePdf(db, current.storage_path);
  revalidatePath(`/admin/papers/${id}`);
  return { ok: true, message: newPath ? "Saved, PDF replaced." : "Saved.", values };
}

export async function setPublished(id: string, published: boolean): Promise<void> {
  const { db } = await requireAdmin(`/admin/papers/${id}`);
  await updatePaper(db, uuid.parse(id), { published });
  revalidatePath(`/admin/papers/${id}`);
  revalidatePath("/admin");
}

export async function removePaper(id: string): Promise<void> {
  const { db } = await requireAdmin(`/admin/papers/${id}`);
  const { storage_path } = await deletePaper(db, uuid.parse(id));
  await removePdf(db, storage_path);
  redirect("/admin?deleted=1");
}

export async function saveCourse(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireAdmin("/admin/courses");
  const values = formValues(form);
  const isNew = values.mode !== "edit";
  const parsed = courseInputSchema.safeParse(values);
  if (!parsed.success) return { errors: firstIssues(parsed.error), values };
  try {
    await upsertCourse(db, parsed.data, isNew);
  } catch (e) {
    if (pgCode(e) === PG.uniqueViolation)
      return { errors: { code: "That course code already exists." }, values };
    throw e;
  }
  revalidatePath("/admin/courses");
  return { ok: true, message: `${isNew ? "Added" : "Saved"} ${parsed.data.code}.` };
}

export async function removeCourse(code: string): Promise<FormState> {
  const { db } = await requireAdmin("/admin/courses");
  try {
    await deleteCourse(db, code);
  } catch (e) {
    if (pgCode(e) === PG.foreignKeyViolation)
      return { errors: { _: `${code} has papers. Delete or move them first.` } };
    throw e;
  }
  revalidatePath("/admin/courses");
  return { ok: true, message: `Deleted ${code}.` };
}

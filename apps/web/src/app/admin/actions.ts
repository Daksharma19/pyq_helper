"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  DB_ERROR,
  dbErrorCode,
  deleteCourse,
  deletePapers,
  downloadStaged,
  findPaper,
  findPaperByFile,
  getAnyPaper,
  insertPaper,
  listCourses,
  newStoragePath,
  paperHash,
  removePdf,
  removeStaged,
  sha256,
  updatePaper,
  uploadPdf,
  upsertCourse,
  type PaperKey,
} from "@pyq/db";
import {
  courseInputSchema,
  extractPaperMeta,
  firstIssues,
  PAPER_HASH_RE,
  paperInputSchema,
  type ExtractedMeta,
} from "@pyq/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import { readPaperFile } from "@/lib/paper-file";
import { paperText, type TextSource } from "@/lib/pipeline";
import { precheckUpload } from "@/lib/upload-formats";
import { TAGS } from "@/lib/public-data";

// A paper's identity is paper_hash = SHA-256("COURSE|TERM|YEAR"), computed from the metadata
// (read from the PDF, confirmed by the admin). It is the duplicate check and the URL id.
// file_hash = SHA-256 of the uploaded file additionally stops the same file (PDF, photo or
// document) being stored twice. Non-PDF uploads are converted to PDF first (lib/paper-file.ts).

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** paper_hash of the paper that blocked this one as a duplicate, for linking. */
  existing?: string;
  /** paper_hash of the paper just created. */
  created?: string;
  values?: Record<string, string>;
};

const DUPLICATE = "A paper for this course, term and year already exists.";
const SAME_FILE = "This exact PDF is already stored";
const label = (p: PaperKey) => `${p.course_code} ${p.term} ${p.year}`;
const pdfBlob = (bytes: Uint8Array<ArrayBuffer>) => new Blob([bytes], { type: "application/pdf" });

/** After any paper change: drop cached public data and refresh the admin list. */
function papersChanged() {
  revalidateTag(TAGS.papers);
  revalidatePath("/admin");
}

/** After any course change (titles also appear on paper pages). */
function coursesChanged() {
  revalidateTag(TAGS.courses);
  revalidatePath("/admin/courses");
}

function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form) if (typeof v === "string") out[k] = v;
  return out;
}

/**
 * The uploaded file. The browser stages it in the private "uploads" bucket first
 * (lib/stage-upload.ts) and sends only `staged` (its path) and `name`.
 */
async function stagedFile(storage: SupabaseClient, form: FormData): Promise<File | null> {
  const path = form.get("staged");
  const name = form.get("name");
  if (typeof path !== "string" || !path) return null;
  const blob = await downloadStaged(storage, path);
  if (!blob) return null;
  return new File([blob], typeof name === "string" && name ? name : "upload");
}

const stagedPath = (form: FormData) => String(form.get("staged") ?? "");

/** Hashes arrive from the client (URLs, bound actions): reject anything malformed early. */
function checkHash(hash: string): string {
  if (!PAPER_HASH_RE.test(hash)) throw new Error("Invalid paper id");
  return hash;
}

export type Analysis =
  | { error: string }
  | {
      fileHash: string;
      /** Identity hash, when course, term and year were all read. */
      paperHash?: string;
      meta: ExtractedMeta;
      /** Where the text came from; "none" means nothing could be read. */
      source: TextSource;
      /** Set when the upload was converted, e.g. "JPEG image". */
      convertedFrom?: string;
      pages?: number;
      duplicate?: { hash: string; label: string; reason: "file" | "paper" };
    };

/**
 * Pipeline step 1 (nothing is stored):
 * 1. hash the uploaded bytes; stop if that exact file is already stored (before any work);
 * 2. detect the real type, convert to PDF locally if needed, validate the PDF;
 * 3. read its text (text layer, else OCR) and extract course, term, year, marks, questions;
 * 4. hash the extracted identity (course|term|year) and check whether that paper exists.
 */
export async function analyzePaper(form: FormData): Promise<Analysis> {
  const { query, storage } = await requireAdmin("/admin/papers/new");
  const file = await stagedFile(storage, form);
  if (!file) return { error: "The upload didn't arrive. Try again." };
  const pre = precheckUpload(file);
  if (pre) return { error: pre };

  const fileHash = sha256(new Uint8Array(await file.arrayBuffer()));
  const sameFile = await query((db) => findPaperByFile(db, fileHash));
  if (sameFile) {
    const { course_code, term, year, paper_hash } = sameFile;
    return {
      fileHash,
      paperHash: paper_hash,
      meta: { course_code, term, year },
      source: "none",
      duplicate: { hash: paper_hash, label: label(sameFile), reason: "file" },
    };
  }

  // Sequential on purpose: PDF rendering/OCR blocks the event loop for seconds, and a DB
  // transaction waiting behind it would time out.
  const pdf = await readPaperFile(file);
  if ("error" in pdf) return pdf;
  const converted = { convertedFrom: pdf.convertedFrom, pages: pdf.pages };

  const courses = await query(listCourses);
  const { text, source } = await paperText(pdf.pdf);
  const meta = extractPaperMeta(text, courses);
  const key = paperInputSchema()
    .pick({ course_code: true, term: true, year: true })
    .safeParse(meta);
  if (!key.success) return { fileHash, meta, source, ...converted };

  const identity = paperHash(key.data);
  const samePaper = await query((db) => findPaper(db, key.data));
  const duplicate = samePaper
    ? { hash: samePaper.paper_hash, label: label(samePaper), reason: "paper" as const }
    : undefined;
  return { fileHash, paperHash: identity, meta, source, duplicate, ...converted };
}

/**
 * Pipeline step 2: store the paper. Everything is re-validated server-side: both hashes are
 * recomputed here (never trusted from the client), both duplicate checks run again, then
 * the PDF is uploaded and the row inserted. Unique constraints on paper_hash and file_hash
 * catch races between concurrent uploads.
 */
export async function createPaper(_: FormState | null, form: FormData): Promise<FormState> {
  const { query, storage } = await requireAdmin();
  const values = formValues(form);
  const parsed = paperInputSchema().safeParse(values);
  const pdf = await readPaperFile(await stagedFile(storage, form));
  if (!parsed.success || "error" in pdf) {
    const errors = parsed.success ? {} : firstIssues(parsed.error);
    if ("error" in pdf) errors.file = pdf.error;
    return { errors, values };
  }
  const input = parsed.data;
  const file_hash = pdf.sourceHash;

  const [sameFile, samePaper] = await query((db) =>
    Promise.all([findPaperByFile(db, file_hash), findPaper(db, input)]),
  );
  if (sameFile) {
    const errors = { _: `${SAME_FILE} (${label(sameFile)}).` };
    return { errors, existing: sameFile.paper_hash, values };
  }
  if (samePaper) return { errors: { _: DUPLICATE }, existing: samePaper.paper_hash, values };

  const path = newStoragePath(input);
  try {
    await uploadPdf(storage, path, pdfBlob(pdf.pdf));
  } catch {
    return { errors: { file: "Upload failed. Try again." }, values };
  }
  try {
    const created = await query((db) =>
      insertPaper(db, { ...input, storage_path: path, file_hash }),
    );
    papersChanged();
    await removeStaged(storage, stagedPath(form));
    return { ok: true, created, message: `Added ${label(input)}.` };
  } catch (e) {
    await removePdf(storage, path);
    if (dbErrorCode(e) === DB_ERROR.uniqueViolation) {
      // Lost a race with another upload of the same paper or file.
      return { errors: { _: DUPLICATE }, existing: paperHash(input), values };
    }
    if (dbErrorCode(e) === DB_ERROR.foreignKeyViolation)
      return { errors: { course_code: "Unknown course. Add it under Courses first." }, values };
    throw e;
  }
}

/**
 * Edits metadata and optionally replaces the PDF. Replacing the PDF keeps the paper's URL;
 * changing course/term/year changes its identity, so the admin is redirected to the new URL.
 */
export async function editPaper(hash: string, _: FormState, form: FormData): Promise<FormState> {
  checkHash(hash);
  const { query, storage } = await requireAdmin(`/admin/papers/${hash}`);
  const values = formValues(form);
  const current = await query((db) => getAnyPaper(db, hash));
  if (!current) return { errors: { _: "Paper not found." } };

  const parsed = paperInputSchema().safeParse(values);
  // No `staged` field = keep the current PDF.
  const pdf = form.get("staged") ? await readPaperFile(await stagedFile(storage, form)) : undefined;
  if (!parsed.success || (pdf && "error" in pdf)) {
    const errors = parsed.success ? {} : firstIssues(parsed.error);
    if (pdf && "error" in pdf) errors.file = pdf.error;
    return { errors, values };
  }
  const input = parsed.data;

  if (paperHash(input) !== hash) {
    const clash = await query((db) => findPaper(db, input));
    if (clash) return { errors: { _: DUPLICATE }, existing: clash.paper_hash, values };
  }

  let replacement: { storage_path: string; file_hash: string } | undefined;
  if (pdf && "sourceHash" in pdf) {
    const file_hash = pdf.sourceHash;
    const sameFile = await query((db) => findPaperByFile(db, file_hash));
    if (sameFile && sameFile.paper_hash !== hash) {
      const errors = { file: `${SAME_FILE} (${label(sameFile)}).` };
      return { errors, existing: sameFile.paper_hash, values };
    }
    if (file_hash !== current.file_hash) {
      replacement = { storage_path: newStoragePath(input), file_hash };
      await uploadPdf(storage, replacement.storage_path, pdfBlob(pdf.pdf));
    }
  }

  let newHash: string;
  try {
    newHash = await query((db) => updatePaper(db, hash, { ...input, ...replacement }));
  } catch (e) {
    if (replacement) await removePdf(storage, replacement.storage_path);
    if (dbErrorCode(e) === DB_ERROR.uniqueViolation) return { errors: { _: DUPLICATE }, values };
    throw e;
  }
  if (replacement) await removePdf(storage, current.storage_path);
  await removeStaged(storage, stagedPath(form));
  papersChanged();
  if (newHash !== hash) redirect(`/admin/papers/${newHash}?moved=1`);
  revalidatePath(`/admin/papers/${hash}`);
  return { ok: true, message: replacement ? "Saved, PDF replaced." : "Saved.", values };
}

export async function setPublished(hash: string, published: boolean): Promise<void> {
  checkHash(hash);
  const { query } = await requireAdmin(`/admin/papers/${hash}`);
  await query((db) => updatePaper(db, hash, { published }));
  revalidatePath(`/admin/papers/${hash}`);
  papersChanged();
}

/** Upper bound for one bulk delete: keeps the transaction and storage request small. */
const MAX_DELETE = 200;

/**
 * Deletes papers (rows, then their PDFs). All or nothing: if any hash is unknown or not
 * allowed, nothing is deleted. Used by the papers list (one or many) and the edit page.
 */
export async function removePapers(hashes: string[]): Promise<FormState> {
  const { query, storage } = await requireAdmin("/admin");
  if (!Array.isArray(hashes) || hashes.length === 0 || hashes.length > MAX_DELETE) {
    return { errors: { _: `Select between 1 and ${MAX_DELETE} papers.` } };
  }
  hashes.forEach(checkHash);
  let paths: string[];
  try {
    paths = await query((db) => deletePapers(db, hashes));
  } catch {
    return { errors: { _: "Nothing was deleted: some papers no longer exist. Reload and retry." } };
  }
  await removePdf(storage, ...paths);
  papersChanged();
  const n = paths.length;
  return { ok: true, message: `Deleted ${n} paper${n === 1 ? "" : "s"}.` };
}

export async function removePaper(hash: string): Promise<FormState> {
  const res = await removePapers([hash]);
  if (res.ok) redirect("/admin?deleted=1");
  return res;
}

export async function saveCourse(_: FormState, form: FormData): Promise<FormState> {
  const { query } = await requireAdmin("/admin/courses");
  const values = formValues(form);
  const isNew = values.mode !== "edit";
  const parsed = courseInputSchema.safeParse(values);
  if (!parsed.success) return { errors: firstIssues(parsed.error), values };
  try {
    await query((db) => upsertCourse(db, parsed.data, isNew));
  } catch (e) {
    if (dbErrorCode(e) === DB_ERROR.uniqueViolation)
      return { errors: { code: "That course code already exists." }, values };
    throw e;
  }
  coursesChanged();
  return { ok: true, message: `${isNew ? "Added" : "Saved"} ${parsed.data.code}.` };
}

export async function removeCourse(code: string): Promise<FormState> {
  const { query } = await requireAdmin("/admin/courses");
  try {
    await query((db) => deleteCourse(db, code));
  } catch (e) {
    if (dbErrorCode(e) === DB_ERROR.foreignKeyViolation)
      return { errors: { _: `${code} has papers. Delete or move them first.` } };
    throw e;
  }
  coursesChanged();
  return { ok: true, message: `Deleted ${code}.` };
}

/**
 * Adds a course from the upload queue, when a paper's course isn't in the list yet. A course
 * that already exists (e.g. added by another paper in the same batch) is fine: it's kept as is.
 */
export async function addCourse(values: Record<string, string>): Promise<FormState> {
  const { query } = await requireAdmin("/admin/papers/new");
  const parsed = courseInputSchema.safeParse(values);
  if (!parsed.success) return { errors: firstIssues(parsed.error), values };
  try {
    await query((db) => upsertCourse(db, parsed.data, true));
  } catch (e) {
    if (dbErrorCode(e) === DB_ERROR.uniqueViolation) return { ok: true };
    throw e;
  }
  coursesChanged();
  return { ok: true, message: `Added course ${parsed.data.code}.` };
}

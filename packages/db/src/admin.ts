import type { Course, PaperInput, PaperWithCourse, Term } from "@pyq/shared";
import { PAPER_SELECT, PAPERS_BUCKET, type Client } from "./queries";

// Admin queries. They run with the signed-in user's client, so RLS decides what is allowed.

export async function isAdmin(db: Client): Promise<boolean> {
  const { data, error } = await db.rpc("is_admin");
  if (error) throw error;
  return data;
}

/** All papers including unpublished, newest first. */
export async function listAllPapers(
  db: Client,
  filters: { course?: string; published?: boolean } = {},
  limit = 200,
): Promise<PaperWithCourse[]> {
  let q = db.from("papers").select(PAPER_SELECT);
  if (filters.course) q = q.eq("course_code", filters.course);
  if (filters.published !== undefined) q = q.eq("published", filters.published);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

export async function getAnyPaper(db: Client, id: string): Promise<PaperWithCourse | null> {
  const { data, error } = await db.from("papers").select(PAPER_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** The paper for a course/term/year, if one exists (the uniqueness key). */
export async function findPaper(
  db: Client,
  key: { course_code: string; term: Term; year: number },
): Promise<{ id: string } | null> {
  const { data, error } = await db
    .from("papers")
    .select("id")
    .eq("course_code", key.course_code)
    .eq("term", key.term)
    .eq("year", key.year)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Storage key for a new upload. The suffix keeps replaced files from being served stale. */
export function newStoragePath(
  key: { course_code: string; term: Term; year: number },
  suffix = Date.now().toString(36),
): string {
  return `${key.course_code}/${key.year}-${key.term}-${suffix}.pdf`;
}

export async function uploadPdf(db: Client, path: string, file: Blob): Promise<void> {
  const { error } = await db.storage
    .from(PAPERS_BUCKET)
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (error) throw error;
}

/** Best-effort: an orphaned file is harmless, a failed request shouldn't mask the real result. */
export async function removePdf(db: Client, path: string): Promise<void> {
  await db.storage.from(PAPERS_BUCKET).remove([path]);
}

export async function insertPaper(
  db: Client,
  input: PaperInput & { storage_path: string; published?: boolean },
): Promise<{ id: string }> {
  const { data, error } = await db.from("papers").insert(input).select("id").single();
  if (error) throw error;
  return data;
}

export async function updatePaper(
  db: Client,
  id: string,
  patch: Partial<PaperInput> & { storage_path?: string; published?: boolean },
): Promise<void> {
  const { data, error } = await db.from("papers").update(patch).eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw new Error("Paper not found or not allowed");
}

export async function deletePaper(db: Client, id: string): Promise<{ storage_path: string }> {
  const { data, error } = await db
    .from("papers")
    .delete()
    .eq("id", id)
    .select("storage_path")
    .single();
  if (error) throw error;
  return data;
}

export async function courseUsage(db: Client): Promise<Map<string, number>> {
  const { data, error } = await db.from("papers").select("course_code");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const { course_code } of data) counts.set(course_code, (counts.get(course_code) ?? 0) + 1);
  return counts;
}

export async function upsertCourse(db: Client, course: Course, isNew: boolean): Promise<void> {
  const { error } = isNew
    ? await db.from("courses").insert(course)
    : await db.from("courses").update(course).eq("code", course.code);
  if (error) throw error;
}

export async function deleteCourse(db: Client, code: string): Promise<void> {
  const { error } = await db.from("courses").delete().eq("code", code);
  if (error) throw error;
}

/** Postgres error codes surfaced by PostgREST that the UI turns into friendly messages. */
export const PG = { uniqueViolation: "23505", foreignKeyViolation: "23503" } as const;

export function pgCode(e: unknown): string | undefined {
  return typeof e === "object" && e && "code" in e ? String(e.code) : undefined;
}

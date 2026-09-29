import type { Course, PaperInput, PaperWithCourse, Term } from "@pyq/shared";
import type { Db } from "./client";
import { paperHash, type PaperKey } from "./hash";

// Admin queries. They run as the signed-in user (withCaller), so RLS decides what is allowed.
// Papers are addressed by paper_hash (hash of course/term/year, their URL id); the uuid
// primary key stays internal. file_hash (hash of the PDF bytes) catches re-uploaded files.

/** Enough to identify and label a paper. */
export type PaperRef = {
  paper_hash: string;
  file_hash: string;
  course_code: string;
  term: Term;
  year: number;
};
const REF = { paper_hash: true, file_hash: true, course_code: true, term: true, year: true };

export async function isAdmin(db: Db): Promise<boolean> {
  const [row] = await db.$queryRaw<{ is_admin: boolean }[]>`select public.is_admin() as is_admin`;
  return row?.is_admin === true;
}

/** All papers including unpublished, newest first. */
export function listAllPapers(
  db: Db,
  filters: { course?: string; published?: boolean } = {},
  limit = 200,
): Promise<PaperWithCourse[]> {
  return db.papers.findMany({
    where: { course_code: filters.course, published: filters.published },
    include: { course: true },
    orderBy: { created_at: "desc" },
    take: limit,
  });
}

/** Any paper (published or not) by paper hash. */
export function getAnyPaper(db: Db, hash: string): Promise<PaperWithCourse | null> {
  return db.papers.findUnique({ where: { paper_hash: hash }, include: { course: true } });
}

/** The paper with this identity (hash of course/term/year), if one exists. */
export function findPaper(db: Db, key: PaperKey): Promise<PaperRef | null> {
  return db.papers.findUnique({ where: { paper_hash: paperHash(key) }, select: REF });
}

/** The paper stored with exactly this PDF (same SHA-256 of the bytes), if any. */
export function findPaperByFile(db: Db, fileHash: string): Promise<PaperRef | null> {
  return db.papers.findUnique({ where: { file_hash: fileHash }, select: REF });
}

/** Storage key for a new upload. The suffix keeps replaced files from being served stale. */
export function newStoragePath(key: PaperKey, suffix = Date.now().toString(36)): string {
  return `${key.course_code}/${key.year}-${key.term}-${suffix}.pdf`;
}

/** Inserts a paper; the database derives its paper_hash. Returns that hash. */
export async function insertPaper(
  db: Db,
  input: PaperInput & { storage_path: string; file_hash: string; published?: boolean },
): Promise<string> {
  const row = await db.papers.create({ data: input, select: { paper_hash: true } });
  return row.paper_hash;
}

/**
 * Updates a paper and returns its (possibly new) paper_hash: changing course/term/year
 * changes the identity. updateMany + count because RLS hides rows instead of raising.
 */
export async function updatePaper(
  db: Db,
  hash: string,
  patch: Partial<PaperInput> & { storage_path?: string; file_hash?: string; published?: boolean },
): Promise<string> {
  const { count } = await db.papers.updateMany({ where: { paper_hash: hash }, data: patch });
  if (count === 0) throw new Error("Paper not found or not allowed");
  return patch.course_code && patch.term && patch.year
    ? paperHash({ course_code: patch.course_code, term: patch.term, year: patch.year })
    : hash;
}

/**
 * Deletes papers by hash, all or nothing: if any is missing or RLS refuses one, it throws and
 * the surrounding transaction (withCaller) rolls back. Returns the PDFs' storage paths so
 * the caller can remove the files once the rows are gone.
 */
export async function deletePapers(db: Db, hashes: string[]): Promise<string[]> {
  const unique = [...new Set(hashes)];
  const rows = await db.papers.findMany({
    where: { paper_hash: { in: unique } },
    select: { storage_path: true },
  });
  const { count } = await db.papers.deleteMany({ where: { paper_hash: { in: unique } } });
  if (rows.length !== unique.length || count !== unique.length) {
    throw new Error("Paper not found or not allowed");
  }
  return rows.map((r) => r.storage_path);
}

export async function courseUsage(db: Db): Promise<Map<string, number>> {
  const rows = await db.papers.groupBy({ by: ["course_code"], _count: { _all: true } });
  return new Map(rows.map((r) => [r.course_code, r._count._all]));
}

export async function upsertCourse(db: Db, course: Course, isNew: boolean): Promise<void> {
  if (isNew) {
    await db.courses.create({ data: course });
    return;
  }
  const { count } = await db.courses.updateMany({ where: { code: course.code }, data: course });
  if (count === 0) throw new Error("Course not found or not allowed");
}

export async function deleteCourse(db: Db, code: string): Promise<void> {
  const { count } = await db.courses.deleteMany({ where: { code } });
  if (count === 0) throw new Error("Course not found or not allowed");
}

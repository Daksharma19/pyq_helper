import type { BrowseFilters, Course, PublicPaper } from "@pyq/shared";
import type { Db } from "./client";

// Public queries. They run as whichever caller `withCaller` set, so RLS decides visibility;
// the explicit `published: true` also keeps unpublished papers off public pages for admins.
// They return plain JSON-safe objects (PublicPaper) so results can be cached.

export const PAGE_SIZE = 30;
export const PAPERS_BUCKET = "papers";

/** Browse filters with the subject search already resolved to course codes. */
export type PaperQuery = Omit<BrowseFilters, "q"> & {
  /** Only these courses (from searchCourses). An empty array matches nothing. */
  courseIn?: string[];
};

const PUBLIC_SELECT = {
  paper_hash: true,
  course_code: true,
  term: true,
  year: true,
  total_marks: true,
  num_questions: true,
  storage_path: true,
  course: true,
} as const;

export function listCourses(db: Db): Promise<Course[]> {
  return db.courses.findMany({ orderBy: [{ semester: "asc" }, { code: "asc" }] });
}

/** Courses with at least one published paper: the public site never lists empty subjects. */
export function listCoursesWithPapers(db: Db): Promise<Course[]> {
  return db.courses.findMany({
    where: { papers: { some: { published: true } } },
    orderBy: [{ semester: "asc" }, { code: "asc" }],
  });
}

export async function listPapers(
  db: Db,
  filters: PaperQuery,
  limit = PAGE_SIZE,
): Promise<PublicPaper[]> {
  if (filters.courseIn?.length === 0) return [];
  return db.papers.findMany({
    where: {
      published: true,
      course_code: filters.courseIn ? { in: filters.courseIn } : undefined,
      AND: filters.course ? [{ course_code: filters.course }] : undefined,
      term: filters.term,
      year: filters.year,
      course: filters.semester ? { semester: filters.semester } : undefined,
    },
    select: PUBLIC_SELECT,
    orderBy: [{ year: "desc" }, { course_code: "asc" }, { term: "asc" }],
    take: limit,
  });
}

export async function listYears(db: Db): Promise<number[]> {
  const rows = await db.papers.findMany({
    where: { published: true },
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });
  return rows.map((r) => r.year);
}

/** Public lookup by paper hash. Unpublished papers are treated as missing, even for admins. */
export function getPaper(db: Db, hash: string): Promise<PublicPaper | null> {
  return db.papers.findFirst({
    where: { paper_hash: hash, published: true },
    select: PUBLIC_SELECT,
  });
}

export function paperFileName(p: Pick<PublicPaper, "course_code" | "term" | "year">): string {
  return `${p.course_code}_${p.year}_${p.term}.pdf`;
}

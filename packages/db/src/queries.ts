import type { BrowseFilters, Course, PaperWithCourse } from "@pyq/shared";
import type { Db } from "./client";

// Public queries. They run as whichever caller `withCaller` set, so RLS decides visibility;
// the explicit `published: true` also keeps unpublished papers off public pages for admins.

export const PAGE_SIZE = 30;
export const PAPERS_BUCKET = "papers";

const withCourse = { course: true } as const;

export function listCourses(db: Db): Promise<Course[]> {
  return db.courses.findMany({ orderBy: [{ semester: "asc" }, { code: "asc" }] });
}

export function listPapers(
  db: Db,
  filters: BrowseFilters,
  limit = PAGE_SIZE,
): Promise<PaperWithCourse[]> {
  return db.papers.findMany({
    where: {
      published: true,
      course_code: filters.course,
      term: filters.term,
      year: filters.year,
      course: filters.semester ? { semester: filters.semester } : undefined,
    },
    include: withCourse,
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
export function getPaper(db: Db, hash: string): Promise<PaperWithCourse | null> {
  return db.papers.findFirst({
    where: { paper_hash: hash, published: true },
    include: withCourse,
  });
}

export function paperFileName(p: Pick<PaperWithCourse, "course_code" | "term" | "year">): string {
  return `${p.course_code}_${p.year}_${p.term}.pdf`;
}

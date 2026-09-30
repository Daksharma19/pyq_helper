import "server-only";
import { unstable_cache } from "next/cache";
import { getPaper, listCoursesWithPapers, listPapers, listYears, type PaperQuery } from "@pyq/db";
import { publicQuery } from "@/lib/db";

// Public (anon) data, cached across requests. Pages stay dynamic (they read searchParams and
// `next build` must not need a database), but most requests skip the database entirely.
// Admin actions call revalidateTag() so changes show up immediately; the time-based
// fallback covers edits made outside the app (SQL, Studio).

export const TAGS = { papers: "papers", courses: "courses" } as const;
const FALLBACK_SECONDS = 3600;

export const getCourses = unstable_cache(
  () => publicQuery(listCoursesWithPapers),
  ["public:courses-with-papers"],
  {
    tags: [TAGS.courses, TAGS.papers],
    revalidate: FALLBACK_SECONDS,
  },
);

export const getYears = unstable_cache(() => publicQuery(listYears), ["public:years"], {
  tags: [TAGS.papers],
  revalidate: FALLBACK_SECONDS,
});

// Arguments are part of the cache key, so each filter combination is cached separately.
export const getPapers = unstable_cache(
  (query: PaperQuery, limit?: number) => publicQuery((db) => listPapers(db, query, limit)),
  ["public:papers"],
  { tags: [TAGS.papers, TAGS.courses], revalidate: FALLBACK_SECONDS },
);

export const getPublicPaper = unstable_cache(
  (hash: string) => publicQuery((db) => getPaper(db, hash)),
  ["public:paper"],
  { tags: [TAGS.papers, TAGS.courses], revalidate: FALLBACK_SECONDS },
);

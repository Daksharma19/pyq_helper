import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrowseFilters, Course, PaperWithCourse } from "@pyq/shared";
import type { Database } from "./database.types";

export type Client = SupabaseClient<Database>;

const PAPER_SELECT = "*, course:courses!inner(*)" as const;
export const PAGE_SIZE = 30;

export async function listCourses(db: Client): Promise<Course[]> {
  const { data, error } = await db.from("courses").select("*").order("semester").order("code");
  if (error) throw error;
  return data;
}

export async function listPapers(
  db: Client,
  filters: BrowseFilters,
  limit = PAGE_SIZE,
): Promise<PaperWithCourse[]> {
  let q = db.from("papers").select(PAPER_SELECT);
  if (filters.course) q = q.eq("course_code", filters.course);
  if (filters.term) q = q.eq("term", filters.term);
  if (filters.year) q = q.eq("year", filters.year);
  if (filters.semester) q = q.eq("course.semester", filters.semester);
  const { data, error } = await q
    .order("year", { ascending: false })
    .order("course_code")
    .order("term")
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function listYears(db: Client): Promise<number[]> {
  const { data, error } = await db.from("papers").select("year").order("year", { ascending: false });
  if (error) throw error;
  return [...new Set(data.map((r) => r.year))];
}

export async function getPaper(db: Client, id: string): Promise<PaperWithCourse | null> {
  const { data, error } = await db.from("papers").select(PAPER_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export function paperFileName(p: Pick<PaperWithCourse, "course_code" | "term" | "year">): string {
  return `${p.course_code}_${p.year}_${p.term}.pdf`;
}

export const PAPERS_BUCKET = "papers";

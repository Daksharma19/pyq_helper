import type { Course, Term } from "./domain";
import { MIN_YEAR } from "./domain";

/** Metadata guessed from a paper's text. Every field is optional: the admin reviews it. */
export type ExtractedMeta = {
  course_code?: string;
  term?: Term;
  year?: number;
  total_marks?: number;
  num_questions?: number;
};

const CODE_RE = /\b\d{2}[A-Z]\d{2}[A-Z]{2}\d{3}\b/g;

/**
 * Reads JIIT paper headers ("Course Code: 15B11MA111", "Test-2 Examination, Odd 2023",
 * "Maximum Marks: 20", "Q1.") from extracted/OCR text. OCR noise is expected, so each
 * rule is lenient and anything it can't read is left undefined.
 */
export function extractPaperMeta(
  text: string,
  courses: Pick<Course, "code" | "title">[],
  now = new Date(),
): ExtractedMeta {
  const out: ExtractedMeta = {};
  const known = new Set(courses.map((c) => c.code));

  // Course: a known code in the text, else a known title, else any code-shaped token.
  const codes = [...text.toUpperCase().matchAll(CODE_RE)].map((m) => m[0]);
  const course =
    codes.find((c) => known.has(c)) ??
    courses.find((c) => normalise(text).includes(normalise(c.title)))?.code ??
    codes[0];
  if (course) out.course_code = course;

  // Term: "T2 Examination", "Test-2", or end-term / end-semester (= T3). A bare "T2"
  // elsewhere in the text is too ambiguous to trust.
  const t =
    /\bT\s*-?\s*([123])\s*(?:Ex\w*|Test)/i.exec(text) ?? /\bTest\s*-?\s*([123])\b/i.exec(text);
  if (t) out.term = `T${t[1]}` as Term;
  else if (/end\s*-?\s*(?:sem\w*|term)\s*exam/i.test(text)) out.term = "T3";

  // Year: prefer "Odd/Even (Semester) 2023", else the first plausible year.
  const maxYear = now.getFullYear();
  const plausible = (y: number) => y >= MIN_YEAR && y <= maxYear;
  const sem = /\b(?:odd|even)\W*(?:sem\w*\W*)?(20\d{2})\b/i.exec(text);
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1])).filter(plausible);
  const year = sem && plausible(Number(sem[1])) ? Number(sem[1]) : years[0];
  if (year) out.year = year;

  const marks = /max(?:imum)?\.?\s*marks\s*[:-]?\s*(\d{1,3})\b/i.exec(text);
  if (marks) out.total_marks = Number(marks[1]);

  const questions = countQuestions(text);
  if (questions) out.num_questions = questions;

  return out;
}

// Characters OCR commonly returns in place of digits ("QI." for "Q1.", "QS" for "Q5").
const OCR_DIGITS: Record<string, string> = {
  I: "1",
  l: "1",
  i: "1",
  "|": "1",
  S: "5",
  s: "5",
  O: "0",
  o: "0",
  B: "8",
};

/**
 * Two independent signals, taking the larger:
 * - the highest question number at a line start ("Q7.", OCR'd "QI."/"QS", or "04." for "Q4.");
 * - the number of per-question marks tags ("[4M]"), which survive OCR better than numbering.
 * Sub-parts ("(a)", "(b)") are not counted by either.
 */
export function countQuestions(text: string): number | undefined {
  const numbers = [
    ...[...text.matchAll(/(?:^|\n)\s*Q\s*[.,]?\s*([0-9IliSsOoB|]{1,2})(?![A-Za-z])/g)].map((m) =>
      Number([...m[1]!].map((c) => OCR_DIGITS[c] ?? c).join("")),
    ),
    ...[...text.matchAll(/(?:^|\n)\s*0([1-9])\s*[.)]/g)].map((m) => Number(m[1])),
  ].filter((n) => n > 0 && n <= 50);
  const tags = text.match(/\[\s*\d{1,2}\s*M\s*\]/gi)?.length ?? 0;
  const best = Math.max(0, tags, ...numbers);
  return best > 0 ? best : undefined;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

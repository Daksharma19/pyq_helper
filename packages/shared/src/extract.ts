import type { Course, Term } from "./domain";
import { MIN_YEAR } from "./domain";

/** Metadata guessed from a paper's text. Every field is optional: the admin reviews it. */
export type ExtractedMeta = {
  course_code?: string;
  /** Read from "Course Title: ...", for courses not yet in the list. */
  course_title?: string;
  /** From the course code (…MA301 → 3), else "B.Tech. VI Semester". */
  semester?: number;
  term?: Term;
  year?: number;
  total_marks?: number;
  num_questions?: number;
};

// JIIT codes: 15B11MA111, 18B11EC213, 16B1NHS631, 15B17CI371. The 4th and 5th characters
// are usually digits but can be letters ("1N"), and OCR reads "1" as "I" there.
const CODE_RE = /\b\d{2}[A-Z][0-9IL][0-9A-Z][A-Z]{2,3}\d{3}\b/g;

function fixCode(raw: string): string {
  const c = raw.toUpperCase();
  return c.slice(0, 3) + c[3]!.replace(/[IL]/, "1") + c.slice(4);
}

/** JIIT codes carry the semester in the last three digits: 15B11MA301 → 3. */
export function semesterOf(code?: string): number | undefined {
  const d = code ? /(\d)\d\d$/.exec(code) : null;
  const n = d ? Number(d[1]) : 0;
  return n >= 1 && n <= 8 ? n : undefined;
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
function semesterFromText(text: string): number | undefined {
  const m = /\b(VIII|VII|VI|IV|V|III|II|I|[1-8])\s*(?:st|nd|rd|th)?\.?\s*Sem/i.exec(text);
  if (!m) return undefined;
  return ROMAN[m[1]!.toUpperCase()] ?? Number(m[1]);
}

function courseTitle(text: string): string | undefined {
  const raw = /course\s*tit\w*\s*[:\-.]\s*(.+)/i.exec(text)?.[1];
  if (!raw) return undefined;
  const clean = raw
    .split(/\s{2,}|\s+max(?:imum)?\.?\s|\s+(?:time|duration)\s*[:-]|\//i)[0]!
    .replace(/[^A-Za-z0-9)&]+$/, "")
    .trim();
  return clean.length >= 3 ? clean : undefined;
}

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
  // A code after a "Course Code" label wins over one elsewhere in the text.
  const upper = text.toUpperCase();
  const labelled = /COURSE\s*CODE\s*[:\-.]?\s*([0-9A-Z]{9,11})/.exec(upper)?.[1];
  const codes = [
    ...(labelled && new RegExp(CODE_RE.source).test(labelled) ? [labelled] : []),
    ...[...upper.matchAll(CODE_RE)].map((m) => m[0]),
  ].map(fixCode);
  const course =
    codes.find((c) => known.has(c)) ??
    courses.find((c) => normalise(text).includes(normalise(c.title)))?.code ??
    codes[0];
  if (course) out.course_code = course;
  const title = courseTitle(text);
  if (title) out.course_title = title;
  const semester = semesterOf(out.course_code) ?? semesterFromText(text);
  if (semester) out.semester = semester;

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

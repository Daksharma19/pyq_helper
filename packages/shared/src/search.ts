import type { Course } from "./domain";

// Subject search. The course list is small (hundreds of rows at most), so matching runs in
// code over the full list, which allows smarter matching than SQL LIKE: acronyms ("PRP"),
// stems ("maths"), and Roman numerals ("sdf 1" -> "Fundamentals-I").

const STOPWORDS = new Set(["and", "of", "the", "for", "in", "to", "with"]);
const ROMAN: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
};
const MAX_WORDS = 8;

/** Lowercase alphanumeric tokens; "&" and punctuation split words, Roman numerals become digits. */
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => ROMAN[t] ?? t);
}

/** The words of a search query (deduplicated, capped). */
export function searchWords(q: string | undefined): string[] {
  return [...new Set(tokens(q ?? ""))].slice(0, MAX_WORDS);
}

type Indexed = { code: string; tokens: string[]; text: string; acronyms: Set<string> };

function index(course: Pick<Course, "code" | "title">): Indexed {
  const t = tokens(course.title);
  const words = t.filter((w) => !STOPWORDS.has(w));
  const letters = words.filter((w) => !/^\d+$/.test(w)).map((w) => w[0]);
  const acronym = letters.join("");
  // "Software Development Fundamentals-I" -> "sdf" and "sdf1"; "Data Structures" -> "ds".
  const numeral = words.find((w) => /^\d+$/.test(w)) ?? "";
  const acronyms = new Set([acronym, acronym + numeral].filter((a) => a.length >= 2));
  return { code: course.code.toLowerCase(), tokens: t, text: t.join(" "), acronyms };
}

function wordMatches(word: string, c: Indexed): boolean {
  // Short numbers ("1", "2") only match numbers in the title, never digits in the code,
  // so "mathematics 1" doesn't also find Mathematics-2 (code 15B11MA211 contains a "1").
  if (/^\d{1,2}$/.test(word)) return c.tokens.includes(word);
  if (c.text.includes(word) || c.code.includes(word) || c.acronyms.has(word)) return true;
  // Simple stem: "maths" -> "math", "processes" -> "processe".
  return word.length > 4 && word.endsWith("s") && c.text.includes(word.slice(0, -1));
}

/** Whether a course matches every word of the query. An empty query matches everything. */
export function matchesSubject(course: Pick<Course, "code" | "title">, q: string | undefined) {
  const words = searchWords(q);
  if (!words.length) return true;
  const c = index(course);
  return words.every((w) => wordMatches(w, c));
}

/** Codes of the courses matching a subject query. */
export function searchCourses<C extends Pick<Course, "code" | "title">>(
  courses: C[],
  q: string | undefined,
): string[] {
  return courses.filter((c) => matchesSubject(c, q)).map((c) => c.code);
}

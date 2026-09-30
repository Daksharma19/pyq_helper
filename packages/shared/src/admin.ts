import { z } from "zod";
import { COURSE_CODE_RE, MIN_YEAR, TERMS } from "./domain";

const courseCode = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase().replace(/\s+/g, ""))
  .pipe(z.string().regex(COURSE_CODE_RE, "Course code: 2 to 30 letters, digits or dashes"));

const positiveInt = (label: string, max: number) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(1, `${label} must be at least 1`)
    .max(max, `${label} must be at most ${max}`);

/** Paper metadata as entered by an admin (form or CSV row). `now` is injectable for tests. */
export function paperInputSchema(now = new Date()) {
  return z.object({
    course_code: courseCode,
    term: z.enum(TERMS, { error: "Term must be T1, T2 or T3" }),
    year: z.coerce
      .number({ error: "Year must be a number" })
      .int("Year must be a whole number")
      .min(MIN_YEAR, `Year must be ${MIN_YEAR} or later`)
      .max(now.getFullYear(), "Year can't be in the future"),
    total_marks: positiveInt("Total marks", 500),
    num_questions: positiveInt("Number of questions", 100),
  });
}
export type PaperInput = z.infer<ReturnType<typeof paperInputSchema>>;

export const courseInputSchema = z.object({
  code: courseCode,
  title: z.string().trim().min(1, "Title is required").max(200),
  program: z.string().trim().min(1).max(50).default("B.Tech"),
  semester: z.coerce.number().int().min(1, "Semester must be 1–8").max(8, "Semester must be 1–8"),
});
export type CourseInput = z.infer<typeof courseInputSchema>;

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Checks the file really is a PDF (magic bytes), not just named like one. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return [0x25, 0x50, 0x44, 0x46, 0x2d].every((b, i) => bytes[i] === b); // "%PDF-"
}

/** First message per field, for showing next to form inputs. */
export function firstIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "_")] ??= issue.message;
  return out;
}

import { firstIssues, paperInputSchema, type PaperInput } from "./admin";

export const BULK_COLUMNS = [
  "file",
  "course_code",
  "term",
  "year",
  "total_marks",
  "num_questions",
] as const;

export type BulkRow =
  | { line: number; file: string; ok: true; input: PaperInput }
  | { line: number; file: string; ok: false; errors: string[] };

/** Minimal RFC 4180 CSV: quoted fields, "" escapes, CRLF or LF, blank lines skipped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/**
 * Parses a bulk-upload CSV (header row required, columns in any order) and validates each
 * row. Also flags rows whose PDF wasn't selected and rows that repeat a course/term/year.
 */
export function parseBulkCsv(
  text: string,
  fileNames: Iterable<string>,
  now = new Date(),
): { rows: BulkRow[]; error?: string } {
  const [header, ...body] = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!header) return { rows: [], error: "The CSV is empty." };
  const cols = header.map((h) => h.trim().toLowerCase());
  const missing = BULK_COLUMNS.filter((c) => !cols.includes(c));
  if (missing.length) return { rows: [], error: `Missing column(s): ${missing.join(", ")}` };

  const files = new Set(fileNames);
  const schema = paperInputSchema(now);
  const seen = new Map<string, number>();
  const rows = body.map((cells, i): BulkRow => {
    const line = i + 2; // 1-based, after the header
    const rec = Object.fromEntries(cols.map((c, j) => [c, cells[j]?.trim() ?? ""]));
    const file = rec.file ?? "";
    const errors: string[] = [];
    if (!file) errors.push("No file name");
    else if (!files.has(file)) errors.push(`File "${file}" is not among the selected PDFs`);

    const parsed = schema.safeParse(rec);
    if (!parsed.success) {
      errors.push(...Object.values(firstIssues(parsed.error)));
      return { line, file, ok: false, errors };
    }
    const key = `${parsed.data.course_code}|${parsed.data.term}|${parsed.data.year}`;
    const prev = seen.get(key);
    if (prev) errors.push(`Same course/term/year as line ${prev}`);
    else seen.set(key, line);
    return errors.length
      ? { line, file, ok: false, errors }
      : { line, file, ok: true, input: parsed.data };
  });
  return { rows };
}

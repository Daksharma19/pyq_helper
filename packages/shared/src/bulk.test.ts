import { describe, expect, it } from "vitest";
import { parseBulkCsv, parseCsv } from "./bulk";

const now = new Date("2026-09-29");
const header = "file,course_code,term,year,total_marks,num_questions";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and blank lines", () => {
    expect(parseCsv('a,"b,c","say ""hi"""\r\n\r\n1,2,3')).toEqual([
      ["a", "b,c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });
});

describe("parseBulkCsv", () => {
  it("validates rows and matches them to selected files", () => {
    const csv = [
      header,
      "ds-t1.pdf,18B11EC213,T1,2025,20,5",
      "missing.pdf,18B11EC213,T2,2025,20,5",
      "ds-t3.pdf,18B11EC213,T3,2030,35,6",
    ].join("\n");
    const { rows, error } = parseBulkCsv(csv, ["ds-t1.pdf", "ds-t3.pdf"], now);
    expect(error).toBeUndefined();
    expect(rows.map((r) => r.ok)).toEqual([true, false, false]);
    expect(rows[1]).toMatchObject({ line: 3, errors: [expect.stringContaining("missing.pdf")] });
    expect(rows[2]).toMatchObject({ errors: ["Year can't be in the future"] });
  });

  it("accepts any column order and flags repeated papers", () => {
    const csv = [
      "year,term,course_code,file,num_questions,total_marks",
      "2025,T1,18B11EC213,a.pdf,5,20",
      "2025,T1,18b11ec213,b.pdf,5,20",
    ].join("\n");
    const { rows } = parseBulkCsv(csv, ["a.pdf", "b.pdf"], now);
    expect(rows[0]?.ok).toBe(true);
    expect(rows[1]).toMatchObject({ ok: false, errors: ["Same course/term/year as line 2"] });
  });

  it("ignores a UTF-8 BOM (Excel exports)", () => {
    const csv = `${String.fromCharCode(0xfeff)}${header}\na.pdf,18B11EC213,T1,2025,20,5`;
    expect(parseBulkCsv(csv, ["a.pdf"], now).rows[0]?.ok).toBe(true);
  });

  it("reports missing columns", () => {
    expect(parseBulkCsv(`file,course_code\n`, [], now).error).toMatch(/term/);
  });
});

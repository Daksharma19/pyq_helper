import { describe, expect, it } from "vitest";
import { courseInputSchema, looksLikePdf, paperInputSchema } from "./admin";

const now = new Date("2026-09-29");

describe("paperInputSchema", () => {
  const schema = paperInputSchema(now);
  const valid = {
    course_code: "18b11ec213",
    term: "T2",
    year: "2025",
    total_marks: "20",
    num_questions: "5",
  };

  it("coerces and normalises form values", () => {
    expect(schema.parse(valid)).toEqual({
      course_code: "18B11EC213",
      term: "T2",
      year: 2025,
      total_marks: 20,
      num_questions: 5,
    });
  });

  it("rejects future years, bad terms and non-positive counts", () => {
    expect(schema.safeParse({ ...valid, year: "2027" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, year: "2026" }).success).toBe(true);
    expect(schema.safeParse({ ...valid, term: "T4" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, total_marks: "0" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, num_questions: "abc" }).success).toBe(false);
  });
});

describe("courseInputSchema", () => {
  it("defaults program, trims and validates the code", () => {
    expect(courseInputSchema.parse({ code: "15b11ci111", title: " SDF ", semester: "1" })).toEqual({
      code: "15B11CI111",
      title: "SDF",
      program: "B.Tech",
      semester: 1,
    });
    expect(courseInputSchema.safeParse({ code: "CS101", title: "x", semester: 1 }).success).toBe(
      false,
    );
  });
});

describe("looksLikePdf", () => {
  it("checks magic bytes", () => {
    expect(looksLikePdf(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
    expect(looksLikePdf(new TextEncoder().encode("<html>"))).toBe(false);
  });
});

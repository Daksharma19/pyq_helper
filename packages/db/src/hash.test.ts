import { describe, expect, it } from "vitest";
import { paperHash, paperKeyString } from "./hash";

describe("paperHash", () => {
  it("matches the database's generated papers.paper_hash", () => {
    // Value read from Postgres: select paper_hash from papers where course_code='15B11CI111'
    // and term='T1' and year=2024. If this fails, the TS and SQL definitions have drifted.
    expect(paperHash({ course_code: "15B11CI111", term: "T1", year: 2024 })).toBe(
      "1420a0f291cce1b0d500f98b17a125af1ee01dfa29bae3d5b37a1691b655e8d9",
    );
  });

  it("normalises the course code and depends on every key field", () => {
    expect(paperKeyString({ course_code: " 15b11ma301 ", term: "T3", year: 2016 })).toBe(
      "15B11MA301|T3|2016",
    );
    const base = paperHash({ course_code: "15B11MA301", term: "T3", year: 2016 });
    expect(paperHash({ course_code: "15B11MA301", term: "T3", year: 2018 })).not.toBe(base);
    expect(paperHash({ course_code: "15B11MA301", term: "T2", year: 2016 })).not.toBe(base);
  });
});

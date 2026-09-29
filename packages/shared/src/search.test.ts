import { describe, expect, it } from "vitest";
import { searchCourses, searchWords } from "./search";

const courses = [
  { code: "15B11CI111", title: "Software Development Fundamentals-I" },
  { code: "15B11MA111", title: "Mathematics-1" },
  { code: "15B11MA211", title: "Mathematics-2" },
  { code: "15B11PH111", title: "Physics-1" },
  { code: "18B11EC213", title: "Digital Systems" },
  { code: "15B11CI311", title: "Data Structures" },
  { code: "15B11MA301", title: "Probability and Random Processes" },
  { code: "15B11CI412", title: "Operating Systems and Systems Programming" },
];
const find = (q: string) => searchCourses(courses, q);

describe("searchWords", () => {
  it("normalises case, punctuation and Roman numerals", () => {
    expect(searchWords("  Probability & Random-Processes II ")).toEqual([
      "probability",
      "random",
      "processes",
      "2",
    ]);
    expect(searchWords("")).toEqual([]);
  });
});

describe("searchCourses", () => {
  it("matches parts of the subject name, case-insensitively", () => {
    expect(find("digital")).toEqual(["18B11EC213"]);
    expect(find("random process")).toEqual(["15B11MA301"]);
    expect(find("SYSTEMS")).toEqual(["18B11EC213", "15B11CI412"]);
  });

  it("matches acronyms students use", () => {
    expect(find("PRP")).toEqual(["15B11MA301"]);
    expect(find("sdf")).toEqual(["15B11CI111"]);
    // Ambiguous acronyms return every match: Digital Systems and Data Structures.
    expect(find("ds")).toEqual(["18B11EC213", "15B11CI311"]);
    expect(find("data structures")).toEqual(["15B11CI311"]);
  });

  it("treats numbers precisely, including Roman numerals", () => {
    expect(find("mathematics 1")).toEqual(["15B11MA111"]);
    expect(find("maths 2")).toEqual(["15B11MA211"]);
    expect(find("sdf 1")).toEqual(["15B11CI111"]);
    expect(find("sdf1")).toEqual(["15B11CI111"]);
  });

  it("matches course codes and parts of them", () => {
    expect(find("18b11ec213")).toEqual(["18B11EC213"]);
    expect(find("ec213")).toEqual(["18B11EC213"]);
  });

  it("requires every word and returns everything for an empty query", () => {
    expect(find("physics digital")).toEqual([]);
    expect(find("zoology")).toEqual([]);
    expect(find("")).toHaveLength(courses.length);
  });
});

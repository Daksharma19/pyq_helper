import { describe, expect, it } from "vitest";
import { paperFileName } from "./queries";

describe("paperFileName", () => {
  it("builds a readable download name", () => {
    expect(paperFileName({ course_code: "18B11EC213", term: "T2", year: 2024 })).toBe(
      "18B11EC213_2024_T2.pdf",
    );
  });
});

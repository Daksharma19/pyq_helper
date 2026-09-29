import { describe, expect, it } from "vitest";
import { paperFileName } from "./queries";
import { newStoragePath } from "./admin";

describe("paperFileName", () => {
  it("builds a readable download name", () => {
    expect(paperFileName({ course_code: "18B11EC213", term: "T2", year: 2024 })).toBe(
      "18B11EC213_2024_T2.pdf",
    );
  });
});

describe("newStoragePath", () => {
  it("groups by course and is unique per upload", () => {
    expect(newStoragePath({ course_code: "18B11EC213", term: "T1", year: 2025 }, "abc")).toBe(
      "18B11EC213/2025-T1-abc.pdf",
    );
  });
});

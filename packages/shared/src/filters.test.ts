import { describe, expect, it } from "vitest";
import { filtersToSearchParams, parseBrowseFilters } from "./filters";

describe("parseBrowseFilters", () => {
  it("parses valid params", () => {
    expect(
      parseBrowseFilters({ semester: "3", course: "18b11ec213", term: "T2", year: "2024" }),
    ).toEqual({ semester: 3, course: "18B11EC213", term: "T2", year: 2024 });
  });

  it("drops empty and invalid values instead of throwing", () => {
    expect(
      parseBrowseFilters({ semester: "9", course: "nope", term: "T4", year: "" }),
    ).toEqual({});
  });

  it("takes the first value of repeated params", () => {
    expect(parseBrowseFilters({ term: ["T3", "T1"] })).toEqual({ term: "T3" });
  });
});

describe("filtersToSearchParams", () => {
  it("round-trips", () => {
    const f = { semester: 2, term: "T1" as const };
    expect(parseBrowseFilters(Object.fromEntries(filtersToSearchParams(f)))).toEqual(f);
  });
});

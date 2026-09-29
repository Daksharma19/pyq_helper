import { z } from "zod";
import { COURSE_CODE_RE, MIN_YEAR, TERMS } from "./domain";

/** Empty strings from HTML forms mean "no filter". Invalid values are dropped, never thrown. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    z.preprocess((v) => (v === "" ? undefined : v), schema.optional()).catch(undefined),
  );

export const browseFiltersSchema = z.object({
  semester: optional(z.coerce.number().int().min(1).max(8)),
  course: optional(
    z
      .string()
      .trim()
      .transform((s) => s.toUpperCase())
      .pipe(z.string().regex(COURSE_CODE_RE)),
  ),
  term: optional(z.enum(TERMS)),
  year: optional(z.coerce.number().int().min(MIN_YEAR).max(2100)),
});

export type BrowseFilters = z.infer<typeof browseFiltersSchema>;

export function parseBrowseFilters(
  params: Record<string, string | string[] | undefined>,
): BrowseFilters {
  return browseFiltersSchema.parse(params);
}

/** Serialize filters back to a query string, skipping empty ones. */
export function filtersToSearchParams(filters: BrowseFilters): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined) sp.set(k, String(v));
  }
  return sp;
}

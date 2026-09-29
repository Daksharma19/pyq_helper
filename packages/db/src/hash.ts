import { createHash } from "node:crypto";
import type { Term } from "@pyq/shared";

/** The fields that make a paper unique. */
export type PaperKey = { course_code: string; term: Term; year: number };

/** Canonical hash input, e.g. "15B11MA301|T3|2016". */
export function paperKeyString({ course_code, term, year }: PaperKey): string {
  return `${course_code.trim().toUpperCase()}|${term}|${year}`;
}

/**
 * A paper's identity and URL id: SHA-256 of its course/term/year. The database computes the
 * same value in the generated column `papers.paper_hash` (see the paper_hash migration).
 */
export function paperHash(key: PaperKey): string {
  return sha256(paperKeyString(key));
}

/** Lowercase hex SHA-256. */
export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

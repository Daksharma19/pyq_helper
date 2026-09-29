export const TERMS = ["T1", "T2", "T3"] as const;
export type Term = (typeof TERMS)[number];

export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** JIIT course codes look like 18B11EC213 / 15B11CI111 / 15B17PH171. */
export const COURSE_CODE_RE = /^\d{2}[A-Z]\d{2}[A-Z]{2}\d{3}$/;

export const MIN_YEAR = 2000;

/** A paper's URL id (paper_hash): lowercase hex SHA-256. */
export const PAPER_HASH_RE = /^[0-9a-f]{64}$/;

export type Course = {
  code: string;
  title: string;
  program: string;
  semester: number;
};

export type Paper = {
  id: string;
  course_code: string;
  term: Term;
  year: number;
  total_marks: number;
  num_questions: number;
  storage_path: string;
  /** SHA-256 of "COURSE|TERM|YEAR": the paper's identity and URL id (/papers/<paper_hash>). */
  paper_hash: string;
  /** SHA-256 of the PDF bytes: blocks storing the same file twice. */
  file_hash: string;
  published: boolean;
  created_at: Date;
  updated_at: Date;
};

export type PaperWithCourse = Paper & { course: Course };

/** What the public site needs about a paper: no internal ids, hashes of files, or timestamps. */
export type PublicPaper = Pick<
  Paper,
  "paper_hash" | "course_code" | "term" | "year" | "total_marks" | "num_questions" | "storage_path"
> & { course: Course };

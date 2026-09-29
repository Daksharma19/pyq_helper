export const TERMS = ["T1", "T2", "T3"] as const;
export type Term = (typeof TERMS)[number];

export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** JIIT course codes look like 18B11EC213 / 15B11CI111 / 15B17PH171. */
export const COURSE_CODE_RE = /^\d{2}[A-Z]\d{2}[A-Z]{2}\d{3}$/;

export const MIN_YEAR = 2000;

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
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type PaperWithCourse = Paper & { course: Course };

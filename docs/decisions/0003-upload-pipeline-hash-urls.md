# 0003: Upload pipeline, OCR, and hash-based paper URLs

**Status:** accepted (Phase 2, extends 0002)

## Context

Admins should be able to drop PDFs onto a page and have the course, term, year, marks and
question count read for them. Each paper gets a hash, computed from that extracted
information, which identifies it uniquely: it is checked against the database before storing
and used as the paper's URL (`/papers/<hash>`). Filtering uses query parameters
(`/papers?semester=3&term=T3&year=2018`).

## Two hashes

| Column       | Hash of                                             | Purpose                                                    |
| ------------ | --------------------------------------------------- | ---------------------------------------------------------- |
| `paper_hash` | `"COURSE\|TERM\|YEAR"`, e.g. `15B11MA301\|T3\|2016` | **Identity.** Unique; the duplicate check; the URL id.     |
| `file_hash`  | the PDF's bytes                                     | Unique; stops the same file being stored under other data. |

`paper_hash` is a Postgres **generated column** (`public.paper_hash(course_code, term,
year)`), so the database derives it and it can't drift from the row. `paperHash()` in
`@pyq/db` computes the same value in TypeScript for the pipeline. A unit test pins it to a
value read from Postgres, and the RLS integration test checks every row.

## Pipeline

`/admin/papers/new`, drag-and-drop or file picker; server actions `analyzePaper` → `createPaper`.

1. **Validate:** size ≤ 20 MB and `%PDF-` magic bytes.
2. **File hash:** if a paper with that `file_hash` exists, stop (duplicate file), without OCR.
3. **Read:** use the PDF's text layer when it has one (born-digital PDFs, or scans the scanner
   already OCR'd). Otherwise render pages 1–2 (unpdf + `@napi-rs/canvas`, 2× scale) and run
   **tesseract.js** OCR on them.
4. **Extract** (`extractPaperMeta` in `@pyq/shared`, pure and unit-tested on real scans): the
   course code (matched against the course list, falling back to the title), the term
   ("Test-2", "T2 Exam…", "End Term" → T3), the year ("Odd Semester-2016", else the first
   plausible year), "Max Marks", and the question count. The count is the larger of the
   highest `Q<n>` (OCR-tolerant: `QI`→1, `QS`→5, `04.`→4) and the number of `[nM]` marks
   tags. Semester comes from the course.
5. **Identity hash:** `paper_hash` from the extracted course/term/year. If that paper exists,
   it's shown as a duplicate with a link.
6. **Admin review:** fields read from the PDF are outlined green, missing ones amber, and OCR
   results are flagged "check carefully". Nothing is stored until **Save** (or **Save all**).
7. **Store:** `createPaper` re-validates everything, **recomputes both hashes on the server**
   (never trusted from the client), re-checks both duplicates, uploads the PDF, then inserts.
   Unique constraints on both hashes turn races into a friendly duplicate error.

## URLs

`/papers/<paper_hash>` (public) and `/admin/papers/<paper_hash>` (admin); admin actions
address papers by `paper_hash`. The uuid primary key stays internal. Malformed ids return 404.

## Consequences

- **Replacing a PDF keeps the URL** (only `file_hash` changes). **Correcting course, term or
  year changes the identity and therefore the URL.** The edit page redirects to the new one,
  and the old link returns 404. That's acceptable: the old URL named a different paper.
- OCR runs in the Next.js server process with one shared Tesseract worker, about 5–15 s per
  page. English data is downloaded once into `apps/web/.cache/tesseract` (gitignored). pdf.js
  rendering blocks the event loop while it runs, so the pipeline never holds a DB transaction
  across OCR. That's fine for a few admins. For student uploads (Phase 3), move steps 3–4 into
  the planned Python pipeline service (`apps/pipeline`) behind a queue. The extraction rules are
  pure functions, so porting them is straightforward.
- Why tesseract.js and not system Tesseract or a cloud OCR API: it needs no system install
  (works on Windows dev machines and in plain Node hosting), no API keys, and data never leaves
  the server.

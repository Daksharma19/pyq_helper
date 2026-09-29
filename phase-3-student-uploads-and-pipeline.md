# Phase 3: Student uploads and the validation pipeline

Read `CLAUDE.md` and the existing code. Plan first and record the pipeline design in a decision note.

**Goal:** students can contribute papers, and only correct, non-duplicate ones go public.

- Student login (college Google accounts is the likely default). Browsing stays public.
- Upload page accepting a PDF or phone photos, and a "my uploads" page showing status and rejection reasons.
- Add `apps/pipeline` (Python) to the monorepo, wired into turbo tasks and CI. For each submission it should:
  - check it is really an exam paper, readable, and within limits
  - turn photos into one clean PDF
  - read and fill in the metadata, and check it against the course list
  - catch duplicates, including the same paper uploaded as different files
- An admin review queue with everything pre-filled, so approving takes one click. Nothing is public until approved.
- Basic abuse protection (rate limits, file limits).

You choose how jobs are triggered and how extraction works; tell me the trade-offs in the plan.

Done when a student's photo upload becomes a clean, correctly tagged public paper after one admin click, and a re-upload of the same paper is caught.

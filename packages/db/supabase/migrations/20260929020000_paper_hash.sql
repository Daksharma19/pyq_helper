-- Paper identity: a hash of the metadata that makes a paper unique (course + term + year).
-- It is the paper's id in URLs (/papers/<paper_hash>) and the upload pipeline's duplicate
-- check. The DB computes it, so it always matches the row.
--
-- Canonical input: '<COURSE_CODE>|<TERM>|<YEAR>', e.g. '15B11MA301|T3|2016'.
-- Must stay in sync with paperHash() in apps/web/src/lib/pipeline.ts (covered by a test).
-- Declared immutable (enum-to-text casts are only "stable" in general, but exam_term's
-- labels are fixed), which generated columns require.
create function public.paper_hash(course_code text, term public.exam_term, year smallint)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select encode(extensions.digest(course_code || '|' || term::text || '|' || year::text, 'sha256'), 'hex');
$$;

alter table public.papers
  add column paper_hash text not null unique
    generated always as (public.paper_hash(course_code, term, year)) stored,
  -- SHA-256 of the PDF bytes: the same file can't be stored twice under different metadata.
  add column file_hash text not null unique check (file_hash ~ '^[0-9a-f]{64}$');

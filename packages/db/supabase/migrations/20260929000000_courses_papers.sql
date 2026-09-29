-- Courses: source of truth for valid course codes and titles.
create table public.courses (
  code text primary key check (code ~ '^\d{2}[A-Z]\d{2}[A-Z]{2}\d{3}$'),
  title text not null check (length(trim(title)) > 0),
  program text not null default 'B.Tech',
  semester smallint not null check (semester between 1 and 8)
);

create type public.exam_term as enum ('T1', 'T2', 'T3');

create table public.papers (
  id uuid primary key default gen_random_uuid(),
  course_code text not null references public.courses (code) on update cascade,
  term public.exam_term not null,
  year smallint not null check (year between 2000 and 2100),
  total_marks smallint not null check (total_marks > 0),
  num_questions smallint not null check (num_questions > 0),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  -- A paper is unique by course + term + year.
  constraint papers_course_term_year_key unique (course_code, term, year)
);

create index papers_year_idx on public.papers (year desc);
create index papers_created_at_idx on public.papers (created_at desc);

-- Public read-only access. No write policies: writes only via service role (admin, Phase 2).
alter table public.courses enable row level security;
alter table public.papers enable row level security;

create policy "courses are public" on public.courses for select to anon, authenticated using (true);
create policy "papers are public" on public.papers for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.courses, public.papers from anon, authenticated;

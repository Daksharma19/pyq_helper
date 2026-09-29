-- Phase 2: admin role, publish flag, admin-only writes (RLS on tables and storage).

-- Admins are auth users listed here. Grant with:
--   insert into public.admins (user_id) select id from auth.users where email = '...';
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- security definer so policies can read admins without exposing the table.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Unpublished papers are hidden from the public but visible to admins.
alter table public.papers add column published boolean not null default true;
alter table public.papers add column updated_at timestamptz not null default now();

drop policy "papers are public" on public.papers;
create policy "published papers are public" on public.papers
  for select to anon, authenticated using (published or (select public.is_admin()));

-- Admin writes. Grants are re-added for authenticated only; RLS narrows them to admins.
grant insert, update, delete on public.courses, public.papers to authenticated;

create policy "admins insert courses" on public.courses
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins update courses" on public.courses
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete courses" on public.courses
  for delete to authenticated using ((select public.is_admin()));

create policy "admins insert papers" on public.papers
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins update papers" on public.papers
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete papers" on public.papers
  for delete to authenticated using ((select public.is_admin()));

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger papers_touch_updated_at before update on public.papers
  for each row execute function public.touch_updated_at();

-- Storage: the bucket stays public-read; only admins may write.
create policy "admins upload papers" on storage.objects
  for insert to authenticated with check (bucket_id = 'papers' and (select public.is_admin()));
create policy "admins update paper files" on storage.objects
  for update to authenticated using (bucket_id = 'papers' and (select public.is_admin()));
create policy "admins delete paper files" on storage.objects
  for delete to authenticated using (bucket_id = 'papers' and (select public.is_admin()));
-- Upsert/remove need to see the object row.
create policy "admins read paper files" on storage.objects
  for select to authenticated using (bucket_id = 'papers' and (select public.is_admin()));

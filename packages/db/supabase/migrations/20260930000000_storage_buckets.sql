-- Buckets are created here (not only in config.toml) so a hosted project gets them from
-- `db push`, exactly like local.

-- Public paper PDFs. Write policies are in 20260929010000_admin.sql.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('papers', 'papers', true, 20971520, array['application/pdf'])
on conflict (id) do nothing;

-- Private staging area for admin uploads. The browser uploads the raw file here, then the
-- server action reads it back by path, so large files never pass through a request body
-- (Vercel caps those at 4.5 MB). Any type is allowed: the server detects and converts it.
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', false, 20971520)
on conflict (id) do nothing;

create policy "admins stage uploads" on storage.objects
  for insert to authenticated with check (bucket_id = 'uploads' and (select public.is_admin()));
create policy "admins read staged uploads" on storage.objects
  for select to authenticated using (bucket_id = 'uploads' and (select public.is_admin()));
create policy "admins delete staged uploads" on storage.objects
  for delete to authenticated using (bucket_id = 'uploads' and (select public.is_admin()));

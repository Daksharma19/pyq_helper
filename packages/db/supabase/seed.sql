-- Local-only sample data (runs after courses.sql on `db reset`). Never applied to a hosted
-- project: db:deploy loads only courses.sql.

-- file_hash = sha256 of the file in seed-papers/ (re-run `sha256sum` if seed:pdfs regenerates them).
insert into public.papers (course_code, term, year, total_marks, num_questions, storage_path, file_hash) values
  ('18B11EC213', 'T1', 2024, 20, 5, '18B11EC213/2024-T1.pdf',
   'e412dfeacd032ae4776cf4050718918d90a1263c8064a610399d713e59a1b48c'),
  ('18B11EC213', 'T2', 2024, 20, 5, '18B11EC213/2024-T2.pdf',
   '82bca200d788ddabe28e4926996a90848675b017d8d5dd16b7faa37fbbae2ca9'),
  ('18B11EC213', 'T3', 2023, 35, 6, '18B11EC213/2023-T3.pdf',
   '76fb8a458c5c4a764fe409e3431baaf06c818d7452de22c9d29f5ef017215b67'),
  ('15B11CI111', 'T1', 2024, 20, 4, '15B11CI111/2024-T1.pdf',
   'dfba7e00821ae115afae9d73b5b6700bc8411aa82bb8385caec69d206a4920c4'),
  ('15B11MA111', 'T3', 2023, 35, 7, '15B11MA111/2023-T3.pdf',
   '9bc83a1f7e1e1305a1a821b307de5299a088ac20a79efe7f444fc9d171f49372'),
  ('15B11CI311', 'T2', 2025, 20, 5, '15B11CI311/2025-T2.pdf',
   '1002a1fe2f5b20475ebb537e82e8de535604afded9d80a44728567e0967d6631'),
  ('15B11CI412', 'T3', 2025, 35, 6, '15B11CI412/2025-T3.pdf',
   'd346e2dc7c50a6a68403fac18215710d82a51840f29736d9358879b2d4b7c6e2');

-- Local-only admin account (see README). Never run against a hosted project with these values.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'admin@pyq.test', extensions.crypt('pyq-admin-local', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  '{"sub":"a0000000-0000-4000-8000-000000000001","email":"admin@pyq.test","email_verified":true}',
  'email', now(), now(), now()
);
insert into public.admins (user_id) values ('a0000000-0000-4000-8000-000000000001');

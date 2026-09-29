-- Real JIIT Noida B.Tech courses (codes/titles to be verified against the official list).
insert into public.courses (code, title, semester) values
  ('15B11CI111', 'Software Development Fundamentals-I', 1),
  ('15B11MA111', 'Mathematics-1', 1),
  ('15B11PH111', 'Physics-1', 1),
  ('15B11EC111', 'Electrical Science-1', 1),
  ('15B11CI211', 'Software Development Fundamentals-II', 2),
  ('15B11MA211', 'Mathematics-2', 2),
  ('15B11PH211', 'Physics-2', 2),
  ('18B11EC213', 'Digital Systems', 2),
  ('15B11CI311', 'Data Structures', 3),
  ('15B11CI312', 'Database Systems', 3),
  ('15B11MA301', 'Probability and Random Processes', 3),
  ('15B11CI313', 'Computer Organisation and Architecture', 3),
  ('15B11CI411', 'Algorithms and Problem Solving', 4),
  ('15B11CI412', 'Operating Systems and Systems Programming', 4),
  ('15B11CI513', 'Software Engineering', 5),
  ('15B11CI514', 'Artificial Intelligence', 5);

insert into public.papers (course_code, term, year, total_marks, num_questions, storage_path) values
  ('18B11EC213', 'T1', 2024, 20, 5, '18B11EC213/2024-T1.pdf'),
  ('18B11EC213', 'T2', 2024, 20, 5, '18B11EC213/2024-T2.pdf'),
  ('18B11EC213', 'T3', 2023, 35, 6, '18B11EC213/2023-T3.pdf'),
  ('15B11CI111', 'T1', 2024, 20, 4, '15B11CI111/2024-T1.pdf'),
  ('15B11MA111', 'T3', 2023, 35, 7, '15B11MA111/2023-T3.pdf'),
  ('15B11CI311', 'T2', 2025, 20, 5, '15B11CI311/2025-T2.pdf'),
  ('15B11CI412', 'T3', 2025, 35, 6, '15B11CI412/2025-T3.pdf');

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

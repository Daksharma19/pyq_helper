-- The course list. Seeded locally (db reset) and on hosted projects (db:deploy).
-- Safe to re-run: existing courses are left as they are.
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
  ('15B11CI514', 'Artificial Intelligence', 5)
on conflict (code) do nothing;

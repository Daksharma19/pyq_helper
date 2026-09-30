-- Course codes can be any format (not only JIIT's 18B11EC213 shape): uppercase letters,
-- digits and dashes, 2 to 30 characters. Mirrors COURSE_CODE_RE in packages/shared.
alter table public.courses drop constraint if exists courses_code_check;
alter table public.courses
  add constraint courses_code_check check (code ~ '^[A-Z0-9][A-Z0-9-]{1,29}$');

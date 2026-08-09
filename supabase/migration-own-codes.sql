-- Charlie's Class — migration: students choose their own secret code.
-- Run once in Supabase → SQL Editor → paste → Run. Safe to run twice.
--
-- Before: every student had a pre-assigned 4-digit code printed on a card.
-- After : code starts empty; the student sets it on first login; the teacher
--         can clear it (admin 🔑) so they can set a new one.
--
-- It also adds code_set, a read-only true/false column. The website reads
-- code_set and never the code itself, so no browser is handed the class's
-- passwords.

-- 1. the code may now be empty
alter table public.students alter column code drop not null;

-- 2. drop the old rules about code (unique, and the 4-digit-always check).
--    Found by definition so this works whatever Supabase named them.
do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.students'::regclass
       and contype in ('u','c')
       and pg_get_constraintdef(oid) ilike '%code%'
  loop
    execute format('alter table public.students drop constraint %I', c.conname);
  end loop;
end $$;

-- 3. a code, when there is one, is still exactly 4 digits.
--    Codes are NOT unique any more: two students may happen to pick the same
--    one, and that is fine — logging in needs the right name as well.
alter table public.students
  add constraint students_code_format check (code is null or code ~ '^[0-9]{4}$');

-- 4. clear the codes that were assigned by the old version
update public.students set code = null;

-- 5. "has this student chosen a code yet?" — the only thing the site reads
alter table public.students drop column if exists code_set;
alter table public.students
  add column code_set boolean generated always as (code is not null) stored;

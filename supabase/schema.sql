-- Charlie's Class — schema + seed for a fresh Supabase project.
-- Run once: SQL Editor → paste → Run.
-- (An existing database from the first version should run
--  migration-own-codes.sql instead.)
--
-- Secret codes are chosen by the students themselves on first login, so no
-- code is seeded here. code_set is what the website reads — it never asks
-- for the code column, so no browser receives the class's passwords.

create table if not exists public.students (
  id         text primary key,
  name       text not null,
  gender     text not null check (gender in ('boy','girl')),
  code       text check (code is null or code ~ '^[0-9]{4}$'),
  code_set   boolean generated always as (code is not null) stored,
  emoji      text not null default '',
  money      numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Classroom-simple access: the publishable key may read and write.
-- (Fine for a class game with play money; can be tightened later with
-- teacher auth — see README "Security notes".)
alter table public.students enable row level security;

drop policy if exists "students read"   on public.students;
drop policy if exists "students insert" on public.students;
drop policy if exists "students update" on public.students;
drop policy if exists "students delete" on public.students;

create policy "students read"   on public.students for select using (true);
create policy "students insert" on public.students for insert with check (true);
create policy "students update" on public.students for update using (true);
create policy "students delete" on public.students for delete using (true);

-- Live updates (money changing during games, roster edits on other screens)
do $$
begin
  alter publication supabase_realtime add table public.students;
exception when duplicate_object then null;
end $$;

-- Seed: the class from names.png (first names only; 15 boys, 10 girls).
insert into public.students (id, name, gender) values
  ('cj-rapata', 'CJ', 'boy'),
  ('dipesh-kc', 'Dipesh', 'boy'),
  ('dwayne-tulipa', 'Dwayne', 'boy'),
  ('jason-lin', 'Jason', 'boy'),
  ('jonas-roncales', 'Jonas', 'boy'),
  ('joses-gan', 'Joses', 'boy'),
  ('kiean-oabel', 'Kiean', 'boy'),
  ('kraven-alavisi', 'Kraven', 'boy'),
  ('kriskurt-pamint', 'Kriskurt', 'boy'),
  ('kristoff-yu', 'Kristoff', 'boy'),
  ('nathy-sumner', 'Nathy', 'boy'),
  ('rj-banico', 'RJ', 'boy'),
  ('samarjot-rehill', 'Samarjot', 'boy'),
  ('shivansh-reddy', 'Shivansh', 'boy'),
  ('tepono-montg', 'Tepono', 'boy'),
  ('aleia-de-loyola', 'Aleia', 'girl'),
  ('arabelle-cho', 'Arabelle', 'girl'),
  ('chenlee-rizzy', 'Chenlee', 'girl'),
  ('diwani-kc', 'Diwani', 'girl'),
  ('jayarna-may-t', 'Jayarna-May', 'girl'),
  ('karla-fawcett', 'Karla', 'girl'),
  ('resalyn-vargas', 'Resalyn', 'girl'),
  ('sam-carbonqui', 'Sam', 'girl'),
  ('venuli-gedara', 'Venuli', 'girl'),
  ('willow-kolo', 'Willow', 'girl')
on conflict (id) do nothing;

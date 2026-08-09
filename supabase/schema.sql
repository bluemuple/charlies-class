-- Charlie's Class — Supabase schema + seed.
-- Run this once in your Supabase project: SQL Editor → paste → Run.
-- The seed codes below MUST match js/roster.js (they are the printed cards).

create table if not exists public.students (
  id         text primary key,
  name       text not null,
  gender     text not null check (gender in ('boy','girl')),
  code       text not null unique check (code ~ '^[0-9]{4}$'),
  emoji      text not null default '',
  money      numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Classroom-simple access: the public anon key may read and write.
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
insert into public.students (id, name, gender, code) values
  ('cj-rapata', 'CJ', 'boy', '6291'),
  ('dipesh-kc', 'Dipesh', 'boy', '1797'),
  ('dwayne-tulipa', 'Dwayne', 'boy', '6815'),
  ('jason-lin', 'Jason', 'boy', '1074'),
  ('jonas-roncales', 'Jonas', 'boy', '8788'),
  ('joses-gan', 'Joses', 'boy', '1887'),
  ('kiean-oabel', 'Kiean', 'boy', '7899'),
  ('kraven-alavisi', 'Kraven', 'boy', '2565'),
  ('kriskurt-pamint', 'Kriskurt', 'boy', '1011'),
  ('kristoff-yu', 'Kristoff', 'boy', '7842'),
  ('nathy-sumner', 'Nathy', 'boy', '2792'),
  ('rj-banico', 'RJ', 'boy', '7290'),
  ('samarjot-rehill', 'Samarjot', 'boy', '5435'),
  ('shivansh-reddy', 'Shivansh', 'boy', '1732'),
  ('tepono-montg', 'Tepono', 'boy', '6004'),
  ('aleia-de-loyola', 'Aleia', 'girl', '9678'),
  ('arabelle-cho', 'Arabelle', 'girl', '9087'),
  ('chenlee-rizzy', 'Chenlee', 'girl', '4254'),
  ('diwani-kc', 'Diwani', 'girl', '5732'),
  ('jayarna-may-t', 'Jayarna-May', 'girl', '1045'),
  ('karla-fawcett', 'Karla', 'girl', '6207'),
  ('resalyn-vargas', 'Resalyn', 'girl', '4980'),
  ('sam-carbonqui', 'Sam', 'girl', '8885'),
  ('venuli-gedara', 'Venuli', 'girl', '5711'),
  ('willow-kolo', 'Willow', 'girl', '8692')
on conflict (id) do nothing;

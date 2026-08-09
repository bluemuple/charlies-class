-- Charlie's Class — migration: Algebra Machine game.
-- Run once in Supabase → SQL Editor → paste → Run. Safe to run twice.
--
-- Adds: per-student prizes (items) and rule-guess history (guesses),
-- plus the machines table that holds live game sessions.

-- 1. what each student owns / has tried
alter table public.students add column if not exists items   jsonb not null default '[]';
alter table public.students add column if not exists guesses jsonb not null default '[]';

-- 2. live game sessions — one row per machine, whole game in `data`
create table if not exists public.machines (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.machines enable row level security;

drop policy if exists "machines read"   on public.machines;
drop policy if exists "machines insert" on public.machines;
drop policy if exists "machines update" on public.machines;
drop policy if exists "machines delete" on public.machines;

create policy "machines read"   on public.machines for select using (true);
create policy "machines insert" on public.machines for insert with check (true);
create policy "machines update" on public.machines for update using (true);
create policy "machines delete" on public.machines for delete using (true);

-- live updates while the class plays
do $$
begin
  alter publication supabase_realtime add table public.machines;
exception when duplicate_object then null;
end $$;

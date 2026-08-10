-- Charlie's Class: student profile extras (favourite music, hobby)
-- Run once in the Supabase SQL editor. Safe to re-run.
alter table public.students add column if not exists profile jsonb;

-- Charlie's Class — migration: the Pet Shop.
-- Run once in Supabase → SQL Editor → paste → Run. Safe to run twice.
-- Each student may own one pet: {type: 1-6, name, affection, powers: []}
alter table public.students add column if not exists pet jsonb;

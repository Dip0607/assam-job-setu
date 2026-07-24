-- =====================================================================
--  Assam Job Setu — database setup
--  Run this ONCE in: Supabase dashboard -> SQL Editor -> New query -> Run
--  Project: mwbjtpqhlomxgtyvanhg
-- =====================================================================

-- ---------------------------------------------------------------
-- 1) profiles table
--    PRIVACY (DPDP Act): we store birth_year, NOT full date of birth.
--    Collect the minimum needed for the eligibility filter, nothing more.
--    No name, no address, no phone.
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  birth_year  int,
  education   text,
  category    text,          -- caste/PwD category: SENSITIVE personal data
  domicile    text,
  district    text,
  saved_jobs  jsonb default '[]'::jsonb,
  updated_at  timestamptz default now()
);

-- ---------------------------------------------------------------
-- 2) ROW LEVEL SECURITY  <-- DO NOT SKIP
--    Without this, ANY visitor could read EVERY user's caste and age.
--    That is a data breach under India's DPDP Act.
-- ---------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "own profile delete" on public.profiles;

create policy "own profile read"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "own profile insert"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "own profile update"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Required for the "delete my data" button (DPDP right to erasure)
create policy "own profile delete"
  on public.profiles for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- 3) keep updated_at honest
-- ---------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- 4) verify (should return one row: profiles, rowsecurity = true)
-- ---------------------------------------------------------------
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'profiles';

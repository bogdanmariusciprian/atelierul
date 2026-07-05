-- =========================================================
-- Migration 0001 — Foundation: profiles, roles, security (RLS)
--
-- This is the base every other table hangs off. It creates:
--   1) a `profiles` row per real user (username / name / avatar / role)
--   2) a trigger that auto-creates that profile on sign-up and sets the
--      role from the e-mail (admin = the teacher, everyone else = member)
--   3) a trigger that locks the `role` column (nobody can promote himself)
--   4) Row Level Security policies (who may read / change what)
--   5) explicit Data API grants (we turned "auto-expose" OFF on purpose)
--
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE
-- / DROP ... IF EXISTS before CREATE).
-- =========================================================

-- ---------------------------------------------------------
-- 1) PROFILES TABLE
-- One row per authenticated user. NOTE: no e-mail column here — the
-- e-mail lives in the private auth.users table and is never exposed.
-- Works for BOTH sign-in methods:
--   • Google         → display_name comes from the Google account
--   • local account  → the pupil picks a username + password (a synthetic
--                       e-mail is generated behind the scenes, unseen)
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique,                       -- chosen by local accounts
  display_name text not null default 'Membru',
  avatar_color text not null default '#7c3aed',
  status_line  text,                              -- short bio line (leaderboard)
  role         text not null default 'member'
               check (role in ('admin', 'member')),
  created_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile per authenticated user. Role is DERIVED from e-mail, never chosen by the client.';

-- ---------------------------------------------------------
-- 2) AUTO-CREATE PROFILE ON SIGN-UP
-- Runs with elevated rights (security definer) so it can insert even
-- though clients cannot. The role is decided here, server-side.
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_email constant text := 'bogdanmariusciprian@gmail.com';
  uname text;
  dname text;
begin
  uname := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  dname := coalesce(
             nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
             nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), -- Google
             nullif(trim(new.raw_user_meta_data ->> 'name'), ''),      -- Google
             uname,
             'Membru'
           );

  insert into public.profiles (id, username, display_name, role)
  values (
    new.id,
    uname,
    dname,
    case when lower(new.email) = admin_email then 'admin' else 'member' end
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- 3) LOCK THE ROLE COLUMN (defense in depth)
-- Even the owner of a profile cannot flip his own `role` through the API.
-- Only an existing admin may change a role.
-- ---------------------------------------------------------
create or replace function public.lock_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    ) then
      new.role := old.role;   -- silently ignore the attempted change
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_role on public.profiles;
create trigger lock_role
  before update on public.profiles
  for each row execute function public.lock_profile_role();

-- ---------------------------------------------------------
-- 4) ROW LEVEL SECURITY
-- ---------------------------------------------------------
alter table public.profiles enable row level security;

-- READ: anyone (even signed-out visitors) may read profiles — needed for
-- the public leaderboard, community feed and author names. Nothing
-- sensitive lives in this table.
drop policy if exists profiles_read_all on public.profiles;
create policy profiles_read_all
  on public.profiles
  for select
  using (true);

-- UPDATE: a user may edit ONLY his own profile (cosmetic fields). The
-- `role` column stays protected by the lock_role trigger above.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- (No INSERT / DELETE policies on purpose: inserts happen only via the
--  secure sign-up trigger; deletes cascade when the auth user is removed.
--  Clients therefore cannot insert or delete profiles directly.)

-- ---------------------------------------------------------
-- 5) DATA API GRANTS
-- Because "auto-expose new tables" is OFF, we grant API access by hand.
-- RLS above still decides which ROWS each role actually sees.
-- ---------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

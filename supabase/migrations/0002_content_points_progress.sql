-- =========================================================
-- Migration 0002 — Content slice 1: lesson progress + points + leaderboard
--
-- Points are CHEAT-SAFE: the browser never inserts points directly. It calls
-- the SECURITY DEFINER function complete_lesson(), which validates and awards
-- server-side. profiles.points is a maintained mirror of the points_ledger
-- (the append-only source of truth) so the leaderboard is a cheap sort.
-- =========================================================

-- profiles gains a running points total (mirror of the ledger below).
alter table public.profiles
  add column if not exists points integer not null default 0;

-- ---------------------------------------------------------
-- 1) POINTS LEDGER — append-only source of truth
-- ---------------------------------------------------------
create table if not exists public.points_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  delta      integer not null,
  reason     text,
  created_at timestamptz not null default now()
);
create index if not exists points_ledger_user_idx on public.points_ledger (user_id);

-- Keep profiles.points in sync whenever a ledger row is added.
create or replace function public.apply_points_delta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set points = points + new.delta where id = new.user_id;
  return new;
end; $$;

drop trigger if exists points_ledger_sync on public.points_ledger;
create trigger points_ledger_sync
  after insert on public.points_ledger
  for each row execute function public.apply_points_delta();

-- ---------------------------------------------------------
-- 2) LESSON PROGRESS — which lessons each user finished
-- ---------------------------------------------------------
create table if not exists public.lesson_progress (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  lesson_slug  text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_slug)
);

-- ---------------------------------------------------------
-- 3) SECURE RPC — complete a lesson ONCE, award points server-side.
-- The client calls this; it cannot award itself points any other way.
-- ---------------------------------------------------------
create or replace function public.complete_lesson(p_slug text, p_points integer default 70)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  -- The teacher (admin) is not in the game — no points, no progress.
  if exists (select 1 from public.profiles where id = uid and role = 'admin') then
    return;
  end if;
  -- Only the first completion of a given lesson counts.
  if exists (select 1 from public.lesson_progress where user_id = uid and lesson_slug = p_slug) then
    return;
  end if;
  insert into public.lesson_progress (user_id, lesson_slug) values (uid, p_slug);
  insert into public.points_ledger (user_id, delta, reason)
    values (uid, greatest(0, least(p_points, 200)), 'lesson:' || p_slug);
end; $$;

-- ---------------------------------------------------------
-- 4) ROW LEVEL SECURITY
-- ---------------------------------------------------------
alter table public.points_ledger  enable row level security;
alter table public.lesson_progress enable row level security;

-- A user reads only their OWN ledger. No client INSERT — points come only
-- from SECURITY DEFINER functions (complete_lesson, and future awards).
drop policy if exists ledger_read_own on public.points_ledger;
create policy ledger_read_own on public.points_ledger
  for select using (auth.uid() = user_id);

-- A user reads only their OWN progress (leaderboard "lessons" counts can be
-- exposed later via an aggregate view if needed).
drop policy if exists progress_read_own on public.lesson_progress;
create policy progress_read_own on public.lesson_progress
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- 5) DATA API GRANTS (auto-expose is OFF)
-- profiles.points is already readable via the table grant from 0001.
-- ---------------------------------------------------------
grant select on public.points_ledger  to authenticated;
grant select on public.lesson_progress to authenticated;
grant execute on function public.complete_lesson(text, integer) to authenticated;

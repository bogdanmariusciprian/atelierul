-- =========================================================
-- Migration 0009 — PROFILE PRIVACY (children's data protection).
--
-- PROBLEM this fixes (audit C1/C2/C3): migration 0001 granted a BLANKET
-- `select` on public.profiles to anon+authenticated, and RLS `using(true)`
-- gives ROW access, not COLUMN access. After 0008 added first_name,
-- last_name, school, locality, grade, passions, challenges, that meant
-- EVERY pupil's real name, school, town, class and personal "struggles"
-- were readable by ANYONE — even signed-out visitors — and the
-- `visibility` column was never enforced on the server (only cosmetically
-- in the UI, on mock data).
--
-- FIX: least-privilege columns + security-definer RPCs.
--   • anon/authenticated may SELECT only the "public-safe" columns
--     (identity chrome + points needed by the feed & leaderboard).
--   • Sensitive PII (names, school, town, class, passions) is served ONLY
--     through get_public_profile(), which ENFORCES the `visibility` rule.
--   • `challenges` (personal difficulties) is NEVER returned to anyone
--     except the owner or the teacher (admin).
--   • The owner reads their own full row via get_my_profile().
--
-- Refs: ICO Age-Appropriate Design Code — default settings / data
-- minimisation; Supabase Column-Level Security.
--
-- Safe to re-run (idempotent). Depends on 0001–0008 + is_admin_user()/
-- are_friends() (0003).
-- =========================================================

-- ---------------------------------------------------------
-- 1) LOCK THE TABLE DOWN TO PUBLIC-SAFE COLUMNS ONLY
-- Revoke the blanket table SELECT from 0001/0002, then re-grant SELECT on
-- just the safe columns. Column-level grants are the documented way to
-- hide columns in PostgREST (RLS cannot do per-column).
--
-- Safe columns = what the public forum feed, the homepage leaderboard and
-- the friend graph already read:
--   id, display_name, avatar_color, status_line, role, points, last_seen_at
-- NOTE: last_seen_at (presence dot) is kept readable so the guest-visible
-- forum feed keeps working; it's a coarse online/offline signal, not
-- precise data. Tighten later if desired (e.g. authenticated-only).
-- ---------------------------------------------------------
revoke select on public.profiles from anon;
revoke select on public.profiles from authenticated;

grant select
  (id, display_name, avatar_color, status_line, role, points, last_seen_at)
  on public.profiles
  to anon, authenticated;

-- UPDATE stays as granted in 0001 (own row only, enforced by the RLS
-- update-own policy + the lock_profile_role trigger). Nothing to change:
-- UPDATE does not require SELECT, so updateMyProfile() keeps working.

-- ---------------------------------------------------------
-- 2) OWNER READS THEIR OWN FULL ROW (settings screen)
-- Because the sensitive columns are no longer directly selectable, the
-- "Profil" (settings) screen fetches the owner's own row through this
-- definer RPC (runs as the function owner, so it bypasses the column
-- grants — but only ever returns auth.uid()'s own row).
-- ---------------------------------------------------------
create or replace function public.get_my_profile()
returns public.profiles
language sql
security definer
set search_path = public
stable
as $$
  select * from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------
-- 3) ANOTHER MEMBER'S PROFILE, VISIBILITY-ENFORCED (server-side)
-- Returns a bounded set of fields, honouring the target's `visibility`:
--   'everyone' → anyone (incl. signed-out) sees the details
--   'members'  → any signed-in user
--   'friends'  → only accepted friends
-- The owner and the teacher (admin) always see everything.
-- `challenges` is returned ONLY to the owner or the teacher — never to
-- peers or guests, matching the "🔒 doar tu și profesorul" promise.
-- When the viewer isn't allowed the details, NO row is returned (the UI
-- shows a "locked" card and just the public chrome it already has).
-- ---------------------------------------------------------
create or replace function public.get_public_profile(p_id uuid)
returns table (
  id           uuid,
  display_name text,
  avatar_color text,
  status_line  text,
  role         text,
  points       integer,
  last_seen_at timestamptz,
  first_name   text,
  last_name    text,
  grade        text,
  locality     text,
  school       text,
  passions     text,
  challenges   text,   -- NULL unless viewer is the owner or the teacher
  visibility   text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v          text;
  viewer     uuid := auth.uid();
  is_me      boolean;
  is_teacher boolean;
  allowed    boolean;
begin
  select p.visibility into v from public.profiles p where p.id = p_id;
  if v is null then
    return; -- no such profile
  end if;

  is_me      := (viewer is not null and viewer = p_id);
  is_teacher := public.is_admin_user();

  allowed :=
       is_me
    or is_teacher
    or v = 'everyone'
    or (v = 'members' and viewer is not null)
    or (v = 'friends' and viewer is not null and public.are_friends(viewer, p_id));

  if not allowed then
    return; -- caller may not see the details
  end if;

  return query
    select
      p.id, p.display_name, p.avatar_color, p.status_line, p.role, p.points,
      p.last_seen_at, p.first_name, p.last_name, p.grade, p.locality,
      p.school, p.passions,
      case when is_me or is_teacher then p.challenges else null end,
      p.visibility
    from public.profiles p
    where p.id = p_id;
end;
$$;

-- ---------------------------------------------------------
-- 4) GRANTS for the new RPCs (auto-expose is OFF)
-- ---------------------------------------------------------
grant execute on function public.get_my_profile()            to authenticated;
grant execute on function public.get_public_profile(uuid)    to anon, authenticated;

-- ---------------------------------------------------------
-- DONE. After this migration:
--   • A signed-out visitor can no longer read pupils' names/school/town/
--     class/passions/struggles from the table — only the safe chrome.
--   • Peer visibility is enforced by the SERVER, not just the UI.
--   • `challenges` is private to the pupil and the teacher.
-- Client changes that pair with this migration:
--   • forum-repo.fetchMyProfile() → rpc('get_my_profile')
--   • forum-repo.fetchPublicProfile(uuid) → rpc('get_public_profile')
-- =========================================================

-- =========================================================
-- Migration 0030 — admin_list_users: the REAL member directory for the
-- teacher's admin panel (Comunitate → Utilizatori).
--
-- Until now that list rendered MOCK seed users, so real sign-ups (e.g. a new
-- pupil) never showed up and couldn't be messaged. This adds an admin-only
-- RPC that returns every real MEMBER from `profiles`, joined with their e-mail
-- from the private `auth.users` table so the teacher can recognise accounts.
--
-- Security:
--   • security definer + an explicit is_admin_user() gate → ONLY the teacher
--     can call it (a member calling it gets an exception, no data).
--   • e-mail (PII) is therefore exposed to the teacher ONLY, never to peers.
--   • members only (the admin isn't a "user in the game").
--
-- Depends on 0001 (profiles, is_admin_user via 0003) + 0002 (points) +
-- 0007 (last_seen_at) + 0008 (avatar). Safe to re-run (create or replace).
-- =========================================================

create or replace function public.admin_list_users()
returns table (
  id           uuid,
  display_name text,
  avatar_color text,
  avatar       text,
  status_line  text,
  points       integer,
  role         text,
  last_seen_at timestamptz,
  created_at   timestamptz,
  email        text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;

  return query
    select
      p.id, p.display_name, p.avatar_color, p.avatar, p.status_line,
      p.points, p.role, p.last_seen_at, p.created_at, u.email::text
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'member'
    order by p.points desc, p.created_at desc;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;

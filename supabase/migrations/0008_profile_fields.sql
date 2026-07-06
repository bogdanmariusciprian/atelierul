-- =========================================================
-- Migration 0008 — editable profile fields. The "Profil" (settings) screen
-- lets a user edit these; they persist per user. display_name / avatar_color
-- / status_line already exist (0001); this adds the rest.
-- A user edits only their OWN row (profiles UPDATE policy from 0001). role and
-- events access stay protected elsewhere; these fields are freely self-edited.
-- =========================================================
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name  text;
alter table public.profiles add column if not exists grade      text;
alter table public.profiles add column if not exists locality   text;
alter table public.profiles add column if not exists school     text;
alter table public.profiles add column if not exists passions   text;
alter table public.profiles add column if not exists challenges text;
alter table public.profiles add column if not exists avatar     text; -- chosen gif path, or null = initials
alter table public.profiles add column if not exists visibility text not null default 'members'
  check (visibility in ('everyone', 'members', 'friends'));

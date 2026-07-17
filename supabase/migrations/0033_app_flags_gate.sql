-- =========================================================
-- Migration 0033 — app_flags: teacher-controlled pre-launch gate.
--
-- Lets the teacher flip the whole-site pre-launch gate ON/OFF from the admin
-- panel, instead of editing code. site-gate.js reads `gate_off` before login;
-- when true, everyone is let in (site public). Everyone may READ the flag (the
-- gate needs it before auth); only the admin may CHANGE it (RLS).
--
-- Seeded `gate_off = true` to match the site's current temporary „open" state.
-- Safe to re-run.
-- =========================================================

create table if not exists public.app_flags (
  key   text primary key,
  value boolean not null default false
);

insert into public.app_flags (key, value) values ('gate_off', true)
  on conflict (key) do nothing;

alter table public.app_flags enable row level security;

drop policy if exists app_flags_read on public.app_flags;
create policy app_flags_read on public.app_flags
  for select using (true);

drop policy if exists app_flags_write on public.app_flags;
create policy app_flags_write on public.app_flags
  for update using (public.is_admin_user()) with check (public.is_admin_user());

grant select on public.app_flags to anon, authenticated;
grant update on public.app_flags to authenticated; -- gated by RLS (admin only)

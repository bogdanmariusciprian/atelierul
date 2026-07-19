-- =========================================================
-- Migration 0049 — Setări private (cheia Drive + folderele pe categorii).
--
-- `app_flags` există deja, dar e boolean ȘI public la citire (poarta de
-- pre-lansare are nevoie de el înainte de autentificare). O cheie API n-are
-- ce căuta acolo. Deci un tabel separat, text, citibil DOAR de profesor.
--
-- Consecință practică: cheia Drive ajunge doar în browserul profesorului,
-- când deschide panoul. Elevii nu o primesc niciodată — ei descarcă prin
-- adrese directe, care nu au nevoie de cheie.
--
-- Chei folosite:
--   drive_api_key              → cheia din Google Cloud Console
--   drive_folder_<slug>        → id-ul folderului categoriei
--
-- Depinde de 0001 (is_admin_user). Sigur la re-rulare.
-- =========================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Nimic public aici: doar profesorul citește și scrie.
drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings for all
  using (public.is_admin_user()) with check (public.is_admin_user());

grant select, insert, update, delete on public.app_settings to authenticated;

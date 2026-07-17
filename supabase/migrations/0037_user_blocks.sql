-- =========================================================
-- Migration 0037 — Blocare/mute de utilizatori.
--
-- Un membru poate BLOCA alt membru: nu-i mai vede postările (ascunse client-side)
-- și, mai târziu, îl putem opri să inițieze mesaje. Fiecare își gestionează
-- DOAR propriile blocări (RLS). Profesorul nu e în jocul social → nu se blochează.
-- Sigur la re-rulare. Depinde de 0001 (profiles).
-- =========================================================

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;

-- Fiecare vede/creează/șterge DOAR propriile blocări.
drop policy if exists user_blocks_own on public.user_blocks;
create policy user_blocks_own on public.user_blocks for all
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

grant select, insert, delete on public.user_blocks to authenticated;

-- =========================================================
-- Pași client: forum-repo (fetchMyBlocks / blockUser / unblockUser);
-- community.js ascunde postările celor blocați + buton „Blochează" pe profil.
-- =========================================================

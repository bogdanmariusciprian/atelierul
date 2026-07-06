-- =========================================================
-- Migration 0007 — Presence. A `last_seen_at` timestamp on each profile,
-- refreshed by a small client heartbeat while the user is on the site.
-- "Active now" (green dot) = last_seen within a few minutes; else offline.
-- A user updates only their OWN last_seen (the profiles UPDATE policy from
-- 0001 already allows editing your own row), so presence can't be spoofed
-- for anyone else. It's readable by everyone (profiles are public).
-- =========================================================
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

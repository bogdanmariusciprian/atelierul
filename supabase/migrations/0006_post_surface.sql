-- =========================================================
-- Migration 0006 — separate the FORUM from a user's personal wall.
-- Each post now belongs to a "surface":
--   'forum' → the public square (the Forum feed)
--   'wall'  → the author's personal page ("Pagina mea")
-- A wall post NEVER shows in the forum; it's visible only on the author's
-- page, per its audience (public / friends). Existing posts default to
-- 'forum' (that was the old behaviour).
-- =========================================================
alter table public.posts
  add column if not exists surface text not null default 'forum'
  check (surface in ('forum', 'wall'));

create index if not exists posts_surface_idx on public.posts (surface, created_at desc);

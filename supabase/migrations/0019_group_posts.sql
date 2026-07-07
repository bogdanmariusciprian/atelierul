-- =========================================================
-- Migration 0019 — Group posts: posts.group_id.
--
-- `groups` + `group_members` already exist (0004). A group is a study topic;
-- its wall is just regular `posts` tagged with `group_id`. Deferred from 0003
-- (the posts table predates groups), added here.
--   • The main forum / "Pagina mea" feeds show posts where group_id IS NULL.
--   • A group's feed shows posts with that group_id.
-- Visibility still rides the existing posts RLS (public/friends audience,
-- moderation_status) — group posts are open study threads, not private data
-- (pupils' PII is protected separately, see 0009).
-- Depends on 0003 (posts), 0004 (groups). Safe to re-run.
-- =========================================================

alter table public.posts
  add column if not exists group_id uuid references public.groups (id) on delete cascade;

create index if not exists posts_group_idx on public.posts (group_id);

-- The creator picks a topic icon (index into the shared icon set); color is
-- derived from it in the client. Stored so the choice survives.
alter table public.groups
  add column if not exists icon_id integer not null default 0;

-- (No new grants/policies: posts is already SELECT-able and the author-owned
--  INSERT/UPDATE/DELETE policies from 0003 cover group posts too.)

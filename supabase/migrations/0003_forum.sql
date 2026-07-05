-- =========================================================
-- Migration 0003 — Forum: friendships, posts, comments, reactions, saves.
-- RLS included per table (as always). Friendships is here because a post's
-- "friends only" audience needs it. posts.group_id is deferred to the groups
-- migration (added later via ALTER).
--
-- ORDER MATTERS: `language sql` functions are validated at creation time, so
-- each helper is defined AFTER the table it reads.
-- =========================================================

-- Admin check reads profiles (already exists from 0001).
create or replace function public.is_admin_user()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------
-- 1) FRIENDSHIPS
-- ---------------------------------------------------------
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted')),
  created_at   timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

-- Now that friendships exists, the friends check can be defined.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ( (f.requester_id = a and f.addressee_id = b)
         or (f.requester_id = b and f.addressee_id = a) )
  );
$$;

alter table public.friendships enable row level security;

drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id or public.is_admin_user());

drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships for insert
  with check (auth.uid() = requester_id);

drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships for update
  using (auth.uid() = addressee_id) with check (auth.uid() = addressee_id);

drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ---------------------------------------------------------
-- 2) POSTS
-- ---------------------------------------------------------
create table if not exists public.posts (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references public.profiles (id) on delete cascade,
  body              text,
  type              text not null default 'discutie'
                    check (type in ('discutie','intrebare','resursa','reusita','anunt')),
  background        text not null default 'none',
  audience          text not null default 'public' check (audience in ('public','friends')),
  share_of          uuid references public.posts (id) on delete set null,
  media             jsonb,   -- bounded list (≤3) of {kind:'image'|'youtube', url}
  moderation_status text not null default 'visible'
                    check (moderation_status in ('visible','held','blocked')),
  created_at        timestamptz not null default now(),
  edited_at         timestamptz
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_author_idx on public.posts (author_id);

alter table public.posts enable row level security;

-- READ: admin sees all; author sees own (incl. held/blocked); everyone else
-- sees VISIBLE posts that are public, or friends-only if they're friends.
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (
  public.is_admin_user()
  or author_id = auth.uid()
  or (moderation_status = 'visible'
      and (audience = 'public' or public.are_friends(author_id, auth.uid())))
);

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert
  with check (author_id = auth.uid());

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update
  using (author_id = auth.uid() or public.is_admin_user())
  with check (author_id = auth.uid() or public.is_admin_user());

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete
  using (author_id = auth.uid() or public.is_admin_user());

-- Can the current user see a given post? (definer → no RLS recursion when
-- used inside the comments policy.) Defined AFTER posts exists.
create or replace function public.can_see_post(p_post uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post
      and ( public.is_admin_user()
         or p.author_id = auth.uid()
         or (p.moderation_status = 'visible'
             and (p.audience = 'public' or public.are_friends(p.author_id, auth.uid()))) )
  );
$$;

-- ---------------------------------------------------------
-- 3) POST REACTIONS
-- ---------------------------------------------------------
create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
alter table public.post_reactions enable row level security;

drop policy if exists post_reactions_read on public.post_reactions;
create policy post_reactions_read on public.post_reactions for select using (true);

drop policy if exists post_reactions_insert on public.post_reactions;
create policy post_reactions_insert on public.post_reactions for insert
  with check (user_id = auth.uid());

drop policy if exists post_reactions_delete on public.post_reactions;
create policy post_reactions_delete on public.post_reactions for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------
-- 4) SAVED POSTS (personal bookmarks)
-- ---------------------------------------------------------
create table if not exists public.saved_posts (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.saved_posts enable row level security;

drop policy if exists saved_posts_all on public.saved_posts;
create policy saved_posts_all on public.saved_posts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------
-- 5) COMMENTS (on posts AND on lessons; threaded)
-- ---------------------------------------------------------
create table if not exists public.comments (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid references public.posts (id) on delete cascade,
  lesson_slug       text,
  parent_id         uuid references public.comments (id) on delete cascade,
  author_id         uuid not null references public.profiles (id) on delete cascade,
  body              text not null,
  moderation_status text not null default 'visible'
                    check (moderation_status in ('visible','held','blocked')),
  created_at        timestamptz not null default now(),
  edited_at         timestamptz,
  -- exactly one target: a post OR a lesson
  check ((post_id is not null) <> (lesson_slug is not null))
);
create index if not exists comments_post_idx on public.comments (post_id);
create index if not exists comments_lesson_idx on public.comments (lesson_slug);

alter table public.comments enable row level security;

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select using (
  public.is_admin_user()
  or author_id = auth.uid()
  or (moderation_status = 'visible'
      and ( lesson_slug is not null
         or (post_id is not null and public.can_see_post(post_id)) ))
);

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert
  with check (author_id = auth.uid());

drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update
  using (author_id = auth.uid() or public.is_admin_user())
  with check (author_id = auth.uid() or public.is_admin_user());

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete
  using (author_id = auth.uid() or public.is_admin_user());

-- ---------------------------------------------------------
-- 6) COMMENT REACTIONS
-- ---------------------------------------------------------
create table if not exists public.comment_reactions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);
alter table public.comment_reactions enable row level security;

drop policy if exists comment_reactions_read on public.comment_reactions;
create policy comment_reactions_read on public.comment_reactions for select using (true);

drop policy if exists comment_reactions_insert on public.comment_reactions;
create policy comment_reactions_insert on public.comment_reactions for insert
  with check (user_id = auth.uid());

drop policy if exists comment_reactions_delete on public.comment_reactions;
create policy comment_reactions_delete on public.comment_reactions for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------
-- 7) DATA API GRANTS (auto-expose is OFF)
-- ---------------------------------------------------------
grant select on public.posts             to anon, authenticated; -- guests read public forum
grant select on public.comments          to anon, authenticated;
grant select on public.post_reactions    to anon, authenticated;
grant select on public.comment_reactions to anon, authenticated;
grant insert, update, delete on public.posts             to authenticated;
grant insert, update, delete on public.comments          to authenticated;
grant insert, delete         on public.post_reactions    to authenticated;
grant insert, delete         on public.comment_reactions to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, delete on public.saved_posts to authenticated;
grant execute on function public.is_admin_user()          to anon, authenticated;
grant execute on function public.are_friends(uuid, uuid)  to anon, authenticated;
grant execute on function public.can_see_post(uuid)       to anon, authenticated;

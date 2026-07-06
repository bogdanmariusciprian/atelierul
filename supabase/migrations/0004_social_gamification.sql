-- =========================================================
-- Migration 0004 — the rest of the schema: messages, notifications, post
-- follows, exercises(+votes), groups(+members), reports, kudos,
-- challenges(+solves), notebook_notes. RLS per table (as always).
-- Depends on 0001–0003 (profiles, posts, comments, is_admin_user()).
-- Safe to re-run (idempotent).
-- =========================================================

-- ---------------------------------------------------------
-- NOTEBOOK ("caietul") — private per user
-- ---------------------------------------------------------
create table if not exists public.notebook_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  body        text not null,
  lesson_slug text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create index if not exists notebook_user_idx on public.notebook_notes (user_id);
alter table public.notebook_notes enable row level security;
drop policy if exists notebook_all_own on public.notebook_notes;
create policy notebook_all_own on public.notebook_notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------
-- POST FOLLOWS — "notify me about this post"
-- ---------------------------------------------------------
create table if not exists public.post_follows (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.post_follows enable row level security;
drop policy if exists post_follows_all_own on public.post_follows;
create policy post_follows_all_own on public.post_follows for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------
-- MESSAGES — member↔member (templates) or member→teacher (free text)
-- ---------------------------------------------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid references public.profiles (id) on delete set null,
  recipient_id uuid references public.profiles (id) on delete cascade,
  to_admin     boolean not null default false,
  body         text not null,
  template_key text,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index if not exists messages_recipient_idx on public.messages (recipient_id);
alter table public.messages enable row level security;

-- READ: sender, recipient, or (for teacher messages) any admin.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or (to_admin and public.is_admin_user())
);
-- SEND: only as yourself.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (sender_id = auth.uid());
-- Mark read: the recipient (or an admin for teacher messages).
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update
  using (recipient_id = auth.uid() or (to_admin and public.is_admin_user()))
  with check (recipient_id = auth.uid() or (to_admin and public.is_admin_user()));

-- ---------------------------------------------------------
-- NOTIFICATIONS — one recipient each. Generated server-side later
-- (triggers/RPCs); for now clients only read/mark-read their own.
-- ---------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  payload    jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select
  using (user_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------
-- EXERCISES (member-proposed, tied to a lesson) + votes
-- ---------------------------------------------------------
create table if not exists public.exercises (
  id          uuid primary key default gen_random_uuid(),
  lesson_slug text not null,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('choice','fill','match')),
  prompt      text not null,
  data        jsonb,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  verified    boolean not null default false,
  decided_by  uuid references public.profiles (id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists exercises_lesson_idx on public.exercises (lesson_slug);
alter table public.exercises enable row level security;

drop policy if exists exercises_read on public.exercises;
create policy exercises_read on public.exercises for select using (
  status = 'approved' or author_id = auth.uid() or public.is_admin_user()
);
drop policy if exists exercises_insert on public.exercises;
create policy exercises_insert on public.exercises for insert
  with check (author_id = auth.uid() and status = 'pending');
-- Only an admin decides (approve/reject/edit/verify).
drop policy if exists exercises_update on public.exercises;
create policy exercises_update on public.exercises for update
  using (public.is_admin_user()) with check (public.is_admin_user());

create table if not exists public.exercise_votes (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (exercise_id, user_id)
);
alter table public.exercise_votes enable row level security;
drop policy if exists exercise_votes_read on public.exercise_votes;
create policy exercise_votes_read on public.exercise_votes for select using (true);
drop policy if exists exercise_votes_insert on public.exercise_votes;
create policy exercise_votes_insert on public.exercise_votes for insert
  with check (user_id = auth.uid());
drop policy if exists exercise_votes_delete on public.exercise_votes;
create policy exercise_votes_delete on public.exercise_votes for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------
-- GROUPS (study topics) + members
-- ---------------------------------------------------------
create table if not exists public.groups (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text,
  creator_id        uuid not null references public.profiles (id) on delete cascade,
  allow_members_add boolean not null default false,
  created_at        timestamptz not null default now()
);
alter table public.groups enable row level security;
drop policy if exists groups_read on public.groups;
create policy groups_read on public.groups for select using (true);
drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups for insert
  with check (creator_id = auth.uid());
drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update
  using (creator_id = auth.uid() or public.is_admin_user())
  with check (creator_id = auth.uid() or public.is_admin_user());
drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups for delete
  using (creator_id = auth.uid() or public.is_admin_user());

create table if not exists public.group_members (
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  added_by   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_members enable row level security;
drop policy if exists group_members_read on public.group_members;
create policy group_members_read on public.group_members for select using (true);
-- Join yourself, or be added by the creator (or when the group allows it).
drop policy if exists group_members_insert on public.group_members;
create policy group_members_insert on public.group_members for insert with check (
  user_id = auth.uid()
  or public.is_admin_user()
  or exists (select 1 from public.groups g where g.id = group_id
             and (g.creator_id = auth.uid() or g.allow_members_add))
);
-- Leave yourself, or be removed by the creator/admin.
drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members for delete using (
  user_id = auth.uid()
  or public.is_admin_user()
  or exists (select 1 from public.groups g where g.id = group_id and g.creator_id = auth.uid())
);

-- ---------------------------------------------------------
-- REPORTS (moderation queue) — reporters write, admin reads/resolves
-- ---------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post','comment')),
  target_id   uuid not null,
  reason      text,
  status      text not null default 'open' check (status in ('open','resolved')),
  created_at  timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (reporter_id = auth.uid());
drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select using (public.is_admin_user());
drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update
  using (public.is_admin_user()) with check (public.is_admin_user());

-- ---------------------------------------------------------
-- KUDOS (claps / poke / snail) — 1/day enforced in the app/RPC
-- ---------------------------------------------------------
create table if not exists public.kudos (
  id         bigint generated always as identity primary key,
  from_user  uuid not null references public.profiles (id) on delete cascade,
  to_user    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('clap','poke','snail')),
  created_at timestamptz not null default now()
);
create index if not exists kudos_to_idx on public.kudos (to_user);
alter table public.kudos enable row level security;
drop policy if exists kudos_read on public.kudos;
create policy kudos_read on public.kudos for select using (true);
drop policy if exists kudos_insert on public.kudos;
create policy kudos_insert on public.kudos for insert
  with check (from_user = auth.uid() and not public.is_admin_user());

-- ---------------------------------------------------------
-- CHALLENGES (admin daily) + solves
-- ---------------------------------------------------------
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  active_date date,
  prompt      text not null,
  data        jsonb,
  correct     text,
  reward      integer not null default 15,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.challenges enable row level security;
drop policy if exists challenges_read on public.challenges;
create policy challenges_read on public.challenges for select using (true);
drop policy if exists challenges_write on public.challenges;
create policy challenges_write on public.challenges for all
  using (public.is_admin_user()) with check (public.is_admin_user());

create table if not exists public.challenge_solves (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
alter table public.challenge_solves enable row level security;
drop policy if exists challenge_solves_read on public.challenge_solves;
create policy challenge_solves_read on public.challenge_solves for select
  using (user_id = auth.uid());
-- (Inserted via a points-awarding RPC later; no direct client insert.)

-- ---------------------------------------------------------
-- DATA API GRANTS (auto-expose is OFF)
-- ---------------------------------------------------------
grant select, insert, update, delete on public.notebook_notes to authenticated;
grant select, insert, delete on public.post_follows to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.exercises to anon, authenticated;
grant insert, update on public.exercises to authenticated;
grant select on public.exercise_votes to anon, authenticated;
grant insert, delete on public.exercise_votes to authenticated;
grant select on public.groups to anon, authenticated;
grant insert, update, delete on public.groups to authenticated;
grant select on public.group_members to anon, authenticated;
grant insert, delete on public.group_members to authenticated;
grant insert on public.reports to authenticated;
grant select, update on public.reports to authenticated;
grant select on public.kudos to anon, authenticated;
grant insert on public.kudos to authenticated;
grant select on public.challenges to anon, authenticated;
grant insert, update, delete on public.challenges to authenticated;
grant select on public.challenge_solves to authenticated;

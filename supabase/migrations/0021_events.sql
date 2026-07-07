-- =========================================================
-- Migration 0021 — Events + RSVPs (real).
--
-- `event_access` (0005) already decides WHO may see the Evenimente section
-- (the teacher grants it per pupil). This migration adds the events
-- themselves and the "Particip" RSVPs:
--   • events        — the teacher creates/edits/removes them (admin-only writes).
--     Readable only by pupils WITH event_access (or the teacher). Guests never
--     see them.
--   • event_rsvps   — a pupil marks that they'll attend (own rows only), and
--     only for events they're actually allowed to see.
-- Depends on 0005 (event_access), 0001 (profiles). Safe to re-run.
-- =========================================================

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  kind       text not null default 'live' check (kind in ('live','quiz','reading','other')),
  starts_at  timestamptz,                 -- optional, used for ordering
  when_text  text,                        -- human label ("vineri, 20:00")
  host       text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists events_starts_idx on public.events (starts_at);
alter table public.events enable row level security;

-- Only pupils the teacher granted access to (or the teacher) can see events.
drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (
  public.is_admin_user()
  or exists (select 1 from public.event_access ea where ea.user_id = auth.uid())
);
-- Only the teacher creates/edits/deletes.
drop policy if exists events_write on public.events;
create policy events_write on public.events for all
  using (public.is_admin_user()) with check (public.is_admin_user());

create table if not exists public.event_rsvps (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_rsvps enable row level security;

-- See your own RSVPs (and the teacher sees all, to count attendance).
drop policy if exists event_rsvps_read on public.event_rsvps;
create policy event_rsvps_read on public.event_rsvps for select
  using (user_id = auth.uid() or public.is_admin_user());
-- RSVP yourself, and only to an event you're actually allowed to see.
drop policy if exists event_rsvps_insert on public.event_rsvps;
create policy event_rsvps_insert on public.event_rsvps for insert with check (
  user_id = auth.uid()
  and (
    public.is_admin_user()
    or exists (select 1 from public.event_access ea where ea.user_id = auth.uid())
  )
);
drop policy if exists event_rsvps_delete on public.event_rsvps;
create policy event_rsvps_delete on public.event_rsvps for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------
-- DATA API GRANTS (auto-expose is OFF)
-- ---------------------------------------------------------
grant select on public.events to authenticated;                 -- RLS still gates rows
grant insert, update, delete on public.events to authenticated; -- RLS → admin only
grant select, insert, delete on public.event_rsvps to authenticated;

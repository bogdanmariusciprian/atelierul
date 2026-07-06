-- =========================================================
-- Migration 0005 — Events access. A member sees the "Evenimente" section only
-- if the teacher (admin) has granted them access. A dedicated table (not a
-- profiles column) so a member can't self-grant: only an admin may insert/
-- delete rows; a member can read only their OWN row.
-- Depends on 0001 (profiles) + 0003 (is_admin_user()).
-- =========================================================
create table if not exists public.event_access (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.event_access enable row level security;

-- READ: your own access; admin sees everyone.
drop policy if exists event_access_read on public.event_access;
create policy event_access_read on public.event_access for select
  using (user_id = auth.uid() or public.is_admin_user());

-- GRANT / REVOKE: admin only.
drop policy if exists event_access_insert on public.event_access;
create policy event_access_insert on public.event_access for insert
  with check (public.is_admin_user());

drop policy if exists event_access_delete on public.event_access;
create policy event_access_delete on public.event_access for delete
  using (public.is_admin_user());

grant select, insert, delete on public.event_access to authenticated;

-- To grant a member access manually (SQL editor runs as service_role, which
-- bypasses RLS):
--   insert into public.event_access (user_id) values ('<user-uuid>');

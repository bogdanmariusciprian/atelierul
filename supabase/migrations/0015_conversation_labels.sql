-- =========================================================
-- Migration 0015 — Teacher's conversation labels (email-style inbox).
--
-- The teacher can tag each member conversation: Curent / Încheiat / Amânat.
-- (The "Evenimente" label is NOT stored — it's derived automatically from
-- event_access, so students granted events access are always tagged.)
-- One label per member; admin-only. Depends on 0001 (profiles) + 0003
-- (is_admin_user). Safe to re-run.
-- =========================================================
create table if not exists public.conversation_labels (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  label      text not null check (label in ('curent', 'incheiat', 'amanat')),
  updated_at timestamptz not null default now()
);

alter table public.conversation_labels enable row level security;

drop policy if exists conv_labels_admin on public.conversation_labels;
create policy conv_labels_admin on public.conversation_labels for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update, delete on public.conversation_labels to authenticated;

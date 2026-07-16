-- =========================================================
-- Migration 0026 — Notation words proposed by pupils ("Cercuri și pătrate").
--
-- On the lesson „Sintaxa frazei – Introducere”, the Notation section lists the
-- subordinating words (circles) and coordinating words (squares). The starter
-- words are hard-coded in the page (static content by design); the "+" pill
-- lets a PUPIL propose an extra word. The flow mirrors exercise proposals:
--   • a member proposes a word → status 'pending' (forced by RLS);
--   • the teacher approves / rejects (on the lesson page);
--   • an APPROVED word is visible to EVERYONE — members, guests, admin;
--   • the teacher may also add a word directly (born 'approved').
-- No points are involved, so plain table ops under RLS are enough (same
-- pattern as `exercises` in 0004 — no security-definer RPC needed).
--
-- What this avoids:
--   • self-publishing: a member cannot insert an 'approved' row (RLS check);
--   • duplicates: one live word per kind, case-insensitive ('rejected' rows
--     don't block a later, better-judged re-proposal);
--   • junk: the word is trimmed + length-capped server-side.
-- Depends on 0001 (profiles, is_admin_user). Safe to re-run.
-- =========================================================

create table if not exists public.notation_words (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('circle','square')),
  word       text not null check (word = btrim(word) and char_length(word) between 1 and 24),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- One live (pending/approved) word per kind, case-insensitive.
create unique index if not exists notation_words_unique_live
  on public.notation_words (kind, lower(word))
  where status <> 'rejected';

alter table public.notation_words enable row level security;

-- Approved → everyone (guests included). Pending/rejected → author + teacher.
drop policy if exists notation_words_read on public.notation_words;
create policy notation_words_read on public.notation_words for select using (
  status = 'approved' or author_id = auth.uid() or public.is_admin_user()
);

-- A member proposes (status forced 'pending'); the teacher may insert directly.
drop policy if exists notation_words_insert on public.notation_words;
create policy notation_words_insert on public.notation_words for insert
  with check (author_id = auth.uid() and (status = 'pending' or public.is_admin_user()));

-- Only the teacher decides (approve / reject / withdraw).
drop policy if exists notation_words_update on public.notation_words;
create policy notation_words_update on public.notation_words for update
  using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists notation_words_delete on public.notation_words;
create policy notation_words_delete on public.notation_words for delete
  using (public.is_admin_user());

-- "Expose new tables" is OFF → explicit grants (RLS still gates the rows).
grant select on public.notation_words to anon, authenticated;
grant insert, update, delete on public.notation_words to authenticated;

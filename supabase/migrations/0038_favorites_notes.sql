-- =========================================================
-- Migration 0038 — Favorite (Lecțiile mele) + Caiet (notes), reale în DB.
-- Înlocuiesc MY_PROFILE.favorites (hardcodat) și caietul din localStorage,
-- ca să fie salvate pe cont și să treacă între dispozitive. Fiecare vede/
-- editează DOAR ale lui (RLS). Depinde de 0001 (profiles). Sigur la re-rulare.
-- =========================================================

-- ---- Lecții preferate ----
create table if not exists public.favorites (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  lesson_slug text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, lesson_slug)
);
alter table public.favorites enable row level security;
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, delete on public.favorites to authenticated;

-- ---- Caietul (notițe) ----
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text,
  body        text not null,
  lesson_slug text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.notes enable row level security;
drop policy if exists notes_own on public.notes;
create policy notes_own on public.notes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update, delete on public.notes to authenticated;
create index if not exists notes_user_idx on public.notes (user_id, created_at desc);

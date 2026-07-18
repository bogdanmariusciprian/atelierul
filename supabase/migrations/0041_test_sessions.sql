-- =========================================================
-- Migration 0041 — Sesiuni de antrenament salvate (mini-jocul de teste).
-- Elevul își marchează sesiunea cu un emoji, iar progresul (coada de itemi
-- rămași + scorul) se salvează pe cont, ca să poată relua de unde a rămas,
-- de pe orice dispozitiv. Fiecare vede/editează DOAR sesiunile lui (RLS).
--
-- CHEAT-SAFE: coada ține DOAR id-uri de itemi; cheia de răspuns nu ajunge
-- niciodată aici (rămâne exclusiv în answer_test_item, server-side).
-- Depinde de 0001 (profiles) + banca de itemi. Sigur la re-rulare.
-- =========================================================

create table if not exists public.test_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  exam       text not null default 'admitere-drept',
  emoji      text not null default '⚖️',
  label      text,
  -- ce a ales elevul: {years:[], sessions:[], types:[], order:'', typeOrder:[]}
  config     jsonb not null default '{}'::jsonb,
  -- itemii RĂMAȘI, în ordinea de joc (cei greșiți revin la coadă)
  queue      jsonb not null default '[]'::jsonb,
  -- {total, correct, wrong, points, elapsed}
  stats      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.test_sessions enable row level security;
drop policy if exists test_sessions_own on public.test_sessions;
create policy test_sessions_own on public.test_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.test_sessions to authenticated;

-- cele mai recent atinse apar primele în lista „Continuă"
create index if not exists test_sessions_user_idx
  on public.test_sessions (user_id, updated_at desc);

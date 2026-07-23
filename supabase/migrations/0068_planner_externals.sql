-- =========================================================
-- Migration 0068 — Elevi EXTERNI în planificator.
--
-- Un elev extern nu are cont, view sau cotă: e o etichetă cu nume, culoare,
-- simbol și durată implicită, pe care profesorul o trage în orar ca pe orice
-- bulină. Orele lui sunt DEȚINUTE de contul profesorului (user_id = admin),
-- cu external_id arătând spre etichetă — fără conturi-fantomă, fără găuri:
-- elevii reali le văd ca „Ocupat" (user străin), iar RLS-ul pe tabela de
-- etichete e admin-only, deci numele externilor nu pleacă spre nimeni.
--
-- Ștergerea unui extern îi șterge și orele (cascade) — e caietul
-- profesorului, nu istoric social; interfața avertizează înainte.
--
-- Sigură la re-rulare.
-- =========================================================

create table if not exists public.planner_externals (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 40),
  color      text,
  emoji      text check (emoji is null or char_length(emoji) <= 8),
  minutes    int not null default 120 check (minutes in (60, 90, 120)),
  created_at timestamptz not null default now()
);

alter table public.planner_externals enable row level security;

drop policy if exists externals_admin_all on public.planner_externals;
create policy externals_admin_all on public.planner_externals
  for all using (public.is_admin_user()) with check (public.is_admin_user());

grant select, insert, update, delete on public.planner_externals to authenticated;

alter table public.planner_slots
  add column if not exists external_id uuid
  references public.planner_externals(id) on delete cascade;

create index if not exists planner_slots_external_idx
  on public.planner_slots (external_id) where external_id is not null;

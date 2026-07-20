-- =========================================================
-- Migration 0055 — Planificatorul, runda a doua.
--
-- Patru lucruri, fiecare cu motivul lui:
--
-- 1. PREFERINȚELE PE ELEV stau pe event_access, nu într-un tabel nou. Rândul
--    de acolo ESTE „elevul marcat" — un al doilea tabel ar fi trebuit ținut în
--    pas cu primul la fiecare marcare și demarcare, și ar fi ajuns, inevitabil,
--    să spună altceva. Numele, culoarea și durata implicită sunt atribute ale
--    marcării, deci locuiesc pe ea.
--
-- 2. VACANȚELE sunt informative, nu blocante. „Unii elevi vor să lucrăm și în
--    vacanță" — deci baza NU refuză o rezervare în vacanță; doar seriile
--    recurente le sar din oficiu (ritmul săptămânal ia pauză), iar cine vrea
--    să lucreze își pune ora cu mâna. O vacanță blocantă ar fi contrazis exact
--    jumătate dintre elevi.
--
-- 3. RECURENȚA e materializată: „în fiecare marți la 18" devine N rânduri
--    reale legate printr-un recurrence_id, nu o regulă evaluată din zbor.
--    Fiecare apariție poate fi mutată sau anulată individual — exact ce se
--    întâmplă în viața reală cu o meditație săptămânală — iar constrângerea de
--    excludere din 0053 le păzește pe fiecare în parte, fără cod nou.
--
-- 4. TRECUTUL se închide pe server. Elevul nu poate crea sau muta o rezervare
--    într-un moment deja consumat; profesorul poate (ca să consemneze o
--    ședință ținută). Garda din interfață e doar politețea; asta e regula.
--
-- Depinde de 0005 (event_access), 0053, 0054. Sigur la re-rulare.
-- =========================================================

-- ---------- 1. preferințele pe elev ----------
alter table public.event_access
  add column if not exists planner_name text,
  add column if not exists planner_color text,
  add column if not exists planner_minutes integer not null default 120
    check (planner_minutes in (60, 90, 120));

comment on column public.event_access.planner_name is
  'Cum îi spune profesorul elevului în planificator (porecla de pe jeton). Gol = numele din profil.';
comment on column public.event_access.planner_color is
  'Culoarea blocurilor elevului, aleasă de profesor. Gol = culoarea avatarului.';
comment on column public.event_access.planner_minutes is
  'Durata implicită a blocului acestui elev. Elevul o poate scurta din contul lui.';

-- Profesorul editează preferințele. Politica de UPDATE lipsea cu totul pe
-- event_access (nu avea ce edita până acum).
drop policy if exists event_access_admin_update on public.event_access;
create policy event_access_admin_update on public.event_access for update
  using (public.is_admin_user()) with check (public.is_admin_user());

-- ---------- 2. vacanțele ----------
create table if not exists public.planner_vacations (
  id         uuid primary key default gen_random_uuid(),
  starts_on  date not null,
  ends_on    date not null,
  label      text,
  created_at timestamptz not null default now(),
  constraint planner_vacations_order check (ends_on >= starts_on)
);

alter table public.planner_vacations enable row level security;

drop policy if exists vacations_read on public.planner_vacations;
create policy vacations_read on public.planner_vacations for select
  using (public.has_planner_access());

drop policy if exists vacations_admin_write on public.planner_vacations;
create policy vacations_admin_write on public.planner_vacations for all
  using (public.is_admin_user()) with check (public.is_admin_user());

grant select, insert, update, delete on public.planner_vacations to authenticated;

-- ---------- 3. recurența ----------
alter table public.tutoring_slots
  add column if not exists recurrence_id uuid;

create index if not exists tutoring_slots_recurrence_idx
  on public.tutoring_slots (recurrence_id) where recurrence_id is not null;

comment on column public.tutoring_slots.recurrence_id is
  'Leagă aparițiile aceleiași serii săptămânale. Null = rezervare singulară.';

-- ---------- 4. garda extinsă (program + jumătăți + trecut) ----------
create or replace function public.tutoring_within_hours()
returns trigger
language plpgsql
as $$
declare
  h_start int := 8;
  h_end   int := 22;
  -- `at time zone` pe un timestamptz dă un TIMESTAMP fără fus — ceasul de
  -- perete din București. Declarat ca atare; un timestamptz aici ar converti
  -- înapoi prin fusul serverului și ar ieși corect doar pe un server pe UTC.
  s timestamp := new.starts_at at time zone 'Europe/Bucharest';
  e timestamp := new.ends_at   at time zone 'Europe/Bucharest';
  times_changed boolean := tg_op = 'INSERT'
    or new.starts_at is distinct from old.starts_at
    or new.ends_at   is distinct from old.ends_at;
begin
  -- Doar când se schimbă efectiv orele. Altfel anularea unei rezervări vechi
  -- (update pe status, cu orele neatinse) ar fi respinsă ca „în trecut".
  if not times_changed then return new; end if;

  if extract(hour from s) < h_start
     or (extract(hour from e) * 60 + extract(minute from e)) > h_end * 60 then
    raise exception 'Ora aleasă e în afara programului (% - %).', h_start, h_end
      using errcode = 'check_violation';
  end if;
  if extract(minute from s)::int % 30 <> 0 then
    raise exception 'Rezervările încep din jumătate în jumătate de oră.'
      using errcode = 'check_violation';
  end if;
  -- Trecutul: închis pentru elevi, deschis pentru profesor (poate consemna o
  -- ședință deja ținută). 5 minute de grație pentru ceasuri nesincronizate.
  if not public.is_admin_user()
     and new.starts_at < now() - interval '5 minutes' then
    raise exception 'Nu poți rezerva în trecut.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

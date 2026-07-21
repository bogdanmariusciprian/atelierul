-- =========================================================
-- Migration 0059 — Ferestre de disponibilitate pe O SINGURĂ zi.
--
-- Șablonul săptămânal („joia 16–20") rămâne coloana vertebrală. Dar viața are
-- excepții: azi s-a eliberat dimineața, sâmbăta viitoare poți lucra deși de
-- obicei nu. O fereastră cu `on_date` setat trăiește doar în acea zi
-- calendaristică și nu atinge șablonul — joia viitoare rămâne cum era.
--
-- on_date NULL  → șablon: se aplică în fiecare săptămână, pe `weekday`.
-- on_date SETAT → excepție: se aplică doar în acea dată; `weekday` se
--                  păstrează coerent cu data, pentru interogări simple.
--
-- Garda din trigger acceptă rezervarea dacă încape într-o fereastră DIN
-- ORICARE regim, pentru ziua respectivă.
--
-- Depinde de 0056. Sigur la re-rulare.
-- =========================================================

alter table public.planner_availability
  add column if not exists on_date date;

comment on column public.planner_availability.on_date is
  'NULL = fereastră săptămânală (după weekday). Setat = doar în această zi calendaristică.';

create index if not exists planner_availability_date_idx
  on public.planner_availability (on_date) where on_date is not null;

create or replace function public.tutoring_within_hours()
returns trigger
language plpgsql
as $$
declare
  h_start int := 8;
  h_end   int := 22;
  -- `at time zone` pe timestamptz dă un TIMESTAMP fără fus — ceasul de perete
  -- din București. Declarat ca atare; altfel s-ar reconverti prin fusul
  -- serverului și ar ieși corect doar pe UTC, din întâmplare.
  s timestamp := new.starts_at at time zone 'Europe/Bucharest';
  e timestamp := new.ends_at   at time zone 'Europe/Bucharest';
  s_min int := extract(hour from s)::int * 60 + extract(minute from s)::int;
  e_min int := extract(hour from e)::int * 60 + extract(minute from e)::int;
  wd    int := extract(isodow from s)::int - 1; -- 0 = luni … 6 = duminică
  times_changed boolean := tg_op = 'INSERT'
    or new.starts_at is distinct from old.starts_at
    or new.ends_at   is distinct from old.ends_at;
begin
  if not times_changed then return new; end if;

  if extract(hour from s) < h_start or e_min > h_end * 60 then
    raise exception 'Ora aleasă e în afara programului (% - %).', h_start, h_end
      using errcode = 'check_violation';
  end if;
  if extract(minute from s)::int % 30 <> 0 then
    raise exception 'Rezervările încep din jumătate în jumătate de oră.'
      using errcode = 'check_violation';
  end if;

  if not public.is_admin_user() then
    if new.starts_at < now() - interval '5 minutes' then
      raise exception 'Nu poți rezerva în trecut.'
        using errcode = 'check_violation';
    end if;
    -- O fereastră din ORICARE regim e de ajuns: șablonul săptămânii sau
    -- excepția acelei zile. Conținerea rămâne într-o singură fereastră —
    -- contopirea de la salvare face imposibile ferestrele lipite în date.
    if not exists (
      select 1 from public.planner_availability a
       where ((a.on_date is null and a.weekday = wd) or a.on_date = s::date)
         and a.start_min <= s_min
         and a.end_min   >= e_min
    ) then
      raise exception 'Ora aleasă e în afara disponibilității profesorului.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

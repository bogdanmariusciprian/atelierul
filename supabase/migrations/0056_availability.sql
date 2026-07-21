-- =========================================================
-- Migration 0056 — Disponibilitatea profesorului (modelul „Calendly").
--
-- Până acum, orice oră între 8 și 22 era implicit rezervabilă — adică
-- profesorul era, teoretic, disponibil 98 de ore pe săptămână. Modelul se
-- întoarce: NIMIC nu e rezervabil până când profesorul nu deschide ferestre.
-- Elevul nu mai desenează pe calendar; alege dintr-o listă de ore libere
-- născute din ferestrele astea, minus ce e deja ocupat.
--
-- Șablonul e SĂPTĂMÂNAL (marți 16–20 înseamnă fiecare marți), pentru că așa
-- arată realitatea meditațiilor; excepțiile se fac cu blocuri personale
-- („Activitate personală" peste o fereastră o închide de facto în acea zi).
--
-- Minutele sunt de la miezul nopții, pe ceasul de perete al României — aceeași
-- convenție cu triggerul de program din 0053/0055, ca cele două să nu se poată
-- contrazice la schimbarea orei de vară.
--
-- Weekday: 0 = luni … 6 = duminică. E convenția ISO (isodow − 1) și exact ce
-- dă în JavaScript (getDay() + 6) % 7 — notat aici pentru că getDay() singur
-- dă 0 = DUMINICĂ, iar capcana asta a stricat destule calendare.
--
-- Depinde de 0053, 0055. Sigur la re-rulare.
-- =========================================================

create table if not exists public.planner_availability (
  id         uuid primary key default gen_random_uuid(),
  weekday    integer not null check (weekday between 0 and 6),
  start_min  integer not null,
  end_min    integer not null,
  created_at timestamptz not null default now(),

  constraint availability_order check (end_min > start_min),
  constraint availability_halves check (start_min % 30 = 0 and end_min % 30 = 0),
  constraint availability_hours check (start_min >= 8 * 60 and end_min <= 22 * 60)
);

create index if not exists planner_availability_weekday_idx
  on public.planner_availability (weekday, start_min);

alter table public.planner_availability enable row level security;

-- Elevii marcați CITESC ferestrele (din ele se nasc pastilele); scrie doar
-- profesorul.
drop policy if exists availability_read on public.planner_availability;
create policy availability_read on public.planner_availability for select
  using (public.has_planner_access());

drop policy if exists availability_admin_write on public.planner_availability;
create policy availability_admin_write on public.planner_availability for all
  using (public.is_admin_user()) with check (public.is_admin_user());

grant select, insert, update, delete on public.planner_availability to authenticated;

-- ---------- garda: rezervarea elevului stă ÎN fereastră ----------
-- Fără asta, lista de pastile ar fi doar o sugestie: un elev cu consola
-- deschisă ar putea insera orice interval. Regula care contează stă aici.
-- Profesorul e exceptat — el așază unde vrea, inclusiv peste program.
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
  -- Doar când se schimbă efectiv orele; altfel anularea unei rezervări vechi
  -- (update pe status) ar fi respinsă ca „în trecut".
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
    -- Conținere într-O SINGURĂ fereastră. Două ferestre lipite (16–18, 18–20)
    -- vor fi fost deja contopite la salvare (repo), deci cazul „încape doar
    -- peste hotarul dintre ele" nu există în date.
    if not exists (
      select 1 from public.planner_availability a
       where a.weekday = wd
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

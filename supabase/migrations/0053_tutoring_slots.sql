-- =========================================================
-- Migration 0053 — Planificatorul de meditații.
--
-- CUM SE REZOLVĂ CONFLICTELE. Doi elevi pot apăsa în aceeași milisecundă pe
-- același interval. Nicio verificare făcută înainte de scriere nu poate opri
-- asta: între „am citit că e liber" și „am scris" există întotdeauna o
-- fereastră, oricât de mică, iar sub trafic ea se nimerește.
--
-- Postgres are răspunsul potrivit, și nu e o verificare — e o imposibilitate.
-- O CONSTRÂNGERE DE EXCLUDERE pe un interval de timp declară că două rânduri
-- nu pot avea intervale care se suprapun. Indexul GiST o impune la nivelul
-- stocării: a doua scriere nu e respinsă de codul nostru, e respinsă de bază,
-- oricare ar fi ordinea, oricâți ar apăsa deodată. Unul reușește, ceilalți
-- primesc eroarea 23P01 și un mesaj omenesc.
--
-- Excluderea e PARȚIALĂ — se aplică doar rândurilor 'booked'. O rezervare
-- anulată nu mai ține locul ocupat, dar rămâne în tabel ca istoric.
--
-- Intervalul e scris '[)': începutul inclus, sfârșitul exclus. Așa o meditație
-- 16:00–18:00 și una 18:00–20:00 NU se suprapun, ceea ce e chiar ce vrea omul
-- când pune două ore cap la cap.
--
-- Depinde de 0001 (is_admin_user) și 0005 (event_access = „elevii marcați").
-- Sigur la re-rulare.
-- =========================================================

create extension if not exists btree_gist;

create table if not exists public.tutoring_slots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  note       text,
  status     text not null default 'booked' check (status in ('booked', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint tutoring_slots_order check (ends_at > starts_at),
  -- 60, 90 sau 120 de minute. Impus aici, nu doar în interfață: altfel o
  -- rezervare de opt ore ar fi la o cerere HTTP distanță.
  constraint tutoring_slots_len check (
    extract(epoch from (ends_at - starts_at)) in (3600, 5400, 7200)
  )
);

-- INIMA REZOLVĂRII CONFLICTELOR.
alter table public.tutoring_slots
  drop constraint if exists tutoring_slots_no_overlap;
alter table public.tutoring_slots
  add constraint tutoring_slots_no_overlap
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'booked');

create index if not exists tutoring_slots_when_idx
  on public.tutoring_slots (starts_at);
create index if not exists tutoring_slots_user_idx
  on public.tutoring_slots (user_id, starts_at desc);

alter table public.tutoring_slots enable row level security;

-- „Elev marcat" = cel căruia profesorul i-a dat deja acces la Evenimente, din
-- fila Utilizatori. Refolosit intenționat: un al doilea mecanism de marcare ar
-- fi însemnat două locuri de ținut la zi și, până la urmă, două adevăruri.
create or replace function public.has_planner_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user()
      or exists (select 1 from public.event_access where user_id = auth.uid());
$$;

-- CITIRE. Toți cei marcați văd toate rezervările — trebuie, altfel n-ar ști ce
-- e liber. CINE a rezervat e o altă discuție: numele se filtrează în interfață,
-- profesorul le vede pe toate, elevul doar pe al lui.
drop policy if exists tutoring_read on public.tutoring_slots;
create policy tutoring_read on public.tutoring_slots for select
  using (public.has_planner_access());

-- SCRIERE. Elevul rezervă doar pentru el însuși; profesorul, pentru oricine.
drop policy if exists tutoring_insert on public.tutoring_slots;
create policy tutoring_insert on public.tutoring_slots for insert
  with check (
    public.has_planner_access()
    and (user_id = auth.uid() or public.is_admin_user())
  );

drop policy if exists tutoring_update on public.tutoring_slots;
create policy tutoring_update on public.tutoring_slots for update
  using (user_id = auth.uid() or public.is_admin_user())
  with check (user_id = auth.uid() or public.is_admin_user());

drop policy if exists tutoring_delete on public.tutoring_slots;
create policy tutoring_delete on public.tutoring_slots for delete
  using (user_id = auth.uid() or public.is_admin_user());

grant select, insert, update, delete on public.tutoring_slots to authenticated;

-- Programul zilei. Ținut aici, lângă date, ca să nu poată fi ocolit dintr-un
-- client: o rezervare la 3 dimineața e refuzată de bază, nu de o validare din
-- JavaScript pe care oricine o poate sări.
create or replace function public.tutoring_within_hours()
returns trigger
language plpgsql
as $$
declare
  h_start int := 8;
  h_end   int := 22;
  -- `timestamptz at time zone 'X'` produces a TIMESTAMP WITHOUT time zone — the
  -- wall clock in Bucharest. It has to be declared as such: assigning it to a
  -- timestamptz would cast it straight back using the server's own zone, and
  -- the hours would only come out right by accident, on a server that happens
  -- to run on UTC.
  s timestamp := new.starts_at at time zone 'Europe/Bucharest';
  e timestamp := new.ends_at   at time zone 'Europe/Bucharest';
begin
  if extract(hour from s) < h_start
     or (extract(hour from e) * 60 + extract(minute from e)) > h_end * 60 then
    raise exception 'Ora aleasă e în afara programului (% - %).', h_start, h_end
      using errcode = 'check_violation';
  end if;
  -- Sferturile n-au ce căuta aici: totul se lipește la jumătăți de oră.
  if extract(minute from s)::int % 30 <> 0 then
    raise exception 'Rezervările încep din jumătate în jumătate de oră.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists tutoring_hours_guard on public.tutoring_slots;
create trigger tutoring_hours_guard
  before insert or update on public.tutoring_slots
  for each row execute function public.tutoring_within_hours();

-- Actualizare în timp real: rezervarea altcuiva apare pe ecran în timp ce te
-- uiți la grilă. Asta EVITĂ ciocnirile; excluderea de mai sus doar le tratează
-- pe cele care tot se întâmplă.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.tutoring_slots;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

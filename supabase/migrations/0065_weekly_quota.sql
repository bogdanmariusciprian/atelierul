-- =========================================================
-- Migration 0065 — Cota săptămânală a elevului.
--
-- Un elev are dreptul, implicit, la O SINGURĂ oră pe săptămână; profesorul
-- poate ridica limita la 2 sau 3 din editorul bulinei. Regula e ADEVĂR DE
-- SERVER: garda refuză insertul (sau mutarea într-o altă săptămână) care ar
-- depăși cota — clientul doar o oglindește în fantomă, ca refuzul să se vadă
-- sub deget, nu după drop.
--
-- Adminul e exceptat cu totul: el plantează câte ore vrea (seriile lui,
-- recuperări, cazuri speciale). Săptămâna = luni–duminică, pe ceasul
-- Europe/Bucharest (date_trunc 'week' e ancorat pe luni).
--
-- Funcția e re-creată integral pe temelia lui 0061. Depinde de 0061 + 0063.
-- Sigură la re-rulare.
-- =========================================================

alter table public.planner_pupils
  add column if not exists planner_max_weekly int not null default 1
  check (planner_max_weekly between 1 and 3);

comment on column public.planner_pupils.planner_max_weekly is
  'Câte ore pe săptămână are voie elevul să-și pună singur (adminul nu e limitat).';

create or replace function public.tutoring_within_hours()
returns trigger
language plpgsql
as $$
declare
  h_start int := 8;
  h_end   int := 22;
  s timestamp := new.starts_at at time zone 'Europe/Bucharest';
  e timestamp := new.ends_at   at time zone 'Europe/Bucharest';
  s_min int := extract(hour from s)::int * 60 + extract(minute from s)::int;
  e_min int := extract(hour from e)::int * 60 + extract(minute from e)::int;
  wd    int := extract(isodow from s)::int - 1; -- 0 = luni … 6 = duminică
  v_max int;
  times_changed boolean := tg_op = 'INSERT'
    or new.starts_at is distinct from old.starts_at
    or new.ends_at   is distinct from old.ends_at;
begin
  -- 0061: trecutul e închis pentru non-admini, indiferent ce coloană se
  -- schimbă (anularea atinge doar statusul, deci stă ÎNAINTEA scurtăturii).
  if not public.is_admin_user()
     and tg_op = 'UPDATE'
     and old.starts_at < now() - interval '5 minutes' then
    raise exception 'Ora din trecut rămâne în istoric — vorbește cu profesorul dacă e o greșeală.'
      using errcode = 'check_violation';
  end if;

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
    if not exists (
      select 1 from public.planner_availability a
       where ((a.on_date is null and a.weekday = wd) or a.on_date = s::date)
         and a.start_min <= s_min
         and a.end_min   >= e_min
    ) then
      raise exception 'Ora aleasă e în afara disponibilității profesorului.'
        using errcode = 'check_violation';
    end if;

    -- 0065: cota săptămânală. Se verifică la INSERT și la mutarea într-o
    -- ALTĂ săptămână (blocul propriu se exclude din numărătoare, ca mutarea
    -- în aceeași săptămână să rămână liberă).
    if coalesce(new.kind, 'lesson') = 'lesson' then
      select coalesce(planner_max_weekly, 1) into v_max
        from public.planner_pupils where user_id = new.user_id;
      if (select count(*)
            from public.planner_slots x
           where x.user_id = new.user_id
             and x.status = 'booked'
             and coalesce(x.kind, 'lesson') = 'lesson'
             and x.id <> new.id
             and date_trunc('week', x.starts_at at time zone 'Europe/Bucharest')
               = date_trunc('week', new.starts_at at time zone 'Europe/Bucharest'))
         >= coalesce(v_max, 1) then
        raise exception 'Ai deja % săptămâna asta — profesorul îți poate mări cota.',
          case when coalesce(v_max, 1) = 1 then 'ora' else 'orele' end
          using errcode = 'check_violation';
      end if;
    end if;
  end if;
  return new;
end;
$$;

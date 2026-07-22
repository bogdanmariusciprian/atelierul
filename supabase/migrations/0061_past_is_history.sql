-- =========================================================
-- Migration 0061 — Trecutul e istorie (pentru elevi).
--
-- Gaura închisă aici: un elev își putea ANULA o oră deja ținută (update pe
-- status nu schimbă orele, deci garda veche — care se uita doar la ore — îl
-- lăsa să treacă). O oră ținută e istoric: poate ajunge în evidența și în
-- socoteala profesorului. De acum, un non-admin nu mai poate modifica NICIO
-- rezervare din trecut — nici statusul, nici nota. Profesorul poate oricând
-- (el își curăță singur istoricul, iar blocurile lui personale îi aparțin).
--
-- Restul funcției e identic cu 0059. Depinde de 0059. Sigur la re-rulare.
-- =========================================================

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
  times_changed boolean := tg_op = 'INSERT'
    or new.starts_at is distinct from old.starts_at
    or new.ends_at   is distinct from old.ends_at;
begin
  -- NOU (0061): trecutul e închis pentru non-admini, indiferent ce coloană
  -- se schimbă. Verificarea stă ÎNAINTEA scurtăturii times_changed tocmai
  -- pentru că anularea (status) nu atinge orele.
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
  end if;
  return new;
end;
$$;

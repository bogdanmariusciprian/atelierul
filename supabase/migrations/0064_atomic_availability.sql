-- =========================================================
-- Migration 0064 — Contopirea ferestrelor devine ATOMICĂ.
--
-- Autopsia: clientul făcea contopirea în doi pași — DELETE pe ferestrele
-- atinse, apoi INSERT cu fereastra unită. Orice eșec între ele (clasic:
-- insertul cu on_date refuzat cât timp 0059 nu era aplicată) lăsa ștergerea
-- fără insert. Așa s-a golit planner_availability, fereastră cu fereastră,
-- fără nicio eroare vizibilă la locul faptei.
--
-- De acum ambele operații trăiesc într-o singură funcție = o singură
-- tranzacție: ori se întâmplă tot, ori nu se întâmplă nimic.
--
-- Semantica absorbției e IDENTICĂ cu cea veche din client: o singură trecere
-- peste ferestrele care ating intervalul cerut (invariantul „ferestrele unei
-- zile sunt disjuncte" face închiderea tranzitivă inutilă).
--
-- Depinde de 0059. Sigur la re-rulare.
-- =========================================================

create or replace function public.replace_availability_window(
  p_weekday   int,
  p_start_min int,
  p_end_min   int,
  p_on_date   date default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids   uuid[];
  v_start int;
  v_end   int;
begin
  if not public.is_admin_user() then
    raise exception 'Doar profesorul deschide ferestre.' using errcode = '42501';
  end if;

  select coalesce(array_agg(id), '{}'),
         least(p_start_min, coalesce(min(start_min), p_start_min)),
         greatest(p_end_min, coalesce(max(end_min), p_end_min))
    into v_ids, v_start, v_end
    from public.planner_availability
   where ((p_on_date is null and on_date is null and weekday = p_weekday)
          or (p_on_date is not null and on_date = p_on_date))
     and start_min <= p_end_min
     and end_min   >= p_start_min;

  delete from public.planner_availability where id = any(v_ids);

  insert into public.planner_availability (weekday, start_min, end_min, on_date)
  values (p_weekday, v_start, v_end, p_on_date);
end;
$$;

create or replace function public.resize_availability_window(
  p_id        uuid,
  p_start_min int,
  p_end_min   int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wd   int;
  v_date date;
  v_ids  uuid[];
  v_s    int;
  v_e    int;
begin
  if not public.is_admin_user() then
    raise exception 'Doar profesorul ajustează ferestre.' using errcode = '42501';
  end if;

  update public.planner_availability
     set start_min = p_start_min, end_min = p_end_min
   where id = p_id
  returning weekday, on_date into v_wd, v_date;
  if not found then return; end if;

  -- Întinsă peste un vecin? Absorbție în ACEEAȘI tranzacție.
  select array_agg(id), min(start_min), max(end_min)
    into v_ids, v_s, v_e
    from public.planner_availability
   where ((v_date is null and on_date is null and weekday = v_wd)
          or (v_date is not null and on_date = v_date))
     and start_min <= p_end_min
     and end_min   >= p_start_min;

  if array_length(v_ids, 1) > 1 then
    delete from public.planner_availability where id = any(v_ids);
    insert into public.planner_availability (weekday, start_min, end_min, on_date)
    values (v_wd, v_s, v_e, v_date);
  end if;
end;
$$;

grant execute on function public.replace_availability_window(int, int, int, date) to authenticated;
grant execute on function public.resize_availability_window(uuid, int, int) to authenticated;

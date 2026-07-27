-- =========================================================
-- Migration 0073 — Cota oprea și MUTAREA, nu doar rezervarea.
--
-- SIMPTOMUL: elevul apasă „confirmă" pe o ofertă de schimb și primește
-- „Ai deja ora săptămâna asta — profesorul îți poate mări cota.", deși are o
-- singură oră. Mesajul nici măcar nu e despre el.
--
-- CE SE ÎNTÂMPLA, verificat pe date reale: `accept_swap` face două UPDATE-uri
-- pe `starts_at`, câte unul pentru fiecare bloc. Garda din 0065 se aprinde la
-- orice schimbare de ore și numără câte lecții mai are elevul în săptămâna în
-- care ajunge blocul. Elevul care OFERISE avea două ore în acea săptămână —
-- puse de profesor, care nu e limitat de cotă — iar cota lui de auto-servire e
-- 1. Deci numărătoarea dădea 1 >= 1 și schimbul cădea. Refuzul era al lui, dar
-- mesajul ajungea la celălalt.
--
-- DE CE E GREȘITĂ REGULA, nu doar cazul: cota răspunde la întrebarea „câte ore
-- își poate pune singur un elev pe săptămână". Mutarea unui bloc dintr-o zi în
-- alta, în ACEEAȘI săptămână, nu schimbă răspunsul — numărul rămâne același.
-- Cum era scrisă, orice elev căruia profesorul i-a dat mai multe ore decât cota
-- lui rămânea încremenit: nu-și putea muta nicio oră și nu putea face niciun
-- schimb, pentru totdeauna.
--
-- REPARAȚIA: cota se verifică doar când blocul CHIAR INTRĂ într-o săptămână
-- nouă. La inserare, mereu. La mutare, numai dacă săptămâna se schimbă. O
-- mutare în interiorul săptămânii nu mai e întrebată, fiindcă n-are ce
-- răspunde altfel.
--
-- Plus: dacă refuzul e al altcuiva (schimb), mesajul o spune. „Ai deja ora
-- săptămâna asta" citit de cineva care are una singură e derutant până la a
-- părea un bug al programului.
--
-- Depinde de 0061 + 0063 + 0065. Sigură la re-rulare.
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
  v_max int;
  times_changed boolean := tg_op = 'INSERT'
    or new.starts_at is distinct from old.starts_at
    or new.ends_at   is distinct from old.ends_at;
  -- 0073: blocul intră într-o săptămână în care nu era? Doar atunci cota are
  -- ceva de spus. La INSERT, întotdeauna.
  saptamana_noua boolean := tg_op = 'INSERT'
    or date_trunc('week', old.starts_at at time zone 'Europe/Bucharest')
       is distinct from
       date_trunc('week', new.starts_at at time zone 'Europe/Bucharest');
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

    -- 0065 + 0073: cota săptămânală, dar numai la INTRAREA într-o săptămână.
    -- Mutarea în interiorul aceleiași săptămâni (inclusiv orice schimb de ore
    -- din `accept_swap`) nu schimbă câte ore are elevul acolo, deci nu are ce
    -- să încalce. Blocul propriu rămâne exclus din numărătoare.
    if coalesce(new.kind, 'lesson') = 'lesson' and saptamana_noua then
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
        -- Cine citește mesajul nu e neapărat cel refuzat: la un schimb, blocul
        -- celuilalt e mutat în aceeași tranzacție, iar eroarea lui ajunge pe
        -- ecranul celui care a apăsat „confirmă".
        if new.user_id = auth.uid() then
          raise exception 'Ai deja % săptămâna asta — profesorul îți poate mări cota.',
            case when coalesce(v_max, 1) = 1 then 'ora' else 'orele' end
            using errcode = 'check_violation';
        else
          raise exception 'Celălalt elev are deja % în săptămâna aceea, deci schimbul nu se poate face.',
            case when coalesce(v_max, 1) = 1 then 'ora lui' else 'orele lui' end
            using errcode = 'check_violation';
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.tutoring_within_hours() is
  'Garda de server pentru orele elevilor: program, disponibilitate, trecut și '
  'cota săptămânală. 0073: cota se verifică doar la intrarea într-o săptămână '
  'nouă — mutarea sau schimbul în aceeași săptămână nu schimbă numărul.';

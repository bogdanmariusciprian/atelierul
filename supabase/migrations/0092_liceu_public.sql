-- =========================================================
-- 0092 · LICEU: citirea se deschide tuturor
--
-- Marius, 15 septembrie 2026: „vreau totul public, deocamdată". Modulul „Liceu"
-- e deschis oricui, iar cardul cu ora trebuie să se vadă și pentru un vizitator
-- nelogat, nu doar pentru profesor.
--
-- SE DESCHIDE CITIREA, NU SCRIEREA. Sunt două lucruri deosebite, iar 0091 le
-- ținea pe amândouă sub aceeași cheie. Aici:
--   · oricine POATE CITI orarul, structura anului și planificările;
--   · numai profesorul POATE SCRIE în ele.
-- Fără despărțirea asta, „public" ar fi însemnat că oricine poate și șterge
-- planificarea unei clase, ceea ce nu s-a cerut niciodată.
--
-- CE ÎNSEAMNĂ, PE ȘLEAU: din clipa asta, orarul (clase, săli, ceasuri) și tot
-- cuprinsul planificărilor, inclusiv noțiunile și vorbele „pentru fișa de
-- bacalaureat", se pot citi de oricine ajunge pe sit, și de oricine cheamă
-- direct interfața bazei. E o hotărâre luată în cunoștință de cauză, pentru
-- perioada asta. Ca s-o întorci, se schimbă UN SINGUR loc: politica de citire
-- de mai jos. Vezi de ce, la funcție.
-- =========================================================

-- ---------- 1. poarta întâi: drepturile pe tabel ----------
/* `anon` = vizitatorul nelogat. Capătă NUMAI `select`; scrierile nici nu ajung
   la politici, sunt oprite aici. */
grant select on public.school_config     to anon;
grant select on public.school_timetable  to anon;
grant select on public.school_plan_meta  to anon;
grant select on public.school_plan       to anon;

-- ---------- 2. poarta a doua: politicile ----------
/* Politicile îngăduitoare se adună cu SAU. Deci o politică de citire „pentru
   toți" lângă cea de profesor înseamnă: citește oricine, scrie doar el. */
do $$
declare t text;
begin
  foreach t in array array['school_config','school_timetable','school_plan_meta','school_plan'] loop
    execute format('drop policy if exists %I on public.%I', t || '_citire', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_citire', t);
    /* Politica de profesor rămâne cum era (`for all`), deci scrierile stau tot
       la el. N-o atingem. */
  end loop;
end $$;

-- ---------- 3. funcția zilei nu-și mai face singură paza ----------
/*
 * DE CE NU MAI E `security definer`.
 *
 * În 0091, funcția trecea pe lângă politici și întreba ea însăși dacă ești
 * profesor. Erau două porți care trebuiau ținute în acord de mână: dacă mâine
 * strâmtezi politica de citire și uiți funcția, datele ar fi continuat să iasă
 * prin ea, nestingherite. Asta e felul cel mai urât de scurgere: una care arată
 * închisă în locul unde te uiți.
 *
 * Acum e `security invoker` (cum e din oficiu) și nu mai întreabă nimic:
 * citește ca cel care o cheamă, deci se supune EXACT politicilor de mai sus.
 * Când vrei s-o închizi la loc, schimbi politica de citire și se închide și ea,
 * fără să ții minte că mai există un loc.
 */
drop function if exists public.liceu_azi(date);
create function public.liceu_azi(p_data date default current_date)
returns table (
  period      text,
  clasa       text,
  sala        text,
  ora_start   text,
  ora_sfarsit text,
  plan_id     uuid,
  nr          integer,
  din_cate    integer,
  unitatea    text,
  titlu       text,
  fel         text
)
language plpgsql stable set search_path to 'public'
as $$
declare z text; an text := '2026-2027';
begin
  z := (array['luni','marti','miercuri','joi','vineri','sambata','duminica'])
         [extract(isodow from p_data)::int];

  return query
  with
  deLa as (
    select max(t.valabil_de_la) as d
      from public.school_timetable t
     where t.an_scolar = an and t.valabil_de_la <= p_data
  ),
  iv as (
    select e->>'id' as id, e->>'start' as inceput, e->>'end' as sfarsit
      from public.school_config c, jsonb_array_elements(c.valoare) e
     where c.cheie = 'intervale'
  )
  select t.period, t.clasa, t.sala, iv.inceput, iv.sfarsit,
         p.id, p.nr,
         nullif(m.totaluri->>'ore', '')::int,
         p.unitatea, p.titlu, p.fel
    from public.school_timetable t
    join deLa on t.valabil_de_la = deLa.d
    join iv on iv.id = t.period
    left join public.school_plan p
           on p.clasa = t.clasa and p.an_scolar = t.an_scolar
          and p.data = p_data and p.ora = iv.inceput
    left join public.school_plan_meta m
           on m.clasa = t.clasa and m.an_scolar = t.an_scolar
   where t.an_scolar = an and t.zi = z
   order by iv.inceput::time;
end;
$$;

revoke all on function public.liceu_azi(date) from public;
grant execute on function public.liceu_azi(date) to anon, authenticated;

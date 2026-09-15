-- =========================================================
-- 0091 · LICEU: orarul, structura anului, planificările
--
-- Atât cât hrănește cardul din dreapta jos al modulului „Liceu": ce oră e acum
-- ori ce urmează, la ce clasă, în ce sală, a câta din an și peste cât.
--
-- PATRU HOTĂRÂRI:
--
-- 1. NUMAI AL PROFESORULUI. Modulul „Liceu" e public, dar tabelele de aici nu:
--    o singură politică, `is_admin_user()`, și zero drepturi pentru `anon`.
--    Pagina se deschide la oricine; cardul se desenează doar pentru el. Paza nu
--    e ascunderea numelor din cod (codul e public și trebuie să fie), ci
--    politica din bază.
--
-- 2. ORARUL ARE O DATĂ DE LA CARE E VALABIL. Anul ăsta a și dovedit-o: în
--    prima săptămână de școală (7–11 septembrie) orarul a fost altul, iar din
--    14 septembrie s-a schimbat. Fără `valabil_de_la`, a doua schimbare (un
--    semestru nou, o sală mutată) ar fi cerut ștergerea celui vechi, iar orele
--    de dinainte ar fi rămas fără orar. Așa, orarele se așază unul peste altul
--    în timp, iar o zi din octombrie își găsește singură orarul ei.
--
-- 3. PLANIFICAREA ȚINE DATA ȘI CEASUL, nu numai săptămâna. Ea e cea care spune
--    „a 4-a oră din 95, pe 15 septembrie, la 15:40". Cardul întâlnește orarul
--    cu planificarea pe (clasă, dată, ceas); fără ceas, întâlnirea n-ar avea
--    cum să se facă la o clasă cu două ore în aceeași zi.
--
-- 4. CUPRINSUL BOGAT AL UNEI ORE STĂ ÎN `jsonb`. Noțiunile, activitățile,
--    competențele și vorba „pentru fișa de bacalaureat" se iau întregi și nu se
--    caută niciodată după ele. Ce se caută (unitatea, titlul, felul) e ridicat
--    în coloane.
-- =========================================================

-- ---------- 1. ce se citește întreg: structura anului, intervalele ----------
create table if not exists public.school_config (
  cheie      text primary key,
  valoare    jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.school_config is
  'Chei: structura (an, module, săptămâni, vacanțe, zile libere), intervale (ceasurile orelor), scoala.';

-- ---------- 2. orarul, cu data de la care e valabil ----------
create table if not exists public.school_timetable (
  id            uuid primary key default gen_random_uuid(),
  an_scolar     text not null default '2026-2027',
  /* De la ce zi ține orarul ăsta. Cel de acum: 14 septembrie 2026. */
  valabil_de_la date not null default date '2026-09-14',
  zi            text not null check (zi in ('luni','marti','miercuri','joi','vineri')),
  /* Numărul intervalului din `school_config.intervale`. Coloana NU se cheamă
     `interval`: e cuvânt rezervat în Postgres, iar o funcție cu
     `returns table (interval text, …)` nu se compilează. */
  period        text not null,
  clasa         text not null,
  sala          text,
  unique (an_scolar, valabil_de_la, zi, period, clasa)
);

create index if not exists school_timetable_zi
  on public.school_timetable (an_scolar, valabil_de_la, zi);

-- ---------- 3. antetul planificării, pe clasă ----------
create table if not exists public.school_plan_meta (
  clasa      text not null,
  an_scolar  text not null default '2026-2027',
  disciplina text,
  programa   text,
  structura  text,
  /* `totaluri.ore` e chiar numitorul din „4/95". */
  totaluri   jsonb not null default '{}'::jsonb,
  competente jsonb not null default '{}'::jsonb,
  generat_la timestamptz,
  primary key (clasa, an_scolar)
);

-- ---------- 4. planificarea: un rând pe oră ----------
create table if not exists public.school_plan (
  id        uuid primary key default gen_random_uuid(),
  clasa     text not null,
  an_scolar text not null default '2026-2027',

  nr        integer not null,        -- a câta oră din an, la clasa asta
  saptamana integer,
  zi        text,
  data      date not null,
  ora       text not null,           -- ceasul de început, ca în orar: „15:40"

  fel       text not null default 'lectie',
  unitatea  text,
  titlu     text,
  blocuri   jsonb not null default '[]'::jsonb,

  unique (clasa, an_scolar, data, ora)
);

create index if not exists school_plan_clasa on public.school_plan (clasa, an_scolar, nr);
create index if not exists school_plan_data  on public.school_plan (an_scolar, data);

-- =========================================================
-- PAZA: aceeași pe toate. Un singur fel de om intră aici.
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array['school_config','school_timetable','school_plan_meta','school_plan'] loop
    execute format('alter table public.%I enable row level security', t);
    /* Poarta întâi: drepturile pe tabel. `anon` nu primește nimic, nici select. */
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    /* Poarta a doua: politica. Un cont de elev e `authenticated`, deci trece de
       prima; aici e oprit, fiindcă `is_admin_user()` întreabă serverul. */
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_admin_user()) with check (public.is_admin_user())',
      t || '_admin', t);
  end loop;
end $$;

-- =========================================================
-- ZIUA DE AZI, ÎNTR-O SINGURĂ CERERE.
--
-- Cardul are nevoie, deodată, de: orele zilei din orar, ceasurile lor,
-- lecția fiecăreia din planificare, a câta e din an și din câte. Patru izvoare.
-- Fără funcția asta ar fi fost patru drumuri la server și trei alăturări făcute
-- în browser, pentru o singură întrebare.
--
-- ORARUL SE ALEGE DUPĂ DATĂ: cel mai nou dintre cele care încep înainte de ziua
-- cerută. Așa, o zi din prima săptămână își găsește orarul vechi, iar una de azi
-- pe cel nou, fără ca cineva să aleagă de mână.
-- =========================================================
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
language plpgsql stable security definer set search_path to 'public'
as $$
declare z text; an text := '2026-2027';
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;

  /* Ziua din săptămână, ca în orar. `isodow` dă 1 pentru luni. */
  z := (array['luni','marti','miercuri','joi','vineri','sambata','duminica'])
         [extract(isodow from p_data)::int];

  return query
  with
  /* orarul în vigoare în ziua cerută */
  deLa as (
    select max(t.valabil_de_la) as d
      from public.school_timetable t
     where t.an_scolar = an and t.valabil_de_la <= p_data
  ),
  /* ceasurile intervalelor, desfăcute din jsonb */
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
    /* Ora din orar se întâlnește cu planificarea pe clasă, dată și ceas. */
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
grant execute on function public.liceu_azi(date) to authenticated;

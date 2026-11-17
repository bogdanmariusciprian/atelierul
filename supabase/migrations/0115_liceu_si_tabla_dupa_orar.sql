-- =========================================================
-- 0115 · LICEUL ȘI TABLA ALBĂ SE DESCHID SINGURE, DUPĂ ORAR
--
-- Cererea lui Marius (17 noiembrie 2026):
--   • Liceul (modulul) se deschide singur pentru vizitatori, logați ori nu, în
--     timpul orelor din orar (de la 2 minute înainte până la 2 minute după).
--     Butonul lui îl poate deschide oricând; restul e automat.
--   • Tabla albă nu mai are coduri. Un elev vede tabla unei clase doar dacă e
--     deschis Liceul, dacă profesorul a lăsat-o „Deschisă" și dacă e ora
--     clasei după orar (±2 minute). Profesorul intră oricând.
--
-- PAGINA ADMITERII LA DREPT NU SE ATINGE. Bara sitului (cu „L"-ul și butonul
-- „Liceu") citește semnul scris de mână din `school_config`, nu funcția de mai
-- jos; semnul acela rămâne cum era. Se schimbă doar `liceu_deschis()`, pe care
-- o întreabă politicile Liceului și pagina modulului.
--
-- 1. `liceu_la_ora(clasa)`: e acum, la ora României, o oră din orar (a clasei
--    date, ori a oricărei clase), într-o zi de curs, nu în vacanță, nu într-o
--    zi liberă? Cu 2 minute în plus la ambele capete.
-- 2. `liceu_deschis()` = semnul scris de mână SAU o oră din orar acum.
-- 3. Tabla albă: comutatorul `deschisa` pe clasă; codurile nu mai deschid
--    nimic (funcțiile cu cod se șterg); vizitatorul intră după numele clasei
--    și primește doar cât e vizibilă tabla. Canalul live, la fel.
--
-- Se poate rula de mai multe ori.
-- =========================================================

-- ---------- 1. e oră acum? ----------
create or replace function public.liceu_la_ora(p_clasa text default null)
returns boolean
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  acum timestamp := now() at time zone 'Europe/Bucharest';
  d    date := acum::date;
  t    time := acum::time;
  z    text;
  s    jsonb;
begin
  select valoare into s from public.school_config where cheie = 'structura';
  if s is not null then
    if d < (s->'cursuri'->>'start')::date or d > (s->'cursuri'->>'sfarsit')::date then
      return false;
    end if;
    if exists (select 1 from jsonb_array_elements(coalesce(s->'vacante', '[]'::jsonb)) v
               where d between (v->>'start')::date and (v->>'sfarsit')::date) then
      return false;
    end if;
    if exists (select 1 from jsonb_array_elements(coalesce(s->'zileLibere', '[]'::jsonb)) v
               where (v->>'data')::date = d) then
      return false;
    end if;
  end if;
  z := (array['luni','marti','miercuri','joi','vineri','sambata','duminica'])[extract(isodow from d)::int];
  return exists (
    select 1
      from public.school_timetable tt
      join public.school_config c on c.cheie = 'intervale'
      cross join lateral jsonb_array_elements(c.valoare) e
     where tt.valabil_de_la = (select max(x.valabil_de_la) from public.school_timetable x where x.valabil_de_la <= d)
       and tt.zi = z
       and e->>'id' = tt.period
       and (p_clasa is null or lower(btrim(tt.clasa)) = lower(btrim(p_clasa)))
       and t between ((e->>'start')::time - interval '2 minutes') and ((e->>'end')::time + interval '2 minutes'));
exception when others then
  -- un orar ori o structură stricată închide, nu deschide
  return false;
end;
$$;

revoke all on function public.liceu_la_ora(text) from public;
grant execute on function public.liceu_la_ora(text) to anon, authenticated;

-- ---------- 2. Liceul: de mână ori după orar ----------
create or replace function public.liceu_deschis()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (valoare->>'da')::boolean from public.school_config where cheie = 'liceu_deschis'),
    false
  ) or public.liceu_la_ora(null);
$$;

-- ---------- 3. tabla albă: deschisă de profesor, la ora clasei ----------
alter table public.tabla_alba_clase add column if not exists deschisa boolean not null default false;
alter table public.tabla_alba_clase alter column cod drop not null;
comment on column public.tabla_alba_clase.deschisa is
  'Profesorul lasă tabla clasei deschisă; elevii o văd doar la ora clasei din orar, cu Liceul deschis (0115).';

-- Codurile nu mai deschid nimic.
drop function if exists public.tabla_alba_intra_clasa(text);
drop function if exists public.tabla_alba_intra(text);
drop function if exists public.tabla_alba_pagini_lectiei(text, uuid);
drop function if exists public.tabla_alba_material(text, uuid);

/* Vede vizitatorul acum tabla clasei? Adminul, oricând. */
create or replace function public.tabla_alba_vizibila(p_clasa uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select public.is_admin_user() or exists (
    select 1 from public.tabla_alba_clase c
     where c.id = p_clasa and c.deschisa
       and public.liceu_deschis() and public.liceu_la_ora(c.nume));
$$;

/* Clasele cu tabla deschisă acum (doar numele), pentru /tabla/. */
create or replace function public.tabla_alba_deschise()
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('nume', c.nume) order by c.ordine, c.creat_la), '[]'::jsonb)
    from public.tabla_alba_clase c
   where c.deschisa and public.liceu_deschis() and public.liceu_la_ora(c.nume);
$$;

/* Clasa după nume („10D"), cu starea și lecțiile ei, doar cât e vizibilă. */
create or replace function public.tabla_alba_intra_clasa(p_nume text)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  c public.tabla_alba_clase;
begin
  if p_nume is null or char_length(btrim(p_nume)) not between 1 and 40 then
    return null;
  end if;
  select * into c from public.tabla_alba_clase
   where lower(btrim(nume)) = lower(btrim(p_nume))
   order by ordine, creat_la limit 1;
  if not found or not public.tabla_alba_vizibila(c.id) then
    return null;
  end if;
  return jsonb_build_object(
    'id', c.id, 'nume', c.nume, 'stare', c.stare,
    'lectii', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'titlu', l.titlu, 'ordine', l.ordine,
                          'material', l.material) order by l.ordine, l.creat_la)
                        from public.tabla_alba_lectii l where l.clasa_id = c.id), '[]'::jsonb));
end;
$$;

create or replace function public.tabla_alba_pagini_clasei(p_clasa uuid, p_lectie uuid)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select case when not public.tabla_alba_vizibila(p_clasa) then null else
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'ordine', p.ordine, 'desen', p.desen)
                               order by p.ordine, p.actualizat_la)
                from public.tabla_alba_pagini p
                join public.tabla_alba_lectii l on l.id = p.lectie_id
               where l.id = p_lectie and l.clasa_id = p_clasa), '[]'::jsonb) end;
$$;

create or replace function public.tabla_alba_material_clasei(p_clasa uuid, p_lectie uuid)
returns text
language sql stable security definer set search_path to 'public'
as $$
  select l.material_html
    from public.tabla_alba_lectii l
   where l.id = p_lectie and l.clasa_id = p_clasa and public.tabla_alba_vizibila(p_clasa);
$$;

/* Canalul live: doar al unei clase cu tabla vizibilă acum. */
create or replace function public.tabla_alba_canal_bun(p_topic text)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.tabla_alba_clase c
                  where 'tabla-alba:' || c.id::text = p_topic and public.tabla_alba_vizibila(c.id));
$$;

revoke all on function public.tabla_alba_vizibila(uuid) from public;
revoke all on function public.tabla_alba_deschise() from public;
revoke all on function public.tabla_alba_intra_clasa(text) from public;
revoke all on function public.tabla_alba_pagini_clasei(uuid, uuid) from public;
revoke all on function public.tabla_alba_material_clasei(uuid, uuid) from public;
grant execute on function public.tabla_alba_vizibila(uuid) to anon, authenticated;
grant execute on function public.tabla_alba_deschise() to anon, authenticated;
grant execute on function public.tabla_alba_intra_clasa(text) to anon, authenticated;
grant execute on function public.tabla_alba_pagini_clasei(uuid, uuid) to anon, authenticated;
grant execute on function public.tabla_alba_material_clasei(uuid, uuid) to anon, authenticated;

-- ---------- PAZA ----------
do $$
begin
  if exists (select 1 from pg_proc where proname in ('tabla_alba_intra', 'tabla_alba_pagini_lectiei', 'tabla_alba_material')
               and pronamespace = 'public'::regnamespace) then
    raise exception '0115: a rămas o funcție care deschide tabla cu cod';
  end if;
  if position('liceu_la_ora' in pg_get_functiondef('public.liceu_deschis()'::regprocedure)) = 0 then
    raise exception '0115: liceu_deschis() nu ține cont de orar';
  end if;
  if position('deschisa' in pg_get_functiondef('public.tabla_alba_vizibila(uuid)'::regprocedure)) = 0 then
    raise exception '0115: tabla nu atârnă de comutatorul profesorului';
  end if;
end $$;

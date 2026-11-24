-- =========================================================
-- 0119 · TABLA ALBĂ: LOCUL LĂSAT DE PROFESOR
--
-- Cererea lui Marius (24 noiembrie 2026): „când mă plimb printre lecții din
-- cadrul aceleiași table/clase, să țină minte poziția tablei cum am lăsat-o eu
-- ultima oară". Din răspunsurile lui: se țin minte pagina, locul și mărirea
-- fiecărei pagini, fila (Tablă ori Material) și locul din material; iar un
-- elev care se plimbă singur pornește de unde a lăsat profesorul.
--
-- UNDE SE ȚIN:
--   tabla_alba_pagini.vedere        bucata de planșă pe care o vedea profesorul
--                                   pe pagina aceea: { x, y, w, h }, ca în
--                                   `stare.vedere`; null = încă n-a mișcat-o,
--                                   deci pagina se deschide cu tot desenul
--   tabla_alba_lectii.loc           { pagina, tab }: pe ce pagină și pe ce filă
--                                   a rămas în lecție
--   tabla_alba_lectii.loc_material  { cheie, slide, jurnal, derulari }: unde a
--                                   rămas în lecția HTML. E mare (jurnalul
--                                   apăsărilor), deci stă separat și se aduce
--                                   doar când se deschide materialul.
--
-- Starea clasei (`tabla_alba_clase.stare`) rămâne ce era: unde e profesorul
-- ACUM, pentru elevii care intră. Aici e ce a lăsat în urmă, pe fiecare lecție.
--
-- Elevul primește vederea paginilor odată cu ele (funcția de mai jos); locul
-- din lecție și cel din material sunt doar ale profesorului.
--
-- Se poate rula de mai multe ori.
-- =========================================================

alter table public.tabla_alba_pagini add column if not exists vedere jsonb
  check (vedere is null or (jsonb_typeof(vedere) = 'object' and pg_column_size(vedere) <= 400));
comment on column public.tabla_alba_pagini.vedere is
  'Bucata de planșă lăsată de profesor pe pagină: { x, y, w, h }; null = tot desenul (0119).';

alter table public.tabla_alba_lectii add column if not exists loc jsonb not null default '{}'::jsonb
  check (jsonb_typeof(loc) = 'object' and pg_column_size(loc) <= 600);
comment on column public.tabla_alba_lectii.loc is
  'Unde a rămas profesorul în lecție: { pagina, tab } (0119).';

alter table public.tabla_alba_lectii add column if not exists loc_material jsonb
  check (loc_material is null or (jsonb_typeof(loc_material) = 'object' and pg_column_size(loc_material) <= 300000));
comment on column public.tabla_alba_lectii.loc_material is
  'Unde a rămas profesorul în materialul lecției: { cheie, slide, jurnal, derulari } (0119).';

/* Paginile unei lecții, pentru vizitator: acum și cu vederea lăsată pe fiecare. */
create or replace function public.tabla_alba_pagini_clasei(p_clasa uuid, p_lectie uuid)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select case when not public.tabla_alba_vizibila(p_clasa) then null else
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'ordine', p.ordine, 'desen', p.desen, 'vedere', p.vedere)
                               order by p.ordine, p.actualizat_la)
                from public.tabla_alba_pagini p
                join public.tabla_alba_lectii l on l.id = p.lectie_id
               where l.id = p_lectie and l.clasa_id = p_clasa), '[]'::jsonb) end;
$$;

revoke all on function public.tabla_alba_pagini_clasei(uuid, uuid) from public;
grant execute on function public.tabla_alba_pagini_clasei(uuid, uuid) to anon, authenticated;

-- ---------- PAZA ----------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'tabla_alba_pagini' and column_name = 'vedere') then
    raise exception '0119: tabla_alba_pagini n-are coloana vedere';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'tabla_alba_lectii'
         and column_name in ('loc', 'loc_material')) <> 2 then
    raise exception '0119: tabla_alba_lectii n-are coloanele loc și loc_material';
  end if;
  /* Tabelele rămân ale adminului: vizitatorul nu citește nimic de-a dreptul. */
  if has_table_privilege('anon', 'public.tabla_alba_lectii', 'SELECT')
     or has_table_privilege('anon', 'public.tabla_alba_pagini', 'SELECT') then
    raise exception '0119: vizitatorul nelogat poate citi tabelele tablei';
  end if;
  if not has_function_privilege('anon', 'public.tabla_alba_pagini_clasei(uuid, uuid)', 'EXECUTE') then
    raise exception '0119: vizitatorul nu mai poate cere paginile clasei';
  end if;
end $$;

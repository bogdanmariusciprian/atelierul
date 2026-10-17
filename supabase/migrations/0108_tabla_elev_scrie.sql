-- =========================================================
-- 0108 · TABLA DE REDACTARE: și elevul pornit de profesor scrie enunțuri
--
-- Cererea lui Marius (17 octombrie 2026), la #LaTablă din „Redactare: de la 5
-- la 18 enunțuri": „vreau să poată și elevul să scrie. Poate un buton toggle
-- la admin care să permită unui anumit elev să scrie enunțurile."
--
-- 1. COMUTATORUL, PE ELEV: `planner_pupils.can_board`, ca `can_tag` (0088) și
--    `can_propose` (0087). Îl aprinde și îl stinge profesorul, din tablă.
--
-- 2. SCRIEREA PE BUCĂȚI. Până acum tabla se scria întreagă, dintr-o bucată
--    (0106), fiindcă scria un singur om. Cu doi oameni care scriu deodată, cel
--    care trimite al doilea ar fi șters ce scrisese primul între timp. Acum un
--    enunț se scrie singur, prin `scrie_enunt`, care schimbă doar locul lui în
--    `data`, sub lacăt pe rând. Doi oameni pe enunțuri diferite nu se mai calcă.
--
-- 3. PAZA E AICI, NU ÎN PAGINĂ. `scrie_enunt` întreabă la fiecare chemare dacă
--    scrie profesorul ori un elev pornit. Un elev stins e refuzat, oricum ar
--    chema funcția. Regulile de pe `tabla_live` (0106) rămân neatinse: scrierea
--    întreagă (treapta, tipul, fișa, golirea) e tot numai a adminului.
--
-- Se poate rula de mai multe ori.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Comutatorul, pe elev
-- ---------------------------------------------------------
alter table public.planner_pupils
  add column if not exists can_board boolean not null default false;

comment on column public.planner_pupils.can_board is
  'Elevul poate scrie enunțuri pe tabla de redactare (#LaTablă). Se aprinde și se stinge din tablă, de profesor (0108).';

/* `security definer`: elevul n-are voie să citească lista de la meditații, iar
   funcția întoarce doar da sau nu, despre cel care întreabă. */
create or replace function public.poate_scrie_tabla()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select public.is_admin_user()
      or exists (
        select 1 from public.planner_pupils
        where user_id = auth.uid() and can_board
      );
$$;

revoke all on function public.poate_scrie_tabla() from public;
grant execute on function public.poate_scrie_tabla() to authenticated;

-- ---------------------------------------------------------
-- 2. Un enunț, scris singur
-- ---------------------------------------------------------
/* Întoarce: 'gata', 'inchis' (n-ai voie acum) ori 'gresit' (date în afara
   formei). `p_n` e treapta (câte enunțuri are), `p_i` locul enunțului pe ea,
   numărat de la 0. Forma din `data` e cea din 0106:
     { tip, tipuri: { <tip>: { treapta, enunturi: { "<n>": [ "…", … ] } } }, fisa } */
create or replace function public.scrie_enunt(
  p_slug text, p_tip text, p_n int, p_i int, p_text text
)
returns text
language plpgsql security definer set search_path to 'public'
as $$
declare
  d   jsonb;
  sir jsonb;
begin
  if not public.poate_scrie_tabla() then
    return 'inchis';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9-]{3,60}$'
     or p_tip is null or p_tip !~ '^[a-z0-9-]{1,30}$'
     or p_n is null or p_n not between 1 and 40
     or p_i is null or p_i < 0 or p_i >= p_n
     or p_text is null or char_length(p_text) > 1000 then
    return 'gresit';
  end if;

  -- Rândul trebuie să existe ca să poată fi încuiat; apoi lacătul ține pe
  -- loc orice altă scriere până se termină asta.
  insert into public.tabla_live (slug) values (p_slug) on conflict (slug) do nothing;
  select data into d from public.tabla_live where slug = p_slug for update;
  d := coalesce(d, '{}'::jsonb);

  if jsonb_typeof(d -> 'tipuri') is distinct from 'object' then
    d := jsonb_set(d, '{tipuri}', '{}'::jsonb);
  end if;
  if jsonb_typeof(d -> 'tipuri' -> p_tip) is distinct from 'object' then
    d := jsonb_set(d, array['tipuri', p_tip], '{}'::jsonb);
  end if;
  if jsonb_typeof(d -> 'tipuri' -> p_tip -> 'enunturi') is distinct from 'object' then
    d := jsonb_set(d, array['tipuri', p_tip, 'enunturi'], '{}'::jsonb);
  end if;

  sir := d -> 'tipuri' -> p_tip -> 'enunturi' -> p_n::text;
  if jsonb_typeof(sir) is distinct from 'array' then
    sir := '[]'::jsonb;
  end if;
  while jsonb_array_length(sir) < p_n loop
    sir := sir || '[""]'::jsonb;
  end loop;
  sir := jsonb_set(sir, array[p_i::text], to_jsonb(p_text));

  d := jsonb_set(d, array['tipuri', p_tip, 'enunturi', p_n::text], sir);
  update public.tabla_live set data = d, actualizat_la = now() where slug = p_slug;
  return 'gata';
end;
$$;

revoke all on function public.scrie_enunt(text, text, int, int, text) from public;
grant execute on function public.scrie_enunt(text, text, int, int, text) to authenticated;

-- ---------- PAZA ----------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'planner_pupils'
                   and column_name = 'can_board') then
    raise exception '0108: lipsește planner_pupils.can_board';
  end if;

  if not (select prosecdef from pg_proc where oid = 'public.poate_scrie_tabla()'::regprocedure)
     or not (select prosecdef from pg_proc
             where oid = 'public.scrie_enunt(text, text, int, int, text)'::regprocedure) then
    raise exception '0108: funcțiile tablei trebuie să ruleze ca security definer';
  end if;

  if has_function_privilege('anon', 'public.scrie_enunt(text, text, int, int, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.poate_scrie_tabla()', 'EXECUTE') then
    raise exception '0108: vizitatorul nelogat poate chema funcțiile tablei';
  end if;

  -- Scrierea întreagă a tablei rămâne numai a adminului (0106).
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'tabla_live') <> 4
     or exists (select 1 from pg_policies where tablename = 'tabla_live'
                  and cmd in ('INSERT', 'UPDATE', 'DELETE')
                  and coalesce(with_check, qual) not like '%is_admin_user()%') then
    raise exception '0108: regulile de pe tabla_live nu mai sunt cele din 0106';
  end if;

  -- Comutatorul trebuie să ajungă la pagina elevului pe loc (publicat în 0088).
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and tablename = 'planner_pupils') then
    raise exception '0108: planner_pupils nu e în Realtime';
  end if;
end $$;

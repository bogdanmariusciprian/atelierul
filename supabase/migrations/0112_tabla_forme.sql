-- =========================================================
-- 0112 · TABLA DE REDACTARE: câmpuri adăugate ori scoase de admin, pentru totdeauna
--
-- Cererea lui Marius (8 noiembrie 2026): „să mă lași pe mine ca admin să adaug
-- câmp de enunț la anumite trepte sau să elimin câmp de enunț", pentru
-- totdeauna, doar pe treapta aceea.
--
-- 1. FORMA UNUI TIP DE ESEU. Forma de la început stă în pagină (butoanele
--    tipurilor, `data-trepte`). Ce schimbă adminul stă aici, un rând pe tablă
--    și pe tip de eseu: câte enunțuri are fiecare parte pe fiecare treaptă și,
--    unde o parte se rescrie pe grupuri, câte câmpuri are fiecare grup:
--      { "trepte": { "9": { "parti": [1,3,2,2,1], "grupe": { "1": [3] } }, … } }
--    Treapta își păstrează cheia de la început („9"), chiar dacă are acum alt
--    număr de enunțuri: așa lucrările scrise rămân la locul lor.
--    Citesc toți (și nelogații, ca tabla); scrie doar adminul. Rândul șters =
--    tipul revine la forma din pagină.
--
-- 2. `scrie_enunt` (0108) refuza un enunț cu locul peste numărul treptei
--    (`p_i >= p_n`). Cu un câmp adăugat, treapta „9" are și locul 9, deci
--    elevul pornit ar fi fost refuzat acolo. Acum locul merge până la 39 (cel
--    mult 40 de enunțuri pe treaptă), iar restul funcției rămâne ca în 0108.
--
-- Se poate rula de mai multe ori.
-- =========================================================

create table if not exists public.tabla_forme (
  slug           text not null check (slug ~ '^[a-z0-9-]{3,60}$'),
  tip            text not null check (tip ~ '^[a-z0-9-]{1,30}$'),
  forma          jsonb not null
                 check (jsonb_typeof(forma) = 'object' and pg_column_size(forma) <= 20000),
  actualizat_la  timestamptz not null default now(),
  primary key (slug, tip)
);

comment on table public.tabla_forme is
  'Forma tipurilor de eseu de pe tablele #LaTablă, schimbată de admin (câmpuri adăugate ori scoase pe o treaptă) (0112).';

alter table public.tabla_forme enable row level security;

revoke all on public.tabla_forme from anon, authenticated;
grant select on public.tabla_forme to anon, authenticated;
grant insert, update, delete on public.tabla_forme to authenticated;

drop policy if exists tabla_forme_citire on public.tabla_forme;
create policy tabla_forme_citire on public.tabla_forme
  for select to anon, authenticated
  using (true);

drop policy if exists tabla_forme_pune on public.tabla_forme;
create policy tabla_forme_pune on public.tabla_forme
  for insert to authenticated
  with check (public.is_admin_user());

drop policy if exists tabla_forme_schimba on public.tabla_forme;
create policy tabla_forme_schimba on public.tabla_forme
  for update to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists tabla_forme_sterge on public.tabla_forme;
create policy tabla_forme_sterge on public.tabla_forme
  for delete to authenticated
  using (public.is_admin_user());

-- ---------------------------------------------------------
-- 2. Un enunț, scris singur: locul merge până la 39
-- ---------------------------------------------------------
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
     or p_i is null or p_i not between 0 and 39
     or p_text is null or char_length(p_text) > 1000 then
    return 'gresit';
  end if;

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
  while jsonb_array_length(sir) < greatest(p_n, p_i + 1) loop
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
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'tabla_forme') <> 4
     or exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tabla_forme'
                  and cmd in ('INSERT', 'UPDATE', 'DELETE')
                  and coalesce(with_check, qual) not like '%is_admin_user()%') then
    raise exception '0112: forma tablei nu e păzită de is_admin_user()';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.tabla_forme'::regclass) then
    raise exception '0112: tabla_forme n-are RLS pornit';
  end if;

  if not (select prosecdef from pg_proc
          where oid = 'public.scrie_enunt(text, text, int, int, text)'::regprocedure) then
    raise exception '0112: scrie_enunt trebuie să ruleze ca security definer';
  end if;

  if has_function_privilege('anon', 'public.scrie_enunt(text, text, int, int, text)', 'EXECUTE') then
    raise exception '0112: vizitatorul nelogat poate chema scrie_enunt';
  end if;
end $$;

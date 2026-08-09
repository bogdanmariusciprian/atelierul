-- =========================================================
-- Migration 0083 — O dată etichetat, un cuvânt nu mai poate fi sărăcit.
--
-- DE CE. Migrarea 0082 scria `set tags = ce a bifat elevul`, adică ÎNLOCUIA.
-- Iar cuvintele din bancă au deja etichete puse de profesor: „ceață" e
-- `litere-sunete, pseudogrup, consoane-speciale`. Un elev care ar fi bifat doar
-- „pseudogrup" ar fi lăsat cuvântul cu atâta, iar celelalte două s-ar fi dus.
-- Fără eroare, fără urmă: cuvântul pur și simplu n-ar mai fi apărut în
-- exercițiile pe care le servea, iar subțierea băncii s-ar fi văzut peste luni,
-- când n-ar mai fi avut cine s-o lege de cauză.
--
-- REGULA DE ACUM. Elevul poate doar ADĂUGA. Etichetele lui se pun peste cele de
-- pe cuvânt, fără să scoată nimic. Singurul care poate și scoate e profesorul,
-- prin drepturile lui obișnuite pe tabel.
--
-- Asta nu e o pază pusă peste alta, e aceeași pază scrisă mai bine: „o singură
-- dată, de oricine" o ține mai departe cheia primară a urmei. Ce se adaugă e
-- că nici prima etichetare nu mai poate strica ce era.
--
-- Migrarea mai face trei lucruri mărunte, toate în aceeași direcție:
--
--   · urma supraviețuiește plecării elevului, ca un cuvânt lucrat să rămână
--     închis chiar dacă i se șterge contul celui care l-a lucrat;
--   · oricine poate afla CARE cuvinte sunt etichetate, fără să afle de cine,
--     ca bifa verde să se vadă la toți, nu doar la cel care a pus-o;
--   · funcțiile care nu-și fixaseră `search_path` și-l fixează, iar cele
--     declanșator nu mai pot fi chemate din afară.
--
-- Depinde de 0082. Sigur la re-rulare.
-- =========================================================

-- ---------- 1. urma ține și după plecarea omului ----------
-- Era `on delete cascade`: la ștergerea contului pierea și urma, iar cuvântul
-- redevenea etichetabil, adică se putea scrie peste ce lucrase cineva. Acum
-- rămâne rândul, doar numele se șterge: cuvântul stă închis pe veci, iar cine
-- l-a etichetat rămâne necunoscut, ceea ce e chiar purtarea cuvenită față de un
-- om care a plecat.
alter table public.learn_lessons_items_tagged
  alter column user_id drop not null;

alter table public.learn_lessons_items_tagged
  drop constraint if exists learn_lessons_items_tagged_user_id_fkey;

alter table public.learn_lessons_items_tagged
  add constraint learn_lessons_items_tagged_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

comment on column public.learn_lessons_items_tagged.user_id is
  'Cine a etichetat. Se golește la ștergerea contului, dar RÂNDUL RĂMÂNE: el e cel care ține cuvântul închis, nu numele.';

-- ---------- 2. etichetele elevului se adaugă, nu înlocuiesc ----------
create or replace function public.eticheteaza_cuvantul(p_item uuid, p_tags text[])
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_curate text[];
begin
  if auth.uid() is null then
    return 'neconectat';
  end if;

  -- Cine: elev la meditații ori profesorul.
  if not public.has_planner_access() then
    return 'fara-drept';
  end if;

  -- Când: numai cu comutatorul deschis. Profesorul nu face excepție, ca să nu
  -- ajungă să eticheteze din greșeală crezând că e deschis.
  if not coalesce((select value from public.app_flags where key = 'pupil_tagging'), false) then
    return 'inchis';
  end if;

  -- Etichetele: fără goluri, fără repetări, cel mult zece. Zece e cu mult peste
  -- câte are o lecție; e acolo doar ca o cerere stricată să nu poată umfla un
  -- rând la nesfârșit.
  select array(select distinct trim(t) from unnest(coalesce(p_tags, '{}')) as t
               where trim(t) <> '')
    into v_curate;
  if array_length(v_curate, 1) is null then
    return 'fara-etichete';
  end if;
  if array_length(v_curate, 1) > 10 then
    return 'prea-multe';
  end if;

  -- O singură dată, de oricine: cheia primară e cea care spune „nu", nu un `if`
  -- care s-ar putea uita ori ocoli.
  begin
    insert into public.learn_lessons_items_tagged (item_id, user_id, tags)
    values (p_item, auth.uid(), v_curate);
  exception when unique_violation then
    return 'deja';
  when foreign_key_violation then
    return 'lipseste';
  end;

  -- ADAUGĂ, NU ÎNLOCUIEȘTE. Aici era greșeala din 0082. Reuniunea se face în
  -- bază, nu în pagină, fiindcă altfel ar fi depins de ce credea pagina că e pe
  -- cuvânt: două table deschise deodată, și cea care apasă a doua ar scrie peste
  -- ce n-a apucat să afle.
  update public.learn_lessons_items
     set tags = array(select distinct t
                        from unnest(coalesce(tags, '{}') || v_curate) as t
                       order by t)
   where id = p_item;

  return 'gata';
end;
$$;

comment on function public.eticheteaza_cuvantul(uuid, text[]) is
  'Singura cale prin care un elev pune etichete pe un cuvânt. Verifică dreptul, comutatorul și urma, apoi ADAUGĂ la coloana tags (nu înlocuiește niciodată). Întoarce: gata | deja | inchis | fara-drept | fara-etichete | prea-multe | lipseste | neconectat.';

revoke all on function public.eticheteaza_cuvantul(uuid, text[]) from public;
grant execute on function public.eticheteaza_cuvantul(uuid, text[]) to authenticated;

-- ---------- 3. care cuvinte sunt luate: se vede la toți ----------
-- Bifa verde înseamnă „lucrat la meditație" și se cuvine să se vadă oriunde apare
-- cuvântul, la oricine, chiar și la un vizitator nelogat. Politica de citire de
-- pe urmă arată însă rândul întreg, cu tot cu numele celui care a etichetat, iar
-- aceea rămâne cum e: numele îl vede doar profesorul.
--
-- Deci nu se lărgește politica, se deschide o fereastră îngustă: o funcție care
-- întoarce NUMAI cuvintele, niciodată cine. Așa lucrul se vede, iar omul nu.
create or replace function public.cuvintele_etichetate(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select item_id
    from public.learn_lessons_items_tagged
   where item_id = any (coalesce(p_ids, '{}'::uuid[]));
$$;

comment on function public.cuvintele_etichetate(uuid[]) is
  'Dintre cuvintele date, care sunt deja etichetate. Întoarce numai cuvintele, niciodată cine le-a etichetat: bifa verde se vede la toți, numele doar la profesor.';

revoke all on function public.cuvintele_etichetate(uuid[]) from public;
grant execute on function public.cuvintele_etichetate(uuid[]) to anon, authenticated;

-- ---------- 4. funcțiile care nu-și fixaseră sertarul ----------
-- Când o funcție zice `update learn_lessons_items`, nu spune și unde stă acel
-- tabel: Postgres îl caută pe o listă de sertare, iar lista o poate schimba cel
-- care cheamă. O funcție care nu și-o fixează poate fi, în principiu, păcălită
-- să scrie în alt tabel cu același nume.
--
-- La noi nimeni n-are dreptul să-și facă tabele în bază, deci nu e o ușă
-- deschisă. Se închide totuși, din alt motiv: o listă de avertismente pe care le
-- știi nevinovate e o listă pe care încetezi s-o mai citești, iar atunci
-- următorul, care ar fi fost adevărat, trece nevăzut.
--
-- Se umblă numai la funcțiile NOASTRE: cele venite cu o extensie (btree_gist)
-- sunt ale ei, iar schimbarea lor s-ar pierde la prima actualizare.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as semnatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proconfig is null
       and not exists (select 1 from pg_depend d
                        where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path to ''public''', f.semnatura);
  end loop;
end $$;

-- ---------- 5. funcțiile-declanșator nu se cheamă din afară ----------
-- Supabase publică fiecare funcție din bază ca adresă de internet. Pentru
-- `eticheteaza_cuvantul` e chiar rostul ei. Pentru cele declanșator, pe care
-- Postgres le cheamă singur când se schimbă un rând, nu e niciun rost: chemate
-- din afară dau oricum eroare, dar rămân trecute pe lista publică a ușilor.
--
-- Retragerea nu oprește declanșatoarele: dreptul de execuție se cere celui care
-- cheamă funcția, iar pe acelea le cheamă Postgres însuși. Probat înainte de a
-- fi scris aici.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as semnatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and pg_get_function_result(p.oid) = 'trigger'
       and not exists (select 1 from pg_depend d
                        where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.semnatura);
  end loop;
end $$;

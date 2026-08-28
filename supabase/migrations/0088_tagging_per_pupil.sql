-- =========================================================
-- Migrarea 0088: etichetarea se dă PE ELEV, nu pe tot situl.
--
-- DE CE. Până acum îngăduința era un singur da/nu pentru toată lumea
-- (`app_flags['pupil_tagging']`): îl ridicai, și puteau eticheta toți elevii de
-- la meditații deodată. Marius lucrează însă cu câte un elev, nu cu toți, și a
-- cerut același tipar ca la propunerile de explicații (0087): deschizi butonul,
-- vezi lista, și pornești pe cine stă cu tine.
--
-- ÎNTRERUPĂTORUL UNIC IESE DIN JOC. Rândul din `app_flags` rămâne unde e, dar
-- nimeni nu-l mai citește. Nu-l șterg: e istoria bazei, iar o ștergere n-ar
-- aduce nimic. După migrare TOȚI pornesc STINȘI, dinadins – îngăduința se dă
-- de acum pe om, deci trebuie dată de mână, o dată pentru fiecare.
--
-- PROFESORUL rămâne cu voie oricând. Înainte era ținut și el de întrerupătorul
-- unic, ca să nu eticheteze din greșeală crezând că e deschis; grija aceea avea
-- rost cât exista o stare comună, ușor de uitat ridicată. Acum nu mai există
-- nimic de uitat: fiecare elev are comutatorul lui, iar profesorul e cel care-l
-- apasă.
--
-- ȘI O REPARAȚIE. `ascultaComutatorul` din `tagging-repo.js` asculta `app_flags`
-- ca pagina elevului să se închidă PE LOC, nu la următoarea deschidere. Numai că
-- `app_flags` n-a fost niciodată publicat pentru ascultare, deci ascultarea nu
-- s-a declanșat nici măcar o dată: „închid acum" însemna de fapt „închid pentru
-- cine deschide pagina de-acum încolo". Aici se publică `planner_pupils`, ca
-- ascultarea să fie adevărată. Elevul vede numai rândul lui (RLS de pe tabel).
--
-- Depinde de 0053 (`planner_pupils`), 0082 și 0083 (etichetarea).
-- Sigură la re-rulare.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Comutatorul, pe elev
-- ---------------------------------------------------------
alter table public.planner_pupils
  add column if not exists can_tag boolean not null default false;

comment on column public.planner_pupils.can_tag is
  'Elevul poate pune etichete pe cuvinte la #LaTablă. Se aprinde și se stinge din butonul plutitor al profesorului, cât lucrează cu el.';

/* Întrebarea se pune din `eticheteaza_cuvantul`, care rulează cu drepturile
   celui care a chemat-o. Elevul n-are voie să citească lista de la meditații a
   altora, deci `security definer`. Nu dezvăluie nimic: întoarce doar da sau nu,
   despre cel care întreabă. */
create or replace function public.poate_eticheta()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select public.is_admin_user()
      or exists (
        select 1 from public.planner_pupils
        where user_id = auth.uid() and can_tag
      );
$$;

revoke all on function public.poate_eticheta() from public;
grant execute on function public.poate_eticheta() to authenticated;

-- ---------------------------------------------------------
-- 2. Etichetarea cere acum îngăduința ELEVULUI
-- ---------------------------------------------------------
/* Restul funcției rămâne cuvânt cu cuvânt cum era în 0083: aici se schimbă
   NUMAI cine are voie. Codurile întoarse rămân și ele aceleași, fiindcă pagina
   le tălmăcește în românește (`MOTIVE` din `tagging-repo.js`):
     · 'fara-drept' → nu ești nici elev la meditații, nici profesor;
     · 'inchis'     → ești, dar nu ți-e pornit comutatorul.
   Le țin despărțite tocmai ca elevul să afle care din două e, nu un „nu se
   poate" care nu spune nimic. */
create or replace function public.eticheteaza_cuvantul(p_item uuid, p_tags text[])
returns text
language plpgsql security definer set search_path to 'public'
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

  -- Când: numai cu comutatorul LUI pornit. Profesorul trece oricând.
  if not public.poate_eticheta() then
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

revoke all on function public.eticheteaza_cuvantul(uuid, text[]) from public;
grant execute on function public.eticheteaza_cuvantul(uuid, text[]) to authenticated;

-- ---------------------------------------------------------
-- 3. Ascultarea, ca stingerea să ajungă PE LOC la elev
-- ---------------------------------------------------------
/* Fără asta, comutatorul ar închide etichetarea „pentru cine deschide pagina
   de-acum încolo", nu pentru elevul care stă acum cu tine – adică exact pe
   dos față de ce-ți trebuie. Elevul vede numai rândul lui: RLS de pe
   `planner_pupils` se aplică și la ascultare. */
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'planner_pupils'
  ) then
    alter publication supabase_realtime add table public.planner_pupils;
  end if;
end $$;

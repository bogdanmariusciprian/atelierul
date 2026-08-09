-- =========================================================
-- Migration 0082 — Elevii pun etichete pe cuvinte, sub ochiul profesorului.
--
-- DE CE. Banca de material se etichetează cuvânt cu cuvânt, iar treaba asta e
-- lungă și plicticoasă pentru un singur om. Numai că, la o privire mai atentă,
-- nici nu e o treabă de făcut singur: a hotărî că „ceapă" e bun pentru grupuri
-- de sunete E chiar exercițiul. Deci nu se dă altcuiva o corvoadă, ci se pune
-- lucrul acolo unde se și învață.
--
-- CE PĂZEȘTE BAZA, ȘI DE CE TOT EA. Trei reguli, și niciuna n-are voie să stea
-- în pagină: o regulă din pagină se ocolește cu tastatura din browser.
--
--   1. SCRIE DOAR CINE E ELEV LA MEDITAȚII (sau profesorul). `planner_pupils`
--      spune deja cine e, prin `has_planner_access()`. Nu se face alt semn:
--      două semne pentru același lucru ajung, inevitabil, să spună altceva.
--   2. NUMAI CÂT COMUTATORUL E DESCHIS. Etichetarea se face la meditație, cu
--      profesorul lângă elev, nu în timpul liber.
--   3. UN CUVÂNT SE ETICHETEAZĂ O SINGURĂ DATĂ, de oricine. A doua încercare
--      nu e oprită de un `if`, ci de cheia primară a tabelului de mai jos.
--
-- O SINGURĂ UȘĂ. Toate trei stau într-o funcție `security definer`, nu în
-- politici. Motivul e că politicile pot spune „ai voie să schimbi rândul", dar
-- nu „ai voie să schimbi NUMAI coloana `tags`": aceea s-ar face din drepturi pe
-- coloană, care ar lega la fel de strâns și mâinile profesorului. Cu o funcție,
-- elevul n-are drept de scriere deloc pe tabel, iar singurul lucru pe care-l
-- poate face e chemarea de mai jos.
--
-- URMA rămâne, și nu e o pază, e o măsură: din ea se vede ce cuvinte au fost
-- lucrate și cu cine, adică tocmai ce nu se putea vedea până acum.
--
-- Depinde de 0033 (app_flags), 0062 (planner_pupils, has_planner_access),
-- 0078 (learn_lessons_items). Sigur la re-rulare.
-- =========================================================

-- ---------- 1. comutatorul ----------
-- Stă în `app_flags`, nu în `app_settings`: elevul trebuie să-l poată CITI, ca
-- să știe dacă are ce arăta pe tablă, iar `app_settings` e închis la citire
-- pentru toți în afară de profesor. Scrisul rămâne al profesorului.
insert into public.app_flags (key, value) values ('pupil_tagging', false)
  on conflict (key) do nothing;

comment on table public.app_flags is
  'Comutatoare adevărat/fals, citibile de oricine. gate_off = poarta de pre-lansare; pupil_tagging = elevii pot pune etichete pe cuvinte.';

-- ---------- 2. urma ----------
create table if not exists public.learn_lessons_items_tagged (
  -- Cheia e CUVÂNTUL, nu perechea cuvânt-elev: așa „o singură dată, de oricine"
  -- iese din chiar forma tabelului. Dacă am fi vrut „o dată de fiecare elev",
  -- cheia ar fi fost dublă; scrisă așa, regula nu se poate uita.
  item_id    uuid primary key references public.learn_lessons_items (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  tags       text[] not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.learn_lessons_items_tagged is
  'Cine a etichetat fiecare cuvânt și când. Cheia pe cuvânt ține regula „o singură dată, de oricine"; lista e și măsura cuvintelor lucrate la meditații.';

create index if not exists learn_lessons_items_tagged_user
  on public.learn_lessons_items_tagged (user_id, created_at desc);

alter table public.learn_lessons_items_tagged enable row level security;

-- Elevul își vede urmele lui; profesorul le vede pe toate. Scrisul nu se face
-- de aici, ci numai prin funcția de mai jos.
drop policy if exists learn_lessons_items_tagged_read on public.learn_lessons_items_tagged;
create policy learn_lessons_items_tagged_read on public.learn_lessons_items_tagged
  for select using (user_id = auth.uid() or public.is_admin_user());

grant select on public.learn_lessons_items_tagged to authenticated;

-- ---------- 3. singura ușă ----------
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

  update public.learn_lessons_items
     set tags = v_curate
   where id = p_item;

  return 'gata';
end;
$$;

comment on function public.eticheteaza_cuvantul(uuid, text[]) is
  'Singura cale prin care un elev pune etichete pe un cuvânt. Verifică dreptul, comutatorul și urma, apoi scrie NUMAI coloana tags. Întoarce: gata | deja | inchis | fara-drept | fara-etichete | prea-multe | lipseste | neconectat.';

revoke all on function public.eticheteaza_cuvantul(uuid, text[]) from public;
grant execute on function public.eticheteaza_cuvantul(uuid, text[]) to authenticated;

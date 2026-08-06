-- =========================================================
-- Migration 0078 – Banca de material a lecțiilor (#LaTablă).
--
-- NUMELE, după regula din 0062: domeniul → entitatea → calificativul.
-- Materialul atârnă de LECȚIE, ca și tabla și notițele, deci intră în aceeași
-- familie: `learn_lessons_progress`, `learn_lessons_boards`,
-- `learn_lessons_notes`, iar acum `learn_lessons_items`. Numele „items" e ales
-- ca la `tests_items`, banca de itemi a testelor: același fel de lucru, altă
-- materie. Nu „words": în bancă intră și structuri fonetice, și propoziții.
--
-- LA CE FOLOSEȘTE. Zarul dă tipul exercițiului, generatorul scoate din bancă
-- atâtea cuvinte (ori structuri, ori propoziții) câte cere elevul, iar tabla se
-- umple singură. Fără bancă, generatorul n-ar avea din ce alege.
--
-- ETICHETELE, nu tipul. Un cuvânt bun pentru „litere și sunete" poate fi bun și
-- pentru „valoarea lui i": de-aia eticheta e o listă, nu o coloană. Așa
-- profesorul scrie cuvântul o dată și îl bifează la câte exerciții se
-- potrivește, iar generatorul cere „dă-mi cuvinte cu eticheta asta".
--
-- CINE CE POATE. Materialul îl scrie NUMAI profesorul; elevul doar îl citește,
-- fiindcă din el i se face tema. De-aia sunt două politici deosebite, nu una
-- singură cu `for all`: dreptul de citire e larg, cel de scriere e strâmt, și
-- se vede din prima care e care.
--
-- Depinde de 0001 (profiles) și de 0003 (is_admin_user). Sigur la re-rulare.
-- =========================================================

create table if not exists public.learn_lessons_items (
  id          uuid primary key default gen_random_uuid(),
  -- lecția a cărei bancă e („fonetica-introducere"). Text, nu cheie străină:
  -- lecțiile stau în cod, nu în bază, iar o lecție redenumită n-are voie să
  -- șteargă materialul strâns de-a lungul anilor.
  lesson_slug text not null,
  -- ce fel de material e. Tipurile de exerciții cer lucruri deosebite: unul
  -- cere cuvinte, altul structuri („cvcv"), altul propoziții întregi.
  kind        text not null check (kind in ('cuvant', 'structura', 'propozitie')),
  -- materialul însuși: cuvântul, structura ori propoziția.
  body        text not null,
  -- la ce exerciții se potrivește. Listă, fiindcă un cuvânt poate sluji la mai
  -- multe: „chiar" e bun și la grupuri de sunete, și la valoarea lui i.
  tags        text[] not null default '{}'::text[],
  -- 1 ușor, 2 mijlociu, 3 greu. Generatorul poate cere pe măsura elevului.
  level       int  not null default 2 check (level between 1 and 3),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.learn_lessons_items enable row level security;

-- CITIREA e a tuturor celor cu cont: din bancă se face tema elevului, deci el
-- trebuie să poată cere cuvinte. Nu e material ascuns; e material de lucru.
drop policy if exists learn_lessons_items_read on public.learn_lessons_items;
create policy learn_lessons_items_read on public.learn_lessons_items for select
  using (auth.uid() is not null);

-- SCRISUL e numai al profesorului. Trei politici deosebite, nu un `for all`:
-- așa se vede dintr-o privire că elevul n-are cum să strecoare un cuvânt în
-- banca pe care o folosesc toți.
drop policy if exists learn_lessons_items_admin_insert on public.learn_lessons_items;
create policy learn_lessons_items_admin_insert on public.learn_lessons_items for insert
  with check (public.is_admin_user());

drop policy if exists learn_lessons_items_admin_update on public.learn_lessons_items;
create policy learn_lessons_items_admin_update on public.learn_lessons_items for update
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists learn_lessons_items_admin_delete on public.learn_lessons_items;
create policy learn_lessons_items_admin_delete on public.learn_lessons_items for delete
  using (public.is_admin_user());

grant select, insert, update, delete on public.learn_lessons_items to authenticated;

-- Cererea generatorului: „materialul de felul ăsta, de la lecția asta".
-- Eticheta se caută cu `&&` (se intersectează listele), iar pentru asta
-- indexul potrivit e GIN pe coloana de etichete.
create index if not exists learn_lessons_items_lesson_kind_idx
  on public.learn_lessons_items (lesson_slug, kind, level);

create index if not exists learn_lessons_items_tags_idx
  on public.learn_lessons_items using gin (tags);

-- Același cuvânt scris de două ori nu strică nimic, dar umple banca și strâmbă
-- alegerea la întâmplare: cuvântul pus de trei ori ar ieși de trei ori mai des.
-- Comparăm fără majuscule și fără spațiile de la capete, ca „Masă " și „masă"
-- să fie tot unul.
create unique index if not exists learn_lessons_items_unic_idx
  on public.learn_lessons_items (lesson_slug, kind, lower(btrim(body)));

-- Ora ultimei schimbări o pune baza, nu clientul.
create or replace function public.touch_learn_lessons_item()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists learn_lessons_items_touch on public.learn_lessons_items;
create trigger learn_lessons_items_touch
  before update on public.learn_lessons_items
  for each row execute function public.touch_learn_lessons_item();

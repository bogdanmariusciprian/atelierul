-- =========================================================
-- Migration 0085: lista examenelor pe perete, și progresul elevului pe cont.
--
-- (0084 a fost retrasă: era cheia de răspunsuri de la Câmpina turnată într-un
--  fișier, adică exact lucrul care n-are ce căuta într-un depozit public.
--  Itemii au intrat prin legătura cu baza, iar numărul rămâne nefolosit ca să
--  se vadă în istorie de ce.)
--
-- DE CE, PARTEA ÎNTÂI. Numele examenului (`admitere-drept`, `admitere-campina`)
-- e azi text liber, scris de mână în trei mese, cu implicitul `admitere-drept`
-- atât în bază, cât și în opt funcții din client. Două feluri de a greși fără
-- niciun semn:
--
--   · o literă scăpată, `admitere-campna`, naște un examen care nu există
--     nicăieri altundeva. Itemul intră, baza nu protestează, dar nu-l mai vede
--     nimeni niciodată, fiindcă nicio pagină nu întreabă de acel nume;
--   · un argument uitat în cod: funcția presupune singură `admitere-drept` și
--     scrie liniștit în sertarul altui examen.
--
-- Amândouă sunt tăcute, iar asta le face grele: nu se văd în ziua în care se
-- întâmplă, ci peste luni, când nu mai are cine să le lege de cauză.
--
-- CE FACE. Un registru, `tests_exams`, cu un rând de examen. Mesele care poartă
-- `exam` capătă cheie străină spre el, deci de acum numele care nu-i pe listă e
-- refuzat de bază, pe loc, cu eroare. Un examen nou (bacalaureat, EN8) înseamnă
-- un rând adăugat, iar toate mesele îl cunosc deodată.
--
-- DE CE, PARTEA A DOUA. Jocul de la Câmpina ține progresul în browser: ce a
-- bifat elevul, explicația scrisă de el, levelurile trecute. Adică se pierde la
-- schimbarea calculatorului și, pe un calculator împărțit, poate ajunge sub
-- ochii altuia. Trei mese noi îl mută în cont, cu RLS „doar rândurile mele".
--
-- PARTEA CARE-MI PLACE. `tests_progress` poartă și itemul, și examenul, legate
-- ÎMPREUNĂ de banca de itemi (cheie străină compusă, sprijinită pe unicitatea
-- `(id, exam)`). Nu mai e vorba de grija cuiva: un rând de progres care spune
-- „Câmpina" pentru un item de la Drept nu POATE exista.
--
-- CE NU FACE. Nu atinge jocul de la Drept și nicio funcție împărțită. Coloana
-- `exam` adăugată la întrebările bonus pregătește terenul, dar clientul rămâne
-- cum e: legarea lui ar schimba jocul care merge, iar aceea se face separat, cu
-- știrea lui Marius.
--
-- Sigur la re-rulare.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Registrul examenelor
-- ---------------------------------------------------------
create table if not exists public.tests_exams (
  slug       text primary key,
  title      text not null,
  active     boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.tests_exams is
  'Lista examenelor îngăduite. Orice `exam` din domeniul tests_* trimite aici, deci un nume scris greșit e refuzat de bază, nu de atenția noastră.';

-- Cele șase categorii din `src/site/scripts/test-categories.js`. Titlurile sunt
-- ale profesorului: le poate schimba oricând, fără migrare.
insert into public.tests_exams (slug, title, sort) values
  ('clasa-6',          'Clasa a 6-a',      10),
  ('clasa-8',          'Clasa a 8-a',      20),
  ('clasa-12',         'Clasa a 12-a',     30),
  ('admitere-politie', 'Admitere Poliție', 40),
  ('admitere-drept',   'Admitere Drept',   50),
  ('admitere-campina', 'Admitere Câmpina', 60)
on conflict (slug) do nothing;

-- Plasa: orice examen care EXISTĂ deja în mese, dar n-ar fi pe listă, intră
-- acum. Fără asta, cheile străine de mai jos ar putea cădea pe un nume pe care
-- l-am uitat, iar migrarea ar muri la jumătate.
insert into public.tests_exams (slug, title, sort)
select t.exam, t.exam, 900
from (
  select exam from public.tests_items
  union select exam from public.tests_downloads
  union select exam from public.tests_sessions
) t
where t.exam is not null
on conflict (slug) do nothing;

alter table public.tests_exams enable row level security;

drop policy if exists tests_exams_read on public.tests_exams;
create policy tests_exams_read on public.tests_exams
  for select using (true);   -- e doar lista de nume; nu ascunde nimic

drop policy if exists tests_exams_admin on public.tests_exams;
create policy tests_exams_admin on public.tests_exams
  for all using (public.is_admin_user()) with check (public.is_admin_user());

-- ---------------------------------------------------------
-- 2. Mesele vechi cer voie de la registru
-- ---------------------------------------------------------
-- `on update cascade`: dacă vreodată se redenumește un slug, redenumirea curge
-- singură prin toate mesele. Fără `on delete`: implicitul e `restrict`, adică
-- un examen cu itemi în el nu se poate șterge din greșeală.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tests_items_exam_fk') then
    alter table public.tests_items
      add constraint tests_items_exam_fk foreign key (exam)
      references public.tests_exams (slug) on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tests_downloads_exam_fk') then
    alter table public.tests_downloads
      add constraint tests_downloads_exam_fk foreign key (exam)
      references public.tests_exams (slug) on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tests_sessions_exam_fk') then
    alter table public.tests_sessions
      add constraint tests_sessions_exam_fk foreign key (exam)
      references public.tests_exams (slug) on update cascade;
  end if;
  -- Unicitatea care face cu putință cheia compusă de la `tests_progress`.
  -- `id` e deja unic; perechea o declarăm ca s-o poată ținti o cheie străină.
  if not exists (select 1 from pg_constraint where conname = 'tests_items_id_exam_key') then
    alter table public.tests_items
      add constraint tests_items_id_exam_key unique (id, exam);
  end if;
end $$;

-- Cheia străină de pe sesiuni n-avea index care să înceapă cu `exam`; celelalte
-- două aveau. Fără el, ștergerea unui rând din registru ar trebui să citească
-- toată masa ca să se convingă că n-o folosește nimeni.
create index if not exists tests_sessions_exam_idx
  on public.tests_sessions (exam, user_id);

-- ---------------------------------------------------------
-- 3. Ceasul comun al meselor noi
-- ---------------------------------------------------------
create or replace function public.tests_touch_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Un declanșator nu se cheamă din afară; îi luăm dreptul, ca celorlalte (0083).
revoke all on function public.tests_touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------
-- 4. Progresul de la Relaxed: bifa și explicația scrisă de elev
-- ---------------------------------------------------------
create table if not exists public.tests_progress (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  item_id     uuid not null,
  -- Fără cheie străină de-a dreptul spre registru, și e voit: perechea
  -- `(item_id, exam)` de mai jos trimite la un item ADEVĂRAT, iar examenul
  -- acelui item e deja legat de registru. O a doua cheie ar cere aceeași
  -- dovadă a doua oară, la fiecare scriere, fără să adauge nimic.
  exam        text not null,
  chosen      text check (chosen in ('A','B','C','D')),
  correct     boolean,
  answer_key  text check (answer_key in ('A','B','C','D')),
  observation text,
  note        text check (note is null or char_length(note) <= 2000),
  updated_at  timestamptz not null default now(),
  primary key (user_id, item_id),
  constraint tests_progress_item_fk foreign key (item_id, exam)
    references public.tests_items (id, exam) on delete cascade on update cascade
);

comment on table public.tests_progress is
  'Ce a bifat elevul în modul Relaxed și explicația scrisă de el, un rând pe item. Cheia străină compusă (item_id, exam) face imposibil ca rândul să pretindă alt examen decât itemul.';
comment on column public.tests_progress.answer_key is
  'Litera corectă, așa cum a primit-o elevul de la server DUPĂ ce a răspuns. Se ține ca să nu fie nevoie de o chemare pe item la fiecare reîncărcare. Nu-i o scurgere: el o știe deja, iar RLS n-o arată nimănui altcuiva.';
comment on column public.tests_progress.note is
  'Explicația scrisă de elev cu vorbele lui. A lui rămâne: profesorul n-o citește prin politicile de aici.';

create index if not exists tests_progress_mine
  on public.tests_progress (user_id, exam);

alter table public.tests_progress enable row level security;

drop policy if exists tests_progress_own on public.tests_progress;
create policy tests_progress_own on public.tests_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists tests_progress_touch on public.tests_progress;
create trigger tests_progress_touch before update on public.tests_progress
  for each row execute function public.tests_touch_updated_at();

-- ---------------------------------------------------------
-- 5. Levelurile de la Crazy
-- ---------------------------------------------------------
-- Rândul se naște la PRIMA încercare, nu la prima trecere: altfel `tries` n-ar
-- putea număra căderile de dinaintea izbânzii, iar insigna „Comeback" (treci un
-- level pe care ai picat) n-ar avea din ce să se nască.
create table if not exists public.tests_levels (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  exam       text not null references public.tests_exams (slug) on update cascade,
  level      integer not null check (level >= 1),
  tries      integer not null default 1 check (tries >= 0),
  passed_at  timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, exam, level)
);

comment on table public.tests_levels is
  'Un rând pe (elev, examen, level) în modul Crazy. `passed_at` gol = încercat, nu trecut. Cel mai înalt level trecut se află cu max(level) where passed_at is not null, deci nu-l mai ține nimeni de mână.';

alter table public.tests_levels enable row level security;

drop policy if exists tests_levels_own on public.tests_levels;
create policy tests_levels_own on public.tests_levels
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists tests_levels_touch on public.tests_levels;
create trigger tests_levels_touch before update on public.tests_levels
  for each row execute function public.tests_touch_updated_at();

-- ---------------------------------------------------------
-- 6. Insignele
-- ---------------------------------------------------------
create table if not exists public.tests_badges (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  exam      text not null references public.tests_exams (slug) on update cascade,
  code      text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, exam, code)
);

comment on table public.tests_badges is
  'Insignele câștigate în joc. `code` e text: îl scrie un singur fișier (jocul examenului), spre deosebire de `exam`, care era scris în opt locuri - de aceea acela are registru, iar acesta nu.';

alter table public.tests_badges enable row level security;

-- Insignele altcuiva se pot VEDEA (cândva pe profil, în clasament), dar numai
-- purtătorul lor le poate scrie. De-aia citirea e deschisă, iar scrierea nu.
drop policy if exists tests_badges_read on public.tests_badges;
create policy tests_badges_read on public.tests_badges
  for select using (true);

drop policy if exists tests_badges_write on public.tests_badges;
create policy tests_badges_write on public.tests_badges
  for insert with check (user_id = auth.uid());

drop policy if exists tests_badges_drop on public.tests_badges;
create policy tests_badges_drop on public.tests_badges
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------
-- 7. Întrebările bonus își află examenul
-- ---------------------------------------------------------
-- Masa e goală azi și o folosește numai Clasicul de la Drept, deci implicitul
-- nu strică nimic. Clientul NU se leagă acum de coloana asta: ar însemna să
-- ating jocul care merge, iar aceea se face separat.
alter table public.tests_bonus_questions
  add column if not exists exam text not null default 'admitere-drept';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tests_bonus_questions_exam_fk') then
    alter table public.tests_bonus_questions
      add constraint tests_bonus_questions_exam_fk foreign key (exam)
      references public.tests_exams (slug) on update cascade;
  end if;
end $$;

create index if not exists tests_bonus_questions_exam_idx
  on public.tests_bonus_questions (exam, active);

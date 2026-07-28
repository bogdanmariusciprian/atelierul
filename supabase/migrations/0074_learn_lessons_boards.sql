-- =========================================================
-- Migration 0074 – Foile de la tablă (#LaTablă).
--
-- NUMELE, după regula din 0062: domeniul → entitatea → calificativul.
-- Entitatea de care atârnă foaia e LECȚIA, nu tabla, deci tabelul stă în
-- aceeași familie cu `learn_lessons_progress` și `learn_lessons_favorites`:
-- toate trei sunt lucruri agățate de o lecție. Prima variantă, scrisă
-- `learn_board_sheets`, punea la mijloc o entitate care nu există nicăieri.
--
-- Tabla de la o lecție e un caiet: elevul scrie pe ea cuvinte, despărțirea în
-- silabe și transcrierea fonetică. Până acum foaia trăia doar în browserul lui
-- și se pierdea la schimbarea calculatorului. Aici o mutăm pe cont.
--
-- Salvarea se face LA CERERE, nu din secundă în secundă: foaia e o temă, nu un
-- jurnal. De-aia tabelul n-are nimic care să numere modificări; ține doar ce a
-- fost salvat, cu ora ultimei salvări.
--
-- Mai multe foi per lecție, nu una singură: elevul trebuie să poată păstra
-- tema de săptămâna trecută lângă cea de azi, ca să vadă cum a lucrat atunci.
--
-- PROFESORUL LE VEDE, dar nu le poate schimba. E o unealtă de teme: fără
-- citire, corectura ar cere ca elevul să trimită foaia altfel. Fără dreptul de
-- scriere, elevul rămâne singurul stăpân pe ce a scris cu mâna lui.
--
-- Depinde de 0001 (profiles) și de 0003 (is_admin_user). Sigur la re-rulare.
-- =========================================================

-- Dacă numele greșit a apucat să ajungă în bază, îl îndreptăm în loc să lăsăm
-- două tabele. Rename-ul păstrează datele, cheile străine și apartenența la
-- realtime; politicile și indexul rămân cu numele vechi, așa că le luăm de la
-- capăt mai jos, după ce le ștergem pe cele vechi.
alter table if exists public.learn_board_sheets rename to learn_lessons_boards;
drop policy  if exists learn_board_sheets_own         on public.learn_lessons_boards;
drop policy  if exists learn_board_sheets_teacher_read on public.learn_lessons_boards;
drop trigger if exists learn_board_sheets_touch        on public.learn_lessons_boards;
drop index   if exists public.learn_board_sheets_user_lesson_idx;
drop function if exists public.touch_learn_board_sheet();

create table if not exists public.learn_lessons_boards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- lecția de la care s-a deschis tabla („fonetica-introducere"). Text, nu
  -- cheie străină: lecțiile stau în cod, nu în bază, iar o lecție redenumită
  -- n-are voie să șteargă temele nimănui.
  lesson_slug text not null,
  title       text not null default 'Foaie nouă',
  -- tot ce a scris elevul: {prompt, notes, rows:[{word,syll,trans,types,extra}]}
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.learn_lessons_boards enable row level security;

-- Elevul: tot ce vrea, dar numai pe foile lui.
drop policy if exists learn_lessons_boards_own on public.learn_lessons_boards;
create policy learn_lessons_boards_own on public.learn_lessons_boards for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Profesorul: citește orice foaie, ca să poată corecta. Politica e DOAR de
-- select, deci nici din greșeală n-ar putea rescrie lucrarea unui elev.
drop policy if exists learn_lessons_boards_teacher_read on public.learn_lessons_boards;
create policy learn_lessons_boards_teacher_read on public.learn_lessons_boards for select
  using (public.is_admin_user());

grant select, insert, update, delete on public.learn_lessons_boards to authenticated;

-- Lista „foile mele de la lecția asta", cele atinse ultima dată în frunte.
create index if not exists learn_lessons_boards_user_lesson_idx
  on public.learn_lessons_boards (user_id, lesson_slug, updated_at desc);

-- Ora ultimei salvări o pune baza, nu clientul: altfel un ceas dat înapoi pe
-- calculatorul elevului ar amesteca ordinea foilor.
create or replace function public.touch_learn_lessons_board()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists learn_lessons_boards_touch on public.learn_lessons_boards;
create trigger learn_lessons_boards_touch
  before update on public.learn_lessons_boards
  for each row execute function public.touch_learn_lessons_board();

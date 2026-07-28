-- =========================================================
-- Migration 0076 – Notițele de la tablă (#LaTablă).
--
-- Notița e carnetul elevului de la o lecție: reguli, exemple, ce vrea el să
-- aibă la îndemână cât lucrează. Până acum trăia doar în browser, deci se
-- pierdea la schimbarea calculatorului sau la golirea memoriei.
--
-- O SINGURĂ notiță per elev și per lecție, de-aia cheia primară e chiar
-- perechea (user_id, lesson_slug), ca la `learn_lessons_progress`. Paginile
-- dinăuntru stau în `data`, nu ca rânduri separate: ele n-au înțeles de sine
-- stătător, sunt filele aceluiași carnet.
--
-- PROFESORUL NU LE VEDE, spre deosebire de tablele din 0074. Acolo e vorba de
-- teme, care se dau spre corectură; aici, de însemnările personale ale unui
-- copil. Un carnet citit peste umăr nu mai e carnet, iar elevul ar începe să
-- scrie pentru profesor, nu pentru el.
--
-- Depinde de 0001 (profiles). Sigur la re-rulare.
-- =========================================================

create table if not exists public.learn_lessons_notes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  lesson_slug text not null,
  -- {pages:[html], cur:int, zoom:number, w:int, h:int}
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, lesson_slug)
);

alter table public.learn_lessons_notes enable row level security;

-- Numai ale lui, și numai pentru el. Nicio politică de profesor, dinadins.
drop policy if exists learn_lessons_notes_own on public.learn_lessons_notes;
create policy learn_lessons_notes_own on public.learn_lessons_notes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.learn_lessons_notes to authenticated;

-- Ora ultimei scrieri o pune baza, nu clientul.
create or replace function public.touch_learn_lessons_note()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists learn_lessons_notes_touch on public.learn_lessons_notes;
create trigger learn_lessons_notes_touch
  before update on public.learn_lessons_notes
  for each row execute function public.touch_learn_lessons_note();

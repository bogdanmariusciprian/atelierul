-- =========================================================
-- Migration 0080 – Felul materialului nu mai e o listă închisă.
--
-- CE ERA. În 0078, coloana `kind` avea o constrângere strânsă:
--   check (kind in ('cuvant', 'structura', 'propozitie'))
-- Cele trei feluri erau ale tablei de fonetică, singura care exista atunci.
--
-- DE CE SE SCHIMBĂ. Tabla de la textul argumentativ nu va ține cuvinte, ci
-- corpusuri de texte; alta va ține altceva. Cu lista închisă, fiecare tablă nouă
-- ar fi cerut o migrare, adică o oprire a lucrului pentru o schimbare care nu e,
-- de fapt, despre bază, ci despre pedagogie.
--
-- UNDE SE MUTĂ REGULA. În `src/shared/scripts/board-material.js`, unde fiecare
-- lecție își descrie felurile de material. Acolo îi e locul: felurile depind de
-- lecție, iar baza nu știe și nu are de ce să știe ce lecții există.
--
-- CE RĂMÂNE. O constrângere de curățenie, nu de vocabular: felul trebuie să fie
-- un cuvânt scurt, cu litere mici, fără spații și fără diacritice. Așa nu intră
-- din greșeală „Cuvinte " ori „cuvânt" alături de „cuvant", ceea ce ar rupe în
-- două banca fără ca nimeni să bage de seamă.
--
-- Depinde de 0078. Sigură la re-rulare.
-- =========================================================

alter table public.learn_lessons_items
  drop constraint if exists learn_lessons_items_kind_check;

alter table public.learn_lessons_items
  add constraint learn_lessons_items_kind_check
  check (kind ~ '^[a-z][a-z0-9_-]{1,23}$');

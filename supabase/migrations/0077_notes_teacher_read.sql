-- =========================================================
-- Migration 0077 – Profesorul poate citi notițele.
--
-- În 0076 le lăsasem numai pe seama elevului, ca să nu fie un carnet citit
-- peste umăr. Marius cere accesul din alt motiv decât supravegherea: când un
-- elev spune „nu-mi merge ceva", trebuie să poată deschide ce vede el, altfel
-- rămâne să ghicească din descriere.
--
-- Politica e DOAR de citire, ca la table (0074): profesorul se uită, dar nu
-- poate scrie în locul elevului. Elevul rămâne singurul care își schimbă
-- însemnările.
--
-- Depinde de 0076 (tabelul) și de 0003 (is_admin_user). Sigur la re-rulare.
-- =========================================================

drop policy if exists learn_lessons_notes_teacher_read on public.learn_lessons_notes;
create policy learn_lessons_notes_teacher_read on public.learn_lessons_notes for select
  using (public.is_admin_user());

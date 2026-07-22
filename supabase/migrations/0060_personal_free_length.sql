-- =========================================================
-- Migration 0060 — Timpul personal scapă de corsetul 60/90/120.
--
-- Lecțiile rămân țintuite la cele trei durate — regula are sens pedagogic și
-- ține interfața elevului simplă. Dar „activitate personală" înseamnă ședințe,
-- cursuri la școală, drumuri: de la o jumătate de oră la o dimineață întreagă.
-- Pentru kind = 'personal' cerem doar pași de 30 de minute, în acord cu grila.
--
-- Rândurile existente trec: toate au 60/90/120, adică multipli de 30.
-- Depinde de 0054 (coloana kind). Sigur la re-rulare.
-- =========================================================

alter table public.tutoring_slots
  drop constraint if exists tutoring_slots_len;

alter table public.tutoring_slots
  add constraint tutoring_slots_len check (
    case when kind = 'personal'
      then (extract(epoch from (ends_at - starts_at))::int % 1800) = 0
      else extract(epoch from (ends_at - starts_at)) in (3600, 5400, 7200)
    end
  );

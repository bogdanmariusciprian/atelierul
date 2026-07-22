-- =========================================================
-- Migration 0063 — GRANT-ul uitat: UPDATE pe planner_pupils.
--
-- 0055 a scris politica RLS de UPDATE (event_access_admin_update), dar
-- politicile decid doar CARE rânduri; dedesubt, GRANT-ul decide dacă ai voie
-- deloc la operație. Privilegiul n-a fost dat niciodată, așa că salvarea
-- preferințelor pe elev (nume, culoare, simbol, durată) a murit mereu cu
-- 42501 — „Nu ai acces la planificator" — deși politica era corectă.
--
-- Harta completă a privilegiilor a fost verificată (2026-07-22): acesta e
-- SINGURUL tabel scris de client căruia îi lipsea un privilegiu. Tabelele
-- doar-SELECT (points_ledger, *_solves, tests_boosters, tests_items_peeks,
-- tests_items_rewards, presence_sessions, learn_lessons_progress) sunt AȘA
-- CU INTENȚIE: scrierile lor trec doar prin RPC-uri security-definer.
--
-- Sigur la re-rulare.
-- =========================================================

grant update on public.planner_pupils to authenticated;

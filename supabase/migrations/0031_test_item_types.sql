-- =========================================================
-- Migration 0031 — Test item TYPES (topic tags).
--
-- Each item can belong to one OR MORE topics, shown as labels on the quiz card
-- and used to filter the mini-game. Codes (edited by the teacher in the grid):
--   SF   sintaxa frazei
--   MS   morfo-sintaxă
--   M    morfologie
--   MIV  mijloace de îmbogățire a vocabularului
--   DEX  sensurile cuvintelor
--   DOOM forma cuvintelor
--   G    greșeli
--   F    fonetică
--
-- Stored as a plain text[] (small, filterable). Selectable by everyone via the
-- blanket table grant from 0027 (only `correct`/`correct_2026` are revoked), so
-- no extra grant is needed. Safe to re-run.
-- =========================================================

alter table public.test_items
  add column if not exists types text[] not null default '{}';

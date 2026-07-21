-- =========================================================
-- Migration 0057 — Simbolul de pe bulina elevului.
--
-- În desenul lui Marius, blocul din orar e o CELULĂ plină de culoare, fără
-- text; identitatea o dă culoarea, iar numele apare la hover. Un emoji
-- opțional pe bulină (⚽, 🎵, ce se potrivește copilului) e al doilea semn
-- de recunoaștere — util mai ales dacă două culori ajung vecine.
--
-- Limita de 8 e generoasă intenționat: un emoji nu e un caracter, ci până la
-- mai mulți codepoints (emoji compuse). Ce se afișează rămâne un singur semn;
-- limita doar oprește un roman lipit în câmp.
--
-- Depinde de 0055. Sigur la re-rulare.
-- =========================================================

alter table public.event_access
  add column if not exists planner_emoji text
    check (planner_emoji is null or char_length(planner_emoji) <= 8);

comment on column public.event_access.planner_emoji is
  'Simbol opțional pe bulina/blocul elevului în planificator. Gol = doar culoarea.';

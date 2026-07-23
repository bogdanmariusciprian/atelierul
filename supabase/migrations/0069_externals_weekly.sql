-- =========================================================
-- Migration 0069 — Întâlniri pe săptămână pentru elevii externi.
--
-- Simetrie cu cota elevilor reali (0065), dar cu o deosebire de natură:
-- externii îi așază PROFESORUL, iar garda din trigger scutește adminul — deci
-- limita asta e un REPER al lui (interfața oprește tragerea peste ea), nu o
-- regulă de securitate. Nu are ce enforce-ui pe server: nimeni în afară de
-- admin nu atinge orele externilor.
--
-- Sigură la re-rulare.
-- =========================================================

alter table public.planner_externals
  add column if not exists max_weekly int not null default 1
  check (max_weekly between 1 and 3);

comment on column public.planner_externals.max_weekly is
  'Câte întâlniri pe săptămână plănuiește profesorul cu acest extern (reper de UI).';

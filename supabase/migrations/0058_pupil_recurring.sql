-- =========================================================
-- Migration 0058 — Recurența devine o trăsătură a ELEVULUI, nu un comutator
-- global de bară.
--
-- „Cu Ana lucrez în fiecare săptămână, cu Mihai când apucă" e o realitate
-- per copil, deci locuiește pe marcarea copilului, lângă nume, culoare și
-- durată. Când bulina lui e trasă în orar, ora devine serie săptămânală
-- de la sine — fără un mod global pe care să ții minte să-l aprinzi și,
-- mai rău, să-l stingi.
--
-- Ce NU se schimbă (și e important): seriile rămân materializate. O
-- săptămână anulată e o apariție anulată — restul aparițiilor nu se ating,
-- decât dacă profesorul cere explicit „toată seria".
--
-- Depinde de 0055. Sigur la re-rulare.
-- =========================================================

alter table public.event_access
  add column if not exists planner_recurring boolean not null default false;

comment on column public.event_access.planner_recurring is
  'Blocurile acestui elev se așază ca serie săptămânală. Setat din bulina lui, în planificator.';

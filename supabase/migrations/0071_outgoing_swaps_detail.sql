-- =========================================================
-- Migration 0071 — my_outgoing_swaps arată și „?"-ul țintit.
--
-- Ca B să-și vadă „!"-ul pe blocul lui A (acolo unde a oferit) — nu doar pe
-- blocul lui, care poate fi în altă săptămână, deci nici pe ecran — funcția
-- întoarce acum și want_slot (blocul-țintă) + offer_id (ca să poată retrage
-- fix acea ofertă). Depinde de 0070. Sigură la re-rulare.
-- =========================================================

-- Schimbăm tipul de retur (0070 întorcea doar offer_slot) → Postgres cere
-- DROP înainte; „create or replace" nu poate schimba semnătura de retur.
drop function if exists public.my_outgoing_swaps();

create function public.my_outgoing_swaps()
returns table (offer_id uuid, want_slot uuid, offer_slot uuid)
language sql security definer set search_path = public as $$
  select id, want_slot, offer_slot from public.planner_swap_offers
  where offerer = auth.uid() and status = 'open';
$$;

-- DROP a înlăturat și dreptul de execuție — îl redăm.
grant execute on function public.my_outgoing_swaps() to authenticated;

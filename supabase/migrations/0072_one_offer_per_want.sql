-- =========================================================
-- Migration 0072 — Un singur „!" către același „?".
--
-- Regula lui Marius: B poate oferi ACELAȘI bloc către „?"-uri DIFERITE (cazuri
-- diferite), dar NU poate trimite două „!" aceluiași „?". Constrângerea unică
-- (want_slot, offer_slot) din 0070 oprea doar oferta identică; nu oprea B să
-- ofere DOUĂ blocuri diferite aceluiași „?". Garda de aici o închide.
--
-- Depinde de 0070. Sigură la re-rulare.
-- =========================================================

create or replace function public.offer_swap(p_want uuid, p_offer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare w public.planner_slots; o public.planner_slots;
begin
  select * into w from public.planner_slots where id = p_want;
  select * into o from public.planner_slots where id = p_offer;
  if w is null or o is null then raise exception 'Bloc inexistent.' using errcode = 'check_violation'; end if;
  if o.user_id <> auth.uid() then raise exception 'Poți oferi doar blocul tău.' using errcode = '42501'; end if;
  if not w.swap_wanted or w.status <> 'booked' or w.starts_at < now() then
    raise exception 'Blocul nu mai e oferit la schimb.' using errcode = 'check_violation';
  end if;
  if o.status <> 'booked' or coalesce(o.kind,'lesson') <> 'lesson' or o.starts_at < now() then
    raise exception 'Blocul tău nu poate fi oferit.' using errcode = 'check_violation';
  end if;
  if w.user_id = o.user_id then raise exception 'E chiar blocul tău.' using errcode = 'check_violation'; end if;
  if not public.swap_in_window(w.starts_at, o.starts_at) then
    raise exception 'Schimbul merge doar în săptămâna asta sau următoarea.' using errcode = 'check_violation';
  end if;
  -- NOU (0072): un singur „!" către același „?". Dacă am deja o ofertă deschisă
  -- pentru acest „?" (cu ALT bloc), o resping — retrag-o întâi.
  if exists (
    select 1 from public.planner_swap_offers
     where want_slot = p_want and offerer = auth.uid()
       and status = 'open' and offer_slot <> p_offer
  ) then
    raise exception 'Ai deja o ofertă la acest schimb. Retrage-o întâi dacă vrei să oferi altă oră.'
      using errcode = 'check_violation';
  end if;

  insert into public.planner_swap_offers (want_slot, offer_slot, offerer)
  values (p_want, p_offer, auth.uid())
  on conflict (want_slot, offer_slot) do update set status = 'open', created_at = now();
  update public.planner_slots set swap_wanted = true where id = p_want;
end; $$;

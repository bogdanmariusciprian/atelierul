-- =========================================================
-- Migration 0070 — Schimb de sloturi între elevi („?" / „!").
--
-- Povestea (definită de Marius): elevul A pune „?" pe blocul lui (vrea să-l
-- dea la schimb). Ceilalți elevi marcați văd „?"-ul pe blocul lui (anonim) și
-- pot trimite un „!" — o ofertă făcută CU UNUL DIN BLOCURILE LOR („schimb pe
-- schimb", nu iei fără să dai). A vede lista de „!" (fiecare arată CE primește
-- la schimb: ziua/ora/săptămâna blocului oferit — fără nume), alege unul și
-- confirmă. Atunci cele două blocuri fac schimb de ORE DE START, fiecare
-- păstrându-și PROPRIA durată (A de 1h30 rămâne 1h30, B de 2h rămâne 2h).
-- Ofertele nealese expiră. Pe ambele blocuri rămâne un „!" 5 minute (marcaj
-- vizual, prin swapped_at), apoi dispare.
--
-- Fereastra: schimbul poate traversa săptămâna curentă și următoarea (max 2
-- consecutive). Confirmarea e strict A↔B; profesorul doar vede rezultatul.
--
-- Adevărul stă pe server: cine ce poate face e impus de RPC-uri definer +
-- de trigger-ul de ore/disponibilitate/cotă (0065), care validează automat
-- pozițiile NOI la mutare. Depinde de 0053..0065. Sigură la re-rulare.
-- =========================================================

-- 1. Marcaje pe slot.
alter table public.planner_slots
  add column if not exists swap_wanted boolean not null default false,
  add column if not exists swapped_at  timestamptz;

comment on column public.planner_slots.swap_wanted is
  'Elevul a pus „?" — blocul e oferit la schimb.';
comment on column public.planner_slots.swapped_at is
  'Momentul ultimului schimb — UI arată „!" 5 minute după.';

-- 2. Constrângerea anti-suprapunere devine DEFERABILĂ, ca schimbul de ore să
--    se poată face în aceeași tranzacție (A→ora lui B și B→ora lui A trec
--    printr-o stare intermediară care s-ar ciocni; verificarea se amână la
--    commit, când pozițiile finale sunt disjuncte).
alter table public.planner_slots
  drop constraint if exists tutoring_slots_no_overlap;
alter table public.planner_slots
  add constraint tutoring_slots_no_overlap
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'booked')
  deferrable initially immediate;

-- 3. Ofertele („!"). O ofertă = blocul oferit (offer_slot) pentru blocul dorit
--    (want_slot, cel cu „?"). Un slot oferit poate ținti mai multe „?"-uri;
--    un „?" poate primi mai multe oferte. Perechea e unică.
create table if not exists public.planner_swap_offers (
  id         uuid primary key default gen_random_uuid(),
  want_slot  uuid not null references public.planner_slots(id) on delete cascade,
  offer_slot uuid not null references public.planner_slots(id) on delete cascade,
  offerer    uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'open' check (status in ('open', 'accepted', 'expired')),
  created_at timestamptz not null default now(),
  unique (want_slot, offer_slot)
);
create index if not exists planner_swap_offers_want_idx on public.planner_swap_offers (want_slot) where status = 'open';
create index if not exists planner_swap_offers_offerer_idx on public.planner_swap_offers (offerer) where status = 'open';

alter table public.planner_swap_offers enable row level security;
-- Citirea directă = doar adminul (depanare). Elevii citesc prin RPC-uri
-- definer, care dau exact ce trebuie fără să scurgă nume. Scrierile — tot prin
-- RPC-uri (nicio politică de insert/update/delete → interzis direct).
drop policy if exists swap_offers_admin_read on public.planner_swap_offers;
create policy swap_offers_admin_read on public.planner_swap_offers
  for select using (public.is_admin_user());
grant select on public.planner_swap_offers to authenticated;

-- 4. „?": elevul marchează/demarchează blocul LUI, viitor, de tip lecție.
create or replace function public.set_swap_wanted(p_slot uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s public.planner_slots;
begin
  select * into s from public.planner_slots where id = p_slot;
  if not found or s.user_id <> auth.uid() then
    raise exception 'Nu e blocul tău.' using errcode = '42501';
  end if;
  if s.status <> 'booked' or coalesce(s.kind,'lesson') <> 'lesson' then
    raise exception 'Doar o oră activă poate fi dată la schimb.' using errcode = 'check_violation';
  end if;
  if s.starts_at < now() then
    raise exception 'Ora a trecut.' using errcode = 'check_violation';
  end if;
  update public.planner_slots set swap_wanted = p_on where id = p_slot;
  if not p_on then
    update public.planner_swap_offers set status = 'expired'
     where want_slot = p_slot and status = 'open';
  end if;
end; $$;

-- Helper: două momente sunt în săptămâna curentă sau următoarea (luni-based,
-- ceasul Bucureștiului), adică schimbul nu depășește 2 săptămâni consecutive.
create or replace function public.swap_in_window(a timestamptz, b timestamptz)
returns boolean language sql stable set search_path = public as $$
  select
    date_trunc('week', a at time zone 'Europe/Bucharest')
      between date_trunc('week', now() at time zone 'Europe/Bucharest')
          and date_trunc('week', now() at time zone 'Europe/Bucharest') + interval '7 days'
    and
    date_trunc('week', b at time zone 'Europe/Bucharest')
      between date_trunc('week', now() at time zone 'Europe/Bucharest')
          and date_trunc('week', now() at time zone 'Europe/Bucharest') + interval '7 days';
$$;

-- 5. „!": elevul B oferă unul din blocurile LUI (offer_slot) pentru „?"-ul lui A.
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
  insert into public.planner_swap_offers (want_slot, offer_slot, offerer)
  values (p_want, p_offer, auth.uid())
  on conflict (want_slot, offer_slot) do update set status = 'open', created_at = now();
  -- Atingem blocul-țintă (aceeași valoare) ca să pornească realtime-ul pe
  -- planner_slots — altfel A n-ar vedea „!"-ul apărând live (tabela de oferte
  -- e admin-only la citire, deci n-o putem asculta din client).
  update public.planner_slots set swap_wanted = true where id = p_want;
end; $$;

-- Retrage o ofertă trimisă (B se răzgândește).
create or replace function public.withdraw_swap(p_offer uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.planner_swap_offers set status = 'expired'
   where id = p_offer and offerer = auth.uid() and status = 'open';
end; $$;

-- Retrage TOATE ofertele mele trimise de pe un anumit bloc (clientul are
-- doar id-ul blocului, nu al ofertei).
create or replace function public.withdraw_swap_from_slot(p_slot uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.planner_swap_offers set status = 'expired'
   where offer_slot = p_slot and offerer = auth.uid() and status = 'open';
end; $$;

-- 6. Confirmarea: A acceptă o ofertă → schimb de ore de start, fiecare cu
--    durata lui. Trigger-ul validează pozițiile noi (ore/disponibilitate/cotă);
--    excluderea, amânată, verifică la commit că nu se suprapun.
create or replace function public.accept_swap(p_offer uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  off public.planner_swap_offers;
  w public.planner_slots; o public.planner_slots;
  startA timestamptz; durA interval; startB timestamptz; durB interval;
begin
  select * into off from public.planner_swap_offers where id = p_offer and status = 'open';
  if not found then return jsonb_build_object('ok', false, 'error', 'Oferta nu mai e valabilă.'); end if;
  select * into w from public.planner_slots where id = off.want_slot;
  select * into o from public.planner_slots where id = off.offer_slot;
  if w.user_id <> auth.uid() then
    raise exception 'Doar tu îți accepți schimbul.' using errcode = '42501';
  end if;
  if w.status <> 'booked' or o.status <> 'booked' or w.starts_at < now() or o.starts_at < now() then
    update public.planner_swap_offers set status = 'expired' where id = p_offer;
    return jsonb_build_object('ok', false, 'error', 'Unul dintre blocuri nu mai e disponibil.');
  end if;

  startA := w.starts_at; durA := w.ends_at - w.starts_at;
  startB := o.starts_at; durB := o.ends_at - o.starts_at;

  set constraints tutoring_slots_no_overlap deferred;
  update public.planner_slots
     set starts_at = startB, ends_at = startB + durA, swap_wanted = false, swapped_at = now()
   where id = w.id;
  update public.planner_slots
     set starts_at = startA, ends_at = startA + durB, swapped_at = now()
   where id = o.id;

  -- Oferta aleasă = acceptată; toate celelalte oferte care ating vreunul din
  -- cele două blocuri (ca „?" sau ca „!") expiră — orele s-au mutat.
  update public.planner_swap_offers set status = 'accepted' where id = p_offer;
  update public.planner_swap_offers set status = 'expired'
   where status = 'open' and id <> p_offer
     and (want_slot in (w.id, o.id) or offer_slot in (w.id, o.id));

  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'error',
    regexp_replace(SQLERRM, '^.*?:\s*', ''));
end; $$;

-- 7. Citiri pentru elevi (definer, fără nume):
--    ofertele PRIMITE pe blocurile mele cu „?" — cu ce primesc la schimb.
create or replace function public.my_swap_offers()
returns table (offer_id uuid, want_slot uuid, offer_starts timestamptz, offer_ends timestamptz)
language sql security definer set search_path = public as $$
  select o.id, o.want_slot, s.starts_at, s.ends_at
  from public.planner_swap_offers o
  join public.planner_slots w on w.id = o.want_slot
  join public.planner_slots s on s.id = o.offer_slot
  where w.user_id = auth.uid() and o.status = 'open'
    and s.status = 'booked' and s.starts_at > now()
  order by s.starts_at;
$$;

--    blocurile mele de pe care AM trimis o ofertă (ca să le marchez cu „!" pal).
create or replace function public.my_outgoing_swaps()
returns table (offer_slot uuid)
language sql security definer set search_path = public as $$
  select distinct offer_slot from public.planner_swap_offers
  where offerer = auth.uid() and status = 'open';
$$;

grant execute on function public.set_swap_wanted(uuid, boolean) to authenticated;
grant execute on function public.offer_swap(uuid, uuid) to authenticated;
grant execute on function public.withdraw_swap(uuid) to authenticated;
grant execute on function public.withdraw_swap_from_slot(uuid) to authenticated;
grant execute on function public.accept_swap(uuid) to authenticated;
grant execute on function public.my_swap_offers() to authenticated;
grant execute on function public.my_outgoing_swaps() to authenticated;

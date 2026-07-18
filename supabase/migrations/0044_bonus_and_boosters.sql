-- =========================================================
-- Migration 0044 — Întrebări zburătoare + boostere (modul clasic).
--
-- 1) ÎNCHIDE O BREȘĂ VECHE: `test_items.observation` se trimitea în browser
--    odată cu itemul, deci explicația se putea citi ÎNAINTE de răspuns.
--    O revoc, exact ca pe `correct`. De acum ajunge la elev doar prin
--    `answer_test_item` (după ce a bifat) sau prin boosterul „peek".
--
-- 2) Întrebări bonus scurte, scrise de profesor. Zboară pe ecran în modul
--    clasic; prinse și rezolvate, aduc un booster.
--
-- 3) Boosterele stau pe SERVER, legate de sesiunea de joc:
--      • altfel „peek" ar fi un RPC liber și breșa de la (1) s-ar redeschide;
--      • sesiune nouă = inventar gol, deci „pierzi ultima viață, o iei de la
--        zero" iese de la sine, fără curățenie separată.
--    Raritatea o decide serverul; clientul nu-și poate cere „+1 viață".
--
-- Depinde de 0002 (profiles), 0027–0029 (test_items). Sigur la re-rulare.
-- =========================================================

-- ---- 1) Explicația nu mai pleacă odată cu itemul ----
revoke select (observation) on public.test_items from anon, authenticated;

-- ---- 2) Banca de întrebări bonus ----
create table if not exists public.bonus_questions (
  id         uuid primary key default gen_random_uuid(),
  prompt     text not null,
  answers    text[] not null default '{}'::text[], -- variante acceptate
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.bonus_questions enable row level security;

drop policy if exists bonus_read on public.bonus_questions;
create policy bonus_read on public.bonus_questions for select
  using (active or public.is_admin_user());

drop policy if exists bonus_admin_write on public.bonus_questions;
create policy bonus_admin_write on public.bonus_questions for all
  using (public.is_admin_user()) with check (public.is_admin_user());

grant select on public.bonus_questions to anon, authenticated;
grant insert, update, delete on public.bonus_questions to authenticated;
-- răspunsurile NU pleacă în browser (ca la itemii de test)
revoke select (answers) on public.bonus_questions from anon, authenticated;

-- ---- 3) Inventarul de boostere, per sesiune de joc ----
create table if not exists public.game_boosters (
  session_id uuid not null,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('cut1', 'cut2', 'peek', 'life')),
  qty        integer not null default 0 check (qty >= 0),
  primary key (session_id, user_id, kind)
);

alter table public.game_boosters enable row level security;
drop policy if exists boosters_own on public.game_boosters;
create policy boosters_own on public.game_boosters for select
  using (user_id = auth.uid());
grant select on public.game_boosters to authenticated;
-- scrierea se face DOAR prin funcțiile de mai jos

-- Normalizare pentru comparat răspunsuri scurte: fără diacritice, fără
-- spații/semne, minuscule. „Subiect!" = „subiect" = „SUBIECT".
create or replace function public.norm_answer(t text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(
           translate(lower(coalesce(t, '')), 'ăâîșşțţ', 'aaisstt'),
           '[^a-z0-9]', '', 'g');
$$;

-- ---- Prinde și răspunde la o întrebare zburătoare ----
create or replace function public.answer_bonus_question(
  p_id uuid, p_text text, p_session uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q     public.bonus_questions;
  uid   uuid := auth.uid();
  ok    boolean;
  roll  integer;
  gift  text;
begin
  if uid is null or p_session is null then
    return jsonb_build_object('error', 'not-signed-in');
  end if;
  select * into q from public.bonus_questions where id = p_id and active;
  if not found then
    return jsonb_build_object('error', 'not-available');
  end if;

  ok := exists (
    select 1 from unnest(q.answers) a
     where public.norm_answer(a) = public.norm_answer(p_text)
       and public.norm_answer(a) <> ''
  );

  if not ok then
    -- E o întrebare uşoară, de bonus: arătăm răspunsul, se învaţă ceva.
    return jsonb_build_object('correct', false, 'answer', coalesce(q.answers[1], ''));
  end if;

  -- Raritatea o decide SERVERUL: viața e cea mai rară.
  roll := floor(random() * 100)::int;
  gift := case
            when roll < 45 then 'cut1'
            when roll < 70 then 'cut2'
            when roll < 90 then 'peek'
            else 'life'
          end;

  insert into public.game_boosters (session_id, user_id, kind, qty)
       values (p_session, uid, gift, 1)
  on conflict (session_id, user_id, kind)
    do update set qty = public.game_boosters.qty + 1;

  return jsonb_build_object('correct', true, 'booster', gift);
end; $$;

grant execute on function public.answer_bonus_question(uuid, text, uuid) to authenticated;

-- ---- Folosește un booster ----
--   cut1/cut2 → literele GREȘITE de ascuns (nu dezvăluie cheia)
--   peek      → observația itemului (singura cale spre ea înainte de răspuns)
--   life      → doar confirmarea; viețile sunt stare de joc, nu de scor
create or replace function public.use_booster(
  p_session uuid, p_kind text, p_item uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  it   public.test_items;
  eff  text;
  cut  text[];
  left_qty integer;
begin
  if uid is null then
    return jsonb_build_object('error', 'not-signed-in');
  end if;

  update public.game_boosters
     set qty = qty - 1
   where session_id = p_session and user_id = uid and kind = p_kind and qty > 0
   returning qty into left_qty;
  if not found then
    return jsonb_build_object('error', 'empty');
  end if;

  if p_kind = 'life' then
    return jsonb_build_object('ok', true, 'left', left_qty);
  end if;

  select * into it from public.test_items where id = p_item and published;
  if not found then
    return jsonb_build_object('ok', true, 'left', left_qty);
  end if;

  if p_kind = 'peek' then
    return jsonb_build_object('ok', true, 'left', left_qty,
                              'observation', coalesce(it.observation, ''));
  end if;

  eff := coalesce(it.correct_2026, it.correct);
  select array_agg(l order by random())
    into cut
    from unnest(array['A', 'B', 'C', 'D']) l
   where l <> eff
     and case l when 'A' then it.option_a when 'B' then it.option_b
                when 'C' then it.option_c else it.option_d end is not null;

  return jsonb_build_object(
    'ok', true, 'left', left_qty,
    'cut', to_jsonb(cut[1 : case when p_kind = 'cut2' then 2 else 1 end])
  );
end; $$;

grant execute on function public.use_booster(uuid, text, uuid) to authenticated;

-- ---- Profesorul își vede întrebările CU tot cu răspunsuri ----
-- (coloana `answers` e revocată pentru toată lumea, deci are nevoie de o
--  cale definer, exact ca `admin_test_items` pentru cheia itemilor.)
create or replace function public.admin_bonus_questions()
returns setof public.bonus_questions
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_user() then
    raise exception 'not allowed';
  end if;
  return query select * from public.bonus_questions order by created_at desc;
end; $$;

grant execute on function public.admin_bonus_questions() to authenticated;

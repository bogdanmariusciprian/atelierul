-- =========================================================
-- Migration 0045 — Explicația, la cerere, ÎNAINTE de răspuns (modul învățare).
--
-- Observația e RAȚIONAMENT, nu cheie: spune de ce, nu spune „răspunsul e B".
-- Elevul o citește, judecă singur și abia apoi alege; varianta corectă i se
-- dezvăluie după ce a răspuns, ca întotdeauna. Deci citirea ei NU costă puncte.
--
-- Acest RPC e necesar fiindcă 0044 a revocat `test_items.observation`: fără el,
-- explicația n-ar mai putea ajunge la elev decât după răspuns.
--
-- Pontajul se reține totuși (fără efect asupra punctelor) — e un semnal util
-- pentru profesor: se vede cine se sprijină mereu pe explicație.
--
-- Depinde de 0032 (answer_test_item) + 0044 (observation revocată).
-- Sigur la re-rulare.
-- =========================================================

create table if not exists public.test_item_peeks (
  session_id uuid not null,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  item_id    uuid not null references public.test_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id, item_id)
);

alter table public.test_item_peeks enable row level security;
drop policy if exists peeks_own on public.test_item_peeks;
create policy peeks_own on public.test_item_peeks for select
  using (user_id = auth.uid() or public.is_admin_user());
grant select on public.test_item_peeks to authenticated;
-- scrierea doar prin RPC-ul de mai jos

-- Întoarce explicația și reține discret că a fost cerută. Vizitatorii o pot
-- citi liber (n-au sesiune și oricum nu primesc puncte).
create or replace function public.reveal_observation(p_item uuid, p_session uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare it public.test_items;
begin
  select * into it from public.test_items where id = p_item and published;
  if not found then
    return jsonb_build_object('error', 'not-available');
  end if;

  if auth.uid() is not null and p_session is not null then
    insert into public.test_item_peeks (session_id, user_id, item_id)
         values (p_session, auth.uid(), p_item)
    on conflict do nothing;
  end if;

  -- DOAR explicația. Cheia rămâne exclusiv în answer_test_item.
  return jsonb_build_object('observation', coalesce(it.observation, ''));
end; $$;

grant execute on function public.reveal_observation(uuid, uuid) to anon, authenticated;

-- Restabilesc answer_test_item la regula curată (fără penalizare pentru
-- explicația citită), ca aplicarea acestei migrări să ducă mereu în starea
-- corectă, indiferent ce versiune era instalată înainte.
create or replace function public.answer_test_item(p_id uuid, p_answer text, p_session uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it         public.test_items;
  eff        text;
  is_correct boolean;
  uid        uuid := auth.uid();
  awarded    boolean := false;
  pts        integer := 5;
begin
  select * into it from public.test_items where id = p_id and published = true;
  if not found then
    return jsonb_build_object('error', 'not-available');
  end if;

  eff := coalesce(it.correct_2026, it.correct);
  is_correct := upper(coalesce(p_answer, '')) = eff;

  if is_correct
     and uid is not null
     and p_session is not null
     and not exists (select 1 from public.profiles where id = uid and role = 'admin')
  then
    begin
      insert into public.test_answer_rewards (user_id, item_id, session_id)
        values (uid, p_id, p_session);
      insert into public.points_ledger (user_id, delta, reason)
        values (uid, pts, 'test:' || it.exam);
      awarded := true;
    exception when unique_violation then
      awarded := false;
    end;
  end if;

  return jsonb_build_object(
    'correct',        is_correct,
    'correct_answer', eff,
    'historical',     case when it.correct is distinct from eff then it.correct else null end,
    'observation',    coalesce(it.observation, ''),
    'awarded',        awarded,
    'points',         case when awarded then pts else 0 end
  );
end;
$$;

grant execute on function public.answer_test_item(uuid, text, uuid) to anon, authenticated;

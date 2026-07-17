-- =========================================================
-- Migration 0032 — Mini-game answers: cheat-safe check + points.
--
-- `answer_test_item()` is the ONE way a pupil submits an answer in the game:
--   • it decides correctness SERVER-side (the answer key never ships), reveals
--     the effective correct letter + observation + the „pe gramatica veche" note;
--   • it awards a few points — but ONLY once per (user, item, mini-game session).
--     The same item answered correctly in a DIFFERENT session earns again
--     (that's the interim rule Marius chose; finer points logic comes later).
--   • the teacher (admin) and signed-out guests earn no points; guests still
--     get the correctness + observation so they can practise.
--
-- Points are inserted only here (SECURITY DEFINER) — never by the client.
-- Depends on 0002 (points_ledger) + 0027–0029 (test_items). Safe to re-run.
-- =========================================================

-- One reward per (user, item, session). No client INSERT — only the RPC writes.
create table if not exists public.test_answer_rewards (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  item_id    uuid not null references public.test_items (id) on delete cascade,
  session_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id, session_id)
);

alter table public.test_answer_rewards enable row level security;

drop policy if exists test_answer_rewards_read_own on public.test_answer_rewards;
create policy test_answer_rewards_read_own on public.test_answer_rewards
  for select using (auth.uid() = user_id);

grant select on public.test_answer_rewards to authenticated;

-- ---------------------------------------------------------
-- answer_test_item — submit ONE answer; check + reveal + (maybe) award.
-- ---------------------------------------------------------
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

  -- Award points: correct + signed-in + not admin + first time in THIS session.
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
      awarded := false; -- already rewarded for this item in this session
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

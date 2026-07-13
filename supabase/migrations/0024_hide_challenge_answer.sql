-- =========================================================
-- Migration 0024 — Hide the daily challenge's ANSWER from the browser.
--
-- solve_challenge (0011) already decides correctness server-side, so points
-- were safe. But `challenges.correct` was still SELECT-able: the answer sat in
-- the page/network for anyone who looked. RLS filters ROWS, not COLUMNS — so
-- the fix is a column-level revoke plus two SECURITY DEFINER doors:
--   • get_challenge_answer(challenge) → the correct index, but ONLY to the
--     teacher, or to a pupil who has ALREADY used their one attempt (so the UI
--     can still highlight the right option afterwards — the teaching moment).
--   • list_challenges_admin() → full rows (incl. `correct`) for the teacher's
--     scheduling screen.
-- solve_challenge now also RETURNS the answer, so the reveal needs no 2nd call.
-- Depends on 0004 (challenges), 0011 (solve_challenge). Safe to re-run.
-- =========================================================

-- The answer is no longer readable straight off the table by ANYONE.
revoke select (correct) on public.challenges from anon, authenticated;

-- ---------------------------------------------------------
-- get_challenge_answer(challenge) → integer (null when not allowed yet)
-- ---------------------------------------------------------
create or replace function public.get_challenge_answer(p_challenge uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ans text;
begin
  if uid is null then
    return null;
  end if;
  -- The teacher always may; a pupil only AFTER they answered.
  if not (
    exists (select 1 from public.profiles where id = uid and role = 'admin')
    or exists (select 1 from public.challenge_solves
               where challenge_id = p_challenge and user_id = uid)
  ) then
    return null; -- no peeking before you answer
  end if;

  select correct into ans from public.challenges where id = p_challenge;
  return nullif(ans, '')::integer;
end;
$$;

-- ---------------------------------------------------------
-- list_challenges_admin() → the teacher's scheduling list, WITH answers.
-- ---------------------------------------------------------
create or replace function public.list_challenges_admin()
returns setof public.challenges
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  return query select * from public.challenges order by active_date asc nulls last;
end;
$$;

-- ---------------------------------------------------------
-- solve_challenge: unchanged rules, but now also returns `answer` so the UI
-- can reveal the right option immediately after the (single) attempt.
-- ---------------------------------------------------------
create or replace function public.solve_challenge(p_challenge uuid, p_choice integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  ch         public.challenges;
  existing   public.challenge_solves;
  is_correct boolean;
  reward_pts integer;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  if exists (select 1 from public.profiles where id = uid and role = 'admin') then
    return jsonb_build_object('correct', false, 'awarded', 0, 'admin', true);
  end if;

  select * into ch from public.challenges where id = p_challenge;
  if not found then
    return jsonb_build_object('error', 'no-challenge');
  end if;

  select * into existing
    from public.challenge_solves
    where challenge_id = p_challenge and user_id = uid;
  if found then
    return jsonb_build_object('correct', existing.correct, 'awarded', 0,
                              'choice', existing.choice, 'already', true,
                              'answer', nullif(ch.correct, '')::integer);
  end if;

  is_correct := (ch.correct = p_choice::text);
  reward_pts := greatest(0, least(coalesce(ch.reward, 15), 50));

  insert into public.challenge_solves (challenge_id, user_id, choice, correct)
    values (p_challenge, uid, p_choice, is_correct);

  if is_correct then
    insert into public.points_ledger (user_id, delta, reason)
      values (uid, reward_pts, 'challenge:' || p_challenge);
  end if;

  return jsonb_build_object(
    'correct', is_correct,
    'awarded', case when is_correct then reward_pts else 0 end,
    'choice',  p_choice,
    'already', false,
    'answer',  nullif(ch.correct, '')::integer
  );
end;
$$;

grant execute on function public.get_challenge_answer(uuid) to authenticated;
grant execute on function public.list_challenges_admin()   to authenticated;
grant execute on function public.solve_challenge(uuid, integer) to authenticated;

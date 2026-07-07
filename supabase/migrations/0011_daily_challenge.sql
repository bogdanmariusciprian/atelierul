-- =========================================================
-- Migration 0011 — Daily challenge: cheat-safe solving + points.
--
-- The daily challenge now lives in the `challenges` table (the teacher
-- schedules them per date — admin-only writes, already enforced by the
-- challenges_write policy from 0004). A pupil SOLVES it through the
-- security-definer RPC below, which:
--   • checks the answer against the stored `correct` (server-side — the
--     browser never decides if you were right),
--   • awards the challenge's `reward` points ONCE, via points_ledger,
--   • records the attempt so there's exactly ONE shot per day (no retry,
--     no double points), and remembers what you chose for the UI.
-- The teacher (admin) isn't in the game → solving earns him nothing.
--
-- Ref: OWASP — never trust client-side validation; the server decides.
-- Depends on 0002 (points_ledger), 0004 (challenges, challenge_solves).
-- Safe to re-run.
-- =========================================================

-- Remember WHAT the pupil chose and WHETHER it was right (for the locked
-- "you already answered" state on reload). challenge_solves already has the
-- PK (challenge_id, user_id) → one attempt per pupil per challenge.
alter table public.challenge_solves add column if not exists choice  integer;
alter table public.challenge_solves add column if not exists correct boolean;

-- ---------------------------------------------------------
-- solve_challenge(challenge, choice) → jsonb
--   { correct, awarded, choice, already }
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

  -- The teacher isn't in the game — no points, but don't error.
  if exists (select 1 from public.profiles where id = uid and role = 'admin') then
    return jsonb_build_object('correct', false, 'awarded', 0, 'admin', true);
  end if;

  select * into ch from public.challenges where id = p_challenge;
  if not found then
    return jsonb_build_object('error', 'no-challenge');
  end if;

  -- One attempt per pupil per challenge (idempotent — never double points).
  select * into existing
    from public.challenge_solves
    where challenge_id = p_challenge and user_id = uid;
  if found then
    return jsonb_build_object('correct', existing.correct, 'awarded', 0,
                              'choice', existing.choice, 'already', true);
  end if;

  is_correct := (ch.correct = p_choice::text);
  reward_pts := greatest(0, least(coalesce(ch.reward, 15), 50)); -- clamp

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
    'already', false
  );
end;
$$;

grant execute on function public.solve_challenge(uuid, integer) to authenticated;

-- (Reads: `challenges` is already SELECT-able by anon/authenticated and
--  `challenge_solves` is SELECT-own — both from 0004 — so the client can
--  fetch today's challenge and whether it already answered.)

-- =========================================================
-- Migration 0018 — Exercises: cheat-safe approval reward + solving.
--
-- The `exercises` table + `exercise_votes` already exist (0004) with RLS:
-- members propose (status forced 'pending'), the teacher approves/edits
-- (admin-only UPDATE). This migration adds the CHEAT-SAFE money paths that a
-- raw client insert must never touch — points always flow through
-- points_ledger via SECURITY DEFINER RPCs:
--   • approve_exercise → sets status='approved' (+verified) AND awards the
--     AUTHOR points once (their proposal made it in).
--   • reject_exercise  → sets status='rejected'.
--   • solve_exercise   → a pupil answers an APPROVED exercise; the SERVER
--     re-derives correctness from the stored `data` (never trusts the
--     browser), records exactly one attempt, awards a small reward on the
--     first CORRECT solve.
-- The teacher (admin) isn't in the game → solving earns him nothing.
--
-- Ref: OWASP — the server decides correctness, not the client.
-- Depends on 0002 (points_ledger), 0004 (exercises). Safe to re-run.
-- =========================================================

-- One attempt per pupil per exercise (like challenge_solves). Remembers
-- whether they got it right for the locked "already solved" UI state.
create table if not exists public.exercise_solves (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  correct     boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (exercise_id, user_id)
);
alter table public.exercise_solves enable row level security;
drop policy if exists exercise_solves_read on public.exercise_solves;
create policy exercise_solves_read on public.exercise_solves for select
  using (user_id = auth.uid());
-- (Inserted only via solve_exercise below — no direct client insert.)

-- ---------------------------------------------------------
-- approve_exercise(exercise, verified, reward) → jsonb
--   Admin only. Idempotent: awards the author ONCE (only on the transition
--   into 'approved'). `verified` marks it as teacher-checked/edited.
-- ---------------------------------------------------------
create or replace function public.approve_exercise(
  p_id uuid, p_verified boolean default true, p_reward integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  ex     public.exercises;
  reward integer := greatest(0, least(coalesce(p_reward, 20), 50)); -- clamp
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'admin only';
  end if;

  select * into ex from public.exercises where id = p_id;
  if not found then
    return jsonb_build_object('error', 'no-exercise');
  end if;

  update public.exercises
     set status = 'approved', verified = p_verified,
         decided_by = uid, decided_at = now()
   where id = p_id;

  -- Award the author only on the FIRST approval (never on a re-approve/edit),
  -- and never to the teacher (authors are members, but guard anyway).
  if ex.status <> 'approved'
     and not exists (select 1 from public.profiles where id = ex.author_id and role = 'admin') then
    insert into public.points_ledger (user_id, delta, reason)
      values (ex.author_id, reward, 'exercise:' || p_id);
  end if;

  return jsonb_build_object('status', 'approved', 'awarded',
    case when ex.status <> 'approved' then reward else 0 end);
end;
$$;

-- ---------------------------------------------------------
-- reject_exercise(exercise) → jsonb   (admin only)
-- ---------------------------------------------------------
create or replace function public.reject_exercise(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'admin only';
  end if;
  update public.exercises
     set status = 'rejected', decided_by = uid, decided_at = now()
   where id = p_id;
  return jsonb_build_object('status', 'rejected');
end;
$$;

-- ---------------------------------------------------------
-- solve_exercise(exercise, answer) → jsonb
--   { correct, awarded, already }
--   The pupil submits their answer; the SERVER decides correctness from the
--   stored `data` by kind. One attempt; reward only on first CORRECT solve.
-- ---------------------------------------------------------
create or replace function public.solve_exercise(
  p_id uuid, p_answer jsonb, p_reward integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  ex         public.exercises;
  existing   public.exercise_solves;
  is_correct boolean := false;
  reward     integer := greatest(0, least(coalesce(p_reward, 5), 20)); -- clamp
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  -- The teacher isn't in the game — record nothing, award nothing.
  if exists (select 1 from public.profiles where id = uid and role = 'admin') then
    return jsonb_build_object('correct', false, 'awarded', 0, 'admin', true);
  end if;

  select * into ex from public.exercises where id = p_id;
  if not found or ex.status <> 'approved' then
    return jsonb_build_object('error', 'not-approved');
  end if;

  -- One attempt per pupil per exercise (idempotent).
  select * into existing from public.exercise_solves
    where exercise_id = p_id and user_id = uid;
  if found then
    return jsonb_build_object('correct', existing.correct, 'awarded', 0, 'already', true);
  end if;

  -- Server-side correctness by kind (never trust the browser).
  if ex.kind = 'choice' then
    is_correct := (p_answer->>'choice') is not null
              and (p_answer->>'choice') = (ex.data->>'correct');
  elsif ex.kind = 'fill' then
    -- Accepted answers are stored pipe-separated ("să vină|vină"); any match wins.
    is_correct := exists (
      select 1 from unnest(string_to_array(coalesce(ex.data->>'answer', ''), '|')) a
      where btrim(a) <> ''
        and lower(btrim(a)) = lower(btrim(coalesce(p_answer->>'text', '')))
    );
  elsif ex.kind = 'match' then
    is_correct := (p_answer->'pairs') is not null
              and (p_answer->'pairs') = (ex.data->'pairs');
  end if;

  insert into public.exercise_solves (exercise_id, user_id, correct)
    values (p_id, uid, is_correct);

  if is_correct then
    insert into public.points_ledger (user_id, delta, reason)
      values (uid, reward, 'exercise-solved:' || p_id);
  end if;

  return jsonb_build_object(
    'correct', is_correct,
    'awarded', case when is_correct then reward else 0 end,
    'already', false
  );
end;
$$;

-- The teacher may also delete a proposal outright (0004 granted only
-- select/insert/update). RLS still restricts it to the admin.
drop policy if exists exercises_delete on public.exercises;
create policy exercises_delete on public.exercises for delete using (public.is_admin_user());
grant delete on public.exercises to authenticated;

grant execute on function public.approve_exercise(uuid, boolean, integer) to authenticated;
grant execute on function public.reject_exercise(uuid)                    to authenticated;
grant execute on function public.solve_exercise(uuid, jsonb, integer)     to authenticated;
grant select on public.exercise_solves to authenticated;

-- =========================================================
-- Migration 0022 — "Mark reply correct" → REAL, cheat-safe points.
--
-- The teacher can mark a comment (forum reply OR lesson comment) as the
-- CORRECT answer; its author earns points. Until now this lived only in the
-- browser: the points vanished on reload (a feature that looked like it
-- worked but lied). Now:
--   • comments.correct  — the flag is persisted, so the ✓ survives a reload;
--   • mark_comment_correct(comment, on) — SECURITY DEFINER RPC, admin-only,
--     flips the flag AND awards (or takes back) the reward via points_ledger.
--     Idempotent: re-marking an already-correct comment awards nothing.
-- The teacher isn't in the game → a comment authored by the admin earns
-- nothing, even if marked.
-- Depends on 0002 (points_ledger), 0003 (comments). Safe to re-run.
-- =========================================================

alter table public.comments
  add column if not exists correct boolean not null default false;

-- ---------------------------------------------------------
-- mark_comment_correct(comment, on) → jsonb { correct, awarded }
--   Admin only. `awarded` is +reward when turning ON, -reward when turning
--   OFF (the ledger stays an honest append-only history), 0 on a no-op.
-- ---------------------------------------------------------
create or replace function public.mark_comment_correct(
  p_comment uuid, p_on boolean, p_reward integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  c      public.comments;
  reward integer := greatest(0, least(coalesce(p_reward, 25), 100)); -- clamp
  delta  integer := 0;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'admin only';
  end if;

  select * into c from public.comments where id = p_comment;
  if not found then
    return jsonb_build_object('error', 'no-comment');
  end if;

  -- Already in the requested state → nothing to do (never double-award).
  if c.correct = p_on then
    return jsonb_build_object('correct', c.correct, 'awarded', 0);
  end if;

  update public.comments set correct = p_on where id = p_comment;

  -- The teacher isn't in the game: his own comments never earn.
  if not exists (select 1 from public.profiles where id = c.author_id and role = 'admin') then
    delta := case when p_on then reward else -reward end;
    insert into public.points_ledger (user_id, delta, reason)
      values (c.author_id,
              delta,
              case when p_on then 'comment-correct:' else 'comment-correct-undo:' end || p_comment);
  end if;

  return jsonb_build_object('correct', p_on, 'awarded', delta);
end;
$$;

grant execute on function public.mark_comment_correct(uuid, boolean, integer) to authenticated;

-- (Reads: `comments` is already SELECT-able by anon/authenticated from 0003,
--  so the new `correct` column comes along with the existing comment queries.)

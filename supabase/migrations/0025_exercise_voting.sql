-- =========================================================
-- Migration 0025 — Community voting on proposals, WITHOUT leaking the answer.
--
-- Decision: pupils should SEE and VOTE on each other's proposals. Until now
-- RLS (0004) only let you read APPROVED exercises + your OWN pending ones — so
-- the ▲ vote button had nothing to vote on.
--
-- But simply opening up `exercises` would hand out the answers: `data` holds
-- them (choice → {options, correct}; fill → {answer}; match → {pairs} — where
-- the pairing IS the answer). A voter who reads the answer of a pending
-- exercise would harvest its points for free the moment it gets approved.
--
-- RLS filters ROWS, not COLUMNS — and here we need something finer still:
-- the SAME column, redacted per row, per caller. So reads go through a
-- SECURITY DEFINER function that strips the answer out of `data` for anyone
-- who isn't the author or the teacher, on proposals that aren't approved yet.
--   • approved  → everyone, full data (it's solvable now; the lesson engine
--                 checks in the browser, exactly like hand-written exercises)
--   • pending   → everyone, ANSWER STRIPPED (author + teacher see it whole)
--   • rejected  → author + teacher only
-- Depends on 0004 (exercises). Safe to re-run.
-- =========================================================

-- Remove the answer from an exercise's public `data`, per kind.
create or replace function public.strip_exercise_answer(p_kind text, p_data jsonb)
returns jsonb
language sql
immutable
as $$
  select case p_kind
    when 'choice' then coalesce(p_data, '{}'::jsonb) - 'correct'
    when 'fill'   then coalesce(p_data, '{}'::jsonb) - 'answer'
    -- For a match, the PAIRING is the answer: publish the two columns instead,
    -- the right-hand one sorted (stable — never reveals the original order).
    when 'match'  then jsonb_build_object(
        'left',  (select coalesce(jsonb_agg(p->0), '[]'::jsonb)
                    from jsonb_array_elements(coalesce(p_data->'pairs', '[]'::jsonb)) p),
        'right', (select coalesce(jsonb_agg(p->1 order by p->>1), '[]'::jsonb)
                    from jsonb_array_elements(coalesce(p_data->'pairs', '[]'::jsonb)) p)
      )
    else coalesce(p_data, '{}'::jsonb)
  end;
$$;

-- ---------------------------------------------------------
-- exercises_visible(lesson) — every exercise you may see, with `data` redacted
-- when you must not know the answer yet. Reads go through THIS, not the table.
-- ---------------------------------------------------------
create or replace function public.exercises_visible(p_lesson text default null)
returns table (
  id          uuid,
  lesson_slug text,
  author_id   uuid,
  author      jsonb,   -- only the PUBLIC-SAFE profile fields (see 0009)
  kind        text,
  prompt      text,
  data        jsonb,
  status      text,
  verified    boolean,
  decided_at  timestamptz,
  created_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    e.id, e.lesson_slug, e.author_id,
    jsonb_build_object(
      'id', p.id, 'display_name', p.display_name, 'avatar_color', p.avatar_color,
      'avatar', p.avatar, 'points', p.points, 'status_line', p.status_line,
      'last_seen_at', p.last_seen_at, 'role', p.role
    ) as author,
    e.kind, e.prompt,
    case
      when e.status = 'approved'
        or e.author_id = auth.uid()
        or public.is_admin_user()
      then e.data                                        -- you may know the answer
      else public.strip_exercise_answer(e.kind, e.data)  -- pending, someone else's
    end as data,
    e.status, e.verified, e.decided_at, e.created_at
  from public.exercises e
  join public.profiles p on p.id = e.author_id
  where (p_lesson is null or e.lesson_slug = p_lesson)
    and (
      e.status = 'approved'                 -- everyone
      or e.status = 'pending'               -- everyone (so they can vote)
      or e.author_id = auth.uid()           -- your own rejected ones
      or public.is_admin_user()             -- the teacher sees all
    );
$$;

grant execute on function public.strip_exercise_answer(text, jsonb) to anon, authenticated;
grant execute on function public.exercises_visible(text)            to anon, authenticated;

-- The table itself stays locked down (defence in depth): a direct SELECT still
-- only ever returns approved + your own — so a leak can't happen by forgetting
-- to use the function. 0004's exercises_read policy is unchanged on purpose.

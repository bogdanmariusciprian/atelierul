-- =========================================================
-- Migration 0028 — Test items: 2026-grammar answer + admin marker.
--
-- What the teacher (Marius) asked for:
--   1) Pre-2026 items keep their HISTORICAL correct answer (`correct`). While
--      verifying each one, the teacher sets the answer per 2026 grammar in a NEW
--      column `correct_2026`. The quiz then checks the EFFECTIVE answer =
--      coalesce(correct_2026, correct). If the two differ, the pupil also sees a
--      note "pe gramatica veche era X". 2026 items leave correct_2026 = null
--      (their `correct` already reflects 2026 grammar).
--   2) A private `flagged` marker the teacher can toggle for own tracking —
--      never shown to pupils, never affects visibility.
--   Formatted text (bold/underline) lives INSIDE question/options/observation as
--      small HTML — no schema change; rendered safely on the pupil side.
--
-- correct_2026 is HIDDEN from the browser exactly like `correct` (column revoke);
-- the effective answer is revealed only by check_test_item, AFTER the pupil answers.
--
-- Depends on 0027. Touches NO existing data (only adds columns). Safe to re-run.
-- =========================================================

alter table public.test_items
  add column if not exists correct_2026 text
    check (correct_2026 is null or correct_2026 in ('A','B','C','D')),
  add column if not exists flagged boolean not null default false;

-- Stable natural key (no duplicates exist) — integrity + future bulk upserts.
create unique index if not exists test_items_natkey
  on public.test_items (exam, year, session, item_no);

-- The 2026 answer is a secret too — never selectable by pupils/guests.
revoke select (correct_2026) on public.test_items from anon, authenticated;

-- ---------------------------------------------------------
-- check_test_item(id, answer) -> jsonb        (pupils AND guests)
--   Uses the EFFECTIVE answer = coalesce(correct_2026, correct).
--   { correct, correct_answer, historical, observation }
--   `historical` is non-null only when it differs from the effective answer.
-- ---------------------------------------------------------
create or replace function public.check_test_item(p_id uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it  public.test_items;
  eff text;
begin
  select * into it from public.test_items where id = p_id and verified = true;
  if not found then
    return jsonb_build_object('error', 'not-available');
  end if;
  eff := coalesce(it.correct_2026, it.correct);
  return jsonb_build_object(
    'correct',        upper(coalesce(p_answer, '')) = eff,
    'correct_answer', eff,
    'historical',     case when it.correct is distinct from eff then it.correct else null end,
    'observation',    coalesce(it.observation, '')
  );
end;
$$;
grant execute on function public.check_test_item(uuid, text) to anon, authenticated;

-- Recreate the admin fetch so its row type picks up the new columns cleanly.
create or replace function public.admin_test_items(p_exam text, p_year integer default null)
returns setof public.test_items
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;
  return query
    select * from public.test_items
    where exam = p_exam and (p_year is null or year = p_year)
    order by year, session, item_no;
end;
$$;
grant execute on function public.admin_test_items(text, integer) to authenticated;

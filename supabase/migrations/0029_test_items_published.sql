-- =========================================================
-- Migration 0029 — Test items: split „verified" from „published".
--
-- Two distinct teacher states (Marius):
--   • verified  = the teacher has CHECKED the item (QA marker, informational);
--   • published = the item is VISIBLE to pupils.
-- Until now a single `verified` flag did both. This adds `published` and moves
-- pupil visibility onto it. `verified` stays as a pure QA marker.
--
-- Backfill: whatever was verified (and therefore already shown) becomes
-- published, so nothing disappears for pupils.
--
-- Depends on 0027 (RLS, check_test_item, test_item_years) + 0028. Safe to re-run.
-- =========================================================

alter table public.test_items
  add column if not exists published boolean not null default false;

-- Preserve current visibility: verified items were shown → keep them published.
update public.test_items set published = true where verified = true and published = false;

-- Pupil visibility now follows `published` (not `verified`).
drop policy if exists test_items_read on public.test_items;
create policy test_items_read on public.test_items
  for select using (published or public.is_admin_user());

-- ---------------------------------------------------------
-- check_test_item: answer a PUBLISHED item only.
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
  select * into it from public.test_items where id = p_id and published = true;
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

-- ---------------------------------------------------------
-- test_item_years: count PUBLISHED items for pupils (all for admin).
-- ---------------------------------------------------------
create or replace function public.test_item_years(p_exam text)
returns table(year integer, n bigint)
language sql
security definer
set search_path = public
as $$
  select year, count(*)::bigint as n
  from public.test_items
  where exam = p_exam
    and (published or public.is_admin_user())
  group by year
  order by year;
$$;
grant execute on function public.test_item_years(text) to anon, authenticated;

-- Recreate the admin fetch so its row type picks up the new `published` column.
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

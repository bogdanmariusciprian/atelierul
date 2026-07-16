-- =========================================================
-- Migration 0027 — Test items (Teste → Admitere Drept), cheat-safe.
--
-- A bank of multiple-choice items imported from the teacher's Excel
-- (Limba romana, 2002-2026). Rules (Marius):
--   * Pupils AND guests see ONLY verified items (the "green" ones). The teacher
--     marks an item `verified` when it's checked -> it becomes visible to all.
--   * Each item's correct answer (A-D) is HIDDEN from the browser (same idea as
--     the daily challenge, 0011/0024): the SELECT privilege on the `correct`
--     column is revoked, so the answer key never ships to a pupil/guest. AFTER
--     the pupil SUBMITS a choice, the server (check_test_item) says whether it
--     was right AND reveals the correct letter for THAT one item + its
--     observation. No answer key sits in the page source.
--   * `observation` = what the user reads after answering (the takeaway).
--   * The teacher sees everything (incl. unverified items + answers) through the
--     admin_test_items RPC.
--
-- The 1850 rows are loaded SEPARATELY from the split seed files
--   supabase/seed/test_items_admitere_drept_p01.sql ... _p10.sql
-- (split so each fits the SQL editor's size limit; run all parts, any order).
-- Apply THIS migration first, then run the seed parts.
--
-- Depends on 0003 (is_admin_user). Safe to re-run.
-- Ref: OWASP — never trust client-side validation; the server decides.
-- =========================================================

create table if not exists public.test_items (
  id          uuid primary key default gen_random_uuid(),
  exam        text not null default 'admitere-drept',   -- category slug in Teste
  year        integer not null,                         -- shown as the item's label
  session     text not null default '',                 -- e.g. "Examen iulie", "Simulare"
  item_no     integer,                                  -- number as in the Excel
  question    text,
  option_a    text,
  option_b    text,
  option_c    text,
  option_d    text,
  correct     text not null check (correct in ('A','B','C','D')),  -- HIDDEN from clients
  observation text,                                     -- shown to the user after answering
  verified    boolean not null default false,           -- green + visible to everyone
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create index if not exists test_items_browse
  on public.test_items (exam, verified, year, session, item_no);

alter table public.test_items enable row level security;

-- Read: verified rows are public; the teacher sees everything (incl. unverified).
drop policy if exists test_items_read on public.test_items;
create policy test_items_read on public.test_items
  for select using (verified or public.is_admin_user());

-- Write: teacher only (publish/verify, edit the observation, fix an item).
drop policy if exists test_items_write on public.test_items;
create policy test_items_write on public.test_items
  for all using (public.is_admin_user()) with check (public.is_admin_user());

-- Column lock on the answer: everyone may read an item, but NOT the `correct`
-- column. (The teacher reads answers through admin_test_items, not directly.)
grant select on public.test_items to anon, authenticated;
revoke select (correct) on public.test_items from anon, authenticated;
grant insert, update, delete on public.test_items to authenticated;  -- gated by RLS (admin only)

-- keep updated_at fresh on edits
create or replace function public.test_items_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists test_items_touch on public.test_items;
create trigger test_items_touch before update on public.test_items
  for each row execute function public.test_items_touch();

-- ---------------------------------------------------------
-- check_test_item(id, answer) -> jsonb        (pupils AND guests)
--   { correct, correct_answer, observation }   -- for a VERIFIED item only.
-- Reveals the answer for ONE item, only after the pupil submits a choice.
-- ---------------------------------------------------------
create or replace function public.check_test_item(p_id uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.test_items;
begin
  select * into it from public.test_items where id = p_id and verified = true;
  if not found then
    return jsonb_build_object('error', 'not-available');
  end if;
  return jsonb_build_object(
    'correct',        upper(coalesce(p_answer, '')) = it.correct,
    'correct_answer', it.correct,
    'observation',    coalesce(it.observation, '')
  );
end;
$$;
grant execute on function public.check_test_item(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------
-- admin_test_items(exam, year) -> setof test_items      (teacher only)
--   Full rows incl. `correct` and UNVERIFIED items, for the admin manager.
--   p_year = null -> all years for that exam.
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- test_item_years(exam) -> (year, n)     (pupils see verified counts; admin all)
--   Lightweight helper for the year filter, so the client doesn't pull the whole
--   table just to build a dropdown.
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
    and (verified or public.is_admin_user())
  group by year
  order by year;
$$;
grant execute on function public.test_item_years(text) to anon, authenticated;

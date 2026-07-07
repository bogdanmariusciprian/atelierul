-- =========================================================
-- Migration 0020 — Kudos: one-a-day, server-enforced.
--
-- `kudos` (clap/poke/snail) exists (0004) with a client INSERT policy
-- (from_user = auth.uid() and not admin). But "once per day per target" can't
-- be trusted to the browser, so writes go through this SECURITY DEFINER RPC
-- which enforces: signed-in · not the teacher · not yourself · at most one
-- row per (from,to,kind) per calendar day. Kudos are a pure social signal —
-- NO points — so there's no ledger here.
-- Depends on 0004 (kudos). Safe to re-run.
-- =========================================================

create or replace function public.give_kudos(p_to uuid, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if exists (select 1 from public.profiles where id = uid and role = 'admin') then
    return jsonb_build_object('ok', false, 'reason', 'admin');
  end if;
  if p_to = uid then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;
  if p_kind not in ('clap', 'poke', 'snail') then
    raise exception 'bad kind';
  end if;
  if not exists (select 1 from public.profiles where id = p_to) then
    return jsonb_build_object('ok', false, 'reason', 'no-target');
  end if;

  -- Already given this kind to this target today? → no-op (idempotent).
  if exists (
    select 1 from public.kudos
    where from_user = uid and to_user = p_to and kind = p_kind
      and created_at >= date_trunc('day', now())
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;

  insert into public.kudos (from_user, to_user, kind) values (uid, p_to, p_kind);
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.give_kudos(uuid, text) to authenticated;

-- (Reads: `kudos` is already SELECT-able by anon/authenticated from 0004, so
--  the client can count claps per member and see what it gave today.)

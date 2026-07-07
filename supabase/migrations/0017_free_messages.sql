-- =========================================================
-- Migration 0017 — Free (non-template) messages between members, with a
-- points-earned QUOTA — enforced on the SERVER (cheat-safe).
--
-- Model (Marius): everyone logged-in gets 3 free messages PER conversation;
-- each 100 points earns +1 more; a free message is max 30 chars. Templates
-- stay unlimited (the safe base). Between members, free text is allowed ONLY
-- through this RPC (the messages RLS from 0013 still blocks raw free text),
-- so the quota + length can't be bypassed.
--
-- Also lets a message be REPORTED (adds 'message' to reports.target_type).
-- Depends on 0004 (messages/reports) + 0013. Safe to re-run.
-- =========================================================

-- Reports can now target a message too.
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports
  add constraint reports_target_type_check check (target_type in ('post', 'comment', 'message'));

-- send_free_message(recipient, body) → jsonb { ok|error, allowance, used, remaining }
create or replace function public.send_free_message(p_recipient uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  pts       integer;
  allowance integer;
  used      integer;
  clean     text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  clean := trim(coalesce(p_body, ''));
  if length(clean) = 0 then return jsonb_build_object('error', 'empty'); end if;
  if length(clean) > 30 then return jsonb_build_object('error', 'too-long'); end if;
  if p_recipient = uid then return jsonb_build_object('error', 'self'); end if;

  select points into pts from public.profiles where id = uid;
  allowance := 3 + floor(coalesce(pts, 0) / 100.0);

  -- Free messages I've already sent to this recipient (template_key IS NULL).
  select count(*) into used
    from public.messages
    where sender_id = uid and recipient_id = p_recipient
      and to_admin = false and template_key is null;

  if used >= allowance then
    return jsonb_build_object('error', 'quota', 'allowance', allowance, 'used', used, 'remaining', 0);
  end if;

  insert into public.messages (sender_id, recipient_id, to_admin, body, template_key)
    values (uid, p_recipient, false, clean, null);

  return jsonb_build_object('ok', true, 'allowance', allowance,
                            'used', used + 1, 'remaining', allowance - used - 1);
end;
$$;

grant execute on function public.send_free_message(uuid, text) to authenticated;

-- =========================================================
-- Migration 0023 — @mention notifications (the last mock notification path).
--
-- Notifications are generated SERVER-side (0016 triggers: friend request /
-- accept, message, like, comment) and have NO client INSERT — by design.
-- @mentions were the one case still faked in the browser, so they vanished on
-- reload. This RPC closes that gap, cheat-safe:
--   • the actor is ALWAYS auth.uid() (you cannot forge a notification "from"
--     someone else),
--   • you may only mention a FRIEND (the same rule the UI enforces),
--   • never yourself, and the teacher (not in the game) sends none.
-- Depends on 0003 (friendships, are_friends), 0004 (notifications), 0016.
-- Safe to re-run.
-- =========================================================

create or replace function public.notify_mention(
  p_user uuid, p_snippet text, p_context text
)
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
  if p_user is null or p_user = uid then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;
  -- Mentions are friends-only (same rule as the composer's validation).
  if not public.are_friends(uid, p_user) then
    return jsonb_build_object('ok', false, 'reason', 'not-friends');
  end if;

  insert into public.notifications (user_id, type, payload)
  values (p_user, 'mention',
    jsonb_build_object(
      'actor', uid,
      'actor_name', public.display_name_of(uid),
      'snippet', left(coalesce(p_snippet, ''), 120),
      'context', left(coalesce(p_context, ''), 80)
    ));

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.notify_mention(uuid, text, text) to authenticated;

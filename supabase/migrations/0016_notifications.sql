-- =========================================================
-- Migration 0016 — Real notifications, generated on the SERVER.
--
-- notifications rows are created by triggers (SECURITY DEFINER — clients
-- still can't insert, per 0004) whenever something happens TO a user:
--   • a friend request arrives / is accepted
--   • a direct message arrives (member → member)
--   • someone ♥-likes your post
--   • someone comments on your post
-- The recipient reads/marks-read their own rows (RLS from 0004).
-- Payload carries the actor's name + a snippet so the bell needs no joins.
-- Safe to re-run. Depends on 0003 (friendships/posts/comments/reactions),
-- 0004 (messages/notifications).
-- =========================================================

-- Helper: a profile's display name (definer → usable inside triggers).
create or replace function public.display_name_of(p uuid)
returns text language sql security definer set search_path = public stable as $$
  select display_name from public.profiles where id = p;
$$;

-- ---- friend request arrives ----
create or replace function public.notify_friend_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (user_id, type, payload)
    values (new.addressee_id, 'friend',
      jsonb_build_object('kind', 'request', 'actor', new.requester_id,
                         'actor_name', public.display_name_of(new.requester_id)));
  end if;
  return new;
end; $$;
drop trigger if exists friendships_notify_ins on public.friendships;
create trigger friendships_notify_ins after insert on public.friendships
  for each row execute function public.notify_friend_request();

-- ---- friend request accepted ----
create or replace function public.notify_friend_accept()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.notifications (user_id, type, payload)
    values (new.requester_id, 'friend',
      jsonb_build_object('kind', 'accepted', 'actor', new.addressee_id,
                         'actor_name', public.display_name_of(new.addressee_id)));
  end if;
  return new;
end; $$;
drop trigger if exists friendships_notify_upd on public.friendships;
create trigger friendships_notify_upd after update on public.friendships
  for each row execute function public.notify_friend_accept();

-- ---- direct message (member → member) ----
create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.recipient_id is not null and not new.to_admin then
    insert into public.notifications (user_id, type, payload)
    values (new.recipient_id, 'message',
      jsonb_build_object('actor', new.sender_id,
                         'actor_name', public.display_name_of(new.sender_id)));
  end if;
  return new;
end; $$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_message();

-- ---- ♥ like on your post ----
create or replace function public.notify_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid; body text;
begin
  if new.emoji = '♥' then
    select author_id, posts.body into author, body from public.posts where id = new.post_id;
    if author is not null and author <> new.user_id then
      insert into public.notifications (user_id, type, payload)
      values (author, 'like',
        jsonb_build_object('actor', new.user_id, 'actor_name', public.display_name_of(new.user_id),
                           'snippet', left(coalesce(body, ''), 80)));
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists post_reactions_notify on public.post_reactions;
create trigger post_reactions_notify after insert on public.post_reactions
  for each row execute function public.notify_like();

-- ---- comment on your post ----
create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  if new.post_id is not null then
    select author_id into author from public.posts where id = new.post_id;
    if author is not null and author <> new.author_id then
      insert into public.notifications (user_id, type, payload)
      values (author, 'comment',
        jsonb_build_object('actor', new.author_id, 'actor_name', public.display_name_of(new.author_id),
                           'snippet', left(coalesce(new.body, ''), 80)));
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_comment();

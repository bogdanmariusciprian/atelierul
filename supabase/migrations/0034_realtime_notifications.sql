-- =========================================================
-- Migration 0034 — Realtime + notificări bogate, conștiente de rol (Lot B).
--
-- 1) REALTIME: trimite messages + notifications către client instant (fără
--    refresh). RLS decide ce primește fiecare user (0004 select policies).
-- 2) Profesorul e ANUNȚAT de ce contează: mesajul unui elev / contactul unui
--    vizitator (notify_message sărea peste to_admin până acum).
-- 3) Notificările poartă `post_id` → clic-ul duce la POSTAREA exactă.
-- 4) Răspunsul la un COMENTARIU notifică autorul comentariului (nu doar al postării).
-- 5) Aprobarea/respingerea unui exercițiu notifică autorul (feedback de progres).
-- 6) Un user își poate ȘTERGE propriile notificări („șterge tot").
--
-- Depinde de 0003/0004/0014/0016/0018/0023. Sigur la re-rulare (idempotent).
-- =========================================================

-- ---- 1) Publicație realtime (idempotent) ----
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;

-- ---- 6) Un user își poate șterge propriile notificări ----
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete
  using (user_id = auth.uid());
grant delete on public.notifications to authenticated;

-- ---- 2) Mesaj → notifică destinatarul (membru) SAU profesorul/-ii (to_admin) ----
create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.to_admin then
    -- Elev → profesor, sau contact de la un vizitator: anunță fiecare profesor.
    insert into public.notifications (user_id, type, payload)
    select p.id, 'message',
           jsonb_build_object('actor', new.sender_id,
             'actor_name', coalesce(public.display_name_of(new.sender_id), new.guest_name, 'Vizitator'),
             'to_admin', true,
             'snippet', left(coalesce(new.body, ''), 80))
      from public.profiles p
     where p.role = 'admin';
  elsif new.recipient_id is not null then
    -- Membru → membru (sau profesor → membru).
    insert into public.notifications (user_id, type, payload)
    values (new.recipient_id, 'message',
      jsonb_build_object('actor', new.sender_id,
        'actor_name', public.display_name_of(new.sender_id)));
  end if;
  return new;
end; $$;

-- ---- 3) ♥ pe postarea ta — acum cu post_id ----
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
                           'post_id', new.post_id, 'snippet', left(coalesce(body, ''), 80)));
    end if;
  end if;
  return new;
end; $$;

-- ---- 3+4) Comentariu la postarea ta + RĂSPUNS la comentariul tău (cu post_id) ----
create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare post_author uuid; parent_author uuid;
begin
  -- Doar comentariile de FORUM (pe postări); cele de lecție au post_id null.
  if new.post_id is not null then
    select author_id into post_author from public.posts where id = new.post_id;

    -- Comentariu pe POSTARE → autorul postării.
    if post_author is not null and post_author <> new.author_id then
      insert into public.notifications (user_id, type, payload)
      values (post_author, 'comment',
        jsonb_build_object('actor', new.author_id, 'actor_name', public.display_name_of(new.author_id),
                           'post_id', new.post_id, 'snippet', left(coalesce(new.body, ''), 80)));
    end if;

    -- RĂSPUNS la un comentariu → autorul comentariului-părinte (dacă e altcineva
    -- decât cel care răspunde ȘI decât autorul postării, ca să nu dublăm).
    if new.parent_id is not null then
      select author_id into parent_author from public.comments where id = new.parent_id;
      if parent_author is not null
         and parent_author <> new.author_id
         and parent_author <> post_author then
        insert into public.notifications (user_id, type, payload)
        values (parent_author, 'reply',
          jsonb_build_object('actor', new.author_id, 'actor_name', public.display_name_of(new.author_id),
                             'post_id', new.post_id, 'snippet', left(coalesce(new.body, ''), 80)));
      end if;
    end if;
  end if;
  return new;
end; $$;

-- ---- 5) Aprobare/respingere exercițiu → notifică autorul (feedback de progres) ----
-- Redefinim RPC-urile din 0018 păstrând logica + adăugând notificarea.
create or replace function public.approve_exercise(
  p_id uuid, p_verified boolean default true, p_reward integer default 20
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  ex     public.exercises;
  reward integer := greatest(0, least(coalesce(p_reward, 20), 50));
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'admin only';
  end if;
  select * into ex from public.exercises where id = p_id;
  if not found then return jsonb_build_object('error', 'no-exercise'); end if;

  update public.exercises
     set status = 'approved', verified = p_verified, decided_by = uid, decided_at = now()
   where id = p_id;

  if ex.status <> 'approved'
     and not exists (select 1 from public.profiles where id = ex.author_id and role = 'admin') then
    insert into public.points_ledger (user_id, delta, reason)
      values (ex.author_id, reward, 'exercise:' || p_id);
    -- Notifică autorul: propunerea lui a intrat (+puncte).
    insert into public.notifications (user_id, type, payload)
      values (ex.author_id, 'award',
        jsonb_build_object('kind', 'exercise-approved', 'points', reward, 'lesson', ex.lesson_slug));
  end if;

  return jsonb_build_object('status', 'approved', 'awarded',
    case when ex.status <> 'approved' then reward else 0 end);
end; $$;

create or replace function public.reject_exercise(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ex public.exercises;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'admin only';
  end if;
  select * into ex from public.exercises where id = p_id;
  update public.exercises
     set status = 'rejected', decided_by = uid, decided_at = now()
   where id = p_id;
  -- Notifică autorul (ca să nu mai fie o respingere tăcută).
  if ex.author_id is not null
     and not exists (select 1 from public.profiles where id = ex.author_id and role = 'admin') then
    insert into public.notifications (user_id, type, payload)
      values (ex.author_id, 'award',
        jsonb_build_object('kind', 'exercise-rejected', 'lesson', ex.lesson_slug));
  end if;
  return jsonb_build_object('status', 'rejected');
end; $$;

grant execute on function public.approve_exercise(uuid, boolean, integer) to authenticated;
grant execute on function public.reject_exercise(uuid)                    to authenticated;

-- =========================================================
-- DUPĂ această migrare (pași client, în Lot B):
--   • notif.js / messenger.js — abonare realtime pe notifications + messages.
--   • site-chrome hrefFor → #post/<post_id>; titleFor pentru reply/award.
--   • forum-repo — deleteAllNotifications() + surrogateForPostUuid().
--   • community.js — rută #post/<uuid> → goToPost.
-- =========================================================

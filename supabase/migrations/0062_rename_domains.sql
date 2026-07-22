-- =========================================================
-- Migration 0062 — Marea redenumire: tabelele pe domenii (X_Y_Z).
--
-- Harta lui Marius: domeniul → entitatea → calificativul, de la mare la mic,
-- ca Studio să grupeze singur familiile: forum_* · learn_* · planner_* ·
-- social_* · tests_*. Miezul rămâne neatins: profiles, points_ledger,
-- presence_sessions, app_flags, app_settings.
--
-- CE SE MUTĂ SINGUR la rename (legat de identitate, nu de nume): politicile
-- RLS, trigger-ele, cheile străine, indexurile, apartenența la publicația
-- realtime. CE NU se mută singur: corpurile funcțiilor (text, rezolvat la
-- rulare) — re-create mai jos DIN DEFINIȚIILE VII extrase din bază (nu din
-- repo: deriva repo↔bază a fost dovedită), și numele constrângerilor FK —
-- redenumite ca embed-hint-urile clientului să rămână adevărate.
--
-- Clientul trece pe noile nume în ACELAȘI commit; aplică migrarea și push-ul
-- în aceeași ședință. Verificarea de după: interogarea de audit din chat.
-- Inversa completă stă în supabase/revert/0062_undo_rename.sql (de sertar).
-- =========================================================

-- 1. Tabelele moarte pleacă (toate trei goale — verificat: 0 rânduri).
drop table if exists public.event_rsvps;
drop table if exists public.events;
drop table if exists public.notebook_notes;

-- 2. Redenumirile.

alter table public.posts rename to forum_posts;
alter table public.post_reactions rename to forum_posts_reactions;
alter table public.saved_posts rename to forum_posts_saved;
alter table public.post_follows rename to forum_posts_follows;
alter table public.comments rename to forum_comments;
alter table public.comment_reactions rename to forum_comments_reactions;
alter table public.reports rename to forum_reports;
alter table public.profanity_terms rename to forum_profanity_terms;
alter table public.groups rename to forum_groups;
alter table public.group_members rename to forum_groups_members;
alter table public.friendships rename to social_friendships;
alter table public.messages rename to social_messages;
alter table public.conversation_labels rename to social_messages_labels;
alter table public.notifications rename to social_notifications;
alter table public.kudos rename to social_kudos;
alter table public.user_blocks rename to social_blocks;
alter table public.exercises rename to learn_exercises;
alter table public.exercise_votes rename to learn_exercises_votes;
alter table public.exercise_solves rename to learn_exercises_solves;
alter table public.lesson_progress rename to learn_lessons_progress;
alter table public.favorites rename to learn_lessons_favorites;
alter table public.notation_words rename to learn_notation_words;
alter table public.notes rename to learn_notes;
alter table public.challenges rename to learn_challenges;
alter table public.challenge_solves rename to learn_challenges_solves;
alter table public.test_items rename to tests_items;
alter table public.test_sessions rename to tests_sessions;
alter table public.test_downloads rename to tests_downloads;
alter table public.bonus_questions rename to tests_bonus_questions;
alter table public.game_boosters rename to tests_boosters;
alter table public.test_answer_rewards rename to tests_items_rewards;
alter table public.test_item_peeks rename to tests_items_peeks;
alter table public.tutoring_slots rename to planner_slots;
alter table public.event_access rename to planner_pupils;

-- 3. Constrângerile FK își urmează tabela și în NUME (embed-hint-urile).
alter table public.forum_posts rename constraint posts_author_id_fkey to forum_posts_author_id_fkey;
alter table public.forum_posts rename constraint posts_group_id_fkey to forum_posts_group_id_fkey;
alter table public.forum_posts rename constraint posts_share_of_fkey to forum_posts_share_of_fkey;
alter table public.forum_posts_reactions rename constraint post_reactions_post_id_fkey to forum_posts_reactions_post_id_fkey;
alter table public.forum_posts_reactions rename constraint post_reactions_user_id_fkey to forum_posts_reactions_user_id_fkey;
alter table public.forum_posts_saved rename constraint saved_posts_post_id_fkey to forum_posts_saved_post_id_fkey;
alter table public.forum_posts_saved rename constraint saved_posts_user_id_fkey to forum_posts_saved_user_id_fkey;
alter table public.forum_posts_follows rename constraint post_follows_post_id_fkey to forum_posts_follows_post_id_fkey;
alter table public.forum_posts_follows rename constraint post_follows_user_id_fkey to forum_posts_follows_user_id_fkey;
alter table public.forum_comments rename constraint comments_author_id_fkey to forum_comments_author_id_fkey;
alter table public.forum_comments rename constraint comments_parent_id_fkey to forum_comments_parent_id_fkey;
alter table public.forum_comments rename constraint comments_post_id_fkey to forum_comments_post_id_fkey;
alter table public.forum_comments_reactions rename constraint comment_reactions_comment_id_fkey to forum_comments_reactions_comment_id_fkey;
alter table public.forum_comments_reactions rename constraint comment_reactions_user_id_fkey to forum_comments_reactions_user_id_fkey;
alter table public.forum_reports rename constraint reports_reporter_id_fkey to forum_reports_reporter_id_fkey;
alter table public.forum_profanity_terms rename constraint profanity_terms_added_by_fkey to forum_profanity_terms_added_by_fkey;
alter table public.forum_groups rename constraint groups_creator_id_fkey to forum_groups_creator_id_fkey;
alter table public.forum_groups_members rename constraint group_members_added_by_fkey to forum_groups_members_added_by_fkey;
alter table public.forum_groups_members rename constraint group_members_group_id_fkey to forum_groups_members_group_id_fkey;
alter table public.forum_groups_members rename constraint group_members_user_id_fkey to forum_groups_members_user_id_fkey;
alter table public.social_friendships rename constraint friendships_addressee_id_fkey to social_friendships_addressee_id_fkey;
alter table public.social_friendships rename constraint friendships_requester_id_fkey to social_friendships_requester_id_fkey;
alter table public.social_messages rename constraint messages_recipient_id_fkey to social_messages_recipient_id_fkey;
alter table public.social_messages rename constraint messages_sender_id_fkey to social_messages_sender_id_fkey;
alter table public.social_messages_labels rename constraint conversation_labels_user_id_fkey to social_messages_labels_user_id_fkey;
alter table public.social_notifications rename constraint notifications_user_id_fkey to social_notifications_user_id_fkey;
alter table public.social_kudos rename constraint kudos_from_user_fkey to social_kudos_from_user_fkey;
alter table public.social_kudos rename constraint kudos_to_user_fkey to social_kudos_to_user_fkey;
alter table public.social_blocks rename constraint user_blocks_blocked_id_fkey to social_blocks_blocked_id_fkey;
alter table public.social_blocks rename constraint user_blocks_blocker_id_fkey to social_blocks_blocker_id_fkey;
alter table public.learn_exercises rename constraint exercises_author_id_fkey to learn_exercises_author_id_fkey;
alter table public.learn_exercises rename constraint exercises_decided_by_fkey to learn_exercises_decided_by_fkey;
alter table public.learn_exercises_votes rename constraint exercise_votes_exercise_id_fkey to learn_exercises_votes_exercise_id_fkey;
alter table public.learn_exercises_votes rename constraint exercise_votes_user_id_fkey to learn_exercises_votes_user_id_fkey;
alter table public.learn_exercises_solves rename constraint exercise_solves_exercise_id_fkey to learn_exercises_solves_exercise_id_fkey;
alter table public.learn_exercises_solves rename constraint exercise_solves_user_id_fkey to learn_exercises_solves_user_id_fkey;
alter table public.learn_lessons_progress rename constraint lesson_progress_user_id_fkey to learn_lessons_progress_user_id_fkey;
alter table public.learn_lessons_favorites rename constraint favorites_user_id_fkey to learn_lessons_favorites_user_id_fkey;
alter table public.learn_notation_words rename constraint notation_words_author_id_fkey to learn_notation_words_author_id_fkey;
alter table public.learn_notation_words rename constraint notation_words_decided_by_fkey to learn_notation_words_decided_by_fkey;
alter table public.learn_notes rename constraint notes_user_id_fkey to learn_notes_user_id_fkey;
alter table public.learn_challenges rename constraint challenges_created_by_fkey to learn_challenges_created_by_fkey;
alter table public.learn_challenges_solves rename constraint challenge_solves_challenge_id_fkey to learn_challenges_solves_challenge_id_fkey;
alter table public.learn_challenges_solves rename constraint challenge_solves_user_id_fkey to learn_challenges_solves_user_id_fkey;
alter table public.tests_sessions rename constraint test_sessions_user_id_fkey to tests_sessions_user_id_fkey;
alter table public.tests_boosters rename constraint game_boosters_user_id_fkey to tests_boosters_user_id_fkey;
alter table public.tests_items_rewards rename constraint test_answer_rewards_item_id_fkey to tests_items_rewards_item_id_fkey;
alter table public.tests_items_rewards rename constraint test_answer_rewards_user_id_fkey to tests_items_rewards_user_id_fkey;
alter table public.tests_items_peeks rename constraint test_item_peeks_item_id_fkey to tests_items_peeks_item_id_fkey;
alter table public.tests_items_peeks rename constraint test_item_peeks_user_id_fkey to tests_items_peeks_user_id_fkey;
alter table public.planner_slots rename constraint tutoring_slots_created_by_fkey to planner_slots_created_by_fkey;
alter table public.planner_slots rename constraint tutoring_slots_user_id_fkey to planner_slots_user_id_fkey;
alter table public.planner_pupils rename constraint event_access_granted_by_fkey to planner_pupils_granted_by_fkey;
alter table public.planner_pupils rename constraint event_access_user_id_fkey to planner_pupils_user_id_fkey;

-- 4. Secvențele deținute (dacă există) își schimbă prefixul — defensiv.
do $$
declare m record; r record;
begin
  for m in select * from (values
    ('posts','forum_posts'),
    ('post_reactions','forum_posts_reactions'),
    ('saved_posts','forum_posts_saved'),
    ('post_follows','forum_posts_follows'),
    ('comments','forum_comments'),
    ('comment_reactions','forum_comments_reactions'),
    ('reports','forum_reports'),
    ('profanity_terms','forum_profanity_terms'),
    ('groups','forum_groups'),
    ('group_members','forum_groups_members'),
    ('friendships','social_friendships'),
    ('messages','social_messages'),
    ('conversation_labels','social_messages_labels'),
    ('notifications','social_notifications'),
    ('kudos','social_kudos'),
    ('user_blocks','social_blocks'),
    ('exercises','learn_exercises'),
    ('exercise_votes','learn_exercises_votes'),
    ('exercise_solves','learn_exercises_solves'),
    ('lesson_progress','learn_lessons_progress'),
    ('favorites','learn_lessons_favorites'),
    ('notation_words','learn_notation_words'),
    ('notes','learn_notes'),
    ('challenges','learn_challenges'),
    ('challenge_solves','learn_challenges_solves'),
    ('test_items','tests_items'),
    ('test_sessions','tests_sessions'),
    ('test_downloads','tests_downloads'),
    ('bonus_questions','tests_bonus_questions'),
    ('game_boosters','tests_boosters'),
    ('test_answer_rewards','tests_items_rewards'),
    ('test_item_peeks','tests_items_peeks'),
    ('tutoring_slots','planner_slots'),
    ('event_access','planner_pupils')
  ) as v(old_name, new_name)
  loop
    for r in
      select s.relname as seq
      from pg_class t
      join pg_depend d on d.refobjid = t.oid and d.deptype = 'a'
      join pg_class s on s.oid = d.objid and s.relkind = 'S'
      join pg_namespace n on n.oid = s.relnamespace
      where t.relname = m.new_name and n.nspname = 'public'
        and s.relname like m.old_name || '\_%' escape '\'
    loop
      execute format('alter sequence public.%I rename to %I',
        r.seq, m.new_name || substr(r.seq, length(m.old_name) + 1));
    end loop;
  end loop;
end $$;

-- 5. Funcțiile — re-create din definițiile VII, cu numele noi.

-- admin_bonus_questions
CREATE OR REPLACE FUNCTION public.admin_bonus_questions()
 RETURNS SETOF tests_bonus_questions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin_user() then
    raise exception 'not allowed';
  end if;
  return query select * from public.tests_bonus_questions order by created_at desc;
end; $function$;

-- admin_dashboard_counts
CREATE OR REPLACE FUNCTION public.admin_dashboard_counts()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when not public.is_admin_user() then null else json_build_object(
    'members',        (select count(*) from profiles where role = 'member'),
    'members_new_7',  (select count(*) from profiles where role = 'member' and created_at > now() - interval '7 days'),
    'members_new_30', (select count(*) from profiles where role = 'member' and created_at > now() - interval '30 days'),
    'online_now',     (select count(*) from profiles where role = 'member' and last_seen_at > now() - interval '3 minutes'),
    'active_7',       (select count(*) from profiles where role = 'member' and last_seen_at > now() - interval '7 days'),
    'posts',          (select count(*) from forum_posts),
    'posts_7',        (select count(*) from forum_posts where created_at > now() - interval '7 days'),
    'comments',       (select count(*) from forum_comments),
    'comments_7',     (select count(*) from forum_comments where created_at > now() - interval '7 days'),
    'lessons_done',   (select count(*) from learn_lessons_progress),
    'points_total',   (select coalesce(sum(delta), 0) from points_ledger where delta > 0),
    'groups',         (select count(*) from forum_groups),
    'exercises',      (select count(*) from learn_exercises where status = 'approved'),
    'notif_total',    (select count(*) from social_notifications),
    'notif_unread',   (select count(*) from social_notifications where read_at is null),
    'msgs_total',     (select count(*) from social_messages),
    'msgs_to_admin',  (select count(*) from social_messages where to_admin),
    'msgs_unread_admin', (select count(*) from social_messages where to_admin and read_at is null),
    'session_minutes_avg', (
      select coalesce(round(avg(greatest(extract(epoch from (last_beat_at - started_at)) / 60, 1))::numeric, 1), 0)
        from presence_sessions),
    'sessions_total', (select count(*) from presence_sessions)
  ) end;
$function$;

-- admin_dashboard_members
CREATE OR REPLACE FUNCTION public.admin_dashboard_members()
 RETURNS TABLE(id uuid, name text, avatar text, color text, grade text, locality text, created_at timestamp with time zone, last_seen_at timestamp with time zone, points integer, posts integer, comments integer, lessons integer, active_days integer, sessions integer, minutes_total integer, minutes_avg numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.display_name, p.avatar, p.avatar_color, p.grade, p.locality,
         p.created_at, p.last_seen_at, p.points,
         (select count(*) from forum_posts x where x.author_id = p.id)::int,
         (select count(*) from forum_comments x where x.author_id = p.id)::int,
         (select count(*) from learn_lessons_progress x where x.user_id = p.id)::int,
         -- „Zile active" = zile distincte în care a lăsat vreo urmă, oricare.
         (select count(distinct d) from (
            select created_at::date d from forum_posts where author_id = p.id
            union select created_at::date from forum_comments where author_id = p.id
            union select completed_at::date from learn_lessons_progress where user_id = p.id
            union select started_at::date from presence_sessions where user_id = p.id
          ) z)::int,
         (select count(*) from presence_sessions s where s.user_id = p.id)::int,
         (select coalesce(sum(greatest(extract(epoch from (s.last_beat_at - s.started_at)) / 60, 1)), 0)
            from presence_sessions s where s.user_id = p.id)::int,
         (select coalesce(round(avg(greatest(extract(epoch from (s.last_beat_at - s.started_at)) / 60, 1))::numeric, 1), 0)
            from presence_sessions s where s.user_id = p.id)
    from profiles p
   where p.role = 'member' and public.is_admin_user()
   order by p.created_at desc;
$function$;

-- admin_dashboard_queues
CREATE OR REPLACE FUNCTION public.admin_dashboard_queues()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when not public.is_admin_user() then null else json_build_object(
    'reports_open',    (select count(*) from forum_reports where status = 'open'),
    'exercises_pending', (select count(*) from learn_exercises where status = 'pending'),
    'posts_held',      (select count(*) from forum_posts where moderation_status <> 'visible'),
    'comments_held',   (select count(*) from forum_comments where moderation_status <> 'visible'),
    'msgs_unread',     (select count(*) from social_messages where to_admin and read_at is null),
    'words_pending',   (select count(*) from learn_notation_words where status = 'pending')
  ) end;
$function$;

-- admin_dashboard_series
CREATE OR REPLACE FUNCTION public.admin_dashboard_series(p_days integer DEFAULT 30)
 RETURNS TABLE(day date, members integer, posts integer, comments integer, lessons integer, points integer, sessions integer, minutes integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with days as (
    select generate_series(
      (current_date - (greatest(least(p_days, 180), 1) - 1))::date,
      current_date, interval '1 day')::date as day
  )
  select d.day,
    (select count(*) from profiles p where p.role = 'member' and p.created_at::date = d.day)::int,
    (select count(*) from forum_posts x where x.created_at::date = d.day)::int,
    (select count(*) from forum_comments x where x.created_at::date = d.day)::int,
    (select count(*) from learn_lessons_progress x where x.completed_at::date = d.day)::int,
    (select coalesce(sum(x.delta), 0) from points_ledger x where x.delta > 0 and x.created_at::date = d.day)::int,
    (select count(*) from presence_sessions s where s.started_at::date = d.day)::int,
    (select coalesce(sum(greatest(extract(epoch from (s.last_beat_at - s.started_at)) / 60, 1)), 0)
       from presence_sessions s where s.started_at::date = d.day)::int
  from days d
  where public.is_admin_user()
  order by d.day;
$function$;

-- admin_test_item
CREATE OR REPLACE FUNCTION public.admin_test_item(p_id uuid)
 RETURNS SETOF tests_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin_user() then
    raise exception 'not allowed';
  end if;
  return query select * from public.tests_items where id = p_id;
end; $function$;

-- admin_test_items
CREATE OR REPLACE FUNCTION public.admin_test_items(p_exam text, p_year integer DEFAULT NULL::integer)
 RETURNS SETOF tests_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;
  return query
    select * from public.tests_items
    where exam = p_exam and (p_year is null or year = p_year)
    order by year, session, item_no;
end;
$function$;

-- answer_bonus_question
CREATE OR REPLACE FUNCTION public.answer_bonus_question(p_id uuid, p_text text, p_session uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  q     public.tests_bonus_questions;
  uid   uuid := auth.uid();
  ok    boolean;
  roll  integer;
  gift  text;
begin
  if uid is null or p_session is null then
    return jsonb_build_object('error', 'not-signed-in');
  end if;
  select * into q from public.tests_bonus_questions where id = p_id and active;
  if not found then
    return jsonb_build_object('error', 'not-available');
  end if;

  ok := exists (
    select 1 from unnest(q.answers) a
     where public.norm_answer(a) = public.norm_answer(p_text)
       and public.norm_answer(a) <> ''
  );

  if not ok then
    -- E o întrebare uşoară, de bonus: arătăm răspunsul, se învaţă ceva.
    return jsonb_build_object('correct', false, 'answer', coalesce(q.answers[1], ''));
  end if;

  -- Raritatea o decide SERVERUL: viața e cea mai rară.
  roll := floor(random() * 100)::int;
  gift := case
            when roll < 45 then 'cut1'
            when roll < 70 then 'cut2'
            when roll < 90 then 'peek'
            else 'life'
          end;

  insert into public.tests_boosters (session_id, user_id, kind, qty)
       values (p_session, uid, gift, 1)
  on conflict (session_id, user_id, kind)
    do update set qty = public.tests_boosters.qty + 1;

  return jsonb_build_object('correct', true, 'booster', gift);
end; $function$;

-- answer_test_item
CREATE OR REPLACE FUNCTION public.answer_test_item(p_id uuid, p_answer text, p_session uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  it         public.tests_items;
  eff        text;
  is_correct boolean;
  uid        uuid := auth.uid();
  awarded    boolean := false;
  pts        integer := 5;
begin
  select * into it from public.tests_items where id = p_id and published = true;
  if not found then
    return jsonb_build_object('error', 'not-available');
  end if;

  eff := coalesce(it.correct_2026, it.correct);
  is_correct := upper(coalesce(p_answer, '')) = eff;

  if is_correct
     and uid is not null
     and p_session is not null
     and not exists (select 1 from public.profiles where id = uid and role = 'admin')
  then
    begin
      insert into public.tests_items_rewards (user_id, item_id, session_id)
        values (uid, p_id, p_session);
      insert into public.points_ledger (user_id, delta, reason)
        values (uid, pts, 'test:' || it.exam);
      awarded := true;
    exception when unique_violation then
      awarded := false;
    end;
  end if;

  return jsonb_build_object(
    'correct',        is_correct,
    'correct_answer', eff,
    'historical',     case when it.correct is distinct from eff then it.correct else null end,
    'observation',    coalesce(it.observation, ''),
    'awarded',        awarded,
    'points',         case when awarded then pts else 0 end
  );
end;
$function$;

-- approve_exercise
CREATE OR REPLACE FUNCTION public.approve_exercise(p_id uuid, p_verified boolean DEFAULT true, p_reward integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid    uuid := auth.uid();
  ex     public.learn_exercises;
  reward integer := greatest(0, least(coalesce(p_reward, 20), 50));
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'admin only';
  end if;
  select * into ex from public.learn_exercises where id = p_id;
  if not found then return jsonb_build_object('error', 'no-exercise'); end if;

  update public.learn_exercises
     set status = 'approved', verified = p_verified, decided_by = uid, decided_at = now()
   where id = p_id;

  if ex.status <> 'approved'
     and not exists (select 1 from public.profiles where id = ex.author_id and role = 'admin') then
    insert into public.points_ledger (user_id, delta, reason)
      values (ex.author_id, reward, 'exercise:' || p_id);
    -- Notifică autorul: propunerea lui a intrat (+puncte).
    insert into public.social_notifications (user_id, type, payload)
      values (ex.author_id, 'award',
        jsonb_build_object('kind', 'exercise-approved', 'points', reward, 'lesson', ex.lesson_slug));
  end if;

  return jsonb_build_object('status', 'approved', 'awarded',
    case when ex.status <> 'approved' then reward else 0 end);
end; $function$;

-- are_friends
CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.social_friendships f
    where f.status = 'accepted'
      and ( (f.requester_id = a and f.addressee_id = b)
         or (f.requester_id = b and f.addressee_id = a) )
  );
$function$;

-- can_see_post
CREATE OR REPLACE FUNCTION public.can_see_post(p_post uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.forum_posts p
    where p.id = p_post
      and ( public.is_admin_user()
         or p.author_id = auth.uid()
         or (p.moderation_status = 'visible'
             and ( p.audience = 'public'
                or (p.audience = 'members' and auth.uid() is not null)
                or (p.audience = 'friends' and public.are_friends(p.author_id, auth.uid())) )) )
  );
$function$;

-- check_test_item
CREATE OR REPLACE FUNCTION public.check_test_item(p_id uuid, p_answer text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  it  public.tests_items;
  eff text;
begin
  select * into it from public.tests_items where id = p_id and published = true;
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
$function$;

-- complete_lesson
CREATE OR REPLACE FUNCTION public.complete_lesson(p_slug text, p_points integer DEFAULT 70)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if exists (select 1 from public.profiles where id = uid and role = 'admin') then
    return;
  end if;
  if exists (select 1 from public.learn_lessons_progress where user_id = uid and lesson_slug = p_slug) then
    return;
  end if;
  insert into public.learn_lessons_progress (user_id, lesson_slug) values (uid, p_slug);
  insert into public.points_ledger (user_id, delta, reason)
    values (uid, greatest(0, least(p_points, 200)), 'lesson:' || p_slug);
end; $function$;

-- contact_teacher
CREATE OR REPLACE FUNCTION public.contact_teacher(p_name text, p_email text, p_body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'empty message';
  end if;
  insert into public.social_messages (sender_id, recipient_id, to_admin, body, guest_name, guest_email)
  values (
    null, null, true,
    left(trim(p_body), 900),
    nullif(trim(p_name), ''),
    nullif(trim(p_email), '')
  );
end;
$function$;

-- exercises_visible
CREATE OR REPLACE FUNCTION public.exercises_visible(p_lesson text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, lesson_slug text, author_id uuid, author jsonb, kind text, prompt text, data jsonb, status text, verified boolean, decided_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  from public.learn_exercises e
  join public.profiles p on p.id = e.author_id
  where (p_lesson is null or e.lesson_slug = p_lesson)
    and (
      e.status = 'approved'                 -- everyone
      or e.status = 'pending'               -- everyone (so they can vote)
      or e.author_id = auth.uid()           -- your own rejected ones
      or public.is_admin_user()             -- the teacher sees all
    );
$function$;

-- get_challenge_answer
CREATE OR REPLACE FUNCTION public.get_challenge_answer(p_challenge uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  ans text;
begin
  if uid is null then
    return null;
  end if;
  -- The teacher always may; a pupil only AFTER they answered.
  if not (
    exists (select 1 from public.profiles where id = uid and role = 'admin')
    or exists (select 1 from public.learn_challenges_solves
               where challenge_id = p_challenge and user_id = uid)
  ) then
    return null; -- no peeking before you answer
  end if;

  select correct into ans from public.learn_challenges where id = p_challenge;
  return nullif(ans, '')::integer;
end;
$function$;

-- give_kudos
CREATE OR REPLACE FUNCTION public.give_kudos(p_to uuid, p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    select 1 from public.social_kudos
    where from_user = uid and to_user = p_to and kind = p_kind
      and created_at >= date_trunc('day', now())
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;

  insert into public.social_kudos (from_user, to_user, kind) values (uid, p_to, p_kind);
  return jsonb_build_object('ok', true);
end;
$function$;

-- has_planner_access
CREATE OR REPLACE FUNCTION public.has_planner_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_admin_user()
      or exists (select 1 from public.planner_pupils where user_id = auth.uid());
$function$;

-- is_profane
CREATE OR REPLACE FUNCTION public.is_profane(txt text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with n as (
    select ' ' || regexp_replace(
      lower(translate(coalesce(txt, ''), 'ăâîșşțţ', 'aaisstt')),
      '[^a-z]+', ' ', 'g') || ' ' as s
  )
  select
    (select s from n) ~
      '( )(pula|pule|puli|pizd|muie|muist|fute|futu|futa|futi|coaie|cacat|cacan|curva|curve|curvo|tarfa|labagi|bulangi|poponar|gaoz|handicapat|retardat|dobitoc|tampit|fuck|shit|bitch|cunt|asshole|whore|slut|nigg|faggot)'
    or exists (
      select 1 from public.forum_profanity_terms t, n
      where position(' ' || lower(translate(t.term, 'ăâîșşțţ', 'aaisstt')) in n.s) > 0
    );
$function$;

-- list_challenges_admin
CREATE OR REPLACE FUNCTION public.list_challenges_admin()
 RETURNS SETOF learn_challenges
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null
     or not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  return query select * from public.learn_challenges order by active_date asc nulls last;
end;
$function$;

-- mark_comment_correct
CREATE OR REPLACE FUNCTION public.mark_comment_correct(p_comment uuid, p_on boolean, p_reward integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid    uuid := auth.uid();
  c      public.forum_comments;
  reward integer := greatest(0, least(coalesce(p_reward, 25), 100)); -- clamp
  delta  integer := 0;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'admin only';
  end if;

  select * into c from public.forum_comments where id = p_comment;
  if not found then
    return jsonb_build_object('error', 'no-comment');
  end if;

  -- Already in the requested state → nothing to do (never double-award).
  if c.correct = p_on then
    return jsonb_build_object('correct', c.correct, 'awarded', 0);
  end if;

  update public.forum_comments set correct = p_on where id = p_comment;

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
$function$;

-- notify_comment
CREATE OR REPLACE FUNCTION public.notify_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare post_author uuid; parent_author uuid;
begin
  -- Doar comentariile de FORUM (pe postări); cele de lecție au post_id null.
  if new.post_id is not null then
    select author_id into post_author from public.forum_posts where id = new.post_id;

    -- Comentariu pe POSTARE → autorul postării.
    if post_author is not null and post_author <> new.author_id then
      insert into public.social_notifications (user_id, type, payload)
      values (post_author, 'comment',
        jsonb_build_object('actor', new.author_id, 'actor_name', public.display_name_of(new.author_id),
                           'post_id', new.post_id, 'snippet', left(coalesce(new.body, ''), 80)));
    end if;

    -- RĂSPUNS la un comentariu → autorul comentariului-părinte (dacă e altcineva
    -- decât cel care răspunde ȘI decât autorul postării, ca să nu dublăm).
    if new.parent_id is not null then
      select author_id into parent_author from public.forum_comments where id = new.parent_id;
      if parent_author is not null
         and parent_author <> new.author_id
         and parent_author <> post_author then
        insert into public.social_notifications (user_id, type, payload)
        values (parent_author, 'reply',
          jsonb_build_object('actor', new.author_id, 'actor_name', public.display_name_of(new.author_id),
                             'post_id', new.post_id, 'snippet', left(coalesce(new.body, ''), 80)));
      end if;
    end if;
  end if;
  return new;
end; $function$;

-- notify_friend_accept
CREATE OR REPLACE FUNCTION public.notify_friend_accept()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.social_notifications (user_id, type, payload)
    values (new.requester_id, 'friend',
      jsonb_build_object('kind', 'accepted', 'actor', new.addressee_id,
                         'actor_name', public.display_name_of(new.addressee_id)));
  end if;
  return new;
end; $function$;

-- notify_friend_request
CREATE OR REPLACE FUNCTION public.notify_friend_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'pending' then
    insert into public.social_notifications (user_id, type, payload)
    values (new.addressee_id, 'friend',
      jsonb_build_object('kind', 'request', 'actor', new.requester_id,
                         'actor_name', public.display_name_of(new.requester_id)));
  end if;
  return new;
end; $function$;

-- notify_like
CREATE OR REPLACE FUNCTION public.notify_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare author uuid; body text;
begin
  if new.emoji = '♥' then
    select author_id, forum_posts.body into author, body from public.forum_posts where id = new.post_id;
    if author is not null and author <> new.user_id then
      insert into public.social_notifications (user_id, type, payload)
      values (author, 'like',
        jsonb_build_object('actor', new.user_id, 'actor_name', public.display_name_of(new.user_id),
                           'post_id', new.post_id, 'snippet', left(coalesce(body, ''), 80)));
    end if;
  end if;
  return new;
end; $function$;

-- notify_mention
CREATE OR REPLACE FUNCTION public.notify_mention(p_user uuid, p_snippet text, p_context text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  insert into public.social_notifications (user_id, type, payload)
  values (p_user, 'mention',
    jsonb_build_object(
      'actor', uid,
      'actor_name', public.display_name_of(uid),
      'snippet', left(coalesce(p_snippet, ''), 120),
      'context', left(coalesce(p_context, ''), 80)
    ));

  return jsonb_build_object('ok', true);
end;
$function$;

-- notify_message
CREATE OR REPLACE FUNCTION public.notify_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.to_admin then
    -- Elev → profesor, sau contact de la un vizitator: anunță fiecare profesor.
    insert into public.social_notifications (user_id, type, payload)
    select p.id, 'message',
           jsonb_build_object('actor', new.sender_id,
             'actor_name', coalesce(public.display_name_of(new.sender_id), new.guest_name, 'Vizitator'),
             'to_admin', true,
             'snippet', left(coalesce(new.body, ''), 80))
      from public.profiles p
     where p.role = 'admin';
  elsif new.recipient_id is not null then
    -- Membru → membru (sau profesor → membru).
    insert into public.social_notifications (user_id, type, payload)
    values (new.recipient_id, 'message',
      jsonb_build_object('actor', new.sender_id,
        'actor_name', public.display_name_of(new.sender_id)));
  end if;
  return new;
end; $function$;

-- reject_exercise
CREATE OR REPLACE FUNCTION public.reject_exercise(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); ex public.learn_exercises;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'admin only';
  end if;
  select * into ex from public.learn_exercises where id = p_id;
  update public.learn_exercises
     set status = 'rejected', decided_by = uid, decided_at = now()
   where id = p_id;
  -- Notifică autorul (ca să nu mai fie o respingere tăcută).
  if ex.author_id is not null
     and not exists (select 1 from public.profiles where id = ex.author_id and role = 'admin') then
    insert into public.social_notifications (user_id, type, payload)
      values (ex.author_id, 'award',
        jsonb_build_object('kind', 'exercise-rejected', 'lesson', ex.lesson_slug));
  end if;
  return jsonb_build_object('status', 'rejected');
end; $function$;

-- report_test_item
CREATE OR REPLACE FUNCTION public.report_test_item(p_item uuid, p_reason text, p_chosen text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare txt text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_item is null then
    raise exception 'missing item';
  end if;
  if txt is null then
    raise exception 'explicatia e obligatorie';
  end if;
  if not exists (select 1 from public.tests_items where id = p_item) then
    raise exception 'item inexistent';
  end if;
  insert into public.forum_reports (reporter_id, target_type, target_id, reason, meta)
  values (
    auth.uid(), -- NULL pentru vizitatori
    'test_item',
    p_item,
    left(txt, 500),
    jsonb_build_object('chosen', nullif(btrim(coalesce(p_chosen, '')), ''))
  );
end; $function$;

-- resolve_test_report
CREATE OR REPLACE FUNCTION public.resolve_test_report(p_report uuid, p_founded boolean, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.forum_reports%rowtype;
        note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin_user() then
    raise exception 'not allowed';
  end if;
  -- Doar o semnalare DESCHISĂ se poate închide → fără puncte duble la re-apel.
  select * into r from public.forum_reports where id = p_report and status = 'open' for update;
  if not found then
    return;
  end if;

  update public.forum_reports set status = 'resolved' where id = r.id;

  -- Nelogatul n-are unde primi răspuns; ne oprim aici.
  if r.reporter_id is null then
    return;
  end if;

  if p_founded then
    -- Mulțumim, îl ducem la item și îl recompensăm (profesorul nu e în joc,
    -- dar aici destinatarul e mereu un elev).
    insert into public.social_notifications (user_id, type, payload)
    values (r.reporter_id, 'report_ok',
            jsonb_build_object('item_id', r.target_id, 'note', note));
    if not exists (select 1 from public.profiles where id = r.reporter_id and role = 'admin') then
      insert into public.points_ledger (user_id, delta, reason)
      values (r.reporter_id, 10, 'report:' || r.id);
    end if;
  else
    -- Semnalare respinsă: explicația profesorului ajunge în mesagerie.
    insert into public.social_messages (sender_id, recipient_id, to_admin, body)
    values (auth.uid(), r.reporter_id, false,
            coalesce(note, 'Am verificat itemul semnalat și mi se pare corect așa cum e.'));
  end if;
end; $function$;

-- reveal_observation
CREATE OR REPLACE FUNCTION public.reveal_observation(p_item uuid, p_session uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare it public.tests_items;
begin
  select * into it from public.tests_items where id = p_item and published;
  if not found then
    return jsonb_build_object('error', 'not-available');
  end if;

  if auth.uid() is not null and p_session is not null then
    insert into public.tests_items_peeks (session_id, user_id, item_id)
         values (p_session, auth.uid(), p_item)
    on conflict do nothing;
  end if;

  -- DOAR explicația. Cheia rămâne exclusiv în answer_test_item.
  return jsonb_build_object('observation', coalesce(it.observation, ''));
end; $function$;

-- send_free_message
CREATE OR REPLACE FUNCTION public.send_free_message(p_recipient uuid, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    from public.social_messages
    where sender_id = uid and recipient_id = p_recipient
      and to_admin = false and template_key is null;

  if used >= allowance then
    return jsonb_build_object('error', 'quota', 'allowance', allowance, 'used', used, 'remaining', 0);
  end if;

  insert into public.social_messages (sender_id, recipient_id, to_admin, body, template_key)
    values (uid, p_recipient, false, clean, null);

  return jsonb_build_object('ok', true, 'allowance', allowance,
                            'used', used + 1, 'remaining', allowance - used - 1);
end;
$function$;

-- set_group_pin
CREATE OR REPLACE FUNCTION public.set_group_pin(p_post uuid, p_pinned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare gid uuid;
begin
  select group_id into gid from public.forum_posts where id = p_post;
  if gid is null then
    raise exception 'not a group post';
  end if;
  if not (
    public.is_admin_user()
    or exists (select 1 from public.forum_groups g where g.id = gid and g.creator_id = auth.uid())
  ) then
    raise exception 'not allowed';
  end if;
  update public.forum_posts set pinned = coalesce(p_pinned, false) where id = p_post;
end;
$function$;

-- solve_challenge
CREATE OR REPLACE FUNCTION public.solve_challenge(p_challenge uuid, p_choice integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid        uuid := auth.uid();
  ch         public.learn_challenges;
  existing   public.learn_challenges_solves;
  is_correct boolean;
  reward_pts integer;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  if exists (select 1 from public.profiles where id = uid and role = 'admin') then
    return jsonb_build_object('correct', false, 'awarded', 0, 'admin', true);
  end if;

  select * into ch from public.learn_challenges where id = p_challenge;
  if not found then
    return jsonb_build_object('error', 'no-challenge');
  end if;

  select * into existing
    from public.learn_challenges_solves
    where challenge_id = p_challenge and user_id = uid;
  if found then
    return jsonb_build_object('correct', existing.correct, 'awarded', 0,
                              'choice', existing.choice, 'already', true,
                              'answer', nullif(ch.correct, '')::integer);
  end if;

  is_correct := (ch.correct = p_choice::text);
  reward_pts := greatest(0, least(coalesce(ch.reward, 15), 50));

  insert into public.learn_challenges_solves (challenge_id, user_id, choice, correct)
    values (p_challenge, uid, p_choice, is_correct);

  if is_correct then
    insert into public.points_ledger (user_id, delta, reason)
      values (uid, reward_pts, 'challenge:' || p_challenge);
  end if;

  return jsonb_build_object(
    'correct', is_correct,
    'awarded', case when is_correct then reward_pts else 0 end,
    'choice',  p_choice,
    'already', false,
    'answer',  nullif(ch.correct, '')::integer
  );
end;
$function$;

-- solve_exercise
CREATE OR REPLACE FUNCTION public.solve_exercise(p_id uuid, p_answer jsonb, p_reward integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid        uuid := auth.uid();
  ex         public.learn_exercises;
  existing   public.learn_exercises_solves;
  is_correct boolean := false;
  reward     integer := greatest(0, least(coalesce(p_reward, 5), 20)); -- clamp
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  -- The teacher isn't in the game — record nothing, award nothing.
  if exists (select 1 from public.profiles where id = uid and role = 'admin') then
    return jsonb_build_object('correct', false, 'awarded', 0, 'admin', true);
  end if;

  select * into ex from public.learn_exercises where id = p_id;
  if not found or ex.status <> 'approved' then
    return jsonb_build_object('error', 'not-approved');
  end if;

  -- One attempt per pupil per exercise (idempotent).
  select * into existing from public.learn_exercises_solves
    where exercise_id = p_id and user_id = uid;
  if found then
    return jsonb_build_object('correct', existing.correct, 'awarded', 0, 'already', true);
  end if;

  -- Server-side correctness by kind (never trust the browser).
  if ex.kind = 'choice' then
    is_correct := (p_answer->>'choice') is not null
              and (p_answer->>'choice') = (ex.data->>'correct');
  elsif ex.kind = 'fill' then
    -- Accepted answers are stored pipe-separated ("să vină|vină"); any match wins.
    is_correct := exists (
      select 1 from unnest(string_to_array(coalesce(ex.data->>'answer', ''), '|')) a
      where btrim(a) <> ''
        and lower(btrim(a)) = lower(btrim(coalesce(p_answer->>'text', '')))
    );
  elsif ex.kind = 'match' then
    is_correct := (p_answer->'pairs') is not null
              and (p_answer->'pairs') = (ex.data->'pairs');
  end if;

  insert into public.learn_exercises_solves (exercise_id, user_id, correct)
    values (p_id, uid, is_correct);

  if is_correct then
    insert into public.points_ledger (user_id, delta, reason)
      values (uid, reward, 'exercise-solved:' || p_id);
  end if;

  return jsonb_build_object(
    'correct', is_correct,
    'awarded', case when is_correct then reward else 0 end,
    'already', false
  );
end;
$function$;

-- test_item_years
CREATE OR REPLACE FUNCTION public.test_item_years(p_exam text)
 RETURNS TABLE(year integer, n bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select year, count(*)::bigint as n
  from public.tests_items
  where exam = p_exam
    and (published or public.is_admin_user())
  group by year
  order by year;
$function$;

-- use_booster
CREATE OR REPLACE FUNCTION public.use_booster(p_session uuid, p_kind text, p_item uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid  uuid := auth.uid();
  it   public.tests_items;
  eff  text;
  cut  text[];
  left_qty integer;
begin
  if uid is null then
    return jsonb_build_object('error', 'not-signed-in');
  end if;

  update public.tests_boosters
     set qty = qty - 1
   where session_id = p_session and user_id = uid and kind = p_kind and qty > 0
   returning qty into left_qty;
  if not found then
    return jsonb_build_object('error', 'empty');
  end if;

  if p_kind = 'life' then
    return jsonb_build_object('ok', true, 'left', left_qty);
  end if;

  select * into it from public.tests_items where id = p_item and published;
  if not found then
    return jsonb_build_object('ok', true, 'left', left_qty);
  end if;

  if p_kind = 'peek' then
    return jsonb_build_object('ok', true, 'left', left_qty,
                              'observation', coalesce(it.observation, ''));
  end if;

  eff := coalesce(it.correct_2026, it.correct);
  select array_agg(l order by random())
    into cut
    from unnest(array['A', 'B', 'C', 'D']) l
   where l <> eff
     and case l when 'A' then it.option_a when 'B' then it.option_b
                when 'C' then it.option_c else it.option_d end is not null;

  return jsonb_build_object(
    'ok', true, 'left', left_qty,
    'cut', to_jsonb(cut[1 : case when p_kind = 'cut2' then 2 else 1 end])
  );
end; $function$;

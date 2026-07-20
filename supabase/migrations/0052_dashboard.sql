-- =========================================================
-- Migration 0052 — Dashboardul profesorului: sesiuni de prezență + agregate.
--
-- DOUĂ LUCRURI, într-o singură migrare fiindcă al doilea n-are sens fără primul.
--
-- 1. SESIUNI DE PREZENȚĂ. `profiles.last_seen_at` e un singur câmp suprascris
--    la fiecare puls, deci spune CÂND a fost cineva ultima oară, niciodată CÂT
--    a stat. Aici pulsul construiește sesiuni: dacă a bătut acum mai puțin de
--    5 minute, aceeași sesiune se prelungește; dacă nu, începe alta. Durata e
--    diferența dintre primul și ultimul puls.
--
--    Datele sunt despre minori, deci: se șterg singure după 90 de zile, nimeni
--    nu le poate citi în afară de propriul cont și de profesor, iar în
--    interfață apar doar ca medii și totaluri.
--
-- 2. AGREGATE PENTRU DASHBOARD. Politicile spun „fiecare își vede doar
--    rândurile lui" pentru points_ledger, lesson_progress și notifications —
--    corect, dar înseamnă că nici profesorul nu poate agrega din browser.
--    Funcțiile de mai jos rulează cu drepturi de sistem și întorc NUMAI cifre.
--    Niciuna nu scoate afară un mesaj între doi membri sau o notificare
--    individuală: se numără, nu se citesc.
--
-- Depinde de 0001 (is_admin_user), 0002, 0004, 0007. Sigur la re-rulare.
-- =========================================================

-- ---------- 1. Sesiuni ----------
create table if not exists public.presence_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  started_at   timestamptz not null default now(),
  last_beat_at timestamptz not null default now(),
  beats        integer not null default 1
);

create index if not exists presence_sessions_user_idx
  on public.presence_sessions (user_id, last_beat_at desc);

alter table public.presence_sessions enable row level security;

-- Citește-ți propriile sesiuni; profesorul le vede pe toate. Scrierea se face
-- DOAR prin funcția de mai jos — un client nu-și poate inventa ore petrecute.
drop policy if exists presence_sessions_read on public.presence_sessions;
create policy presence_sessions_read on public.presence_sessions for select
  using (user_id = auth.uid() or public.is_admin_user());

grant select on public.presence_sessions to authenticated;

-- Pulsul. Prelungește sesiunea curentă sau deschide una nouă, și actualizează
-- last_seen_at ca până acum (bulina verde depinde de el).
create or replace function public.touch_presence()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur public.presence_sessions%rowtype;
begin
  if uid is null then return; end if;

  update public.profiles set last_seen_at = now() where id = uid;

  select * into cur
    from public.presence_sessions
   where user_id = uid
   order by last_beat_at desc
   limit 1;

  -- „Aceeași ședință" înseamnă un puls la mai puțin de 5 minute după ultimul.
  -- Pulsul bate din minut în minut, deci pragul lasă loc unei file lăsate în
  -- fundal sau unei conexiuni care se bâlbâie, fără să lipească două vizite
  -- despărțite de o oră.
  if cur.id is not null and now() - cur.last_beat_at < interval '5 minutes' then
    update public.presence_sessions
       set last_beat_at = now(), beats = beats + 1
     where id = cur.id;
  else
    insert into public.presence_sessions (user_id) values (uid);
    -- Curățenia se face aici, la deschiderea unei sesiuni noi: e rar, e mărginit
    -- la un singur utilizator, și scapă de nevoia unui job programat.
    delete from public.presence_sessions
     where user_id = uid and last_beat_at < now() - interval '90 days';
  end if;
end;
$$;

revoke all on function public.touch_presence() from public;
grant execute on function public.touch_presence() to authenticated;

-- ---------- 2. Agregate pentru dashboard ----------

-- Cifrele mari din capul paginii.
create or replace function public.admin_dashboard_counts()
returns json
language sql
security definer
set search_path = public
as $$
  select case when not public.is_admin_user() then null else json_build_object(
    'members',        (select count(*) from profiles where role = 'member'),
    'members_new_7',  (select count(*) from profiles where role = 'member' and created_at > now() - interval '7 days'),
    'members_new_30', (select count(*) from profiles where role = 'member' and created_at > now() - interval '30 days'),
    'online_now',     (select count(*) from profiles where role = 'member' and last_seen_at > now() - interval '3 minutes'),
    'active_7',       (select count(*) from profiles where role = 'member' and last_seen_at > now() - interval '7 days'),
    'posts',          (select count(*) from posts),
    'posts_7',        (select count(*) from posts where created_at > now() - interval '7 days'),
    'comments',       (select count(*) from comments),
    'comments_7',     (select count(*) from comments where created_at > now() - interval '7 days'),
    'lessons_done',   (select count(*) from lesson_progress),
    'points_total',   (select coalesce(sum(delta), 0) from points_ledger where delta > 0),
    'groups',         (select count(*) from groups),
    'exercises',      (select count(*) from exercises where status = 'approved'),
    'notif_total',    (select count(*) from notifications),
    'notif_unread',   (select count(*) from notifications where read_at is null),
    'msgs_total',     (select count(*) from messages),
    'msgs_to_admin',  (select count(*) from messages where to_admin),
    'msgs_unread_admin', (select count(*) from messages where to_admin and read_at is null),
    'session_minutes_avg', (
      select coalesce(round(avg(greatest(extract(epoch from (last_beat_at - started_at)) / 60, 1))::numeric, 1), 0)
        from presence_sessions),
    'sessions_total', (select count(*) from presence_sessions)
  ) end;
$$;

-- Cozile care cer o decizie de la profesor.
create or replace function public.admin_dashboard_queues()
returns json
language sql
security definer
set search_path = public
as $$
  select case when not public.is_admin_user() then null else json_build_object(
    'reports_open',    (select count(*) from reports where status = 'open'),
    'exercises_pending', (select count(*) from exercises where status = 'pending'),
    'posts_held',      (select count(*) from posts where moderation_status <> 'visible'),
    'comments_held',   (select count(*) from comments where moderation_status <> 'visible'),
    'msgs_unread',     (select count(*) from messages where to_admin and read_at is null),
    'words_pending',   (select count(*) from notation_words where status = 'pending')
  ) end;
$$;

-- Un rând pe zi, ultimele p_days. Ce a crescut, ce s-a mișcat.
create or replace function public.admin_dashboard_series(p_days integer default 30)
returns table (
  day date, members integer, posts integer, comments integer,
  lessons integer, points integer, sessions integer, minutes integer
)
language sql
security definer
set search_path = public
as $$
  with days as (
    select generate_series(
      (current_date - (greatest(least(p_days, 180), 1) - 1))::date,
      current_date, interval '1 day')::date as day
  )
  select d.day,
    (select count(*) from profiles p where p.role = 'member' and p.created_at::date = d.day)::int,
    (select count(*) from posts x where x.created_at::date = d.day)::int,
    (select count(*) from comments x where x.created_at::date = d.day)::int,
    (select count(*) from lesson_progress x where x.completed_at::date = d.day)::int,
    (select coalesce(sum(x.delta), 0) from points_ledger x where x.delta > 0 and x.created_at::date = d.day)::int,
    (select count(*) from presence_sessions s where s.started_at::date = d.day)::int,
    (select coalesce(sum(greatest(extract(epoch from (s.last_beat_at - s.started_at)) / 60, 1)), 0)
       from presence_sessions s where s.started_at::date = d.day)::int
  from days d
  where public.is_admin_user()
  order by d.day;
$$;

-- Un rând pe membru. Numai date pe care profesorul le vede oricum în comunitate,
-- plus măsurile de activitate — nimic din conținutul privat.
create or replace function public.admin_dashboard_members()
returns table (
  id uuid, name text, avatar text, color text, grade text, locality text,
  created_at timestamptz, last_seen_at timestamptz, points integer,
  posts integer, comments integer, lessons integer,
  active_days integer, sessions integer, minutes_total integer, minutes_avg numeric
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar, p.avatar_color, p.grade, p.locality,
         p.created_at, p.last_seen_at, p.points,
         (select count(*) from posts x where x.author_id = p.id)::int,
         (select count(*) from comments x where x.author_id = p.id)::int,
         (select count(*) from lesson_progress x where x.user_id = p.id)::int,
         -- „Zile active" = zile distincte în care a lăsat vreo urmă, oricare.
         (select count(distinct d) from (
            select created_at::date d from posts where author_id = p.id
            union select created_at::date from comments where author_id = p.id
            union select completed_at::date from lesson_progress where user_id = p.id
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
$$;

revoke all on function public.admin_dashboard_counts() from public;
revoke all on function public.admin_dashboard_queues() from public;
revoke all on function public.admin_dashboard_series(integer) from public;
revoke all on function public.admin_dashboard_members() from public;
grant execute on function public.admin_dashboard_counts() to authenticated;
grant execute on function public.admin_dashboard_queues() to authenticated;
grant execute on function public.admin_dashboard_series(integer) to authenticated;
grant execute on function public.admin_dashboard_members() to authenticated;

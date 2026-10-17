-- =========================================================
-- 0109 · TABLA DE REDACTARE: profesorul trimite lucrarea în contul elevului
--
-- Cererea lui Marius (17 octombrie 2026): „ce am lucrat live cu un elev să i
-- se ducă automat în contul elevului, ca eu, adminul, să pot începe un nou
-- lucru live". Până acum lucrarea se salva din pagina elevului (0074 îl lasă
-- să-și scrie singur lucrările), deci se pierdea dacă elevul închidea tabla,
-- dacă golirea venea prea repede ori dacă nu era nimeni pornit.
--
-- Acum o scrie pagina profesorului, în contul elevului ales pe tablă, prin
-- funcția de mai jos. Regulile de pe `learn_lessons_boards` (0074) rămân
-- neatinse: profesorul tot nu poate scrie direct în lucrările elevilor, ci
-- numai prin ușa asta, care cere `is_admin_user()` la fiecare chemare.
--
-- Întoarce id-ul lucrării. Cu `p_id`, scrie în lucrarea aceea (tabla ține minte
-- id-ul după prima salvare). Cu `p_nou`, face mereu una nouă: dacă titlul e
-- luat (două lucrări la aceeași operă, în același minut), îi pune „(2)", „(3)".
-- Fără niciuna, caută după titlu ori o face.
--
-- Se poate rula de mai multe ori.
-- =========================================================

drop function if exists public.salveaza_lucrarea_elevului(uuid, text, text, jsonb, uuid);
create or replace function public.salveaza_lucrarea_elevului(
  p_elev uuid, p_lectie text, p_titlu text, p_data jsonb, p_id uuid default null, p_nou boolean default false
)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v     uuid;
  titlu text := btrim(p_titlu);
  k     int  := 1;
begin
  if not public.is_admin_user() then
    raise exception 'numai profesorul trimite lucrări în contul elevilor' using errcode = '42501';
  end if;
  if p_elev is null
     or p_lectie is null or p_lectie !~ '^[a-z0-9-]{3,80}$'
     or p_titlu is null or char_length(btrim(p_titlu)) not between 1 and 200
     or p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 200000 then
    raise exception 'lucrarea nu are forma cerută' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_elev) then
    raise exception 'elevul nu există' using errcode = '22023';
  end if;

  if p_id is not null then
    update public.learn_lessons_boards set data = p_data
      where id = p_id and user_id = p_elev and lesson_slug = p_lectie
      returning id into v;
    if v is not null then return v; end if;
  end if;

  if not p_nou then
    select id into v from public.learn_lessons_boards
      where user_id = p_elev and lesson_slug = p_lectie and lower(btrim(title)) = lower(titlu)
      for update;
    if v is not null then
      update public.learn_lessons_boards set data = p_data where id = v;
      return v;
    end if;
  end if;

  -- Lucrare nouă: un titlu încă liber la elevul ăsta.
  while exists (select 1 from public.learn_lessons_boards
                where user_id = p_elev and lesson_slug = p_lectie
                  and lower(btrim(title)) = lower(case when k = 1 then titlu else titlu || ' (' || k || ')' end)) loop
    k := k + 1;
    if k > 99 then raise exception 'prea multe lucrări cu titlul acesta' using errcode = '22023'; end if;
  end loop;
  insert into public.learn_lessons_boards (user_id, lesson_slug, title, data)
    values (p_elev, p_lectie, case when k = 1 then titlu else titlu || ' (' || k || ')' end, p_data)
    returning id into v;
  return v;
end;
$$;

revoke all on function public.salveaza_lucrarea_elevului(uuid, text, text, jsonb, uuid, boolean) from public;
grant execute on function public.salveaza_lucrarea_elevului(uuid, text, text, jsonb, uuid, boolean) to authenticated;

-- ---------- PAZA ----------
do $$
declare
  f oid := 'public.salveaza_lucrarea_elevului(uuid, text, text, jsonb, uuid, boolean)'::regprocedure;
begin
  if not (select prosecdef from pg_proc where oid = f) then
    raise exception '0109: funcția trebuie să ruleze ca security definer';
  end if;
  if position('is_admin_user()' in (select prosrc from pg_proc where oid = f)) = 0 then
    raise exception '0109: funcția nu întreabă is_admin_user()';
  end if;
  if has_function_privilege('anon', f, 'EXECUTE') then
    raise exception '0109: vizitatorul nelogat poate chema funcția';
  end if;
  -- Regulile lui 0074 rămân: profesorul doar citește direct lucrările elevilor.
  if exists (select 1 from pg_policies where tablename = 'learn_lessons_boards'
               and policyname = 'learn_lessons_boards_teacher_read' and cmd <> 'SELECT') then
    raise exception '0109: regula profesorului pe learn_lessons_boards nu mai e doar de citire';
  end if;
end $$;

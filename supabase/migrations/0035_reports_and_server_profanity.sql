-- =========================================================
-- Migration 0035 — Rapoarte reale + filtru de limbaj pe SERVER (Lot C).
--
-- 1) Rapoartele pot ținti și un ITEM DE TEST sau un EXERCIȚIU (semnalarea unei
--    erori de conținut academic), pe lângă post/comment/message.
-- 2) Profesorul poate CITI și REZOLVA rapoartele (până acum erau insert-only →
--    rapoartele nu ajungeau nicăieri).
-- 3) Filtru de limbaj SERVER-side: o postare/comentariu cu limbaj nepotrivit e
--    reținut automat (moderation_status='held') → nu mai apare în feed, chiar
--    dacă cineva ocolește filtrul din client (inserare directă prin API).
--
-- Depinde de 0003 (posts/comments) + 0004/0017 (reports). Sigur la re-rulare.
-- =========================================================

-- ---- 1) Rapoarte și pentru itemi de test / exerciții ----
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports
  add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'message', 'test_item', 'exercise'));

-- ---- 2) Profesorul citește + rezolvă rapoartele (înainte doar insert) ----
drop policy if exists reports_admin_read on public.reports;
create policy reports_admin_read on public.reports for select
  using (public.is_admin_user() or reporter_id = auth.uid());
drop policy if exists reports_admin_update on public.reports;
create policy reports_admin_update on public.reports for update
  using (public.is_admin_user());
grant select, update on public.reports to authenticated;

-- ---- 3) Filtru de limbaj pe SERVER (backstop pentru filtrul client-side) ----
-- Normalizează diacritice + minuscule, apoi caută tulpini vulgare la marginea
-- unui cuvânt (nu în interior: „scapula", „manipula", „pulover" rămân curate).
create or replace function public.is_profane(txt text)
returns boolean
language sql immutable
set search_path = public
as $$
  select lower(translate(coalesce(txt, ''), 'ăâîșşțţ', 'aaisstt')) ~*
    '(^|[^a-z])(pul[aei]|pizd|muist?|fut[uae]?|coai|cacat|cacan|curv|tarf|labagi|bulangi|poponar|gaoz|handicapat|retardat|dobitoc|tampit|fuck|shit|bitch|cunt|asshole|whore|slut|nigg|faggot)([^a-z]|$)';
$$;

create or replace function public.hold_if_profane()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if public.is_profane(new.body) then
    new.moderation_status := 'held'; -- reținut pentru profesor; nu apare în feed
  end if;
  return new;
end;
$$;

drop trigger if exists posts_profanity on public.posts;
create trigger posts_profanity before insert on public.posts
  for each row execute function public.hold_if_profane();

drop trigger if exists comments_profanity on public.comments;
create trigger comments_profanity before insert on public.comments
  for each row execute function public.hold_if_profane();

-- =========================================================
-- Pași client (Lot C): forum-repo.reportContent(); buton „⚑ Semnalează o
-- eroare" pe itemii de test + exerciții; profesorul vede rapoartele deschise.
-- =========================================================

-- =========================================================
-- Migration 0054 — Două feluri de blocuri.
--
-- Un bloc e ori o meditație cu un elev, ori timpul profesorului, blocat pentru
-- altceva. Amândouă ocupă intervalul la fel — constrângerea de excludere din
-- 0053 nu face diferența între ele, și bine face: dacă profesorul și-a pus
-- „pregătire" marți la 18, nimeni nu trebuie să poată rezerva peste.
--
-- De ce o coloană și nu o convenție (gen „e personal dacă user_id = profesorul"):
-- convențiile se uită. Peste un an, cineva scrie o interogare și nu-și mai
-- amintește regula nescrisă. O coloană cu check spune singură ce e.
--
-- Depinde de 0053. Sigur la re-rulare.
-- =========================================================

alter table public.tutoring_slots
  add column if not exists kind text not null default 'lesson'
    check (kind in ('lesson', 'personal'));

alter table public.tutoring_slots
  add column if not exists title text;

comment on column public.tutoring_slots.kind is
  'lesson = meditație cu un elev · personal = timpul profesorului, blocat';
comment on column public.tutoring_slots.title is
  'Denumirea blocului personal („pregătire", „consultații"). Ignorată la lecții.';

-- Un bloc personal e al profesorului, prin definiție. Impus în politica de
-- scriere, nu doar în interfață: altfel un elev ar putea să-și marcheze ore ca
-- „personal" și să blocheze agenda fără să apară nicăieri drept rezervare.
drop policy if exists tutoring_insert on public.tutoring_slots;
create policy tutoring_insert on public.tutoring_slots for insert
  with check (
    public.has_planner_access()
    and (user_id = auth.uid() or public.is_admin_user())
    and (kind = 'lesson' or public.is_admin_user())
  );

drop policy if exists tutoring_update on public.tutoring_slots;
create policy tutoring_update on public.tutoring_slots for update
  using (user_id = auth.uid() or public.is_admin_user())
  with check (
    (user_id = auth.uid() or public.is_admin_user())
    and (kind = 'lesson' or public.is_admin_user())
  );

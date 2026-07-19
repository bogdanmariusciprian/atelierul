-- =========================================================
-- Migration 0047 — Din CE joc provine o postare generată + două corecturi.
--
-- 1) `generated_from` reține categoria de test (slug), ca peretele să poată
--    încadra postarea în culoarea jocului din care a ieșit.
--
-- 2) CORECTURĂ la declanșatorul din 0046: acolo scriam
--       new.generated := old.generated;
--    ceea ce împiedica orice marcare ULTERIOARĂ a unei postări. Regula corectă
--    e asimetrică: marcajul poate fi PUS, dar nu poate fi scos.
--
-- 3) Marchez retroactiv capturile de joc deja postate, ca să fie și ele
--    încuiate și încadrate, fără să ceară vreo intervenție manuală.
--
-- Depinde de 0046. Sigur la re-rulare.
-- =========================================================

alter table public.posts
  add column if not exists generated_from text;

create or replace function public.block_generated_body_edit()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.generated and new.body is distinct from old.body then
    raise exception 'continutul unei postari generate nu poate fi editat';
  end if;
  -- marcajul se poate PUNE, dar nu se poate SCOATE
  if old.generated and not new.generated then
    new.generated := true;
  end if;
  return new;
end; $$;

drop trigger if exists posts_block_generated_edit on public.posts;
create trigger posts_block_generated_edit
  before update on public.posts
  for each row execute function public.block_generated_body_edit();

-- Capturile postate înainte ca marcajul să existe.
update public.posts
   set generated = true,
       generated_from = coalesce(generated_from, 'admitere-drept')
 where surface = 'wall'
   and generated = false
   and body like '🏅 Item de admitere%';

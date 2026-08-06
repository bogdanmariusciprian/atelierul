-- =========================================================
-- Migration 0079 – Banca de material se citește de oricine.
--
-- DE CE. În 0078 citirea era a celor cu cont (`auth.uid() is not null`).
-- Dar materialul din bancă ajunge pe tablă, iar tabla se deschide și fără cont:
-- un părinte care vrea să vadă ce lucrează copilul, un elev nou care intră întâi
-- să se uite. Dacă banca tace pentru el, generatorul îi întoarce tabla goală și
-- pagina pare stricată, deși nu e.
--
-- Materialul nu e secret. Sunt cuvinte de școală: „masă", „ghiocel", „chiar".
-- Nu e nimic de ascuns în ele, iar ascunzându-le n-am apăra nimic.
--
-- CE NU SE SCHIMBĂ. Scrisul rămâne întreg al profesorului: cele trei politici de
-- insert / update / delete din 0078 stau neatinse, cu `public.is_admin_user()`.
-- Deci oricine poate CITI banca, dar numai profesorul poate PUNE ceva în ea.
-- Asta e toată deosebirea pe care o face migrarea de față.
--
-- Depinde de 0078. Sigură la re-rulare.
-- =========================================================

drop policy if exists learn_lessons_items_read on public.learn_lessons_items;

create policy learn_lessons_items_read on public.learn_lessons_items for select
  to anon, authenticated
  using (true);

-- Politica singură nu ajunge: fără drept de `select` pe tabel, rolul vizitatorului
-- e oprit înainte să se ajungă la politică. Trebuie amândouă.
grant select on public.learn_lessons_items to anon;

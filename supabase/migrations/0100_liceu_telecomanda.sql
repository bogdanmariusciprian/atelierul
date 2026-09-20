-- =========================================================
-- 0100 · LICEU: canalul telecomenzii
--
-- Marius conduce lecția de pe laptop, iar tabla o urmează. Împingerea aceea
-- trece printr-un canal Supabase Realtime — singura țeavă prin care poate veni
-- ceva din afară într-un sit care stă pe GitHub Pages, fără server al lui.
--
-- 1. CANALUL E ÎNCHIS PE CONTUL PROFESORULUI. Realtime își cere îngăduințele
--    din politicile puse pe `realtime.messages`: la intrarea pe canal întreabă
--    baza „are omul ăsta voie aici?", iar răspunsul îl ține cât ține legătura.
--    Tabelul acela NU păstrează mesajele; e doar locul unde se pun politicile.
--
-- 2. NUMAI SUBIECTELE CARE ÎNCEP CU `liceu:`. Politicile de mai jos nu deschid
--    nimic altceva: orice alt canal rămâne cum era.
--
-- 3. PÂNĂ ACUM NU EXISTA NICIO POLITICĂ pe `realtime.messages`, deci niciun
--    canal privat nu mergea. Ce se adaugă aici nu ia nimănui nimic — doar dă
--    profesorului o ușă pe care n-o avea. Canalele publice, pe care merg deja
--    mesageria și tabla de planificări, nu sunt atinse.
--
-- 4. PE CANAL NU SE TRIMITE NICIODATĂ CEVA CARE TREBUIE ASCUNS. Doar la ce
--    slide suntem. Notițele nu trec pe-aici niciodată: ele se citesc din tabelul
--    lor, de către aparatul care conduce, și nu pleacă mai departe. Regula asta
--    e scrisă aici fiindcă e o hotărâre, nu o întâmplare.
-- =========================================================

-- ---------- 1. cine intră pe canal ----------
/* `realtime.messages` are deja RLS pornit din oficiu — Supabase îl ține așa, iar
   schema `realtime` e încuiată la orice altceva. Politicile se pot pune. */

drop policy if exists liceu_telecomanda_citire on realtime.messages;
create policy liceu_telecomanda_citire on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'liceu:%'
    and public.is_admin_user()
  );

drop policy if exists liceu_telecomanda_scriere on realtime.messages;
create policy liceu_telecomanda_scriere on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'liceu:%'
    and public.is_admin_user()
  );

-- ---------- 2. paza de după ----------
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'realtime' and tablename = 'messages'
     and policyname in ('liceu_telecomanda_citire', 'liceu_telecomanda_scriere');
  if n <> 2 then
    raise exception 'Am găsit % politici de telecomandă, așteptam 2.', n;
  end if;

  /* Amândouă trebuie să ceară și subiectul, și profesorul. Una singură lăsată
     fără `is_admin_user` ar fi deschis canalul oricui are cont. */
  select count(*) into n from pg_policies
   where schemaname = 'realtime' and tablename = 'messages'
     and policyname like 'liceu_telecomanda%'
     and coalesce(qual, '') || coalesce(with_check, '') like '%is_admin_user%'
     and coalesce(qual, '') || coalesce(with_check, '') like '%liceu:%';
  if n <> 2 then
    raise exception 'O politică de telecomandă nu cere și profesorul, și subiectul „liceu:".';
  end if;

  raise notice 'Canalul telecomenzii e deschis, numai pentru profesor.';
end $$;

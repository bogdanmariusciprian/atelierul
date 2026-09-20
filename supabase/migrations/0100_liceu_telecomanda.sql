-- =========================================================
-- 0100 · LICEU: canalul telecomenzii
--
-- Marius conduce lecția de pe laptop, iar tabla o urmează. Împingerea aceea
-- trece printr-un canal Supabase Realtime – singura țeavă prin care poate veni
-- ceva din afară într-un sit care stă pe GitHub Pages, fără server al lui.
--
-- 1. CONDUCE UNUL, URMEAZĂ ORICINE. Asta e împărțirea, și e toată paza:
--    SCRIE numai profesorul – nimeni altcineva nu poate mișca tabla;
--    CITEȘTE oricine poate intra în modul – tabla nu trebuie să fie logată, iar
--    un elev poate urmări lecția pe ecranul lui, dacă vrea.
--    Realtime își cere îngăduințele din politicile puse pe `realtime.messages`:
--    la intrarea pe canal întreabă baza „are omul ăsta voie aici?", iar
--    răspunsul îl ține cât ține legătura. Tabelul acela NU păstrează mesajele;
--    e doar locul unde se pun politicile.
--
-- 2. CITIREA ATÂRNĂ DE ACELAȘI SEMN ca orarul și planificările (`0094`). Cu
--    modulul închis nu urmează nimeni – și e firesc: cu semnul stins nici n-ar
--    putea deschide `/liceu/`.
--
-- 3. NUMAI SUBIECTELE CARE ÎNCEP CU `liceu:`. Politicile de mai jos nu deschid
--    nimic altceva: orice alt canal rămâne cum era.
--
-- 4. PÂNĂ ACUM NU EXISTA NICIO POLITICĂ pe `realtime.messages`, deci niciun
--    canal privat nu mergea. Ce se adaugă aici nu ia nimănui nimic. Canalele
--    publice, pe care merg deja mesageria și tabla de planificări, nu sunt
--    atinse.
--
-- 5. PE CANAL NU SE TRIMITE NICIODATĂ CEVA CARE TREBUIE ASCUNS. Doar la ce
--    slide suntem – iar acum, când citește oricine, regula asta nu mai e o
--    precauție, e o condiție. Notițele nu trec pe-aici niciodată: ele se citesc
--    din tabelul lor, de către aparatul care conduce, și nu pleacă mai departe.
-- =========================================================

-- ---------- 1. cine intră pe canal ----------
/* `realtime.messages` are deja RLS pornit din oficiu – Supabase îl ține așa, iar
   schema `realtime` e încuiată la orice altceva. Politicile se pot pune. */

drop policy if exists liceu_telecomanda_citire on realtime.messages;
create policy liceu_telecomanda_citire on realtime.messages
  for select to anon, authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'liceu:%'
    and (public.liceu_deschis() or public.is_admin_user())
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

  /* Amândouă trebuie să ceară subiectul. Fără asta, politicile ar fi deschis
     orice canal privat din bază, nu doar pe-al liceului. */
  select count(*) into n from pg_policies
   where schemaname = 'realtime' and tablename = 'messages'
     and policyname like 'liceu_telecomanda%'
     and coalesce(qual, '') || coalesce(with_check, '') like '%liceu:%';
  if n <> 2 then
    raise exception 'O politică de telecomandă nu cere subiectul „liceu:".';
  end if;

  /* Scrisul e partea care contează: dacă ar putea scrie oricine, oricine ar
     putea mișca tabla din fundul clasei. Trebuie să ceară profesorul, și să
     n-o facă prin `liceu_deschis` – semnul acela e pentru citit. */
  select count(*) into n from pg_policies
   where schemaname = 'realtime' and tablename = 'messages'
     and policyname = 'liceu_telecomanda_scriere'
     and coalesce(with_check, '') like '%is_admin_user%'
     and coalesce(with_check, '') not like '%liceu_deschis%'
     and 'anon' <> all(roles);
  if n <> 1 then
    raise exception 'Politica de scriere nu e ținută strict pe profesor.';
  end if;

  /* Cititul, dimpotrivă, trebuie să fie deschis și celor nelogați – tabla nu se
     loghează – dar legat de semnul modulului: cu liceul închis, nimeni. */
  select count(*) into n from pg_policies
   where schemaname = 'realtime' and tablename = 'messages'
     and policyname = 'liceu_telecomanda_citire'
     and coalesce(qual, '') like '%liceu_deschis%'
     and 'anon' = any(roles);
  if n <> 1 then
    raise exception 'Politica de citire nu lasă nelogații ori nu atârnă de semnul liceului.';
  end if;

  /* Fiecare politică pe fapta ei, nimic „pentru tot". Un `for all` scris din
     grabă pe politica de citire ar fi dat și scrierea aceluiași om – adică
     oricui – și ar fi arătat la fel de cuminte în listă. */
  select count(*) into n from pg_policies
   where schemaname = 'realtime' and tablename = 'messages'
     and ((policyname = 'liceu_telecomanda_citire'  and cmd = 'SELECT')
       or (policyname = 'liceu_telecomanda_scriere' and cmd = 'INSERT'));
  if n <> 2 then
    raise exception 'O politică de telecomandă nu e ținută pe fapta ei (select / insert).';
  end if;

  raise notice 'Canalul telecomenzii: scrie profesorul, urmează oricine intră în modul.';
end $$;

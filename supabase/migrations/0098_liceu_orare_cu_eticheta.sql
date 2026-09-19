-- =========================================================
-- 0098 · LICEU: cele trei orare ale lui septembrie, fiecare cu eticheta lui
--
-- Orarul s-a schimbat de trei ori în septembrie: 7, 14 și 21. În bază a stat
-- până acum numai cel de la 14 — de-aceea cele trei ore din prima săptămână ale
-- fiecărei clase nu-și găseau locul în grilă și rămâneau fără număr.
--
-- 1. ETICHETA E O COLOANĂ NOUĂ. Până acum un orar se deosebea doar prin data de
--    la care ține. Marius a cerut să se vadă pe ecran CARE orar e în vigoare, și
--    unde începe fiecare în lista unei clase; pentru asta îi trebuie un nume,
--    nu o dată.
--
-- 2. INTRĂ ȘI 11F, ȘI 12F. Două clase noi, cu câte o oră pe săptămână, apărute
--    în orarul din 21 sept. Nu au planificare, deci lista lor de ore va fi
--    goală; cartonașul și ecranul lor sunt totuși acolo, cerute de Marius.
--
-- 3. SE ȘTERGE TOT ȘI SE SCRIE LA LOC. Orarul e mic (65 rânduri) și se
--    citește ca un tot: trei orare peste care s-ar fi scris pe bucăți ar fi
--    lăsat în urmă ore care nu mai există nicăieri.
-- =========================================================

alter table public.school_timetable
  add column if not exists eticheta text;

comment on column public.school_timetable.eticheta is
  'Numele orarului, cum îl scrie Marius: „Orar – 21 sept.". Se vede în grilă și în lista claselor.';

delete from public.school_timetable where an_scolar = '2026-2027';

insert into public.school_timetable (clasa, an_scolar, zi, period, sala, valabil_de_la, eticheta) values
  ('11D','2026-2027','joi','6','s21','2026-09-07','Orar – 7 sept.'),
  ('9B','2026-2027','joi','7','s16','2026-09-07','Orar – 7 sept.'),
  ('9B','2026-2027','joi','8','s16','2026-09-07','Orar – 7 sept.'),
  ('10D','2026-2027','joi','9','s23','2026-09-07','Orar – 7 sept.'),
  ('11B','2026-2027','luni','1','s19','2026-09-07','Orar – 7 sept.'),
  ('12D','2026-2027','luni','2','s25','2026-09-07','Orar – 7 sept.'),
  ('12C','2026-2027','luni','4','s24','2026-09-07','Orar – 7 sept.'),
  ('9B','2026-2027','marti','11','s16','2026-09-07','Orar – 7 sept.'),
  ('10D','2026-2027','marti','12','s23','2026-09-07','Orar – 7 sept.'),
  ('10D','2026-2027','marti','13','s23','2026-09-07','Orar – 7 sept.'),
  ('12C','2026-2027','miercuri','1','s24','2026-09-07','Orar – 7 sept.'),
  ('11D','2026-2027','miercuri','2','s21','2026-09-07','Orar – 7 sept.'),
  ('12D','2026-2027','miercuri','4','s25','2026-09-07','Orar – 7 sept.'),
  ('11C','2026-2027','miercuri','5','s20','2026-09-07','Orar – 7 sept.'),
  ('11B','2026-2027','miercuri','6','s19','2026-09-07','Orar – 7 sept.'),
  ('11D','2026-2027','vineri','1','s21','2026-09-07','Orar – 7 sept.'),
  ('12C','2026-2027','vineri','2','s24','2026-09-07','Orar – 7 sept.'),
  ('11C','2026-2027','vineri','3','s20','2026-09-07','Orar – 7 sept.'),
  ('12D','2026-2027','vineri','4','s25','2026-09-07','Orar – 7 sept.'),
  ('11C','2026-2027','vineri','5','s20','2026-09-07','Orar – 7 sept.'),
  ('11B','2026-2027','vineri','6','s19','2026-09-07','Orar – 7 sept.'),
  ('12D','2026-2027','joi','2','s25','2026-09-14','Orar – 14 sept.'),
  ('11D','2026-2027','joi','6','s21','2026-09-14','Orar – 14 sept.'),
  ('9B','2026-2027','joi','7','s16','2026-09-14','Orar – 14 sept.'),
  ('10D','2026-2027','joi','8','s23','2026-09-14','Orar – 14 sept.'),
  ('11B','2026-2027','luni','1','s19','2026-09-14','Orar – 14 sept.'),
  ('12D','2026-2027','luni','2','s25','2026-09-14','Orar – 14 sept.'),
  ('12C','2026-2027','luni','4','s24','2026-09-14','Orar – 14 sept.'),
  ('9B','2026-2027','marti','10','s16','2026-09-14','Orar – 14 sept.'),
  ('10D','2026-2027','marti','11','s23','2026-09-14','Orar – 14 sept.'),
  ('9B','2026-2027','marti','12','s16','2026-09-14','Orar – 14 sept.'),
  ('10D','2026-2027','marti','13','s23','2026-09-14','Orar – 14 sept.'),
  ('12C','2026-2027','miercuri','1','s24','2026-09-14','Orar – 14 sept.'),
  ('11D','2026-2027','miercuri','2','s21','2026-09-14','Orar – 14 sept.'),
  ('11C','2026-2027','miercuri','5','s20','2026-09-14','Orar – 14 sept.'),
  ('11B','2026-2027','miercuri','6','s19','2026-09-14','Orar – 14 sept.'),
  ('12D','2026-2027','vineri','1','s25','2026-09-14','Orar – 14 sept.'),
  ('12C','2026-2027','vineri','2','s24','2026-09-14','Orar – 14 sept.'),
  ('11C','2026-2027','vineri','3','s20','2026-09-14','Orar – 14 sept.'),
  ('11D','2026-2027','vineri','4','s21','2026-09-14','Orar – 14 sept.'),
  ('11C','2026-2027','vineri','5','s20','2026-09-14','Orar – 14 sept.'),
  ('11B','2026-2027','vineri','6','s19','2026-09-14','Orar – 14 sept.'),
  ('12D','2026-2027','joi','2','s25','2026-09-21','Orar – 21 sept.'),
  ('11D','2026-2027','joi','6','s21','2026-09-21','Orar – 21 sept.'),
  ('9B','2026-2027','joi','7','s16','2026-09-21','Orar – 21 sept.'),
  ('10D','2026-2027','joi','8','s23','2026-09-21','Orar – 21 sept.'),
  ('11F','2026-2027','joi','10','s27','2026-09-21','Orar – 21 sept.'),
  ('11B','2026-2027','luni','1','s19','2026-09-21','Orar – 21 sept.'),
  ('12D','2026-2027','luni','2','s25','2026-09-21','Orar – 21 sept.'),
  ('12F','2026-2027','luni','3','s27','2026-09-21','Orar – 21 sept.'),
  ('12C','2026-2027','luni','4','s24','2026-09-21','Orar – 21 sept.'),
  ('9B','2026-2027','marti','10','s16','2026-09-21','Orar – 21 sept.'),
  ('10D','2026-2027','marti','11','s23','2026-09-21','Orar – 21 sept.'),
  ('9B','2026-2027','marti','12','s16','2026-09-21','Orar – 21 sept.'),
  ('10D','2026-2027','marti','13','s23','2026-09-21','Orar – 21 sept.'),
  ('12C','2026-2027','miercuri','1','s24','2026-09-21','Orar – 21 sept.'),
  ('11D','2026-2027','miercuri','2','s21','2026-09-21','Orar – 21 sept.'),
  ('11C','2026-2027','miercuri','5','s20','2026-09-21','Orar – 21 sept.'),
  ('11B','2026-2027','miercuri','6','s19','2026-09-21','Orar – 21 sept.'),
  ('12D','2026-2027','vineri','1','s25','2026-09-21','Orar – 21 sept.'),
  ('12C','2026-2027','vineri','2','s24','2026-09-21','Orar – 21 sept.'),
  ('11C','2026-2027','vineri','3','s20','2026-09-21','Orar – 21 sept.'),
  ('11C','2026-2027','vineri','4','s20','2026-09-21','Orar – 21 sept.'),
  ('11D','2026-2027','vineri','5','s21','2026-09-21','Orar – 21 sept.'),
  ('11B','2026-2027','vineri','6','s19','2026-09-21','Orar – 21 sept.');

-- ---------- paza de după ----------
do $$
declare n int; fara_eticheta int;
begin
  select count(distinct valabil_de_la) into n from public.school_timetable where an_scolar = '2026-2027';
  if n <> 3 then
    raise exception 'Am găsit % orare, așteptam 3 (7, 14 și 21 sept.).', n;
  end if;

  select count(*) into fara_eticheta from public.school_timetable
   where an_scolar = '2026-2027' and (eticheta is null or eticheta = '');
  if fara_eticheta > 0 then
    raise exception '% ore de orar au rămas fără etichetă.', fara_eticheta;
  end if;

  /* Fiecare orar trebuie să aibă o singură etichetă, altfel banda din lista
     clasei ar scrie când una, când alta, pentru aceeași zi. */
  if exists (select 1 from public.school_timetable where an_scolar = '2026-2027'
              group by valabil_de_la having count(distinct eticheta) > 1) then
    raise exception 'Un orar are mai multe etichete.';
  end if;

  /* ACUM FIECARE ORĂ DIN PLANIFICĂRI TREBUIE SĂ-ȘI GĂSEASCĂ LOCUL. Asta era
     rostul orarului de la 7 sept.: fără el, prima săptămână rămânea orfană. */
  select count(*) into n
  from public.school_plan p
  join (select (e->>'id') as id, (e->>'start') as inceput
          from public.school_config c, jsonb_array_elements(c.valoare) e
         where c.cheie = 'intervale') iv on iv.inceput = p.ora
  where p.an_scolar = '2026-2027'
    and not exists (
      select 1 from public.school_timetable t
       where t.clasa = p.clasa and t.zi = p.zi and t.period = iv.id
         and t.valabil_de_la = (select max(valabil_de_la) from public.school_timetable
                                 where an_scolar = '2026-2027' and valabil_de_la <= p.data));
  if n > 0 then
    raise exception '% ore din planificări nu-și găsesc locul în niciun orar.', n;
  end if;

  raise notice 'Cele trei orare sunt în bază, cu etichetele lor.';
end $$;

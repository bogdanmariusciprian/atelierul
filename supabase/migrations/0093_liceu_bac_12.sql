-- =========================================================
-- 0093 · LICEU: planificarea de bacalaureat la clasele a 12-a
--
-- La 12C și 12D nu se mai merge pe planificarea oficială, ci pe cea de
-- bacalaureat (tabelul „PLANIFICAREA MATERIEI PENTRU EXAMENUL NAȚIONAL DE
-- BACALAUREAT 2027"), aceeași la amândouă clasele.
--
-- 1. SE RESCRIU NUMAI `unitatea`, `titlu` ȘI `fel`. Orele rămân ale lor: `nr`,
--    `data` și `ora` nu se ating. Așa „a 4-a oră din 91" rămâne adevărat, iar
--    cardul și grila orarului merg mai departe fără să știe că s-a schimbat
--    ceva.
--
-- 2. TABELUL E PE SĂPTĂMÂNI, ORELE SUNT PE CEASURI. O lecție de-acolo ține o
--    săptămână ori două, adică mai multe ore. Se desface pe ore și se
--    numerotează: „Luceafărul (I)", „(II)", „(III)". Aici blocurile nu se
--    potrivesc pe DATE, ci pe CÂTE ORE ține fiecare, fiindcă una a fost mutată
--    (vezi 4) și data n-ar mai fi spus adevărul.
--
-- 3. CELE 91 IES EXACT. Ambele clase au trei ore pe săptămână, iar unde tabelul
--    pune trei lecții în aceeași săptămână (1–7 martie) sunt fix trei ore, una
--    de fiecare. Suma celor 21 de blocuri e 91, cât are anul; dacă vreodată nu
--    mai e, migrarea se oprește și spune, în loc să scrie pe jumătate.
--
-- 4. BLAGA A FOST MUTAT. În tabel stă în 12–18 octombrie, săptămâna Școala
--    Altfel, în care clasele a 12-a n-au nicio oră. Cerut de Marius, trece
--    peste săptămâna lui Barbu (19–23 oct) și îi ia două ore din trei.
--
-- 5. SE POATE RULA DE CÂTE ORI VREI. E numai un `update`, fără niciun pas care
--    să se strice la a doua oară. Și e bine că se poate: unealta de import
--    (`Fa-SQL.bat`) reface rândurile din JSON-urile oficiale, deci un import nou
--    pe 12C ori 12D ar aduce înapoi titlurile vechi. Atunci se rulează asta din
--    nou și totul se așază la loc.
-- =========================================================

-- ---------- 0. paza dinainte ----------
do $$
declare c text; n int; gol int;
begin
  foreach c in array array['12C', '12D'] loop
    select count(*), count(*) filter (where nr is null) into n, gol
    from public.school_plan where clasa = c and an_scolar = '2026-2027';
    if n <> 91 then
      raise exception 'Clasa % are % ore în planificare, nu 91. Migrarea se oprește.', c, n;
    end if;
    if gol > 0 then
      raise exception 'Clasa % are % ore fără număr. Migrarea se oprește.', c, gol;
    end if;
    /* Numerele trebuie să fie 1..91, fără goluri: blocurile se așază pe ele în
       șir, iar un gol ar muta toate lecțiile de după el cu o oră mai încolo. */
    select count(*) into n
    from generate_series(1, 91) g
    where not exists (select 1 from public.school_plan p
                      where p.clasa = c and p.an_scolar = '2026-2027' and p.nr = g);
    if n > 0 then
      raise exception 'Clasei % îi lipsesc % numere din șirul 1..91.', c, n;
    end if;
  end loop;
end $$;

-- ---------- 1. planificarea de bac, scrisă o singură dată ----------
/* `ore` = câte ore ține lecția. `cu_numar` = dacă i se pune cifra romană;
   „Subiecte BACALAUREAT" ține 32 de ore și n-o primește, fiindcă „(XXXII)" nu
   se mai citește de pe tablă. */
drop table if exists tmp_bac_12;
create temp table tmp_bac_12 (
  ordine   int  primary key,
  unitatea text not null,
  titlu    text not null,
  ore      int  not null check (ore > 0),
  cu_numar boolean not null default true
);

insert into tmp_bac_12 (ordine, unitatea, titlu, ore, cu_numar) values
  ( 1, 'Recapitulare',                          'Subiecte tip I și tip II',                                                                                  6, true),

  ( 2, 'Unitatea 1. Lirica',                    'Romantismul – Mihai Eminescu, „Luceafărul”',                                                                3, true),
  ( 3, 'Unitatea 1. Lirica',                    'Simbolismul – G. Bacovia, „Plumb”',                                                                         3, true),
  ( 4, 'Unitatea 1. Lirica',                    'Modernismul – T. Arghezi, „Testament”',                                                                     2, true),
  ( 5, 'Unitatea 1. Lirica',                    'Modernismul – L. Blaga, „Eu nu strivesc corola de minuni a lumii”',                                         2, true),
  ( 6, 'Unitatea 1. Lirica',                    'Modernismul – I. Barbu, „Joc secund”',                                                                      1, true),
  ( 7, 'Unitatea 1. Lirica',                    'Tradiționalismul – I. Pillat, „Aci sosi pe vremuri”',                                                       3, true),
  ( 8, 'Unitatea 1. Lirica',                    'Neomodernismul – N. Stănescu, „Leoaică tânără, iubirea”',                                                   3, true),

  ( 9, 'Unitatea 2. Proza scurtă',              'Basmul cult – I. Creangă, „Povestea lui Harap-Alb”',                                                        3, true),
  (10, 'Unitatea 2. Proza scurtă',              'Nuvela – I. Slavici, „Moara cu noroc”',                                                                     3, true),

  (11, 'Unitatea 3. Dramaturgia',               'Comedia – I. L. Caragiale, „O scrisoare pierdută”',                                                         5, true),
  (12, 'Unitatea 3. Dramaturgia',               'Drama postbelică – M. Sorescu, „Iona”',                                                                     4, true),

  (13, 'Unitatea 4. Romanul',                   'Romanul obiectiv, tradițional, realist – L. Rebreanu, „Ion”',                                               3, true),
  (14, 'Unitatea 4. Romanul',                   'Romanul modern, subiectiv, psihologic, al experienței – C. Petrescu, „Ultima noapte de dragoste, întâia noapte de război”', 3, true),
  (15, 'Unitatea 4. Romanul',                   'Romanul realist balzacian – G. Călinescu, „Enigma Otiliei”',                                                3, true),
  (16, 'Unitatea 4. Romanul',                   'Romanul mitic, tradițional – M. Sadoveanu, „Baltagul”',                                                     3, true),
  /* Volumele se scriu fără paranteze dinadins: „Moromeții (I, II)" plus cifra
     orei ar fi dat „Moromeții (I, II) (IV)", adică două paranteze care spun
     lucruri deosebite una lângă alta. */
  (17, 'Unitatea 4. Romanul',                   'Romanul postbelic – M. Preda, „Moromeții I și II”',                                                         6, true),

  (18, 'Unitatea 5. Curente literare, ideologii', 'Pașoptismul. Mihail Kogălniceanu, „Dacia literară”',                                                      1, true),
  (19, 'Unitatea 5. Curente literare, ideologii', 'Titu Maiorescu – Junimea și junimismul. „O cercetare critică asupra poeziei române de la 1867”',          1, true),
  (20, 'Unitatea 5. Curente literare, ideologii', 'Modernismul – E. Lovinescu, „Sburătorul”',                                                                1, true),

  (21, 'Unitatea 6. Recapitulare, evaluare',    'Subiecte BACALAUREAT',                                                                                     32, false);

-- ---------- 2. paza pe planificare ----------
do $$
declare s int; lung int;
begin
  select sum(ore) into s from tmp_bac_12;
  if s <> 91 then
    raise exception 'Blocurile de bac fac % ore, nu 91. Migrarea se oprește.', s;
  end if;
  /* Cifrele romane se iau dintr-un șir de zece. Un bloc numerotat mai lung de
     atât ar fi ieșit cu titlul gol, în tăcere. */
  select max(ore) into lung from tmp_bac_12 where cu_numar;
  if lung > 10 then
    raise exception 'Un bloc numerotat ține % ore, iar cifrele romane merg până la X.', lung;
  end if;
end $$;

-- ---------- 3. rescrierea ----------
with cu_inceput as (
  /* Câte ore sunt ÎNAINTEA fiecărui bloc: de acolo începe el în șirul 1..91. */
  select b.*,
         coalesce(sum(b.ore) over (order by b.ordine
                  rows between unbounded preceding and 1 preceding), 0) as inainte
  from tmp_bac_12 b
),
pe_ora as (
  /* Blocul se desface în orele lui, una câte una. */
  select c.unitatea,
         case when c.ore > 1 and c.cu_numar
              then c.titlu || ' (' || (array['I','II','III','IV','V','VI','VII','VIII','IX','X'])[g] || ')'
              else c.titlu
         end as titlu,
         c.inainte + g as nr
  from cu_inceput c, generate_series(1, c.ore) g
)
update public.school_plan p
set unitatea = t.unitatea,
    titlu    = t.titlu,
    /* `fel` venea din planificarea oficială („lecție" ori „bloc propriu") și
       vorbea despre orele de-acolo. Aici toate sunt lecții de bac. */
    fel      = 'lectie',
    /* `blocuri` ținea noțiunile și activitățile lecției VECHI. Lăsate acolo sub
       titlul nou, ar fi fost o minciună tăcută în bază. */
    blocuri  = '[]'::jsonb
from pe_ora t
where p.an_scolar = '2026-2027'
  and p.clasa in ('12C', '12D')
  and p.nr = t.nr;

-- ---------- 4. paza de după ----------
do $$
declare ramase int;
begin
  /* Nicio oră a claselor a 12-a n-are voie să rămână cu o unitate din
     planificarea oficială. Dacă ceva n-a fost atins, se află aici. */
  select count(*) into ramase
  from public.school_plan p
  where p.an_scolar = '2026-2027' and p.clasa in ('12C', '12D')
    and p.unitatea not in (select distinct unitatea from tmp_bac_12);
  if ramase > 0 then
    raise exception '% ore au rămas pe planificarea veche. Migrarea se oprește.', ramase;
  end if;
end $$;

drop table if exists tmp_bac_12;

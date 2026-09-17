-- =========================================================
-- 0096 · LICEU: lista fișelor trece din cod în bază
--
-- Până acum lista a stat scrisă de mână în `fise.js`: o fișă nouă însemna un
-- fișier urcat ȘI un rând scris de mine ȘI un commit. Trei pași, dintre care
-- doi cereau pe altcineva decât Marius.
--
-- Cu lista în bază, urcarea se face dintr-un singur loc, din modul: fișierul
-- intră în găleată, rândul intră aici, iar fișa apare pe loc. Fără redenumit,
-- fără commit.
--
-- 1. `ore` E UN ȘIR, nu un număr. O lecție care ține o săptămână are aceeași
--    fișă la toate orele ei — Luceafărul stă pe 7, 8 și 9 la amândouă clasele a
--    12-a — și se deschide de pe oricare.
--
-- 2. `fisier` SAU `cale`, niciodată niciunul. `fisier` e numele din găleată
--    („11d-5-b.html"), pentru fișele de la clasă. `cale` e o adresă din sit,
--    pentru cele care sunt lecții publice și acolo le e locul: deocamdată
--    Luceafărul, la `lectii/lectura/`.
--
-- 3. `slug` E NUMELE DIN ADRESĂ („11d-5-b"), nu `id`-ul. Un `uuid` în bara
--    browserului n-ar spune nimănui nimic, iar legăturile de până acum ar fi
--    murit. Rămâne scurt și citibil, cum era în cod.
--
-- 4. CITEȘTE CINE ARE VOIE, SCRIE NUMAI PROFESORUL — aceleași reguli ca orarul,
--    legate de același semn din `0094`. Cu semnul stins, un elev nu vede nici
--    măcar CĂ există o fișă la ora aceea.
-- =========================================================

-- ---------- 1. tabelul ----------
create table if not exists public.school_fise (
  id        uuid primary key default gen_random_uuid(),
  an_scolar text not null default '2026-2027',

  clasa     text not null,
  ore       integer[] not null,
  fel       text,                     -- A / B / C, ori gol la clasele a 12-a
  titlu     text not null,

  slug      text not null,            -- numele scurt din adresă: „11d-5-b"
  fisier    text,                     -- numele din găleată: „11d-5-b.html"
  cale      text,                     -- ori o adresă din sit

  creat_la  timestamptz not null default now(),

  unique (an_scolar, slug),
  constraint school_fise_are_unde check (fisier is not null or cale is not null),
  constraint school_fise_are_ore  check (array_length(ore, 1) >= 1)
);

create index if not exists school_fise_clasa on public.school_fise (an_scolar, clasa);

-- ---------- 2. paza ----------
alter table public.school_fise enable row level security;

revoke all on public.school_fise from anon;
grant select on public.school_fise to anon;
grant select, insert, update, delete on public.school_fise to authenticated;

drop policy if exists school_fise_citire on public.school_fise;
create policy school_fise_citire on public.school_fise
  for select using (public.liceu_deschis() or public.is_admin_user());

drop policy if exists school_fise_admin on public.school_fise;
create policy school_fise_admin on public.school_fise
  for all using (public.is_admin_user()) with check (public.is_admin_user());

-- ---------- 3. cele unsprezece rânduri de acum ----------
/* Se pun o singură dată. La a doua rulare nu se ating: dacă între timp ai
   schimbat un titlu din modul, o migrare rerulată nu are voie să ți-l dea
   înapoi pe cel vechi. */
insert into public.school_fise (clasa, ore, fel, titlu, slug, fisier) values
  ('9B',  array[4], 'B', 'Oralitate și scris. Literatura ca reprezentare, instituție și creație', '9b-4-b',  '9b-4-b.html'),
  ('9B',  array[5], 'B', 'Literatura în timp. Epoci, școli literare și schimbarea temelor',        '9b-5-b',  '9b-5-b.html'),
  ('9B',  array[6], 'B', 'Genurile literare și formele literaturii de astăzi',                     '9b-6-b',  '9b-6-b.html'),
  ('10D', array[5], 'B', 'De la basmul popular la basmul cult',                                    '10d-5-b', '10d-5-b.html'),
  ('10D', array[6], 'B', 'Lectura textului. Reconstituirea poveștii și limbajul povestirii',       '10d-6-b', '10d-6-b.html'),
  ('11B', array[5], 'B', 'Fondul principal lexical. Latinitatea limbii române',                    '11b-5-b', '11b-5-b.html'),
  ('11C', array[4], 'B', 'Originile și evoluția limbii române',                                    '11c-4-b', '11c-4-b.html'),
  ('11D', array[4], 'B', 'Originile și evoluția limbii române. Substrat, strat, adstrat',          '11d-4-b', '11d-4-b.html'),
  ('11D', array[5], 'B', 'Influențele lingvistice',                                                '11d-5-b', '11d-5-b.html')
on conflict (an_scolar, slug) do nothing;

insert into public.school_fise (clasa, ore, fel, titlu, slug, cale) values
  ('12C', array[7,8,9], null, 'Mihai Eminescu, „Luceafărul” – poemul întreg, cu adnotări', '12c-7', 'lectii/lectura/luceafarul/index.html'),
  ('12D', array[7,8,9], null, 'Mihai Eminescu, „Luceafărul” – poemul întreg, cu adnotări', '12d-7', 'lectii/lectura/luceafarul/index.html')
on conflict (an_scolar, slug) do nothing;

-- ---------- 4. paza de după ----------
do $$
declare n int; lipsa text;
begin
  select count(*) into n from public.school_fise where an_scolar = '2026-2027';
  if n < 11 then
    raise exception 'Am găsit % fișe în tabel, așteptam cel puțin 11.', n;
  end if;

  /* FIECARE FIȘĂ DIN GĂLEATĂ TREBUIE SĂ AIBĂ FIȘIERUL EI ACOLO. Asta prinde
     nepotrivirea care înainte se vedea abia la clasă, când fișa nu se deschidea:
     un rând care arată spre un nume care nu există în găleată. */
  select string_agg(f.slug || ' → ' || f.fisier, ', ') into lipsa
  from public.school_fise f
  where f.an_scolar = '2026-2027' and f.fisier is not null
    and not exists (select 1 from storage.objects o
                     where o.bucket_id = 'liceu-fise' and o.name = f.fisier);
  if lipsa is not null then
    raise exception 'Fișe fără fișier în găleată: %', lipsa;
  end if;

  /* Și pe dos: fișiere urcate în găleată pe care nu le cheamă niciun rând. Nu e
     greșeală, doar rămășiță — se spune, nu se oprește. */
  select string_agg(o.name, ', ') into lipsa
  from storage.objects o
  where o.bucket_id = 'liceu-fise' and o.name not like '.%'
    and not exists (select 1 from public.school_fise f
                     where f.an_scolar = '2026-2027' and f.fisier = o.name);
  if lipsa is not null then
    raise notice 'Fișiere în găleată pe care nu le cheamă nicio fișă: %', lipsa;
  end if;
end $$;

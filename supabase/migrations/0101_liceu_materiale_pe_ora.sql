-- =========================================================
-- 0101 · LICEU: o oră poate ține oricâte materiale, iar unele sunt PDF-uri
--
-- Până acum o oră avea cel mult un material. Regula asta n-a stat niciodată în
-- bază, ci doar în codul modulului și într-o pază de migrare (`0099`); tabelul
-- primea de la început mai multe rânduri pe aceeași oră. Deci aici nu se desface
-- nimic: se adaugă ce lipsea ca mai multe rânduri pe-o oră să aibă înțeles.
--
-- 1. `format` – „html" ori „pdf". S-ar fi putut ghici din coada numelui, și
--    ghicitul ține până la primul fișier numit altfel. Scris, se știe.
--
-- 2. `nume` – numele SCURT al materialului, cel de pe rândul lui: „Particularități",
--    „Fișă de lucru". `titlu` rămâne ce era, titlul lecției din planificare, care
--    e același pentru toate materialele unei ore și de-aia nu le poate deosebi.
--    Gol înseamnă „arată titlul", ca să nu trebuiască umplut la cele de acum.
--
-- 3. `ordine` – în ce șir se arată materialele unei ore. Ceasul de la `creat_la`
--    ar fi ținut loc, până în ziua în care vrei fișa de lucru înaintea celei de
--    teorie, deși ai urcat-o după.
--
-- 4. GĂLEATA PRIMEȘTE ȘI PDF-URI. Până acum numai `text/html`, iar un PDF era
--    oprit la ușă cu un mesaj care nu spunea de ce. Două feluri, nimic altceva:
--    lista rămâne închisă dinadins, ca găleata să nu devină un dulap de vechituri.
-- =========================================================

-- ---------- 1. coloanele noi ----------
alter table public.school_fise
  add column if not exists format  text    not null default 'html',
  add column if not exists nume    text,
  add column if not exists ordine  smallint not null default 1;

/* Se pune DUPĂ ce coloana există și e umplută: altfel, la un tabel cu rânduri,
   constrângerea ar fi picat chiar la adăugare. */
alter table public.school_fise drop constraint if exists school_fise_format;
alter table public.school_fise
  add constraint school_fise_format check (format in ('html', 'pdf'));

comment on column public.school_fise.format is
  'Ce fel de fișier e: html ori pdf. Scris, nu ghicit din numele fișierului.';
comment on column public.school_fise.nume is
  'Numele scurt al materialului, cel de pe rândul lui. Gol = arată titlul lecției.';
comment on column public.school_fise.ordine is
  'În ce șir se arată materialele aceleiași ore.';

-- ---------- 2. rândurile de acum ----------
/* Toate cele de până azi sunt HTML-uri, și se vede din coada numelui ori din
   calea din sit. Se scrie o singură dată, și numai unde n-a scris nimeni ceva
   între timp. */
update public.school_fise
   set format = 'pdf'
 where format = 'html'
   and (lower(coalesce(fisier, '')) like '%.pdf' or lower(coalesce(cale, '')) like '%.pdf');

-- ---------- 3. găleata primește și PDF-uri ----------
update storage.buckets
   set allowed_mime_types = array['text/html', 'application/pdf']
 where id = 'liceu-fise';

-- ---------- 4. paza de după ----------
do $$
declare n int; vina text;
begin
  /* Coloanele există și au felul cerut. */
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'school_fise'
     and column_name in ('format', 'nume', 'ordine');
  if n <> 3 then
    raise exception 'Am găsit % coloane noi din cele 3 așteptate.', n;
  end if;

  /* Nicio fișă n-a rămas cu un format care nu se potrivește cu fișierul ei.
     Asta prinde chiar greșeala pe care o face umplerea de mai sus dacă e scrisă
     pe dos: un PDF trecut drept HTML s-ar fi deschis ca text pe ecran. */
  select string_agg(slug || ' (' || format || ' ↔ ' || coalesce(fisier, cale) || ')', ', ')
    into vina
  from public.school_fise
  where an_scolar = '2026-2027'
    and format <> (case when lower(coalesce(fisier, cale, '')) like '%.pdf'
                        then 'pdf' else 'html' end);
  if vina is not null then
    raise exception 'Fișe cu formatul nepotrivit cu fișierul: %', vina;
  end if;

  /* Găleata: amândouă felurile, și NUMAI ele. O listă goală ar fi însemnat
     „primește orice", ceea ce e chiar pe dos decât vrem. */
  select array_to_string(allowed_mime_types, ',') into vina
    from storage.buckets where id = 'liceu-fise';
  if vina is distinct from 'text/html,application/pdf' then
    raise exception 'Găleata primește „%", așteptam „text/html,application/pdf".', coalesce(vina, '(orice)');
  end if;

  /* Regula veche „un singur material pe oră" nu mai e ținută de nimeni. Se
     verifică pe față că baza chiar îngăduie două rânduri pe aceeași oră – altfel
     tot restul lucrării de azi ar fi degeaba, și s-ar vedea abia la prima urcare. */
  begin
    insert into public.school_fise (an_scolar, clasa, ore, titlu, slug, fisier, format)
    values ('proba-0101', 'XX', array[1], 'proba', 'proba-a', 'proba-a.html', 'html'),
           ('proba-0101', 'XX', array[1], 'proba', 'proba-b', 'proba-b.pdf',  'pdf');
    delete from public.school_fise where an_scolar = 'proba-0101';
  exception when others then
    raise exception 'Baza tot nu primește două materiale pe aceeași oră: %', sqlerrm;
  end;

  raise notice 'O oră poate ține oricâte materiale, iar găleata primește și PDF-uri.';
end $$;

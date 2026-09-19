-- =========================================================
-- 0099 · LICEU: fișele de la 10D, mutate pe orele lor
--
-- Planificarea lui 10D s-a schimbat (migrarea 0097): recapitularea inițială a
-- scăzut de la 4 ore la 3, deci unitatea basmului începe cu o oră mai devreme,
-- iar cele două lecții care stăteau împreună la ora 6 s-au despărțit.
--
-- Am potrivit fișele pe CONȚINUT, nu pe numărul orei, uitându-mă în lecțiile din
-- JSON-uri:
--
--   · „De la basmul popular la basmul cult" — titlul de document al orei 4 din
--     noua planificare e chiar acesta, cuvânt cu cuvânt. Trece de la 5 la 4.
--   · „Lectura textului. Reconstituirea poveștii și limbajul povestirii" — ce
--     acoperea ea într-o oră s-a rupt în două: ora 5 e „Lectura textului.
--     Reconstituirea poveștii", ora 6 e „Registre stilistice și limbaj". Fișa
--     stă pe amândouă și se deschide de pe oricare.
--
-- CELELALTE ȘAPTE NU SE ATING. Le-am verificat una câte una: titlurile lor sunt
-- identice cuvânt cu cuvânt cu titlurile de document ale orelor pe care stau.
-- La 11C, fișa abia acum se așază pe lecția ei — planul vechi din bază arăta
-- altă lecție la ora 4.
--
-- NUMELE DIN GĂLEATĂ RĂMÂN CELE VECHI (`10d-5-b.html`, `10d-6-b.html`), deși
-- acum stau pe orele 4 și 5–6. Numele e doar o adresă, nimic nu se leagă de el;
-- dacă se vrea curat, fișele se șterg din modul și se urcă la loc cu „+", care
-- le dă singur numele potrivit.
-- =========================================================

update public.school_fise set ore = array[4]
 where an_scolar = '2026-2027' and slug = '10d-5-b';

update public.school_fise set ore = array[5, 6]
 where an_scolar = '2026-2027' and slug = '10d-6-b';

-- ---------- paza de după ----------
do $$
declare stricate text; doua text;
begin
  /* FIECARE ORĂ A UNEI FIȘE TREBUIE SĂ EXISTE ÎN PLANIFICAREA CLASEI. O fișă
     pusă pe ora 100 a unei clase cu 95 de ore n-ar da nicio eroare — pur și
     simplu n-ar apărea nicăieri, și n-ai ști de ce. */
  select string_agg(f.slug || ' → ora ' || o, ', ') into stricate
  from public.school_fise f, unnest(f.ore) as o
  where f.an_scolar = '2026-2027'
    and not exists (select 1 from public.school_plan p
                     where p.an_scolar = f.an_scolar and p.clasa = f.clasa and p.nr = o);
  if stricate is not null then
    raise exception 'Fișe puse pe ore care nu există: %', stricate;
  end if;

  /* O ORĂ, O SINGURĂ FIȘĂ. Ecranul clasei ține o fișă pe oră; două ar însemna
     că una dintre ele nu se vede nicăieri, fără nicio vorbă. */
  select string_agg(t.clasa || ' ora ' || t.o || ': ' || t.care, '; ') into doua
  from (select f.clasa, o, string_agg(f.slug, ' + ') as care, count(*) as cate
          from public.school_fise f, unnest(f.ore) as o
         where f.an_scolar = '2026-2027'
         group by f.clasa, o having count(*) > 1) t;
  if doua is not null then
    raise exception 'Ore cu mai multe fișe: %', doua;
  end if;

  raise notice 'Fișele stau pe orele lor.';
end $$;

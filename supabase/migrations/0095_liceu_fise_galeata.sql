-- =========================================================
-- 0095 · LICEU: fișele trec într-o găleată privată
--
-- Până acum fișele au stat în `liceu/fise/`, adică în depozit, adică publicate
-- de GitHub oricui le cere adresa. Comutatorul din `0094` le închidea DATELE
-- (orarul, planificările), dar nu și fișierele: ele nu treceau pe la bază, deci
-- n-avea cine să întrebe semnul.
--
-- De-aici încolo trec printr-o găleată privată, unde fiecare cerere e cântărită
-- de aceleași reguli ca rândurile: cu semnul stins, fișierul nu se dă. Nu
-- „nu se arată" — nu se dă.
--
-- CE NU FACE MIGRAREA ASTA, și e bine de scris negru pe alb:
--   · fișele urcate până azi sunt în commit-uri publice, iar istoria unui
--     depozit nu se șterge cu o migrare. Mutarea le apără de-acum înainte;
--   · pagina Luceafărului NU se mută. E lecție a sitului, la `lectii/lectura/`,
--     și acolo e menită să fie publică. Rămâne unde e, deschisă.
--
-- SE RULEAZĂ ÎNAINTE DE URCARE. După ea, găleata e făcută și goală; fișierele
-- se urcă pe urmă, din Supabase ori din modul. Situl merge mai departe pe
-- fișierele din depozit până schimbăm și codul — nimic nu se rupe între timp.
-- =========================================================

-- ---------- 1. găleata ----------
/* `public = false` e tot rostul ei: o găleată publică s-ar da oricui, exact ca
   GitHub-ul, și n-am fi mutat nimic.
   Mărimea și felul fișierelor sunt îngrădite dinadins: găleata asta primește
   pagini de lecție, nu orice. Un fișier greșit se oprește la ușă, nu peste o
   lună, când cineva îl deschide. */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('liceu-fise', 'liceu-fise', false, 20971520, array['text/html'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- 2. cine ia și cine pune ----------
/* CITIREA merge după același semn ca orarul: profesorul mereu, ceilalți numai
   cu semnul aprins. E chiar funcția din `0094`, nu o copie a ei: dacă regula se
   schimbă vreodată, se schimbă într-un singur loc.
   SCRIEREA e numai a profesorului, oricare ar fi semnul. Semnul spune cine
   CITEȘTE modulul; cine scrie în el n-a fost niciodată o întrebare. */
drop policy if exists liceu_fise_citire   on storage.objects;
drop policy if exists liceu_fise_pune     on storage.objects;
drop policy if exists liceu_fise_schimba  on storage.objects;
drop policy if exists liceu_fise_sterge   on storage.objects;

create policy liceu_fise_citire on storage.objects
  for select
  using (bucket_id = 'liceu-fise' and (public.liceu_deschis() or public.is_admin_user()));

create policy liceu_fise_pune on storage.objects
  for insert
  with check (bucket_id = 'liceu-fise' and public.is_admin_user());

/* La `update` se cer amândouă: `using` hotărăște ce rânduri poate atinge, iar
   `with check` cum au voie să arate după. Numai cu `using`, un rând din găleata
   asta ar fi putut fi mutat în alta. */
create policy liceu_fise_schimba on storage.objects
  for update
  using (bucket_id = 'liceu-fise' and public.is_admin_user())
  with check (bucket_id = 'liceu-fise' and public.is_admin_user());

create policy liceu_fise_sterge on storage.objects
  for delete
  using (bucket_id = 'liceu-fise' and public.is_admin_user());

-- ---------- 3. paza de după ----------
do $$
declare n int; e_publica boolean;
begin
  select public into e_publica from storage.buckets where id = 'liceu-fise';
  if e_publica is null then
    raise exception 'Găleata „liceu-fise" nu s-a făcut.';
  end if;
  if e_publica then
    raise exception 'Găleata „liceu-fise" a rămas publică. Atunci n-am mutat nimic.';
  end if;

  /* Citirea TREBUIE să întrebe semnul. O politică lăsată pe „oricine" ar fi
     lăsat fișele la vedere, iar greșeala s-ar fi văzut abia când cineva ar fi
     deschis o adresă pe care n-ar fi trebuit s-o poată deschide. */
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'liceu_fise_citire' and qual like '%liceu_deschis%';
  if n <> 1 then
    raise exception 'Politica de citire a găleții nu întreabă semnul.';
  end if;

  /* Scrisul, numai al profesorului: trei politici, toate cu `is_admin_user`. */
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('liceu_fise_pune', 'liceu_fise_schimba', 'liceu_fise_sterge')
     and coalesce(qual, '') || coalesce(with_check, '') like '%is_admin_user%';
  if n <> 3 then
    raise exception 'Scrierea în găleată nu e închisă la profesor (am găsit % politici din 3).', n;
  end if;
end $$;

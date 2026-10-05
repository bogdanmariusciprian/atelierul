-- =========================================================
-- 0107 · FIȘA WORD DE SUB TABLĂ
--
-- Cererea lui Marius (5 octombrie 2026), la tabla live de redactare (0106):
-- „vreau să pot vizualiza chiar sub enunțurile mele fișa word de lucrat". A
-- ales: o urcă el din pagină, se vede ca în Word (cu pagini), și o văd toți.
--
-- Fișierul stă într-o găleată PUBLICĂ, ca PDF-urile din 0105: tabla e live și
-- pentru elevi, deci fișa trebuie să se deschidă fără semnătură. Ce se urcă aici
-- e public: fișe proprii, da; manuale ori cărți ale altora, nu.
--
-- Care fișă e pe care tablă NU stă aici, ci în `tabla_live.data.fisa` (0106):
-- așa ajunge la elevi pe același drum live ca enunțurile, iar o fișă nouă se
-- vede pe loc la toți.
--
-- Numele fișierului e nou la fiecare urcare (`<tabla>-<ceva>.docx`): adresa
-- publică e ținută minte de browsere o vreme, iar o fișă înlocuită sub același
-- nume s-ar fi văzut veche încă o oră.
--
-- Se poate rula de mai multe ori.
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tabla-fise', 'tabla-fise', true, 10485760,
        array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/* Citirea fișierelor nu cere regulă: găleata e publică. Regula de citire e
   doar a adminului, care are nevoie de ea ca să șteargă fișa veche; fără ea,
   oricine ar putea cere lista tuturor fișierelor. */
drop policy if exists tabla_fise_citire  on storage.objects;
drop policy if exists tabla_fise_pune    on storage.objects;
drop policy if exists tabla_fise_schimba on storage.objects;
drop policy if exists tabla_fise_sterge  on storage.objects;

create policy tabla_fise_citire on storage.objects
  for select to authenticated
  using (bucket_id = 'tabla-fise' and public.is_admin_user());

create policy tabla_fise_pune on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tabla-fise' and public.is_admin_user());

create policy tabla_fise_schimba on storage.objects
  for update to authenticated
  using (bucket_id = 'tabla-fise' and public.is_admin_user())
  with check (bucket_id = 'tabla-fise' and public.is_admin_user());

create policy tabla_fise_sterge on storage.objects
  for delete to authenticated
  using (bucket_id = 'tabla-fise' and public.is_admin_user());

-- ---------- PAZA ----------
do $$
declare n int;
begin
  if not exists (select 1 from storage.buckets where id = 'tabla-fise' and public
                   and file_size_limit = 10485760
                   and allowed_mime_types = array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']) then
    raise exception '0107: găleata „tabla-fise" nu e cum trebuie (publică, doar .docx, 10 MB)';
  end if;

  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'tabla\_fise\_%';
  if n <> 4 then
    raise exception '0107: găleata trebuie să aibă exact patru reguli (am găsit %)', n;
  end if;
  if exists (select 1 from pg_policies
              where schemaname = 'storage' and tablename = 'objects' and policyname like 'tabla\_fise\_%'
                and (coalesce(qual, '') not like '%is_admin_user()%' and cmd in ('SELECT', 'UPDATE', 'DELETE')
                  or coalesce(with_check, '') not like '%is_admin_user()%' and cmd in ('INSERT', 'UPDATE')
                  or coalesce(qual, '') || coalesce(with_check, '') not like '%tabla-fise%')) then
    raise exception '0107: o regulă a găleții nu cere admin ori nu e legată de „tabla-fise"';
  end if;
end $$;

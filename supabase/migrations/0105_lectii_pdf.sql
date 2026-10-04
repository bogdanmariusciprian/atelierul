-- =========================================================
-- 0105 · LECȚII PDF LA LITERATURĂ (LICEU)
--
-- Cererea lui Marius (4 octombrie 2026): „vreau să pot adăuga eu fișiere pdf
-- aici, care la click să le previzualizeze". A ales: fișierele în Supabase,
-- într-o găleată PUBLICĂ, urcate din pagină de el, fără push; previzualizarea
-- cu pdf.js, pe o pagină a sitului (`lectii/pdf/#adresa`), la fel pe telefon și
-- pe calculator. Doar la Literatură (liceu); asta o păzește pagina.
--
-- DE CE PUBLICĂ, spre deosebire de `liceu-fise` (0095): lecțiile de aici sunt
-- pentru oricine, chiar și nelogat, exact ca restul lecțiilor sitului. O
-- găleată privată ar fi cerut o semnătură la fiecare deschidere, fără să
-- apere nimic. Tot ce se urcă aici e deci public: fișe proprii, da; manuale
-- scanate ori cărți ale altora, nu.
--
-- Fișierul are un nume nou la fiecare înlocuire (`<slug>-<ceva>.pdf`), nu se
-- scrie peste cel vechi: adresa publică a unui fișier e ținută minte de
-- browsere și de rețea o vreme, iar un PDF înlocuit sub același nume s-ar fi
-- văzut vechi încă o oră.
--
-- Se poate rula de mai multe ori.
-- =========================================================

-- ---------- 1. găleata ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lectii-pdf', 'lectii-pdf', true, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/* Citirea fișierelor nu cere regulă: găleata e publică, iar adresa publică
   ocolește regulile. Regula de citire de aici e doar pentru admin, care are
   nevoie de ea ca să înlocuiască ori să șteargă; fără ea, oricine ar putea
   cere lista tuturor fișierelor din găleată. */
drop policy if exists lectii_pdf_citire  on storage.objects;
drop policy if exists lectii_pdf_pune    on storage.objects;
drop policy if exists lectii_pdf_schimba on storage.objects;
drop policy if exists lectii_pdf_sterge  on storage.objects;

create policy lectii_pdf_citire on storage.objects
  for select to authenticated
  using (bucket_id = 'lectii-pdf' and public.is_admin_user());

create policy lectii_pdf_pune on storage.objects
  for insert to authenticated
  with check (bucket_id = 'lectii-pdf' and public.is_admin_user());

create policy lectii_pdf_schimba on storage.objects
  for update to authenticated
  using (bucket_id = 'lectii-pdf' and public.is_admin_user())
  with check (bucket_id = 'lectii-pdf' and public.is_admin_user());

create policy lectii_pdf_sterge on storage.objects
  for delete to authenticated
  using (bucket_id = 'lectii-pdf' and public.is_admin_user());

-- ---------- 2. lecțiile ----------
create table if not exists public.lectii_pdf (
  id            uuid primary key default gen_random_uuid(),
  /* Adresa lecției, stabilă: pe ea stau filele (0104) și „BAC" (0103). */
  slug          text not null unique check (slug ~ '^pdf-[a-z0-9]{4,24}$'),
  domeniu       text not null default 'literatura-liceu'
                  check (char_length(btrim(domeniu)) between 1 and 60),
  titlu         text not null check (char_length(btrim(titlu)) between 3 and 120),
  rezumat       text check (rezumat is null or char_length(rezumat) <= 200),
  /* Numele fișierului din găleată. */
  fisier        text not null check (fisier ~ '^pdf-[a-z0-9]{4,24}-[a-z0-9]{4,24}\.pdf$'),
  marime        bigint check (marime is null or marime between 1 and 20971520),
  creat_la      timestamptz not null default now(),
  actualizat_la timestamptz not null default now()
);

comment on table public.lectii_pdf is
  'Lecțiile PDF urcate de admin la Literatură (liceu) (0105). Fișierul stă în găleata publică lectii-pdf.';

alter table public.lectii_pdf enable row level security;

revoke all on public.lectii_pdf from anon, authenticated;
grant select on public.lectii_pdf to anon, authenticated;
grant insert, update, delete on public.lectii_pdf to authenticated;

drop policy if exists lectii_pdf_rand_citire on public.lectii_pdf;
create policy lectii_pdf_rand_citire on public.lectii_pdf
  for select to anon, authenticated using (true);
drop policy if exists lectii_pdf_rand_pune on public.lectii_pdf;
create policy lectii_pdf_rand_pune on public.lectii_pdf
  for insert to authenticated with check (public.is_admin_user());
drop policy if exists lectii_pdf_rand_schimba on public.lectii_pdf;
create policy lectii_pdf_rand_schimba on public.lectii_pdf
  for update to authenticated using (public.is_admin_user()) with check (public.is_admin_user());
drop policy if exists lectii_pdf_rand_sterge on public.lectii_pdf;
create policy lectii_pdf_rand_sterge on public.lectii_pdf
  for delete to authenticated using (public.is_admin_user());

-- ---------- 3. PAZA ----------
do $$
declare n int;
begin
  -- găleata: publică, doar PDF, cel mult 20 MB
  if not exists (select 1 from storage.buckets where id = 'lectii-pdf' and public
                   and file_size_limit = 20971520 and allowed_mime_types = array['application/pdf']) then
    raise exception '0105: găleata „lectii-pdf" nu e cum trebuie (publică, doar PDF, 20 MB)';
  end if;

  -- în găleată, orice regulă (citire inclusiv) e a adminului
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'lectii\_pdf\_%';
  if n <> 4 then
    raise exception '0105: găleata trebuie să aibă exact patru reguli (am găsit %)', n;
  end if;
  if exists (select 1 from pg_policies
              where schemaname = 'storage' and tablename = 'objects' and policyname like 'lectii\_pdf\_%'
                and (coalesce(qual, '') not like '%is_admin_user()%' and cmd in ('SELECT', 'UPDATE', 'DELETE')
                  or coalesce(with_check, '') not like '%is_admin_user()%' and cmd in ('INSERT', 'UPDATE')
                  or coalesce(qual, '') || coalesce(with_check, '') not like '%lectii-pdf%')) then
    raise exception '0105: o regulă a găleții nu cere admin ori nu e legată de „lectii-pdf"';
  end if;

  -- tabelul: citire pentru toți, scriere doar pentru admin, pe fiecare parte
  if not (select relrowsecurity from pg_class where oid = 'public.lectii_pdf'::regclass) then
    raise exception '0105: RLS nu e pornit pe lectii_pdf';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'lectii_pdf') <> 4 then
    raise exception '0105: lectii_pdf trebuie să aibă exact patru reguli';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lectii_pdf'
               and (cmd = 'ALL'
                 or (cmd = 'INSERT' and coalesce(with_check, '') not like '%is_admin_user()%')
                 or (cmd = 'DELETE' and coalesce(qual, '') not like '%is_admin_user()%')
                 or (cmd = 'UPDATE' and (coalesce(qual, '') not like '%is_admin_user()%'
                                      or coalesce(with_check, '') not like '%is_admin_user()%')))) then
    raise exception '0105: pe lectii_pdf e o regulă de scriere care nu cere admin';
  end if;
  if has_table_privilege('anon', 'public.lectii_pdf', 'INSERT')
     or has_table_privilege('anon', 'public.lectii_pdf', 'UPDATE')
     or has_table_privilege('anon', 'public.lectii_pdf', 'DELETE') then
    raise exception '0105: nelogații au drept de scriere pe lectii_pdf';
  end if;
end $$;

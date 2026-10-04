-- =========================================================
-- 0103 · SEMNUL „BAC" PE LECȚII
--
-- Cererea lui Marius (4 octombrie 2026), la Literatură (liceu): „vreau să pot
-- aplica badge «BAC» la titlul lecțiilor din listă". A ales să-l pună din
-- pagină, ca admin, cu un comutator lângă fiecare lecție, fără cod și fără
-- push; semnul se vede pe loc pentru toată lumea.
--
-- Un rând = o lecție marcată. Lipsa rândului = fără semn. Lecția se ține
-- minte după `slug`-ul ei stabil (`lessons-index.js`, ori `propusa-…` pentru
-- cele scrise de elevi), nu după adresă: adresa se poate muta, slug-ul nu.
--
-- Domeniul NU stă aici. Lecțiile din cod nu sunt în bază, deci baza n-are cum
-- ști al cui domeniu e o lecție; comutatorul apare doar la Literatură (liceu),
-- iar asta o păzește pagina. Dacă vrei semnul și în alt domeniu, se schimbă
-- un singur rând în cod, nu baza.
--
-- Se poate rula de mai multe ori.
-- =========================================================

create table if not exists public.lectii_bac (
  slug    text primary key check (char_length(btrim(slug)) between 1 and 120),
  pus_la  timestamptz not null default now(),
  pus_de  uuid default auth.uid() references public.profiles (id) on delete set null
);

comment on table public.lectii_bac is
  'Lecțiile cu semnul „BAC" în lista de lecții. Le pune și le scoate doar adminul (0103).';

alter table public.lectii_bac enable row level security;

-- Două porți, în ordine: întâi dreptul pe tabel, apoi regula pe rând.
revoke all on public.lectii_bac from anon, authenticated;
grant select on public.lectii_bac to anon, authenticated;
grant insert, delete on public.lectii_bac to authenticated;

drop policy if exists lectii_bac_citire on public.lectii_bac;
create policy lectii_bac_citire on public.lectii_bac
  for select to anon, authenticated
  using (true);

drop policy if exists lectii_bac_pune on public.lectii_bac;
create policy lectii_bac_pune on public.lectii_bac
  for insert to authenticated
  with check (public.is_admin_user());

drop policy if exists lectii_bac_scoate on public.lectii_bac;
create policy lectii_bac_scoate on public.lectii_bac
  for delete to authenticated
  using (public.is_admin_user());

-- ---------- PAZA ----------
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.lectii_bac'::regclass) then
    raise exception '0103: RLS nu e pornit pe lectii_bac';
  end if;

  -- Exact trei reguli: citire pentru toți, scriere doar pentru admin.
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'lectii_bac') <> 3 then
    raise exception '0103: lectii_bac trebuie să aibă exact trei reguli';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'lectii_bac'
                   and policyname = 'lectii_bac_pune' and cmd = 'INSERT'
                   and with_check like '%is_admin_user()%') then
    raise exception '0103: punerea semnului nu e păzită de is_admin_user()';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'lectii_bac'
                   and policyname = 'lectii_bac_scoate' and cmd = 'DELETE'
                   and qual like '%is_admin_user()%') then
    raise exception '0103: scoaterea semnului nu e păzită de is_admin_user()';
  end if;

  -- Nimeni nu are voie să schimbe un rând: semnul se pune ori se scoate.
  if has_table_privilege('authenticated', 'public.lectii_bac', 'UPDATE')
     or has_table_privilege('anon', 'public.lectii_bac', 'INSERT')
     or has_table_privilege('anon', 'public.lectii_bac', 'DELETE') then
    raise exception '0103: lectii_bac dă prea multe drepturi pe tabel';
  end if;
end $$;

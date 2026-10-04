-- =========================================================
-- 0104 · FILE ÎN DOMENIU („Curente literare", „Opere")
--
-- Cererea lui Marius (4 octombrie 2026), la Literatură (liceu): „în cadrul
-- acestui domeniu vreau tabbed pentru organizarea lecțiilor: Curente literare,
-- Opere (posibil să mai vreau să adaug și alte categorii la tabbed). Dacă
-- etichetez o lecție cu curente literare, aceasta să apară la acel tab.
-- Atenție: etichetarea nu creează chip lângă titlul lecțiilor".
--
-- Hotărârile lui:
--   · prima filă e „Toate" și nu stă aici: e toată lista, deci n-are ce ține
--     minte; o lecție neetichetată se vede tot acolo;
--   · o lecție poate sta în oricâte file;
--   · filele și etichetele le schimbă din pagină, ca admin, fără push.
--
-- Două tabele: `lectii_file` (filele unui domeniu, cu nume și ordine) și
-- `lectii_etichete` (ce lecție stă în ce filă, după slug-ul ei stabil, ca la
-- 0103). O filă ștearsă își ia cu ea etichetele; lecțiile rămân.
--
-- Se poate rula de mai multe ori.
-- =========================================================

create table if not exists public.lectii_file (
  id        uuid primary key default gen_random_uuid(),
  domeniu   text not null check (char_length(btrim(domeniu)) between 1 and 60),
  nume      text not null check (char_length(btrim(nume)) between 1 and 40),
  ordine    integer not null default 0,
  creat_la  timestamptz not null default now()
);

/* Două file cu același nume în același domeniu s-ar încurca la alegere. */
create unique index if not exists lectii_file_nume_unic
  on public.lectii_file (domeniu, lower(btrim(nume)));

create table if not exists public.lectii_etichete (
  fila_id  uuid not null references public.lectii_file (id) on delete cascade,
  slug     text not null check (char_length(btrim(slug)) between 1 and 120),
  pus_la   timestamptz not null default now(),
  primary key (fila_id, slug)
);

comment on table public.lectii_file is
  'Filele din panoul unui domeniu de lecții (0104). „Toate" nu e aici: e lista întreagă.';
comment on table public.lectii_etichete is
  'Ce lecție (după slug) stă în ce filă (0104). Nu se vede lângă titlu.';

alter table public.lectii_file enable row level security;
alter table public.lectii_etichete enable row level security;

-- Două porți, în ordine: întâi dreptul pe tabel, apoi regula pe rând.
revoke all on public.lectii_file, public.lectii_etichete from anon, authenticated;
grant select on public.lectii_file, public.lectii_etichete to anon, authenticated;
grant insert, update, delete on public.lectii_file to authenticated;
grant insert, delete on public.lectii_etichete to authenticated;

drop policy if exists lectii_file_citire on public.lectii_file;
create policy lectii_file_citire on public.lectii_file
  for select to anon, authenticated using (true);
drop policy if exists lectii_file_pune on public.lectii_file;
create policy lectii_file_pune on public.lectii_file
  for insert to authenticated with check (public.is_admin_user());
drop policy if exists lectii_file_schimba on public.lectii_file;
create policy lectii_file_schimba on public.lectii_file
  for update to authenticated using (public.is_admin_user()) with check (public.is_admin_user());
drop policy if exists lectii_file_sterge on public.lectii_file;
create policy lectii_file_sterge on public.lectii_file
  for delete to authenticated using (public.is_admin_user());

drop policy if exists lectii_etichete_citire on public.lectii_etichete;
create policy lectii_etichete_citire on public.lectii_etichete
  for select to anon, authenticated using (true);
drop policy if exists lectii_etichete_pune on public.lectii_etichete;
create policy lectii_etichete_pune on public.lectii_etichete
  for insert to authenticated with check (public.is_admin_user());
drop policy if exists lectii_etichete_scoate on public.lectii_etichete;
create policy lectii_etichete_scoate on public.lectii_etichete
  for delete to authenticated using (public.is_admin_user());

-- ---------- primele două file ----------
insert into public.lectii_file (domeniu, nume, ordine)
select 'literatura-liceu', v.nume, v.ordine
from (values ('Curente literare', 1), ('Opere', 2)) v(nume, ordine)
where not exists (
  select 1 from public.lectii_file f
  where f.domeniu = 'literatura-liceu' and lower(btrim(f.nume)) = lower(v.nume)
);

-- ---------- PAZA ----------
do $$
declare
  t text;
begin
  foreach t in array array['lectii_file', 'lectii_etichete'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception '0104: RLS nu e pornit pe %', t;
    end if;
    -- citirea e a tuturor, orice scriere e a adminului, pe fiecare parte a
    -- regulii (la schimbare: și pe rândul vechi, și pe cel nou)
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
                 and (cmd = 'ALL'
                   or (cmd = 'INSERT' and coalesce(with_check, '') not like '%is_admin_user()%')
                   or (cmd = 'DELETE' and coalesce(qual, '') not like '%is_admin_user()%')
                   or (cmd = 'UPDATE' and (coalesce(qual, '') not like '%is_admin_user()%'
                                        or coalesce(with_check, '') not like '%is_admin_user()%')))) then
      raise exception '0104: pe % e o regulă de scriere care nu cere admin', t;
    end if;
    if has_table_privilege('anon', 'public.' || t, 'INSERT')
       or has_table_privilege('anon', 'public.' || t, 'UPDATE')
       or has_table_privilege('anon', 'public.' || t, 'DELETE') then
      raise exception '0104: nelogații au drept de scriere pe %', t;
    end if;
  end loop;

  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'lectii_file') <> 4
     or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'lectii_etichete') <> 3 then
    raise exception '0104: numărul de reguli nu e cel așteptat (4 pe file, 3 pe etichete)';
  end if;

  -- o etichetă se pune ori se scoate, nu se schimbă
  if has_table_privilege('authenticated', 'public.lectii_etichete', 'UPDATE') then
    raise exception '0104: etichetele n-au voie să fie schimbate pe loc';
  end if;

  if (select count(*) from public.lectii_file
       where domeniu = 'literatura-liceu' and nume in ('Curente literare', 'Opere')) <> 2 then
    raise exception '0104: lipsesc filele de pornire de la Literatură (liceu)';
  end if;
end $$;

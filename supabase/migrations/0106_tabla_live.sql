-- =========================================================
-- 0106 · TABLA LIVE: ce scrie adminul pe tablă se vede pe loc la toți
--
-- Cererea lui Marius (5 octombrie 2026), la #LaTablă din „Redactare: de la 5
-- la 40 de enunțuri": „vreau ce scriu eu să apară live către toți userii".
--
-- Un rând = o tablă (după `slug`, de ex. `redactare-enunturi`). În `data` stă
-- tot ce e pe ea: treapta deschisă și enunțurile de pe fiecare treaptă. Rândul
-- se suprascrie la fiecare schimbare; nu se ține istoric. Rămâne scris până
-- apasă adminul „Golește", ca un elev intrat mai târziu să vadă ce e deja pe
-- tablă.
--
-- Citesc toți, și nelogați (tabla stă oricum în spatele porții de
-- prelansare). Scrie doar adminul. Schimbările pleacă spre pagini prin
-- Realtime (`postgres_changes`), care respectă regula de citire.
--
-- Se poate rula de mai multe ori.
-- =========================================================

create table if not exists public.tabla_live (
  slug           text primary key check (slug ~ '^[a-z0-9-]{3,60}$'),
  data           jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 200000),
  actualizat_la  timestamptz not null default now()
);

comment on table public.tabla_live is
  'Tablele #LaTablă scrise live de admin și văzute de toți (0106).';

alter table public.tabla_live enable row level security;

-- Două porți, în ordine: întâi dreptul pe tabel, apoi regula pe rând.
revoke all on public.tabla_live from anon, authenticated;
grant select on public.tabla_live to anon, authenticated;
grant insert, update, delete on public.tabla_live to authenticated;

drop policy if exists tabla_live_citire on public.tabla_live;
create policy tabla_live_citire on public.tabla_live
  for select to anon, authenticated
  using (true);

drop policy if exists tabla_live_pune on public.tabla_live;
create policy tabla_live_pune on public.tabla_live
  for insert to authenticated
  with check (public.is_admin_user());

drop policy if exists tabla_live_schimba on public.tabla_live;
create policy tabla_live_schimba on public.tabla_live
  for update to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists tabla_live_sterge on public.tabla_live;
create policy tabla_live_sterge on public.tabla_live
  for delete to authenticated
  using (public.is_admin_user());

-- Realtime: schimbările tabelului pleacă spre paginile deschise.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public'
                       and tablename = 'tabla_live') then
    alter publication supabase_realtime add table public.tabla_live;
  end if;
end $$;

-- ---------- PAZA ----------
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.tabla_live'::regclass) then
    raise exception '0106: RLS nu e pornit pe tabla_live';
  end if;

  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'tabla_live') <> 4 then
    raise exception '0106: tabla_live trebuie să aibă exact patru reguli';
  end if;

  -- Fiecare scriere cere admin, pe fiecare parte a regulii.
  if not exists (select 1 from pg_policies where tablename = 'tabla_live' and cmd = 'INSERT'
                   and with_check like '%is_admin_user()%') then
    raise exception '0106: scrierea pe tablă nu e păzită de is_admin_user()';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'tabla_live' and cmd = 'UPDATE'
                   and qual like '%is_admin_user()%' and with_check like '%is_admin_user()%') then
    raise exception '0106: schimbarea tablei nu e păzită de is_admin_user() pe ambele părți';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'tabla_live' and cmd = 'DELETE'
                   and qual like '%is_admin_user()%') then
    raise exception '0106: ștergerea tablei nu e păzită de is_admin_user()';
  end if;

  if has_table_privilege('anon', 'public.tabla_live', 'INSERT')
     or has_table_privilege('anon', 'public.tabla_live', 'UPDATE')
     or has_table_privilege('anon', 'public.tabla_live', 'DELETE') then
    raise exception '0106: vizitatorul nelogat are drept de scriere pe tabla_live';
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and tablename = 'tabla_live') then
    raise exception '0106: tabla_live nu e în Realtime';
  end if;
end $$;

-- =========================================================
-- 0113 · TABLA ALBĂ: un whiteboard pe clase, văzut live cu un cod
--
-- Cererea lui Marius (17 noiembrie 2026): o tablă generală, „efectiv ca un
-- whiteboard", la /tabla/. Profesorul scrie pe tabla smart din clasă, iar ce
-- scrie apare pe loc la cei care au pagina deschisă.
--
-- 1. FOLDERE PE CLASE. Fiecare clasă (12C, 11B …) are un cod de 4 caractere,
--    de forma `012c`. Cu el intră oricine nu e admin, logat sau nu, și vede
--    doar clasa aceea. Codul nu e o parolă tare (puține combinații), e o cheie
--    de clasă; o încercare greșită așteaptă o jumătate de secundă, ca să nu
--    se poată încerca toate la rând.
--
-- 2. LECȚII ȘI PAGINI. În fiecare clasă, lecții; fiecare lecție are paginile
--    ei de tablă și un material (o lecție HTML de-a profesorului ori o pagină
--    a sitului), arătat în fila „Material".
--
-- 3. NIMENI NU CITEȘTE DIRECT DIN TABELE, afară de admin. Vizitatorul primește
--    doar prin funcțiile de mai jos, care îi cer codul clasei.
--
-- 4. LIVE. Desenul în curs, pagina deschisă, derularea materialului pleacă pe
--    canalul Realtime `tabla-alba:<id-ul clasei>`, privat: ascultă oricine știe
--    id-ul (îl află doar dând codul bun), scrie numai profesorul. Ce rămâne
--    (paginile, starea) se scrie în tabele, ca un elev intrat mai târziu să
--    vadă tot ce e deja pe tablă.
--
-- Se poate rula de mai multe ori.
-- =========================================================

create table if not exists public.tabla_alba_clase (
  id             uuid primary key default gen_random_uuid(),
  nume           text not null check (char_length(btrim(nume)) between 1 and 40),
  cod            text not null unique check (cod ~ '^[0-9a-z]{4}$'),
  ordine         int not null default 0,
  -- unde e profesorul acum: lecția, fila, pagina, ce vede din planșă, cât a
  -- derulat materialul, dacă elevii îl urmează ori se plimbă singuri
  stare          jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(stare) = 'object' and pg_column_size(stare) <= 20000),
  creat_la       timestamptz not null default now(),
  actualizat_la  timestamptz not null default now()
);

create table if not exists public.tabla_alba_lectii (
  id             uuid primary key default gen_random_uuid(),
  clasa_id       uuid not null references public.tabla_alba_clase(id) on delete cascade,
  titlu          text not null check (char_length(btrim(titlu)) between 1 and 120),
  ordine         int not null default 0,
  -- { fel: 'fisier', nume } ori { fel: 'pagina', adresa: '/lectii/…' } ori {}
  material       jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(material) = 'object' and pg_column_size(material) <= 4000),
  material_html  text check (material_html is null or octet_length(material_html) <= 3000000),
  creat_la       timestamptz not null default now(),
  actualizat_la  timestamptz not null default now()
);
create index if not exists tabla_alba_lectii_clasa on public.tabla_alba_lectii (clasa_id, ordine);

create table if not exists public.tabla_alba_pagini (
  id             uuid primary key default gen_random_uuid(),
  lectie_id      uuid not null references public.tabla_alba_lectii(id) on delete cascade,
  ordine         int not null default 0,
  -- { rev, fundal, el: [ … ] }: elementele desenate, în ordinea lor
  desen          jsonb not null default '{"rev":0,"el":[]}'::jsonb
                 check (jsonb_typeof(desen) = 'object' and pg_column_size(desen) <= 6000000),
  actualizat_la  timestamptz not null default now()
);
create index if not exists tabla_alba_pagini_lectie on public.tabla_alba_pagini (lectie_id, ordine);

comment on table public.tabla_alba_clase is 'Tabla albă (/tabla/): clasele, fiecare cu codul ei de intrare și starea live (0113).';
comment on table public.tabla_alba_lectii is 'Tabla albă: lecțiile unei clase, cu materialul lor (0113).';
comment on table public.tabla_alba_pagini is 'Tabla albă: paginile desenate ale unei lecții (0113).';

-- ---------- regulile: totul e al adminului ----------
alter table public.tabla_alba_clase  enable row level security;
alter table public.tabla_alba_lectii enable row level security;
alter table public.tabla_alba_pagini enable row level security;

revoke all on public.tabla_alba_clase, public.tabla_alba_lectii, public.tabla_alba_pagini from anon, authenticated;
grant select, insert, update, delete on public.tabla_alba_clase, public.tabla_alba_lectii, public.tabla_alba_pagini to authenticated;

drop policy if exists tabla_alba_clase_admin on public.tabla_alba_clase;
create policy tabla_alba_clase_admin on public.tabla_alba_clase
  for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists tabla_alba_lectii_admin on public.tabla_alba_lectii;
create policy tabla_alba_lectii_admin on public.tabla_alba_lectii
  for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists tabla_alba_pagini_admin on public.tabla_alba_pagini;
create policy tabla_alba_pagini_admin on public.tabla_alba_pagini
  for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());

-- ---------- vizitatorul, cu codul clasei ----------
/* Clasa, starea ei și lista lecțiilor (fără materialul HTML, care e mare). */
create or replace function public.tabla_alba_intra(p_cod text)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  c public.tabla_alba_clase;
begin
  if p_cod is null or lower(btrim(p_cod)) !~ '^[0-9a-z]{4}$' then
    return null;
  end if;
  select * into c from public.tabla_alba_clase where cod = lower(btrim(p_cod));
  if not found then
    perform pg_sleep(0.5);
    return null;
  end if;
  return jsonb_build_object(
    'id', c.id, 'nume', c.nume, 'stare', c.stare,
    'lectii', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'titlu', l.titlu, 'ordine', l.ordine,
                          'material', l.material) order by l.ordine, l.creat_la)
                        from public.tabla_alba_lectii l where l.clasa_id = c.id), '[]'::jsonb));
end;
$$;

/* Paginile unei lecții din clasa cu codul dat. */
create or replace function public.tabla_alba_pagini_lectiei(p_cod text, p_lectie uuid)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'ordine', p.ordine, 'desen', p.desen)
                            order by p.ordine, p.actualizat_la), '[]'::jsonb)
  from public.tabla_alba_pagini p
  join public.tabla_alba_lectii l on l.id = p.lectie_id
  join public.tabla_alba_clase c on c.id = l.clasa_id
  where l.id = p_lectie and c.cod = lower(btrim(coalesce(p_cod, '')));
$$;

/* Materialul HTML al unei lecții din clasa cu codul dat. */
create or replace function public.tabla_alba_material(p_cod text, p_lectie uuid)
returns text
language sql stable security definer set search_path to 'public'
as $$
  select l.material_html
  from public.tabla_alba_lectii l
  join public.tabla_alba_clase c on c.id = l.clasa_id
  where l.id = p_lectie and c.cod = lower(btrim(coalesce(p_cod, '')));
$$;

/* Canalul live e bun dacă e al unei clase care există. Paza de pe
   `realtime.messages` o cheamă; vizitatorul n-ar putea citi el tabelul. */
create or replace function public.tabla_alba_canal_bun(p_topic text)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.tabla_alba_clase c where 'tabla-alba:' || c.id::text = p_topic);
$$;

revoke all on function public.tabla_alba_intra(text) from public;
revoke all on function public.tabla_alba_pagini_lectiei(text, uuid) from public;
revoke all on function public.tabla_alba_material(text, uuid) from public;
revoke all on function public.tabla_alba_canal_bun(text) from public;
grant execute on function public.tabla_alba_intra(text) to anon, authenticated;
grant execute on function public.tabla_alba_pagini_lectiei(text, uuid) to anon, authenticated;
grant execute on function public.tabla_alba_material(text, uuid) to anon, authenticated;
grant execute on function public.tabla_alba_canal_bun(text) to anon, authenticated;

-- ---------- canalul live ----------
drop policy if exists tabla_alba_citire on realtime.messages;
create policy tabla_alba_citire on realtime.messages
  for select to anon, authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'tabla-alba:%'
    and public.tabla_alba_canal_bun(realtime.topic())
  );

drop policy if exists tabla_alba_scriere on realtime.messages;
create policy tabla_alba_scriere on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'tabla-alba:%'
    and public.is_admin_user()
  );

-- ---------- PAZA ----------
do $$
declare t text;
begin
  foreach t in array array['tabla_alba_clase', 'tabla_alba_lectii', 'tabla_alba_pagini'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception '0113: % n-are RLS pornit', t;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
                 and (coalesce(qual, '') not like '%is_admin_user()%'
                      or coalesce(with_check, '') not like '%is_admin_user()%')) then
      raise exception '0113: % nu e păzit de is_admin_user()', t;
    end if;
    if has_table_privilege('anon', 'public.' || t, 'SELECT') then
      raise exception '0113: vizitatorul nelogat poate citi direct %', t;
    end if;
  end loop;

  if not exists (select 1 from pg_policies where schemaname = 'realtime' and tablename = 'messages'
                   and policyname = 'tabla_alba_scriere' and cmd = 'INSERT'
                   and with_check like '%is_admin_user()%') then
    raise exception '0113: pe canalul tablei albe nu scrie numai profesorul';
  end if;

  if not (select prosecdef from pg_proc where oid = 'public.tabla_alba_intra(text)'::regprocedure) then
    raise exception '0113: tabla_alba_intra trebuie să ruleze ca security definer';
  end if;
end $$;

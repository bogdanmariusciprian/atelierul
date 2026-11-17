-- =========================================================
-- 0117 · TABLA ALBĂ: IMPLICITELE PROFESORULUI, ÎN CONT
--
-- Cererea lui Marius (17 noiembrie 2026): „vreau să pot seta default
-- culorile, ca să nu le schimb mereu": culoarea cu care scrie și desenează,
-- grosimea, mărimea textului, fundalul (culoarea și liniile) cu care pornesc
-- paginile noi, distanța indentării la liste. Se țin în cont, ca să fie
-- aceleași pe laptop și pe tabla smart.
--
-- Un rând pe cont, doar al lui, doar adminul.
--
-- Se poate rula de mai multe ori.
-- =========================================================

create table if not exists public.tabla_alba_setari (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  setari         jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(setari) = 'object' and pg_column_size(setari) <= 8000),
  actualizat_la  timestamptz not null default now()
);

comment on table public.tabla_alba_setari is
  'Tabla albă: implicitele profesorului (culori, grosime, fundalul paginilor noi, indentarea) (0117).';

alter table public.tabla_alba_setari enable row level security;
revoke all on public.tabla_alba_setari from anon, authenticated;
grant select, insert, update, delete on public.tabla_alba_setari to authenticated;

drop policy if exists tabla_alba_setari_ale_mele on public.tabla_alba_setari;
create policy tabla_alba_setari_ale_mele on public.tabla_alba_setari
  for all to authenticated
  using (user_id = auth.uid() and public.is_admin_user())
  with check (user_id = auth.uid() and public.is_admin_user());

-- ---------- PAZA ----------
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.tabla_alba_setari'::regclass) then
    raise exception '0117: tabla_alba_setari n-are RLS pornit';
  end if;
  if has_table_privilege('anon', 'public.tabla_alba_setari', 'SELECT') then
    raise exception '0117: vizitatorul nelogat poate citi setările';
  end if;
end $$;

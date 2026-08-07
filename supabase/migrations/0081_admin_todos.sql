-- =========================================================
-- Migration 0081 – Notițele profesorului, legate de pagina unde le scrie.
--
-- LA CE FOLOSEȘTE. Un buton „TO-DO" în colțul din stânga jos, pe toate paginile,
-- numai pentru profesor. Notezi ce ai de făcut CHIAR ACOLO unde ți-ai dat seama:
-- „aici lipsește o pildă", „tabelul ăsta se citește greu". A doua zi, deschizi
-- pagina și nota te așteaptă în ea, nu într-un caiet de pe alt ecran.
--
-- NUMELE, după regula din 0062: domeniul → entitatea. Domeniul e „admin",
-- fiindcă asta e: o unealtă a administratorului, nu conținut de site. Nu intră
-- în `learn_`, `forum_` ori `tests_`, care sunt despre ce văd elevii.
--
-- CINE VEDE. NIMENI în afară de profesor, nici măcar la citire. E singurul tabel
-- din tot situl cu regula asta, și e o deosebire care contează: banca de material
-- e deschisă la citire (0079), fiindcă e material de lucru; aici sunt gândurile
-- lui de lucru, care n-au de ce ajunge sub ochii nimănui. De-aia nici nu există
-- politică pentru `anon`, iar `select` nu e dat rolului acela.
--
-- CE E `path`. Adresa paginii, cu tot cu partea de după „#": în panoul de
-- administrare toate uneltele stau pe aceeași cale și se deosebesc numai prin
-- ea, deci fără hash toate notițele s-ar îngrămădi la un loc.
--
-- `title` e numele paginii, prins în clipa scrierii. Se ține minte anume, chiar
-- dacă s-ar putea afla din adresă: peste un an, o pagină redenumită ar face
-- lista de notițe de necitit, iar o notă care nu se știe unde duce e o notă
-- pierdută.
--
-- Depinde de 0001 (profiles) și de 0003 (is_admin_user). Sigură la re-rulare.
-- =========================================================

create table if not exists public.admin_todos (
  id         uuid primary key default gen_random_uuid(),
  path       text not null,
  title      text not null default '',
  body       text not null,
  done       boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_todos enable row level security;

-- O singură politică, `for all`, fiindcă aici drepturile NU se despart: cine
-- poate citi poate și scrie, și e una și aceeași persoană. La banca de material
-- le-am despărțit tocmai fiindcă acolo citirea e largă și scrisul e strâmt.
drop policy if exists admin_todos_admin_all on public.admin_todos;
create policy admin_todos_admin_all on public.admin_todos for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update, delete on public.admin_todos to authenticated;

-- Cererea de fiecare zi: „ce am de făcut pe pagina asta".
create index if not exists admin_todos_path_idx on public.admin_todos (path, done, created_at desc);

create or replace function public.touch_admin_todo()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists admin_todos_touch on public.admin_todos;
create trigger admin_todos_touch
  before update on public.admin_todos
  for each row execute function public.touch_admin_todo();

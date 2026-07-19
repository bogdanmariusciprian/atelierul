-- =========================================================
-- Migration 0048 — Teste descărcabile (fișiere ținute pe Drive).
--
-- Linkurile stau în BAZĂ, nu în cod: profesorul adaugă un test din panoul de
-- admin, fără commit și fără să atingă repozitoriul. Lipește linkul de
-- partajare aşa cum i-l dă Drive; clientul extrage identificatorul și
-- construiește adresa de descărcare directă.
--
-- Vizibile pentru ORICINE, inclusiv vizitatorii nelogați: sunt subiecte
-- publice de examen. Scrierea rămâne doar la profesor.
--
-- ATENȚIE (operațional): fișierul trebuie partajat în Drive ca „oricine are
-- linkul", altfel butonul duce la ecranul de autentificare Google.
--
-- Depinde de 0001 (is_admin_user). Sigur la re-rulare.
-- =========================================================

create table if not exists public.test_downloads (
  id         uuid primary key default gen_random_uuid(),
  exam       text not null default 'admitere-drept', -- slugul categoriei
  year       integer,                                -- gruparea din pagină
  label      text not null,                          -- „Simulare", „Examen iulie"
  note       text,                                   -- „subiect și barem", opțional
  kind       text not null default 'PDF',            -- ce descarcă, pe scurt
  url        text not null,                          -- linkul Drive, ca atare
  sort       integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.test_downloads enable row level security;

drop policy if exists downloads_read on public.test_downloads;
create policy downloads_read on public.test_downloads for select
  using (active or public.is_admin_user());

drop policy if exists downloads_admin_write on public.test_downloads;
create policy downloads_admin_write on public.test_downloads for all
  using (public.is_admin_user()) with check (public.is_admin_user());

grant select on public.test_downloads to anon, authenticated;
grant insert, update, delete on public.test_downloads to authenticated;

create index if not exists test_downloads_exam_idx
  on public.test_downloads (exam, year desc, sort);

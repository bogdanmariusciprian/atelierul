-- =========================================================
-- MEMORIA PAGINII DE PREZENȚĂ, în cont, nu în browser.
--
-- Pagina /comunitate/prezenta/ își ținea totul în `localStorage`
-- (`prezenta-tabel-v3`): setările (simboluri, aspect, coloane, culori, vederi,
-- rapoarte) și datele profesorului (note, motivări, coloane proprii). Acum
-- același obiect stă și aici, ca să-l găsească de pe orice calculator.
--
-- Notele și motivările sunt legate de elevi (prin cheia numelui), deci au
-- aceeași pază ca prezența (0110): le citește și le scrie numai adminul.
-- Un singur rând: e un singur profesor.
-- Cuprins în română, nume în engleză.
-- =========================================================

create table public.prezenta_memorie (
  id          int primary key default 1 check (id = 1),
  memorie     jsonb       not null,
  actualizat  timestamptz not null default now()
);

alter table public.prezenta_memorie enable row level security;

create policy "prezenta memorie: adminul citeste"
  on public.prezenta_memorie for select
  to authenticated
  using (public.is_admin_user());

create policy "prezenta memorie: adminul scrie"
  on public.prezenta_memorie for insert
  to authenticated
  with check (public.is_admin_user());

create policy "prezenta memorie: adminul schimba"
  on public.prezenta_memorie for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

revoke all on public.prezenta_memorie from anon;
revoke delete, truncate on public.prezenta_memorie from authenticated;
grant select, insert, update on public.prezenta_memorie to authenticated;

-- =========================================================
-- PREZENȚA DE LA ORELE GOOGLE MEET (pagina /comunitate/prezenta/).
--
-- Tabelul Google (Apps Script, `SITE_SYNC`) trimite tot obiectul de prezență
-- funcției Edge `primeste-prezenta`, care îl pune aici, într-un singur rând.
--
-- SUNT NUME DE ELEVI, MULȚI MINORI. Le vede numai profesorul: singura regulă e
-- de citire, și numai pentru admin. Pentru `anon` și pentru ceilalți utilizatori
-- nu există nicio regulă, deci nu primesc nimic. Nicio regulă de scriere: scrie
-- doar funcția, cu `service_role`.
--
-- PAROLA FUNCȚIEI stă în `prezenta_cheie`, ca amprentă SHA-256, nu ca text.
-- Rândul se pune din afara repository-ului (e public): aici e doar tabelul gol.
-- Cuprins în română, nume în engleză.
-- =========================================================

create table public.prezenta_export (
  id          int primary key default 1 check (id = 1),
  date        jsonb       not null,
  actualizat  timestamptz not null default now()
);

alter table public.prezenta_export enable row level security;

create policy "prezenta: doar adminul citeste"
  on public.prezenta_export for select
  to authenticated
  using (public.is_admin_user());

revoke all on public.prezenta_export from anon;
revoke insert, update, delete, truncate on public.prezenta_export from authenticated;

create table public.prezenta_cheie (
  id    int primary key default 1 check (id = 1),
  hash  text not null
);

alter table public.prezenta_cheie enable row level security;
-- Nicio regulă: nici adminul nu o citește din browser. O citește doar funcția.
revoke all on public.prezenta_cheie from anon, authenticated;

-- Baza nu dă singură drepturi pe tabelele noi, nici lui `service_role`. Funcția
-- primește exact cât îi trebuie: citește amprenta, scrie rândul.
grant select on public.prezenta_cheie to service_role;
grant select, insert, update on public.prezenta_export to service_role;
grant select on public.prezenta_export to authenticated;

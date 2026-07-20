-- =========================================================
-- Migration 0051 — Semnul „sesiune rezolvată integral".
--
-- Profesorul marchează în panou un subiect a cărui sesiune a fost introdusă
-- în bancă până la capăt: toți itemii, cu explicații. Pe pagina de teste,
-- documentul primește o bifă, iar bifa duce direct în antrenamentul filtrat
-- pe sesiunea aceea.
--
-- De ce o coloană nouă și nu ceva dedus: „complet" e o judecată a
-- profesorului, nu un fapt care se poate număra. Un item poate exista fără
-- explicație, altul poate fi introdus pe jumătate. Numai el știe când e gata.
--
-- Important: e informația LUI, nu a Drive-ului, deci sincronizarea n-o atinge
-- (updateTestDownloads scrie doar label / year / kind / sort). Un fișier
-- redenumit își păstrează bifa.
--
-- Drepturile există deja din 0048: citește oricine, scrie doar profesorul.
-- Depinde de 0048. Sigur la re-rulare.
-- =========================================================

alter table public.test_downloads
  add column if not exists solved boolean not null default false;

comment on column public.test_downloads.solved is
  'Sesiunea e introdusă integral în banca de itemi, cu explicații. Pusă de profesor din panou.';

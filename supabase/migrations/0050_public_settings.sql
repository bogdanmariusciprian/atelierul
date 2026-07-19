-- =========================================================
-- Migration 0050 — Câteva setări devin publice, restul rămân ale profesorului.
--
-- De ce: pagina categoriei are un buton „Vezi toate testele pe Drive", care
-- duce în folderul de unde Google îți dă descărcarea în bloc (noi n-avem cum
-- să facem o arhivă în browser — Drive are). Ca să construiască linkul,
-- pagina trebuie să citească `drive_folder_<slug>` — dar 0049 închisese
-- ÎNTREG tabelul, fiindcă acolo stă și cheia API.
--
-- Soluția nu e „deschidem tabelul", ci un steag per rând plus o listă albă
-- de chei care AU VOIE să poarte steagul. Chiar dacă mâine cineva greșește
-- în client și cere `is_public` pe cheia API, baza refuză rândul.
--
-- Ce rămâne privat: drive_api_key (și orice cheie viitoare care nu e în
-- lista albă). Ce devine public: linkurile de folder — care oricum sunt
-- partajate cu „oricine are linkul", deci nu expun nimic nou.
--
-- Depinde de 0049. Sigur la re-rulare.
-- =========================================================

alter table public.app_settings
  add column if not exists is_public boolean not null default false;

-- Lista albă. Numele coloanei e `is_public`, nu `public`: „public" e deja
-- numele schemei în Postgres, iar coloanele care se cheamă ca un cuvânt al
-- limbajului cer ghilimele peste tot și încurcă pe oricine citește după tine.
alter table public.app_settings
  drop constraint if exists app_settings_only_safe_keys_public;
alter table public.app_settings
  add constraint app_settings_only_safe_keys_public check (
    not is_public
    or key like 'drive_folder_%'
    or key like 'public_%'
  );

-- Folderele deja salvate de profesor devin publice retroactiv, altfel butonul
-- n-ar apărea până când n-ar reintra în panou să le salveze din nou.
update public.app_settings
   set is_public = true
 where key like 'drive_folder_%';

-- Profesorul: tot tabelul, citire și scriere. (Politica din 0049, repetată aici
-- doar ca migrarea să fie completă dacă cineva o rulează pe o bază curată.)
drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings for all
  using (public.is_admin_user()) with check (public.is_admin_user());

-- Oricine, inclusiv vizitatorii nelogați: DOAR rândurile marcate publice.
drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read on public.app_settings for select
  using (is_public);

grant select on public.app_settings to anon;

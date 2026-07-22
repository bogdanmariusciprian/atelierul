-- =========================================================
-- Migration 0066 — CURĂȚENIE (fostă sămânță, retrasă).
--
-- Povestea: simularea din 10 mai 2026 exista DEJA în bancă, verificată
-- complet, sub sesiunea „Simulare" (încărcată de Marius mai demult). Azi,
-- PDF-ul ei a fost trimis din greșeală drept subiectul de iulie, iar prima
-- versiune a acestei migrări a inserat o dublură sub eticheta nouă
-- „Simulare mai - G1" (nepublicată, cu baremul de IULIE atașat greșit).
--
-- Versiunea de față face un singur lucru: șterge dublura. Originalul de sub
-- „Simulare" nu e atins. Subiectul real din iulie = migrarea 0067.
-- Sigură la re-rulare.
-- =========================================================

delete from public.tests_items
 where exam = 'admitere-drept' and year = 2026 and session = 'Simulare mai - G1';

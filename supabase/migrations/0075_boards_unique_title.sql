-- =========================================================
-- Migration 0075 – O tablă, un nume.
--
-- Fără regula asta, elevul putea salva de două ori la rând și rămânea cu două
-- table numite „28 iul 2026", una lângă alta în listă, fără să știe care e
-- care. Numele e singurul lucru după care le deosebește.
--
-- Unicitatea se cere PE ELEV ȘI PE LECȚIE, nu pe tot tabelul: doi elevi pot
-- avea fiecare „tema 1", și e firesc, iar același elev poate avea „tema 1" la
-- fonetică și „tema 1" la morfologie.
--
-- `lower(btrim(title))` fiindcă „Tema 1", „tema 1" și „tema 1 " sunt același
-- nume pentru un om. Dacă am compara textul brut, regula ar fi ușor de ocolit
-- din greșeală, cu un spațiu în plus la coadă.
--
-- Clientul verifică și el, ca elevul să afle înainte de a apăsa, dar adevărul
-- stă aici: două ferestre deschise în același timp ar putea păcăli verificarea
-- din browser, niciodată pe asta.
-- =========================================================

-- Dacă au apucat să intre duplicate, le lăsăm doar pe cele mai noi: indexul
-- unic n-ar putea fi creat peste ele.
delete from public.learn_lessons_boards a
using public.learn_lessons_boards b
where a.user_id = b.user_id
  and a.lesson_slug = b.lesson_slug
  and lower(btrim(a.title)) = lower(btrim(b.title))
  and a.updated_at < b.updated_at;

create unique index if not exists learn_lessons_boards_nume_unic
  on public.learn_lessons_boards (user_id, lesson_slug, lower(btrim(title)));

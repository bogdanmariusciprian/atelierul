-- =========================================================
-- Migration 0086: drepturile lipsă pe mesele adăugate de 0085.
--
-- CE S-A ÎNTÂMPLAT. În 0085 am scris politicile RLS („doar rândurile mele") și
-- am crezut că e de-ajuns. Nu e. În Postgres sunt DOUĂ porți, una după alta:
--
--   1. DREPTUL pe tabel (`grant select, insert…`): ai voie să te apropii?
--   2. POLITICA RLS: dintre rândurile de acolo, pe care le poți vedea sau scrie?
--
-- Politica fără drept e ca un paznic care sortează atent oamenii dintr-o sală în
-- care nu intră nimeni. Mesele vechi (`tests_sessions`) aveau drepturile puse
-- demult, de-aia jocul de la Drept salva; cele patru tabele noi s-au născut fără
-- ele, iar fiecare scriere a fost refuzată în tăcere.
--
-- SE VEDEA. `points_ledger` avea 94 de rânduri de la Câmpina (punctele se dau
-- printr-un RPC `security definer`, care trece pe lângă drepturile rolului),
-- dar `tests_levels`, `tests_badges` și `tests_progress` erau goale. Adică
-- elevul primea puncte pentru itemi, dar levelurile lui nu se țineau minte.
--
-- CE FACE. Dă drepturile care lipsesc. RLS rămâne singurul paznic al rândurilor,
-- deci nimeni nu capătă acces la ce nu-i al lui: `authenticated` poate scrie în
-- tabel, dar politica îl lasă doar pe rândul cu `user_id = auth.uid()`.
--
-- Sigur la re-rulare.
-- =========================================================

-- Lista examenelor: o citește oricine (nu ascunde nimic), o scrie doar
-- profesorul, iar pe acela îl alege politica, nu dreptul.
grant select on public.tests_exams to anon, authenticated;
grant insert, update, delete on public.tests_exams to authenticated;

-- Progresul de la Relaxed și levelurile de la Level-up: numai cine are cont.
-- Vizitatorul nu scrie nimic, deci `anon` nu primește nimic.
grant select, insert, update, delete on public.tests_progress to authenticated;
grant select, insert, update, delete on public.tests_levels to authenticated;

-- Insignele se pot CITI de oricine (ca să poată sta cândva pe profil ori în
-- clasament), dar se scriu doar de purtătorul lor - iar aceea e treaba politicii.
grant select on public.tests_badges to anon, authenticated;
grant insert, delete on public.tests_badges to authenticated;

-- Plasa pentru viitor: mesele care se vor naște de acum în `public` primesc
-- drepturile din start, ca să nu se mai repete tăcerea de azi. RLS rămâne
-- oricum poarta a doua, deci un tabel nou fără politici nu se deschide nimănui.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;

# Atelierul – Harta dependințelor de cod (cine depinde de cine)

> Notă privată, local-only (git-ignorată). Scop: să vezi „dintr-o privire" cum se
> leagă modulele JS între ele și de Supabase, ca să știi ce se sparge când atingi
> un fișier. Reconstruită din codul real (2026-07-23, migrări la zi 0001–0072).
>
> Surse conexe: `SUPABASE_SCHEMA.md` (schema + RPC-uri), `MEMORIE_SITE.md`
> (harta site-ului, Real/Mock, decizii). Fără build step → toate importurile sunt
> module ES native cu căi relative; `supabase-js@2` vine din CDN prin importmap.

## 0. Cum se citește
- „A ← B, C" = **A importă din B și C** (A depinde de ele).
- Straturile de jos NU știu de cele de sus. Dacă un modul de jos ajunge să
  importe unul de sus, e un miros de arhitectură (mută logica comună mai jos).

## 1. Straturile (de la temelie în sus)

**S0 – Infra (rădăcina).** Nu importă nimic din proiect (doar CDN/config).
- `config.js` → nimic. `supabase-client.js ← supabase-js@2, config`. `session.js ← supabase-client, config`.
- Tot ce vorbește cu baza trece prin `supabase-client` (clientul unic) + `session` (userul/rolul curent).

**S1 – Date & schelet + helperi puri.** Config/conținut STATIC și utilitare fără efecte.
- `format.js` (relTime, escape, etc.) → nimic. `store.js` → nimic. `toast.js`, `confirm.js`, `lessons-index.js`, `message-templates.js`, `avatars.js`, `mascot.js`, `domains.js`, `news-data.js`.
- **`community-data.js` – scheletul HIBRID:** `COMMUNITY_USERS` (30 seed) + `MY_PROFILE` (mock la pornire, suprascris de real) + `registerRealUser`/`userById` + helperi. **Încă importat foarte lat** (vezi §4) – e residual-mock-ul care ține tot.
- `forum-data.js ← community-data, format`. `discover-data.js ← community-data, forum-data, format, news-data`.

**S2 – Repos (Supabase).** Fiecare „repo" = un modul care citește/scrie un domeniu. Toate `← supabase-client, session` cel puțin.
- `forum-repo.js ← supabase-client, session, rich-text, community-data, forum-data` – **HUB-ul de date** (feed, membri, profiluri publice, mesaje, mark-correct, helper realtime generic).
- `exercises-repo ← …, format, forum-repo` · `groups-repo ← …, forum-repo` · `kudos-repo ← …, forum-repo` · `activity-repo ← …, forum-repo, notif` – **toate depind de forum-repo**.
- Autonome (doar infra): `challenges-repo`, `events-repo`, `notation-repo`, `notebook`, `presence`, `test-repo`, `planner-repo`, `dashboard-repo`, `messages ← store, community-data, message-templates`.

**S3 – Motoare & UI partajat.**
- `points-fx` → nimic de proiect. `notif ← forum-repo, session, format`. `xp-bar ← community-data, session, points-fx, notif`. `badges ← xp-bar, community-data, session`. `thread ← badges`. `exercise-form ← thread`. `rich-text`, `user-menu ← toast`, `mentions ← community-data`, `streak ← community-data, session, toast, format`, `moderation`, `messenger ← session, community-data, forum-repo, messages, xp-bar, moderation, toast, presence`.

**S4 – Orchestratori (paginile).** Importă mult, nu sunt importați de nimeni.
- `community.js` (**36 importuri** – hub-ul comunității). `site-chrome.js` (**18** – header/footer, pe FIECARE pagină). `comments.js` (**14** – comentarii pe lecție). `messenger.js` (8). `tests-game.js`, `test-category.js`, `fraza-walkthrough.js`, `lesson-progress.js`, `propose-exercise.js`, `lessons-hub.js`, `leaderboard.js`, `home.js`, `news-hub.js`, `tests-admin-grid.js`, `tests-hub.js`, `bonus.js`, `admin-dashboard.js`, `community-stats.js`, `landing-interactive.js`, `benefits.js`, `planner.js`.

## 2. Nodurile centrale (dacă le atingi, tremură mult)
1. **`supabase-client` + `session`** – sub tot. Nu se ating fără motiv serios.
2. **`forum-repo`** – importat direct de ~13 module (exercises/groups/kudos/activity-repo, notif, comments, tests-game, lesson-progress, lessons-hub, messenger, community, site-chrome) + indirect prin notif/xp-bar. Orice schimbare de semnătură aici propagă lat.
3. **`community-data`** – scheletul mock; importat de ~16 module. **De aici vine cuplarea reziduală cu mock-ul** (vezi §5). Nu se șterge – se GOLESC datele din el.
4. **`site-chrome`** – rulează pe fiecare pagină; trage points-fx, xp-bar, notif, forum-repo, exercises-repo, community-data, messenger, site-gate, presence, store → orice pagină încarcă indirect tot lanțul social.

## 3. Repo → tabel(e) → RPC-uri (client ↔ Supabase)
> Toate numele sunt cele NOI (post-0062). Clientul e curat: **zero `.from('nume_vechi')`**.

| Modul | Tabele (`.from`) | RPC-uri (`.rpc`) |
|---|---|---|
| forum-repo | forum_posts(+reactions/saved), forum_comments(+reactions), social_friendships, social_messages(+labels), social_notifications, profiles | get_my_profile, get_public_profile, send_free_message, contact_teacher, mark_comment_correct |
| exercises-repo | learn_exercises(+votes/solves) | exercises_visible, approve_exercise, reject_exercise, solve_exercise |
| challenges-repo | learn_challenges(+solves) | solve_challenge, get_challenge_answer, list_challenges_admin |
| kudos-repo | social_kudos | give_kudos |
| groups-repo | forum_groups(+members) | set_group_pin |
| events-repo | (planner_pupils/„acces") | – |
| activity-repo | forum_posts/comments, social_notifications | notify_mention |
| notation-repo | learn_notation_words | – |
| notebook | learn_notes | – |
| presence | profiles | touch_presence |
| test-repo | tests_items, tests_sessions, tests_downloads, tests_bonus_questions, tests_boosters | check_test_item, answer_test_item, admin_test_item(s), test_item_years, report_test_item, resolve_test_report, reveal_observation, answer_bonus_question, admin_bonus_questions, use_booster, admin_list_users |
| dashboard-repo | (agregate) | admin_dashboard_counts / _queues / _series / _members |
| planner-repo | planner_slots, planner_pupils, planner_availability, planner_vacations, planner_externals | set_swap_wanted, offer_swap, withdraw_swap, withdraw_swap_from_slot, accept_swap, my_swap_offers, my_outgoing_swaps, replace_availability_window, resize_availability_window |
| forum-repo (moderare) | forum_reports, forum_profanity_terms, social_blocks | – |
| lesson-progress | learn_lessons_progress, learn_lessons_favorites | complete_lesson |
| leaderboard/badges | profiles, points_ledger | – |

## 4. Realtime (abonamente client)
- **`forum-repo.js`** – helper generic `channel('rt:<table>...')` pe `INSERT`, folosit pentru `social_messages` + `social_notifications` (publicate în `supabase_realtime` din 0034) → clopoțel/mesaje live.
- **`planner-repo.js` `watchSlots(onChange)`** – `channel('planner_slots_live')` pe `event:'*'` la `planner_slots` (0053). De asta `offer_swap` „atinge" want_slot: tabela de oferte e admin-only, deci schimbul se propagă către elevul A prin update pe planner_slots.

## 5. Cuplări transversale & riscuri (de ținut minte)
- **community-data încă infuzat peste tot.** `forum-repo`, `xp-bar`, `badges`, `streak`, `mentions`, `messages`, `site-chrome`, `comments`, `lesson-progress`, `propose-exercise`, `messenger`, `community`, `community-stats`, `landing-interactive` îl importă. Cât timp trăiește `MY_PROFILE`/`COMMUNITY_USERS`, mock-ul rezidual (landing, @mențiuni-pe-text, câteva afișaje) rămâne. Migrarea = golirea datelor din el, nu ștergerea fișierului.
- **Lanț lung pe UI socială:** `thread ← badges ← xp-bar ← notif ← forum-repo`. Deschizi un simplu fir de comentarii și tragi indirect forum-repo. Fără ciclu (verificat), dar orice pagină cu `thread` încarcă tot lanțul.
- **Planificatorul e IZOLAT (curat).** `planner.js ← planner-repo, session, toast`; `planner-repo ← supabase-client, session`. NU importă community-data / forum-repo. E singura zonă complet decuplată de scheletul social → cel mai ușor de rescris fără efecte laterale.
- **Swap-ul depinde de migrări aplicate în lanț:** clientul (`fetchMyOutgoingSwaps → [{offerId,wantSlot,offerSlot}]`) cere **0071**; regula „un „!" per „?"" cere **0072**. Fără ele: „!"-urile nu se pot marca corect / se pot trimite oferte duble. Cele trei (0070→0072) merg împreună.
- **Nume vechi rămase în DB (cosmetice):** funcția-gardă `tutoring_within_hours` și constrângerea `tutoring_slots_no_overlap` încă poartă prefixul `tutoring_` pe tabela `planner_slots` (0062 a redenumit doar tabela). Inofensiv, dar poate deruta la o interogare viitoare.
- **`planner_pupils.planner_recurring` = coloană moartă** (0058). Ritmul global a fost scos din UI; nu o citi ca sursă de adevăr – recurența trăiește pe 🔁 de pe bloc (recurrence_id).

## 6. Dependințe client → migrare (ce se sparge dacă o migrare NU e aplicată)
- Sintaxa frazei „+" (cuvinte notație) → **0026**.
- Mini-game teste (tipuri/puncte/poartă) → **0031/0032/0033**; observația înainte de răspuns → **0044/0045**.
- Salvarea preferințelor pe elev în planner → **0063** (fără el: 42501).
- Deschiderea/redimensionarea ferestrelor fără a goli tabela → **0064**.
- Cota săptămânală vizibilă/impusă → **0065**.
- Elevi externi în planner → **0068/0069**.
- Schimb de sloturi complet → **0070 + 0071 + 0072** (lanț).

## 7. Puncte de intrare (ce pagină încarcă ce orchestrator)
- Fiecare pagină → `site-chrome` (header/footer + hidratare identitate reală).
- `comunitate/` → `community.js`. `meditatii/` → `planner.js` (izolat).
- Lecții (`lectii/…`) → `lesson-engine` + `lesson-progress` + `comments` (+ `fraza-walkthrough` pe Sintaxa frazei).
- `teste/` + categorii → `tests-hub` / `test-category` (→ `tests-game` elev / `tests-admin-grid` admin, prin `test-repo`).
- Homepage → `home`, `leaderboard`, `news-hub`.

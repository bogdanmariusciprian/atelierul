// =========================================================
// Test items — REAL data (Supabase `test_items`). Teste -> Admitere Drept.
//   * Users AND guests fetch VERIFIED items only (enforced by RLS). The
//     `correct` answer is NEVER selected here (the column's SELECT is revoked in
//     0027), so the answer key doesn't ship to the browser.
//   * After a pupil submits a choice, checkTestItem() asks the SERVER whether it
//     was right and reveals the correct letter + observation for THAT one item
//     (cheat-safe, like the daily challenge).
//   * The teacher manages items (incl. unverified + answers) via
//     adminFetchTestItems and edits/verifies through RLS-gated updates.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER } from "./session.js";

/** Topic tags an item can carry (edited by the teacher, shown on the quiz card
 *  and used to filter the mini-game). Shared by the admin grid + the game. */
export const TEST_ITEM_TYPES = [
  { code: "SF", label: "Sintaxa frazei" },
  { code: "MS", label: "Morfo-sintaxă" },
  { code: "M", label: "Morfologie" },
  { code: "MIV", label: "Îmbogățirea vocabularului" },
  { code: "DEX", label: "Sensurile cuvintelor" },
  { code: "DOOM", label: "Forma cuvintelor" },
  { code: "G", label: "Greșeli" },
  { code: "F", label: "Fonetică" },
];

// Everything EXCEPT `correct` (that column is locked for anon/authenticated).
// NOTE: `observation` is deliberately absent — like `correct`, its SELECT is
// revoked (migration 0044), so the explanation can't be read before answering.
// It arrives with the server's verdict, or through the „peek" booster.
const PUBLIC_COLS =
  "id, exam, year, session, item_no, question, option_a, option_b, option_c, option_d, verified, types";

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    exam: r.exam,
    year: r.year,
    session: r.session || "",
    itemNo: r.item_no,
    question: r.question || "",
    options: { A: r.option_a, B: r.option_b, C: r.option_c, D: r.option_d },
    observation: r.observation || "",
    // answers present ONLY for the admin fetch (admin_test_items); null for the public one.
    correct: r.correct || null,
    correct2026: r.correct_2026 || null,
    verified: !!r.verified,   // teacher QA marker
    published: !!r.published, // visible to pupils
    flagged: !!r.flagged,
    types: Array.isArray(r.types) ? r.types : [], // topic tags (SF, MS, M, …)
  };
}

/** Verified items for a category (optionally a single year). Guests + members. */
export async function fetchTestItems({ exam = "admitere-drept", year = null } = {}) {
  let q = supabase.from("tests_items").select(PUBLIC_COLS).eq("exam", exam);
  if (year != null) q = q.eq("year", year);
  const { data, error } = await q.order("session").order("item_no");
  if (error) {
    console.warn("fetchTestItems:", error.message);
    return [];
  }
  return (data || []).map(mapRow);
}

/** Flag a content error on an item. Works for GUESTS too: the insert happens
 *  inside a security-definer RPC, so `anon` never gets write access to the
 *  reports table. `chosen` is the letter the pupil had picked, if any. */
export async function reportTestItem(itemId, reason, chosen = null) {
  const { error } = await supabase.rpc("report_test_item", {
    p_item: itemId, p_reason: reason, p_chosen: chosen,
  });
  if (error) { console.warn("reportTestItem:", error.message); return false; }
  return true;
}

/** The FULL row (answer key included) behind a report — teacher only. */
export async function adminFetchTestItem(id) {
  if (!id) return null;
  const { data, error } = await supabase.rpc("admin_test_item", { p_id: id });
  if (error) { console.warn("adminFetchTestItem:", error.message); return null; }
  return mapRow((data || [])[0]);
}

/** Re-read ONE item's public text (question + options; the explanation is
 *  revoked and never travels with the item) — used by the
 *  little refresh button so a teacher's wording fix reaches a pupil mid-game
 *  without disturbing the answer they already picked. Never returns the key. */
export async function fetchTestItem(id) {
  if (!id) return null;
  const { data, error } = await supabase.from("tests_items").select(PUBLIC_COLS).eq("id", id).single();
  if (error) { console.warn("fetchTestItem:", error.message); return null; }
  return mapRow(data);
}

/** Years available with counts (verified-only for pupils, all for admin). */
export async function fetchTestYears(exam = "admitere-drept") {
  const { data, error } = await supabase.rpc("test_item_years", { p_exam: exam });
  if (error) {
    console.warn("fetchTestYears:", error.message);
    return [];
  }
  return (data || []).map((r) => ({ year: r.year, n: Number(r.n) }));
}

/** Submit a choice for ONE item — the SERVER decides and reveals the answer.
 *  Returns { correct, correctAnswer, observation } or null on error. */
export async function checkTestItem(id, answer) {
  const { data, error } = await supabase.rpc("check_test_item", { p_id: id, p_answer: answer });
  if (error) {
    console.warn("checkTestItem:", error.message);
    return null;
  }
  if (!data || data.error) return null;
  return {
    correct: !!data.correct,
    correctAnswer: data.correct_answer,
    // set only when the 2026 answer differs from the historical one
    historical: data.historical || null,
    observation: data.observation || "",
  };
}

/** Submit an answer IN A MINI-GAME — the SERVER checks, reveals, and awards a
 *  few points once per (user, item, session). Cheat-safe (answer key never
 *  ships). Returns { correct, correctAnswer, historical, observation, awarded,
 *  points } or null on error. */
export async function answerTestItem(id, answer, sessionId) {
  const { data, error } = await supabase.rpc("answer_test_item", {
    p_id: id, p_answer: answer, p_session: sessionId || null,
  });
  if (error) { console.warn("answerTestItem:", error.message); return null; }
  if (!data || data.error) return null;
  return {
    correct: !!data.correct,
    correctAnswer: data.correct_answer,
    historical: data.historical || null,
    observation: data.observation || "",
    awarded: !!data.awarded,
    points: data.points || 0,
  };
}

// ---- Admin (RLS-gated writes; the UI shows these only to the teacher) ----

/** Full rows incl. answers + unverified items, for the manager (one year or all). */
export async function adminFetchTestItems(exam = "admitere-drept", year = null) {
  const { data, error } = await supabase.rpc("admin_test_items", { p_exam: exam, p_year: year });
  if (error) {
    console.warn("adminFetchTestItems:", error.message);
    return [];
  }
  return (data || []).map(mapRow);
}

/** Publish / unpublish (verify) an item so pupils can see it. */
export async function setTestVerified(id, on) {
  const { error } = await supabase.from("tests_items").update({ verified: !!on }).eq("id", id);
  if (error) {
    console.warn("setTestVerified:", error.message);
    return false;
  }
  return true;
}

/** Publish / unpublish — controls whether pupils can see the item. */
export async function setTestPublished(id, on) {
  const { error } = await supabase.from("tests_items").update({ published: !!on }).eq("id", id);
  if (error) {
    console.warn("setTestPublished:", error.message);
    return false;
  }
  return true;
}

/** Toggle the teacher's private marker (own tracking; not shown to pupils). */
export async function setTestFlagged(id, on) {
  const { error } = await supabase.from("tests_items").update({ flagged: !!on }).eq("id", id);
  if (error) {
    console.warn("setTestFlagged:", error.message);
    return false;
  }
  return true;
}

/** Edit an item (observation is the common case; others allowed for fixes). */
export async function updateTestItem(id, patch) {
  const allowed = {};
  for (const k of ["question", "option_a", "option_b", "option_c", "option_d",
                   "correct", "correct_2026", "observation", "verified", "published", "flagged",
                   "year", "session", "item_no", "types"]) {
    if (k in patch) allowed[k] = patch[k];
  }
  const { error } = await supabase.from("tests_items").update(allowed).eq("id", id);
  if (error) {
    console.warn("updateTestItem:", error.message);
    return false;
  }
  return true;
}

// ---- Saved training sessions (members only; RLS keeps them private) ----
// The queue holds ONLY item ids, so resuming never leaks an answer key.

/** My saved sessions for this exam, most recently played first. */
export async function fetchMyTestSessions(exam = "admitere-drept") {
  if (!CURRENT_USER.authId) return [];
  const { data, error } = await supabase
    .from("tests_sessions")
    .select("id, emoji, label, config, queue, stats, updated_at")
    .eq("exam", exam)
    .order("updated_at", { ascending: false });
  if (error) { console.warn("fetchMyTestSessions:", error.message); return []; }
  return (data || []).map((r) => ({
    id: r.id,
    emoji: r.emoji || "⚖️",
    label: r.label || "",
    config: r.config || {},
    queue: Array.isArray(r.queue) ? r.queue : [],
    stats: r.stats || {},
    updatedAt: new Date(r.updated_at).getTime(),
  }));
}

/** Create or update a session. Returns its id (progress autosaves as you play). */
export async function saveTestSession({ id, exam = "admitere-drept", emoji, label, config, queue, stats } = {}) {
  if (!CURRENT_USER.authId) return null;
  const row = {
    user_id: CURRENT_USER.authId,
    exam,
    emoji: emoji || "⚖️",
    label: label || null,
    config: config || {},
    queue: queue || [],
    stats: stats || {},
    updated_at: new Date().toISOString(),
  };
  if (id) row.id = id;
  const { data, error } = await supabase.from("tests_sessions").upsert(row).select("id").single();
  if (error) { console.warn("saveTestSession:", error.message); return null; }
  return data?.id || null;
}

/** Drop a session (finished, or the pupil deleted it). */
export async function deleteTestSession(id) {
  if (!id || !CURRENT_USER.authId) return;
  const { error } = await supabase.from("tests_sessions").delete().eq("id", id);
  if (error) console.warn("deleteTestSession:", error.message);
}

// ---- Progresul elevului, ținut pe CONT (migrarea 0085) ----
//
// Trei tabele, toate cu RLS „doar rândurile mele": ce a bifat și ce și-a scris la
// Relaxed (`tests_progress`), levelurile încercate și trecute la Crazy
// (`tests_levels`), insignele (`tests_badges`).
//
// EXAMENUL E MEREU CERUT, fără implicit. Restul fișierului poartă încă
// `= "admitere-drept"` din vremea când exista un singur examen, iar acela e
// tocmai felul de greșeală tăcută pe care 0085 a venit s-o închidă: un argument
// uitat scria în sertarul altcuiva. Aici nu se mai poate: dacă nu spui examenul,
// funcția nu face nimic și se plânge în consolă.
//
// Vizitatorul (fără cont) primește listă goală și scrierile trec pe lângă. Jocul
// merge mai departe din memoria paginii; nu-l oprim, doar nu-i ținem minte nimic.

function requireExam(unde, exam) {
  if (exam) return true;
  console.warn(`${unde}: examenul lipsește. Nu scriu nimic, ca să nu nimeresc alt sertar.`);
  return false;
}

/** Tot ce a lucrat elevul la un examen: bifa, verdictul, explicația lui. */
export async function fetchMyProgress(exam) {
  if (!CURRENT_USER.authId || !requireExam("fetchMyProgress", exam)) return [];
  const { data, error } = await supabase
    .from("tests_progress")
    .select("item_id, chosen, correct, answer_key, observation, note")
    .eq("exam", exam);
  if (error) { console.warn("fetchMyProgress:", error.message); return []; }
  return (data || []).map((r) => ({
    itemId: r.item_id,
    chosen: r.chosen || null,
    correct: !!r.correct,
    answerKey: r.answer_key || null,
    observation: r.observation || "",
    note: r.note || "",
  }));
}

/** Un item lucrat. `note` lipsă înseamnă „n-o atinge", ca salvarea răspunsului
 *  să nu șteargă explicația scrisă mai devreme. */
export async function saveMyProgress({ exam, itemId, chosen, correct, answerKey, observation, note } = {}) {
  if (!CURRENT_USER.authId || !requireExam("saveMyProgress", exam) || !itemId) return false;
  const rand = {
    user_id: CURRENT_USER.authId, item_id: itemId, exam,
    chosen: chosen || null,
    correct: typeof correct === "boolean" ? correct : null,
    answer_key: answerKey || null,
    observation: observation || null,
  };
  if (note !== undefined) rand.note = note || null;
  const { error } = await supabase.from("tests_progress").upsert(rand, { onConflict: "user_id,item_id" });
  if (error) { console.warn("saveMyProgress:", error.message); return false; }
  return true;
}

/** Curăță o sesiune de subiect: ștergerea e pe itemii daţi, nu pe tot examenul. */
export async function clearMyProgress(itemIds = []) {
  if (!CURRENT_USER.authId || !itemIds.length) return false;
  const { error } = await supabase.from("tests_progress").delete().in("item_id", itemIds);
  if (error) { console.warn("clearMyProgress:", error.message); return false; }
  return true;
}

/** Levelurile atinse la Crazy. `passedAt` gol = încercat, nu trecut. */
export async function fetchMyLevels(exam) {
  if (!CURRENT_USER.authId || !requireExam("fetchMyLevels", exam)) return [];
  const { data, error } = await supabase
    .from("tests_levels").select("level, tries, passed_at").eq("exam", exam);
  if (error) { console.warn("fetchMyLevels:", error.message); return []; }
  return (data || []).map((r) => ({ level: r.level, tries: r.tries || 1, passed: !!r.passed_at }));
}

/** Scrie un level. `tries` se socotește în client din lista adusă la pornire:
 *  o singură persoană joacă un cont, deci n-are cu cine se bate pe rând. */
export async function saveMyLevel({ exam, level, tries, passed } = {}) {
  if (!CURRENT_USER.authId || !requireExam("saveMyLevel", exam) || !level) return false;
  const { error } = await supabase.from("tests_levels").upsert({
    user_id: CURRENT_USER.authId, exam, level,
    tries: Math.max(1, tries || 1),
    passed_at: passed ? new Date().toISOString() : null,
  }, { onConflict: "user_id,exam,level" });
  if (error) { console.warn("saveMyLevel:", error.message); return false; }
  return true;
}

/** Șterge levelurile dintr-un interval: capitolul o ia de la capăt.
 *  Numai ale mele; RLS n-ar lăsa oricum altceva. */
export async function clearMyLevels({ exam, firstLevel, lastLevel } = {}) {
  if (!CURRENT_USER.authId || !requireExam("clearMyLevels", exam)) return false;
  const { error } = await supabase.from("tests_levels").delete()
    .eq("exam", exam).gte("level", firstLevel).lte("level", lastLevel);
  if (error) { console.warn("clearMyLevels:", error.message); return false; }
  return true;
}

/** Insignele mele la un examen. */
export async function fetchMyBadges(exam) {
  if (!CURRENT_USER.authId || !requireExam("fetchMyBadges", exam)) return [];
  const { data, error } = await supabase
    .from("tests_badges").select("code, earned_at").eq("exam", exam).eq("user_id", CURRENT_USER.authId);
  if (error) { console.warn("fetchMyBadges:", error.message); return []; }
  return (data || []).map((r) => ({ code: r.code, at: r.earned_at }));
}

/** Dă o insignă. A doua oară nu strică nimic: cheia primară o oprește, iar noi
 *  nu socotim asta eroare, fiindcă „o are deja" e chiar răspunsul dorit. */
export async function awardBadge(exam, code) {
  if (!CURRENT_USER.authId || !requireExam("awardBadge", exam) || !code) return false;
  const { error } = await supabase.from("tests_badges")
    .insert({ user_id: CURRENT_USER.authId, exam, code });
  if (error && error.code !== "23505") { console.warn("awardBadge:", error.message); return false; }
  return true;
}

// ---- Explicații propuse de elevii de la meditații (migrarea 0087) ----
//
// Elevul scrie în Relaxed, iar dacă profesorul l-a pornit, nota lui pleacă și ca
// PROPUNERE. Aprobată, textul trece în `tests_items.observation` și se vede la
// toți. Nota lui rămâne a lui, în `tests_progress`, neatinsă.
//
// Nimic din ce urmează nu ține loc de pază: cine poate propune, pe ce itemi și
// cine aprobă se hotărăsc în bază (politici + RPC-uri `security definer`). Aici
// se face doar ca elevul să nu vadă un câmp care oricum n-ar merge.

/** Are elevul de acum voie să propună? Întreabă baza, nu ghicește. */
export async function canPropose() {
  if (!CURRENT_USER.authId) return false;
  const { data, error } = await supabase
    .from("planner_pupils").select("can_propose").eq("user_id", CURRENT_USER.authId).maybeSingle();
  if (error) { console.warn("canPropose:", error.message); return false; }
  return !!(data && data.can_propose);
}

/** Trimite (ori rescrie) propunerea mea pentru un item. */
export async function proposeExplanation({ exam, itemId, text } = {}) {
  if (!CURRENT_USER.authId || !requireExam("proposeExplanation", exam) || !itemId) return false;
  const clean = String(text || "").trim();
  if (clean.length < 10) return false; // sub atât nu e o explicație, e un început
  const { error } = await supabase.from("tests_explanations").upsert({
    user_id: CURRENT_USER.authId, item_id: itemId, exam, text: clean, status: "in_asteptare",
  }, { onConflict: "user_id,item_id" });
  if (error) { console.warn("proposeExplanation:", error.message); return false; }
  return true;
}

/** Starea propunerilor mele la un examen: id item → „in_asteptare"/„aprobata"/… */
export async function myProposals(exam) {
  if (!CURRENT_USER.authId || !requireExam("myProposals", exam)) return {};
  const { data, error } = await supabase
    .from("tests_explanations").select("item_id, status").eq("exam", exam)
    .eq("user_id", CURRENT_USER.authId);
  if (error) { console.warn("myProposals:", error.message); return {}; }
  return Object.fromEntries((data || []).map((r) => [r.item_id, r.status]));
}

// ---- Partea profesorului ----

/* Numele elevului stă în `profiles`, nu în `planner_pupils`, deci trebuie adus
   printr-o legătură. Două lucruri de care depinde cererea asta, amândouă
   învățate pe pielea noastră:

   1. LEGĂTURA SE CERE PE NUMELE CONSTRÂNGERII. `planner_pupils` arată de două
      ori spre `profiles` (`user_id` și `granted_by`), iar o cerere care nu spune
      pe care o vrea e refuzată ca ambiguă.
   2. FĂRĂ SPAȚIU înainte de paranteză. Serverul citește tot ce e până la
      paranteză ca nume de legătură, iar un spațiu lipit la coadă îl face să nu
      mai recunoască nimic. Toate celelalte optsprezece cereri din sit sunt
      scrise lipit; a mea nu era, și numai ea nu mergea.

   Forma de mai jos e copiată după `fetchMarkedPupils` din `planner-repo.js`,
   care cere ACELAȘI lucru din ACELAȘI tabel și merge de luni de zile. Nu e
   împrumutată prin import: plannerul stă izolat dinadins, iar o funcție
   împărțită l-ar lega de teste. Se copiază forma, nu codul. */
const PROFILE_JOIN = "profiles!planner_pupils_user_id_fkey(display_name, username)";

/** Elevii de la meditații, cu starea comutatorului. Numai profesorul îi vede pe toți.
 *  ARUNCĂ dacă serverul refuză, ca cel care întreabă să poată spune de ce. */
export async function tutoringPupils() {
  const { data, error } = await supabase
    .from("planner_pupils")
    .select(`user_id, planner_name, can_propose, ${PROFILE_JOIN}`);
  /* Nu întorc o listă goală la eroare. „Goală" și „n-am putut întreba" arată la
     fel pe ecran, dar înseamnă lucruri opuse, iar prima dată chiar ne-a costat:
     panoul i-a spus lui Marius că n-are elevi la meditații, în timp ce în bază
     erau opt. Cine cheamă hotărăște ce scrie pe ecran. */
  if (error) throw new Error(error.message || "nu s-a putut citi lista de la meditații");
  return (data || []).map((r) => ({
    userId: r.user_id,
    name: (r.planner_name || "").trim()
      || (r.profiles?.display_name || "").trim() || r.profiles?.username || "elev",
    canPropose: !!r.can_propose,
  })).sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

/** Pornește ori oprește un elev. Baza verifică cine cere, nu noi. */
export async function setPupilCanPropose(userId, pornit) {
  const { error } = await supabase.from("planner_pupils")
    .update({ can_propose: !!pornit }).eq("user_id", userId);
  if (error) { console.warn("setPupilCanPropose:", error.message); return false; }
  return true;
}

/** Coada de aprobat: propunerea ÎMPREUNĂ cu itemul ei și cu numele elevului. */
export async function pendingExplanations() {
  const { data, error } = await supabase.rpc("admin_pending_explanations");
  if (error) { console.warn("pendingExplanations:", error.message); return []; }
  return (data || []).map((r) => ({
    id: r.id, text: r.text, pupil: r.pupil, at: r.created_at,
    item: {
      id: r.item_id, exam: r.exam, year: r.year, session: r.session || "", itemNo: r.item_no,
      question: r.question || "",
      options: { A: r.option_a, B: r.option_b, C: r.option_c, D: r.option_d },
      correct: r.correct || null,
    },
  }));
}

/** Aprobă, cu textul eventual îndreptat de profesor. */
export async function approveExplanation(id, text = null) {
  const { data, error } = await supabase.rpc("approve_explanation", { p_id: id, p_text: text });
  if (error) { console.warn("approveExplanation:", error.message); return { error: error.message }; }
  return data || {};
}

export async function rejectExplanation(id) {
  const { data, error } = await supabase.rpc("reject_explanation", { p_id: id });
  if (error) { console.warn("rejectExplanation:", error.message); return { error: error.message }; }
  return data || {};
}

// ---- Flying bonus questions + boosters (classic mode) ----
// The accepted answers and the booster odds live on the server; the wallet is
// keyed by game session, so a new run always starts empty.

/** Active prompts only — never the answers. */
export async function fetchBonusQuestions() {
  const { data, error } = await supabase
    .from("tests_bonus_questions").select("id, prompt").eq("active", true);
  if (error) { console.warn("fetchBonusQuestions:", error.message); return []; }
  return data || [];
}

/** Catch one. Correct → the server rolls a booster and banks it for you. */
export async function answerBonusQuestion(id, text, sessionId) {
  const { data, error } = await supabase.rpc("answer_bonus_question", {
    p_id: id, p_text: text, p_session: sessionId,
  });
  if (error) { console.warn("answerBonusQuestion:", error.message); return null; }
  return data;
}

/** Learning mode: read the explanation BEFORE answering. The server records
 *  it, and that item then earns no points — the trade is the whole point. */
export async function revealObservation(itemId, sessionId) {
  const { data, error } = await supabase.rpc("reveal_observation", {
    p_item: itemId, p_session: sessionId || null,
  });
  if (error) { console.warn("revealObservation:", error.message); return ""; }
  return data?.observation || "";
}

/** Spend one: `peek` returns the explanation, `cut1`/`cut2` the wrong letters. */
export async function useBooster(sessionId, kind, itemId = null) {
  const { data, error } = await supabase.rpc("use_booster", {
    p_session: sessionId, p_kind: kind, p_item: itemId,
  });
  if (error) { console.warn("useBooster:", error.message); return null; }
  return data;
}

/** What's left in this run's satchel → { cut1: 2, peek: 1, … }. */
export async function fetchBoosters(sessionId) {
  if (!sessionId || !CURRENT_USER.authId) return {};
  const { data, error } = await supabase
    .from("tests_boosters").select("kind, qty").eq("session_id", sessionId);
  if (error) { console.warn("fetchBoosters:", error.message); return {}; }
  return Object.fromEntries((data || []).filter((r) => r.qty > 0).map((r) => [r.kind, r.qty]));
}

// ---- Downloadable tests (files live on the teacher's Drive) ----

/** A Drive share link → a link that downloads the file straight away.
 *  Handles the formats Drive actually hands you:
 *    …/file/d/<ID>/view?usp=sharing · …/open?id=<ID> · …/uc?id=<ID>
 *  `drive.usercontent.google.com/download` is the endpoint that serves the
 *  bytes; the older `uc?export=download` now often answers with a confirmation
 *  page instead. Anything that isn't a Drive link passes through untouched, so
 *  a file hosted elsewhere still works. */
export function directDownloadUrl(raw) {
  const url = String(raw || "").trim();
  if (!url) return "";
  if (!/drive\.google\.com/i.test(url)) return url; // not Drive — leave it alone
  const id =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] || "";
  if (!id) return url;
  return `https://drive.usercontent.google.com/download?id=${id}&export=download`;
}

/** A Drive FOLDER link (or a bare id) → the folder id. */
export function driveFolderId(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1]
      || s.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1]
      || (/^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : "");
}

/** The file id inside a Drive link — used to spot files already added. */
export function driveFileId(raw) {
  const s = String(raw || "");
  return s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
      || s.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] || "";
}

/** Ask Drive what's inside a public folder. Teacher-only: the key never
 *  reaches a pupil's browser, and pupils don't need it — their download links
 *  are plain URLs. Returns { files } or { error }. */
export async function listDriveFolder(folderLinkOrId, apiKey) {
  const id = driveFolderId(folderLinkOrId);
  if (!id) return { error: "Linkul folderului nu pare valid." };
  if (!apiKey) return { error: "Lipsește cheia Drive (o pui mai sus)." };
  const q = encodeURIComponent(`'${id}' in parents and trashed = false`);
  const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,size,modifiedTime)");
  const out = [];
  let token = "";
  try {
    // Follow the pages. Without this, file 201 onwards would look „missing"
    // to the sync — and missing means deleted.
    for (let page = 0; page < 10; page++) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=200&orderBy=name&key=${apiKey}`
        + (token ? `&pageToken=${encodeURIComponent(token)}` : "")
      );
      const data = await res.json();
      if (!res.ok) return { error: data?.error?.message || `Drive a răspuns ${res.status}.` };
      out.push(...(data.files || []));
      token = data.nextPageToken || "";
      if (!token) break;
    }
    return { files: out.filter((f) => f.mimeType !== "application/vnd.google-apps.folder"), complete: !token };
  } catch {
    return { error: "N-am putut ajunge la Drive (rețea sau cheie blocată)." };
  }
}

// ---- Private settings (Drive key + folder ids), teacher-only ----
export async function fetchAppSettings() {
  const { data, error } = await supabase.from("app_settings").select("key, value");
  if (error) { console.warn("fetchAppSettings:", error.message); return {}; }
  return Object.fromEntries((data || []).map((r) => [r.key, r.value || ""]));
}
/** Saving decides visibility on its own, so no caller can forget it: folder
 *  links are public (the category page needs them), everything else — the API
 *  key above all — stays the teacher's. The DB enforces the same list in a
 *  CHECK constraint (migration 0050); this is only the polite half. */
export async function saveAppSetting(key, value) {
  const isPublic = /^(drive_folder_|public_)/.test(key);
  const { error } = await supabase.from("app_settings")
    .upsert({ key, value, is_public: isPublic, updated_at: new Date().toISOString() });
  if (error) { console.warn("saveAppSetting:", error.message); return false; }
  return true;
}

/** The Drive folder of one category, as a clean folder URL — or "" if the
 *  teacher hasn't set one. Readable by anyone, guests included.
 *  Rebuilt from the id rather than echoed as saved, so a link pasted with
 *  „?usp=sharing" and friends still opens the plain folder view. */
export async function fetchDriveFolderUrl(exam = "admitere-drept") {
  const { data, error } = await supabase.from("app_settings")
    .select("value").eq("key", `drive_folder_${exam}`).maybeSingle();
  if (error) { console.warn("fetchDriveFolderUrl:", error.message); return ""; }
  const id = driveFolderId(data?.value || "");
  return id ? `https://drive.google.com/drive/folders/${id}` : "";
}

/** Published files for one category, newest year first. Guests included. */
export async function fetchTestDownloads(exam = "admitere-drept") {
  const { data, error } = await supabase
    .from("tests_downloads")
    .select("id, year, label, note, kind, url, sort, active, solved")
    .eq("exam", exam).eq("active", true)
    .order("year", { ascending: false }).order("sort");
  if (error) { console.warn("fetchTestDownloads:", error.message); return []; }
  return (data || []).map((r) => ({ ...r, href: directDownloadUrl(r.url) }));
}

/** Admin: everything, including the ones switched off. `exam = null` → all. */
export async function adminFetchTestDownloads(exam = null) {
  let q = supabase.from("tests_downloads")
    .select("id, exam, year, label, note, kind, url, sort, active, solved");
  if (exam) q = q.eq("exam", exam);
  const { data, error } = await q
    .order("exam").order("year", { ascending: false }).order("sort");
  if (error) { console.warn("adminFetchTestDownloads:", error.message); return []; }
  return data || [];
}

export async function saveTestDownload(row) {
  const body = {
    exam: row.exam || "admitere-drept",
    year: row.year ? Number(row.year) : null,
    label: row.label, note: row.note || null,
    kind: row.kind || "PDF", url: row.url,
    sort: Number(row.sort) || 0, active: row.active !== false,
  };
  const { error } = row.id
    ? await supabase.from("tests_downloads").update(body).eq("id", row.id)
    : await supabase.from("tests_downloads").insert(body);
  if (error) { console.warn("saveTestDownload:", error.message); return false; }
  return true;
}

/** Add several at once — one round trip instead of one per file. */
export async function addTestDownloads(rows) {
  if (!rows?.length) return 0;
  const { error } = await supabase.from("tests_downloads").insert(rows);
  if (error) { console.warn("addTestDownloads:", error.message); return 0; }
  return rows.length;
}

/** Refresh the Drive-derived fields of rows we already have — for files that
 *  were renamed or that moved in the folder's alphabetical order. `note` and
 *  `active` are the teacher's own and never travel; `sort` does, because it
 *  isn't editable by hand anywhere — it only ever mirrors Drive.
 *  Returns how many rows actually changed. */
export async function updateTestDownloads(rows) {
  if (!rows?.length) return 0;
  const results = await Promise.all(rows.map(({ id, label, year, kind, sort }) =>
    supabase.from("tests_downloads").update({ label, year, kind, sort }).eq("id", id)
  ));
  const failed = results.filter((r) => r.error);
  if (failed.length) console.warn("updateTestDownloads:", failed[0].error.message);
  return rows.length - failed.length;
}

/** A Drive file name → the fields we can honestly guess from it.
 *  „Simulare_2025.pdf" → { label: "Simulare 2025", year: 2025, kind: "PDF" } */
export function guessFromFileName(name = "") {
  const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] || "pdf";
  // Underscores become spaces; HYPHENS STAY. „2024 - Iul - G1.pdf" is a
  // deliberate naming scheme, and flattening its dashes turned it into
  // „2024 Iul G1" — the label lost the structure the teacher put there.
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  return {
    label: base || "Fișier",
    year: (base.match(/(20\d{2})/) || [])[1] || null,
    kind: ext.toUpperCase(),
  };
}

/** Mark (or unmark) a paper as fully entered in the item bank. The teacher's
 *  own judgement, so the Drive sync never touches it. */
export async function setTestDownloadSolved(id, solved) {
  const { error } = await supabase.from("tests_downloads")
    .update({ solved: !!solved }).eq("id", id);
  if (error) { console.warn("setTestDownloadSolved:", error.message); return false; }
  return true;
}

export async function deleteTestDownload(id) {
  const { error } = await supabase.from("tests_downloads").delete().eq("id", id);
  if (error) console.warn("deleteTestDownload:", error.message);
}

/** Remove several at once (files that vanished from the Drive folder). */
export async function deleteTestDownloads(ids) {
  if (!ids?.length) return 0;
  const { error } = await supabase.from("tests_downloads").delete().in("id", ids);
  if (error) { console.warn("deleteTestDownloads:", error.message); return 0; }
  return ids.length;
}

// ---- Teacher: authoring the bonus questions ----
export async function adminFetchBonusQuestions() {
  const { data, error } = await supabase.rpc("admin_bonus_questions");
  if (error) { console.warn("adminFetchBonusQuestions:", error.message); return []; }
  return (data || []).map((r) => ({
    id: r.id, prompt: r.prompt || "", answers: r.answers || [], active: !!r.active,
  }));
}
export async function saveBonusQuestion({ id, prompt, answers, active }) {
  const row = { prompt, answers: answers || [], active: active !== false };
  const { error } = id
    ? await supabase.from("tests_bonus_questions").update(row).eq("id", id)
    : await supabase.from("tests_bonus_questions").insert(row);
  if (error) { console.warn("saveBonusQuestion:", error.message); return false; }
  return true;
}
export async function deleteBonusQuestion(id) {
  const { error } = await supabase.from("tests_bonus_questions").delete().eq("id", id);
  if (error) console.warn("deleteBonusQuestion:", error.message);
}

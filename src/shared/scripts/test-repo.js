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
const PUBLIC_COLS =
  "id, exam, year, session, item_no, question, option_a, option_b, option_c, option_d, observation, verified, types";

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
  let q = supabase.from("test_items").select(PUBLIC_COLS).eq("exam", exam);
  if (year != null) q = q.eq("year", year);
  const { data, error } = await q.order("session").order("item_no");
  if (error) {
    console.warn("fetchTestItems:", error.message);
    return [];
  }
  return (data || []).map(mapRow);
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
  const { error } = await supabase.from("test_items").update({ verified: !!on }).eq("id", id);
  if (error) {
    console.warn("setTestVerified:", error.message);
    return false;
  }
  return true;
}

/** Publish / unpublish — controls whether pupils can see the item. */
export async function setTestPublished(id, on) {
  const { error } = await supabase.from("test_items").update({ published: !!on }).eq("id", id);
  if (error) {
    console.warn("setTestPublished:", error.message);
    return false;
  }
  return true;
}

/** Toggle the teacher's private marker (own tracking; not shown to pupils). */
export async function setTestFlagged(id, on) {
  const { error } = await supabase.from("test_items").update({ flagged: !!on }).eq("id", id);
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
  const { error } = await supabase.from("test_items").update(allowed).eq("id", id);
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
    .from("test_sessions")
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
  const { data, error } = await supabase.from("test_sessions").upsert(row).select("id").single();
  if (error) { console.warn("saveTestSession:", error.message); return null; }
  return data?.id || null;
}

/** Drop a session (finished, or the pupil deleted it). */
export async function deleteTestSession(id) {
  if (!id || !CURRENT_USER.authId) return;
  const { error } = await supabase.from("test_sessions").delete().eq("id", id);
  if (error) console.warn("deleteTestSession:", error.message);
}

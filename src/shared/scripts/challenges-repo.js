// =========================================================
// Daily challenge — REAL data (Supabase `challenges` + `challenge_solves`).
//   • The teacher schedules challenges per date (admin-only writes, gated by
//     RLS). Today's challenge = the one whose active_date is today.
//   • A pupil answers ONCE via the solve_challenge RPC, which decides
//     correctness and awards points server-side (cheat-safe). See 0011.
// Row shape in the DB: { id, active_date, prompt, data:{options,explanation},
// correct:"<index>", reward }. Mapped here to the shape the UI already uses.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER } from "./session.js";

const todayISO = () => new Date().toISOString().slice(0, 10);

function mapRow(row) {
  if (!row) return null;
  const data = row.data || {};
  return {
    id: row.id,
    prompt: row.prompt || "",
    options: Array.isArray(data.options) ? data.options : [],
    // The ANSWER is hidden from the browser (0024: the `correct` column is
    // revoked). It's null for a pupil until they answer — then it arrives from
    // solve_challenge / get_challenge_answer. The teacher gets it via the
    // admin RPC below.
    correct: row.correct != null && row.correct !== "" ? Number(row.correct) : null,
    explanation: data.explanation || "",
    reward: row.reward ?? 15,
    date: row.active_date || null,
  };
}

/** Today's scheduled challenge, or null if the teacher hasn't set one.
 *  NOTE: deliberately does NOT select `correct` — the answer never reaches the
 *  browser before the pupil has used their one attempt. */
export async function fetchTodayChallenge() {
  const { data, error } = await supabase
    .from("challenges")
    .select("id, active_date, prompt, data, reward")
    .eq("active_date", todayISO())
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.warn("fetchTodayChallenge:", error.message);
    return null;
  }
  return mapRow((data || [])[0]);
}

/** The correct index — only AFTER you've answered (or if you're the teacher).
 *  Returns null when you're not allowed to see it yet. */
export async function fetchChallengeAnswer(challengeId) {
  if (!challengeId) return null;
  const { data, error } = await supabase.rpc("get_challenge_answer", { p_challenge: challengeId });
  if (error) {
    console.warn("fetchChallengeAnswer:", error.message);
    return null;
  }
  return data == null ? null : Number(data);
}

/** Whether the current user already answered a challenge (+ what they chose). */
export async function fetchMyChallengeSolve(challengeId) {
  if (!challengeId || !CURRENT_USER.authId) return null;
  const { data } = await supabase
    .from("challenge_solves")
    .select("choice, correct")
    .eq("challenge_id", challengeId)
    .eq("user_id", CURRENT_USER.authId)
    .maybeSingle();
  return data || null;
}

/** Solve today's challenge — the SERVER decides correctness and awards points.
 *  Returns { correct, awarded, choice, already } or null on error. */
export async function solveChallenge(challengeId, choice) {
  const { data, error } = await supabase.rpc("solve_challenge", {
    p_challenge: challengeId,
    p_choice: choice,
  });
  if (error) {
    console.warn("solveChallenge:", error.message);
    return null;
  }
  return data;
}

// ---------------------------------------------------------
// Admin scheduling (writes gated by RLS → admin only).
// ---------------------------------------------------------
/** The teacher's scheduling list — WITH the answers. Goes through an
 *  admin-only RPC because the `correct` column is revoked from direct SELECT. */
export async function listChallenges() {
  const { data, error } = await supabase.rpc("list_challenges_admin");
  if (error) {
    console.warn("listChallenges:", error.message);
    return [];
  }
  return (data || []).map(mapRow);
}

function toRow({ prompt, options, correct, explanation, date, reward }) {
  return {
    active_date: date || null,
    prompt,
    data: { options: options || [], explanation: explanation || "" },
    correct: String(correct ?? 0),
    reward: Math.max(5, Math.min(50, Number(reward) || 15)),
  };
}

export async function createChallenge(fields) {
  const { data, error } = await supabase
    .from("challenges")
    .insert({ ...toRow(fields), created_by: CURRENT_USER.authId })
    .select("id")
    .single();
  if (error) {
    console.warn("createChallenge:", error.message);
    return null;
  }
  return data;
}

export async function updateChallenge(id, fields) {
  const { error } = await supabase.from("challenges").update(toRow(fields)).eq("id", id);
  if (error) console.warn("updateChallenge:", error.message);
}

export async function deleteChallenge(id) {
  const { error } = await supabase.from("challenges").delete().eq("id", id);
  if (error) console.warn("deleteChallenge:", error.message);
}

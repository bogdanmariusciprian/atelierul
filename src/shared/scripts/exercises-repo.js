// =========================================================
// Proposed exercises — REAL data (Supabase `exercises` + `exercise_votes` +
// `exercise_solves`). Mirrors the shape the UI already used (exercises-data.js)
// so the hub + lesson pages barely change:
//   • a pupil PROPOSES an exercise tied to a lesson (RLS forces status
//     'pending'); the community up-votes it;
//   • the teacher APPROVES (awarding the author points, cheat-safe) / edits /
//     rejects — see the approve_exercise / reject_exercise RPCs (0018);
//   • an approved exercise is SOLVABLE on the lesson; solving awards points
//     via solve_exercise, which decides correctness SERVER-side.
// The teacher isn't in the game → proposing/solving earns him nothing.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER } from "./session.js";
import { surrogateForAuthor } from "./forum-repo.js";

// Exercise kinds mirror the lesson engine (data-type): choice, fill, match.
export const EXERCISE_KINDS = [
  { key: "choice", label: "Grilă", hint: "O întrebare cu variante de răspuns" },
  { key: "fill", label: "Completare", hint: "Un enunț cu spații de completat" },
  { key: "match", label: "Potrivire", hint: "Perechi de asociat" },
];
export function exerciseKind(key) {
  return EXERCISE_KINDS.find((k) => k.key === key) || EXERCISE_KINDS[0];
}

const relTime = (ts) => {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "acum";
  if (s < 3600) return `acum ${Math.floor(s / 60)} min`;
  if (s < 86400) return `acum ${Math.floor(s / 3600)} h`;
  return `acum ${Math.floor(s / 86400)} zile`;
};
const initialsOf = (name) =>
  (name || "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function mapRow(row, { myVote = false, voteCount = 0, mySolve = null } = {}) {
  const a = row.author || {};
  const admin = a.role === "admin";
  const name = admin ? "Profesor" : a.display_name || "Membru";
  return {
    id: row.id,
    lessonSlug: row.lesson_slug,
    lessonTitle: null, // resolved by the caller from its lessons map
    authorId: a.id ? surrogateForAuthor(a) : null,
    isTeacher: admin, // the author is the teacher (show 🎓, not a name link)
    name,
    initials: admin ? "🎓" : initialsOf(name),
    color: a.avatar_color || "#7c5cff",
    kind: row.kind,
    prompt: row.prompt,
    data: row.data || null,
    status: row.status,
    verified: !!row.verified,
    votes: voteCount,
    votedByMe: myVote,
    createdAt: new Date(row.created_at).getTime(),
    time: relTime(row.created_at),
    decidedAt: row.decided_at ? new Date(row.decided_at).getTime() : null,
    decidedTime: row.decided_at ? relTime(row.decided_at) : null,
    solvedByMe: !!mySolve,
    solvedCorrect: mySolve ? !!mySolve.correct : false,
  };
}

/** Attach vote counts + my-vote to a batch of exercise rows. */
async function withVotes(rows) {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return new Map();
  const { data } = await supabase.from("exercise_votes").select("exercise_id, user_id").in("exercise_id", ids);
  const counts = new Map();
  const mine = new Set();
  for (const v of data || []) {
    counts.set(v.exercise_id, (counts.get(v.exercise_id) || 0) + 1);
    if (v.user_id === CURRENT_USER.authId) mine.add(v.exercise_id);
  }
  return { counts, mine };
}

async function mySolves(ids) {
  const out = new Map();
  if (!ids.length || !CURRENT_USER.authId) return out;
  const { data } = await supabase
    .from("exercise_solves").select("exercise_id, correct")
    .eq("user_id", CURRENT_USER.authId).in("exercise_id", ids);
  for (const s of data || []) out.set(s.exercise_id, s);
  return out;
}

/** ALL reads go through exercises_visible (0025), never straight off the table:
 *  the SERVER decides what you may see AND strips the answer out of `data` for
 *  a pending proposal that isn't yours. Filtering/sorting happens here, on the
 *  already-redacted rows. */
async function query({ lesson = null, statuses = null, sort = "created" } = {}) {
  const { data, error } = await supabase.rpc("exercises_visible", { p_lesson: lesson });
  if (error) { console.warn("exercises_visible:", error.message); return []; }
  let rows = data || [];
  if (statuses) rows = rows.filter((r) => statuses.includes(r.status));
  rows.sort((a, b) =>
    sort === "decided"
      ? new Date(b.decided_at || 0) - new Date(a.decided_at || 0)
      : sort === "oldest"
        ? new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at)
  );
  const { counts = new Map(), mine = new Set() } = await withVotes(rows);
  const solves = await mySolves(rows.map((r) => r.id));
  return rows.map((r) => mapRow(r, { myVote: mine.has(r.id), voteCount: counts.get(r.id) || 0, mySolve: solves.get(r.id) }));
}

/** Pending proposals across all lessons — the admin queue + community voting. */
export function fetchPendingExercises() {
  return query({ statuses: ["pending"] });
}

/** Decided proposals (approved/rejected) — the admin's history, newest first. */
export function fetchExerciseHistory() {
  return query({ statuses: ["approved", "rejected"], sort: "decided" });
}

/** Approved (published) exercises for one lesson — SOLVABLE by pupils. */
export function fetchApprovedForLesson(slug) {
  return query({ lesson: slug, statuses: ["approved"], sort: "oldest" });
}

/** Pending proposals for one lesson — everyone sees them now (to vote), but the
 *  answer is redacted server-side unless it's yours (or you're the teacher). */
export function fetchPendingForLesson(slug) {
  return query({ lesson: slug, statuses: ["pending"] });
}

/** Propose an exercise (status is forced to 'pending' by RLS). */
export async function proposeExercise({ lessonSlug, kind, prompt, data }) {
  const { data: row, error } = await supabase
    .from("exercises")
    .insert({ lesson_slug: lessonSlug, author_id: CURRENT_USER.authId, kind, prompt, data, status: "pending" })
    .select("id").single();
  if (error) { console.warn("proposeExercise:", error.message); return null; }
  return row;
}

/** Toggle my up-vote on a proposal. */
export async function voteExercise(id, on) {
  if (on) {
    const { error } = await supabase.from("exercise_votes").insert({ exercise_id: id, user_id: CURRENT_USER.authId });
    if (error && error.code !== "23505") console.warn("voteExercise:", error.message); // ignore dup
  } else {
    const { error } = await supabase.from("exercise_votes").delete().eq("exercise_id", id).eq("user_id", CURRENT_USER.authId);
    if (error) console.warn("unvoteExercise:", error.message);
  }
}

/** Teacher: approve a proposal (+award the author, cheat-safe). */
export async function approveExercise(id, verified = true, reward = 20) {
  const { data, error } = await supabase.rpc("approve_exercise", { p_id: id, p_verified: verified, p_reward: reward });
  if (error) { console.warn("approveExercise:", error.message); return null; }
  return data;
}

/** Teacher: reject a proposal. */
export async function rejectExercise(id) {
  const { data, error } = await supabase.rpc("reject_exercise", { p_id: id });
  if (error) { console.warn("rejectExercise:", error.message); return null; }
  return data;
}

/** Teacher: delete a proposal outright (removes it from history too). */
export async function deleteExercise(id) {
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) console.warn("deleteExercise:", error.message);
}

/** How many proposals are pending (admin attention badge). */
export async function fetchPendingCount() {
  const { count } = await supabase.from("exercises").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count || 0;
}

/** How many proposals are pending for one lesson (per-lesson badge). */
export async function fetchPendingCountForLesson(slug) {
  const { count } = await supabase
    .from("exercises").select("id", { count: "exact", head: true })
    .eq("status", "pending").eq("lesson_slug", slug);
  return count || 0;
}

/** How many of MY proposals were approved (for the "creator" badge). */
export async function fetchMyApprovedExerciseCount() {
  if (!CURRENT_USER.authId) return 0;
  const { count } = await supabase
    .from("exercises").select("id", { count: "exact", head: true })
    .eq("author_id", CURRENT_USER.authId).eq("status", "approved");
  return count || 0;
}

/** Teacher: edit a proposal (prompt/data/kind) before or after approval. */
export async function updateExercise(id, fields) {
  const patch = {};
  if (fields.prompt != null) patch.prompt = fields.prompt;
  if (fields.data !== undefined) patch.data = fields.data;
  if (fields.kind) patch.kind = fields.kind;
  const { error } = await supabase.from("exercises").update(patch).eq("id", id);
  if (error) console.warn("updateExercise:", error.message);
}

/** Pupil: submit an answer — the SERVER decides correctness + awards points.
 *  `answer` = { choice:<index> } | { text:"…" } | { pairs:[[l,r],…] }.
 *  Returns { correct, awarded, already } or null. */
export async function solveExercise(id, answer) {
  const { data, error } = await supabase.rpc("solve_exercise", { p_id: id, p_answer: answer });
  if (error) { console.warn("solveExercise:", error.message); return null; }
  return data;
}

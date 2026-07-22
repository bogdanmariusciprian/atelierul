// =========================================================
// Notation words — REAL data (Supabase `notation_words`, migration 0026).
// The "Cercuri și pătrate" cards on the lesson „Sintaxa frazei – Introducere”
// start from hard-coded words (static by design); the "+" pill adds LIVE ones:
//   • a member PROPOSES a word (RLS forces status 'pending');
//   • the teacher APPROVES / REJECTS right on the lesson page;
//   • an approved word is visible to EVERYONE (members, guests, admin);
//   • the teacher's own additions are born approved.
// No points are involved → plain table ops under RLS (like `exercises`).
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER, isAdmin } from "./session.js";

/** Everything the CALLER may see (RLS decides): approved for everyone,
 *  plus my own pending/rejected, plus all of them for the teacher. */
export async function fetchNotationWords() {
  const { data, error } = await supabase
    .from("learn_notation_words")
    .select("id, kind, word, status, author_id, created_at")
    .neq("status", "rejected")
    .order("created_at");
  if (error) { console.warn("fetchNotationWords:", error.message); return []; }
  return (data || []).map((r) => ({
    id: r.id,
    kind: r.kind,
    word: r.word,
    status: r.status,
    mine: r.author_id === CURRENT_USER.authId,
  }));
}

/** Add a word: member → 'pending' (awaits the teacher), teacher → 'approved'
 *  immediately. Returns {ok} or {ok:false, duplicate?} — a friendly signal for
 *  the unique index (one live word per kind, case-insensitive). */
export async function addNotationWord(kind, word) {
  const row = { kind, word, author_id: CURRENT_USER.authId };
  if (isAdmin()) {
    row.status = "approved";
    row.decided_by = CURRENT_USER.authId;
    row.decided_at = new Date().toISOString();
  }
  const { error } = await supabase.from("learn_notation_words").insert(row);
  if (!error) return { ok: true };
  console.warn("addNotationWord:", error.message);
  return { ok: false, duplicate: error.code === "23505" };
}

/** The teacher decides: approve, or reject (also used to WITHDRAW an already
 *  approved word — it simply flips to 'rejected'). Enforced by RLS. */
export async function reviewNotationWord(id, approve) {
  const { error } = await supabase
    .from("learn_notation_words")
    .update({
      status: approve ? "approved" : "rejected",
      decided_by: CURRENT_USER.authId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) console.warn("reviewNotationWord:", error.message);
  return !error;
}

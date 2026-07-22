// =========================================================
// Kudos — REAL data (Supabase `kudos` + give_kudos RPC). Drop-in replacement
// for the old localStorage mock: SAME function names/signatures so the hub
// doesn't change. Reads are SYNC (served from an in-memory cache primed by
// loadKudos); writes are optimistic + persisted in the background through the
// RPC, which enforces "once a day per target, never the teacher, never
// yourself" server-side.
//   👏 clap — applaud any member once a day.
//   👉 poke — nudge the member right above you; a 🐌 then climbs your bar.
// Pure social signal — NO points.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER, isAdmin } from "./session.js";
import { uuidForSurrogate } from "./forum-repo.js";

const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// Caches keyed by profile UUID.
let _clapCounts = new Map(); // uuid -> total claps received
const _myClaps = new Set();  // uuids I applauded today
const _myPokes = new Set();  // uuids I poked today

/** Prime the caches: total claps per member + what I gave today. */
export async function loadKudos() {
  _clapCounts = new Map();
  _myClaps.clear();
  _myPokes.clear();
  // Totals (small community; counted client-side — swap for an aggregate view if it ever grows).
  const { data: claps } = await supabase.from("social_kudos").select("to_user").eq("kind", "clap");
  for (const r of claps || []) _clapCounts.set(r.to_user, (_clapCounts.get(r.to_user) || 0) + 1);
  // What I gave today (so the buttons lock correctly on reload).
  if (CURRENT_USER.authId) {
    const { data: mine } = await supabase
      .from("social_kudos").select("to_user, kind")
      .eq("from_user", CURRENT_USER.authId)
      .gte("created_at", todayStart().toISOString());
    for (const r of mine || []) (r.kind === "poke" ? _myPokes : _myClaps).add(r.to_user);
  }
}

/** Total applause a member shows (surrogate id in, like the mock). */
export function clapsFor(surrogate) {
  const uuid = uuidForSurrogate(surrogate);
  return uuid ? _clapCounts.get(uuid) || 0 : 0;
}
export function hasClapped(surrogate) {
  const uuid = uuidForSurrogate(surrogate);
  return uuid ? _myClaps.has(uuid) : false;
}
export function hasPoked(surrogate) {
  const uuid = uuidForSurrogate(surrogate);
  return uuid ? _myPokes.has(uuid) : false;
}

/** Applaud a member once a day. Optimistic + persisted; returns false if
 *  already done today / not allowed (keeps the mock's sync boolean contract). */
export function giveClap(surrogate) {
  const uuid = uuidForSurrogate(surrogate);
  if (!uuid || isAdmin() || uuid === CURRENT_USER.authId || _myClaps.has(uuid)) return false;
  _myClaps.add(uuid);
  _clapCounts.set(uuid, (_clapCounts.get(uuid) || 0) + 1);
  supabase.rpc("give_kudos", { p_to: uuid, p_kind: "clap" }).then(({ error }) => {
    if (error) console.warn("giveClap:", error.message);
  });
  return true;
}

/** Poke the member above you (once a day). */
export function givePoke(surrogate) {
  const uuid = uuidForSurrogate(surrogate);
  if (!uuid || isAdmin() || uuid === CURRENT_USER.authId || _myPokes.has(uuid)) return false;
  _myPokes.add(uuid);
  supabase.rpc("give_kudos", { p_to: uuid, p_kind: "poke" }).then(({ error }) => {
    if (error) console.warn("givePoke:", error.message);
  });
  return true;
}

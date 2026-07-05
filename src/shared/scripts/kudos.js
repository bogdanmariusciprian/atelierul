// =========================================================
// Kudos — the leaderboard's social layer (single source of truth, DRY):
//   👏 APLAUZE  — anyone logged-in can applaud any member once per day;
//                 counters make the top feel seen and validated.
//   👉 POKE     — once per day you may poke the member RIGHT ABOVE you in
//                 the ranking: "watch out, I'm catching up!". After a poke
//                 a little snail 🐌 starts climbing your progress bar.
//
// Mock persistence: your own claps/pokes live in localStorage (they
// survive reloads); received counters are seeded deterministically per
// user. Real versions move to Supabase later.
// =========================================================
import { userById } from "./community-data.js";

const KEY = "atelier_kudos"; // { claps:{id:date}, pokes:{id:date} }

const today = () => new Date().toISOString().slice(0, 10);

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode — session-only then */
  }
}

// In-memory deltas (claps I gave this session/day are +1 on the counter).
const given = { claps: new Set() };

/** Seeded baseline so counters look alive; deterministic per user. */
function baseClaps(id) {
  const u = userById(id);
  const pts = u ? u.points : 0;
  return 6 + ((id * 17) % 34) + Math.floor(pts / 900);
}

/** Total applause a member shows (baseline + mine today, if given). */
export function clapsFor(id) {
  return baseClaps(id) + (hasClapped(id) ? 1 : 0);
}

/** Did I already applaud this member today? */
export function hasClapped(id) {
  if (given.claps.has(id)) return true;
  const d = load();
  return d.claps?.[id] === today();
}

/** Applaud once per member per day. Returns false if already done. */
export function giveClap(id) {
  if (hasClapped(id)) return false;
  const d = load();
  d.claps = d.claps || {};
  d.claps[id] = today();
  save(d);
  given.claps.add(id);
  return true;
}

/** Did I already poke this member today? */
export function hasPoked(id) {
  const d = load();
  return d.pokes?.[id] === today();
}

/** Poke the member above you (once per day per member). */
export function givePoke(id) {
  if (hasPoked(id)) return false;
  const d = load();
  d.pokes = d.pokes || {};
  d.pokes[id] = today();
  save(d);
  return true;
}

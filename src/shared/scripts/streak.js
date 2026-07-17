// =========================================================
// Streak — ALIVE, not a frozen number. Any meaningful learning/social
// action today "touches" the streak once:
//   • yesterday was your last active day → streak + 1 (toast 🔥)
//   • today already counted             → nothing
//   • you skipped a day (or first time) → streak restarts at 1
//
// Wired at: daily challenge, publishing a post, commenting/replying,
// solving an approved community exercise. The teacher/admin has no
// streak (he's not in the game). Persists in localStorage; MY_PROFILE
// .streak stays the single value everything else reads (badges, rings).
// =========================================================
import { MY_PROFILE } from "./community-data.js";
import { isLoggedIn, isAdmin } from "./session.js";
import { showToast } from "./toast.js";
import { localDayStr } from "./format.js";

const KEY = "atelier_streak"; // { lastDay: "2026-07-04", count: n }

// LOCAL calendar day (not UTC) — the streak flips at the pupil's local midnight.
const dayStr = (d = new Date()) => localDayStr(d);

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

/** Sync MY_PROFILE.streak from storage at module load, so rings/badges
 *  show the real value even before today's first action. */
(function syncOnLoad() {
  const s = load();
  if (!s) return; // keep the seeded mock value until the first real action
  const yesterday = dayStr(new Date(Date.now() - 864e5));
  // A missed day means the streak is broken — show it honestly.
  MY_PROFILE.streak = s.lastDay === dayStr() || s.lastDay === yesterday ? s.count : 0;
})();

/** Current streak info for UIs (calendar strip etc.): the run of ACTIVE
 *  days is, by construction, the `count` consecutive days ending lastDay. */
export function getStreakInfo() {
  const s = load();
  return { count: s?.count || 0, lastDay: s?.lastDay || null };
}

/** Count today as active (call from any meaningful action). */
export function touchStreak() {
  if (!isLoggedIn() || isAdmin()) return; // members only
  const today = dayStr();
  const yesterday = dayStr(new Date(Date.now() - 864e5));
  const s = load();

  if (s && s.lastDay === today) return; // already counted today

  const count = s && s.lastDay === yesterday ? s.count + 1 : 1;
  try {
    localStorage.setItem(KEY, JSON.stringify({ lastDay: today, count }));
  } catch {
    /* private mode — in-memory only */
  }
  const grew = MY_PROFILE.streak > 0 && count > 1;
  MY_PROFILE.streak = count;
  showToast(grew ? `🔥 Streak ${count} zile — ține-o tot așa!` : "🔥 Streak pornit — revino și mâine!", { kind: "success" });
}

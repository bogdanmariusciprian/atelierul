// =========================================================
// Notification tray — REAL notifications (Supabase). Rows are generated
// SERVER-side by triggers (migration 0016) whenever something happens to you:
// a friend request / acceptance, a direct message, a ♥ like, a comment.
//
// The badge number and the hover-panel rows both derive from ONE cached list
// (loaded via loadNotifications), so they can never disagree. Opening the tray
// CONSUMES it: the shown notifications are marked read (server + cache).
// =========================================================
import { fetchNotifications, markNotificationsRead } from "./forum-repo.js";
import { isLoggedIn } from "./session.js";

let _notifs = []; // cache: [{ id, type, payload, read_at, created_at }]

/** Load (or refresh) the current user's notifications. Fires atelier:notifs
 *  so the badge/chip re-render. No-op (empty) for guests. */
export async function loadNotifications() {
  if (!isLoggedIn()) {
    _notifs = [];
    return;
  }
  try {
    _notifs = await fetchNotifications(30);
  } catch {
    _notifs = [];
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("atelier:notifs"));
}

/** The cached notifications, newest first. */
export function notifRows() {
  return _notifs;
}

/** THE badge number — unread notifications (badge ⇔ rows, always equal). */
export function notifTotal() {
  return _notifs.filter((n) => !n.read_at).length;
}

/** Called when the tray closes after being viewed: mark the shown items read
 *  (optimistically in the cache, then persist). */
export async function consumeTray() {
  const unread = _notifs.filter((n) => !n.read_at).map((n) => n.id);
  _notifs.forEach((n) => {
    if (!n.read_at) n.read_at = new Date().toISOString();
  });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("atelier:notifs"));
  if (unread.length) await markNotificationsRead(unread);
}

/** Compact "how long ago" stamp for notification rows (RO). */
export function relTime(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "acum";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ieri" : `${d} zile`;
}

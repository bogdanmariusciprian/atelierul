// =========================================================
// Notification tray — the SINGLE source of truth for "what's new" on the
// user chip. The badge number and the hover panel's rows are both derived
// from the same three lists below, so they can never disagree.
//
// Viewing the tray CONSUMES it: everything shown is marked seen and
// disappears from tray + badge. The underlying data survives — friend
// requests stay actionable in Profil, messages stay unread in Mesaje
// until actually opened there, activity history stays in Activitate.
// "Seen" is persisted via store (atelier_notif_seen).
// =========================================================
import { store } from "./store.js";
import { MY_PROFILE, userById } from "./community-data.js";
import { isLoggedIn, isAdmin } from "./session.js";
import { ACTIVITY_RECEIVED, markActivityRead } from "./activity-data.js";
import { inboxFor } from "./messages.js";

const SEEN_KEY = "atelier_notif_seen"; // { reqs: [userId], msgs: [msgId] }

function getSeen() {
  const raw = store.get(SEEN_KEY, {}) || {};
  return { reqs: new Set(raw.reqs || []), msgs: new Set(raw.msgs || []) };
}

/** Incoming friend requests not yet glimpsed in the tray. */
export function trayRequests() {
  if (!isLoggedIn() || isAdmin()) return [];
  const seen = getSeen().reqs;
  return MY_PROFILE.friendReqIncoming.filter((id) => !seen.has(id) && userById(id));
}

/** Unread inbox messages not yet glimpsed in the tray. */
export function trayMessages() {
  if (!isLoggedIn()) return [];
  const seen = getSeen().msgs;
  return inboxFor(isAdmin()).filter((m) => !m.read && !seen.has(m.id));
}

/** Unread activity (read flag lives in activity-data). */
export function trayActivity() {
  if (!isLoggedIn()) return [];
  return ACTIVITY_RECEIVED.filter((a) => !a.read);
}

/** THE badge number — by construction equal to the panel's row count. */
export function notifTotal() {
  return trayRequests().length + trayMessages().length + trayActivity().length;
}

/** Called when the tray closes after being viewed: everything it showed
 *  is marked seen/read; chips listening to "atelier:notifs" refresh. */
export function consumeTray() {
  const seen = getSeen();
  for (const id of trayRequests()) seen.reqs.add(id);
  for (const m of trayMessages()) seen.msgs.add(m.id);
  store.set(SEEN_KEY, { reqs: [...seen.reqs], msgs: [...seen.msgs] });
  markActivityRead();
  window.dispatchEvent(new CustomEvent("atelier:notifs"));
}

/** Compact "how long ago" stamp for message rows (RO). */
export function relTime(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "acum";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ieri" : `${d} zile`;
}

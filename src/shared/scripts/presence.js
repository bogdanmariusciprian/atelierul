// =========================================================
// Presence heartbeat. While a signed-in user has the site open, a beat goes
// out every minute (and on load / tab focus). It does two things at once:
//
//   • refreshes profiles.last_seen_at, which is what the green/red dot reads —
//     "active now" means seen within ONLINE_WINDOW_MS;
//   • strings the beats into SESSIONS. Beats less than five minutes apart
//     belong to the same visit; a longer gap starts a new one. That is what
//     turns „when was he last here" into „how long did he stay", and it can
//     only be done on the server, where one beat can look at the last.
//
// The beat used to write last_seen_at straight from the client. It goes through
// touch_presence() now — the same work plus the session bookkeeping, in one
// round trip instead of two, and with no way for a client to invent hours.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER, isLoggedIn } from "./session.js";

const HEARTBEAT_MS = 60 * 1000;
export const ONLINE_WINDOW_MS = 3 * 60 * 1000; // "active now" if seen within 3 min

let started = false;

async function beat() {
  if (!isLoggedIn() || !CURRENT_USER.authId || document.hidden) return;
  const { error } = await supabase.rpc("touch_presence");
  // Until the migration is applied the function doesn't exist; fall back to the
  // old direct write so the presence dots keep working in the meantime.
  if (error) {
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", CURRENT_USER.authId);
  }
}

/** Start the heartbeat once (called from renderChrome). No-op for guests. */
export function startPresence() {
  if (started || typeof document === "undefined") return;
  started = true;
  beat();
  setInterval(beat, HEARTBEAT_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) beat();
  });
  window.addEventListener("focus", beat);
}

/** Is a last_seen timestamp (ms) recent enough to count as online? */
export function isOnlineSince(lastSeenMs) {
  return !!lastSeenMs && Date.now() - lastSeenMs < ONLINE_WINDOW_MS;
}

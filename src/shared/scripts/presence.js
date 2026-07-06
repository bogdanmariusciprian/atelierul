// =========================================================
// Presence heartbeat. While a signed-in user has the site open, refresh
// their profiles.last_seen_at every minute (and on load / tab focus). Other
// users read that timestamp to show a green ("active now") or red (offline)
// dot. "Active now" = last_seen within ONLINE_WINDOW_MS.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER, isLoggedIn } from "./session.js";

const HEARTBEAT_MS = 60 * 1000;
export const ONLINE_WINDOW_MS = 3 * 60 * 1000; // "active now" if seen within 3 min

let started = false;

async function beat() {
  if (!isLoggedIn() || !CURRENT_USER.authId || document.hidden) return;
  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", CURRENT_USER.authId);
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

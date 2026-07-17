// =========================================================
// Session — the REAL, signed-in user (Supabase auth).
//
// Kept intentionally SYNCHRONOUS so the ~120 call sites that read
// `CURRENT_USER`, `isAdmin()`, `isLoggedIn()` don't need to become async:
//   • at module load we read the session straight from localStorage
//     (supabase-js persists it there) — instant, good for the first paint;
//   • onAuthStateChange then keeps everything correct (initial session,
//     login, logout, silent token refresh) and fires "atelier:role" so the
//     UI (header, XP bar, admin frame…) re-renders live.
//
// The role is DERIVED from the e-mail (never chosen by the client) and the
// same rule is enforced server-side by Supabase RLS — this only drives UI.
// =========================================================
import { supabase } from "./supabase-client.js";
import { SUPABASE_URL } from "./config.js";

/** The admin is Marius, recognised by this e-mail (the teacher). */
export const ADMIN_EMAIL = "bogdanmariusciprian@gmail.com";

/** admin (the teacher) · member (any other signed-in user) · guest (none). */
export function roleForEmail(email) {
  if (!email) return "guest";
  return email.trim().toLowerCase() === ADMIN_EMAIL ? "admin" : "member";
}

// ---------------------------------------------------------
// Read the persisted Supabase session synchronously from localStorage.
// supabase-js stores it under `sb-<project-ref>-auth-token` (occasionally
// split into `.0`, `.1` chunks, or "base64-"-prefixed). Best-effort only:
// onAuthStateChange below corrects anything this misses.
// ---------------------------------------------------------
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

function readStoredRaw() {
  try {
    const direct = localStorage.getItem(STORAGE_KEY);
    if (direct != null) return direct;
    let out = "";
    for (let i = 0; ; i++) {
      const chunk = localStorage.getItem(`${STORAGE_KEY}.${i}`);
      if (chunk == null) break;
      out += chunk;
    }
    return out || null;
  } catch {
    return null;
  }
}

function readStoredUser() {
  try {
    let raw = readStoredRaw();
    if (!raw) return null;
    if (raw.startsWith("base64-")) raw = atob(raw.slice(7));
    const parsed = JSON.parse(raw);
    const session = parsed?.currentSession ?? parsed;
    const user = session?.user ?? parsed?.user ?? null;
    return user?.email ? user : null;
  } catch {
    return null;
  }
}

function initialsOf(name) {
  return (name || "")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function nameOf(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split("@")[0] : "Tu")
  );
}

// The current user. A STABLE object (mutated in place, never reassigned) so
// any module that captured the reference keeps seeing fresh values.
// `id: 0` stays the sentinel for "me" while the community content is still
// local mock; `authId` carries the real Supabase UUID for when it isn't.
export const CURRENT_USER = {
  id: 0,
  authId: null,
  name: "Tu",
  initials: "TU",
  color: "#7c3aed",
  email: null,
};

// Module-level cache of the signed-in user (null = guest).
let _user = readStoredUser();

function syncCurrentUser() {
  // The teacher (admin) is shown ONLY as "Profesor" everywhere — never by
  // name — with a 🎓 avatar. Regular users show their (editable) display name.
  const admin = _user ? roleForEmail(_user.email) === "admin" : false;
  let name = _user ? (admin ? "Profesor" : nameOf(_user)) : "Tu";
  let color = null;
  // Prefer the display name the user set in their profile (cached from the
  // real row) over the Google name — so the chip doesn't flash the Google
  // name on every auth event before hydrate corrects it.
  if (_user && !admin) {
    try {
      const c = JSON.parse(localStorage.getItem("atelier_identity") || "null");
      if (c && c.authId === _user.id) {
        if (c.name) name = c.name;
        if (c.color) color = c.color;
      }
    } catch {
      /* ignore */
    }
  }
  CURRENT_USER.authId = _user?.id ?? null;
  CURRENT_USER.email = _user?.email ?? null;
  CURRENT_USER.name = name;
  CURRENT_USER.initials = _user ? (admin ? "🎓" : initialsOf(name)) : "TU";
  if (color) CURRENT_USER.color = color;
}
syncCurrentUser();

export function getRole() {
  return _user ? roleForEmail(_user.email) : "guest";
}

export function isAdmin() {
  return getRole() === "admin";
}

/** Logged in = admin or member (i.e. not a guest). */
export function isLoggedIn() {
  return getRole() !== "guest";
}

/** Sign the user out (used by the header logout). */
export async function signOut() {
  await supabase.auth.signOut();
  // Clear this user's LOCAL traces so a shared computer doesn't leak them to the
  // next person (streak, cached identity, lessons-done, notebook, group-seen…).
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("atelier_")) localStorage.removeItem(k);
    }
  } catch {
    /* private mode — nothing to clear */
  }
}

// Keep the session fresh and tell the UI to re-render. Fires for
// INITIAL_SESSION (client boot), SIGNED_IN, SIGNED_OUT and TOKEN_REFRESHED.
supabase.auth.onAuthStateChange((_event, session) => {
  _user = session?.user ?? null;
  syncCurrentUser();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("atelier:role", { detail: { role: getRole() } })
    );
  }
});

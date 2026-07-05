// =========================================================
// Mock session (preview only). Real auth lives in auth.js (Supabase);
// until that's wired, this fakes the current user + role so gated
// features can be built and demoed.
//
// Three roles (per Marius): admin (him), member (logged in), guest.
// A 3-state demo switch flips the role; it persists in localStorage.
// Swap this module for real auth later — same tiny API.
// =========================================================

const KEY = "atelier_mock_role"; // "admin" | "member" | "guest"
const LEGACY_KEY = "atelier_mock_logged"; // older 0/1 flag (kept in sync)

/** The admin is Marius, recognised by this address once real auth exists. */
export const ADMIN_EMAIL = "bogdanmariusciprian@gmail.com";

/**
 * PRODUCTION RULE (wire this when Supabase auth lands, then DELETE the
 * demo switch + localStorage role below): the role is derived from the
 * authenticated Google account's email — never chosen by the client.
 *   ADMIN_EMAIL  → "admin" (the teacher)
 *   anything else→ "member"
 *   no session   → "guest"
 * The same rule must be enforced server-side (RLS / policies) — this
 * helper only drives the UI.
 */
export function roleForEmail(email) {
  if (!email) return "guest";
  return email.trim().toLowerCase() === ADMIN_EMAIL ? "admin" : "member";
}

/** The current (fake) user. Replace with the real profile later. */
export const CURRENT_USER = {
  id: 0,
  name: "Marius",
  initials: "MA",
  color: "#7c3aed",
  email: ADMIN_EMAIL,
};

export const ROLES = ["admin", "member", "guest"];

/** Current role. Defaults to "member" (logged-in, non-admin). */
export function getRole() {
  const r = localStorage.getItem(KEY);
  if (r && ROLES.includes(r)) return r;
  // Fall back to the legacy 0/1 flag if present.
  if (localStorage.getItem(LEGACY_KEY) === "0") return "guest";
  return "member";
}

export function setRole(role) {
  if (!ROLES.includes(role)) return;
  localStorage.setItem(KEY, role);
  // Keep the legacy flag consistent for any code still reading it.
  localStorage.setItem(LEGACY_KEY, role === "guest" ? "0" : "1");
  // Let UI (e.g. the XP bar) react to role changes.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("atelier:role", { detail: { role } }));
  }
}

export function isAdmin() {
  return getRole() === "admin";
}

/** Logged in = admin or member (i.e. not a guest). */
export function isLoggedIn() {
  return getRole() !== "guest";
}

/** Back-compat with the old 2-state switch (member <-> guest). */
export function setLoggedIn(on) {
  setRole(on ? "member" : "guest");
}

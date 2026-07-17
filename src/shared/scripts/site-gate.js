// =========================================================
// Pre-launch gate (client-side). Until the public launch, only the allow-listed
// accounts may see the site; everyone else — signed out, OR signed in with a
// different account — is sent to the "coming soon" page (/in-curand/).
//
// HONEST LIMIT: this is a CLIENT-side gate, so a determined person who reads the
// code can bypass the *redirect*. It is NOT a security boundary. The real data
// stays protected server-side by Supabase RLS regardless of this gate — this
// only controls what the pages SHOW. (Marius chose this trade-off knowingly.)
//
// It runs FIRST inside renderChrome() — which every page calls — and the page
// stays hidden (`html:not(.gate-ready) body` in main.css) until it decides, so
// the real content never flashes for a visitor about to be redirected. With
// JavaScript disabled the page simply stays blank (fail-closed).
// =========================================================
import { supabase } from "./supabase-client.js";

/** The accounts allowed in before launch (compared lower-cased). Being on this
 *  list only grants VIEW access; the admin role stays tied to ADMIN_EMAIL in
 *  session.js, so the extra members here see the site as pupils, not admins. */
export const ALLOWED_EMAILS = new Set([
  "qwzky1@gmail.com",
  "bogdanmariusciprian@gmail.com",
  "marius-ciprian.bogdan@cursant.g4e.ro",
  "matriux26@gmail.com",
]);

/** Absolute path of the public "coming soon" page (site is at the domain root). */
export const COMING_SOON_PATH = "/in-curand/";

/** True if `email` is one of the allowed team accounts. */
export function isAllowedEmail(email) {
  return !!email && ALLOWED_EMAILS.has(email.trim().toLowerCase());
}

/** Reveal the page (undo the flash-hide). Called once an allowed user is in. */
export function revealGate() {
  document.documentElement.classList.add("gate-ready");
}

/**
 * Decide access for the CURRENT page.
 *   • allowed team account  → returns true (caller renders, then revealGate());
 *   • anyone else           → redirect to /in-curand/ and return false.
 * Never throws (any error is treated as "guest" → gated = fail-closed).
 */
export async function enforceGate() {
  // The coming-soon page is always allowed. It doesn't call this, but guard
  // against an accidental redirect loop just in case.
  if (location.pathname.startsWith(COMING_SOON_PATH)) return true;

  let email = null;
  try {
    const { data } = await supabase.auth.getSession();
    email = data?.session?.user?.email || null;
  } catch {
    /* no session / offline → treated as a guest */
  }

  if (isAllowedEmail(email)) return true;
  location.replace(COMING_SOON_PATH);
  return false;
}

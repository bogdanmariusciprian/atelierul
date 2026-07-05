// =========================================================
// Google One Tap / "Sign in with Google" (Google Identity Services).
//
// Modern in-page login: instead of a full-page redirect to Google, the
// user gets Google's own popup / One Tap card ON the page. Google returns
// an ID token which we hand to Supabase (signInWithIdToken). On success,
// the global supabase.auth.onAuthStateChange (see session.js) reacts.
//
// A nonce protects the flow: Google receives the SHA-256 (hex) of a random
// value; Supabase gets the raw value and re-hashes to verify.
// Docs: https://supabase.com/docs/guides/auth/social-login/auth-google
// =========================================================
import { supabase } from "./supabase-client.js";
import { GOOGLE_CLIENT_ID } from "./config.js";

const GIS_SRC = "https://accounts.google.com/gsi/client";

let _scriptPromise = null;
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (_scriptPromise) return _scriptPromise;
  _scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Sign-In indisponibil"));
    document.head.appendChild(s);
  });
  return _scriptPromise;
}

async function makeNonce() {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

let _initPromise = null;
let _rawNonce = null;

function init(onError) {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    await loadGis();
    const { raw, hashed } = await makeNonce();
    _rawNonce = raw;
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: hashed,
      use_fedcm_for_prompt: true, // future-proof for Chrome's cookie changes
      callback: async (response) => {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
          nonce: _rawNonce,
        });
        // Success is handled globally by supabase.auth.onAuthStateChange.
        if (error && onError) onError(error);
      },
    });
  })();
  return _initPromise;
}

/**
 * Set up Google Sign-In on the current page.
 * @param {HTMLElement|null} container If given, Google's official button is
 *   rendered here. Pass null for the One Tap card only.
 * @param {{oneTap?: boolean, onError?: (e:any)=>void}} [opts]
 *   oneTap (default true) shows the top-right One Tap prompt too.
 */
export async function mountGoogleSignIn(container, { oneTap = true, onError } = {}) {
  try {
    await init(onError);
    if (container) {
      google.accounts.id.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
      });
    }
    if (oneTap) google.accounts.id.prompt();
  } catch (e) {
    if (onError) onError(e);
  }
}

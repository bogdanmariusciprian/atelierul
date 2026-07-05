// =========================================================
// Authentication helpers — Google sign-in via Supabase.
// Shared by Community and Planner zones (DRY).
// =========================================================
import { supabase } from "./supabase-client.js";

/**
 * Start Google OAuth sign-in.
 * @param {string} redirectTo Where Google returns the user. Defaults to the
 *   current page (minus any #hash) so the session is captured where the flow
 *   began. Must be on the Redirect URLs allow-list in the Supabase dashboard.
 */
export async function signInWithGoogle(redirectTo = window.location.href.split("#")[0]) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
  return data;
}

/** Sign the current user out. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Get the current logged-in user, or null. */
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

/** Subscribe to auth state changes (login/logout). */
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

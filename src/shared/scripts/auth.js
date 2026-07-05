// =========================================================
// Authentication helpers — Google sign-in via Supabase.
// Shared by Community and Planner zones (DRY).
// These are thin placeholders; wire up real flows later.
// =========================================================
import { supabase } from "./supabase-client.js";

/** Start Google OAuth sign-in. */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
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

// =========================================================
// The teacher's mark on a pupil — one row in event_access.
//
// Historically this powered the „Evenimente" section; that section is gone
// (the planner replaced it), but the MARK survived because it had quietly
// become the important thing: it is how the teacher says „this pupil is mine".
// The planner reads it (has_planner_access), the admin Utilizatori tab writes
// it. The events/event_rsvps tables still exist in the database, unused —
// dropping data is a decision for a migration, not a side effect of a UI
// cleanup.
//
// Both writes RETURN their outcome instead of swallowing it. The old
// fire-and-forget version, paired with an optimistic toggle in the UI, could
// show „Meditații ✓" while the insert had failed — which is exactly how a
// pupil ends up marked on screen and missing from the planner.
// Content Romanian, identifiers English.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER } from "./session.js";

export async function grantEventAccess(userUuid) {
  const { error } = await supabase
    .from("event_access")
    .insert({ user_id: userUuid, granted_by: CURRENT_USER.authId });
  // 23505 = the row already exists — the pupil IS marked, so that's a success.
  if (error && error.code !== "23505") {
    console.warn("grantEventAccess:", error.message);
    return { ok: false, message: "N-am putut salva marcarea. Încearcă din nou." };
  }
  return { ok: true };
}

export async function revokeEventAccess(userUuid) {
  const { error } = await supabase.from("event_access").delete().eq("user_id", userUuid);
  if (error) {
    console.warn("revokeEventAccess:", error.message);
    return { ok: false, message: "N-am putut retrage marcarea. Încearcă din nou." };
  }
  return { ok: true };
}

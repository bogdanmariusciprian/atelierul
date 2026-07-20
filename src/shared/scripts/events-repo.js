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
// Content Romanian, identifiers English.
// =========================================================
import { supabase } from "./supabase-client.js";

export async function grantEventAccess(userUuid) {
  const { error } = await supabase.from("event_access").insert({ user_id: userUuid, granted_by: CURRENT_USER.authId });
  if (error && error.code !== "23505") console.warn("grantEventAccess:", error.message);
}

export async function revokeEventAccess(userUuid) {
  const { error } = await supabase.from("event_access").delete().eq("user_id", userUuid);
  if (error) console.warn("revokeEventAccess:", error.message);
}

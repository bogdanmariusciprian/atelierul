// =========================================================
// Reads and writes for the tutoring planner.
//
// The one thing worth knowing here: booking can FAIL for a reason that isn't a
// bug. Two pupils reaching for the same hour at the same moment is normal, and
// the database refuses the second one through an exclusion constraint (see
// migration 0053). That arrives as Postgres error 23P01, and it is translated
// here into something a person can act on — „cineva tocmai a luat intervalul" —
// rather than being logged and swallowed.
//
// Names are handled deliberately: the teacher gets everyone's, a pupil gets
// their own and „Ocupat" for the rest. A schedule is personal, and these are
// minors. The filtering happens here, in one place, so no view can leak it by
// forgetting.
// Content Romanian, identifiers English.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER, isAdmin } from "./session.js";

export const DAY_START_H = 8;   // the working day, matching the DB trigger
export const DAY_END_H = 22;
export const SNAP_MIN = 30;     // everything clicks to half hours
export const DURATIONS = [60, 90, 120];
export const DEFAULT_DURATION = 120;

/** Postgres codes we expect to see, turned into sentences.
 *  23P01 = exclusion violation — someone else holds that range.
 *  23514 = check violation — our own guards (length, hours, half-hours). */
function humanError(error) {
  if (!error) return "";
  if (error.code === "23P01") return "Cineva tocmai a rezervat intervalul ăsta. Alege altul.";
  if (error.code === "23514" || /programului|jumătate/.test(error.message || "")) {
    return error.message?.replace(/^.*?:\s*/, "") || "Intervalul nu e permis.";
  }
  if (error.code === "42501") return "Nu ai acces la planificator.";
  return "N-a mers. Încearcă din nou.";
}

/** Monday 00:00 of the week containing `d`, local time. */
export function weekStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const wd = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - wd);
  return x;
}

/** Every booking overlapping the seven days from `from`. */
export async function fetchWeek(from = weekStart()) {
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  const { data, error } = await supabase
    .from("tutoring_slots")
    .select("id, user_id, starts_at, ends_at, note, status, profiles!tutoring_slots_user_id_fkey(display_name, avatar_color)")
    .eq("status", "booked")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");
  if (error) { console.warn("fetchWeek:", error.message); return []; }

  const admin = isAdmin();
  return (data || []).map((r) => {
    const mine = r.user_id === CURRENT_USER.authId;
    return {
      id: r.id,
      userId: r.user_id,
      mine,
      // Only the teacher sees other people's names.
      name: mine ? "Tu" : admin ? (r.profiles?.display_name || "Membru") : "Ocupat",
      color: mine || admin ? (r.profiles?.avatar_color || "#7c3aed") : "#94a3b8",
      start: new Date(r.starts_at).getTime(),
      end: new Date(r.ends_at).getTime(),
      note: mine || admin ? (r.note || "") : "",
      canEdit: mine || admin,
    };
  });
}

/** Book. Returns { ok } or { ok:false, message } — never throws for a clash,
 *  because a clash isn't exceptional, it's Tuesday. */
export async function bookSlot({ startMs, minutes, userId = null, note = "" }) {
  const uid = userId || CURRENT_USER.authId;
  if (!uid) return { ok: false, message: "Trebuie să fii autentificat." };
  const starts = new Date(startMs);
  const ends = new Date(startMs + minutes * 60000);
  const { data, error } = await supabase
    .from("tutoring_slots")
    .insert({
      user_id: uid,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      note: note || null,
      created_by: CURRENT_USER.authId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: humanError(error), code: error.code };
  return { ok: true, id: data.id };
}

/** Move or resize. Same failure modes as booking — the constraint doesn't care
 *  whether a row is new or moved, only whether the range is free. */
export async function moveSlot(id, { startMs, minutes }) {
  const { error } = await supabase
    .from("tutoring_slots")
    .update({
      starts_at: new Date(startMs).toISOString(),
      ends_at: new Date(startMs + minutes * 60000).toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, message: humanError(error), code: error.code };
  return { ok: true };
}

/** Cancel. The row stays as history; only 'booked' rows hold a slot. */
export async function cancelSlot(id) {
  const { error } = await supabase
    .from("tutoring_slots").update({ status: "cancelled" }).eq("id", id);
  if (error) return { ok: false, message: humanError(error) };
  return { ok: true };
}

/** Live updates. Someone else's booking should appear while you're looking at
 *  the grid — that's what stops most collisions before they happen.
 *  Returns an unsubscribe function. */
export function watchSlots(onChange) {
  const ch = supabase
    .channel("tutoring_slots_live")
    .on("postgres_changes", { event: "*", schema: "public", table: "tutoring_slots" }, onChange)
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch { /* already gone */ } };
}

/** Do I get to use the planner at all? Mirrors has_planner_access() in SQL. */
export async function hasPlannerAccess() {
  if (isAdmin()) return true;
  if (!CURRENT_USER.authId) return false;
  const { data, error } = await supabase
    .from("event_access").select("user_id").eq("user_id", CURRENT_USER.authId).maybeSingle();
  if (error) { console.warn("hasPlannerAccess:", error.message); return false; }
  return !!data;
}

/** The teacher needs the list of marked pupils to book on their behalf. */
export async function fetchMarkedPupils() {
  if (!isAdmin()) return [];
  const { data, error } = await supabase
    .from("event_access")
    .select("user_id, profiles!event_access_user_id_fkey(display_name, avatar_color)");
  if (error) { console.warn("fetchMarkedPupils:", error.message); return []; }
  return (data || []).map((r) => ({
    id: r.user_id,
    name: r.profiles?.display_name || "Membru",
    color: r.profiles?.avatar_color || "#7c3aed",
  })).sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

// =========================================================
// Events — REAL data (Supabase `events` + `event_rsvps`). Visible only to
// pupils the teacher granted `event_access` (or the teacher). Returns the
// shape the hub used (discover-data.js EVENTS): { id, title, kind, when, host,
// going }, plus goingCount (only populated for the teacher, who can see all
// RSVPs — members only ever see their own by RLS).
// EVENT_KINDS (labels/colours/icons) stay client-side in discover-data.js.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER, isAdmin } from "./session.js";

const fmtWhen = (startsAt) => {
  if (!startsAt) return "";
  try {
    return new Date(startsAt).toLocaleString("ro-RO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

/** Events I'm allowed to see, newest scheduled first, with my RSVP + (admin) counts. */
export async function listEvents() {
  const { data: evs, error } = await supabase
    .from("events")
    .select("id, title, kind, starts_at, when_text, host, created_at")
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (error) { console.warn("listEvents:", error.message); return []; }

  // Members see only their OWN rsvps (RLS); the teacher sees all → real counts.
  const { data: rsvps } = await supabase.from("event_rsvps").select("event_id, user_id");
  const mine = new Set();
  const counts = new Map();
  for (const r of rsvps || []) {
    counts.set(r.event_id, (counts.get(r.event_id) || 0) + 1);
    if (r.user_id === CURRENT_USER.authId) mine.add(r.event_id);
  }

  return (evs || []).map((e) => ({
    id: e.id,
    title: e.title,
    kind: e.kind || "live",
    when: e.when_text || fmtWhen(e.starts_at),
    host: e.host || "",
    going: mine.has(e.id),
    goingCount: isAdmin() ? counts.get(e.id) || 0 : null,
  }));
}

/** RSVP toggle for the current pupil. */
export async function rsvpEvent(id, going) {
  if (going) {
    const { error } = await supabase.from("event_rsvps").insert({ event_id: id, user_id: CURRENT_USER.authId });
    if (error && error.code !== "23505") console.warn("rsvpEvent:", error.message);
  } else {
    const { error } = await supabase.from("event_rsvps").delete().eq("event_id", id).eq("user_id", CURRENT_USER.authId);
    if (error) console.warn("unrsvpEvent:", error.message);
  }
}

// ---------------------------------------------------------
// Teacher-only writes (RLS → admin).
// ---------------------------------------------------------
function toRow({ title, kind, whenText, startsAt, host }) {
  return {
    title,
    kind: ["live", "quiz", "reading", "other"].includes(kind) ? kind : "live",
    when_text: whenText || null,
    starts_at: startsAt || null,
    host: host || null,
  };
}

export async function createEvent(fields) {
  const { data, error } = await supabase
    .from("events").insert({ ...toRow(fields), created_by: CURRENT_USER.authId })
    .select("id").single();
  if (error) { console.warn("createEvent:", error.message); return null; }
  return data;
}

export async function updateEvent(id, fields) {
  const { error } = await supabase.from("events").update(toRow(fields)).eq("id", id);
  if (error) console.warn("updateEvent:", error.message);
}

export async function deleteEvent(id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) console.warn("deleteEvent:", error.message);
}

// ---------------------------------------------------------
// Event ACCESS (event_access, 0005) — the teacher grants/revokes which pupils
// may see the Evenimente section. Admin-only (RLS).
// ---------------------------------------------------------
export async function grantEventAccess(userUuid) {
  const { error } = await supabase.from("event_access").insert({ user_id: userUuid, granted_by: CURRENT_USER.authId });
  if (error && error.code !== "23505") console.warn("grantEventAccess:", error.message);
}

export async function revokeEventAccess(userUuid) {
  const { error } = await supabase.from("event_access").delete().eq("user_id", userUuid);
  if (error) console.warn("revokeEventAccess:", error.message);
}

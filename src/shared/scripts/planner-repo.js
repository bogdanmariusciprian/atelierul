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
  if (error.code === "23514" || /programului|jumătate|disponibilit|trecut/.test(error.message || "")) {
    return error.message?.replace(/^.*?:\s*/, "") || "Intervalul nu e permis.";
  }
  if (/on_date/.test(error.message || "")) return "Aplică întâi migrarea 0059 — ferestrele pe o singură zi au nevoie de ea.";
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
    .from("planner_slots")
    .select("id, user_id, starts_at, ends_at, note, status, kind, title, recurrence_id, profiles!planner_slots_user_id_fkey(display_name, avatar_color)")
    .eq("status", "booked")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");
  if (error) { console.warn("fetchWeek:", error.message); return []; }

  const admin = isAdmin();
  return (data || []).map((r) => {
    const mine = r.user_id === CURRENT_USER.authId;
    const personal = r.kind === "personal";
    // A personal block is the teacher's own time. To a pupil it is simply an
    // hour that isn't available — they have no business knowing what it holds.
    const label = personal
      ? (admin ? (r.title || "Activitate personală") : "Ocupat")
      : mine ? "Tu" : admin ? (r.profiles?.display_name || "Membru") : "Ocupat";
    return {
      id: r.id,
      userId: r.user_id,
      // The KIND of someone else's hour is the teacher's business, not the
      // pupil's — masked to a plain busy lesson, same as the name and note.
      kind: admin || mine ? (r.kind || "lesson") : "lesson",
      // The rhythm of a STRANGER's hour is the teacher's scheduling, not the
      // pupil's business — masked, like the name, the note and the kind.
      recurrenceId: admin || mine ? (r.recurrence_id || null) : null,
      mine,
      name: label,
      color: personal
        ? (admin ? "#475569" : "#94a3b8")
        : mine || admin ? (r.profiles?.avatar_color || "#7c3aed") : "#94a3b8",
      start: new Date(r.starts_at).getTime(),
      end: new Date(r.ends_at).getTime(),
      note: mine || admin ? (r.note || "") : "",
      canEdit: mine || admin,
    };
  });
}

/** Book. Returns { ok } or { ok:false, message } — never throws for a clash,
 *  because a clash isn't exceptional, it's Tuesday. */
export async function bookSlot({ startMs, minutes, userId = null, note = "", kind = "lesson", title = "", recurrenceId = null }) {
  // A personal block belongs to whoever is placing it — the teacher.
  const uid = kind === "personal" ? CURRENT_USER.authId : (userId || CURRENT_USER.authId);
  if (!uid) return { ok: false, message: "Trebuie să fii autentificat." };
  const starts = new Date(startMs);
  const ends = new Date(startMs + minutes * 60000);
  const { data, error } = await supabase
    .from("planner_slots")
    .insert({
      user_id: uid,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      note: note || null,
      kind,
      title: kind === "personal" ? (title || "Activitate personală") : null,
      recurrence_id: recurrenceId,
      created_by: CURRENT_USER.authId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: humanError(error), code: error.code };
  return { ok: true, id: data.id };
}

/** Move or resize. Same failure modes as booking — the constraint doesn't care
 *  whether a row is new or moved, only whether the range is free. */
export async function moveSlot(id, { startMs, minutes, detach = false }) {
  const { error } = await supabase
    .from("planner_slots")
    .update({
      starts_at: new Date(startMs).toISOString(),
      ends_at: new Date(startMs + minutes * 60000).toISOString(),
      // A series means „the same slot, weekly". An occurrence dragged to a new
      // time stops BEING that slot — it detaches, so its 🔁 stops lying and
      // „cancel the whole series" keeps meaning what it says.
      ...(detach ? { recurrence_id: null } : {}),
    })
    .eq("id", id);
  if (error) return { ok: false, message: humanError(error), code: error.code };
  return { ok: true };
}

/** Cancel. The row stays as history; only 'booked' rows hold a slot. */
export async function cancelSlot(id) {
  const { error } = await supabase
    .from("planner_slots").update({ status: "cancelled" }).eq("id", id);
  if (error) return { ok: false, message: humanError(error) };
  return { ok: true };
}

/** Rename a personal block in place. Times untouched, so the hours-guard
 *  trigger lets it through even for a block already in the past. */
export async function renameSlot(id, title) {
  const { error } = await supabase
    .from("planner_slots")
    .update({ title: title || "Activitate personală" })
    .eq("id", id);
  if (error) return { ok: false, message: humanError(error) };
  return { ok: true };
}

/** Live updates. Someone else's booking should appear while you're looking at
 *  the grid — that's what stops most collisions before they happen.
 *  Returns an unsubscribe function. */
export function watchSlots(onChange) {
  const ch = supabase
    .channel("planner_slots_live")
    .on("postgres_changes", { event: "*", schema: "public", table: "planner_slots" }, onChange)
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch { /* already gone */ } };
}

/** Do I get to use the planner at all? Mirrors has_planner_access() in SQL. */
export async function hasPlannerAccess() {
  if (isAdmin()) return true;
  if (!CURRENT_USER.authId) return false;
  const { data, error } = await supabase
    .from("planner_pupils").select("user_id").eq("user_id", CURRENT_USER.authId).maybeSingle();
  if (error) { console.warn("hasPlannerAccess:", error.message); return false; }
  return !!data;
}

/** The teacher's pupils, with his own customisations layered over the profile:
 *  the nickname he gave them, the colour he picked, their default duration.
 *  Empty customisation falls back to the profile — so a freshly marked pupil
 *  looks sensible before the teacher touches anything. */
export async function fetchMarkedPupils() {
  if (!isAdmin()) return [];
  const { data, error } = await supabase
    .from("planner_pupils")
    .select("user_id, planner_name, planner_color, planner_minutes, planner_emoji, planner_recurring, profiles!planner_pupils_user_id_fkey(display_name, avatar_color)");
  if (error) { console.warn("fetchMarkedPupils:", error.message); return []; }
  return (data || []).map((r) => ({
    id: r.user_id,
    name: r.planner_name || r.profiles?.display_name || "Membru",
    profileName: r.profiles?.display_name || "Membru",
    // What the teacher CHOSE, if anything. The display colour is decided in the
    // UI: custom if set, otherwise a hue derived from the pupil's id — at 16
    // pupils, avatar colours (member-picked) collide far too often to tell
    // blocks apart, which is the whole point of colouring them.
    customColor: r.planner_color || null,
    emoji: r.planner_emoji || "",
    recurring: !!r.planner_recurring,
    minutes: r.planner_minutes || DEFAULT_DURATION,
  })).sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

/** The teacher customises a pupil's chip. Nulls mean „back to the profile". */
export async function savePupilPrefs(userId, { name, color, minutes, emoji, recurring }) {
  // .select() makes silent RLS filtering VISIBLE: an update that matches zero
  // rows is not a success, it is a policy problem wearing a success mask —
  // that mask cost us a whole debugging round on planner_emoji.
  const { data, error } = await supabase
    .from("planner_pupils")
    .update({
      planner_name: name?.trim() || null,
      planner_color: color || null,
      planner_minutes: DURATIONS.includes(minutes) ? minutes : DEFAULT_DURATION,
      planner_emoji: emoji?.trim() || null,
      planner_recurring: !!recurring,
    })
    .eq("user_id", userId)
    .select("user_id");
  if (error) return { ok: false, message: humanError(error) };
  if (!data?.length) return { ok: false, message: "Salvarea n-a atins niciun rând (politică lipsă?). Spune-mi exact mesajul ăsta." };
  return { ok: true };
}

/** A pupil's own defaults: their duration and colour, as the teacher set them. */
export async function fetchMyPlannerPrefs() {
  if (!CURRENT_USER.authId) return { minutes: DEFAULT_DURATION, color: null };
  const { data } = await supabase
    .from("planner_pupils")
    .select("planner_minutes, planner_color")
    .eq("user_id", CURRENT_USER.authId).maybeSingle();
  return {
    minutes: data?.planner_minutes || DEFAULT_DURATION,
    color: data?.planner_color || null,
  };
}

// ---- availability (the teacher's weekly template) ----
// Weekday 0 = Monday … 6 = Sunday, matching (getDay() + 6) % 7 in JS and
// isodow − 1 in the SQL guard. Minutes are wall-clock from midnight.

export async function fetchAvailability() {
  let { data, error } = await supabase
    .from("planner_availability")
    .select("id, weekday, start_min, end_min, on_date")
    .order("weekday").order("start_min");
  // Before migration 0059 the on_date column doesn't exist. Falling back keeps
  // the existing windows on screen instead of vanishing them all.
  if (error && /on_date/.test(error.message || "")) {
    ({ data, error } = await supabase
      .from("planner_availability")
      .select("id, weekday, start_min, end_min")
      .order("weekday").order("start_min"));
  }
  if (error) { console.warn("fetchAvailability:", error.message); return []; }
  return (data || []).map((w) => ({
    id: w.id, weekday: w.weekday, startMin: w.start_min, endMin: w.end_min,
    onDate: w.on_date || null, // null = șablon săptămânal; setat = doar acea zi
  }));
}

/** Two windows share a SCOPE when they'd govern the same days: both weekly on
 *  the same weekday, or both one-offs on the same date. Merging across scopes
 *  would let an exception swallow the template — or the other way round. */
const sameScope = (w, weekday, onDate) =>
  onDate ? w.onDate === onDate : (!w.onDate && w.weekday === weekday);

/** Add a window to one weekday — MERGING with whatever it touches. The windows
 *  on a day must be disjoint, and not for tidiness: the server guard demands a
 *  booking fit inside a SINGLE window, so two abutting windows (16–18, 18–20)
 *  would silently forbid the 17–19 lesson that plainly fits. Merging at write
 *  time makes that case impossible in the data rather than handled in code. */
export async function saveAvailabilityWindow({ weekday, startMin, endMin, onDate = null }) {
  const all = await fetchAvailability();
  const day = all.filter((w) => sameScope(w, weekday, onDate));
  const touching = day.filter((w) => startMin <= w.endMin && endMin >= w.startMin);
  const merged = {
    weekday,
    on_date: onDate,
    start_min: Math.min(startMin, ...touching.map((w) => w.startMin)),
    end_min: Math.max(endMin, ...touching.map((w) => w.endMin)),
  };
  if (touching.length) {
    const { error } = await supabase.from("planner_availability")
      .delete().in("id", touching.map((w) => w.id));
    if (error) return { ok: false, message: humanError(error) };
  }
  const { error } = await supabase.from("planner_availability").insert(merged);
  if (error) return { ok: false, message: humanError(error) };
  return { ok: true };
}

/** Resize one window, keeping the day's invariant: windows stay disjoint.
 *  The row is updated in place first, THEN the day is re-normalised — if the
 *  stretched window now touches a neighbour, the two are merged into one.
 *  Without that pass, the server guard („fit inside a SINGLE window") would
 *  quietly refuse the lesson that straddles their former boundary. */
export async function resizeAvailabilityWindow(id, { weekday, startMin, endMin, onDate = null }) {
  const { error } = await supabase
    .from("planner_availability")
    .update({ start_min: startMin, end_min: endMin })
    .eq("id", id);
  if (error) return { ok: false, message: humanError(error) };

  const day = (await fetchAvailability()).filter((w) => sameScope(w, weekday, onDate));
  const me = day.find((w) => w.id === id);
  if (!me) return { ok: true };
  const touching = day.filter((w) => me.startMin <= w.endMin && me.endMin >= w.startMin);
  if (touching.length > 1) {
    const merged = {
      weekday,
      on_date: onDate,
      start_min: Math.min(...touching.map((w) => w.startMin)),
      end_min: Math.max(...touching.map((w) => w.endMin)),
    };
    const { error: e2 } = await supabase.from("planner_availability")
      .delete().in("id", touching.map((w) => w.id));
    if (e2) return { ok: false, message: humanError(e2) };
    const { error: e3 } = await supabase.from("planner_availability").insert(merged);
    if (e3) return { ok: false, message: humanError(e3) };
  }
  return { ok: true };
}

export async function deleteAvailabilityWindow(id) {
  const { error } = await supabase.from("planner_availability").delete().eq("id", id);
  if (error) return { ok: false, message: humanError(error) };
  return { ok: true };
}

// ---- vacations ----
// Informative, not blocking: recurring series skip them, manual bookings during
// one are allowed — that's the „unii vor, alții nu" split, resolved.
export async function fetchVacations() {
  const { data, error } = await supabase
    .from("planner_vacations")
    .select("id, starts_on, ends_on, label")
    .order("starts_on");
  if (error) { console.warn("fetchVacations:", error.message); return []; }
  return (data || []).map((v) => ({
    id: v.id, from: v.starts_on, to: v.ends_on, label: v.label || "Vacanță",
  }));
}

export async function saveVacation({ from, to, label }) {
  const { error } = await supabase
    .from("planner_vacations")
    .insert({ starts_on: from, ends_on: to, label: label?.trim() || null });
  if (error) return { ok: false, message: humanError(error) };
  return { ok: true };
}

export async function deleteVacation(id) {
  const { error } = await supabase.from("planner_vacations").delete().eq("id", id);
  if (error) return { ok: false, message: humanError(error) };
  return { ok: true };
}

// ---- recurring series ----

/** Book the same hour weekly, `weeks` times, as REAL rows sharing one
 *  recurrence_id. Materialised on purpose: each occurrence can then be moved or
 *  cancelled on its own, and the exclusion constraint guards each one with no
 *  new machinery. Occurrences that fall in a vacation are skipped by design
 *  (the weekly rhythm pauses); occurrences that clash are skipped because the
 *  database refuses them. Both are counted and reported, not hidden. */
/** One loop plants every occurrence of a series. Weeks step by CALENDAR days
 *  (setDate), not by 7×24h of milliseconds — a series crossing the DST switch
 *  keeps its wall-clock hour instead of drifting sixty minutes. */
async function plantSeries({ startMs, minutes, userId, kind, title, weeks, vacations, recurrenceId, fromWeek }) {
  let created = 0, inVacation = 0, clashed = 0;
  for (let w = fromWeek; w < weeks; w++) {
    const d = new Date(startMs);
    d.setDate(d.getDate() + w * 7);
    const at = d.getTime();
    const dayIso = new Date(at).toISOString().slice(0, 10);
    if (vacations.some((v) => dayIso >= v.from && dayIso <= v.to)) { inVacation++; continue; }
    const r = await bookSlot({ startMs: at, minutes, userId, recurrenceId, kind, title });
    if (r.ok) created++;
    else if (r.code === "23P01") clashed++;
    else return { ok: false, message: r.message, created, inVacation, clashed };
  }
  return { ok: true, created, inVacation, clashed };
}

export async function bookRecurring({ startMs, minutes, userId, weeks = 12, vacations = [], kind = "lesson", title = "" }) {
  const recurrenceId = crypto.randomUUID();
  const r = await plantSeries({ startMs, minutes, userId, kind, title, weeks, vacations, recurrenceId, fromWeek: 0 });
  return { ...r, ok: r.ok && r.created > 0, recurrenceId };
}

/** Turn an ALREADY-PLACED block into the head of a weekly series: the block
 *  itself receives the fresh recurrence id, then the following weeks are
 *  planted after it. `created` includes the head, so the toast's „X din N"
 *  arithmetic matches what the teacher sees on screen. */
export async function makeRecurring({ id, startMs, minutes, userId, kind = "lesson", title = "", weeks = 12, vacations = [] }) {
  const recurrenceId = crypto.randomUUID();
  const { error } = await supabase
    .from("planner_slots").update({ recurrence_id: recurrenceId }).eq("id", id);
  if (error) return { ok: false, message: humanError(error) };
  const r = await plantSeries({ startMs, minutes, userId, kind, title, weeks, vacations, recurrenceId, fromWeek: 1 });
  return { ...r, created: r.created + 1, recurrenceId };
}

/** The OFF half of the 🔁 toggle: recurrence STOPS at this block. The block
 *  itself survives, detached — „săptămâna asta rămâne" — and every occurrence
 *  AFTER it is cancelled. Earlier ones are untouched: they already happened
 *  or are due sooner, and stopping the future is not rewriting the past. */
export async function stopSeriesHere({ id, recurrenceId, startMs }) {
  const { error } = await supabase
    .from("planner_slots").update({ recurrence_id: null }).eq("id", id);
  if (error) return { ok: false, message: humanError(error) };
  const { data, error: e2 } = await supabase
    .from("planner_slots")
    .update({ status: "cancelled" })
    .eq("recurrence_id", recurrenceId)
    .eq("status", "booked")
    // The boundary is the LATER of the pressed block and now: stopping a
    // series from an old block must never cancel weeks that already happened.
    .gt("starts_at", new Date(Math.max(startMs, Date.now())).toISOString())
    .select("id");
  if (e2) return { ok: false, message: humanError(e2) };
  return { ok: true, stopped: data?.length || 0 };
}

/** When the teacher un-marks a pupil (admin panel), the pupil's future hours
 *  go with the access: a schedule full of lessons nobody may attend is a trap.
 *  Past hours stay — they happened. Returns how many were cancelled. */
export async function cancelFutureSlotsFor(userId) {
  const { data, error } = await supabase
    .from("planner_slots")
    .update({ status: "cancelled" })
    .eq("user_id", userId)
    .eq("status", "booked")
    .gt("starts_at", new Date().toISOString())
    .select("id");
  if (error) return { ok: false, message: humanError(error), cancelled: 0 };
  return { ok: true, cancelled: data?.length || 0 };
}

/** Cancel every FUTURE occurrence of a series. The past stays — it happened. */
export async function cancelSeries(recurrenceId) {
  const { error } = await supabase
    .from("planner_slots")
    .update({ status: "cancelled" })
    .eq("recurrence_id", recurrenceId)
    .gte("starts_at", new Date().toISOString());
  if (error) return { ok: false, message: humanError(error) };
  return { ok: true };
}

// =========================================================
// Reads for the teacher's dashboard.
//
// Every one of these is a security-definer function in the database, not a
// table query — and that isn't a workaround, it's the design. The row-level
// policies say „each account sees only its own rows" for points_ledger,
// lesson_progress and notifications, which is right and which the dashboard
// must not weaken. So the counting happens on the server, under system rights,
// and only NUMBERS come back. No message between two members, no individual
// notification, ever leaves the database through here.
//
// Every call is also guarded inside SQL by is_admin_user(): a member who
// invoked one by hand would get null, not data.
// Content Romanian, identifiers English.
// =========================================================
import { supabase } from "./supabase-client.js";

/** Headline numbers. Returns {} rather than null so callers can read freely. */
export async function fetchDashboardCounts() {
  const { data, error } = await supabase.rpc("admin_dashboard_counts");
  if (error) { console.warn("fetchDashboardCounts:", error.message); return {}; }
  return data || {};
}

/** What's waiting for a decision. */
export async function fetchDashboardQueues() {
  const { data, error } = await supabase.rpc("admin_dashboard_queues");
  if (error) { console.warn("fetchDashboardQueues:", error.message); return {}; }
  return data || {};
}

/** One row per day, oldest first. Always `days` long — empty days come back as
 *  zeros rather than gaps, so a chart can be drawn without patching holes. */
export async function fetchDashboardSeries(days = 30) {
  const { data, error } = await supabase.rpc("admin_dashboard_series", { p_days: days });
  if (error) { console.warn("fetchDashboardSeries:", error.message); return []; }
  return (data || []).map((r) => ({
    day: r.day,
    members: r.members || 0,
    posts: r.posts || 0,
    comments: r.comments || 0,
    lessons: r.lessons || 0,
    points: r.points || 0,
    sessions: r.sessions || 0,
    minutes: r.minutes || 0,
  }));
}

/** One row per member, newest first. */
export async function fetchDashboardMembers() {
  const { data, error } = await supabase.rpc("admin_dashboard_members");
  if (error) { console.warn("fetchDashboardMembers:", error.message); return []; }
  return (data || []).map((r) => ({
    id: r.id,
    name: r.name || "Membru",
    avatar: r.avatar || null,
    color: r.color || "#7c3aed",
    grade: r.grade || "",
    locality: r.locality || "",
    joined: r.created_at ? new Date(r.created_at).getTime() : 0,
    lastSeen: r.last_seen_at ? new Date(r.last_seen_at).getTime() : 0,
    points: r.points || 0,
    posts: r.posts || 0,
    comments: r.comments || 0,
    lessons: r.lessons || 0,
    activeDays: r.active_days || 0,
    sessions: r.sessions || 0,
    minutesTotal: r.minutes_total || 0,
    minutesAvg: Number(r.minutes_avg) || 0,
  }));
}

/** Everything the dashboard needs, in parallel — four round trips at once
 *  instead of four in a row. */
export async function fetchDashboard(days = 30) {
  const [counts, queues, series, members] = await Promise.all([
    fetchDashboardCounts(),
    fetchDashboardQueues(),
    fetchDashboardSeries(days),
    fetchDashboardMembers(),
  ]);
  return { counts, queues, series, members };
}

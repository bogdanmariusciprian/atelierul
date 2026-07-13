// =========================================================
// "Activitatea mea" — REAL data (replaces the activity-data.js mock).
//   • PRIMITE  = the notifications table (generated SERVER-side by the 0016
//     triggers: friend request/accept, message, like, comment — plus @mentions
//     via the notify_mention RPC, 0023). Shared with the 🔔 tray (notif.js), so
//     the badge and this list can never disagree.
//   • OFERITE  = derived from what you ACTUALLY did (your posts, comments and
//     ♥ likes), queried live — not a local log. So it's honest, survives a
//     reload and follows you across devices.
// Nothing here is written by the client except a mention (RPC, cheat-safe).
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER, isLoggedIn } from "./session.js";
import { surrogateByUuid, uuidForSurrogate } from "./forum-repo.js";
import { notifRows, notifTotal, consumeTray } from "./notif.js";

const LIKE_EMOJI = "♥";

const rel = (ts) => {
  const min = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 1) return "acum";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ieri" : `${d} zile`;
};

// Presentation (icons/colours) — moved here from the mock, plus the kinds the
// real notification types need.
export const ACTIVITY_KINDS = {
  comment: { label: "Comentariu", color: "#2563eb", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 20l1.4-4.2A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/></svg>` },
  like: { label: "Apreciere", color: "#db2777", icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.35-9.5-8.5C1 9.5 2.5 6 6 6c2 0 3.2 1.2 4 2.3C10.8 7.2 12 6 14 6c3.5 0 5 3.5 3.5 6.5C19 16.65 12 21 12 21z"/></svg>` },
  reply: { label: "Răspuns", color: "#16a34a", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17l-5-5 5-5"/><path d="M4 12h11a5 5 0 0 1 5 5v2"/></svg>` },
  poke: { label: "Poke", color: "#f59e0b", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h14"/><path d="M10 6l6 6-6 6"/><circle cx="20" cy="12" r="2"/></svg>` },
  award: { label: "Recompensă", color: "#16a34a", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M9 14l-1.5 7L12 18l4.5 3L15 14"/></svg>` },
  friend: { label: "Prietenie", color: "#7c3aed", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M18 8v6M21 11h-6"/></svg>` },
  mention: { label: "Mențiune", color: "#0891b2", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"/></svg>` },
  message: { label: "Mesaj", color: "#0ea5e9", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>` },
  post: { label: "Postare", color: "#7c3aed", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>` },
};

// ---------------------------------------------------------
// PRIMITE — the real notifications (shared cache with the 🔔 tray).
// ---------------------------------------------------------
function mapNotif(n) {
  const p = n.payload || {};
  const authorId = surrogateByUuid(p.actor); // null when the actor isn't in the registry (e.g. the teacher)
  const name = p.actor_name || "Cineva";
  const base = {
    id: n.id,
    authorId,
    name,
    snippet: p.snippet || "",
    time: rel(n.created_at),
    read: !!n.read_at,
    goSection: null,
    context: "Atelier",
  };
  switch (n.type) {
    case "friend":
      return { ...base, kind: "friend",
        action: p.kind === "accepted" ? "ți-a acceptat cererea de prietenie" : "vrea să-ți fie prieten(ă)",
        snippet: p.kind === "accepted" ? "Sunteți prieteni acum." : "Acceptă sau refuză cererea din profilul tău.",
        context: p.kind === "accepted" ? "Prietenie nouă" : "Cerere de prietenie",
        goSection: "profil" };
    case "message":
      return { ...base, kind: "message", action: "ți-a trimis un mesaj",
        snippet: "Deschide conversația ca s-o citești.", context: "Mesaje", goSection: "mesaje" };
    case "like":
      return { ...base, kind: "like", action: "ți-a apreciat postarea", context: "Forum" };
    case "comment":
      return { ...base, kind: "comment", action: "ți-a comentat la postare", context: "Forum" };
    case "mention":
      return { ...base, kind: "mention", action: "te-a menționat", context: p.context || "Atelier" };
    default:
      return { ...base, kind: "comment", action: "a interacționat cu tine" };
  }
}

/** The received activity = the real notifications, newest first. */
export function receivedActivity() {
  return notifRows().map(mapNotif);
}

/** Unread received notifications (the sidebar badge). */
export function unreadActivityCount() {
  return isLoggedIn() ? notifTotal() : 0;
}

/** Opening the section marks the shown notifications read (server + cache). */
export function markActivityRead() {
  if (isLoggedIn()) consumeTray();
}

// ---------------------------------------------------------
// OFERITE — derived from what you actually did (live queries).
// ---------------------------------------------------------
/** My recent posts, comments and ♥ likes, merged newest-first. */
export async function fetchGivenActivity(limit = 30) {
  const uid = CURRENT_USER.authId;
  if (!uid) return [];
  const [posts, comments, likes, kudos] = await Promise.all([
    supabase.from("posts").select("id, body, created_at").eq("author_id", uid)
      .order("created_at", { ascending: false }).limit(limit),
    supabase.from("comments").select("id, body, created_at, post_id, lesson_slug").eq("author_id", uid)
      .order("created_at", { ascending: false }).limit(limit),
    supabase.from("post_reactions")
      .select("post_id, created_at, post:posts!post_reactions_post_id_fkey(body)")
      .eq("user_id", uid).eq("emoji", LIKE_EMOJI)
      .order("created_at", { ascending: false }).limit(limit),
    supabase.from("kudos")
      .select("id, kind, created_at, to:profiles!kudos_to_user_fkey(display_name)")
      .eq("from_user", uid)
      .order("created_at", { ascending: false }).limit(limit),
  ]);

  const strip = (s) => String(s || "").replace(/<[^>]*>/g, "").slice(0, 100);
  const rows = [
    ...(posts.data || []).map((r) => ({
      id: `p${r.id}`, kind: "post", action: "ai publicat o postare",
      snippet: strip(r.body) || "(fără text)", context: "Forum", createdAt: new Date(r.created_at).getTime(),
    })),
    ...(comments.data || []).map((r) => ({
      id: `c${r.id}`, kind: "comment",
      action: r.lesson_slug ? "ai comentat la o lecție" : "ai comentat la o postare",
      snippet: strip(r.body), context: r.lesson_slug ? "Lecție" : "Forum",
      createdAt: new Date(r.created_at).getTime(),
    })),
    ...(likes.data || []).map((r) => ({
      id: `l${r.post_id}`, kind: "like", action: "ai apreciat o postare",
      snippet: strip(r.post?.body) || "(postare)", context: "Forum",
      createdAt: new Date(r.created_at).getTime(),
    })),
    ...(kudos.data || []).map((r) => {
      const who = r.to?.display_name || "un coleg";
      const clap = r.kind === "clap";
      return {
        id: `k${r.id}`, kind: clap ? "like" : "poke",
        action: clap ? `l-ai aplaudat pe ${who}` : `i-ai dat un poke lui ${who}`,
        snippet: clap ? "👏 Aplauze trimise." : "👉 Te ajung din urmă!",
        context: "Clasament", createdAt: new Date(r.created_at).getTime(),
      };
    }),
  ];

  return rows
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((r) => ({ ...r, authorId: 0, name: "Tu", read: true, goSection: null, time: rel(r.createdAt) }));
}

/** Real counts of what I've contributed (used to derive badges). */
export async function fetchMyContributionCounts() {
  const uid = CURRENT_USER.authId;
  if (!uid) return { posts: 0, comments: 0, likes: 0, given: 0 };
  const count = async (table, extra = (q) => q) => {
    const { count: n } = await extra(
      supabase.from(table).select("*", { count: "exact", head: true }).eq(table === "post_reactions" ? "user_id" : "author_id", uid)
    );
    return n || 0;
  };
  const [posts, comments, likes] = await Promise.all([
    count("posts"),
    count("comments"),
    count("post_reactions", (q) => q.eq("emoji", LIKE_EMOJI)),
  ]);
  return { posts, comments, likes, given: posts + comments + likes };
}

/** The lesson slugs I have actually COMPLETED (lesson_progress). Used to derive
 *  the "10 lessons" / "all of morphology" badges from real progress instead of
 *  static flags. */
export async function fetchMyLessonSlugs() {
  const uid = CURRENT_USER.authId;
  if (!uid) return new Set();
  const { data, error } = await supabase
    .from("lesson_progress").select("lesson_slug").eq("user_id", uid);
  if (error) {
    console.warn("fetchMyLessonSlugs:", error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.lesson_slug));
}

// ---------------------------------------------------------
// @mention → a REAL notification for the mentioned friend (RPC, 0023).
// The server forces the actor to be you and enforces friends-only.
// ---------------------------------------------------------
export async function notifyMention(userSurrogate, snippet, context) {
  const to = uuidForSurrogate(userSurrogate);
  if (!to) return null;
  const { data, error } = await supabase.rpc("notify_mention", {
    p_user: to, p_snippet: String(snippet || "").slice(0, 120), p_context: String(context || "").slice(0, 80),
  });
  if (error) {
    console.warn("notifyMention:", error.message);
    return null;
  }
  return data;
}

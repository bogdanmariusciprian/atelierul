// =========================================================
// Forum data layer (Supabase) → mapped into the hub's existing MOCK shapes.
//
// community.js is wired to NUMERIC ids everywhere (posts/users/comments via
// Number(id)). Real Supabase ids are uuids. Each real post/user/comment gets
// a client-side NUMERIC "surrogate" id; maps translate them back to uuids for
// writes. The render plumbing stays untouched. My OWN content maps to author
// id 0 (the "me" sentinel). Real users have no gif → the hub shows initials.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER } from "./session.js";
import { sanitizeRich } from "./rich-text.js";
import { registerRealUser, initials as initialsOf } from "./community-data.js";
import { relTime } from "./forum-data.js";

let _userSurrogate = 1_000_000;
let _postSurrogate = 2_000_000;
let _commentSurrogate = 3_000_000;
const userSurrByUuid = new Map(); // profile uuid -> numeric
const postUuidBySurr = new Map(); // numeric -> post uuid
const commentUuidBySurr = new Map(); // numeric -> comment uuid
const userUuidBySurr = new Map(); // numeric user surrogate -> profile uuid

const LIKE_EMOJI = "♥"; // a "like" is stored as a ♥ reaction row

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export function postUuid(surrogateId) {
  return postUuidBySurr.get(surrogateId) || null;
}
export function mapPostSurrogate(surrogateId, uuid) {
  if (surrogateId && uuid) postUuidBySurr.set(surrogateId, uuid);
}
/** Reverse: the numeric surrogate for a real post uuid (once the feed mapped
 *  it), so a notification's post uuid can open the exact post. null if unknown. */
export function surrogateForPostUuid(uuid) {
  if (!uuid) return null;
  for (const [sid, u] of postUuidBySurr) if (u === uuid) return sid;
  return null;
}

/** Group creator/admin: pin or unpin a post inside a group (RLS-checked RPC). */
export async function pinGroupPost(postSurrogate, pinned) {
  const uuid = postUuidBySurr.get(postSurrogate);
  if (!uuid) return;
  const { error } = await supabase.rpc("set_group_pin", { p_post: uuid, p_pinned: !!pinned });
  if (error) console.warn("pinGroupPost:", error.message);
}
export function mapComment(surrogateId, uuid) {
  if (surrogateId && uuid) commentUuidBySurr.set(surrogateId, uuid);
}
/** The real Supabase uuid behind a numeric surrogate user id (or null for a
 *  seed/mock user that has none). Lets the hub fetch a real member's profile. */
export function uuidForSurrogate(surrogateId) {
  return userUuidBySurr.get(surrogateId) || null;
}

/** Surrogate id for a profile UUID, if that user is already in the registry
 *  (registered when the feed / member list loaded). 0 = me, null = unknown.
 *  Used to turn a notification's `actor` uuid into a clickable profile. */
export function surrogateByUuid(uuid) {
  if (!uuid) return null;
  if (uuid === CURRENT_USER.authId) return 0;
  return userSurrByUuid.get(uuid) ?? null;
}

export function surrogateForAuthor(profile) {
  const myUuid = CURRENT_USER.authId;
  if (myUuid && profile.id === myUuid) return 0; // "me"
  const existing = userSurrByUuid.get(profile.id);
  if (existing) return existing;
  const sid = ++_userSurrogate;
  userSurrByUuid.set(profile.id, sid);
  userUuidBySurr.set(sid, profile.id);
  const isAdminUser = profile.role === "admin";
  registerRealUser({
    id: sid,
    real: true,
    // The teacher is always the 🎓 avatar; members show their chosen gif (or
    // initials if they haven't picked one).
    avatar: isAdminUser ? null : profile.avatar || null,
    name: isAdminUser ? "Profesor" : profile.display_name || "Membru",
    initials: isAdminUser ? "🎓" : initialsOf(profile.display_name || "Membru"),
    color: profile.avatar_color || "#7c5cff",
    points: profile.points || 0,
    streak: 0,
    lessons: 0,
    status: profile.status_line || "",
    role: profile.role || "member",
    lastSeen: profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0,
  });
  return sid;
}

function authorFields(author) {
  const authorId = surrogateForAuthor(author);
  const isMe = authorId === 0;
  return {
    authorId,
    name: isMe ? CURRENT_USER.name : author.display_name || "Membru",
    initials: isMe ? CURRENT_USER.initials : initialsOf(author.display_name || "Membru"),
    color: isMe ? CURRENT_USER.color : author.avatar_color || "#7c5cff",
  };
}

function mapPost(row) {
  const sid = ++_postSurrogate;
  postUuidBySurr.set(sid, row.id);
  const createdAt = new Date(row.created_at).getTime();
  return {
    id: sid,
    ...authorFields(row.author || {}),
    createdAt,
    time: relTime(Math.max(0, Date.now() - createdAt)),
    type: row.type,
    bg: row.background || "none",
    audience: row.audience || "public",
    surface: row.surface || "forum",
    // sanitizeRich, not a blanket escape: it escapes every text node and drops
    // ALL attributes, rebuilding only a whitelist of inline tags (b/i/u/s/sup/
    // mark/br). Same XSS guarantee as before, but bold and italics survive —
    // which is what makes a posted test item readable.
    text: sanitizeRich(row.body || ""),
    media: row.media || null,
    edited: !!row.edited_at,
    pinned: !!row.pinned,
    // Made by the game → text can't be edited. The body check is a fallback for
    // captures posted before the column existed, so they behave correctly too.
    generated: !!row.generated || /^🏅 Item de admitere/.test(row.body || ""),
    generatedFrom: row.generated_from || null,
    likes: 0,
    likedByMe: false,
    shares: 0,
    sharedByMe: false,
    followed: false,
    savedByMe: false,
    comments: [],
  };
}

function mapCommentRow(row, childrenByParent, commentByUuid) {
  const kids = (childrenByParent.get(row.id) || []).map((r) =>
    mapCommentRow(r, childrenByParent, commentByUuid)
  );
  const sid = ++_commentSurrogate;
  commentUuidBySurr.set(sid, row.id);
  const createdAt = new Date(row.created_at).getTime();
  const obj = {
    id: sid,
    ...authorFields(row.author || {}),
    createdAt,
    time: relTime(Math.max(0, Date.now() - createdAt)),
    text: esc(row.body || ""),
    likes: 0,
    likedByMe: false,
    reactions: {},
    myReaction: null,
    edited: !!row.edited_at,
    correct: !!row.correct, // teacher marked it as the right answer (persisted)
    replies: kids,
  };
  commentByUuid.set(row.id, obj);
  return obj;
}

/** Fill in ♥ likes + emoji reactions for a batch of mapped comments (shared by
 *  the forum feed AND lesson comments, so both behave identically). */
async function enrichCommentReactions(commentByUuid, myUuid) {
  const commentIds = [...commentByUuid.keys()];
  if (!commentIds.length) return;
  const { data: cReacts } = await supabase
    .from("comment_reactions")
    .select("comment_id, user_id, emoji")
    .in("comment_id", commentIds);
  if (!cReacts) return;
  for (const [uuid, c] of commentByUuid) {
    const rows = cReacts.filter((r) => r.comment_id === uuid);
    c.likes = rows.filter((r) => r.emoji === LIKE_EMOJI).length;
    c.likedByMe = !!myUuid && rows.some((r) => r.emoji === LIKE_EMOJI && r.user_id === myUuid);
    const reactions = {};
    let myReaction = null;
    for (const r of rows) {
      if (r.emoji === LIKE_EMOJI) continue;
      reactions[r.emoji] = (reactions[r.emoji] || 0) + 1;
      if (myUuid && r.user_id === myUuid) myReaction = r.emoji;
    }
    c.reactions = reactions;
    c.myReaction = myReaction;
  }
}

/** Recent forum posts (newest first) WITH comments, likes, reactions and the
 *  current user's saved/liked state. RLS decides visibility. */
export async function fetchFeed({ limit = 40, surface = "forum", groupId = null } = {}) {
  const myUuid = CURRENT_USER.authId;

  let sel = supabase
    .from("posts")
    .select(
      "id, author_id, body, type, background, audience, share_of, surface, group_id, media, pinned, generated, generated_from, created_at, edited_at, author:profiles!posts_author_id_fkey(id, display_name, avatar_color, avatar, points, last_seen_at, role)"
    )
    .eq("moderation_status", "visible")
    .is("share_of", null);
  // A group's wall shows its own posts; the main forum / wall feeds must
  // EXCLUDE group posts (group_id IS NULL).
  sel = groupId ? sel.eq("group_id", groupId) : sel.eq("surface", surface).is("group_id", null);
  const { data: postRows, error } = await sel
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("fetchFeed:", error.message);
    return [];
  }

  const posts = [];
  const byUuid = new Map();
  for (const row of postRows || []) {
    const p = mapPost(row);
    byUuid.set(row.id, p);
    posts.push(p);
  }
  if (posts.length === 0) return posts;
  const postIds = [...byUuid.keys()];

  // --- Comments (nested) ---
  const commentByUuid = new Map();
  const { data: commentRows, error: cErr } = await supabase
    .from("comments")
    .select(
      "id, post_id, parent_id, body, edited_at, correct, created_at, author:profiles!comments_author_id_fkey(id, display_name, avatar_color, avatar, points, last_seen_at, role)"
    )
    .in("post_id", postIds)
    .eq("moderation_status", "visible")
    .order("created_at", { ascending: true });
  if (cErr) {
    console.warn("fetchFeed comments:", cErr.message);
  } else {
    const childrenByParent = new Map();
    const topByPost = new Map();
    for (const row of commentRows || []) {
      if (row.parent_id) {
        if (!childrenByParent.has(row.parent_id)) childrenByParent.set(row.parent_id, []);
        childrenByParent.get(row.parent_id).push(row);
      } else {
        if (!topByPost.has(row.post_id)) topByPost.set(row.post_id, []);
        topByPost.get(row.post_id).push(row);
      }
    }
    for (const [uuid, p] of byUuid) {
      p.comments = (topByPost.get(uuid) || []).map((r) =>
        mapCommentRow(r, childrenByParent, commentByUuid)
      );
    }
  }

  // --- Post likes (♥) ---
  const { data: postLikes } = await supabase
    .from("post_reactions")
    .select("post_id, user_id")
    .in("post_id", postIds)
    .eq("emoji", LIKE_EMOJI);
  if (postLikes) {
    for (const [uuid, p] of byUuid) {
      p.likes = postLikes.filter((r) => r.post_id === uuid).length;
      p.likedByMe = !!myUuid && postLikes.some((r) => r.post_id === uuid && r.user_id === myUuid);
    }
  }

  // --- Comment likes (♥) + emoji reactions ---
  await enrichCommentReactions(commentByUuid, myUuid);

  // --- Saved posts (this user) ---
  if (myUuid) {
    const { data: savedRows } = await supabase
      .from("saved_posts")
      .select("post_id")
      .eq("user_id", myUuid);
    if (savedRows) {
      const savedSet = new Set(savedRows.map((r) => r.post_id));
      for (const [uuid, p] of byUuid) p.savedByMe = savedSet.has(uuid);
    }
  }

  return posts;
}

// ---------------------------------------------------------
// Writes. All fire-and-forget from the hub (optimistic UI already updated).
// supabase-js returns { error } instead of throwing, so no unhandled rejects.
// ---------------------------------------------------------
export async function createPost({ type, bg, audience, text, media, surface, groupId = null, generated = false, generatedFrom = null }) {
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: CURRENT_USER.authId,
      body: text,
      type: type || "discutie",
      background: bg || "none",
      audience: audience || "public",
      surface: surface === "wall" ? "wall" : "forum",
      media: media ?? null,
      group_id: groupId,
      generated: !!generated, // a game-made capture: its body is locked server-side
      generated_from: generatedFrom, // which game it came from → frame colour
    })
    .select("id")
    .single();
  if (error) {
    console.warn("createPost:", error.message);
    return null;
  }
  return data;
}

export async function updatePost(postSurrogate, text) {
  const pid = postUuidBySurr.get(postSurrogate);
  if (!pid) return;
  await supabase.from("posts").update({ body: text, edited_at: new Date().toISOString() }).eq("id", pid);
}

export async function deletePost(postSurrogate) {
  const pid = postUuidBySurr.get(postSurrogate);
  if (!pid) return;
  await supabase.from("posts").delete().eq("id", pid);
}

export async function togglePostLike(postSurrogate, liked) {
  const pid = postUuidBySurr.get(postSurrogate);
  if (!pid || !CURRENT_USER.authId) return;
  if (liked) {
    await supabase.from("post_reactions").insert({ post_id: pid, user_id: CURRENT_USER.authId, emoji: LIKE_EMOJI });
  } else {
    await supabase.from("post_reactions").delete().eq("post_id", pid).eq("user_id", CURRENT_USER.authId).eq("emoji", LIKE_EMOJI);
  }
}

export async function toggleSave(postSurrogate, saved) {
  const pid = postUuidBySurr.get(postSurrogate);
  if (!pid || !CURRENT_USER.authId) return;
  if (saved) {
    await supabase.from("saved_posts").insert({ post_id: pid, user_id: CURRENT_USER.authId });
  } else {
    await supabase.from("saved_posts").delete().eq("post_id", pid).eq("user_id", CURRENT_USER.authId);
  }
}

export async function createComment({ postSurrogate, parentSurrogate = null, text }) {
  const postId = postUuidBySurr.get(postSurrogate);
  if (!postId) return null;
  const parentId = parentSurrogate ? commentUuidBySurr.get(parentSurrogate) : null;
  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, parent_id: parentId, author_id: CURRENT_USER.authId, body: text })
    .select("id")
    .single();
  if (error) {
    console.warn("createComment:", error.message);
    return null;
  }
  return data;
}

// ---------------------------------------------------------
// LESSON comments — same `comments` table, keyed by lesson_slug instead of
// post_id. Threaded, public-readable. Edit/delete/like reuse the comment
// helpers below (they work off the comment surrogate, regardless of target).
// ---------------------------------------------------------
export async function fetchLessonComments(slug) {
  const myUuid = CURRENT_USER.authId;
  const { data: rows, error } = await supabase
    .from("comments")
    .select(
      "id, lesson_slug, parent_id, body, edited_at, correct, created_at, author:profiles!comments_author_id_fkey(id, display_name, avatar_color, avatar, points, last_seen_at, role)"
    )
    .eq("lesson_slug", slug)
    .eq("moderation_status", "visible")
    .order("created_at", { ascending: true });
  if (error) { console.warn("fetchLessonComments:", error.message); return []; }
  const childrenByParent = new Map();
  const top = [];
  for (const r of rows || []) {
    if (r.parent_id) {
      if (!childrenByParent.has(r.parent_id)) childrenByParent.set(r.parent_id, []);
      childrenByParent.get(r.parent_id).push(r);
    } else top.push(r);
  }
  const commentByUuid = new Map();
  const tree = top.map((r) => mapCommentRow(r, childrenByParent, commentByUuid));
  await enrichCommentReactions(commentByUuid, myUuid);
  return tree;
}

/** Post a lesson comment (top-level or a threaded reply). Returns { id }. */
export async function addLessonComment({ lessonSlug, parentSurrogate = null, text }) {
  const parentId = parentSurrogate ? commentUuidBySurr.get(parentSurrogate) : null;
  const { data, error } = await supabase
    .from("comments")
    .insert({ lesson_slug: lessonSlug, parent_id: parentId, author_id: CURRENT_USER.authId, body: text })
    .select("id")
    .single();
  if (error) { console.warn("addLessonComment:", error.message); return null; }
  return data;
}

/** Teacher: mark a comment (forum reply OR lesson comment) as the CORRECT
 *  answer. The SERVER flips the flag and awards/takes back the reward for the
 *  author via points_ledger (cheat-safe, idempotent). Works on any comment,
 *  since it's keyed by the comment surrogate. Returns { correct, awarded }. */
export async function markCommentCorrect(commentSurrogate, on) {
  const cid = commentUuidBySurr.get(commentSurrogate);
  if (!cid) return null;
  const { data, error } = await supabase.rpc("mark_comment_correct", { p_comment: cid, p_on: !!on });
  if (error) {
    console.warn("markCommentCorrect:", error.message);
    return null;
  }
  return data;
}

export async function updateComment(commentSurrogate, text) {
  const cid = commentUuidBySurr.get(commentSurrogate);
  if (!cid) return;
  await supabase.from("comments").update({ body: text, edited_at: new Date().toISOString() }).eq("id", cid);
}

export async function deleteComment(commentSurrogate) {
  const cid = commentUuidBySurr.get(commentSurrogate);
  if (!cid) return;
  await supabase.from("comments").delete().eq("id", cid);
}

export async function toggleCommentLike(commentSurrogate, liked) {
  const cid = commentUuidBySurr.get(commentSurrogate);
  if (!cid || !CURRENT_USER.authId) return;
  if (liked) {
    await supabase.from("comment_reactions").insert({ comment_id: cid, user_id: CURRENT_USER.authId, emoji: LIKE_EMOJI });
  } else {
    await supabase.from("comment_reactions").delete().eq("comment_id", cid).eq("user_id", CURRENT_USER.authId).eq("emoji", LIKE_EMOJI);
  }
}

// ---------------------------------------------------------
// Friends (friendships). Surrogate ids ↔ uuids as everywhere.
// ---------------------------------------------------------
/** The current user's friend graph as surrogate ids:
 *  { friendIds, incoming (they asked me), outgoing (I asked them) }. */
export async function fetchMyFriends() {
  const me = CURRENT_USER.authId;
  const empty = { friendIds: [], incoming: [], outgoing: [] };
  if (!me) return empty;
  const { data, error } = await supabase
    .from("friendships")
    .select(
      "requester_id, addressee_id, status, requester:profiles!friendships_requester_id_fkey(id,display_name,avatar_color,avatar,points,last_seen_at,role), addressee:profiles!friendships_addressee_id_fkey(id,display_name,avatar_color,avatar,points,last_seen_at,role)"
    )
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
  if (error) {
    console.warn("fetchMyFriends:", error.message);
    return empty;
  }
  const out = { friendIds: [], incoming: [], outgoing: [] };
  for (const f of data || []) {
    const iAmRequester = f.requester_id === me;
    const other = iAmRequester ? f.addressee : f.requester;
    if (!other) continue;
    const sid = surrogateForAuthor(other); // registers + maps the other user
    if (f.status === "accepted") out.friendIds.push(sid);
    else if (iAmRequester) out.outgoing.push(sid);
    else out.incoming.push(sid);
  }
  return out;
}

/** The member directory — real users from `profiles`, for the leaderboard,
 *  discovery and (later) messaging partners. Each is registered as a surrogate
 *  user so the numeric-id render helpers resolve them; returns their surrogate
 *  ids ordered by points (highest first). The current user maps to id 0 ("me").
 *  The teacher (admin) is excluded — he isn't in the game. Works for guests too
 *  (public leaderboard). */
export async function fetchMembers({ limit = 200 } = {}) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_color, avatar, status_line, points, last_seen_at, role")
    .eq("role", "member")
    .order("points", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("fetchMembers:", error.message);
    return [];
  }
  return (data || []).map((p) => surrogateForAuthor(p));
}

/** My real points history (append-only ledger, newest first). Each row:
 *  { points, reason, when(ms) } — the UI turns `reason` into a friendly label. */
export async function fetchPointsHistory(limit = 50) {
  const me = CURRENT_USER.authId;
  if (!me) return [];
  const { data, error } = await supabase
    .from("points_ledger")
    .select("delta, reason, created_at")
    .eq("user_id", me)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.warn("fetchPointsHistory:", error.message); return []; }
  return (data || []).map((r) => ({ points: r.delta, reason: r.reason, when: new Date(r.created_at).getTime() }));
}

// ---- Favorites (Lecțiile mele) — real, per account ----
export async function fetchFavorites() {
  const me = CURRENT_USER.authId;
  if (!me) return [];
  const { data, error } = await supabase.from("favorites")
    .select("lesson_slug").eq("user_id", me).order("created_at", { ascending: false });
  if (error) { console.warn("fetchFavorites:", error.message); return []; }
  return (data || []).map((r) => r.lesson_slug);
}
export async function addFavorite(slug) {
  if (!slug || !CURRENT_USER.authId) return;
  const { error } = await supabase.from("favorites").insert({ user_id: CURRENT_USER.authId, lesson_slug: slug });
  if (error && error.code !== "23505") console.warn("addFavorite:", error.message);
}
export async function removeFavorite(slug) {
  if (!slug || !CURRENT_USER.authId) return;
  await supabase.from("favorites").delete().eq("user_id", CURRENT_USER.authId).eq("lesson_slug", slug);
}

// ---- Finished lessons (real, cross-device) — reads lesson_progress (0002) ----
export async function fetchMyLessonProgress() {
  const me = CURRENT_USER.authId;
  if (!me) return new Set();
  const { data, error } = await supabase.from("lesson_progress").select("lesson_slug").eq("user_id", me);
  if (error) { console.warn("fetchMyLessonProgress:", error.message); return new Set(); }
  return new Set((data || []).map((r) => r.lesson_slug));
}

/** ADMIN ONLY — the full REAL member directory for the teacher's Utilizatori
 *  panel, with e-mail. Each row is registered in the surrogate bridge (so the
 *  render helpers resolve them AND the teacher can message them), returned as
 *  { id: surrogate, name, points, email, role, joinedAt, lastSeen, status }. */
export async function adminFetchUsers() {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) {
    console.warn("adminFetchUsers:", error.message);
    return [];
  }
  return (data || []).map((p) => ({
    id: surrogateForAuthor(p),                 // registers in the bridge → messageable + clickable
    name: p.display_name || "Membru",
    points: p.points || 0,
    email: p.email || "",
    role: p.role || "member",
    status: p.status_line || "",
    joinedAt: p.created_at ? new Date(p.created_at).getTime() : 0,
    lastSeen: p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0,
  }));
}

export async function sendFriendRequest(userSurrogate) {
  const other = userUuidBySurr.get(userSurrogate);
  if (!other || !CURRENT_USER.authId) return;
  await supabase.from("friendships").insert({
    requester_id: CURRENT_USER.authId,
    addressee_id: other,
    status: "pending",
  });
}

export async function cancelFriendRequest(userSurrogate) {
  const other = userUuidBySurr.get(userSurrogate);
  if (!other || !CURRENT_USER.authId) return;
  await supabase.from("friendships").delete()
    .eq("requester_id", CURRENT_USER.authId).eq("addressee_id", other);
}

export async function acceptFriendRequest(userSurrogate) {
  const other = userUuidBySurr.get(userSurrogate);
  if (!other || !CURRENT_USER.authId) return;
  await supabase.from("friendships").update({ status: "accepted" })
    .eq("requester_id", other).eq("addressee_id", CURRENT_USER.authId);
}

export async function declineFriendRequest(userSurrogate) {
  const other = userUuidBySurr.get(userSurrogate);
  if (!other || !CURRENT_USER.authId) return;
  await supabase.from("friendships").delete()
    .eq("requester_id", other).eq("addressee_id", CURRENT_USER.authId);
}

export async function removeFriend(userSurrogate) {
  const other = userUuidBySurr.get(userSurrogate);
  if (!other || !CURRENT_USER.authId) return;
  const me = CURRENT_USER.authId;
  await supabase.from("friendships").delete().or(
    `and(requester_id.eq.${me},addressee_id.eq.${other}),and(requester_id.eq.${other},addressee_id.eq.${me})`
  );
}

// ---------------------------------------------------------
// Messaging (real). Member↔member (templates), member→teacher (free text),
// teacher→member (free text). Mapped into the hub's conversation shape.
// ---------------------------------------------------------
const MSG_PROFILE_SEL =
  "sender:profiles!messages_sender_id_fkey(id,display_name,avatar_color,avatar,points,last_seen_at,role), " +
  "recipient:profiles!messages_recipient_id_fkey(id,display_name,avatar_color,avatar,points,last_seen_at,role)";

/** My conversations, grouped by partner, in the hub's shape:
 *  [{ key, partnerId(surrogate), partnerName, teacher, guest, msgs[], unread }].
 *  A message: { id, fromId(0=me), fromTeacher, text, createdAt, read, template }. */
export async function fetchConversations(asAdmin = false) {
  const me = CURRENT_USER.authId;
  if (!me) return [];
  const filter = asAdmin ? `to_admin.eq.true,sender_id.eq.${me}` : `sender_id.eq.${me},recipient_id.eq.${me}`;
  const { data, error } = await supabase
    .from("messages")
    .select(`id, sender_id, recipient_id, to_admin, body, template_key, guest_name, guest_email, created_at, read_at, ${MSG_PROFILE_SEL}`)
    .or(filter)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("fetchConversations:", error.message);
    return [];
  }
  const map = new Map();
  for (const m of data || []) {
    const senderIsAdmin = m.sender?.role === "admin";
    const iAmSender = m.sender_id === me;
    let key, partnerId = null, partnerName = "Membru", teacher = false, guest = false, guestEmail = null;
    if (asAdmin) {
      const incoming = m.to_admin;
      if (incoming && m.sender_id == null) {
        // Guest contact — grouped by e-mail (or name), so the teacher can reply.
        const gid = m.guest_email || m.guest_name || "vizitator";
        key = `g:${gid}`;
        partnerName = m.guest_name || "Vizitator";
        guestEmail = m.guest_email || null;
        guest = true;
      } else {
        const other = incoming ? m.sender : m.recipient;
        partnerId = other ? surrogateForAuthor(other) : null;
        key = `u${partnerId}`;
        partnerName = other?.display_name || "Membru";
      }
    } else if (m.to_admin || senderIsAdmin) {
      key = "t"; partnerName = "Profesorul"; teacher = true;
    } else {
      const other = iAmSender ? m.recipient : m.sender;
      partnerId = other ? surrogateForAuthor(other) : null;
      key = `u${partnerId}`;
      partnerName = other?.display_name || "Membru";
    }
    if (!key) continue;
    if (!map.has(key)) map.set(key, { key, partnerId, partnerName, teacher, guest, guestEmail, msgs: [], unread: 0 });
    const conv = map.get(key);
    const read = !!m.read_at;
    const mine = asAdmin ? senderIsAdmin : iAmSender;
    conv.msgs.push({
      id: m.id,
      fromId: mine ? 0 : (partnerId ?? 0),
      fromTeacher: senderIsAdmin,
      text: m.body,
      createdAt: new Date(m.created_at).getTime(),
      read,
      template: !!m.template_key,
    });
    if (!mine && !read) conv.unread++;
  }
  return [...map.values()].sort(
    (a, b) => (b.msgs[b.msgs.length - 1]?.createdAt || 0) - (a.msgs[a.msgs.length - 1]?.createdAt || 0)
  );
}

/** Member → member: a template message (server requires template_key). */
export async function sendTemplateMsg(recipientSurrogate, body, templateKey) {
  const to = uuidForSurrogate(recipientSurrogate);
  if (!to || !CURRENT_USER.authId) return null;
  const { data, error } = await supabase
    .from("messages")
    .insert({ sender_id: CURRENT_USER.authId, recipient_id: to, to_admin: false, body, template_key: templateKey || "tpl" })
    .select("id").single();
  if (error) { console.warn("sendTemplateMsg:", error.message); return null; }
  return data;
}

/** Member → teacher: free text. */
export async function sendTeacherMsg(body) {
  if (!CURRENT_USER.authId) return null;
  const { data, error } = await supabase
    .from("messages")
    .insert({ sender_id: CURRENT_USER.authId, recipient_id: null, to_admin: true, body })
    .select("id").single();
  if (error) { console.warn("sendTeacherMsg:", error.message); return null; }
  return data;
}

/** Guest (signed-out) → teacher: a contact message with an e-mail for the
 *  reply. Goes through a public SECURITY DEFINER RPC (anon can't insert). */
export async function contactTeacher(name, email, body) {
  const { error } = await supabase.rpc("contact_teacher", {
    p_name: name || null,
    p_email: email || null,
    p_body: body,
  });
  if (error) {
    console.warn("contactTeacher:", error.message);
    return false;
  }
  return true;
}

/** Teacher → member: free text (admin only). */
export async function sendTeacherReply(recipientSurrogate, body) {
  const to = uuidForSurrogate(recipientSurrogate);
  if (!to || !CURRENT_USER.authId) return null;
  const { error } = await supabase
    .from("messages")
    .insert({ sender_id: CURRENT_USER.authId, recipient_id: to, to_admin: false, body });
  if (error) console.warn("sendTeacherReply:", error.message);
}

// ---- Notifications (real; generated server-side by triggers, 0016) ----
/** The current user's notifications, newest first. */
export async function fetchNotifications(limit = 30) {
  const me = CURRENT_USER.authId;
  if (!me) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, payload, read_at, created_at")
    .eq("user_id", me)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.warn("fetchNotifications:", error.message); return []; }
  return data || [];
}

/** Mark specific notifications (by id) as read. */
export async function markNotificationsRead(ids) {
  if (!ids || !ids.length || !CURRENT_USER.authId) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
}

/** Delete ALL of my notifications ("șterge tot"). */
export async function deleteAllNotifications() {
  if (!CURRENT_USER.authId) return;
  await supabase.from("notifications").delete().eq("user_id", CURRENT_USER.authId);
}

/** The teacher's last_seen (ms) so a pupil's messenger can show the teacher as
 *  "active now". last_seen_at is a public-safe column (0009). 0 if unknown. */
export async function fetchTeacherPresence() {
  try {
    const { data } = await supabase
      .from("profiles").select("last_seen_at").eq("role", "admin").limit(1).maybeSingle();
    return data?.last_seen_at ? new Date(data.last_seen_at).getTime() : 0;
  } catch {
    return 0;
  }
}

/** Report content for the teacher's queue: a post/comment/test_item/exercise
 *  (the last two = "⚑ semnalează o eroare de conținut"). targetUuid = real uuid. */
export async function reportContent(targetType, targetUuid, reason) {
  if (!targetUuid || !CURRENT_USER.authId) return false;
  const { error } = await supabase.from("reports").insert({
    reporter_id: CURRENT_USER.authId, target_type: targetType, target_id: targetUuid, reason: reason || null,
  });
  if (error && error.code !== "23505") { console.warn("reportContent:", error.message); return false; }
  return true;
}

/** Report a post by its numeric surrogate id (maps to the real uuid, then to `reports`). */
export async function reportPostBySurrogate(postSurrogate, reason) {
  const pid = postUuidBySurr.get(postSurrogate);
  if (!pid) return false;
  return reportContent("post", pid, reason);
}
/** Report a comment by its numeric surrogate id (maps to the real uuid, then to `reports`). */
export async function reportCommentBySurrogate(commentSurrogate, reason) {
  const cid = commentUuidBySurr.get(commentSurrogate);
  if (!cid) return false;
  return reportContent("comment", cid, reason);
}

/** Count of everything awaiting the teacher: open reports + filter-held content.
 *  Used for the global admin badge/pulse (replaces the old mock queue count). */
export async function fetchOpenModerationCount() {
  try {
    const [reports, held] = await Promise.all([fetchContentReports(), fetchHeldContent()]);
    return reports.length + held.length;
  } catch { return 0; }
}

/** Admin: open reports (newest first), with the reporter's display name. */
export async function fetchContentReports() {
  const { data, error } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, status, meta, reporter_id, created_at, reporter:profiles!reports_reporter_id_fkey(display_name)")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) { console.warn("fetchContentReports:", error.message); return []; }
  return (data || []).map((r) => ({
    id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason,
    meta: r.meta || {},
    // No reporter → a signed-out visitor flagged it; there's nobody to reply to.
    reporterId: r.reporter_id || null,
    createdAt: new Date(r.created_at).getTime(),
    reporterName: r.reporter?.display_name || (r.reporter_id ? "Cineva" : "Vizitator"),
  }));
}

/** Close a content report. Founded → the pupil gets a notification + points;
 *  unfounded → the teacher's note lands in their inbox. Server-enforced. */
export async function resolveTestReport(id, founded, note) {
  if (!id) return false;
  const { error } = await supabase.rpc("resolve_test_report", {
    p_report: id, p_founded: !!founded, p_note: note || null,
  });
  if (error) { console.warn("resolveTestReport:", error.message); return false; }
  return true;
}

/** Admin: mark a report resolved. */
export async function resolveReport(id) {
  if (!id) return;
  await supabase.from("reports").update({ status: "resolved" }).eq("id", id);
}

// ---- Custom profanity terms (admin-managed; also used by the server trigger) ----
export async function fetchProfanityTerms() {
  const { data, error } = await supabase.from("profanity_terms").select("id, term").order("term");
  if (error) { console.warn("fetchProfanityTerms:", error.message); return []; }
  return data || [];
}
export async function addProfanityTerm(term) {
  const t = (term || "").trim().toLowerCase();
  if (!t || !CURRENT_USER.authId) return null;
  const { data, error } = await supabase.from("profanity_terms")
    .insert({ term: t, added_by: CURRENT_USER.authId }).select("id, term").single();
  if (error) { console.warn("addProfanityTerm:", error.message); return null; }
  return data;
}
export async function removeProfanityTerm(id) {
  if (!id) return;
  await supabase.from("profanity_terms").delete().eq("id", id);
}

// ---- Held content (kept out of the feed by the profanity filter) — admin review ----
/** Admin: posts + comments with moderation_status='held', newest first. RLS
 *  already lets the admin read them (posts_read/comments_read include is_admin_user). */
export async function fetchHeldContent() {
  const [posts, comments] = await Promise.all([
    supabase.from("posts")
      .select("id, body, created_at, author:profiles!posts_author_id_fkey(display_name)")
      .eq("moderation_status", "held").order("created_at", { ascending: false }),
    supabase.from("comments")
      .select("id, body, created_at, author:profiles!comments_author_id_fkey(display_name)")
      .eq("moderation_status", "held").order("created_at", { ascending: false }),
  ]);
  const map = (res, kind) => (res.data || []).map((r) => ({
    kind, id: r.id, body: r.body, createdAt: new Date(r.created_at).getTime(),
    authorName: r.author?.display_name || "Membru",
  }));
  return [...map(posts, "post"), ...map(comments, "comment")].sort((a, b) => b.createdAt - a.createdAt);
}

/** Admin: set moderation status — 'visible' (publish) or 'blocked' (hide). RLS
 *  posts_update/comments_update already allow the admin. */
export async function moderateContent(kind, id, status) {
  if (!id) return;
  const table = kind === "comment" ? "comments" : "posts";
  const { error } = await supabase.from(table).update({ moderation_status: status }).eq("id", id);
  if (error) console.warn("moderateContent:", error.message);
}

// ---- Blocks (mute a member: hide their content; manage only your own) ----
/** Set of surrogate ids I've blocked (registers them so userById resolves). */
export async function fetchMyBlocks() {
  const me = CURRENT_USER.authId;
  if (!me) return new Set();
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id, blocked:profiles!user_blocks_blocked_id_fkey(id, display_name, avatar_color, avatar, status_line, points, last_seen_at, role)")
    .eq("blocker_id", me);
  if (error) { console.warn("fetchMyBlocks:", error.message); return new Set(); }
  const set = new Set();
  for (const r of data || []) if (r.blocked) set.add(surrogateForAuthor(r.blocked));
  return set;
}
export async function blockUser(surrogate) {
  const uuid = uuidForSurrogate(surrogate);
  if (!uuid || !CURRENT_USER.authId) return;
  const { error } = await supabase.from("user_blocks").insert({ blocker_id: CURRENT_USER.authId, blocked_id: uuid });
  if (error && error.code !== "23505") console.warn("blockUser:", error.message);
}
export async function unblockUser(surrogate) {
  const uuid = uuidForSurrogate(surrogate);
  if (!uuid || !CURRENT_USER.authId) return;
  await supabase.from("user_blocks").delete().eq("blocker_id", CURRENT_USER.authId).eq("blocked_id", uuid);
}

/** Purge MY read notifications older than `days` — keeps the tray from growing
 *  forever (the "stuck notifications" fix). Best-effort. */
export async function purgeOldReadNotifications(days = 7) {
  if (!CURRENT_USER.authId) return;
  const cutoff = new Date(Date.now() - days * 864e5).toISOString();
  await supabase.from("notifications").delete()
    .eq("user_id", CURRENT_USER.authId)
    .not("read_at", "is", null)
    .lt("read_at", cutoff);
}

/** Realtime: run `onInsert(row)` whenever a row is INSERTed into `table` that
 *  this user is allowed to see (RLS applies to realtime too). Returns the channel
 *  so the caller can unsubscribe. Best-effort — never throws. */
export function subscribeInserts(table, onInsert) {
  try {
    return supabase
      .channel(`rt:${table}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table }, (payload) => {
        try { onInsert(payload.new); } catch { /* ignore */ }
      })
      .subscribe();
  } catch {
    return null;
  }
}

// ---- Teacher's inbox labels (admin) + event-access (auto "Evenimente") ----
/** All conversation labels, keyed by member UUID → 'curent'|'incheiat'|'amanat'. */
export async function fetchConversationLabels() {
  const { data, error } = await supabase.from("conversation_labels").select("user_id, label");
  if (error) { console.warn("fetchConversationLabels:", error.message); return {}; }
  const out = {};
  for (const r of data || []) out[r.user_id] = r.label;
  return out;
}

/** Admin: set (or clear, when label is falsy) a member conversation's label. */
export async function setConversationLabel(memberSurrogate, label) {
  const uuid = uuidForSurrogate(memberSurrogate);
  if (!uuid) return;
  if (!label) {
    await supabase.from("conversation_labels").delete().eq("user_id", uuid);
  } else {
    await supabase.from("conversation_labels").upsert({ user_id: uuid, label, updated_at: new Date().toISOString() });
  }
}

/** Set of member UUIDs that have Events access (drives the auto "Evenimente"
 *  label). Admin sees every row (RLS: own or admin). */
export async function fetchEventAccessUsers() {
  const { data, error } = await supabase.from("event_access").select("user_id");
  if (error) { console.warn("fetchEventAccessUsers:", error.message); return new Set(); }
  return new Set((data || []).map((r) => r.user_id));
}

/** Member → member FREE text (max 30 chars), gated by a points-earned quota
 *  the SERVER enforces (send_free_message RPC). Returns { ok|error, allowance,
 *  used, remaining }. */
export async function sendFreeMsg(recipientSurrogate, body) {
  const to = uuidForSurrogate(recipientSurrogate);
  if (!to || !CURRENT_USER.authId) return null;
  const { data, error } = await supabase.rpc("send_free_message", { p_recipient: to, p_body: body });
  if (error) {
    console.warn("sendFreeMsg:", error.message);
    return { error: error.message };
  }
  return data;
}

/** Report a message to the teacher (moderation queue). */
export async function reportMessage(messageId, reason) {
  if (!messageId || !CURRENT_USER.authId) return;
  await supabase.from("reports").insert({
    reporter_id: CURRENT_USER.authId,
    target_type: "message",
    target_id: messageId,
    reason: reason || null,
  });
}

/** Mark the incoming (not-mine) messages of ONE conversation as read. */
export async function markConversationReadReal(conv, asAdmin) {
  if (!conv || !CURRENT_USER.authId) return;
  const ids = conv.msgs
    .filter((m) => {
      const mine = asAdmin ? m.fromTeacher : m.fromId === 0 && !m.fromTeacher;
      return !mine && !m.read;
    })
    .map((m) => m.id);
  if (!ids.length) return;
  await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", ids);
}

/** The current user's own profile (settings) row, or null.
 *  Via the get_my_profile() RPC: since migration 0009 locks the sensitive
 *  columns (names, school, town, class, passions, challenges) out of the
 *  public Data API, the owner reads their OWN full row through a
 *  security-definer function instead of a raw table select. */
export async function fetchMyProfile() {
  const me = CURRENT_USER.authId;
  if (!me) return null;
  const { data, error } = await supabase.rpc("get_my_profile");
  if (error) {
    console.warn("fetchMyProfile:", error.message);
    return null;
  }
  // The function returns the composite `profiles` row (object or 1-row array).
  return Array.isArray(data) ? data[0] || null : data || null;
}

/** Another member's profile, VISIBILITY-ENFORCED on the server.
 *  Returns the bounded public fields (never `challenges` unless you're the
 *  owner or the teacher), or null when the target's visibility forbids it. */
export async function fetchPublicProfile(uuid) {
  if (!uuid) return null;
  const { data, error } = await supabase.rpc("get_public_profile", { p_id: uuid });
  if (error) {
    console.warn("fetchPublicProfile:", error.message);
    return null;
  }
  return Array.isArray(data) ? data[0] || null : data || null;
}

/** Save edited profile fields to the current user's own row. */
export async function updateMyProfile(fields) {
  const me = CURRENT_USER.authId;
  if (!me) return;
  await supabase.from("profiles").update(fields).eq("id", me);
}

/** Whether the current user has been granted Events access by the teacher. */
export async function fetchMyEventsAccess() {
  if (!CURRENT_USER.authId) return false;
  const { data } = await supabase
    .from("event_access")
    .select("user_id")
    .eq("user_id", CURRENT_USER.authId)
    .maybeSingle();
  return !!data;
}

export async function toggleCommentReaction(commentSurrogate, emoji, added) {
  const cid = commentUuidBySurr.get(commentSurrogate);
  if (!cid || !CURRENT_USER.authId) return;
  if (added) {
    await supabase.from("comment_reactions").insert({ comment_id: cid, user_id: CURRENT_USER.authId, emoji });
  } else {
    await supabase.from("comment_reactions").delete().eq("comment_id", cid).eq("user_id", CURRENT_USER.authId).eq("emoji", emoji);
  }
}

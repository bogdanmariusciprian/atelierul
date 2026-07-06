// =========================================================
// Forum data layer (Supabase) → mapped into the hub's existing MOCK shapes.
//
// The hub (community.js) is wired to NUMERIC ids everywhere (posts/users/
// comments looked up with Number(id)). Real Supabase ids are uuids. To avoid
// rewriting hundreds of call sites, each real post/user/comment gets a
// client-side NUMERIC "surrogate" id, and maps translate them back to uuids
// for writes. The render plumbing stays untouched.
//
// My OWN content is mapped to author id 0 (the existing "me" sentinel) so the
// "is this mine?" logic keeps working. Real users have no gif → the hub
// renders their initials.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER } from "./session.js";
import { registerRealUser, initials as initialsOf } from "./community-data.js";
import { relTime } from "./forum-data.js";

let _userSurrogate = 1_000_000; // real user ids start above mock ids (1–30)
let _postSurrogate = 2_000_000;
let _commentSurrogate = 3_000_000;
const userSurrByUuid = new Map(); // profile uuid -> numeric
const postUuidBySurr = new Map(); // numeric -> post uuid
const commentUuidBySurr = new Map(); // numeric -> comment uuid

const LIKE_EMOJI = "♥"; // a "like" is stored as a ♥ reaction row

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/** Real uuid behind a surrogate id (for writes / debugging). */
export function postUuid(surrogateId) {
  return postUuidBySurr.get(surrogateId) || null;
}
/** Register a surrogate→uuid mapping (e.g. for an optimistic new post). */
export function mapPostSurrogate(surrogateId, uuid) {
  if (surrogateId && uuid) postUuidBySurr.set(surrogateId, uuid);
}
/** Register a surrogate→uuid mapping for a freshly created comment. */
export function mapComment(surrogateId, uuid) {
  if (surrogateId && uuid) commentUuidBySurr.set(surrogateId, uuid);
}

// A real author profile → a numeric id the render code understands.
function surrogateForAuthor(profile) {
  const myUuid = CURRENT_USER.authId;
  if (myUuid && profile.id === myUuid) return 0; // "me"
  const existing = userSurrByUuid.get(profile.id);
  if (existing) return existing;
  const sid = ++_userSurrogate;
  userSurrByUuid.set(profile.id, sid);
  registerRealUser({
    id: sid,
    real: true,
    avatar: null, // no gif → initials avatar
    name: profile.display_name || "Membru",
    initials: initialsOf(profile.display_name || "Membru"),
    color: profile.avatar_color || "#7c5cff",
    points: profile.points || 0,
    streak: 0,
    lessons: 0,
    status: "",
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
    text: esc(row.body || ""), // hub renders post.text as HTML → escape here
    media: row.media || null,
    likes: 0,
    likedByMe: false,
    shares: 0,
    sharedByMe: false,
    followed: false,
    comments: [], // filled in below (fetchFeed)
  };
}

// Recursively map a comment row + its children into the hub's comment shape.
function mapCommentRow(row, childrenByParent) {
  const sid = ++_commentSurrogate;
  commentUuidBySurr.set(sid, row.id);
  const createdAt = new Date(row.created_at).getTime();
  const kids = (childrenByParent.get(row.id) || []).map((r) =>
    mapCommentRow(r, childrenByParent)
  );
  return {
    id: sid,
    ...authorFields(row.author || {}),
    createdAt,
    time: relTime(Math.max(0, Date.now() - createdAt)),
    text: esc(row.body || ""),
    likes: 0,
    likedByMe: false,
    reactions: {},
    edited: !!row.edited_at,
    replies: kids,
  };
}

/** Recent forum posts (newest first) WITH their comment trees, in the hub's
 *  shapes. RLS decides visibility (public + own + friends-only if friends). */
export async function fetchFeed({ limit = 40 } = {}) {
  const { data: postRows, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, body, type, background, audience, share_of, media, created_at, edited_at, author:profiles!posts_author_id_fkey(id, display_name, avatar_color, points)"
    )
    .eq("moderation_status", "visible")
    .is("share_of", null)
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

  // Fetch the comments for these posts in one query, then nest them.
  const postIds = [...byUuid.keys()];
  const { data: commentRows, error: cErr } = await supabase
    .from("comments")
    .select(
      "id, post_id, parent_id, body, edited_at, created_at, author:profiles!comments_author_id_fkey(id, display_name, avatar_color, points)"
    )
    .in("post_id", postIds)
    .eq("moderation_status", "visible")
    .order("created_at", { ascending: true });
  if (cErr) {
    console.warn("fetchFeed comments:", cErr.message);
    return posts; // posts still show, just without comments
  }

  const childrenByParent = new Map(); // parent uuid -> [rows]
  const topByPost = new Map(); // post uuid -> [rows]
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
    p.comments = (topByPost.get(uuid) || []).map((r) => mapCommentRow(r, childrenByParent));
  }

  // Like counts + whether the current user liked each post (♥ reactions).
  const myUuid = CURRENT_USER.authId;
  const { data: likeRows } = await supabase
    .from("post_reactions")
    .select("post_id, user_id")
    .in("post_id", postIds)
    .eq("emoji", LIKE_EMOJI);
  if (likeRows) {
    for (const [uuid, p] of byUuid) {
      p.likes = likeRows.filter((r) => r.post_id === uuid).length;
      p.likedByMe = !!myUuid && likeRows.some((r) => r.post_id === uuid && r.user_id === myUuid);
    }
  }
  return posts;
}

/** Add or remove the current user's ♥ like on a post (by surrogate id). */
export async function togglePostLike(postSurrogate, liked) {
  const postId = postUuidBySurr.get(postSurrogate);
  if (!postId || !CURRENT_USER.authId) return;
  if (liked) {
    await supabase
      .from("post_reactions")
      .insert({ post_id: postId, user_id: CURRENT_USER.authId, emoji: LIKE_EMOJI });
  } else {
    await supabase
      .from("post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", CURRENT_USER.authId)
      .eq("emoji", LIKE_EMOJI);
  }
}

/** Create a post authored by the current user. Returns { id: uuid } or null. */
export async function createPost({ type, bg, audience, text, media }) {
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: CURRENT_USER.authId,
      body: text,
      type: type || "discutie",
      background: bg || "none",
      audience: audience || "public",
      media: media ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.warn("createPost:", error.message);
    return null;
  }
  return data;
}

/** Create a comment (or reply) on a post. postSurrogate/parentSurrogate are
 *  the hub's numeric ids. Returns { id: uuid } or null. */
export async function createComment({ postSurrogate, parentSurrogate = null, text }) {
  const postId = postUuidBySurr.get(postSurrogate);
  if (!postId) return null; // post not persisted yet (rare, same-session edge)
  const parentId = parentSurrogate ? commentUuidBySurr.get(parentSurrogate) : null;
  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      parent_id: parentId,
      author_id: CURRENT_USER.authId,
      body: text,
    })
    .select("id")
    .single();
  if (error) {
    console.warn("createComment:", error.message);
    return null;
  }
  return data;
}

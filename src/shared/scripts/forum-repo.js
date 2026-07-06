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
import { registerRealUser, initials as initialsOf } from "./community-data.js";
import { relTime } from "./forum-data.js";

let _userSurrogate = 1_000_000;
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

export function postUuid(surrogateId) {
  return postUuidBySurr.get(surrogateId) || null;
}
export function mapPostSurrogate(surrogateId, uuid) {
  if (surrogateId && uuid) postUuidBySurr.set(surrogateId, uuid);
}
export function mapComment(surrogateId, uuid) {
  if (surrogateId && uuid) commentUuidBySurr.set(surrogateId, uuid);
}

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
    avatar: null,
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
    text: esc(row.body || ""),
    media: row.media || null,
    edited: !!row.edited_at,
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
    replies: kids,
  };
  commentByUuid.set(row.id, obj);
  return obj;
}

/** Recent forum posts (newest first) WITH comments, likes, reactions and the
 *  current user's saved/liked state. RLS decides visibility. */
export async function fetchFeed({ limit = 40 } = {}) {
  const myUuid = CURRENT_USER.authId;

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
  const postIds = [...byUuid.keys()];

  // --- Comments (nested) ---
  const commentByUuid = new Map();
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
  const commentIds = [...commentByUuid.keys()];
  if (commentIds.length) {
    const { data: cReacts } = await supabase
      .from("comment_reactions")
      .select("comment_id, user_id, emoji")
      .in("comment_id", commentIds);
    if (cReacts) {
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
  }

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

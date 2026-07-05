// =========================================================
// Forum data layer (Supabase) → mapped into the hub's existing MOCK shapes.
//
// The hub (community.js) is wired to NUMERIC ids everywhere (posts looked up
// with Number(id), users by numeric id, slugs, friends…). Real Supabase ids
// are uuids. To avoid rewriting hundreds of call sites, each real post/user
// gets a client-side NUMERIC "surrogate" id, and a map translates it back to
// the uuid for writes. The render plumbing stays untouched.
//
// My OWN posts are mapped to author id 0 (the existing "me" sentinel) so the
// "is this mine?" logic keeps working. Real users have no gif avatar → the
// hub renders their initials (see userAvatar in community.js).
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER } from "./session.js";
import { registerRealUser, initials as initialsOf } from "./community-data.js";
import { relTime } from "./forum-data.js";

let _userSurrogate = 1_000_000; // real user ids start well above mock ids (1–30)
let _postSurrogate = 2_000_000;
const userSurrByUuid = new Map(); // profile uuid -> numeric surrogate
const postUuidBySurr = new Map(); // numeric surrogate -> post uuid

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/** The real post uuid behind a surrogate id (for future like/comment/delete). */
export function postUuid(surrogateId) {
  return postUuidBySurr.get(surrogateId) || null;
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

function mapPost(row) {
  const author = row.author || {};
  const authorId = surrogateForAuthor(author);
  const isMe = authorId === 0;
  const sid = ++_postSurrogate;
  postUuidBySurr.set(sid, row.id);
  const createdAt = new Date(row.created_at).getTime();
  return {
    id: sid,
    authorId,
    name: isMe ? CURRENT_USER.name : author.display_name || "Membru",
    initials: isMe ? CURRENT_USER.initials : initialsOf(author.display_name || "Membru"),
    color: isMe ? CURRENT_USER.color : author.avatar_color || "#7c5cff",
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
    comments: [],
  };
}

/** Recent forum posts (newest first), in the hub's post shape. RLS decides
 *  what the caller may see (public + own + friends-only if friends + admin). */
export async function fetchFeed({ limit = 40 } = {}) {
  const { data, error } = await supabase
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
  return (data || []).map(mapPost);
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

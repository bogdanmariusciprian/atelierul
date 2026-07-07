// =========================================================
// Study groups — REAL data (Supabase `groups` + `group_members`, and group
// posts = `posts` tagged with group_id). Returns the same topic shape the hub
// used (discover-data.js) so rendering barely changes:
//   { id, name, iconId, creatorId(surrogate), description, memberIds[surr],
//     allowMembersAdd, joinedByMe, memberCount }.
// A group's wall is fetched with fetchFeed({ groupId }); posting uses
// createPost({ groupId }). Icon/colour stay client-side (groupIcon/groupColor).
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER, isAdmin } from "./session.js";
import { surrogateForAuthor, fetchFeed, createPost } from "./forum-repo.js";

const P = "id, display_name, avatar_color, avatar, points, status_line, last_seen_at, role";
const GROUP_SEL =
  `id, name, description, icon_id, allow_members_add, creator_id, ` +
  `creator:profiles!groups_creator_id_fkey(${P}), ` +
  `group_members(user_id, member:profiles!group_members_user_id_fkey(${P}))`;

function mapGroup(row) {
  const members = row.group_members || [];
  const myUuid = CURRENT_USER.authId;
  return {
    id: row.id,
    name: row.name,
    iconId: row.icon_id || 0,
    description: row.description || "",
    creatorId: row.creator ? surrogateForAuthor(row.creator) : null,
    creatorUuid: row.creator_id,
    memberIds: members.filter((m) => m.member).map((m) => surrogateForAuthor(m.member)),
    memberCount: members.length,
    allowMembersAdd: !!row.allow_members_add,
    joinedByMe: !!myUuid && members.some((m) => m.user_id === myUuid),
    canModerate: isAdmin() || (!!myUuid && row.creator_id === myUuid),
    posts: [], // the group's wall — filled by fetchGroupPosts after listGroups
  };
}

/** All study groups, with members resolved into the shared user registry. */
export async function listGroups() {
  const { data, error } = await supabase.from("groups").select(GROUP_SEL).order("created_at", { ascending: true });
  if (error) { console.warn("listGroups:", error.message); return []; }
  return (data || []).map(mapGroup);
}

/** One group's wall (posts tagged with this group_id). */
export function fetchGroupPosts(groupId) {
  return fetchFeed({ groupId, limit: 60 });
}

/** Post to a group (a normal post carrying the group_id). */
export function postToGroup(groupId, { text, type, bg, media } = {}) {
  return createPost({ groupId, text, type, bg, media, audience: "public" });
}

/** Create a group and auto-join the creator. Returns the new group id. */
export async function createGroup({ name, iconId = 0, description = "", allowMembersAdd = false }) {
  const { data, error } = await supabase
    .from("groups")
    .insert({ name, icon_id: iconId, description, allow_members_add: allowMembersAdd, creator_id: CURRENT_USER.authId })
    .select("id").single();
  if (error) { console.warn("createGroup:", error.message); return null; }
  await supabase.from("group_members").insert({ group_id: data.id, user_id: CURRENT_USER.authId, added_by: CURRENT_USER.authId });
  return data;
}

/** Join a group myself. */
export async function joinGroup(groupId) {
  const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: CURRENT_USER.authId, added_by: CURRENT_USER.authId });
  if (error && error.code !== "23505") console.warn("joinGroup:", error.message);
}

/** Leave a group. */
export async function leaveGroup(groupId) {
  const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", CURRENT_USER.authId);
  if (error) console.warn("leaveGroup:", error.message);
}

/** Add another member (creator, or when the group allows it — enforced by RLS). */
export async function addGroupMember(groupId, userUuid) {
  const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userUuid, added_by: CURRENT_USER.authId });
  if (error && error.code !== "23505") console.warn("addGroupMember:", error.message);
}

/** Update a group's name/description/icon/permissions (creator or admin — RLS). */
export async function updateGroup(groupId, fields) {
  const patch = {};
  if (fields.name != null) patch.name = fields.name;
  if (fields.description != null) patch.description = fields.description;
  if (fields.iconId != null) patch.icon_id = fields.iconId;
  if (fields.allowMembersAdd != null) patch.allow_members_add = fields.allowMembersAdd;
  const { error } = await supabase.from("groups").update(patch).eq("id", groupId);
  if (error) console.warn("updateGroup:", error.message);
}

/** Delete a group (creator or admin — enforced by RLS). */
export async function deleteGroup(groupId) {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) console.warn("deleteGroup:", error.message);
}

// =========================================================
// Caietul (notebook) — REAL, per account (Supabase `notes`, migration 0038).
// Was localStorage; now saved to the account so it travels between devices.
//   • loadNotes()  — fetch my notes into the in-memory cache (call in loadFeed)
//   • getNotes()   — SYNC read of the cache (the hub renders from it)
//   • addNote / updateNote / deleteNote — async, keep the cache in sync
// The `notes.lesson_slug` column holds the lesson HREF (opaque reference the
// client already uses); title→title, text→body.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER } from "./session.js";

let _cache = []; // [{ id, title, text, lessonHref, when }]

const mapRow = (r) => ({
  id: r.id,
  title: r.title || "",
  text: r.body || "",
  lessonHref: r.lesson_slug || null,
  when: new Date(r.created_at).getTime(),
});

/** Load my notes into the cache (newest first). No-op (empty) for guests. */
export async function loadNotes() {
  if (!CURRENT_USER.authId) { _cache = []; return _cache; }
  const { data, error } = await supabase
    .from("learn_notes")
    .select("id, title, body, lesson_slug, created_at")
    .eq("user_id", CURRENT_USER.authId)
    .order("created_at", { ascending: false });
  if (error) { console.warn("loadNotes:", error.message); _cache = []; }
  else _cache = (data || []).map(mapRow);
  return _cache;
}

/** SYNC read of the cache (the hub renders `state.notes = getNotes()`). */
export function getNotes() {
  return _cache;
}

export async function addNote({ title, text, lessonHref = null } = {}) {
  if (!CURRENT_USER.authId || !text) return null;
  const { data, error } = await supabase
    .from("learn_notes")
    .insert({ user_id: CURRENT_USER.authId, title: title || null, body: text, lesson_slug: lessonHref || null })
    .select("id, title, body, lesson_slug, created_at")
    .single();
  if (error) { console.warn("addNote:", error.message); return null; }
  const note = mapRow(data);
  _cache = [note, ..._cache];
  return note;
}

export async function updateNote(id, { title, text, lessonHref } = {}) {
  const patch = { updated_at: new Date().toISOString() };
  if (title !== undefined) patch.title = title || null;
  if (text !== undefined) patch.body = text || "";
  if (lessonHref !== undefined) patch.lesson_slug = lessonHref || null;
  const { error } = await supabase.from("learn_notes").update(patch).eq("id", id);
  if (error) { console.warn("updateNote:", error.message); return; }
  _cache = _cache.map((n) =>
    n.id === id
      ? { ...n, ...(title !== undefined ? { title } : {}), ...(text !== undefined ? { text } : {}), ...(lessonHref !== undefined ? { lessonHref } : {}) }
      : n
  );
}

export async function deleteNote(id) {
  const { error } = await supabase.from("learn_notes").delete().eq("id", id);
  if (error) { console.warn("deleteNote:", error.message); return; }
  _cache = _cache.filter((n) => n.id !== id);
}

// =========================================================
// The personal notebook ("Caietul meu") — persistent (store.js adapter:
// localStorage now, Supabase later). Notes survive reloads; finishing a
// lesson also drops a note here automatically; on lesson pages, selecting
// text offers "➕ În caiet".
// Note shape: { id, title, text, when, lessonHref }
// =========================================================
import { store } from "./store.js";
import { MY_PROFILE } from "./community-data.js";

const KEY = "atelier_notes";

/** All notes, newest first. Seeds from MY_PROFILE.notes on first run. */
export function getNotes() {
  let notes = store.get(KEY);
  if (!notes) {
    notes = MY_PROFILE.notes.map((n, i) => ({
      id: Date.now() + i,
      lessonHref: null,
      ...n,
    }));
    store.set(KEY, notes);
  }
  return notes;
}

export function addNote({ title, text, lessonHref = null, when = "acum" }) {
  const notes = getNotes();
  const note = { id: Date.now(), title: title || "Notiță", text, when, lessonHref };
  notes.unshift(note);
  store.set(KEY, notes);
  return note;
}

export function updateNote(id, { title, text }) {
  const notes = getNotes();
  const n = notes.find((x) => x.id === id);
  if (!n) return;
  n.title = title || "Notiță";
  n.text = text;
  store.set(KEY, notes);
}

export function deleteNote(id) {
  store.set(KEY, getNotes().filter((x) => x.id !== id));
}

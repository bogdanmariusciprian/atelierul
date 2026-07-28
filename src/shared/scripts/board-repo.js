// =========================================================
// Foile de la tablă (#LaTablă): date REALE (Supabase `learn_board_sheets`).
//
// Tabla e un caiet legat de o lecție. Elevul are mai multe foi la aceeași
// lecție, ca să poată păstra tema de săptămâna trecută lângă cea de azi.
//
// Salvarea se face LA CERERE. Modulul ăsta nu salvează niciodată singur: cine
// îl cheamă hotărăște când. De-aia n-are nici temporizator, nici „salvează la
// fiecare tastă": asta ar transforma o temă într-un jurnal.
//
// Migrarea 0074 ține politicile: elevul umblă doar la foile lui, profesorul le
// citește pe toate ca să corecteze, dar nu le poate schimba.
// =========================================================
import { supabase } from "./supabase-client.js";

/** Cine e conectat acum, sau null. Tabla se poate folosi și nelogat (foaia
 *  rămâne atunci doar în browser), deci întrebarea asta nu e o eroare. */
async function utilizator() {
  try {
    const { data } = await supabase.auth.getUser();
    return data && data.user ? data.user : null;
  } catch {
    return null;
  }
}

/** Foile mele de la o lecție, cea atinsă ultima dată în frunte.
 *  Fără sesiune întoarce lista goală, nu o eroare: e o stare firească. */
export async function listSheets(lessonSlug) {
  const u = await utilizator();
  if (!u) return [];
  const { data, error } = await supabase
    .from("learn_board_sheets")
    .select("id, title, updated_at")
    .eq("user_id", u.id)
    .eq("lesson_slug", lessonSlug)
    .order("updated_at", { ascending: false });
  if (error) { console.warn("listSheets:", error.message); return []; }
  return data || [];
}

/** Conținutul unei foi. */
export async function loadSheet(id) {
  const { data, error } = await supabase
    .from("learn_board_sheets")
    .select("id, title, data, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.warn("loadSheet:", error.message); return null; }
  return data;
}

/**
 * Salvează foaia. Fără `id` scrie una nouă, cu `id` o rescrie pe cea veche.
 * Întoarce `{ id, title, updated_at }` sau null dacă n-a mers.
 *
 * `user_id` se trimite explicit la inserare fiindcă politica îl cere în
 * `with check`: baza nu-l ghicește, îl verifică.
 */
export async function saveSheet({ id, lessonSlug, title, data }) {
  const u = await utilizator();
  if (!u) return null;

  if (id) {
    const { data: row, error } = await supabase
      .from("learn_board_sheets")
      .update({ title, data })
      .eq("id", id)
      .select("id, title, updated_at")
      .maybeSingle();
    if (error) { console.warn("saveSheet:", error.message); return null; }
    return row;
  }

  const { data: row, error } = await supabase
    .from("learn_board_sheets")
    .insert({ user_id: u.id, lesson_slug: lessonSlug, title, data })
    .select("id, title, updated_at")
    .maybeSingle();
  if (error) { console.warn("saveSheet:", error.message); return null; }
  return row;
}

/** Schimbă numele unei foi, fără să atingă ce e scris pe ea. */
export async function renameSheet(id, title) {
  const { error } = await supabase
    .from("learn_board_sheets")
    .update({ title })
    .eq("id", id);
  if (error) { console.warn("renameSheet:", error.message); return false; }
  return true;
}

/** Șterge o foaie. Cine cheamă trebuie să întrebe întâi: aici nu se cere. */
export async function deleteSheet(id) {
  const { error } = await supabase.from("learn_board_sheets").delete().eq("id", id);
  if (error) { console.warn("deleteSheet:", error.message); return false; }
  return true;
}

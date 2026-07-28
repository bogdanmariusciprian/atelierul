// =========================================================
// Foile de la tablă (#LaTablă): date REALE (Supabase `learn_lessons_boards`).
//
// Tabla e un caiet legat de o lecție. Elevul are mai multe foi la aceeași
// lecție, ca să poată păstra tema de săptămâna trecută lângă cea de azi.
//
// Salvarea se face LA CERERE. Modulul ăsta nu salvează niciodată singur: cine
// îl cheamă hotărăște când. De-aia n-are nici temporizator, nici „salvează la
// fiecare tastă": asta ar transforma o temă într-un jurnal.
//
// Numele tabelului urmează regula din 0062, domeniul → entitatea →
// calificativul: foaia atârnă de LECȚIE, deci stă în aceeași familie cu
// `learn_lessons_progress` și `learn_lessons_favorites`.
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
    .from("learn_lessons_boards")
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
    .from("learn_lessons_boards")
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
  if (!u) return { row: null, motiv: "neconectat" };

  const cerere = id
    ? supabase.from("learn_lessons_boards").update({ title, data }).eq("id", id)
    : supabase.from("learn_lessons_boards").insert({ user_id: u.id, lesson_slug: lessonSlug, title, data });

  const { data: row, error } = await cerere.select("id, title, updated_at").maybeSingle();
  if (error) {
    console.warn("saveSheet:", error.code, error.message);
    return { row: null, motiv: motivul(error) };
  }
  return { row, motiv: null };
}

/** Traduce eroarea bazei într-un motiv scurt, de arătat pe ecran.
 *  Fără asta, orice necaz arăta la fel: „nu s-a putut salva", iar cauza
 *  adevărată (tabel lipsă, drepturi, rețea) rămânea ascunsă în consolă. */
function motivul(error) {
  const cod = error && error.code;
  const txt = ((error && error.message) || "").toLowerCase();
  if (cod === "42P01" || txt.includes("does not exist") || txt.includes("schema cache")) {
    return "tabelul lipsește: aplică migrarea 0074";
  }
  if (cod === "42501" || txt.includes("row-level security") || txt.includes("policy")) {
    return "n-ai drept de scriere pe foaia asta";
  }
  if (txt.includes("failed to fetch") || txt.includes("networkerror")) {
    return "fără legătură la server";
  }
  return "nu s-a putut salva";
}

/** Schimbă numele unei foi, fără să atingă ce e scris pe ea. */
export async function renameSheet(id, title) {
  const { error } = await supabase
    .from("learn_lessons_boards")
    .update({ title })
    .eq("id", id);
  if (error) { console.warn("renameSheet:", error.message); return false; }
  return true;
}

/** Șterge o foaie. Cine cheamă trebuie să întrebe întâi: aici nu se cere. */
export async function deleteSheet(id) {
  const { error } = await supabase.from("learn_lessons_boards").delete().eq("id", id);
  if (error) { console.warn("deleteSheet:", error.message); return false; }
  return true;
}

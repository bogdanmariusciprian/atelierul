// =========================================================
// Banca de material a lecțiilor: date REALE (`learn_lessons_items`).
//
// Din ea scoate generatorul cuvintele, structurile fonetice și propozițiile cu
// care se umple tabla. Profesorul o scrie, elevul doar o citește: migrarea 0078
// ține regula, aici doar o folosim.
//
// ETICHETELE sunt cheia. Zarul dă tipul exercițiului, tipul are eticheta lui,
// iar generatorul cere „material cu eticheta asta". De-aia numele etichetelor
// stau AICI, într-un singur loc, și nu sunt scrise de mână prin cod: dacă se
// schimbă una, se schimbă pentru toată lumea deodată.
// =========================================================
import { supabase } from "./supabase-client.js";

/** Etichetele, pe fețele zarului. Cheia e fața, valoarea e eticheta din bancă.
 *
 *  Numele etichetelor sunt scurte și fără diacritice anume: ajung în baza de
 *  date, unde o listă de text se caută mai lesne fără semne. */
export const ETICHETE = {
  1: { eticheta: "litere-sunete", kind: "cuvant",     nume: "Litere și sunete" },
  2: { eticheta: "grupuri",       kind: "cuvant",     nume: "Grupuri de sunete" },
  3: { eticheta: "silabe",        kind: "cuvant",     nume: "Despărțire în silabe" },
  4: { eticheta: "valoarea-i",    kind: "cuvant",     nume: "Valoarea lui i" },
  5: { eticheta: "structuri",     kind: "structura",  nume: "Structuri fonetice" },
  6: { eticheta: "propozitii",    kind: "propozitie", nume: "Transcrierea unei propoziții" },
};

/** Toate etichetele, pentru panoul de admin. */
export const TOATE_ETICHETELE = Object.values(ETICHETE);

/**
 * Materialul potrivit unei fețe de zar.
 *
 * Cerem TOT ce se potrivește, nu doar câte ne trebuie, și alegem în browser.
 * Motivul: alegerea la întâmplare trebuie să ocolească ce a primit elevul deja
 * în ședința asta, iar baza n-are de unde ști ce i-am dat acum zece minute.
 * Băncile de la o lecție sunt de ordinul sutelor, deci nu e nicio pagubă.
 */
export async function listItems(lessonSlug, fata, { level } = {}) {
  const cfg = ETICHETE[fata];
  if (!cfg) return [];
  let q = supabase
    .from("learn_lessons_items")
    .select("id, body, tags, level")
    .eq("lesson_slug", lessonSlug)
    .eq("kind", cfg.kind)
    .contains("tags", [cfg.eticheta]);
  if (level) q = q.eq("level", level);
  const { data, error } = await q;
  if (error) { console.warn("listItems:", error.message); return []; }
  return data || [];
}

/** Toată banca unei lecții, pentru panoul profesorului. */
export async function listAll(lessonSlug) {
  const { data, error } = await supabase
    .from("learn_lessons_items")
    .select("id, kind, body, tags, level, created_at")
    .eq("lesson_slug", lessonSlug)
    .order("created_at", { ascending: false });
  if (error) { console.warn("listAll:", error.message); return []; }
  return data || [];
}

/**
 * Adaugă material. Întoarce `{ rand, motiv }`.
 *
 * Se poate scrie mai mult deodată, câte unul pe rând: profesorul are de obicei
 * o listă gata făcută, iar introducerea unul câte unul ar fi o pedeapsă.
 */
export async function addItems(lessonSlug, kind, bodies, tags, level) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u && u.user ? u.user.id : null;
  const randuri = bodies
    .map((b) => String(b || "").trim())
    .filter(Boolean)
    .map((body) => ({ lesson_slug: lessonSlug, kind, body, tags, level, created_by: uid }));
  if (!randuri.length) return { rand: [], motiv: "n-ai scris nimic" };

  // `upsert` cu `ignoreDuplicates`: un cuvânt pus a doua oară nu e o greșeală
  // de semnalat, ci un lucru care se întâmplă des când lipești o listă peste
  // alta. Îl trecem cu vederea în tăcere, în loc să oprim toată salvarea.
  const { data, error } = await supabase
    .from("learn_lessons_items")
    .upsert(randuri, { onConflict: "lesson_slug,kind,body", ignoreDuplicates: true })
    .select("id, kind, body, tags, level");
  if (error) {
    console.error("addItems a picat:", { code: error.code, message: error.message });
    return { rand: [], motiv: motivul(error) };
  }
  return { rand: data || [], motiv: null };
}

export async function updateItem(id, schimbari) {
  const { error } = await supabase.from("learn_lessons_items").update(schimbari).eq("id", id);
  if (error) { console.warn("updateItem:", error.message); return false; }
  return true;
}

export async function deleteItem(id) {
  const { error } = await supabase.from("learn_lessons_items").delete().eq("id", id);
  if (error) { console.warn("deleteItem:", error.message); return false; }
  return true;
}

/** Eroarea bazei, tradusă în ceva de arătat pe ecran. */
function motivul(error) {
  const cod = error && error.code;
  const txt = ((error && error.message) || "").toLowerCase();
  if (cod === "42P01" || txt.includes("does not exist") || txt.includes("schema cache")) {
    return "tabelul lipsește: aplică migrarea 0078";
  }
  if (cod === "42501" || txt.includes("row-level security") || txt.includes("policy")) {
    return "numai profesorul poate scrie în bancă";
  }
  if (txt.includes("failed to fetch") || txt.includes("networkerror")) {
    return "fără legătură la server";
  }
  return `${cod || "eroare"}: ${(error && error.message) || "necunoscută"}`;
}

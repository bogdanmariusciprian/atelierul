// =========================================================
// Banca de material a lecțiilor: date REALE (`learn_lessons_items`).
//
// Din ea scoate generatorul cuvintele, structurile fonetice și propozițiile cu
// care se umple tabla. O CITEȘTE oricine, și cine n-are cont (0079); o SCRIE
// numai profesorul (0078). Regula o ține baza, aici doar o folosim: dacă un elev
// ar chema `addRows`, serverul îl refuză, oricât de bine ar fi scris codul.
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
 * Cheia după care două intrări sunt „același lucru".
 *
 * Trebuie să dea exact ce dă indexul unic din 0078, adică `lower(btrim(body))`:
 * altfel fereastra ar spune „e nou" despre un cuvânt pe care baza îl respinge.
 * Diacriticele NU se scot: „casa" și „casă" sunt două cuvinte deosebite, iar la
 * o lecție de fonetică deosebirea e chiar lucrul care se învață.
 */
export function cheia(text) {
  return String(text || "").trim().toLowerCase();
}

/**
 * Pune în bancă rândurile pregătite în fereastră. Întoarce `{ puse, sarite, motiv }`.
 *
 * Fiecare rând vine gata cu felul, etichetele și dificultatea lui, fiindcă
 * profesorul le potrivește unul câte unul în tabel: două cuvinte din aceeași
 * listă lipită pot sluji la exerciții deosebite.
 *
 * NU folosim `upsert`: Postgres cere ca lista din `on conflict` să fie exact
 * cheia unui index unic, iar indexul băncii e pus pe `lower(btrim(body))`, nu pe
 * coloana `body` goală. Așa că trimitem un insert curat, iar dacă totuși se
 * strecoară un duplicat (cineva a adăugat între timp de pe alt calculator),
 * reluăm rând cu rând: un rând stricat n-are voie să strice tot transportul.
 */
export async function addRows(lessonSlug, randuri) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u && u.user ? u.user.id : null;
  const gata = (randuri || [])
    .map((r) => ({
      lesson_slug: lessonSlug,
      kind: r.kind,
      body: String(r.body || "").trim(),
      tags: r.tags || [],
      level: r.level || 2,
      created_by: uid,
    }))
    .filter((r) => r.body && r.tags.length);
  if (!gata.length) return { puse: [], sarite: 0, motiv: "n-ai bifat nimic" };

  const COLOANE = "id, kind, body, tags, level";
  const { data, error } = await supabase
    .from("learn_lessons_items").insert(gata).select(COLOANE);
  if (!error) return { puse: data || [], sarite: 0, motiv: null };
  if (error.code !== "23505") {
    console.error("addRows a picat:", { code: error.code, message: error.message });
    return { puse: [], sarite: 0, motiv: motivul(error) };
  }

  const puse = [];
  let sarite = 0;
  for (const rand of gata) {
    const { data: unul, error: e } = await supabase
      .from("learn_lessons_items").insert(rand).select(COLOANE).single();
    if (!e) { puse.push(unul); continue; }
    if (e.code === "23505") { sarite++; continue; }
    return { puse, sarite, motiv: motivul(e) };
  }
  return { puse, sarite, motiv: null };
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

// =========================================================
// Banca de material a lecțiilor: date REALE (`learn_lessons_items`).
//
// Din ea scoate generatorul cuvintele, structurile fonetice și propozițiile cu
// care se umple tabla. O CITEȘTE oricine, și cine n-are cont (0079); o SCRIE
// numai profesorul (0078). Regula o ține baza, aici doar o folosim: dacă un elev
// ar chema `addRows`, serverul îl refuză, oricât de bine ar fi scris codul.
//
// CE FEL DE MATERIAL are fiecare lecție NU se hotărăște aici. Descrierea stă în
// `board-material.js`, fiindcă ține de pedagogie, nu de baza de date: tabla de
// fonetică ține cuvinte, cea de la textul argumentativ va ține texte. Fișierul
// de față nu știe și nu are de ce să știe ce feluri există; el doar cere și
// scrie ce i se spune.
// =========================================================
import { supabase } from "./supabase-client.js";
import { fataZarului, cheia } from "./board-material.js";

// Se dă mai departe, ca cine are deja repo-ul s-o poată folosi de aici.
export { cheia };

/**
 * Materialul potrivit unei fețe de zar.
 *
 * Cerem TOT ce se potrivește, nu doar câte ne trebuie, și alegem în browser.
 * Motivul: alegerea la întâmplare trebuie să ocolească ce a primit elevul deja
 * în ședința asta, iar baza n-are de unde ști ce i-am dat acum zece minute.
 * Băncile de la o lecție sunt de ordinul sutelor, deci nu e nicio pagubă.
 */
export async function listItems(lessonSlug, fata, { level } = {}) {
  const cfg = fataZarului(lessonSlug, fata);
  if (!cfg) return [];
  return listByTag(lessonSlug, cfg.kind, cfg.eticheta, { level });
}

/** Materialul de un fel și cu o etichetă anume. Cererea de bază a băncii. */
export async function listByTag(lessonSlug, kind, eticheta, { level } = {}) {
  let q = supabase
    .from("learn_lessons_items")
    .select("id, body, tags, level")
    .eq("lesson_slug", lessonSlug)
    .eq("kind", kind);
  if (eticheta) q = q.contains("tags", [eticheta]);
  if (level) q = q.eq("level", level);
  const { data, error } = await q;
  if (error) { console.warn("listByTag:", error.message); return []; }
  return data || [];
}

/**
 * Câte intrări are fiecare lecție. Pentru numerele din bara panoului.
 *
 * Cerem numai coloana `lesson_slug` și numărăm în browser, în loc să punem un
 * `group by` la server: n-avem un RPC pentru asta, iar o listă de câteva mii de
 * sluguri scurte e mai ieftină decât o funcție nouă în bază, întreținută pe veci
 * pentru un număr afișat într-o bară laterală.
 */
export async function countByLesson() {
  const { data, error } = await supabase
    .from("learn_lessons_items").select("lesson_slug");
  if (error) { console.warn("countByLesson:", error.message); return {}; }
  const socoteala = {};
  for (const r of data || []) socoteala[r.lesson_slug] = (socoteala[r.lesson_slug] || 0) + 1;
  return socoteala;
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

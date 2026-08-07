// =========================================================
// Notițele „TO-DO" ale profesorului: date REALE (`admin_todos`, migrarea 0081).
//
// Se leagă de PAGINA unde le scrii. Cheia paginii se face aici, într-un singur
// loc, ca nota scrisă azi să se regăsească mâine: dacă adresa s-ar socoti
// altfel la scriere decât la citire, notițele ar dispărea fără să crape nimic,
// ceea ce e cel mai rău fel de stricăciune.
// =========================================================
import { supabase } from "./supabase-client.js";

/**
 * Cheia paginii de față.
 *
 * Ia calea ȘI partea de după „#". Hashul e trebuincios: în panoul de
 * administrare toate uneltele stau pe `/comunitate/` și se deosebesc numai prin
 * el, deci fără hash toate notițele s-ar aduna la un loc.
 *
 * Curățenii mărunte, ca aceeași pagină să dea aceeași cheie de fiecare dată:
 * „/lectii/x/index.html" și „/lectii/x/" sunt același loc; bara de la sfârșit
 * nu deosebește nimic; hashul gol („#") nu e un hash.
 */
export function cheiaPaginii(loc = window.location) {
  let cale = String(loc.pathname || "/").replace(/index\.html$/i, "");
  if (cale.length > 1) cale = cale.replace(/\/+$/, "");
  const hash = String(loc.hash || "").replace(/^#$/, "");
  return (cale || "/") + hash;
}

/** Numele paginii, fără coada de site („… – Atelierul-LRO"). */
export function numelePaginii(doc = document) {
  return String(doc.title || "").split(/\s+[–|]\s+/)[0].trim() || "Pagină";
}

/**
 * Eroarea bazei, tălmăcită în ceva de arătat pe ecran.
 *
 * Fără asta, o notiță care nu se salvează pur și simplu nu apare, iar tu nu
 * afli niciodată de ce: tabelul lipsește? te-a scos sesiunea? n-ai semnal?
 * O scriere care pică în tăcere e cel mai rău fel de stricăciune, fiindcă îți
 * mănâncă lucrul fără să sufle o vorbă.
 */
export function motivul(error) {
  const cod = error && error.code;
  const txt = ((error && error.message) || "").toLowerCase();
  if (cod === "42P01" || txt.includes("does not exist") || txt.includes("schema cache")) {
    return "tabelul lipsește: aplică migrarea 0081";
  }
  if (cod === "42501" || txt.includes("row-level security") || txt.includes("policy")) {
    return "serverul refuză: intră cu contul de profesor";
  }
  if (txt.includes("jwt") || txt.includes("token") || cod === "PGRST301") {
    return "sesiunea a expirat: intră din nou în cont";
  }
  if (txt.includes("failed to fetch") || txt.includes("networkerror")) {
    return "fără legătură la server";
  }
  return `${cod || "eroare"}: ${(error && error.message) || "necunoscută"}`;
}

/** Toate notițele, cele mai noi întâi. Sunt zeci, nu mii: le aducem pe toate
 *  și le împărțim pe pagini în browser, ca fila „Toate" să fie gata pe loc. */
export async function listTodos() {
  const { data, error } = await supabase
    .from("admin_todos")
    .select("id, path, title, body, done, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("listTodos:", error.code, error.message);
    return { note: [], motiv: motivul(error) };
  }
  return { note: data || [], motiv: null };
}

/** Adaugă o notiță pe pagina de față. Întoarce `{ rand, motiv }`. */
export async function addTodo(body, path, title) {
  const text = String(body || "").trim();
  if (!text) return { rand: null, motiv: "n-ai scris nimic" };
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return { rand: null, motiv: "nu ești logat: intră în cont" };
  const { data, error } = await supabase
    .from("admin_todos")
    .insert({ path, title, body: text, created_by: u.user.id })
    .select("id, path, title, body, done, created_at")
    .single();
  if (error) {
    console.error("addTodo a picat:", { code: error.code, message: error.message });
    return { rand: null, motiv: motivul(error) };
  }
  return { rand: data, motiv: null };
}

/** Bifează sau debifează. */
export async function setTodoDone(id, done) {
  const { error } = await supabase.from("admin_todos").update({ done }).eq("id", id);
  if (error) { console.warn("setTodoDone:", error.message); return motivul(error); }
  return null;
}

/** Schimbă textul unei notițe. */
export async function setTodoBody(id, body) {
  const text = String(body || "").trim();
  if (!text) return "n-ai scris nimic";
  const { error } = await supabase.from("admin_todos").update({ body: text }).eq("id", id);
  if (error) { console.warn("setTodoBody:", error.message); return motivul(error); }
  return null;
}

export async function removeTodo(id) {
  const { error } = await supabase.from("admin_todos").delete().eq("id", id);
  if (error) { console.warn("removeTodo:", error.message); return motivul(error); }
  return null;
}

/** Notițele așezate pe pagini, pentru fila „Toate". Paginile cu treabă
 *  neterminată vin primele: acolo te uiți. */
export function pePagini(todos) {
  const pagini = new Map();
  for (const t of todos) {
    if (!pagini.has(t.path)) pagini.set(t.path, { path: t.path, title: t.title, note: [] });
    pagini.get(t.path).note.push(t);
  }
  return [...pagini.values()]
    .map((p) => ({ ...p, deFacut: p.note.filter((t) => !t.done).length }))
    .sort((a, b) => b.deFacut - a.deFacut || a.title.localeCompare(b.title, "ro"));
}

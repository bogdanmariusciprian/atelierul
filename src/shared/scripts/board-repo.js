// =========================================================
// Tablele elevului (#LaTablă): date REALE (Supabase `learn_lessons_boards`).
//
// Tabla e un caiet legat de o lecție. Elevul are mai multe table la aceeași
// lecție, ca să poată păstra tema de săptămâna trecută lângă cea de azi.
//
// Salvarea se face LA CERERE. Modulul ăsta nu salvează niciodată singur: cine
// îl cheamă hotărăște când. De-aia n-are nici temporizator, nici „salvează la
// fiecare tastă": asta ar transforma o temă într-un jurnal.
//
// Numele tabelului urmează regula din 0062, domeniul → entitatea →
// calificativul: tabla atârnă de LECȚIE, deci stă în aceeași familie cu
// `learn_lessons_progress` și `learn_lessons_favorites`.
//
// Migrarea 0074 ține politicile: elevul umblă doar la tablele lui, profesorul le
// citește pe toate ca să corecteze, dar nu le poate schimba. Numele unei
// table e unic pe elev și pe lecție (migrarea 0075).
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

/** Tablele mele de la o lecție, cea atinsă ultima dată în frunte.
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

/** Conținutul unei table. */
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
 * Salvează tabla. Fără `id` scrie una nouă, cu `id` o rescrie pe cea veche.
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
    console.error("saveSheet a picat:", { code: error.code, message: error.message,
                                          details: error.details, hint: error.hint });
    await diagnostic();
    return { row: null, motiv: motivul(error) };
  }
  // Fără eroare, dar nici rând: se întâmplă când UPDATE n-a găsit ce să
  // schimbe (tabla a fost ștearsă între timp), sau când politica a lăsat
  // scrierea să treacă dar oprește citirea înapoi. Tăcerea asta ar fi cea mai
  // rea dintre toate, fiindcă arată a reușită.
  if (!row) {
    console.error("saveSheet: cererea a mers, dar n-a venit niciun rând înapoi.");
    await diagnostic();
    return { row: null, motiv: id ? "tabla nu mai există" : "scrierea n-a lăsat urmă" };
  }
  return { row, motiv: null };
}

/** Când salvarea pică, scrie în consolă tot ce trebuie ca să știm de ce, fără
 *  să mai fie nevoie de încă o tură de întrebări: cine e conectat, dacă
 *  tabelul se poate citi și dacă politicile îl lasă. */
async function diagnostic() {
  const raport = {};
  try {
    const { data } = await supabase.auth.getSession();
    raport.sesiune = data && data.session ? "da" : "NU";
    raport.utilizator = data && data.session ? data.session.user.email : "-";
    raport.expira = data && data.session ? new Date(data.session.expires_at * 1000).toLocaleString("ro-RO") : "-";
  } catch (e) { raport.sesiune = "eroare: " + e.message; }

  const { data: cit, error: eCit } = await supabase
    .from("learn_lessons_boards").select("id").limit(1);
  raport.citireTabel = eCit ? `${eCit.code}: ${eCit.message}` : `merge (${(cit || []).length} rânduri)`;

  console.table(raport);
  return raport;
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
    return "n-ai drept de scriere pe tabla asta";
  }
  // 23505 = index unic încălcat. Verificăm și în browser înainte de salvare,
  // dar două ferestre deschise deodată pot păcăli verificarea aia; baza, nu.
  if (cod === "23505") return "mai ai o tablă cu numele ăsta";
  if (txt.includes("failed to fetch") || txt.includes("networkerror")) {
    return "fără legătură la server";
  }
  // Necunoscut: arătăm mesajul brut. Un „nu s-a putut salva" fără cauză ne-a
  // costat deja două runde de ghicit.
  return `${cod || "eroare"}: ${(error && error.message) || "necunoscută"}`;
}

/** Schimbă numele unei table, fără să atingă ce e scris pe ea. */
export async function renameSheet(id, title) {
  const { error } = await supabase
    .from("learn_lessons_boards")
    .update({ title })
    .eq("id", id);
  if (error) { console.warn("renameSheet:", error.message); return false; }
  return true;
}

/** Șterge o tablă. Cine cheamă trebuie să întrebe întâi: aici nu se cere. */
export async function deleteSheet(id) {
  const { error } = await supabase.from("learn_lessons_boards").delete().eq("id", id);
  if (error) { console.warn("deleteSheet:", error.message); return false; }
  return true;
}


/* ================= NOTIȚELE (`learn_lessons_notes`) =================
   Carnetul elevului de la o lecție: una singură, nu mai multe. De-aia n-are
   listă și nici titlu, doar „citește-o" și „scrie-o".

   Elevul le scrie și le schimbă; profesorul le poate CITI (0077), ca să vadă
   ce are elevul pe ecran când zice că ceva nu merge. Scrisul rămâne numai al
   elevului: nimeni nu-i umblă în carnet.
   ==================================================================== */

/** Notița mea de la o lecție, sau null dacă n-am scris încă nimic. */
export async function loadNotes(lessonSlug) {
  const u = await utilizator();
  if (!u) return null;
  const { data, error } = await supabase
    .from("learn_lessons_notes")
    .select("data, updated_at")
    .eq("user_id", u.id)
    .eq("lesson_slug", lessonSlug)
    .maybeSingle();
  if (error) { console.warn("loadNotes:", error.message); return null; }
  return data ? data.data : null;
}

/**
 * Scrie notița. `upsert` fiindcă rândul e unul singur pe elev și pe lecție:
 * fie îl creează, fie îl rescrie, fără să ne intereseze care din două.
 * `onConflict` numește cheia primară, ca baza să știe după ce recunoaște
 * rândul deja existent.
 */
export async function saveNotes(lessonSlug, data) {
  const u = await utilizator();
  if (!u) return false;
  const { error } = await supabase
    .from("learn_lessons_notes")
    .upsert({ user_id: u.id, lesson_slug: lessonSlug, data }, { onConflict: "user_id,lesson_slug" });
  if (error) { console.warn("saveNotes:", error.message); return false; }
  return true;
}

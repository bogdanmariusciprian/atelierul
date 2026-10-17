// =========================================================
// TABLA LIVE (0106): ce scrie adminul pe o tablă #LaTablă se vede pe loc la
// toți cei care au tabla deschisă.
//
// Un rând pe tablă, în `tabla_live`, cu tot conținutul în `data`. Adminul îl
// suprascrie; ceilalți îl citesc la deschidere și apoi primesc schimbările prin
// Realtime. Regula o ține baza: scrie doar `is_admin_user()`.
//
// Golirea NU șterge rândul: enunțurile se golesc, dar fișa Word de sub tablă
// (0107) rămâne, deci golirea e tot o scriere.
// =========================================================
import { supabase } from "./supabase-client.js";
import { CURRENT_USER } from "./session.js";

/** Ce e acum pe tablă; `null` dacă e goală ori nu se poate citi. */
export async function citesteTabla(slug) {
  const { data, error } = await supabase.from("tabla_live")
    .select("data").eq("slug", slug).maybeSingle();
  if (error) { console.warn("citesteTabla:", error.message); return null; }
  return data?.data || null;
}

/** Pune pe tablă tot conținutul (doar adminul). `true` dacă a intrat. */
export async function scrieTabla(slug, continut) {
  const { error } = await supabase.from("tabla_live")
    .upsert({ slug, data: continut, actualizat_la: new Date().toISOString() }, { onConflict: "slug" });
  if (error) { console.warn("scrieTabla:", error.message); return false; }
  return true;
}

/* ---------- un enunț, scris singur (0108) ----------
   Și elevul pornit de profesor scrie, deci doi oameni pot scrie deodată. Un
   enunț pleacă singur, prin funcția din bază, care schimbă doar locul lui:
   scris întreg, cum se scrie treapta, ar fi șters ce a scris celălalt între
   timp. Funcția verifică ea cine are voie; de aici nu se verifică nimic. */

/** `'gata'`, `'inchis'` (n-ai voie acum), `'gresit'` ori `'eroare'` (netul). */
export async function scrieEnunt(slug, tip, n, i, text) {
  const { data, error } = await supabase.rpc("scrie_enunt", {
    p_slug: slug, p_tip: tip, p_n: n, p_i: i, p_text: text,
  });
  if (error) { console.warn("scrieEnunt:", error.message); return "eroare"; }
  return String(data || "eroare");
}

/** Pot EU scrie enunțuri pe tablă? Profesorul da; elevul, dacă e pornit. */
export async function poateScrieTabla() {
  if (!CURRENT_USER.authId) return false;
  const { data, error } = await supabase.rpc("poate_scrie_tabla");
  if (error) { console.warn("poateScrieTabla:", error.message); return false; }
  return !!data;
}

/**
 * Ascultă comutatorul MEU (`planner_pupils.can_board`), în timp real: când
 * profesorul te pornește ori te oprește, tabla se deschide ori se închide pe
 * loc, fără reîncărcare. Întoarce funcția care oprește ascultarea.
 */
export function ascultaIngaduinta(cand) {
  const eu = CURRENT_USER.authId;
  if (!eu) return () => {};
  const canal = supabase
    .channel(`tabla-ingaduinta:${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "planner_pupils", filter: `user_id=eq.${eu}` },
        (m) => { try { cand(!!m?.new?.can_board); } catch (e) { console.warn("ascultaIngaduinta:", e?.message); } })
    .subscribe();
  return () => { try { supabase.removeChannel(canal); } catch { /* deja tăiat */ } };
}

/* ---------- fișa Word de sub tablă (0107) ----------
   Fișierul stă în găleata publică `tabla-fise`; care fișă e pe tablă stă în
   `data.fisa`, ca să ajungă la elevi pe drumul live al enunțurilor. */
const GALEATA_FISE = "tabla-fise";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_FISA = 10 * 1024 * 1024;   // ca în găleată (0107)

/** Adresa publică a fișei (nu cere cont). */
export function adresaFisa(fisier) {
  return supabase.storage.from(GALEATA_FISE).getPublicUrl(fisier).data.publicUrl;
}

/**
 * Urcă o fișă Word sub un nume nou (`<tabla>-<ceva>.docx`): o fișă înlocuită
 * sub același nume s-ar fi văzut veche, fiindcă browserele țin minte adresa.
 * `{ fisa: {fisier, nume, marime} }` ori `{ eroare }`.
 */
export async function urcaFisa(slug, file) {
  if (!file) return { eroare: "Alege un fișier." };
  if (!/\.docx$/i.test(file.name || "")) return { eroare: "Fișa trebuie să fie Word (.docx)." };
  if (file.size > MAX_FISA) return { eroare: "Fișa are peste 10 MB." };
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  const fisier = `${slug}-${[...a].map((x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join("")}.docx`;
  const { error } = await supabase.storage.from(GALEATA_FISE)
    .upload(fisier, file, { contentType: DOCX, upsert: false });
  if (error) { console.warn("urcaFisa:", error.message); return { eroare: "Fișa n-a intrat în găleată." }; }
  return { fisa: { fisier, nume: file.name, marime: file.size } };
}

/** Șterge fișierul unei fișe scoase ori înlocuite. Nu oprește nimic dacă nu iese. */
export async function stergeFisierFisa(fisier) {
  if (!fisier) return;
  const { error } = await supabase.storage.from(GALEATA_FISE).remove([fisier]);
  if (error) console.warn("stergeFisierFisa, fișierul a rămas:", error.message);
}

/**
 * Urmărește tabla: `laSchimbare(continut)` la fiecare scriere, `laSchimbare(null)`
 * când e golită. `laStare(conectat)` spune dacă legătura live e în picioare.
 * Întoarce funcția care oprește urmărirea.
 *
 * Fără filtru pe `slug` în abonament: ștergerile nu se pot filtra în Realtime,
 * deci se prind toate și se alege aici. Sunt puține table, nu costă nimic.
 */
export function urmaresteTabla(slug, laSchimbare, laStare = () => {}) {
  const canal = supabase
    .channel(`tabla-live:${slug}:${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tabla_live" }, (p) => {
      if (p.eventType === "DELETE") {
        if (p.old?.slug === slug) laSchimbare(null);
        return;
      }
      if (p.new?.slug === slug) laSchimbare(p.new.data || null);
    })
    .subscribe((stare) => laStare(stare === "SUBSCRIBED"));
  return () => { try { supabase.removeChannel(canal); } catch { /* deja închis */ } };
}

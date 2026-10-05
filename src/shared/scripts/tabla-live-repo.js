// =========================================================
// TABLA LIVE (0106): ce scrie adminul pe o tablă #LaTablă se vede pe loc la
// toți cei care au tabla deschisă.
//
// Un rând pe tablă, în `tabla_live`, cu tot conținutul în `data`. Adminul îl
// suprascrie; ceilalți îl citesc la deschidere și apoi primesc schimbările prin
// Realtime. Regula o ține baza: scrie doar `is_admin_user()`.
// =========================================================
import { supabase } from "./supabase-client.js";

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

/** Golește tabla (doar adminul): rândul pleacă, iar paginile deschise află. */
export async function golesteTabla(slug) {
  const { error } = await supabase.from("tabla_live").delete().eq("slug", slug);
  if (error) { console.warn("golesteTabla:", error.message); return false; }
  return true;
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

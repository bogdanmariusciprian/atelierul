// =========================================================
// Filele din panoul unui domeniu de lecții și etichetele lor (0104).
// „Toate" nu stă în bază: e lista întreagă. O lecție stă în oricâte file,
// după slug-ul ei stabil. Le citește oricine; le schimbă doar adminul, iar
// regula o ține baza, nu pagina.
// =========================================================
import { supabase } from "./supabase-client.js";

/**
 * Toate filele și etichetele, dintr-odată (sunt puține).
 * `file`: [{ id, domeniu, nume, ordine }], în ordinea lor.
 * `etichete`: Map fila_id → Set de slug-uri.
 * Gol dacă nu se pot citi (ori dacă 0104 nu e încă rulată): panoul arată
 * atunci doar lista întreagă, nu crapă.
 */
export async function fileSiEtichete() {
  const [f, e] = await Promise.all([
    supabase.from("lectii_file").select("id, domeniu, nume, ordine")
      .order("ordine", { ascending: true }).order("creat_la", { ascending: true }),
    supabase.from("lectii_etichete").select("fila_id, slug"),
  ]);
  if (f.error) { console.warn("fileSiEtichete:", f.error.message); return { file: [], etichete: new Map() }; }
  if (e.error) console.warn("fileSiEtichete:", e.error.message);
  const etichete = new Map();
  for (const r of e.data || []) {
    if (!etichete.has(r.fila_id)) etichete.set(r.fila_id, new Set());
    etichete.get(r.fila_id).add(r.slug);
  }
  return { file: f.data || [], etichete };
}

const curat = (s) => String(s || "").replace(/\s+/g, " ").trim();

/** Filă nouă la capătul domeniului. `{ fila }` ori `{ eroare }`. */
export async function adaugaFila(domeniu, nume, ordine) {
  const n = curat(nume);
  if (!n) return { eroare: "Scrie un nume." };
  if (n.length > 40) return { eroare: "Numele are cel mult 40 de semne." };
  const { data, error } = await supabase.from("lectii_file")
    .insert({ domeniu, nume: n, ordine }).select("id, domeniu, nume, ordine").single();
  if (error) {
    console.warn("adaugaFila:", error.message);
    return { eroare: error.code === "23505" ? "E deja o filă cu numele ăsta." : "N-am putut adăuga fila." };
  }
  return { fila: data };
}

/** Alt nume pentru o filă. `{ fila }` ori `{ eroare }`. */
export async function redenumesteFila(id, nume) {
  const n = curat(nume);
  if (!n) return { eroare: "Scrie un nume." };
  if (n.length > 40) return { eroare: "Numele are cel mult 40 de semne." };
  const { data, error } = await supabase.from("lectii_file")
    .update({ nume: n }).eq("id", id).select("id, domeniu, nume, ordine").maybeSingle();
  if (error || !data) {
    if (error) console.warn("redenumesteFila:", error.message);
    return { eroare: error?.code === "23505" ? "E deja o filă cu numele ăsta." : "N-am putut redenumi fila." };
  }
  return { fila: data };
}

/** Șterge fila; etichetele ei pleacă odată cu ea, lecțiile rămân. */
export async function stergeFila(id) {
  const { error } = await supabase.from("lectii_file").delete().eq("id", id);
  if (error) { console.warn("stergeFila:", error.message); return false; }
  const { data } = await supabase.from("lectii_file").select("id").eq("id", id).maybeSingle();
  return !data;
}

/**
 * Pune (`da = true`) ori scoate lecția din filă. Întoarce ce a rămas în
 * bază, nu ce s-a cerut: dacă baza refuză, pagina arată adevărul.
 */
export async function puneEticheta(filaId, slug, da) {
  const { error } = da
    ? await supabase.from("lectii_etichete")
        .upsert({ fila_id: filaId, slug }, { onConflict: "fila_id,slug", ignoreDuplicates: true })
    : await supabase.from("lectii_etichete").delete().eq("fila_id", filaId).eq("slug", slug);
  if (error) console.warn("puneEticheta:", error.message);
  const { data } = await supabase.from("lectii_etichete").select("slug")
    .eq("fila_id", filaId).eq("slug", slug).maybeSingle();
  const pus = !!data;
  return { ok: !error && pus === da, pus };
}

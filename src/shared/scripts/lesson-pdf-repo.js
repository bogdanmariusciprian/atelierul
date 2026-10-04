// =========================================================
// Lecțiile PDF de la Literatură (liceu) (0105). Rândul stă în `lectii_pdf`,
// fișierul în găleata publică `lectii-pdf`. Le citește oricine, chiar nelogat;
// le urcă, le înlocuiește și le șterge doar adminul (regula o ține baza).
//
// Fișierul primește un nume NOU la fiecare înlocuire (`<slug>-<ceva>.pdf`):
// adresa publică e ținută minte de browsere o vreme, iar un PDF înlocuit sub
// același nume s-ar fi văzut vechi încă o oră.
// =========================================================
import { supabase } from "./supabase-client.js";

const GALEATA = "lectii-pdf";
const MAX = 20 * 1024 * 1024;          // ca în găleată (0105)
const COLOANE = "id, slug, domeniu, titlu, rezumat, fisier, marime, creat_la, actualizat_la";

/** Un șir scurt de litere mici și cifre, pentru nume de fișier și adrese. */
const bucata = (n = 8) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join("");
};

/** Adresa publică a fișierului (nu cere cont). */
export function adresaPdf(fisier) {
  return supabase.storage.from(GALEATA).getPublicUrl(fisier).data.publicUrl;
}

/** Aceeași adresă, dar care cere descărcarea, cu numele lecției pe fișier.
 *  Atributul `download` singur nu ajunge: browserele îl ignoră pe alt domeniu. */
export function adresaDescarcare(fisier, titlu) {
  const nume = `${String(titlu || "lectie").replace(/[\\/:*?"<>|]+/g, " ").trim() || "lectie"}.pdf`;
  return supabase.storage.from(GALEATA).getPublicUrl(fisier, { download: nume }).data.publicUrl;
}

/** Toate lecțiile PDF, în ordinea în care au fost urcate. Gol dacă nu se pot
 *  citi (ori dacă 0105 nu e încă rulată): lista arată atunci restul lecțiilor. */
export async function lectiiPdf() {
  const { data, error } = await supabase.from("lectii_pdf").select(COLOANE)
    .order("creat_la", { ascending: true });
  if (error) { console.warn("lectiiPdf:", error.message); return []; }
  return data || [];
}

/** O lecție PDF după adresa ei; `null` dacă nu există. */
export async function lectiePdf(slug) {
  const s = String(slug || "").trim().toLowerCase();
  if (!/^pdf-[a-z0-9]{4,24}$/.test(s)) return null;
  const { data, error } = await supabase.from("lectii_pdf").select(COLOANE).eq("slug", s).maybeSingle();
  if (error) { console.warn("lectiePdf:", error.message); return null; }
  return data || null;
}

function verificaFisierul(file) {
  if (!file) return "Alege un fișier.";
  const ePdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
  if (!ePdf) return "Fișierul trebuie să fie PDF.";
  if (file.size > MAX) return "Fișierul are peste 20 MB.";
  return "";
}

async function urcaFisierul(slug, file) {
  const fisier = `${slug}-${bucata(6)}.pdf`;
  /* Felul se spune pe față: un fișier venit de pe disc cu felul gol ar fi
     oprit la ușa găleții, care primește doar `application/pdf`. */
  const { error } = await supabase.storage.from(GALEATA)
    .upload(fisier, file, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(error.message);
  return fisier;
}

/**
 * Urcă o lecție nouă: întâi fișierul, apoi rândul. Dacă rândul nu intră,
 * fișierul se șterge, ca să nu rămână în găleată un PDF pe care nu-l arată
 * nimeni. `{ lectie }` ori `{ eroare }`.
 */
export async function urcaPdf({ file, titlu, rezumat, domeniu }) {
  const greseala = verificaFisierul(file);
  if (greseala) return { eroare: greseala };
  const t = String(titlu || "").replace(/\s+/g, " ").trim();
  if (t.length < 3) return { eroare: "Titlul are cel puțin 3 semne." };
  if (t.length > 120) return { eroare: "Titlul are cel mult 120 de semne." };
  const r = String(rezumat || "").replace(/\s+/g, " ").trim();
  if (r.length > 200) return { eroare: "Rândul de descriere are cel mult 200 de semne." };

  const slug = `pdf-${bucata(8)}`;
  let fisier;
  try { fisier = await urcaFisierul(slug, file); }
  catch (e) { console.warn("urcaPdf:", e.message); return { eroare: "Fișierul n-a intrat în găleată." }; }

  const { data, error } = await supabase.from("lectii_pdf")
    .insert({ slug, domeniu, titlu: t, rezumat: r || null, fisier, marime: file.size })
    .select(COLOANE).single();
  if (error) {
    console.warn("urcaPdf:", error.message);
    await supabase.storage.from(GALEATA).remove([fisier]);
    return { eroare: "Lecția n-a putut fi salvată." };
  }
  return { lectie: data };
}

/** Pune alt PDF în locul celui vechi, păstrând adresa lecției. `{ lectie }` ori `{ eroare }`. */
export async function inlocuiestePdf(lectie, file) {
  const greseala = verificaFisierul(file);
  if (greseala) return { eroare: greseala };
  let fisier;
  try { fisier = await urcaFisierul(lectie.slug, file); }
  catch (e) { console.warn("inlocuiestePdf:", e.message); return { eroare: "Fișierul n-a intrat în găleată." }; }

  const { data, error } = await supabase.from("lectii_pdf")
    .update({ fisier, marime: file.size, actualizat_la: new Date().toISOString() })
    .eq("id", lectie.id).select(COLOANE).maybeSingle();
  if (error || !data) {
    if (error) console.warn("inlocuiestePdf:", error.message);
    await supabase.storage.from(GALEATA).remove([fisier]);
    return { eroare: "Lecția n-a putut fi schimbată." };
  }
  const { error: e2 } = await supabase.storage.from(GALEATA).remove([lectie.fisier]);
  if (e2) console.warn("inlocuiestePdf, fișierul vechi a rămas:", e2.message);
  return { lectie: data };
}

/** Șterge lecția: rândul, fișierul și semnele ei (file, „BAC"). */
export async function stergePdf(lectie) {
  const { error } = await supabase.from("lectii_pdf").delete().eq("id", lectie.id);
  if (error) { console.warn("stergePdf:", error.message); return false; }
  const { data } = await supabase.from("lectii_pdf").select("id").eq("id", lectie.id).maybeSingle();
  if (data) return false;
  const rest = await Promise.all([
    supabase.storage.from(GALEATA).remove([lectie.fisier]),
    supabase.from("lectii_etichete").delete().eq("slug", lectie.slug),
    supabase.from("lectii_bac").delete().eq("slug", lectie.slug),
  ]);
  rest.forEach((x) => { if (x.error) console.warn("stergePdf, a rămas ceva:", x.error.message); });
  return true;
}

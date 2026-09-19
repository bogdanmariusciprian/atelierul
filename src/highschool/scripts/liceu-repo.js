// =========================================================
// DATELE MODULULUI „LICEU" (migrarea 0091).
//
// Orarul zilei, cu lecția fiecărei ore și cu „a câta din an". Tabelele sunt
// admin-only: pentru oricine altcineva cererea se întoarce goală, iar cardul
// spune că n-are orar. Pagina rămâne publică; datele nu.
//
// PLASA DIN BROWSER. La școală netul merge pe cablu, dar dacă pică, ultima zi
// citită rămâne în browser și se arată cu ceasul ei („date de la 8:12"). Cheia
// poartă numele contului (`cheiaMea`), ca două conturi de pe același calculator
// să nu se vadă unul pe altul.
//
// CITEȘTE ORICINE (migrarea 0092). Orarul și planificările sunt deschise, așa
// cum a cerut Marius; scrierea rămâne a profesorului. Depozitul ăsta nu întreabă
// pe nimeni cine e: dacă mâine citirea se strâmtează la loc, politica din bază
// o face singură, iar aici nu se schimbă o literă.
// Cuprins în română, nume în engleză.
// =========================================================
import { supabase } from "../../shared/scripts/supabase-client.js";
import { cheiaMea } from "../../shared/scripts/session.js";

const CHEIE = (nume) => cheiaMea(`liceu:${nume}`);

/* Anul școlar, scris o singură dată. Era literal în patru locuri; la vară,
   uitat într-unul singur, ar fi amestecat doi ani în același ecran. */
export const AN_SCOLAR = "2026-2027";

function pune(nume, date) {
  try { localStorage.setItem(CHEIE(nume), JSON.stringify({ la: Date.now(), date })); }
  catch { /* mod privat ori memorie plină */ }
}

function scoate(nume) {
  try {
    const brut = localStorage.getItem(CHEIE(nume));
    if (!brut) return null;
    const p = JSON.parse(brut);
    return p && p.date !== undefined ? p : null;
  } catch { return null; }
}

/** Întoarce mereu `{ date, offline, la }`. `offline: true` = cererea n-a
 *  răspuns și astea sunt datele vechi. */
async function cuPlasa(nume, cerere, gol) {
  try {
    const date = await cerere();
    pune(nume, date);
    return { date, offline: false, la: Date.now() };
  } catch (err) {
    console.warn(`liceu-repo/${nume}:`, err?.message || err);
    const vechi = scoate(nume);
    if (vechi) return { date: vechi.date, offline: true, la: vechi.la };
    return { date: gol, offline: true, la: null };
  }
}

function verifica({ data, error }) {
  if (error) throw new Error(error.message || "cererea n-a răspuns");
  return data;
}

/** Ziua ca text, „2026-09-22". De mână, nu cu `toISOString()`: aceea trece prin
 *  UTC și, seara, dă ziua următoare. */
export const ziuaISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Orele unei zile: clasa, sala, ceasurile, lecția din planificare și „a câta din
 * câte". O singură cerere; alăturarea o face funcția din bază.
 */
export async function fetchZiua(zi = ziuaISO()) {
  return cuPlasa(`zi:${zi}`, async () => {
    const date = verifica(await supabase.rpc("liceu_azi", { p_data: zi }));
    return (date || []).map((r) => ({
      period: r.period,
      clasa: r.clasa,
      sala: r.sala,
      start: r.ora_start,
      sfarsit: r.ora_sfarsit,
      planId: r.plan_id,
      nr: r.nr,
      dinCate: r.din_cate,
      unitatea: r.unitatea,
      titlu: r.titlu,
      fel: r.fel,
    }));
  }, []);
}

/**
 * Orarul întreg al săptămânii, cel în vigoare azi. Îi trebuie cardului pentru
 * zilele fără ore: ca să spună „urmează joi, la 8:50 cu 12D", trebuie să știe
 * ce e în celelalte zile, nu doar în cea de azi.
 */
export async function fetchSaptamana() {
  return cuPlasa("saptamana", async () => {
    const randuri = verifica(
      await supabase.from("school_timetable")
        .select("zi, period, clasa, sala, valabil_de_la, eticheta")
        .lte("valabil_de_la", ziuaISO())
        .order("valabil_de_la", { ascending: false })
    ) || [];
    if (!randuri.length) return [];
    /* Se ține numai orarul cel mai nou dintre cele începute: rândurile vin
       sortate descrescător, deci prima dată găsită e cea bună. */
    const deLa = randuri[0].valabil_de_la;
    const eticheta = randuri[0].eticheta || "";
    return randuri.filter((r) => r.valabil_de_la === deLa)
      .map(({ zi, period, clasa, sala }) => ({ zi, period, clasa, sala, deLa, eticheta }));
  }, []);
}

/**
 * Orarele anului, cu etichetele lor, în ordinea intrării în vigoare.
 *
 * Îi trebuie listei unei clase: acolo se pune o bandă la fiecare schimbare de
 * orar, ca să se vadă de unde încolo s-a mutat ora. Sunt trei rânduri pe an,
 * deci se cer o dată și se țin.
 */
export async function fetchOrare() {
  return cuPlasa("orare", async () => {
    const randuri = verifica(
      await supabase.from("school_timetable")
        .select("valabil_de_la, eticheta")
        .eq("an_scolar", AN_SCOLAR)
        .order("valabil_de_la")
    ) || [];
    const vazute = new Map();
    for (const r of randuri) {
      if (!vazute.has(r.valabil_de_la)) vazute.set(r.valabil_de_la, r.eticheta || "");
    }
    return [...vazute].map(([din, eticheta]) => ({ din, eticheta }));
  }, []);
}

/**
 * Planificarea unei clase: toate orele anului, în ordine.
 *
 * NU se cere și coloana `blocuri`. Acolo stau noțiunile, activitățile și vorba
 * „pentru fișa de bacalaureat" — sute de kilobiți pe clasă, dintre care lista
 * n-are nevoie de nicio literă. Se aduc doar cele șase coloane care se văd.
 */
export async function fetchPlan(clasa) {
  return cuPlasa(`plan:${clasa}`, async () => verifica(
    await supabase.from("school_plan")
      .select("nr, data, ora, fel, unitatea, titlu")
      .eq("clasa", clasa)
      .eq("an_scolar", AN_SCOLAR)
      .order("nr")
  ) || [], []);
}

/**
 * O fișă, adusă din găleata privată (migrarea 0095).
 *
 * NU TRECE PRIN PLASĂ. Celelalte cereri de aici își țin ultimul răspuns în
 * browser, ca să meargă și fără net; o fișă are între 200 KB și 4 MB, iar nouă
 * dintre ele ar fi umplut memoria browserului de câteva ori peste ce-i dă el
 * voie unui sit. Cine are nevoie de ea o cere din nou.
 *
 * Întoarce textul paginii, nu o adresă: găleata e privată, deci fișierul nu are
 * o adresă pe care s-o poată deschide cineva. Vine ca text și se face adresă
 * `blob:` în modul, bună cât ține fila.
 */
export async function fetchFisa(cheie) {
  const { data, error } = await supabase.storage.from("liceu-fise").download(cheie);
  if (error) throw new Error(error.message || "fișa n-a venit din găleată");
  return await data.text();
}

/** Lista fișelor (migrarea 0096). Fără plasă: e o listă scurtă, și dacă nu vine,
 *  e mai bine să se vadă că nu vine decât să se arate una veche. */
export async function fetchFise() {
  const randuri = verifica(
    await supabase.from("school_fise")
      .select("clasa, ore, fel, titlu, slug, fisier, cale")
      .eq("an_scolar", AN_SCOLAR)
  );
  return randuri || [];
}

/**
 * Scrie o fișă: întâi fișierul în găleată, apoi rândul.
 *
 * ÎN ORDINEA ASTA, DINADINS. Dacă rândul nu intră, rămâne un fișier fără rând:
 * nimeni nu-l vede, nu strică nimic, iar paza migrării ți-l arată. Pe dos, ar fi
 * rămas un rând fără fișier — adică o fișă scrisă în listă, pe care o deschizi
 * la oră și nu vine.
 *
 * `upsert` la amândouă: același drum și pentru o fișă nouă, și pentru
 * înlocuirea uneia care există. Altfel ar fi fost două funcții care fac aproape
 * același lucru, iar una dintre ele s-ar fi stricat pe tăcute.
 */
export async function salveazaFisa({ clasa, ore, fel, titlu, fisier, file }) {
  const urcat = await supabase.storage.from("liceu-fise")
    .upload(fisier, file, { contentType: "text/html", upsert: true });
  if (urcat.error) throw new Error(urcat.error.message || "fișierul n-a intrat în găleată");

  verifica(await supabase.from("school_fise").upsert({
    an_scolar: AN_SCOLAR,
    clasa, ore, titlu, fisier,
    fel: fel || null,
    slug: fisier.replace(/\.html$/i, ""),
  }, { onConflict: "an_scolar,slug" }));
}

/**
 * Scoate o fișă: întâi rândul, apoi fișierul.
 *
 * TOT DINADINS PE DOS FAȚĂ DE SCRIERE. Dacă ștergerea fișierului dă greș, rămâne
 * un fișier pe care nu-l mai cheamă nimeni — gunoi, nu greșeală. Pe dos, ar fi
 * rămas un rând care arată spre un fișier șters.
 */
export async function stergeFisa({ slug, fisier }) {
  verifica(await supabase.from("school_fise").delete()
    .eq("an_scolar", AN_SCOLAR).eq("slug", slug));
  if (fisier) {
    const { error } = await supabase.storage.from("liceu-fise").remove([fisier]);
    if (error) console.warn("liceu-repo/stergeFisa, fișierul a rămas:", error.message);
  }
}

/** Ceasurile intervalelor și structura anului, din `school_config`. */
export async function fetchConfig() {
  return cuPlasa("config", async () => {
    const randuri = verifica(await supabase.from("school_config").select("cheie, valoare"));
    return Object.fromEntries((randuri || []).map((r) => [r.cheie, r.valoare]));
  }, {});
}

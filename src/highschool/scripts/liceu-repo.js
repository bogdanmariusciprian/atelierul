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
// NU SE CERE NIMIC DACĂ NU E PROFESORUL LOGAT. Altfel fiecare vizitator ar
// suna la server ca să afle că n-are voie.
// Cuprins în română, nume în engleză.
// =========================================================
import { supabase } from "../../shared/scripts/supabase-client.js";
import { cheiaMea, isAdmin } from "../../shared/scripts/session.js";

const CHEIE = (nume) => cheiaMea(`liceu:${nume}`);

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
  if (!isAdmin()) return { date: gol, offline: false, la: null, strain: true };
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
        .select("zi, period, clasa, sala, valabil_de_la")
        .lte("valabil_de_la", ziuaISO())
        .order("valabil_de_la", { ascending: false })
    ) || [];
    if (!randuri.length) return [];
    /* Se ține numai orarul cel mai nou dintre cele începute: rândurile vin
       sortate descrescător, deci prima dată găsită e cea bună. */
    const deLa = randuri[0].valabil_de_la;
    return randuri.filter((r) => r.valabil_de_la === deLa)
      .map(({ zi, period, clasa, sala }) => ({ zi, period, clasa, sala }));
  }, []);
}

/** Ceasurile intervalelor și structura anului, din `school_config`. */
export async function fetchConfig() {
  return cuPlasa("config", async () => {
    const randuri = verifica(await supabase.from("school_config").select("cheie, valoare"));
    return Object.fromEntries((randuri || []).map((r) => [r.cheie, r.valoare]));
  }, {});
}

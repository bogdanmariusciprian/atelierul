// =========================================================
// SEMNUL „MODULUL LICEU E DESCHIS" (migrarea 0094).
//
// Un singur bit, ținut în `school_config`, pe care numai profesorul îl schimbă.
// Stins, orarul și planificările nu se mai citesc de nimeni afară de el — și nu
// „nu se mai desenează", ci chiar nu se mai dau: politicile din bază îl întreabă
// înainte de orice rând. Ce e aici, în browser, e doar chipul lacătului:
// butonul „L" care se ascunde și fereastra de peste modul.
//
// DE CE STĂ ÎN `shared` ȘI NU ÎN MODUL. Îl întreabă două părți care n-au nimic
// una cu alta: bara sitului, pe fiecare pagină, ca să știe dacă pune „L"-ul; și
// modulul însuși, ca să știe dacă desenează ori arată fereastra. Scris în modul,
// bara ar fi tras după ea tot depozitul lui.
//
// PLASA E A CONTULUI. Răspunsul se ține în browser, ca „L"-ul să nu clipească
// la fiecare pagină cât se duce cererea. Cheia poartă numele contului: pe un
// calculator de școală, unde profesorul și un elev intră pe rând, altfel
// răspunsul „e deschis" al unuia i-ar fi rămas celuilalt în față.
//
// CÂND NU SE ȘTIE NIMIC, NU SE ARATĂ. Prima intrare dintr-un browser nou n-are
// nimic în plasă; atunci „L"-ul lipsește până sosește răspunsul. Așa, o
// nepotrivire înclină spre ascuns, nu spre arătat.
// Cuprins în română, nume în engleză.
// =========================================================
import { supabase } from "./supabase-client.js";
import { iaLocal, punLocal, isAdmin } from "./session.js";

const CHEIE = "liceu:deschis";

/** Ce știm ACUM, fără să întrebăm serverul: `true`, `false` ori `null` = habar
 *  n-avem încă. `null` nu e totuna cu `false` și nu se poate strânge la el. */
export function liceuDeschisStiut() {
  const v = iaLocal(CHEIE, null);
  return typeof v === "boolean" ? v : null;
}

/**
 * Întreabă baza. Semnul e citibil de oricine, dinadins: pagina trebuie să afle
 * dacă e deschisă înainte să deseneze ceva, iar o vorbă de „da / nu" nu spune
 * nimănui nimic despre orar.
 *
 * Dacă cererea nu răspunde, rămâne ce știam; dacă nu știam nimic, rămâne
 * închis. Nu deschidem niciodată din lipsă de răspuns.
 */
export async function aduLiceuDeschis() {
  try {
    const { data, error } = await supabase
      .from("school_config").select("valoare").eq("cheie", "liceu_deschis").maybeSingle();
    if (error) throw new Error(error.message);
    const da = data?.valoare?.da === true;
    punLocal(CHEIE, da);
    return da;
  } catch (err) {
    console.warn("liceu-gate:", err?.message || err);
    return liceuDeschisStiut() ?? false;
  }
}

/**
 * Aprinde ori stinge semnul. Numai profesorul; pentru oricine altcineva baza
 * refuză, iar noi nu mințim comutatorul.
 *
 * ÎNTOARCE CE A RĂMAS ÎN BAZĂ, nu ce s-a cerut. Regula de la butoanele cu
 * elevi: dacă serverul n-a primit, comutatorul NU se mișcă. Unul care arată
 * „deschis" fără să fie e mai rău decât unul care nu merge, fiindcă te bizui pe
 * el și lași modulul deschis crezând că l-ai închis.
 *
 * @returns {Promise<{da: boolean, mers: boolean}>}
 */
export async function puneLiceuDeschis(da) {
  const cerut = da === true;
  try {
    if (!isAdmin()) throw new Error("numai profesorul schimbă semnul");
    const { data, error } = await supabase
      .from("school_config")
      .update({ valoare: { da: cerut } })
      .eq("cheie", "liceu_deschis")
      .select("valoare")
      .maybeSingle();
    if (error) throw new Error(error.message);
    /* Fără rând întors, politica a refuzat în tăcere: `update` care nu prinde
       niciun rând nu e o greșeală pentru Postgres, dar pentru noi e un refuz. */
    if (!data) throw new Error("baza n-a schimbat niciun rând");
    const acum = data.valoare?.da === true;
    punLocal(CHEIE, acum);
    return { da: acum, mers: acum === cerut };
  } catch (err) {
    console.warn("liceu-gate/pune:", err?.message || err);
    return { da: liceuDeschisStiut() ?? false, mers: false };
  }
}

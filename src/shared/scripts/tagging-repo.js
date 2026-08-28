// =========================================================
// Etichetarea cuvintelor de către elevi, la meditație.
//
// DE CE EXISTĂ. Banca de material se etichetează cuvânt cu cuvânt, iar treaba e
// lungă pentru un singur om. Numai că, privind mai atent, nici nu e o corvoadă
// de dat altcuiva: a hotărî că „ceapă" e bun pentru grupuri de sunete E chiar
// exercițiul. Deci lucrul se mută acolo unde se și învață.
//
// CE ȘTIE MODULUL ĂSTA, ȘI CE NU. Știe două lucruri: dacă e deschis
// comutatorul, și cum se trimite o etichetare. Nu știe cine are voie și nu
// verifică nimic: aceea e treaba bazei (migrarea 0082), fiindcă o regulă care
// trăiește în browser se ocolește cu unealta de dezvoltare. Ce se face aici e
// numai ca elevul să nu vadă un buton care oricum n-ar merge.
//
// ÎNGĂDUINȚA E A ELEVULUI, NU A SITULUI (din 28 august 2026, migrarea 0088).
// Stătea într-un singur da/nu pentru toată lumea (`app_flags['pupil_tagging']`):
// îl ridicai, și puteau eticheta toți elevii de la meditații deodată. Numai că
// Marius lucrează cu câte un elev, deci acum fiecare are comutatorul lui, în
// `planner_pupils.can_tag`. Rândul vechi din `app_flags` a rămas în bază, dar
// nu-l mai citește nimeni.
// =========================================================
import { supabase } from "./supabase-client.js";
import { iaLocal, punLocal, CURRENT_USER } from "./session.js";

/* Ce știam ultima dată. Nu e o memorie de dragul vitezei: fără ea, tabla s-ar
   desena o clipă fără semnele de etichetare și ar sări pe urmă, la sosirea
   răspunsului. O clipire care spune „nu se poate" și apoi „ba se poate" e mai
   rea decât o așteptare tăcută. */
const CHEIE_MEMORIE = "atelier:tagging";
/* Ținut pe CONT, nu pe browser. Aici e doar o amintire, nu o pază, dar regula
   e aceeași peste tot: nimic din ce știe un cont nu se moștenește de altul pe
   același calculator. Vezi `session.js`. */
let deschisAcum = iaLocal(CHEIE_MEMORIE, false) === true;

function tineMinte(val) {
  deschisAcum = !!val;
  punLocal(CHEIE_MEMORIE, !!val);
}

/** Ce știam despre comutator, fără să întrebăm serverul. */
export const eDeschisDupaMemorie = () => deschisAcum;

/** Am EU voie să etichetez acum? Întrebat la sursă.
 *
 *  Se cere prin funcția din bază, nu citind `planner_pupils`: elevul n-are voie
 *  să vadă lista de la meditații, iar funcția întoarce doar da sau nu, despre
 *  el. Aceeași funcție pe care o cheamă și `eticheteaza_cuvantul` ca să
 *  hotărască – deci pagina și paza nu pot ajunge să spună lucruri diferite. */
export async function eDeschis() {
  const { data, error } = await supabase.rpc("poate_eticheta");
  if (error) { console.warn("eDeschis:", error.message); return deschisAcum; }
  const val = !!data;
  tineMinte(val);
  return val;
}

/**
 * Ascultă schimbarea comutatorului MEU, în timp real.
 *
 * Trebuie: profesorul îl stinge TOCMAI ca elevul să se oprească acum, nu la
 * următoarea deschidere a paginii. Fără asta, „am stins" ar însemna „am stins
 * pentru cine deschide pagina de-acum încolo", adică nu pentru cel cu care
 * lucrezi chiar atunci.
 *
 * ASCULTAREA ASTA N-A MERS NICIODATĂ, până la 0088. Stătea pe `app_flags`, un
 * tabel care nu fusese publicat pentru ascultare, deci nu s-a declanșat nici
 * măcar o dată; se vedea doar că „nu se întâmplă nimic", ceea ce e greu de
 * deosebit de „încă n-a apăsat". Migrarea 0088 publică `planner_pupils`.
 *
 * Filtrul cere chiar rândul elevului. Chiar și fără el, RLS-ul de pe tabel n-ar
 * lăsa să treacă rândul altuia; filtrul e ca să nu se trezească pagina la
 * fiecare schimbare din tabel.
 *
 * Întoarce o funcție care taie ascultarea.
 */
export function ascultaComutatorul(cand) {
  const eu = CURRENT_USER.authId;
  if (!eu) return () => {};
  const canal = supabase
    .channel("pupil-tagging")
    .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "planner_pupils", filter: `user_id=eq.${eu}` },
        (m) => {
          const val = !!(m && m.new && m.new.can_tag);
          tineMinte(val);
          try { cand(val); } catch (e) { console.warn("ascultaComutatorul:", e && e.message); }
        })
    .subscribe();
  return () => { try { supabase.removeChannel(canal); } catch { /* deja tăiat */ } };
}

/* Ce poate răspunde baza, pus în românește. Textele stau AICI, lângă cererea
   care le primește, nu în pagina care le arată: dacă mâine mai apare un motiv,
   se adaugă într-un singur loc, iar pagina n-are ce uita. */
const MOTIVE = {
  gata: null,
  deja: "Cuvântul ăsta a fost etichetat deja, o dată pentru totdeauna.",
  inchis: "Etichetarea e închisă acum. Se deschide la meditație.",
  "fara-drept": "Etichetarea e numai pentru elevii de la meditații.",
  "fara-etichete": "N-ai bifat nicio etichetă.",
  "prea-multe": "Prea multe etichete deodată.",
  lipseste: "Cuvântul ăsta nu mai e în bancă.",
  neconectat: "Trebuie să fii conectat.",
};

/**
 * Pune etichetele pe un cuvânt.
 *
 * Trece printr-o singură ușă, funcția din migrarea 0082, care verifică ea
 * dreptul, comutatorul și dacă nu cumva cuvântul a fost etichetat deja. De-aia
 * de aici nu se verifică nimic: două paze care se cred amândouă principale
 * ajung să se contrazică.
 */
export async function eticheteaza(itemId, etichete) {
  const { data, error } = await supabase.rpc("eticheteaza_cuvantul", {
    p_item: itemId, p_tags: etichete,
  });
  if (error) {
    console.warn("eticheteaza:", error.message);
    return { bine: false, motiv: "N-a mers acum. Mai încearcă o dată." };
  }
  const raspuns = String(data || "");
  if (raspuns === "gata") return { bine: true, motiv: null };
  /* Un răspuns pe care nu-l știm nu se arată ca atare: elevul n-are ce face cu
     „fara_drept_v2". Îi spunem că n-a mers, iar în consolă rămâne scris ce a
     zis baza, pentru cine repară. */
  return { bine: false, motiv: MOTIVE[raspuns] || "N-a mers acum. Mai încearcă o dată." };
}

/**
 * Cuvintele deja etichetate, dintre cele date.
 *
 * TRECE PRINTR-O FUNCȚIE, NU PRIN TABEL, și nu din grabă. Bifa verde înseamnă
 * „lucrat la meditație" și se cuvine să se vadă la toți, până și la un vizitator
 * nelogat. Tabelul însă ține și NUMELE celui care a etichetat, iar acela rămâne
 * numai al profesorului. Citit de-a dreptul, tabelul ar fi trebuit deschis
 * tuturor cu tot cu nume, ori ținut închis și atunci bifa s-ar fi văzut doar la
 * cel care a pus-o.
 *
 * Funcția din 0083 taie nodul: întoarce numai cuvintele, niciodată cine. Lucrul
 * se vede, omul nu.
 */
export async function celeEtichetate(ids) {
  if (!ids || !ids.length) return new Set();
  const { data, error } = await supabase.rpc("cuvintele_etichetate", { p_ids: ids });
  if (error) { console.warn("celeEtichetate:", error.message); return new Set(); }
  /* Funcția întoarce o coloană de identificatori: pe unele drumuri sosesc ca
     șiruri simple, pe altele ca obiecte cu un singur câmp. Le primim pe amândouă
     în loc să ne bizuim pe una. */
  return new Set((data || []).map((r) => (typeof r === "string" ? r : r && r.cuvintele_etichetate)));
}

// =========================================================
// ELEVII DE LA MEDITAȚII și îngăduințele lor.
//
// DE CE STĂ SINGUR. Sunt două butoane plutitoare care cer același lucru: lista
// elevilor de la meditații, cu un da/nu lângă fiecare („poate transmite
// explicații", „poate eticheta cuvinte"). Scrisă de două ori, cererea de mai jos
// ar fi trebuit să nimerească de două ori aceleași trei capcane, iar a doua oară
// fără nimeni care să-și mai amintească de ele.
//
// NU E O FUNCȚIE A PLANNERULUI, deși citește `planner_pupils`. Plannerul stă
// izolat dinadins (vezi paznicul de arhitectură), iar butoanele astea n-au
// treabă cu orarul: ele întreabă doar CINE sunt elevii și CE au voie. Se copiază
// forma cererii din `planner-repo.js`, nu codul.
//
// PAZA NU E AICI. Scrierile de mai jos merg prin RLS: baza verifică singură că
// cel care cere e profesorul (migrările 0087 și 0088). Dacă ar trece cineva pe
// lângă pagină, tot ar fi refuzat.
// =========================================================
import { supabase } from "./supabase-client.js";

/* Numele elevului stă în `profiles`, nu în `planner_pupils`, deci trebuie adus
   printr-o legătură. TREI lucruri de care depinde cererea, toate învățate pe
   pielea noastră, toate în aceeași zi:

   1. LEGĂTURA SE CERE PE NUMELE CONSTRÂNGERII. `planner_pupils` arată de două
      ori spre `profiles` (`user_id` și `granted_by`), iar o cerere care nu spune
      pe care o vrea e refuzată ca ambiguă.
   2. FĂRĂ SPAȚIU înainte de paranteză. Serverul citește tot ce e până la
      paranteză ca nume de legătură, iar un spațiu lipit la coadă îl face să nu
      mai recunoască nimic. Toate celelalte cereri din sit sunt scrise lipit; a
      mea nu era, și numai ea nu mergea.
   3. NUMAI COLOANELE PUBLICE. `profiles` n-are drept de citire pe tot tabelul:
      migrarea 0009 l-a retras și l-a dat pe coloane anume, ca datele minorilor
      să nu plece în browser. `username` NU e printre ele, iar o singură coloană
      nepermisă face serverul să refuze TOATĂ cererea, cu „permission denied for
      table profiles". Lista publică e în 0009 și 0012.

   Păzite de `proba-embeduri.js` și `proba-coloane-profil.js`. */
const PROFILE_JOIN = "profiles!planner_pupils_user_id_fkey(display_name)";

/** Îngăduințele pe care le poate da profesorul, cu numele coloanei din bază. */
export const INGADUINTE = {
  explicatii: "can_propose",   // 0087 — îmi transmit explicații la itemii de la Câmpina
  etichetare: "can_tag",       // 0088 — pun etichete pe cuvinte la #LaTablă
};

/** Elevii de la meditații, cu amândouă îngăduințele. Numai profesorul îi vede.
 *  ARUNCĂ dacă serverul refuză, ca cel care întreabă să poată spune de ce. */
export async function tutoringPupils() {
  const { data, error } = await supabase
    .from("planner_pupils")
    .select(`user_id, planner_name, can_propose, can_tag, ${PROFILE_JOIN}`);
  /* Nu întorc o listă goală la eroare. „Goală" și „n-am putut întreba" arată la
     fel pe ecran, dar înseamnă lucruri opuse, iar o dată chiar ne-a costat:
     panoul i-a spus lui Marius că n-are elevi la meditații, în timp ce în bază
     erau opt. Cine cheamă hotărăște ce scrie pe ecran. */
  if (error) throw new Error(error.message || "nu s-a putut citi lista de la meditații");
  return (data || []).map((r) => ({
    userId: r.user_id,
    name: (r.planner_name || "").trim()
      || (r.profiles?.display_name || "").trim() || "elev",
    can: { explicatii: !!r.can_propose, etichetare: !!r.can_tag },
  })).sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

/** Pornește ori oprește o îngăduință, pentru un elev. Baza verifică cine cere. */
export async function setPupilPermission(userId, ingaduinta, pornit) {
  const coloana = INGADUINTE[ingaduinta];
  if (!coloana) { console.warn("setPupilPermission: îngăduință necunoscută:", ingaduinta); return false; }
  const { error } = await supabase.from("planner_pupils")
    .update({ [coloana]: !!pornit }).eq("user_id", userId);
  if (error) { console.warn("setPupilPermission:", error.message); return false; }
  return true;
}

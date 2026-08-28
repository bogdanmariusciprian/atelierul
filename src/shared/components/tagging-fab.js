// =========================================================
// „Etichetare cuvinte fonetică din #LaTablă" — comutatoarele profesorului, pe elev.
//
// CE S-A SCHIMBAT ȘI DE CE. Până la 28 august 2026 butonul ăsta era un singur
// da/nu pentru tot situl: îl deschideai, și puteau eticheta toți elevii de la
// meditații deodată. Numai că Marius lucrează cu câte un elev, nu cu toți, așa
// că a cerut același tipar ca la explicații: deschizi butonul, vezi lista, și
// pornești pe cine stă cu tine. Îngăduința s-a mutat din `app_flags` în coloana
// `planner_pupils.can_tag` (migrarea 0088).
//
// SPUNE ÎNTREG CE FACE, NU PE SCURT. Scria cândva doar „Etichetare: DESCHISĂ",
// și era prea puțin: peste o lună, „etichetare" singur nu-ți mai spune nici ce
// se etichetează, nici unde, nici cine.
//
// PURTAREA E ÎMPĂRȚITĂ cu butonul EleviMED: amândouă sunt același lucru, cu alt
// text (`pupil-switch-fab.js`). Aici rămâne doar ce-l deosebește.
// =========================================================
import { pupilSwitchFab } from "./pupil-switch-fab.js";

export const initTagging = pupilSwitchFab({
  wrapClass: "tagging-fab-wrap",
  permission: "etichetare",
  label: "Etichetare cuvinte fonetică din #LaTablă",
  titles: {
    problem: "N-am putut citi lista de la meditații. Apasă ca să vezi de ce.",
    some: (n) => `${n === 1 ? "Un elev poate pune" : "Elevii porniți pot pune"} etichete pe cuvinte la #LaTablă. Apasă ca să vezi lista.`,
    none: "Niciun elev nu poate eticheta acum. Apasă ca să pornești pe cine lucrează cu tine.",
  },
  empty: "N-ai încă elevi la meditații. Îi adaugi din planificator.",
});

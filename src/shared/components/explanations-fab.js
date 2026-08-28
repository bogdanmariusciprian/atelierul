// =========================================================
// „EleviMED îmi transmit explicații Câmpina" — comutatoarele profesorului, pe elev.
//
// TEXTUL E ALES DE MARIUS, cuvânt cu cuvânt: „EleviMED" sunt elevii lui de la
// meditații, „îmi transmit" spune limpede în ce sens curge lucrul (de la ei
// către el), iar „Câmpina" leagă butonul de banca de itemi la care se scriu
// explicațiile. Nu-l prescurta și nu-l „îmbunătăți": rostul lui e ca peste șase
// luni să știe din prima ce face butonul. Păzit de o probă.
//
// LA CE E BUN. Elevii de la meditații scriu explicații la itemii care n-au
// niciuna, dar numai cât stai cu ei. Butonul îi pornește și îi oprește unul câte
// unul, din orice pagină.
//
// PURTAREA E ÎMPĂRȚITĂ cu butonul de etichetare: amândouă sunt același lucru,
// cu alt text (`pupil-switch-fab.js`). Aici rămâne doar ce-l deosebește.
// =========================================================
import { pupilSwitchFab } from "./pupil-switch-fab.js";

export const initExplanationProposals = pupilSwitchFab({
  wrapClass: "explan-fab-wrap",
  permission: "explicatii",
  label: "EleviMED îmi transmit explicații Câmpina",
  /* Sfaturile spun același lucru ca butonul, cu aceleași cuvinte: „transmit",
     nu „propun". Două vorbe pentru aceeași faptă te pun să te întrebi dacă nu-s
     cumva două lucruri diferite. */
  /* SFATUL SPUNE ȘI UNDE SE SCRIU. Fără asta, butonul spune ce se întâmplă, dar
     nu unde: „îmi transmit explicații" – de acolo, din ce loc? Explicațiile se
     scriu numai în modul Relaxed (Teste → Admitere Câmpina), fiindcă doar acolo
     stă tot subiectul deschis, cu câmpul de notă sub fiecare item. Peste o lună,
     asta e chiar lucrul pe care nu ți-l mai amintești. */
  titles: {
    problem: "N-am putut citi lista de la meditații. Apasă ca să vezi de ce.",
    some: () => "Elevii porniți îți transmit explicații din modul RELAXED (Teste → Admitere Câmpina), la itemii care n-au încă una. Apasă ca să vezi lista.",
    none: "Niciun elev nu-ți transmite explicații acum. Le scriu din modul RELAXED (Teste → Admitere Câmpina). Apasă ca să pornești pe cine lucrează cu tine.",
  },
  empty: "N-ai încă elevi la meditații. Îi adaugi din planificator.",
});

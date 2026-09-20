// =========================================================
// ÎMPĂCAREA JURNALULUI DE APĂSĂRI.
//
// Cel care conduce trimite, în fiecare mesaj, TOATĂ lista apăsărilor de la
// deschiderea fișei. Cel care urmează își are lista lui, cu ce a apăsat deja.
// Aici se hotărăște, din cele două liste, ce are de făcut – și atât: nicio
// atingere de pagină, nicio fereastră, niciun ceas. De-aia se poate proba pe
// bune, nu pe o copie a socotelii.
//
// TREI RĂSPUNSURI:
//
//   · „coada" – lista lui începe exact cu a mea și e mai lungă. Apăs ce e nou,
//     de la `deLa` încolo. Ăsta e mersul obișnuit, de zeci de ori pe oră.
//
//   · „nimic" – listele sunt la fel. Se întâmplă la fiecare repetare din trei în
//     trei secunde, deci e cazul cel mai des dintre toate.
//
//   · „de la capăt" – lista lui e mai scurtă, ori începe altfel. Atunci ne-am
//     despărțit pe drum: un mesaj pierdut la o pană de rețea, o tablă pornită
//     la mijlocul orei, ori fișa deschisă din nou la el (și jurnalul golit).
//     Singurul răspuns sigur e să iau fișa de la început și să refac tot.
//
// DE CE SE COMPARĂ LISTA, NU CÂTE SUNT. Numărul ar fi fost de ajuns dacă
// listele n-ar putea decât să crească. Dar pot și să se schimbe: la el, fișa
// redeschisă golește jurnalul și îl umple altfel. Două liste diferite de
// aceeași lungime ar fi arătat identic la numărat, iar tabla ar fi rămas să
// arate altceva decât tine pentru tot restul orei, fără ca nimeni să afle.
// Compararea costă o plimbare peste câteva zeci de șiruri, de trei ori pe
// secundă. Nimic.
// Cuprins în română, nume în engleză.
// =========================================================

/**
 * @param {string[]} aplicate  ce am apăsat deja, în ordine
 * @param {string[]} lista     ce a apăsat el, de la începutul fișei
 * @returns {{fel: "nimic"} | {fel: "coada", deLa: number} | {fel: "de-la-capat"}}
 */
export function cePunem(aplicate, lista) {
  const ale_mele = Array.isArray(aplicate) ? aplicate : [];
  const ale_lui = Array.isArray(lista) ? lista : [];

  /* Se plimbă peste lista MEA și se cere ca a lui să spună la fel pe fiecare
     pas. Cazul „lista lui e mai scurtă" cade tot de-aici, fără rând în plus:
     acolo unde ea se termină, comparația dă peste nimic și nu se mai potrivește.
     A fost un rând care-l prindea anume, dar l-am scos: nicio probă nu-l putea
     face să cadă, adică nu apăra nimic, iar cod care nu apără nimic te face să
     crezi că ești păzit. */
  for (let i = 0; i < ale_mele.length; i++) {
    if (ale_lui[i] !== ale_mele[i]) return { fel: "de-la-capat" };
  }
  if (ale_lui.length === ale_mele.length) return { fel: "nimic" };
  return { fel: "coada", deLa: ale_mele.length };
}

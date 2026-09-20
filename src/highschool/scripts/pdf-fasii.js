// =========================================================
// UN PDF, TĂIAT ÎN FÂȘII 16:9.
//
// O pagină A4 în picioare, arătată întreagă pe o tablă lată, iese cam cât o
// carte poștală la mijlocul ecranului: din a treia bancă nu se mai citește
// nimic. Aici pagina se taie în benzi late cât ecranul, pe care le dai înainte
// ca pe niște slide-uri. Pe A4 ies trei benzi de pagină, iar scrisul crește de
// vreo trei ori.
//
// CE IESE DE-AICI E TOT O FIȘĂ. Nu un vizualizator aparte, cu butoanele lui, ci
// o pagină HTML de sine stătătoare, cu aceleași `goTo`/`current`/`slides` și cu
// aceeași înțelegere `window.fisaLiceu` pe care o au fișele scrise de Marius.
// Așa primește pe gratis tot ce s-a construit pentru ele: telecomanda, ecoul
// apăsărilor, butonul de ecran plin, cardul cu ora. Dacă aș fi scris un
// vizualizator „al meu", ar fi trebuit să-i predau fiecare dintre astea încă o
// dată, și s-ar fi rupt pe rând.
//
// UNDE SE TAIE. Fâșiile se suprapun puțin, dinadins: tăiate cap la cap, un rând
// de text ar fi căzut fix pe cusătură și l-ai fi citit pe jumătate sus, pe
// jumătate jos. Cu suprapunere, rândul de la margine se vede întreg măcar
// într-una din ele.
//
// DESCĂRCAREA DĂ DOCUMENTUL PROPRIU-ZIS, în picioare, exact fișierul urcat.
// Tăierea e pentru ochi, pe tablă; pe hârtie mergi cu originalul.
// Cuprins în română, nume în engleză.
// =========================================================

/* Cât de înaltă e o fâșie față de lățimea ei. 9/16 = ecranul tablei. */
const RAPORT = 9 / 16;

/* Cât din înălțimea unei fâșii se reia în următoarea. O optime e destul cât să
   prindă un rând de text întreg și prea puțin cât să se simtă ca o repetare. */
const SUPRAPUNERE = 0.125;

/**
 * Unde începe fiecare fâșie pe o pagină, în fracțiuni din înălțimea ei.
 *
 * Se socotește pe raportul paginii, nu pe pixeli: o pagină e o pagină, fie că
 * o desenezi la 800 sau la 3000 de pixeli lățime.
 *
 * @param {number} raportPagina  înălțime / lățime (A4 în picioare ≈ 1.414)
 * @returns {number[]} începuturile, de la 0 la (1 - inaltimeaFasiei)
 */
export function inceputurileFasiilor(raportPagina) {
  const h = RAPORT / raportPagina;          // înălțimea unei fâșii, în fracțiuni de pagină
  if (!(h > 0) || h >= 1) return [0];       // pagina e deja mai lată decât o fâșie
  const pas = h * (1 - SUPRAPUNERE);
  /* Atâtea fâșii cât să se ajungă la talpă, plus prima. `ceil`, nu `floor`: cu
     `floor`, la o A4 ar fi ieșit două fâșii în loc de trei, iar ultima treime a
     paginii n-ar fi fost arătată niciodată – acolo unde stă concluzia. */
  const cate = Math.ceil((1 - h) / pas) + 1;
  const inceputuri = [];
  /* ULTIMA SE LIPEȘTE SINGURĂ DE TALPĂ, prin `min`: socoteala de mai sus o duce
     dincolo de `1 - h`, iar `min` o trage înapoi exact acolo. Am avut aici și un
     rând care o așeza anume la capăt; l-am scos, fiindcă nicio probă nu-l putea
     face să cadă – adică nu apăra nimic. */
  for (let i = 0; i < cate; i++) inceputuri.push(Math.min(i * pas, 1 - h));
  return inceputuri;
}

/** Înălțimea unei fâșii, în fracțiuni din înălțimea paginii. */
export const inaltimeaFasiei = (raportPagina) =>
  Math.min(1, RAPORT / raportPagina);

/**
 * Toate fâșiile unui document, în ordine.
 *
 * @param {{latime: number, inaltime: number}[]} pagini  măsurile fiecărei pagini
 * @returns {{pagina: number, sus: number, inalt: number}[]}
 *   `sus` și `inalt` sunt fracțiuni din înălțimea paginii ei.
 */
export function fasiile(pagini) {
  const tot = [];
  pagini.forEach((p, i) => {
    const raport = p.inaltime / p.latime;
    const inalt = inaltimeaFasiei(raport);
    inceputurileFasiilor(raport).forEach((sus) => {
      tot.push({ pagina: i, sus, inalt });
    });
  });
  return tot;
}

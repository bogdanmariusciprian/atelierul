// =========================================================
// ACELAȘI ZAR PE AMÂNDOUĂ ECRANELE.
//
// Telecomanda spune tablei „s-a apăsat al treilea cuvânt din rândul ăsta".
// Dacă fișa și-a amestecat cuvintele la întâmplare, al treilea de la tine nu e
// al treilea de la ea, iar tabla arată explicația altui cuvânt. Nu e o
// închipuire: „Fondul principal lexical" amestecă jetoanele la reluare și alege
// o întrebare la nimereală.
//
// CUM. Înainte de codul fișei i se strecoară un `Math.random` cu sămânță, iar
// sămânța se naște din numele fișei – același nume pe orice aparat, deci
// același șir de numere, deci aceeași așezare. Fișa nu se schimbă în găleată:
// se schimbă doar ce i se dă cadrului să citească.
//
// PREȚUL, spus pe față: lecția se amestecă la fel de fiecare dată când o
// deschizi. Înăuntrul orei rămâne variație (a doua reluare dă altă ordine decât
// prima, fiindcă zarul merge mai departe), dar mâine începe la fel ca azi. Am
// ales asta în locul unei semințe legate de ceas, care ar fi putut cădea altfel
// pe cele două aparate dacă erau pornite la distanță în timp – iar atunci n-ar
// fi mers nimic, și nici n-ai fi înțeles de ce.
//
// DE CE SE BAGĂ ÎN `<head>` și nu la sfârșit: trebuie să apuce să înlocuiască
// `Math.random` ÎNAINTE ca scriptul lecției să tragă primul zar. Scripturile
// lecțiilor stau la sfârșitul corpului, deci capul e devreme cu mult.
// Cuprins în română, nume în engleză.
// =========================================================

/** Hash FNV-1a: scurt, fără biblioteci, același număr pe orice aparat. */
export function samanta(text) {
  let s = 2166136261;
  for (let i = 0; i < String(text).length; i++) {
    s ^= String(text).charCodeAt(i);
    s = Math.imul(s, 16777619);
  }
  return s >>> 0;
}

/** Zarul însuși (mulberry32), scris o dată aici ca să poată fi probat, și
 *  trimis în fișă ca text. Mic, bun, și îndeajuns de amestecat pentru o lecție. */
export function zarCuSamanta(s) {
  let stare = s >>> 0;
  return function () {
    stare = stare + 0x6D2B79F5 | 0;
    let t = Math.imul(stare ^ stare >>> 15, 1 | stare);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Peticul de pus în fișă: același zar, scris ca text. */
export function peticulZarului(s) {
  return `<script>(function(){var s=${s >>> 0};Math.random=function(){`
    + `s=s+0x6D2B79F5|0;var t=Math.imul(s^s>>>15,1|s);`
    + `t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();</script>`;
}

/**
 * Fișa, cu zarul legat de numele ei.
 *
 * @param {string} html  fișa așa cum vine din găleată
 * @param {string} id    numele ei, același pe amândouă aparatele
 */
export function cuAcelasiZar(html, id) {
  const petec = peticulZarului(samanta(id));
  const capul = /<head[^>]*>/i.exec(html);
  if (!capul) return petec + html;                  // fișă fără `<head>`
  const la = capul.index + capul[0].length;
  return html.slice(0, la) + petec + html.slice(la);
}

// =========================================================
// TEXTUL TABLEI ALBE: formatare, liste, aliniere, încadrare pe lățime.
//
// Folosit de casetele de text și de celulele tabelelor (vezi
// `tabla-alba-plansa.js`). Cerut de Marius pe 17 noiembrie 2026: „o experiență
// cât mai apropiată de Word"; pe 24 noiembrie: mărimea, culoarea și markerul pe
// cuvinte, liste așezate ca în Word.
//
// MODELUL unui text (mic, ca să încapă pe canalul live):
//   s   literele; paragrafele despărțite de „\n"
//   r   bucățile formatate: [[câte litere, semne, { m, c, h }?], …]
//         semne: 1 bold, 2 italic, 4 subliniat
//         m  mărimea literei, dacă e alta decât a casetei
//         c  culoarea, dacă e alta decât a casetei
//         h  evidențierea (markerul), ca fundal al cuvintelor
//       (fără `r`, tot textul e simplu; al treilea loc lipsește la bucățile
//       fără nimic deosebit, iar codul vechi, care nu-l știe, îl sare)
//   p   paragrafele, unul pe rând de „\n": null ori
//       { l: "b" | "n" | "a" (bulină, număr, literă), f: formatul („•",
//         „1.", „(1)", „a)" …), n: nivelul (0–5), a: "l" | "c" | "r" | "j",
//         d: numărul de la care pornește lista aici (1 = de la capăt, chiar
//            dacă deasupra e alta la fel; 2 = continuă una de mai sus, peste
//            rânduri obișnuite),
//         i: 1 (alineat: doar primul rând intră înăuntru; nu la liste) }
// Lângă el, la element: m (mărimea obișnuită a casetei), lat (până unde merge
// rândul; fără ea, rândul merge cât e scris), ind (cât intră un nivel de listă).
//
// RÂNDUL ARE ÎNĂLȚIMEA CELEI MAI MARI LITERE DE PE EL, iar toate literele stau
// pe aceeași linie de bază, ca în Word.
//
// EDITORUL e un `contenteditable`: fiecare paragraf e un <div class="ta-p">
// cu `data-l`, `data-f`, `data-n`, `data-a`; marcajul (•, 1., a)) îl pune CSS
// din `data-m`. Bucățile cu altă mărime, culoare ori evidențiere stau în
// <span data-ms data-cl data-ev>. Litera de bază a editorului e CEA MAI MICĂ
// din text (`baza`): altfel, rândurile scrise mărunt ar rămâne înalte cât
// litera casetei.
// Cuprins în română, nume în engleză.
// =========================================================

export const BOLD = 1, ITALIC = 2, SUBLINIAT = 4;
export const LITERA = '"Segoe UI", system-ui, sans-serif';
export const RAND = 1.25;                 // înălțimea rândului, în mărimi de literă

/* Formatele listelor, ca în Word. */
export const LISTE = {
  b: ["•", "◦", "▪", "–", "➢", "✓"],
  n: ["1.", "1)", "(1)", "I.", "i."],
  a: ["a.", "a)", "(a)", "A."],
};
export const NIVEL_MAX = 5;
/* Semnul obișnuit al fiecărui nivel, ca în Word: la Tab, lista care îl poartă
   pe al nivelului ei trece pe al nivelului nou. */
const PE_NIVEL = [
  [["b", "•"], ["b", "◦"], ["b", "▪"]],
  [["n", "1."], ["a", "a)"], ["n", "i."]],
];

/* Mărimile din listă (ca în Word, plus câteva mari, de tablă). */
export const MARIMI = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48, 54, 60, 72, 96, 144];
export const MARIME_MIN = 6, MARIME_MAX = 400;
/* Culorile markerului. Se pun străvezii, ca să se citească și litera albă de
   pe tabla închisă, și cea neagră de pe pagina albă. */
export const EVIDENTIERI = [["#fde047", "Galben"], ["#86efac", "Verde"], ["#7dd3fc", "Albastru"],
  ["#f9a8d4", "Roz"], ["#fdba74", "Portocaliu"], ["#c4b5fd", "Mov"]];
const ALFA_EVIDENTIERE = 0.45;
const LOC_LIBER = 0.5;                    // între semnul listei și text, în mărimi de literă
const ZW = "​";                      // locul gol în care așteaptă formatul ales la cursor

const CULOARE = /^#[0-9a-f]{6}$/i;
const r1 = (n) => Math.round(n * 10) / 10;
const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const fontul = (f, m) => `${f & ITALIC ? "italic " : ""}${f & BOLD ? "700 " : ""}${m}px ${LITERA}`;
export const marimeBuna = (m) => Math.min(MARIME_MAX, Math.max(MARIME_MIN, r1(Number(m) || 0)));
/** Culoarea markerului, străvezie. */
export function cuAlfa(hex, a = ALFA_EVIDENTIERE) {
  const n = parseInt(String(hex).slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
/** „#rrggbb" dintr-o culoare scrisă de browser („rgb(…)", „rgba(…)", „#…"); null dacă nu e una ori e străvezie. */
export function hexDin(s) {
  const t = String(s || "").trim().toLowerCase();
  if (CULOARE.test(t)) return t;
  const x = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(t);
  if (!x) return null;
  if (x[4] !== undefined && parseFloat(x[4]) === 0) return null;
  return `#${[x[1], x[2], x[3]].map((v) => Math.min(255, Number(v)).toString(16).padStart(2, "0")).join("")}`;
}

/* ---------- modelul, verificat ---------- */

/** Ce are deosebit o bucată ({ m, c, h }), curățat; null dacă nimic. */
function atribute(a) {
  if (!a || typeof a !== "object") return null;
  const o = {};
  if (Number.isFinite(a.m) && a.m >= MARIME_MIN && a.m <= MARIME_MAX) o.m = r1(a.m);
  if (typeof a.c === "string" && CULOARE.test(a.c)) o.c = a.c.toLowerCase();
  if (typeof a.h === "string" && CULOARE.test(a.h)) o.h = a.h.toLowerCase();
  return Object.keys(o).length ? o : null;
}
const cheieAtr = (a) => (a ? `${a.m ?? ""}|${a.c ?? ""}|${a.h ?? ""}` : "");

/** Bucățile textului; dacă nu acoperă exact textul, e tot simplu. */
export function bucatile(t) {
  const s = String(t?.s || "");
  const ok = Array.isArray(t?.r) && t.r.every((x) => Array.isArray(x) && Number.isInteger(x[0]) && x[0] >= 0
    && Number.isInteger(x[1]) && x[1] >= 0 && x[1] <= 7) && t.r.reduce((a, x) => a + x[0], 0) === s.length;
  if (!ok) return [[s.length, 0]];
  return t.r.map((x) => { const a = atribute(x[2]); return a ? [x[0], x[1], a] : [x[0], x[1]]; });
}

/** Bucățile, lipite unde sunt la fel; `null` dacă tot textul e simplu. */
export function strange(r) {
  const o = [];
  for (const [n, f, a0] of r) {
    if (!n) continue;
    const a = atribute(a0);
    const u = o[o.length - 1];
    if (u && u[1] === f && cheieAtr(u[2]) === cheieAtr(a)) u[0] += n;
    else o.push(a ? [n, f, a] : [n, f]);
  }
  return o.length && o.some(([, f, a]) => f || a) ? o : null;
}

/** Un paragraf verificat ori null. */
function paragraful(x) {
  if (!x || typeof x !== "object") return null;
  const o = {};
  if (["b", "n", "a"].includes(x.l) && LISTE[x.l].includes(x.f)) { o.l = x.l; o.f = x.f; if (Number.isInteger(x.d) && x.d >= 1) o.d = Math.min(x.d, 9999); }
  if (Number.isInteger(x.n) && x.n > 0) o.n = Math.min(NIVEL_MAX, x.n);
  if (["c", "r", "j"].includes(x.a)) o.a = x.a;
  if (x.i === 1 && !o.l) o.i = 1;
  return Object.keys(o).length ? o : null;
}

/** Paragrafele textului: [{ bucati: [{ s, f, m?, c?, h? }], p }]. */
export function paragrafele(t) {
  const s = String(t?.s || "");
  const linii = [[]];
  let i = 0;
  for (const [n, f, a] of bucatile(t)) {
    s.slice(i, i + n).split("\n").forEach((b, k) => {
      if (k) linii.push([]);
      if (b) linii[linii.length - 1].push({ s: b, f, ...(a || {}) });
    });
    i += n;
  }
  const p = Array.isArray(t?.p) ? t.p : [];
  return linii.map((bucati, k) => ({ bucati, p: paragraful(p[k]) }));
}

/** Modelul { s, r?, p? } făcut la loc din paragrafe. */
export function dinParagrafe(ps) {
  let s = "";
  const r = [];
  ps.forEach(({ bucati }, k) => {
    if (k) { s += "\n"; r.push([1, 0]); }
    for (const b of bucati) {
      if (!b.s) continue;
      s += b.s;
      const a = atribute(b);
      r.push(a ? [b.s.length, b.f || 0, a] : [b.s.length, b.f || 0]);
    }
  });
  const o = { s };
  const rr = strange(r);
  if (rr) o.r = rr;
  const p = ps.map((x) => paragraful(x.p));
  if (p.some(Boolean)) o.p = p;
  return o;
}

/** `model` cu textul din `nou` ({ s, r?, p? }); restul câmpurilor rămân. */
export function cuTextul(model, nou) {
  const o = { ...model, s: nou.s };
  if (nou.r) o.r = nou.r; else delete o.r;
  if (nou.p) o.p = nou.p; else delete o.p;
  return o;
}

/* ---------- schimbări pe o bucată de text (pozițiile sunt cele din `s`) ---------- */

/** Aplică `fn(bucată) → bucată` pe literele dintre `a` și `b`. */
export function peInterval(model, a, b, fn) {
  if (!(b > a)) return model;
  let poz = 0;
  const noi = paragrafele(model).map(({ bucati, p }) => {
    const o = [];
    for (const bu of bucati) {
      const st = poz, sf = poz + bu.s.length;
      poz = sf;
      if (sf <= a || st >= b) { o.push(bu); continue; }
      const i0 = Math.max(a, st) - st, i1 = Math.min(b, sf) - st;
      if (i0 > 0) o.push({ ...bu, s: bu.s.slice(0, i0) });
      o.push({ ...fn({ ...bu, s: bu.s.slice(i0, i1) }), s: bu.s.slice(i0, i1) });
      if (i1 < bu.s.length) o.push({ ...bu, s: bu.s.slice(i1) });
    }
    poz += 1;
    return { bucati: o, p };
  });
  return cuTextul(model, dinParagrafe(noi));
}
/** Aplică `fn` pe tot textul. */
export const peTot = (model, fn) => peInterval(model, 0, String(model?.s || "").length, fn);

/**
 * Formatul literelor dintre `a` și `b`: { m, c, h, f }, cu `undefined` unde
 * sunt amestecate (m: mărimea; c, h: culoarea ori null; f: semnele pe care le
 * au TOATE). La cursor (a === b): formatul literei dinainte, ca în Word; la
 * început de paragraf, al celei de după; într-un paragraf gol, doar mărimea de
 * la sfârșitul celui de dinainte (atât ține și editorul pe un rând gol).
 */
export function formatulIn(model, a, b, m0) {
  const ps = paragrafele(model);
  const fmt = (bu) => ({ m: bu ? bu.m ?? m0 : m0, c: bu?.c || null, h: bu?.h || null, f: bu?.f || 0 });
  let poz = 0;
  if (b > a) {
    const alese = [];
    for (const { bucati } of ps) {
      for (const bu of bucati) {
        const st = poz, sf = poz + bu.s.length;
        poz = sf;
        if (sf > a && st < b) alese.push(fmt(bu));
      }
      poz += 1;
    }
    if (!alese.length) return fmt(null);
    const la = (k) => (alese.every((x) => x[k] === alese[0][k]) ? alese[0][k] : undefined);
    return { m: la("m"), c: la("c"), h: la("h"), f: alese.reduce((x, y) => x & y.f, 7) };
  }
  let mostenit = null;
  for (const { bucati } of ps) {
    const inceput = poz;
    let inainte = null, dupa = null;
    for (const bu of bucati) {
      const st = poz, sf = poz + bu.s.length;
      poz = sf;
      if (st < a && sf >= a) inainte = bu;
      if (st === a && !dupa) dupa = bu;
    }
    if (a >= inceput && a <= poz) return fmt(inainte || dupa || mostenit);
    if (bucati.length) mostenit = { m: bucati[bucati.length - 1].m };
    poz += 1;
  }
  return fmt(mostenit);
}

/** Următoarea mărime din listă, în sus (`cu` > 0) ori în jos. */
export function marimeaVecina(m, cu) {
  if (cu > 0) return MARIMI.find((x) => x > m + 0.05) ?? marimeBuna(Math.round(m * 1.1));
  const mici = MARIMI.filter((x) => x < m - 0.05);
  return mici.length ? mici[mici.length - 1] : marimeBuna(Math.round(m * 0.9));
}

/** Mărimea `fn(mărimea de acum)` pe literele dintre `a` și `b`; `m0` = mărimea casetei. */
export function cuMarime(model, a, b, m0, fn) {
  return peInterval(model, a, b, (bu) => {
    const m = marimeBuna(fn(bu.m ?? m0));
    const o = { ...bu };
    if (m === m0) delete o.m; else o.m = m;
    return o;
  });
}
/** Culoarea `c` pe literele dintre `a` și `b` (`null` ori culoarea casetei = cea a casetei). */
export function cuCuloare(model, a, b, c, c0 = null) {
  const k = c && CULOARE.test(c) && c.toLowerCase() !== String(c0 || "").toLowerCase() ? c.toLowerCase() : null;
  return peInterval(model, a, b, (bu) => { const o = { ...bu }; if (k) o.c = k; else delete o.c; return o; });
}
/** Evidențierea `h` pe literele dintre `a` și `b` (`null` = fără). */
export function cuEvidentiere(model, a, b, h) {
  const k = h && CULOARE.test(h) ? h.toLowerCase() : null;
  return peInterval(model, a, b, (bu) => { const o = { ...bu }; if (k) o.h = k; else delete o.h; return o; });
}

/** Mărimea pe care o au cele mai multe litere (cea a casetei, la egalitate). */
export function marimeaDeBaza(model, m0) {
  const cate = new Map();
  for (const { bucati } of paragrafele(model)) for (const b of bucati) { const m = b.m ?? m0; cate.set(m, (cate.get(m) || 0) + b.s.length); }
  let ales = m0, n = 0;
  for (const [m, k] of cate) if (k > n || (k === n && m === m0)) { ales = m; n = k; }
  return ales;
}
/** Același text, cu mărimile scrise față de altă mărime a casetei (`mNou`). */
export function cuBaza(model, m0, mNou) {
  if (mNou === m0) return model;
  const ps = paragrafele(model).map(({ bucati, p }) => ({ p, bucati: bucati.map((b) => {
    const m = b.m ?? m0;
    const o = { ...b };
    if (m === mNou) delete o.m; else o.m = m;
    return o;
  }) }));
  return cuTextul(model, dinParagrafe(ps));
}
/** Cea mai mică literă din text (a casetei, dacă e gol): litera de bază a editorului. */
export function marimeaMica(model, m0) {
  let mic = Infinity;
  for (const { bucati } of paragrafele(model)) for (const b of bucati) mic = Math.min(mic, b.m ?? m0);
  return Number.isFinite(mic) ? mic : m0;
}
/** Textul mărit de `s` ori (mânerul din colț): mărimile scrise pe bucăți cresc și ele. */
export function textMarit(model, s) {
  if (!Array.isArray(model?.r)) return model;
  const r = strange(bucatile(model).map(([n, f, a]) => (a?.m ? [n, f, { ...a, m: marimeBuna(a.m * s) }] : [n, f, a])));
  const o = { ...model };
  if (r) o.r = r; else delete o.r;
  return o;
}

/* ---------- marcajele listelor ---------- */
function roman(n) {
  const v = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let o = "";
  for (const [k, l] of v) while (n >= k) { o += l; n -= k; }
  return o;
}
function litera(n) {
  let o = "";
  while (n > 0) { n--; o = String.fromCharCode(97 + (n % 26)) + o; n = Math.floor(n / 26); }
  return o;
}
export function marcajul(l, f, k) {
  if (l === "b") return f;
  if (l === "n") return f === "I." ? `${roman(k)}.` : f === "i." ? `${roman(k).toLowerCase()}.` : f.replace("1", String(k));
  if (l === "a") { const x = litera(k); return f === "A." ? `${x.toUpperCase()}.` : f.replace("a", x); }
  return "";
}

/** Marcajul fiecărui paragraf („" dacă nu e în listă). Numerotarea merge mai
 *  departe pe același nivel și se ia de la capăt după un paragraf obișnuit, când
 *  se schimbă felul listei ori unde paragraful o cere (`d`); un nivel mai adânc
 *  începe de la 1. */
export function marcajele(ps) {
  const nr = numerele(ps);
  return ps.map((p, k) => (p?.l ? marcajul(p.l, p.f, nr[k]) : ""));
}
/** Al câtelea e fiecare paragraf în lista lui (0 dacă nu e în listă). */
export function numerele(ps) {
  const nr = [], fel = [];
  return ps.map((p) => {
    if (!p?.l) { nr.length = 0; fel.length = 0; return 0; }
    const n = p.n || 0;
    const cheie = `${p.l}|${p.f}`;
    if (fel[n] !== cheie) { nr[n] = 0; fel[n] = cheie; }
    if (p.d) nr[n] = p.d - 1;
    nr[n] = (nr[n] || 0) + 1;
    nr.length = n + 1; fel.length = n + 1;
    return nr[n];
  });
}

/**
 * Semnul unei liste mutate de pe nivelul `deLa` pe nivelul `la`, ca în Word:
 * • ◦ ▪, respectiv 1. a) i. Se schimbă doar dacă lista purta chiar semnul
 * obișnuit al nivelului ei; unul ales de mână rămâne cum e.
 */
export function semnulPeNivel(l, f, deLa, la) {
  for (const sir of PE_NIVEL) {
    const v = sir[deLa % sir.length];
    if (v[0] === l && v[1] === f) { const n = sir[la % sir.length]; return { l: n[0], f: n[1] }; }
  }
  return { l, f };
}

/**
 * Mută pe alt nivel paragrafele cu indicii `care` din `ps` (obiecte simple
 * { l, f, n, d }, schimbate pe loc). Lista mutată ia semnul celor aflate deja
 * pe nivelul nou în aceeași listă (așa, ieșind de pe un nivel, „a)" continuă cu
 * „b)", nu devine „1."); dacă nu e niciuna acolo, pe cel obișnuit al nivelului.
 */
export function mutaNivelul(ps, care, cu) {
  for (const k of care) {
    const p = ps[k];
    if (!p) continue;
    const n0 = p.n || 0;
    const n = Math.max(0, Math.min(NIVEL_MAX, n0 + cu));
    if (n === n0) continue;
    if (n) p.n = n; else delete p.n;
    delete p.d;
    if (!p.l) continue;
    let vecin = null;
    for (let j = k - 1; j >= 0; j--) {
      const v = ps[j];
      if (!v?.l) break;
      const nv = v.n || 0;
      if (nv < n) break;
      if (nv === n) { vecin = v; break; }
    }
    const s = vecin ? { l: vecin.l, f: vecin.f } : semnulPeNivel(p.l, p.f, n0, n);
    p.l = s.l; p.f = s.f;
  }
}

/* ---------- așezarea pe rânduri ---------- */

/* UNDE STĂ O LISTĂ (ca în Word): tot paragraful intră înăuntru. Semnul (•, 1.,
   a)) stă la jumătate de pas de marginea nivelului. Textul, cu tot cu rândurile
   lui următoare, începe după CEL MAI LAT semn din lista aceea și încă jumătate
   de literă: așa „10." ori „(a)" nu mai ajung peste text, iar textele listei
   stau unul sub altul. Un paragraf fără listă, doar cu nivel, intră cu câte un
   pas pe nivel. Pasul: `ind`, dacă e ales; altfel 1,4 mărimi de literă. */
export const locMarcaj = (n, pas) => (n + 0.5) * pas;

/**
 * Geometria paragrafelor. Pentru fiecare: { n, pm (mărimea lui: a primei
 * bucăți; la unul gol, cea de la sfârșitul celui dinainte), pas, lista, marc,
 * xm (unde stă semnul), slot (lățimea celui mai lat semn din listă), gol,
 * stanga (unde începe textul) }. `masoara(text, semne, mărime)` → lățimea.
 */
export function geometria(ps, { m, ind = null, masoara }) {
  const marc = marcajele(ps.map((x) => x.p));
  let mostenit = m;
  const g = ps.map(({ bucati, p }, k) => {
    const pm = bucati.length ? bucati[0].m ?? m : mostenit;
    if (bucati.length) mostenit = bucati[bucati.length - 1].m ?? m;
    const n = p?.n || 0;
    const pas = ind || pm * 1.4;
    const lista = !!p?.l;
    return { n, pm, pas, lista, marc: marc[k], wm: lista ? masoara(marc[k], 0, pm) : 0, xm: locMarcaj(n, pas), slot: 0, gol: 0, stanga: n * pas,
      /* Alineatul: doar primul rând intră, cu un pas (cel puțin o literă și jumătate). */
      alin: !lista && p?.i ? Math.max(pas, pm * 1.5) : 0 };
  });
  /* Listele, pe niveluri: paragrafele de același fel, unul după altul. */
  const deschise = [];
  const blocuri = [];
  ps.forEach(({ p }, k) => {
    if (!p?.l) { deschise.length = 0; return; }
    const n = g[k].n;
    deschise.length = n + 1;
    const cheie = `${p.l}|${p.f}`;
    if (!deschise[n] || deschise[n].cheie !== cheie) { deschise[n] = { cheie, idx: [] }; blocuri.push(deschise[n]); }
    deschise[n].idx.push(k);
  });
  for (const b of blocuri) {
    const slot = Math.max(...b.idx.map((k) => g[k].wm));
    /* Toată lista stă la fel: pasul și golul se iau după mărimea primului ei
       rând, ca semnele și textele să stea unele sub altele și când un rând
       are altă mărime. */
    const ref = g[b.idx[0]].pm;
    const pas = ind || ref * 1.4;
    for (const k of b.idx) {
      g[k].pas = pas;
      g[k].xm = locMarcaj(g[k].n, pas);
      g[k].slot = slot;
      g[k].gol = LOC_LIBER * ref;
      g[k].stanga = g[k].xm + slot + g[k].gol;
    }
  }
  return g;
}

/* Metricele literei, în mărimi de literă: `a` cât urcă deasupra liniei de bază,
   `d` cât coboară sub ea, `b` cât e de la linia de sus („top", de la care
   desenează pânza) până la linia de bază. Se măsoară o dată, din fontul
   adevărat; altfel, cele ale lui Segoe UI în Chrome.
   DE CE `b`: literele de mărimi diferite de pe același rând trebuie să stea pe
   ACEEAȘI linie de bază. Pânza desenează de la linia de sus, deci litera mai
   mică se coboară cu `b` × diferența de mărime. */
let URCARE = null;
export function metriceLitera(ctx) {
  if (URCARE) return URCARE;
  let a = 1.079, d = 0.251, b = 0.811;
  try {
    const vechi = ctx.font, baza = ctx.textBaseline;
    ctx.font = fontul(0, 100);
    ctx.textBaseline = "alphabetic";
    const jos = ctx.measureText("Hg");
    ctx.textBaseline = "top";
    const sus = ctx.measureText("Hg");
    if (jos.fontBoundingBoxAscent > 0 && jos.fontBoundingBoxDescent >= 0 && sus.fontBoundingBoxAscent >= 0) {
      a = jos.fontBoundingBoxAscent / 100;
      d = jos.fontBoundingBoxDescent / 100;
      b = (jos.fontBoundingBoxAscent - sus.fontBoundingBoxAscent) / 100;
    }
    ctx.font = vechi;
    ctx.textBaseline = baza;
  } catch { /* rămân cele ale lui Segoe UI */ }
  URCARE = { a, d, b };
  return URCARE;
}
/**
 * Cu cât stă mai sus textul desenat pe pânză decât același text scris în
 * editor (browserul pune rândul pe linia lui de bază, cu spațiul dintre rânduri
 * împărțit sus și jos; pânza îl desenează de la linia de sus). `M`: cea mai
 * mare literă de pe primul rând. Editorul se ridică cu atât, ca textul să nu
 * sară când deschizi ori închizi caseta.
 */
export function saltulEditorului(ctx, M) {
  const { a, d, b } = metriceLitera(ctx);
  return ((RAND + a - d) / 2 - b) * M;
}

/**
 * Așază textul: împarte paragrafele în rânduri (la `lat`, dacă e), pune
 * marcajele listelor și aliniază rândurile.
 * @returns {{ linii: Array, w: number, h: number }}
 *   linie: { y, h, k (paragraful), prim, M (cea mai mare literă de pe rând),
 *            marcaj?: { s, x, m, dy }, bucati: [{ s, f, m, c, x, dy }],
 *            sub: [[x, w, dy, grosime, culoare]], ev: [[x, w, dy, h, culoare]] }
 *   (`dy`: cât coboară linia de sus a bucății față de susul rândului, ca toate
 *   să stea pe aceeași linie de bază)
 */
export function aseaza(ctx, t, { m, lat = null, ind = null, aliniere = "l" }) {
  const masoara = (s, f, mm) => { ctx.font = fontul(f, mm); return ctx.measureText(s).width; };
  const { a: A, d: D, b: B } = metriceLitera(ctx);
  const ps = paragrafele(t);
  const geo = geometria(ps, { m, ind, masoara });
  const randuri = [];   // înainte de aliniere
  ps.forEach(({ bucati, p }, k) => {
    const g = geo[k];
    const locTot = lat ? Math.max(g.pm, lat - g.stanga) : Infinity;
    /* Cuvintele și spațiile, fiecare cu ale lui. */
    const bucs = [];
    for (const b of bucati) {
      const mm = b.m ?? m;
      for (const s of b.s.split(/(\s+)/)) if (s) bucs.push({ s, f: b.f, m: mm, c: b.c, h: b.h, w: masoara(s, b.f, mm), sp: /^\s+$/.test(s) });
    }
    /* CUVINTELE NU SE RUP LA GRANIȚA DINTRE DOUĂ BUCĂȚI. O literă colorată ori
       mărită în mijlocul unui cuvânt îl împarte în bucăți, dar el rămâne un
       singur cuvânt: bucățile lipite (fără spațiu între ele) merg împreună pe
       rând, ca în editor. */
    const grupuri = [];
    for (const b of bucs) {
      const u = grupuri[grupuri.length - 1];
      if (!b.sp && u && !u.sp) { u.bucs.push(b); u.w += b.w; }
      else grupuri.push({ sp: b.sp, bucs: [b], w: b.w });
    }
    const linii = [[]];
    let lung = 0;
    for (const gr of grupuri) {
      /* Primul rând al unui alineat e mai scurt cu cât intră. */
      let loc = linii.length === 1 ? Math.max(g.pm, locTot - g.alin) : locTot;
      const linia = linii[linii.length - 1];
      if (!gr.sp && lung + gr.w > loc && linia.some((x) => !x.sp)) {
        while (linia.length && linia[linia.length - 1].sp) lung -= linia.pop().w;
        linii.push([]); lung = 0; loc = locTot;
      }
      if (gr.sp && !linii[linii.length - 1].length && linii.length > 1) continue;   // spațiu la început de rând nou
      /* Un cuvânt mai lung decât rândul se rupe pe litere. */
      if (!gr.sp && gr.w > loc) {
        for (const b of gr.bucs) {
          let bucata = "";
          for (const ch of b.s) {
            const w = masoara(bucata + ch, b.f, b.m);
            if ((bucata || lung > 0) && lung + w > loc) {
              if (bucata) linii[linii.length - 1].push({ ...b, s: bucata, w: masoara(bucata, b.f, b.m) });
              linii.push([]); lung = 0; bucata = ch; loc = locTot;
            } else bucata += ch;
          }
          if (bucata) { const w = masoara(bucata, b.f, b.m); linii[linii.length - 1].push({ ...b, s: bucata, w }); lung += w; }
        }
        continue;
      }
      for (const b of gr.bucs) linii[linii.length - 1].push(b);
      lung += gr.w;
    }
    linii.forEach((l, i) => {
      while (l.length && l[l.length - 1].sp) l.pop();
      randuri.push({ bucs: l, w: l.reduce((x, y) => x + y.w, 0), g, p, k, prim: i === 0, ultim: i === linii.length - 1,
        M: l.length ? l.reduce((x, y) => Math.max(x, y.m), 0) : g.pm });
    });
  });
  const W = lat || Math.max(4, ...randuri.map((x) => x.g.stanga + (x.prim ? x.g.alin : 0) + x.w));
  let y = 0;
  const linii = randuri.map((rd) => {
    const a = rd.p?.a || aliniere;
    const { g, M } = rd;
    let x, marcaj = null;
    if (g.lista && rd.prim && (a === "c" || a === "r")) {
      /* La mijloc ori la dreapta, semnul merge cu primul rând, lipit de el. */
      const avans = g.slot + g.gol;
      const liber = Math.max(0, W - g.xm - avans - rd.w);
      const d = a === "c" ? liber / 2 : liber;
      marcaj = { s: g.marc, x: g.xm + d, m: g.pm, dy: B * (M - g.pm) };
      x = g.xm + d + avans;
    } else {
      const al = rd.prim ? g.alin : 0;
      const liber = Math.max(0, W - g.stanga - al - rd.w);
      x = g.stanga + al + (a === "c" ? liber / 2 : a === "r" ? liber : 0);
      if (g.lista && rd.prim) marcaj = { s: g.marc, x: g.xm, m: g.pm, dy: B * (M - g.pm) };
    }
    const liberJ = Math.max(0, W - g.stanga - (rd.prim ? g.alin : 0) - rd.w);
    const spatii = rd.bucs.filter((b) => b.sp).length;
    const intre = a === "j" && !rd.ultim && spatii && lat ? liberJ / spatii : 0;
    const bucati = [], sub = [], ev = [];
    for (const b of rd.bucs) {
      const w = b.w + (b.sp ? intre : 0);
      const dy = B * (M - b.m);
      if (!b.sp) bucati.push({ s: b.s, f: b.f, m: b.m, c: b.c || null, x, dy });
      /* Markerul ține cât litera cu tot cu urcușul și coborâșul ei, ca fundalul din editor. */
      if (b.h) ev.push([x, w, dy - (A - B) * b.m, (A + D) * b.m, b.h]);
      if (b.f & SUBLINIAT) sub.push([x, w, dy + b.m * 1.05, Math.max(1, b.m / 14), b.c || null]);
      x += w;
    }
    const linie = { y, h: M * RAND, k: rd.k, prim: rd.prim, M, marcaj, bucati, sub, ev };
    y += linie.h;
    return linie;
  });
  return { linii, w: W, h: y || m * RAND };
}

/** Deseneaza textul așezat, cu colțul de sus la (x, y). */
export function deseneazaText(ctx, as, x, y, m, culoare) {
  const cul = culoare || "#1f2430";
  ctx.save();
  ctx.textBaseline = "top";
  /* Markerul întâi, pe toate rândurile: stă sub litere, și sub cele ale rândului vecin. */
  for (const l of as.linii) for (const [ex, ew, dy, eh, ec] of l.ev) { ctx.fillStyle = cuAlfa(ec); ctx.fillRect(x + ex, y + l.y + dy, ew, eh); }
  for (const l of as.linii) {
    if (l.marcaj) { ctx.fillStyle = cul; ctx.font = fontul(0, l.marcaj.m); ctx.fillText(l.marcaj.s, x + l.marcaj.x, y + l.y + l.marcaj.dy); }
    for (const b of l.bucati) { ctx.fillStyle = b.c || cul; ctx.font = fontul(b.f, b.m); ctx.fillText(b.s, x + b.x, y + l.y + b.dy); }
    for (const [sx, w, dy, g, c] of l.sub) { ctx.fillStyle = c || cul; ctx.fillRect(x + sx, y + l.y + dy, w, g); }
  }
  ctx.restore();
}

/* ---------- editorul ---------- */

/* Învelișul unei bucăți cu altă mărime, culoare ori evidențiere. Mărimea se
   scrie înmulțită cu `--z` (mărirea planșei), ca la mărit și micșorat să se
   schimbe un singur număr, pe rădăcina editorului. */
function invelis(b, m, baza, asteapta = false) {
  const mm = b.m ?? m;
  const at = [], st = [];
  if (mm !== baza) { at.push(`data-ms="${mm}"`); st.push(`font-size:calc(${mm}px * var(--z, 1))`); }
  if (b.c) { at.push(`data-cl="${escH(b.c)}"`); st.push(`color:${escH(b.c)}`); }
  if (b.h) { at.push(`data-ev="${escH(b.h)}"`); st.push(`background-color:${cuAlfa(b.h)}`); }
  if (asteapta) at.push("data-asteapta");
  return at.length ? `<span ${at.join(" ")}${st.length ? ` style="${st.join(";")}"` : ""}>` : "";
}
const atributeParagraf = (p) => (p ? `${p.l ? ` data-l="${p.l}" data-f="${escH(p.f)}"${p.d ? ` data-d="${p.d}"` : ""}` : ""}${p.n ? ` data-n="${p.n}"` : ""}${p.a ? ` data-a="${p.a}"` : ""}${p.i ? ' data-i="1"' : ""}` : "");

/** HTML-ul editorului pentru niște paragrafe (o bucată cu `zw` e locul în care
 *  așteaptă formatul ales la cursor). */
function htmlDinParagrafe(ps, { m, baza }) {
  let mostenit = m;
  return ps.map(({ bucati, p }) => {
    let h = bucati.map((b) => {
      let x = b.zw ? ZW : escH(b.s);
      if (b.f & SUBLINIAT) x = `<u>${x}</u>`;
      if (b.f & ITALIC) x = `<i>${x}</i>`;
      if (b.f & BOLD) x = `<b>${x}</b>`;
      const sp = invelis(b, m, baza, !!b.zw);
      return sp ? `${sp}${x}</span>` : x;
    }).join("");
    const cuText = bucati.filter((b) => !b.zw);
    if (!bucati.length) {
      /* Un paragraf gol ține mărimea de la sfârșitul celui dinainte, ca în
         Word: acolo continui să scrii la fel, iar rândul gol e la fel de înalt. */
      const sp = mostenit !== baza ? invelis({ m: mostenit }, m, baza) : "";
      h = sp ? `${sp}<br></span>` : "<br>";
    } else if (cuText.length) mostenit = cuText[cuText.length - 1].m ?? m;
    return `<div class="ta-p"${atributeParagraf(p)}>${h}</div>`;
  }).join("");
}

/** HTML-ul editorului pentru un text: câte un <div class="ta-p"> pe paragraf.
 *  `m`: mărimea casetei; `baza`: litera de bază a editorului (cea mai mică din text). */
export function inEditor(t, { m = 28, baza = m } = {}) {
  return htmlDinParagrafe(paragrafele(t), { m, baza });
}

/**
 * HTML-ul editorului cu un loc gol la poziția `poz`, în care așteaptă formatul
 * `fmt` ({ f, m, c, h }): ce se tastează acolo îl ia, ca în Word când alegi
 * mărimea ori culoarea fără nimic selectat.
 */
export function inEditorCuAsteptare(t, poz, fmt, { m = 28, baza = m } = {}) {
  const ps = paragrafele(t);
  const gol = { s: "", zw: true, f: fmt.f || 0 };
  if (fmt.m && fmt.m !== m) gol.m = fmt.m;
  if (fmt.c) gol.c = fmt.c;
  if (fmt.h) gol.h = fmt.h;
  let i = 0, pus = false;
  const noi = ps.map(({ bucati, p }) => {
    const o = [];
    const sfarsit = i + bucati.reduce((x, b) => x + b.s.length, 0);
    if (!pus && poz <= sfarsit) {
      for (const b of bucati) {
        const st = i, sf = i + b.s.length;
        i = sf;
        if (!pus && poz >= st && poz <= sf) {
          if (poz > st) o.push({ ...b, s: b.s.slice(0, poz - st) });
          o.push(gol);
          if (poz < sf) o.push({ ...b, s: b.s.slice(poz - st) });
          pus = true;
        } else o.push(b);
      }
      if (!pus) { o.push(gol); pus = true; }
    } else { o.push(...bucati); }
    i = sfarsit + 1;
    return { bucati: o, p };
  });
  if (!pus) noi[noi.length - 1].bucati.push(gol);
  return htmlDinParagrafe(noi, { m, baza });
}

/** Orice bucată rătăcită direct în editor intră într-un paragraf. */
export function normalizeazaEditor(rad) {
  let curent = null;
  for (const c of [...rad.childNodes]) {
    if (c.nodeType === 1 && /^(DIV|P)$/.test(c.nodeName)) {
      if (!c.classList.contains("ta-p")) c.classList.add("ta-p");
      curent = null;
      continue;
    }
    if (c.nodeType === 3 && !c.data && !curent) { c.remove(); continue; }
    if (!curent) { curent = document.createElement("div"); curent.className = "ta-p"; c.before(curent); }
    curent.append(c);
  }
  if (!rad.firstChild) rad.innerHTML = `<div class="ta-p"><br></div>`;
}

const paragrafeleDom = (rad) => [...rad.children].filter((d) => d.classList?.contains("ta-p"));
const pDin = (d) => paragraful({
  l: d.dataset.l, f: d.dataset.f, n: Number(d.dataset.n) || 0, a: d.dataset.a, d: Number(d.dataset.d) || 0, i: d.dataset.i ? 1 : 0,
});
const curat = (s) => s.replace(/​/g, "").replace(/ /g, " ").replace(/\n/g, " ");
const lungime = (s) => s.replace(/​/g, "").length;

/* Ce aduce un element din editor peste formatul moștenit. Ale noastre se
   citesc din `data-*`; ce pune browserul singur (la lipit două paragrafe, de
   pildă), din stilul scris pe element, cu mărimea împărțită la mărirea planșei. */
function formatulDupa(c, st, z) {
  const o = { ...st };
  const s = c.style || {};
  const ds = c.dataset || {};
  if (/^(B|STRONG)$/.test(c.nodeName) || /^(bold|bolder|[6-9]00)$/.test(s.fontWeight || "")) o.f |= BOLD;
  else if (/^(normal|[1-4]00)$/.test(s.fontWeight || "")) o.f &= ~BOLD;
  if (/^(I|EM)$/.test(c.nodeName) || s.fontStyle === "italic") o.f |= ITALIC;
  else if (s.fontStyle === "normal") o.f &= ~ITALIC;
  if (c.nodeName === "U" || /underline/.test(`${s.textDecoration || ""} ${s.textDecorationLine || ""}`)) o.f |= SUBLINIAT;
  if (ds.ms && Number(ds.ms) > 0) o.m = marimeBuna(Number(ds.ms));
  else if (/^[\d.]+px$/.test(s.fontSize || "") && z > 0) o.m = marimeBuna(parseFloat(s.fontSize) / z);
  if (ds.cl && CULOARE.test(ds.cl)) o.c = ds.cl.toLowerCase();
  else { const k = hexDin(s.color || (c.nodeName === "FONT" ? c.getAttribute("color") : "")); if (k) o.c = k; }
  if (ds.ev && CULOARE.test(ds.ev)) o.h = ds.ev.toLowerCase();
  else if (s.backgroundColor) o.h = hexDin(s.backgroundColor);
  return o;
}

/** Paragrafele din editor, ca cele din `paragrafele()` (toate, și cele goale de la coadă). */
export function paragrafeleDinEditor(rad, { m = 28, baza = m, z = 1, c = null } = {}) {
  normalizeazaEditor(rad);
  const c0 = String(c || "").toLowerCase();
  return paragrafeleDom(rad).map((d) => {
    const bucati = [];
    const mergi = (n, st) => {
      for (const k of n.childNodes) {
        if (k.nodeType === 3) {
          const s = curat(k.data);
          if (!s) continue;
          const b = { s, f: st.f };
          if (st.m !== m) b.m = st.m;
          if (st.c && st.c !== c0) b.c = st.c;
          if (st.h) b.h = st.h;
          bucati.push(b);
          continue;
        }
        if (k.nodeType !== 1 || k.nodeName === "BR") continue;
        mergi(k, formatulDupa(k, st, z));
      }
    };
    mergi(d, { f: 0, m: baza, c: null, h: null });
    return { bucati, p: pDin(d) };
  });
}

/** Modelul { s, r, p } din paragrafele citite din editor. Paragrafele goale de
 *  la coadă nu rămân (afară de cele cu listă ori aliniere). */
export function modelDinParagrafe(ps) {
  let n = ps.length;
  while (n > 1 && !ps[n - 1].bucati.length && !ps[n - 1].p) n--;
  return dinParagrafe(ps.slice(0, n));
}
/** Textul din editor, ca model { s, r, p }. */
export const dinEditor = (rad, opt = {}) => modelDinParagrafe(paragrafeleDinEditor(rad, opt));

/**
 * Locul gol în care aștepta un format (vezi `inEditorCuAsteptare`): dacă s-a
 * scris în el, rămâne ca o bucată obișnuită, fără semnul nevăzut; dacă s-a
 * plecat de acolo fără să se scrie nimic, se scoate. Întoarce `true` cât încă
 * așteaptă unul.
 */
export function curataAsteptarea(rad) {
  const sel = getSelection();
  let asteapta = false;
  for (const sp of [...rad.querySelectorAll("[data-asteapta]")]) {
    const plin = lungime(sp.textContent) > 0;
    if (!plin) {
      if (sel.rangeCount && sp.contains(sel.anchorNode)) { asteapta = true; continue; }
      const d = sp.parentNode;
      sp.remove();
      if (d && d.classList?.contains("ta-p") && !d.firstChild) d.innerHTML = "<br>";
      continue;
    }
    delete sp.dataset.asteapta;
    const w = document.createTreeWalker(sp, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const t = w.currentNode;
      if (!t.data.includes(ZW)) continue;
      const aici = sel.rangeCount && sel.isCollapsed && sel.anchorNode === t ? sel.anchorOffset : -1;
      const inainte = aici >= 0 ? lungime(t.data.slice(0, aici)) : -1;
      t.data = t.data.replace(/​/g, "");
      if (inainte >= 0) { try { sel.collapse(t, Math.min(inainte, t.data.length)); } catch { /* nimic */ } }
    }
    /* Un înveliș rămas fără nimic deosebit nu mai are rost. */
    if (sp.nodeName === "SPAN" && !("ms" in sp.dataset) && !("cl" in sp.dataset) && !("ev" in sp.dataset)) sp.dataset.cl = "";
  }
  return asteapta;
}

/** Are editorul ceva pus de browser, nu de noi (un stil scris pe un element
 *  fără `data-*`, un <font>)? Atunci se scrie din nou, curat, din model. */
export function areStrain(rad) {
  for (const e of rad.querySelectorAll("span, font, [style]")) {
    if (e.classList?.contains("ta-p")) continue;
    if (e.nodeName === "FONT") return true;
    if (e.nodeName === "SPAN" && !("ms" in e.dataset) && !("cl" in e.dataset) && !("ev" in e.dataset) && !("asteapta" in e.dataset)) return true;
    if (e.nodeName !== "SPAN" && e.getAttribute("style")) return true;
  }
  return false;
}

/* ---------- selecția, în poziții din `s` ---------- */

/** Poziția (în litere, ca în `s`) a unui loc din editor. */
export function pozitiaIn(rad, nod, off) {
  const pars = paragrafeleDom(rad);
  let poz = 0;
  for (let k = 0; k < pars.length; k++) {
    const d = pars[k];
    if (nod === rad && off <= k) return poz;
    if (d === nod || d.contains(nod)) {
      const r = document.createRange();
      r.setStart(d, 0);
      r.setEnd(nod, off);
      return poz + lungime(r.toString());
    }
    poz += lungime(d.textContent) + 1;
  }
  return Math.max(0, poz - 1);
}
/** Selecția din editor: { a, b, intors } (a ≤ b), ori null dacă nu e în el. */
export function selectiaIn(rad) {
  const sel = getSelection();
  if (!sel.rangeCount || !sel.anchorNode || !rad.contains(sel.anchorNode) || !rad.contains(sel.focusNode)) return null;
  const x = pozitiaIn(rad, sel.anchorNode, sel.anchorOffset), y = pozitiaIn(rad, sel.focusNode, sel.focusOffset);
  return { a: Math.min(x, y), b: Math.max(x, y), intors: y < x };
}
/* Locul din editor al poziției `poz`: [nod, deplasare]. La granița dintre două
   bucăți rămâne la sfârșitul celei dinainte: ce tastezi acolo ia formatul ei. */
function loculLa(rad, poz) {
  const pars = paragrafeleDom(rad);
  let rest = Math.max(0, poz);
  for (let k = 0; k < pars.length; k++) {
    const d = pars[k];
    const n = lungime(d.textContent);
    if (rest <= n || k === pars.length - 1) {
      rest = Math.min(rest, n);
      const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
      let ultim = null;
      while (w.nextNode()) {
        const t = w.currentNode;
        const l = lungime(t.data);
        if (rest <= l && (l || !ultim)) {
          let i = 0, cnt = 0;
          while (cnt < rest && i < t.data.length) { if (t.data[i] !== ZW) cnt++; i++; }
          return [t, i];
        }
        rest -= l;
        ultim = t;
      }
      if (ultim) return [ultim, ultim.data.length];
      let e = d;
      while (e.firstChild && e.firstChild.nodeType === 1 && e.firstChild.nodeName !== "BR") e = e.firstChild;
      return [e, 0];
    }
    rest -= n + 1;
  }
  return [rad, 0];
}
/** Pune selecția din poziții. */
export function puneSelectia(rad, a, b = a, intors = false) {
  const sel = getSelection();
  const [n1, o1] = loculLa(rad, intors ? b : a);
  const [n2, o2] = b === a ? [n1, o1] : loculLa(rad, intors ? a : b);
  try { sel.setBaseAndExtent(n1, o1, n2, o2); } catch { /* editor scos între timp */ }
}
/** Pune cursorul în locul gol în care așteaptă formatul (vezi `inEditorCuAsteptare`). */
export function cursorInAsteptare(rad) {
  const w = document.createTreeWalker(rad, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const i = w.currentNode.data.indexOf(ZW);
    if (i >= 0) { try { getSelection().collapse(w.currentNode, i + 1); } catch { /* nimic */ } return true; }
  }
  return false;
}

/* ---------- paragrafele editorului ---------- */

/**
 * Pune pe paragrafele editorului marcajele, intrările și alinierea, cu aceeași
 * geometrie ca pe tablă. Lungimile se scriu înmulțite cu `--z` (mărirea
 * planșei, pusă pe rădăcina editorului), deci la mărit și micșorat se așază
 * singure. `ps`: paragrafele citite din editor; `as`: așezarea lor (dacă e),
 * ca semnul să stea pe linia primului rând.
 */
export function refaParagrafele(rad, { ctx, ps = null, as = null, m, baza = m, ind = null, z = 1, aliniere = "l", c = null }) {
  normalizeazaEditor(rad);
  const pars = paragrafeleDom(rad);
  const toate = ps || paragrafeleDinEditor(rad, { m, baza, z, c });
  const masoara = (s, f, mm) => { ctx.font = fontul(f, mm); return ctx.measureText(s).width; };
  const geo = geometria(toate, { m, ind, masoara });
  const primul = new Map();
  if (as) for (const l of as.linii) if (l.prim) primul.set(l.k, l.M);
  const cuZ = (v) => `calc(${r1(v)}px * var(--z, 1))`;
  pars.forEach((d, k) => {
    const g = geo[k];
    if (!g) return;
    const a = toate[k].p?.a || aliniere;
    const lipit = g.lista && (a === "c" || a === "r");
    d.style.paddingLeft = cuZ(lipit ? g.xm : g.stanga);
    d.style.setProperty("--mx", cuZ(g.xm));
    d.style.setProperty("--ms", cuZ(g.pm));
    d.style.setProperty("--mw", cuZ(g.slot + g.gol));
    d.style.setProperty("--my", cuZ(Math.max(0, (primul.get(k) ?? g.pm) - g.pm) * 1.04));
    d.style.textAlign = { c: "center", r: "right", j: "justify" }[a] || "left";
    d.style.textIndent = g.alin ? cuZ(g.alin) : "";
    if (g.lista && g.marc) d.dataset.m = g.marc; else delete d.dataset.m;
    if (lipit) d.dataset.am = a; else delete d.dataset.am;
  });
}

/** Paragrafele în care stă selecția (ori cursorul). */
export function paragrafeleSelectate(rad) {
  const sel = getSelection();
  const pars = paragrafeleDom(rad);
  if (!sel.rangeCount || !rad.contains(sel.anchorNode)) return pars.slice(-1);
  const r = sel.getRangeAt(0);
  const alese = pars.filter((d) => r.intersectsNode(d));
  return alese.length ? alese : pars.slice(-1);
}

/** Lista pe paragrafele alese: pusă, ori scoasă dacă era deja exact aceea. */
export function puneLista(pars, l, f) {
  const toate = pars.every((d) => d.dataset.l === l && d.dataset.f === f);
  for (const d of pars) {
    if (toate || !l) { delete d.dataset.l; delete d.dataset.f; delete d.dataset.d; }
    else { d.dataset.l = l; d.dataset.f = f; }
  }
}
/** Nivelul paragrafelor alese; lista își ia semnul nivelului nou (ca în Word). */
export function schimbaNivelul(pars, cu) {
  const rad = pars[0]?.parentNode;
  if (!rad) return;
  const toate = paragrafeleDom(rad);
  const ps = toate.map((d) => {
    const o = {};
    if (d.dataset.l) { o.l = d.dataset.l; o.f = d.dataset.f; }
    if (Number(d.dataset.n) > 0) o.n = Number(d.dataset.n);
    if (d.dataset.d) o.d = Number(d.dataset.d) || 1;
    return o;
  });
  const care = pars.map((d) => toate.indexOf(d)).filter((k) => k >= 0).sort((x, y) => x - y);
  mutaNivelul(ps, care, cu);
  for (const k of care) {
    const d = toate[k], p = ps[k];
    if (p.n) d.dataset.n = String(p.n); else delete d.dataset.n;
    if (p.l) { d.dataset.l = p.l; d.dataset.f = p.f; }
    if (p.d) d.dataset.d = String(p.d); else delete d.dataset.d;
  }
}
export function aliniaza(pars, a) {
  for (const d of pars) { if (a && a !== "l") d.dataset.a = a; else delete d.dataset.a; }
}

/** Paragraful în care e cursorul și cât text e înaintea lui în paragraf. */
export function undeECursorul(rad) {
  const sel = getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return null;
  let d = sel.anchorNode;
  while (d && d.parentNode !== rad) d = d.parentNode;
  if (!d || d.nodeType !== 1) return null;
  const r = document.createRange();
  r.setStart(d, 0);
  r.setEnd(sel.anchorNode, sel.anchorOffset);
  return { d, inainte: r.toString().replace(/​/g, "") };
}

/** Scoate primele `k` litere din paragraf (după autoformatare). */
export function taieInceputul(d, k) {
  const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
  let rest = k, ultim = null;
  while (rest > 0 && w.nextNode()) {
    const t = w.currentNode;
    let i = 0, cnt = 0;
    while (cnt < rest && i < t.data.length) { if (t.data[i] !== ZW) cnt++; i++; }
    t.data = t.data.slice(i);
    rest -= cnt;
    ultim = t;
  }
  let loc = [d, 0];
  if (!lungime(d.textContent)) {
    /* Rândul a rămas gol. Învelișul în care era scris (mărimea, culoarea lui)
       rămâne, cu cursorul în el: ce tastezi mai departe e la fel ca ce ai tăiat. */
    const inv = ultim && ultim.parentNode !== d && d.contains(ultim.parentNode) ? ultim.parentNode : null;
    if (inv) {
      let sus = inv;
      while (sus.parentNode !== d) sus = sus.parentNode;
      inv.innerHTML = "<br>";
      delete inv.dataset.asteapta;
      for (const c of [...d.childNodes]) if (c !== sus) c.remove();
      loc = [inv, 0];
    } else d.innerHTML = "<br>";
  } else {
    /* A mai rămas text: cursorul la începutul lui, în bucata lui. */
    const prim = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
    while (prim.nextNode()) if (lungime(prim.currentNode.data)) { loc = [prim.currentNode, 0]; break; }
  }
  try { getSelection().collapse(loc[0], loc[1]); } catch { /* nimic */ }
}

/**
 * Ce listă cere începutul tastat al unui paragraf. DOAR PRIMUL DIN ȘIR pornește
 * o listă: „1. ", „1) ", „(1) ", „a) ", „a. ", „(a) ", „- ", „* ". Un „b) ", un
 * „5. " ori o inițială („M. Eminescu", „I. Creangă") rămân text (hotărât cu
 * Marius pe 24 noiembrie 2026: înainte, orice literă ori număr pornea o listă,
 * și încă una numărată greșit, de la început).
 */
export function autoLista(inainte) {
  if (/^[-*•]\s$/.test(inainte)) return { l: "b", f: inainte[0] === "-" ? "–" : "•", k: 1 };
  let x;
  if ((x = /^(\d{1,3})([.)])\s$/.exec(inainte))) return { l: "n", f: `1${x[2]}`, k: Number(x[1]) };
  if ((x = /^\((\d{1,3})\)\s$/.exec(inainte))) return { l: "n", f: "(1)", k: Number(x[1]) };
  if ((x = /^([a-z])([.)])\s$/.exec(inainte))) return { l: "a", f: `a${x[2]}`, k: x[1].charCodeAt(0) - 96 };
  if ((x = /^\(([a-z])\)\s$/.exec(inainte))) return { l: "a", f: "(a)", k: x[1].charCodeAt(0) - 96 };
  return null;
}

/**
 * Face listă din paragraful `d`, dacă ce s-a tastat (`a`, din `autoLista`) e
 * primul din șir („1.", „a)", „-") ori chiar următorul după o listă la fel de
 * mai sus din casetă („2." după un „1.", și peste rânduri obișnuite). Altfel
 * („5." din senin, „b)" fără „a)") rămâne text. Întoarce dacă a făcut-o.
 */
export function listaDinTaste(d, a) {
  const rad = d.parentNode;
  const toate = paragrafeleDom(rad);
  const k = toate.indexOf(d);
  if (k < 0) return false;
  const n = Number(d.dataset.n) || 0;
  if (a.l !== "b" && a.k !== 1) {
    const ps = toate.map(pDin);
    const nr = numerele(ps);
    let asteptat = 0;
    for (let j = k - 1; j >= 0; j--) {
      const p = ps[j];
      if (p?.l === a.l && p.f === a.f && (p.n || 0) === n) { asteptat = nr[j] + 1; break; }
    }
    if (a.k !== asteptat) return false;
  }
  delete d.dataset.i;
  delete d.dataset.d;
  d.dataset.l = a.l; d.dataset.f = a.f;
  /* Numărul tastat se ține doar dacă lista n-ar ajunge singură la el. */
  if (a.l !== "b" && numerele(toate.map(pDin))[k] !== a.k) d.dataset.d = String(a.k);
  return true;
}

// =========================================================
// PLANȘA TABLEI ALBE (0113): desenul pe o pânză (canvas) fără margini.
//
// Lumea are coordonatele ei; ecranul vede din ea o bucată, după `vedere`
// ({x, y, z}: colțul de sus din stânga și mărirea). Planșa se trage cu mâna,
// cu spațiul ținut apăsat, cu rotița din mijloc ori cu două degete, și se
// mărește cu Ctrl + rotița, cu două degete ori cu butoanele.
//
// ELEMENTELE (ce rămâne desenat), mici, ca să încapă pe canalul live:
//   { id, t: "p", c, g, o?, pts: [x, y, x, y, …] }      creion (o = marker)
//   { id, t: "l" | "a" | "r" | "e", c, g, x1, y1, x2, y2 } linie, săgeată, dreptunghi, elipsă
//   { id, t: "x", c, m, x, y, s, r?, p?, lat?, ind?, w, h }  text (vezi `tabla-alba-text.js`);
//        c și m sunt culoarea și mărimea casetei; cuvintele pot avea altele, în `r`
//   { id, t: "i", x, y, w, h, src }                     imagine lipită
//   { id, t: "t", x, y, m, c, col: [lățimi], rh: [înălțimi minime],
//     cel: [[celulă]], ch: { f, c, g }, w, h }          tabel
//        celulă: { s, r?, p?, ah?, av?, bg?, cs?, rs?, x? } (text ca mai sus;
//        ah aliniere pe orizontală l/c/r/j, av pe verticală s/m/j (implicit m),
//        bg fundal, cs/rs îmbinare pe coloane/rânduri, x = acoperită de alta)
//        ch.f: chenarele: toate | exterior | interior | orizontale | fara
//
// OPERAȚIILE schimbă desenul și se pot da înapoi; tot ele pleacă pe canal:
//   { fel: "pune", el: [...], la?: [index, …] }   { fel: "scoate", id: [...] }
//   { fel: "schimba", el: [...] }                 { fel: "fundal", f }   (liniile: pătrățele…)
//   { fel: "culoare", c }                         culoarea paginii
//   { fel: "ordine", id: [toate, în ordine] }     în față / în spate
// Fiecare operație aplicată întoarce opusa ei: așa se face Undo.
//
// GRILA DIN SPATE (cerută pe 17 noiembrie 2026): textele, formele, tabelele și
// mutările se prind de o grilă nevăzută, cu pasul `PAS` (mic, ca să nu se
// simtă); creionul nu. Un text pus chiar sub altul se aliniază la stânga lui.
// Cuprins în română, nume în engleză.
// =========================================================
import {
  BOLD, ITALIC, SUBLINIAT, LITERA, RAND, LISTE, MARIMI, EVIDENTIERI, bucatile, strange, paragrafele, aseaza, deseneazaText,
  inEditor, inEditorCuAsteptare, dinEditor, dinParagrafe, paragrafeleDinEditor, modelDinParagrafe, refaParagrafele, paragrafeleSelectate,
  puneLista, schimbaNivelul, aliniaza, undeECursorul, taieInceputul, autoLista, listaDinTaste, mutaNivelul,
  marimeaMica, marimeaDeBaza, marimeaVecina, marimeBuna, cuBaza, cuMarime, cuCuloare, cuEvidentiere, textMarit, formatulIn,
  selectiaIn, puneSelectia, cursorInAsteptare, curataAsteptarea, areStrain, saltulEditorului,
} from "./tabla-alba-text.js";

export { BOLD, ITALIC, SUBLINIAT, LISTE, MARIMI, EVIDENTIERI, marimeaVecina };

const r1 = (n) => Math.round(n * 10) / 10;
export const idNou = () => Math.random().toString(36).slice(2, 10);
const copie = (o) => JSON.parse(JSON.stringify(o));

export const FUNDALURI = ["alb", "patratele", "dictando", "puncte"];
export const CHENARE = ["toate", "exterior", "interior", "orizontale", "fara"];
const CULOARE_BUNA = /^#[0-9a-f]{6}$/i;
/** E închisă culoarea? Atunci liniile se trag deschise, ca să se vadă. */
export const inchisa = (c) => {
  const n = parseInt(String(c).slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 140;
};
const PAS_GRILA = 28;     // liniile de fundal (pătrățele, dictando), cele care se văd
export const PAS = 6;     // grila din spate, care nu se vede
const prinde = (v) => Math.round(v / PAS) * PAS;

/* ---------- tabelele: forma lor ---------- */
const padTabel = (e) => e.m * 0.35;
const randMinim = (e) => e.m * RAND + 2 * padTabel(e);
/** Un tabel nou, gol, cu `nr` rânduri și `nc` coloane. */
export function tabelNou(nr, nc, { x, y, m, c }) {
  return {
    id: idNou(), t: "t", x: r1(x), y: r1(y), m, c,
    col: Array(nc).fill(r1(m * 6)), rh: Array(nr).fill(r1(m * RAND + m * 0.7)),
    cel: Array.from({ length: nr }, () => Array.from({ length: nc }, () => ({ s: "" }))),
    ch: { f: "toate", c: c || "#1f2430", g: 1.5 },
  };
}
const celOk = (e, i, j) => e.cel?.[i]?.[j] && !e.cel[i][j].x;

/** Cutia unui element, în coordonatele lumii. */
export function cutia(e) {
  if (e.t === "p") {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < e.pts.length; i += 2) {
      x0 = Math.min(x0, e.pts[i]); x1 = Math.max(x1, e.pts[i]);
      y0 = Math.min(y0, e.pts[i + 1]); y1 = Math.max(y1, e.pts[i + 1]);
    }
    const g = (e.g || 2) / 2;
    return { x: x0 - g, y: y0 - g, w: x1 - x0 + 2 * g, h: y1 - y0 + 2 * g };
  }
  if (e.t === "x" || e.t === "i" || e.t === "t") return { x: e.x, y: e.y, w: e.w || 0, h: e.h || 0 };
  const g = (e.g || 2) / 2;
  const x = Math.min(e.x1, e.x2), y = Math.min(e.y1, e.y2);
  return { x: x - g, y: y - g, w: Math.abs(e.x2 - e.x1) + 2 * g, h: Math.abs(e.y2 - e.y1) + 2 * g };
}

const uneste = (a, b) => {
  if (!a) return b;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

function distSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Atinge punctul (px, py) elementul? `inauntru`: și golul unei forme. */
function atinge(e, px, py, tol, inauntru = false) {
  const b = cutia(e);
  if (px < b.x - tol || px > b.x + b.w + tol || py < b.y - tol || py > b.y + b.h + tol) return false;
  if (e.t === "x" || e.t === "i" || e.t === "t") return true;
  const g = (e.g || 2) / 2 + tol;
  if (e.t === "p") {
    if (e.pts.length === 2) return Math.hypot(px - e.pts[0], py - e.pts[1]) <= g;
    for (let i = 0; i + 3 < e.pts.length; i += 2) {
      if (distSegment(px, py, e.pts[i], e.pts[i + 1], e.pts[i + 2], e.pts[i + 3]) <= g) return true;
    }
    return false;
  }
  if (e.t === "l" || e.t === "a") return distSegment(px, py, e.x1, e.y1, e.x2, e.y2) <= g;
  if (e.t === "r") {
    if (inauntru) return true;
    const x0 = Math.min(e.x1, e.x2), x1 = Math.max(e.x1, e.x2), y0 = Math.min(e.y1, e.y2), y1 = Math.max(e.y1, e.y2);
    return distSegment(px, py, x0, y0, x1, y0) <= g || distSegment(px, py, x1, y0, x1, y1) <= g
      || distSegment(px, py, x1, y1, x0, y1) <= g || distSegment(px, py, x0, y1, x0, y0) <= g;
  }
  if (e.t === "e") {
    const cx = (e.x1 + e.x2) / 2, cy = (e.y1 + e.y2) / 2;
    const rx = Math.max(1, Math.abs(e.x2 - e.x1) / 2), ry = Math.max(1, Math.abs(e.y2 - e.y1) / 2);
    const v = Math.sqrt(((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2);
    return inauntru ? v <= 1 + g / Math.min(rx, ry) : Math.abs(v - 1) * Math.min(rx, ry) <= g;
  }
  return false;
}

/** Elementul mutat cu (dx, dy). */
function mutat(e, dx, dy) {
  const n = copie(e);
  if (n.t === "p") for (let i = 0; i < n.pts.length; i += 2) { n.pts[i] = r1(n.pts[i] + dx); n.pts[i + 1] = r1(n.pts[i + 1] + dy); }
  else if (n.t === "x" || n.t === "i" || n.t === "t") { n.x = r1(n.x + dx); n.y = r1(n.y + dy); }
  else { n.x1 = r1(n.x1 + dx); n.x2 = r1(n.x2 + dx); n.y1 = r1(n.y1 + dy); n.y2 = r1(n.y2 + dy); }
  return n;
}

/** Elementul mărit de `s` ori, față de punctul (ox, oy). */
function marit(e, ox, oy, s) {
  const n = copie(e);
  const X = (x) => r1(ox + (x - ox) * s), Y = (y) => r1(oy + (y - oy) * s);
  if (n.t === "p") { for (let i = 0; i < n.pts.length; i += 2) { n.pts[i] = X(n.pts[i]); n.pts[i + 1] = Y(n.pts[i + 1]); } n.g = r1(Math.max(0.5, n.g * s)); }
  else if (n.t === "x") {
    n.x = X(n.x); n.y = Y(n.y); n.m = r1(Math.max(6, n.m * s)); n.w = r1(n.w * s); n.h = r1(n.h * s);
    if (n.lat) n.lat = r1(n.lat * s);
    if (n.ind) n.ind = r1(n.ind * s);
    Object.assign(n, textMarit(n, s));   // și mărimile scrise pe cuvinte
  } else if (n.t === "i") { n.x = X(n.x); n.y = Y(n.y); n.w = r1(n.w * s); n.h = r1(n.h * s); }
  else if (n.t === "t") {
    n.x = X(n.x); n.y = Y(n.y); n.m = r1(Math.max(6, n.m * s));
    n.col = n.col.map((w) => r1(w * s)); n.rh = n.rh.map((h) => r1(h * s));
    n.cel = n.cel.map((rand) => rand.map((c) => (c && !c.x ? textMarit(c, s) : c)));
    n.ch = { ...n.ch, g: r1(Math.max(0.5, (n.ch?.g || 1.5) * s)) };
  } else { n.x1 = X(n.x1); n.x2 = X(n.x2); n.y1 = Y(n.y1); n.y2 = Y(n.y2); n.g = r1(Math.max(0.5, n.g * s)); }
  return n;
}

/* Paragrafele unui model de text, schimbate de `fn(p, k)` (p: obiect ori null). */
function cuParagrafe(model, fn) {
  const ps = paragrafele(model).map((x) => (x.p ? { ...x.p } : {}));
  ps.forEach((p, k) => fn(p, k));
  const curat = ps.map((p) => (Object.keys(p).length ? p : null));
  const o = { ...model };
  if (curat.some(Boolean)) o.p = curat; else delete o.p;
  return o;
}

export class Plansa {
  /**
   * @param {HTMLElement} gazda  locul planșei (se umple cu pânza)
   * @param {object} o
   * @param {boolean} o.poateScrie
   * @param {(op) => void} [o.laOperatie]       o operație făcută aici (de trimis, de salvat)
   * @param {(el|null) => void} [o.laTrasare]   desenul în curs (de trimis live)
   * @param {(cauza?: string) => void} [o.laVedere]  s-a mișcat ori s-a mărit planșa; `"marime"` = doar
   *                                            fiindcă planșa și-a schimbat mărimea pe ecran, nu a mișcat-o nimeni
   * @param {() => void} [o.laManaMea]          omul a mișcat singur planșa
   * @param {() => void} [o.laMarime]           planșa și-a schimbat mărimea pe ecran
   * @param {() => void} [o.laSchimbare]        s-a schimbat ceva de arătat pe bară (undo, selecție)
   * @param {() => void} [o.laFormat]           s-a mutat selecția din casetă: bara arată formatul de acolo
   */
  constructor(gazda, o = {}) {
    this.o = o;
    this.gazda = gazda;
    this.panza = document.createElement("canvas");
    this.panza.className = "ta-panza";
    gazda.append(this.panza);
    this.ctx = this.panza.getContext("2d");
    this.el = [];
    this.fundal = "alb";
    this.culoareFundal = "#ffffff";
    this.vedere = { x: 0, y: 0, z: 1 };
    this.unealta = o.unealta || "creion";
    this.culoare = "#1f2430";
    this.grosime = 3;
    this.marimeText = 28;
    this.indent = null;        // cât intră un nivel de listă la textele noi (null = după literă)
    this.inapoi = [];
    this.inainte = [];
    this.selectate = new Set();
    this.celule = null;        // celulele alese într-un tabel: { id, i0, j0, i1, j1 }
    this.temp = null;          // desenul meu în curs
    this.strain = null;        // desenul în curs al profesorului (la cine privește)
    this.laser = null;
    this.ascunse = new Set();  // radiera în curs: elementele încă neșterse de-a binelea
    this.imagini = new Map();
    this.asezari = new WeakMap();
    this.degete = new Map();
    this.spatiu = false;
    this.cerut = false;
    this.text = null;          // editorul deschis (text ori celulă de tabel)

    /* Selecția din caseta deschisă se ține minte, în poziții: cât ai mâna pe
       bara de unelte (pe caseta cu mărimea, de pildă), browserul o pierde. */
    document.addEventListener("selectionchange", () => {
      const t = this.text;
      if (!t || t.compun) return;
      const sel = selectiaIn(t.ta);
      if (!sel) return;
      t.sel = sel;
      if (t.ist.cur) t.ist.cur.sel = sel;
      /* Formatul care aștepta la cursor se lasă baltă dacă ai plecat de acolo. */
      if (t.asteapta) {
        if (!curataAsteptarea(t.ta)) t.asteapta = null;
        else t.asteapta.poz = sel.a;
      }
      this.o.laFormat?.();
    });

    this.marime();
    new ResizeObserver(() => { this.marime(); this.o.laMarime?.(); this.o.laVedere?.("marime"); this.pozitioneazaEditorul(); }).observe(gazda);
    /* Plasă: dacă browserul tot derulează gazda (ca să arate cursorul), o pune la loc. */
    gazda.addEventListener("scroll", () => { gazda.scrollLeft = 0; gazda.scrollTop = 0; });
    this.leaga();
  }

  set poateScrie(v) { this.o.poateScrie = v; this.cursor(); }
  get poateScrie() { return !!this.o.poateScrie; }

  /* ---------- desenul întreg ---------- */
  incarca(desen) {
    this.inchideTextul(false);
    this.el = Array.isArray(desen?.el) ? copie(desen.el).filter((e) => e && typeof e === "object" && e.id && e.t) : [];
    /* Cutiile textelor și ale tabelelor se măsoară din nou: cele ținute în
       desen pot fi de dinaintea unei schimbări de așezare (listele din 0119+). */
    for (const e of this.el) if (e.t === "x" || e.t === "t") { try { this.masoara(e); } catch { /* rămâne cum era */ } }
    this.fundal = FUNDALURI.includes(desen?.fundal) ? desen.fundal : "alb";
    this.culoareFundal = CULOARE_BUNA.test(desen?.culoare || "") ? desen.culoare : "#ffffff";
    this.inapoi = [];
    this.inainte = [];
    this.selectate.clear();
    this.celule = null;
    this.temp = null;
    this.strain = null;
    this.ascunse.clear();
    this.cere();
    this.o.laSchimbare?.();
  }
  desenul() { return { fundal: this.fundal, culoare: this.culoareFundal, el: this.el }; }

  /** Aplică o operație și întoarce opusa ei (ori null, dacă n-a schimbat nimic). */
  aplica(op) {
    if (!op || typeof op !== "object") return null;
    let opus = null;
    if (op.fel === "pune" && Array.isArray(op.el)) {
      const noi = op.el.filter((e) => e && e.id && e.t && !this.el.some((x) => x.id === e.id)).map(copie);
      if (!noi.length) return null;
      if (Array.isArray(op.la) && op.la.length === noi.length) {
        noi.map((e, k) => [op.la[k], e]).sort((a, b) => a[0] - b[0])
          .forEach(([i, e]) => this.el.splice(Math.min(Math.max(0, i), this.el.length), 0, e));
      } else this.el.push(...noi);
      opus = { fel: "scoate", id: noi.map((e) => e.id) };
    } else if (op.fel === "scoate" && Array.isArray(op.id)) {
      const ids = new Set(op.id);
      const scoase = [], la = [];
      this.el.forEach((e, i) => { if (ids.has(e.id)) { scoase.push(e); la.push(i); } });
      if (!scoase.length) return null;
      this.el = this.el.filter((e) => !ids.has(e.id));
      ids.forEach((id) => this.selectate.delete(id));
      if (this.celule && ids.has(this.celule.id)) this.celule = null;
      opus = { fel: "pune", el: scoase, la };
    } else if (op.fel === "schimba" && Array.isArray(op.el)) {
      const vechi = [];
      for (const n of op.el) {
        const i = this.el.findIndex((e) => e.id === n?.id);
        if (i < 0) continue;
        vechi.push(this.el[i]);
        this.el[i] = copie(n);
      }
      if (!vechi.length) return null;
      opus = { fel: "schimba", el: vechi };
    } else if (op.fel === "ordine" && Array.isArray(op.id)) {
      const inainte = this.el.map((e) => e.id);
      const loc = new Map(op.id.map((id, k) => [id, k]));
      const noua = [...this.el].sort((a, b) => (loc.get(a.id) ?? 1e9) - (loc.get(b.id) ?? 1e9));
      if (noua.every((e, k) => e === this.el[k])) return null;
      this.el = noua;
      opus = { fel: "ordine", id: inainte };
    } else if (op.fel === "fundal" && FUNDALURI.includes(op.f)) {
      if (op.f === this.fundal) return null;
      opus = { fel: "fundal", f: this.fundal };
      this.fundal = op.f;
    } else if (op.fel === "culoare" && CULOARE_BUNA.test(op.c || "")) {
      if (op.c.toLowerCase() === this.culoareFundal.toLowerCase()) return null;
      opus = { fel: "culoare", c: this.culoareFundal };
      this.culoareFundal = op.c;
    }
    this.cere();
    return opus;
  }

  /** O operație a mea: se aplică, intră în Undo și pleacă mai departe. */
  fa(op) {
    const opus = this.aplica(op);
    if (!opus) return;
    this.inapoi.push(opus);
    if (this.inapoi.length > 300) this.inapoi.shift();
    this.inainte = [];
    this.o.laOperatie?.(op);
    this.o.laSchimbare?.();
  }
  anuleaza() {
    if (this.text) { this.inapoiInEditor(); return; }
    const op = this.inapoi.pop();
    if (!op) return;
    const opus = this.aplica(op);
    if (opus) this.inainte.push(opus);
    this.o.laOperatie?.(op);
    this.o.laSchimbare?.();
  }
  refa() {
    if (this.text) { this.inainteInEditor(); return; }
    const op = this.inainte.pop();
    if (!op) return;
    const opus = this.aplica(op);
    if (opus) this.inapoi.push(opus);
    this.o.laOperatie?.(op);
    this.o.laSchimbare?.();
  }

  stergeSelectia() {
    if (!this.selectate.size) return;
    this.fa({ fel: "scoate", id: [...this.selectate] });
  }
  dubleazaSelectia() {
    const noi = this.el.filter((e) => this.selectate.has(e.id)).map((e) => ({ ...mutat(e, PAS * 4, PAS * 4), id: idNou() }));
    if (!noi.length) return;
    this.fa({ fel: "pune", el: noi });
    this.selectate = new Set(noi.map((e) => e.id));
    this.cere();
  }
  /** Selecția în fața tuturor (deasupra textului) ori în spatele lor. */
  ordoneazaSelectia(unde) {
    if (!this.selectate.size) return;
    const alese = this.el.filter((e) => this.selectate.has(e.id)).map((e) => e.id);
    const rest = this.el.filter((e) => !this.selectate.has(e.id)).map((e) => e.id);
    this.fa({ fel: "ordine", id: unde === "fata" ? [...rest, ...alese] : [...alese, ...rest] });
  }
  /** Culoarea aleasă se pune și pe ce e selectat. */
  coloreazaSelectia(c) {
    const noi = this.el.filter((e) => this.selectate.has(e.id) && e.t !== "i").map((e) => {
      let n = { ...copie(e), c };
      /* Tot textul ia culoarea: cele puse pe cuvinte nu mai rămân. */
      if (n.t === "x") n = cuCuloare(n, 0, String(n.s || "").length, null);
      else if (n.t === "t") n.cel = n.cel.map((rand) => rand.map((k) => (k && !k.x ? cuCuloare(k, 0, String(k.s || "").length, null) : k)));
      return n;
    });
    if (noi.length) this.fa({ fel: "schimba", el: noi });
  }
  golesteTot() {
    if (this.el.length) this.fa({ fel: "scoate", id: this.el.map((e) => e.id) });
  }

  /* ---------- vederea ---------- */
  marime() {
    const r = this.gazda.getBoundingClientRect();
    const d = window.devicePixelRatio || 1;
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.panza.width = Math.round(this.W * d);
    this.panza.height = Math.round(this.H * d);
    this.panza.style.width = `${this.W}px`;
    this.panza.style.height = `${this.H}px`;
    this.cere();
  }
  /** Ce bucată din lume se vede acum. */
  zonaVazuta() {
    const { x, y, z } = this.vedere;
    return { x: r1(x), y: r1(y), w: r1(this.W / z), h: r1(this.H / z) };
  }
  /** Arată toată bucata dată, cât mai mare, la mijloc. */
  arataZona(b) {
    if (!b || !(b.w >= 20) || !(b.h >= 20) || this.W < 20 || this.H < 20) return;
    const z = Math.min(8, Math.max(0.05, Math.min(this.W / b.w, this.H / b.h)));
    this.vedere = { z, x: b.x + b.w / 2 - this.W / 2 / z, y: b.y + b.h / 2 - this.H / 2 / z };
    this.cere();
    this.pozitioneazaEditorul();
  }
  mareste(f, sx = this.W / 2, sy = this.H / 2) {
    const { x, y, z } = this.vedere;
    const nz = Math.min(8, Math.max(0.1, z * f));
    const wx = x + sx / z, wy = y + sy / z;
    this.vedere = { z: nz, x: wx - sx / nz, y: wy - sy / nz };
    this.cere();
    this.pozitioneazaEditorul();
    this.o.laVedere?.();
  }
  /** Încape tot desenul; o pagină goală se întoarce la început. */
  potriveste() {
    let b = null;
    for (const e of this.el) b = uneste(b, cutia(e));
    if (!b) this.vedere = { x: 0, y: 0, z: 1 };
    else this.arataZona({ x: b.x - 40, y: b.y - 40, w: Math.max(b.w + 80, 300), h: Math.max(b.h + 80, 200) });
    this.cere();
    this.pozitioneazaEditorul();
    this.o.laVedere?.();
  }
  laMarimeaReala() { this.mareste(1 / this.vedere.z); }
  lume(cx, cy) {
    const r = this.panza.getBoundingClientRect();
    const { x, y, z } = this.vedere;
    return [x + (cx - r.left) / z, y + (cy - r.top) / z];
  }

  /* ---------- așezarea textelor și a tabelelor ---------- */
  asezareText(e) {
    let a = this.asezari.get(e);
    if (!a) {
      a = aseaza(this.ctx, e, { m: e.m, lat: e.lat || null, ind: e.ind || null });
      this.asezari.set(e, a);
    }
    return a;
  }
  /** Rândurile și celulele unui tabel, cu textul așezat în fiecare. */
  tabelul(e) {
    let L = this.asezari.get(e);
    if (L) return L;
    const pad = padTabel(e);
    const nr = e.cel.length, nc = e.col.length;
    const xs = [0]; for (const w of e.col) xs.push(xs[xs.length - 1] + w);
    const celule = [];
    for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
      if (!celOk(e, i, j)) continue;
      const c = e.cel[i][j];
      const cs = Math.min(c.cs || 1, nc - j), rs = Math.min(c.rs || 1, nr - i);
      const w = xs[j + cs] - xs[j];
      const as = aseaza(this.ctx, c, { m: e.m, lat: Math.max(e.m, w - 2 * pad), aliniere: c.ah || "l" });
      celule.push({ i, j, cs, rs, x: xs[j], w, as, cel: c });
    }
    /* Înălțimile: cea minimă a rândului, ori cât cere textul celulelor lui. */
    const hr = e.rh.map((h) => Math.max(h, randMinim(e)));
    for (const k of celule.filter((x) => x.rs === 1)) hr[k.i] = Math.max(hr[k.i], k.as.h + 2 * pad);
    for (const k of celule.filter((x) => x.rs > 1)) {
      const are = hr.slice(k.i, k.i + k.rs).reduce((a, x) => a + x, 0);
      const vrea = k.as.h + 2 * pad;
      if (vrea > are) hr[k.i + k.rs - 1] += vrea - are;
    }
    const ys = [0]; for (const h of hr) ys.push(ys[ys.length - 1] + h);
    for (const k of celule) { k.y = ys[k.i]; k.h = ys[k.i + k.rs] - ys[k.i]; }
    L = { xs, ys, hr, celule, w: xs[nc], h: ys[nr], pad };
    this.asezari.set(e, L);
    return L;
  }
  /** Măsoară elementul (lățimea și înălțimea lui, pentru selecție). */
  masoara(e) {
    if (e.t === "x") { const a = aseaza(this.ctx, e, { m: e.m, lat: e.lat || null, ind: e.ind || null }); e.w = r1(a.w); e.h = r1(a.h); }
    else if (e.t === "t") { this.asezari.delete(e); const L = this.tabelul(e); e.w = r1(L.w); e.h = r1(L.h); this.asezari.delete(e); }
    return e;
  }
  masoaraText(e) { return this.masoara(e); }

  /* ---------- desenul pe ecran ---------- */
  cere() {
    if (this.cerut) return;
    this.cerut = true;
    requestAnimationFrame(() => { this.cerut = false; this.deseneaza(); });
  }

  deseneaza() {
    const c = this.ctx, d = this.pixel || window.devicePixelRatio || 1;
    const { x, y, z } = this.vedere;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = this.culoareFundal;
    c.fillRect(0, 0, this.W, this.H);
    this.grila();
    c.setTransform(d * z, 0, 0, d * z, -x * z * d, -y * z * d);
    /* Un text ori un tabel în lucru la profesor poartă id-ul celui pe care îl
       schimbă: cel vechi nu se mai arată, ca să nu fie de două ori. */
    const inLucru = this.strain?.id || null;
    for (const e of this.el) if (!this.ascunse.has(e.id) && e.id !== inLucru) this.element(e, this.mutare && this.selectate.has(e.id));
    if (this.strain && this.strain.t !== "laser") this.element(this.strain);
    if (this.temp) this.element(this.temp);
    if (this.laser) this.deseneazaLaser(this.laser);
    if (this.selectate.size && !this.pixel) this.selectia();
    if (this.banda) {
      const b = this.banda;
      c.save();
      c.strokeStyle = "#c2410c"; c.lineWidth = 1 / z; c.setLineDash([6 / z, 4 / z]);
      c.fillStyle = "rgba(194, 65, 12, .06)";
      c.fillRect(b.x, b.y, b.w, b.h); c.strokeRect(b.x, b.y, b.w, b.h);
      c.restore();
    }
  }

  grila() {
    if (this.fundal === "alb") return;
    const c = this.ctx;
    const { x, y, z } = this.vedere;
    const pas = PAS_GRILA * z;
    if (pas < 8) return;
    const ox = -x * z % pas, oy = -y * z % pas;
    c.save();
    const pe = inchisa(this.culoareFundal);
    if (this.fundal === "puncte") {
      c.fillStyle = pe ? "rgba(255, 255, 255, .35)" : "#c9c1b7";
      for (let a = ox; a < this.W; a += pas) for (let b = oy; b < this.H; b += pas) c.fillRect(a - 1, b - 1, 2, 2);
    } else {
      c.strokeStyle = pe ? "rgba(255, 255, 255, .2)" : this.fundal === "dictando" ? "#c7d7ee" : "#e3ddd5";
      c.lineWidth = 1;
      c.beginPath();
      for (let b = oy; b < this.H; b += pas) { c.moveTo(0, Math.round(b) + 0.5); c.lineTo(this.W, Math.round(b) + 0.5); }
      if (this.fundal === "patratele") for (let a = ox; a < this.W; a += pas) { c.moveTo(Math.round(a) + 0.5, 0); c.lineTo(Math.round(a) + 0.5, this.H); }
      c.stroke();
    }
    c.restore();
  }

  element(e, mutat_ = false) {
    const c = this.ctx;
    c.save();
    if (mutat_ && this.mutare) c.translate(this.mutare.dx, this.mutare.dy);
    if (mutat_ && this.scalare) {
      const { ox, oy, s } = this.scalare;
      c.translate(ox, oy); c.scale(s, s); c.translate(-ox, -oy);
    }
    c.strokeStyle = e.c || "#1f2430";
    c.fillStyle = e.c || "#1f2430";
    c.lineWidth = e.g || 2;
    c.lineCap = "round";
    c.lineJoin = "round";
    if (e.o) c.globalAlpha = e.o;
    if (e.t === "p") {
      const p = e.pts;
      if (p.length === 2) {
        c.beginPath(); c.arc(p[0], p[1], (e.g || 2) / 2, 0, Math.PI * 2); c.fill();
      } else {
        c.beginPath();
        c.moveTo(p[0], p[1]);
        for (let i = 2; i + 2 < p.length; i += 2) {
          c.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
        }
        c.lineTo(p[p.length - 2], p[p.length - 1]);
        c.stroke();
      }
    } else if (e.t === "l" || e.t === "a") {
      c.beginPath(); c.moveTo(e.x1, e.y1); c.lineTo(e.x2, e.y2); c.stroke();
      if (e.t === "a") {
        const u = Math.atan2(e.y2 - e.y1, e.x2 - e.x1), l = Math.max(10, (e.g || 2) * 4);
        c.beginPath();
        c.moveTo(e.x2 - l * Math.cos(u - 0.45), e.y2 - l * Math.sin(u - 0.45));
        c.lineTo(e.x2, e.y2);
        c.lineTo(e.x2 - l * Math.cos(u + 0.45), e.y2 - l * Math.sin(u + 0.45));
        c.stroke();
      }
    } else if (e.t === "r") {
      c.strokeRect(Math.min(e.x1, e.x2), Math.min(e.y1, e.y2), Math.abs(e.x2 - e.x1), Math.abs(e.y2 - e.y1));
    } else if (e.t === "e") {
      c.beginPath();
      c.ellipse((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2, Math.abs(e.x2 - e.x1) / 2, Math.abs(e.y2 - e.y1) / 2, 0, 0, Math.PI * 2);
      c.stroke();
    } else if (e.t === "x") {
      deseneazaText(c, this.asezareText(e), e.x, e.y, e.m, e.c);
    } else if (e.t === "t") {
      this.deseneazaTabel(e);
    } else if (e.t === "i") {
      const img = this.imaginea(e.src);
      if (img.complete && img.naturalWidth) c.drawImage(img, e.x, e.y, e.w, e.h);
      else { c.strokeStyle = "#e3ddd5"; c.lineWidth = 1; c.strokeRect(e.x, e.y, e.w, e.h); }
    }
    c.restore();
  }

  deseneazaTabel(e) {
    const c = this.ctx, z = this.vedere.z;
    const L = this.tabelul(e);
    const { pad } = L;
    /* Celula în care scrii acum: textul ei vechi nu se desenează (îl ține
       caseta de deasupra), altfel s-ar vedea de două ori, unul peste altul. */
    const scriuIn = this.text?.tabel?.id === e.id && !this.pixel ? this.text.celula : null;
    for (const k of L.celule) {
      if (k.cel.bg && CULOARE_BUNA.test(k.cel.bg)) { c.fillStyle = k.cel.bg; c.fillRect(e.x + k.x, e.y + k.y, k.w, k.h); }
      if (scriuIn && scriuIn.i === k.i && scriuIn.j === k.j) continue;
      const av = k.cel.av || "m";
      const dy = av === "s" ? pad : av === "j" ? k.h - pad - k.as.h : (k.h - k.as.h) / 2;
      deseneazaText(c, k.as, e.x + k.x + pad, e.y + k.y + dy, e.m, e.c);
    }
    /* Chenarele, după fel. */
    const f = e.ch?.f || "toate";
    const ex = 0.5;
    const muchii = [];
    for (const k of L.celule) {
      const sus = k.y < ex, jos = Math.abs(k.y + k.h - L.h) < ex, st = k.x < ex, dr = Math.abs(k.x + k.w - L.w) < ex;
      const x0 = e.x + k.x, y0 = e.y + k.y, x1 = x0 + k.w, y1 = y0 + k.h;
      const vrea = (margine) => f === "toate" || (f === "exterior" && margine) || (f === "interior" && !margine);
      if (f === "orizontale") { muchii.push([x0, y0, x1, y0], [x0, y1, x1, y1]); continue; }
      if (vrea(sus)) muchii.push([x0, y0, x1, y0]);
      if (vrea(jos)) muchii.push([x0, y1, x1, y1]);
      if (vrea(st)) muchii.push([x0, y0, x0, y1]);
      if (vrea(dr)) muchii.push([x1, y0, x1, y1]);
    }
    if (muchii.length && f !== "fara") {
      c.save();
      c.strokeStyle = e.ch?.c || "#1f2430";
      c.lineWidth = e.ch?.g || 1.5;
      c.lineCap = "square";
      c.beginPath();
      for (const [a, b, x, y] of muchii) { c.moveTo(a, b); c.lineTo(x, y); }
      c.stroke();
      c.restore();
    }
    /* La profesor, cât lucrează pe tabel: liniile ascunse, punctate (ca în Word). */
    const lucreaza = this.poateScrie && !this.pixel && (this.selectate.has(e.id) || this.text?.tabel?.id === e.id);
    if (lucreaza && f !== "toate") {
      c.save();
      c.strokeStyle = "rgba(37, 99, 235, .45)"; c.lineWidth = 1 / z; c.setLineDash([3 / z, 3 / z]);
      for (const k of L.celule) c.strokeRect(e.x + k.x, e.y + k.y, k.w, k.h);
      c.restore();
    }
    /* Celulele alese. */
    const s = this.celule;
    if (s && s.id === e.id && !this.pixel) {
      c.save();
      c.fillStyle = "rgba(37, 99, 235, .14)";
      for (const k of L.celule) if (k.i <= s.i1 && k.i + k.rs - 1 >= s.i0 && k.j <= s.j1 && k.j + k.cs - 1 >= s.j0) c.fillRect(e.x + k.x, e.y + k.y, k.w, k.h);
      c.restore();
    }
  }

  imaginea(src) {
    let img = this.imagini.get(src);
    if (!img) {
      img = new Image();
      img.onload = () => this.cere();
      img.src = src;
      this.imagini.set(src, img);
    }
    return img;
  }

  deseneazaLaser(l) {
    const c = this.ctx, p = l.pts, z = this.vedere.z;
    if (!p?.length) return;
    c.save();
    c.lineCap = "round"; c.lineJoin = "round";
    c.strokeStyle = "rgba(239, 68, 68, .45)"; c.lineWidth = 6 / z;
    c.beginPath(); c.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]);
    c.stroke();
    c.fillStyle = "#ef4444";
    c.shadowColor = "#ef4444"; c.shadowBlur = 12;
    c.beginPath(); c.arc(p[p.length - 2], p[p.length - 1], 7 / z, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  cutiaSelectiei() {
    let b = null;
    for (const e of this.el) if (this.selectate.has(e.id)) b = uneste(b, cutia(this.previzualizare?.id === e.id ? this.previzualizare : e));
    if (b && this.mutare) b = { ...b, x: b.x + this.mutare.dx, y: b.y + this.mutare.dy };
    if (b && this.scalare) {
      const { ox, oy, s } = this.scalare;
      b = { x: ox + (b.x - ox) * s, y: oy + (b.y - oy) * s, w: b.w * s, h: b.h * s };
    }
    return b;
  }
  /** Singurul element ales, dacă e unul singur. */
  singurul() {
    if (this.selectate.size !== 1) return null;
    const id = [...this.selectate][0];
    return this.el.find((e) => e.id === id) || null;
  }
  /* Mânerele: colțul (mărește), dreapta (lățimea textului), mutarea tabelului. */
  manere() {
    const b = this.cutiaSelectiei();
    if (!b) return null;
    const z = this.vedere.z, d = 6 / z;
    const unul = this.singurul();
    return {
      colt: { x: b.x + b.w + d, y: b.y + b.h + d },
      latime: unul?.t === "x" && !this.mutare && !this.scalare ? { x: b.x + b.w + d, y: b.y + b.h / 2 } : null,
      mutare: unul?.t === "t" && !this.scalare ? { x: b.x - d - 9 / z, y: b.y - d - 9 / z } : null,
    };
  }
  selectia() {
    if (this.text && !this.text.tabel) return;   // cât scrii, chenarul selecției nu stă peste text
    const b = this.cutiaSelectiei();
    if (!b) return;
    const c = this.ctx, z = this.vedere.z;
    c.save();
    c.strokeStyle = "#c2410c"; c.lineWidth = 1.5 / z; c.setLineDash([6 / z, 4 / z]);
    c.strokeRect(b.x - 6 / z, b.y - 6 / z, b.w + 12 / z, b.h + 12 / z);
    c.setLineDash([]);
    c.fillStyle = "#ffffff";
    const m = 14 / z;
    const M = this.manere();
    const patrat = (p) => { c.fillRect(p.x - m / 2, p.y - m / 2, m, m); c.strokeRect(p.x - m / 2, p.y - m / 2, m, m); };
    patrat(M.colt);
    if (M.latime) {
      c.fillRect(M.latime.x - m / 4, M.latime.y - m, m / 2, m * 2);
      c.strokeRect(M.latime.x - m / 4, M.latime.y - m, m / 2, m * 2);
    }
    if (M.mutare) {
      patrat(M.mutare);
      c.strokeStyle = "#c2410c"; c.lineWidth = 1.5 / z;
      const { x, y } = M.mutare, q = m * 0.32;
      c.beginPath(); c.moveTo(x - q, y); c.lineTo(x + q, y); c.moveTo(x, y - q); c.lineTo(x, y + q); c.stroke();
    }
    if (this.latire) {
      c.strokeStyle = "rgba(37, 99, 235, .7)"; c.setLineDash([4 / z, 4 / z]);
      const lx = this.latire.e.x + this.latire.lat;
      c.beginPath(); c.moveTo(lx, b.y - 40 / z); c.lineTo(lx, b.y + b.h + 40 / z); c.stroke();
    }
    c.restore();
  }

  /* ---------- mâna pe planșă ---------- */
  cursor() {
    const u = this.poateScrie ? this.unealta : "mana";
    this.panza.style.cursor = this.spatiu || u === "mana" ? "grab"
      : u === "text" ? "text" : u === "selectie" ? "default" : u === "radiera" ? "cell" : "crosshair";
  }
  setUnealta(u) {
    this.inchideTextul(true);
    this.unealta = u;
    if (u !== "selectie") { this.selectate.clear(); this.celule = null; this.cere(); }
    this.cursor();
    this.o.laSchimbare?.();
  }

  leaga() {
    const p = this.panza;
    p.style.touchAction = "none";
    p.addEventListener("pointerdown", (e) => this.jos(e));
    p.addEventListener("pointermove", (e) => this.misca(e));
    p.addEventListener("pointerup", (e) => this.sus(e));
    p.addEventListener("pointercancel", (e) => this.sus(e, true));
    p.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = p.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) this.mareste(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
      else {
        this.vedere.x += e.deltaX / this.vedere.z;
        this.vedere.y += e.deltaY / this.vedere.z;
        this.cere();
        this.pozitioneazaEditorul();
        this.o.laVedere?.();
      }
      this.o.laManaMea?.();
    }, { passive: false });
    p.addEventListener("dblclick", (e) => {
      if (!this.poateScrie || this.unealta !== "selectie") return;
      const [wx, wy] = this.lume(e.clientX, e.clientY);
      const t = [...this.el].reverse().find((x) => (x.t === "x" || x.t === "t") && atinge(x, wx, wy, 4 / this.vedere.z));
      if (t?.t === "x") this.deschideTextul(t.x, t.y, t);
      else if (t?.t === "t") { const k = this.celulaLa(t, wx, wy); if (k) this.deschideCelula(t, k.i, k.j); }
    });
    addEventListener("keydown", (e) => {
      if (e.code === "Space" && !this.text && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "") && !document.activeElement?.isContentEditable) {
        if (!this.spatiu) { this.spatiu = true; this.cursor(); }
        e.preventDefault();
      }
    });
    addEventListener("keyup", (e) => { if (e.code === "Space") { this.spatiu = false; this.cursor(); } });
    /* Un text deschis se închide (și se păstrează) la orice apăsare în afara lui
       și a uneltelor care lucrează chiar pe el (B / I / U, liste, aliniere, tabel). */
    document.addEventListener("pointerdown", (e) => {
      if (!this.text) return;
      const t = e.target;
      if (this.text.ta.contains(t) || t === this.panza || t.closest?.("[data-pastreaza-textul], .ta-margine")) return;
      this.inchideTextul(true);
    }, true);
  }

  /** Celula tabelului de sub punct. */
  celulaLa(e, wx, wy) {
    const L = this.tabelul(e);
    const x = wx - e.x, y = wy - e.y;
    return L.celule.find((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) || null;
  }
  /** Marginea de coloană ori de rând de sub punct (pentru tras). */
  margineLa(e, wx, wy) {
    const L = this.tabelul(e);
    const tol = 5 / this.vedere.z;
    const x = wx - e.x, y = wy - e.y;
    if (y >= -tol && y <= L.h + tol) for (let j = 1; j < L.xs.length; j++) if (Math.abs(x - L.xs[j]) <= tol) return { fel: "col", j: j - 1 };
    if (x >= -tol && x <= L.w + tol) for (let i = 1; i < L.ys.length; i++) if (Math.abs(y - L.ys[i]) <= tol) return { fel: "rand", i: i - 1 };
    return null;
  }

  jos(e) {
    if (this.text && e.target === this.panza) this.inchideTextul(true);
    this.degete.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.panza.setPointerCapture(e.pointerId);
    /* Două degete: planșa se trage și se mărește; desenul început se lasă. */
    if (this.degete.size === 2) {
      this.temp = null; this.banda = null; this.mutare = null; this.scalare = null; this.latire = null; this.tragTabel = null;
      this.gataPrevizualizarea();
      this.ascunse.clear();
      this.o.laTrasare?.(null);
      this.gest = this.gestul();
      this.actiune = "gest";
      this.cere();
      return;
    }
    if (this.degete.size > 2) return;
    const u = this.poateScrie ? this.unealta : "mana";
    if (this.spatiu || e.button === 1 || u === "mana") {
      this.actiune = "trage";
      this.start = { cx: e.clientX, cy: e.clientY, x: this.vedere.x, y: this.vedere.y };
      this.panza.style.cursor = "grabbing";
      return;
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const [wx, wy] = this.lume(e.clientX, e.clientY);
    const tol = 6 / this.vedere.z;
    this.actiune = u;
    if (u === "creion" || u === "marker") {
      const marker = u === "marker";
      this.temp = { id: idNou(), t: "p", c: this.culoare, g: marker ? this.grosime * 5 : this.grosime, ...(marker ? { o: 0.35 } : {}), pts: [r1(wx), r1(wy)] };
    } else if (u === "linie" || u === "sageata" || u === "dreptunghi" || u === "elipsa") {
      const t = { linie: "l", sageata: "a", dreptunghi: "r", elipsa: "e" }[u];
      this.temp = { id: idNou(), t, c: this.culoare, g: this.grosime, x1: prinde(wx), y1: prinde(wy), x2: prinde(wx), y2: prinde(wy) };
    } else if (u === "radiera") {
      this.urmaRadierei = [wx, wy];
      this.sterge(wx, wy, tol * 2);
    } else if (u === "laser") {
      this.laser = { t: "laser", pts: [r1(wx), r1(wy)] };
      clearTimeout(this.ceasLaser);
    } else if (u === "text") {
      const sub = [...this.el].reverse().find((x) => (x.t === "x" || x.t === "t") && atinge(x, wx, wy, tol));
      if (sub?.t === "t") { const k = this.celulaLa(sub, wx, wy); if (k) this.deschideCelula(sub, k.i, k.j); }
      else if (sub) this.deschideTextul(sub.x, sub.y, sub);
      else { const [x, y] = this.locDeText(wx, wy); this.deschideTextul(x, y, null); }
      this.actiune = null;
      e.preventDefault();
    } else if (u === "selectie") {
      this.josSelectie(e, wx, wy, tol);
    }
    this.cere();
  }

  /** Unde se pune un text nou: pe grilă, iar chiar sub alt text, aliniat la el. */
  locDeText(wx, wy) {
    const m = this.marimeText;
    for (const t of this.el) {
      if (t.t !== "x") continue;
      const jos = t.y + (t.h || 0);
      if (Math.abs(wx - t.x) <= Math.max(30, t.m * 1.5) && wy >= jos - t.m * 0.3 && wy <= jos + t.m * 2.2) {
        return [t.x, prinde(jos + t.m * 0.25)];
      }
    }
    return [prinde(wx), prinde(wy - m * 0.6)];
  }

  josSelectie(e, wx, wy, tol) {
    const M = this.manere();
    const m = 14 / this.vedere.z;
    const pe = (p) => p && Math.abs(wx - p.x) <= m && Math.abs(wy - p.y) <= m;
    const unul = this.singurul();
    if (M && pe(M.latime)) {
      this.actiune = "latime";
      this.latire = { e: unul, lat: unul.lat || unul.w };
    } else if (M && pe(M.mutare)) {
      this.actiune = "muta";
      this.mutare = { x0: wx, y0: wy, dx: 0, dy: 0 };
    } else if (M && pe(M.colt)) {
      const b = this.cutiaSelectiei();
      this.actiune = "scaleaza";
      this.scalare = { ox: b.x, oy: b.y, s: 1, w0: Math.max(1, b.w), h0: Math.max(1, b.h) };
    } else if (unul?.t === "t" && atinge(unul, wx, wy, tol)) {
      /* Tabelul ales: marginile se trag, celulele se aleg (ca în Word). */
      const mg = this.margineLa(unul, wx, wy);
      if (mg) {
        this.actiune = "tabel-margine";
        this.tragTabel = { e: unul, ...mg, x0: wx, y0: wy, L: this.tabelul(unul) };
      } else {
        const k = this.celulaLa(unul, wx, wy);
        if (k) {
          this.actiune = "tabel-celule";
          this.tragTabel = { e: unul, i0: k.i, j0: k.j };
          this.celule = { id: unul.id, i0: k.i, j0: k.j, i1: k.i + k.rs - 1, j1: k.j + k.cs - 1 };
        }
      }
    } else {
      const t = [...this.el].reverse().find((x) => atinge(x, wx, wy, tol, true));
      this.celule = null;
      if (t) {
        if (e.shiftKey) { if (this.selectate.has(t.id)) this.selectate.delete(t.id); else this.selectate.add(t.id); }
        else if (!this.selectate.has(t.id)) this.selectate = new Set([t.id]);
        /* Un tabel abia ales nu se mută din mijloc (acolo se aleg celulele):
           se mută de mânerul lui ✥. */
        if (t.t === "t" && this.selectate.size === 1 && !e.shiftKey) this.actiune = null;
        else { this.actiune = "muta"; this.mutare = { x0: wx, y0: wy, dx: 0, dy: 0 }; }
      } else {
        if (!e.shiftKey) this.selectate.clear();
        this.actiune = "banda";
        this.banda = { x0: wx, y0: wy, x: wx, y: wy, w: 0, h: 0 };
      }
    }
    this.o.laSchimbare?.();
  }

  gestul() {
    const [a, b] = [...this.degete.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), v: { ...this.vedere } };
  }

  misca(e) {
    if (!this.degete.has(e.pointerId)) {
      /* Fără nimic apăsat: cursorul spune ce se poate trage. */
      if (this.poateScrie && this.unealta === "selectie" && !this.degete.size && !this.spatiu) {
        const [wx, wy] = this.lume(e.clientX, e.clientY);
        const unul = this.singurul();
        const M = this.manere();
        const m = 14 / this.vedere.z;
        const pe = (p) => p && Math.abs(wx - p.x) <= m && Math.abs(wy - p.y) <= m;
        let c = "default";
        if (M && pe(M.latime)) c = "ew-resize";
        else if (M && pe(M.colt)) c = "nwse-resize";
        else if (M && pe(M.mutare)) c = "move";
        else if (unul?.t === "t") { const mg = this.margineLa(unul, wx, wy); if (mg) c = mg.fel === "col" ? "col-resize" : "row-resize"; }
        this.panza.style.cursor = c;
      }
      return;
    }
    this.degete.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const a = this.actiune;
    if (a === "gest" && this.degete.size === 2) {
      const g0 = this.gest, g = this.gestul();
      const r = this.panza.getBoundingClientRect();
      const z = Math.min(8, Math.max(0.1, g0.v.z * g.d / g0.d));
      const wx = g0.v.x + (g0.cx - r.left) / g0.v.z, wy = g0.v.y + (g0.cy - r.top) / g0.v.z;
      this.vedere = { z, x: wx - (g.cx - r.left) / z, y: wy - (g.cy - r.top) / z };
      this.cere();
      this.pozitioneazaEditorul();
      this.o.laVedere?.();
      this.o.laManaMea?.();
      return;
    }
    if (a === "trage") {
      const s = this.start;
      this.vedere.x = s.x - (e.clientX - s.cx) / this.vedere.z;
      this.vedere.y = s.y - (e.clientY - s.cy) / this.vedere.z;
      this.cere();
      this.pozitioneazaEditorul();
      this.o.laVedere?.();
      this.o.laManaMea?.();
      return;
    }
    const [wx, wy] = this.lume(e.clientX, e.clientY);
    if ((a === "creion" || a === "marker") && this.temp) {
      const p = this.temp.pts;
      if (Math.hypot(wx - p[p.length - 2], wy - p[p.length - 1]) * this.vedere.z < 1.5) return;
      p.push(r1(wx), r1(wy));
      this.o.laTrasare?.(this.temp);
    } else if (this.temp && "x1" in this.temp) {
      let x2 = wx, y2 = wy;
      if (e.shiftKey) {
        if (this.temp.t === "r" || this.temp.t === "e") {
          const l = Math.max(Math.abs(wx - this.temp.x1), Math.abs(wy - this.temp.y1));
          x2 = this.temp.x1 + Math.sign(wx - this.temp.x1) * l; y2 = this.temp.y1 + Math.sign(wy - this.temp.y1) * l;
        } else {
          const u = Math.round(Math.atan2(wy - this.temp.y1, wx - this.temp.x1) / (Math.PI / 4)) * (Math.PI / 4);
          const l = Math.hypot(wx - this.temp.x1, wy - this.temp.y1);
          x2 = this.temp.x1 + l * Math.cos(u); y2 = this.temp.y1 + l * Math.sin(u);
        }
        this.temp.x2 = r1(x2); this.temp.y2 = r1(y2);
      } else { this.temp.x2 = prinde(x2); this.temp.y2 = prinde(y2); }
      this.o.laTrasare?.(this.temp);
    } else if (a === "radiera") {
      /* Și pe drumul dintre două mișcări: o mână repede sare peste desen. */
      const tol = 12 / this.vedere.z;
      const [x0, y0] = this.urmaRadierei || [wx, wy];
      const pasi = Math.max(1, Math.ceil(Math.hypot(wx - x0, wy - y0) / tol));
      for (let k = 1; k <= pasi; k++) this.sterge(x0 + (wx - x0) * k / pasi, y0 + (wy - y0) * k / pasi, tol);
      this.urmaRadierei = [wx, wy];
    } else if (a === "laser" && this.laser) {
      this.laser.pts.push(r1(wx), r1(wy));
      if (this.laser.pts.length > 60) this.laser.pts.splice(0, this.laser.pts.length - 60);
      this.o.laTrasare?.(this.laser);
    } else if (a === "muta" && this.mutare) {
      /* Pe grila din spate: colțul de sus al selecției cade pe un punct al ei. */
      const b = this.el.filter((x) => this.selectate.has(x.id)).reduce((acc, x) => uneste(acc, cutia(x)), null);
      const dx = wx - this.mutare.x0, dy = wy - this.mutare.y0;
      this.mutare.dx = b ? prinde(b.x + dx) - b.x : dx;
      this.mutare.dy = b ? prinde(b.y + dy) - b.y : dy;
    } else if (a === "scaleaza" && this.scalare) {
      const s = this.scalare;
      s.s = Math.max(0.05, Math.max((wx - s.ox) / s.w0, (wy - s.oy) / s.h0));
    } else if (a === "latime" && this.latire) {
      /* Lățimea textului, cu previzualizare: textul se reașază pe loc. */
      const l = this.latire;
      l.lat = Math.max(l.e.m * 2, prinde(wx - l.e.x));
      this.strainMeu(this.masoara({ ...copie(l.e), lat: l.lat }));
    } else if (a === "tabel-margine" && this.tragTabel) {
      const g = this.tragTabel;
      const n = copie(g.e);
      if (g.fel === "col") n.col[g.j] = Math.max(g.e.m * 1.5, prinde(wx - g.e.x - g.L.xs[g.j]));
      else n.rh[g.i] = Math.max(randMinim(g.e), prinde(wy - g.e.y - g.L.ys[g.i]));
      this.strainMeu(this.masoara(n));
    } else if (a === "tabel-celule" && this.tragTabel) {
      const g = this.tragTabel;
      const k = this.celulaLa(g.e, wx, wy);
      if (k) this.celule = this.inchideZona(g.e, Math.min(g.i0, k.i), Math.min(g.j0, k.j), Math.max(g.i0, k.i + k.rs - 1), Math.max(g.j0, k.j + k.cs - 1));
    } else if (a === "banda" && this.banda) {
      const b = this.banda;
      b.x = Math.min(b.x0, wx); b.y = Math.min(b.y0, wy); b.w = Math.abs(wx - b.x0); b.h = Math.abs(wy - b.y0);
    } else return;
    this.cere();
  }

  /** Previzualizarea unei schimbări a mea, cât ții degetul: se vede în locul
   *  elementului și pleacă live, ca desenul în curs. */
  strainMeu(el) {
    if (this.previzualizare) this.ascunse.delete(this.previzualizare.id);
    this.previzualizare = el;
    this.temp = el;
    if (el) this.ascunse.add(el.id);
    this.o.laTrasare?.(el);
  }
  gataPrevizualizarea() {
    if (this.previzualizare) { this.ascunse.delete(this.previzualizare.id); this.temp = null; }
    this.previzualizare = null;
  }

  /** Zona de celule lărgită cât să cuprindă întregi celulele îmbinate. */
  inchideZona(e, i0, j0, i1, j1) {
    let schimbat = true;
    while (schimbat) {
      schimbat = false;
      for (let i = 0; i < e.cel.length; i++) for (let j = 0; j < e.col.length; j++) {
        if (!celOk(e, i, j)) continue;
        const c = e.cel[i][j];
        const ie = i + (c.rs || 1) - 1, je = j + (c.cs || 1) - 1;
        if (!(i <= i1 && ie >= i0 && j <= j1 && je >= j0)) continue;
        if (i < i0) { i0 = i; schimbat = true; }
        if (j < j0) { j0 = j; schimbat = true; }
        if (ie > i1) { i1 = ie; schimbat = true; }
        if (je > j1) { j1 = je; schimbat = true; }
      }
    }
    return { id: e.id, i0, j0, i1, j1 };
  }

  sus(e, anulat = false) {
    this.degete.delete(e.pointerId);
    const a = this.actiune;
    if (a === "gest") { if (!this.degete.size) this.actiune = null; return; }
    this.actiune = null;
    if (a === "trage") { this.cursor(); return; }
    if ((a === "creion" || a === "marker" || a === "linie" || a === "sageata" || a === "dreptunghi" || a === "elipsa") && this.temp) {
      const t = this.temp;
      this.temp = null;
      const bun = !anulat && (t.t === "p" || Math.hypot(t.x2 - t.x1, t.y2 - t.y1) > 2);
      if (bun) this.fa({ fel: "pune", el: [t] });
      this.o.laTrasare?.(null);
    } else if (a === "radiera") {
      const ids = [...this.ascunse];
      this.ascunse.clear();
      if (ids.length) this.fa({ fel: "scoate", id: ids });
    } else if (a === "laser") {
      this.ceasLaser = setTimeout(() => { this.laser = null; this.o.laTrasare?.(null); this.cere(); }, 700);
    } else if (a === "muta" && this.mutare) {
      const { dx, dy } = this.mutare;
      this.mutare = null;
      if (Math.abs(dx) + Math.abs(dy) > 0.5) this.fa({ fel: "schimba", el: this.el.filter((x) => this.selectate.has(x.id)).map((x) => mutat(x, dx, dy)) });
    } else if (a === "scaleaza" && this.scalare) {
      const { ox, oy, s } = this.scalare;
      this.scalare = null;
      if (Math.abs(s - 1) > 0.005) this.fa({ fel: "schimba", el: this.el.filter((x) => this.selectate.has(x.id)).map((x) => this.masoara(marit(x, ox, oy, s))) });
    } else if ((a === "latime" || a === "tabel-margine") && this.previzualizare) {
      const n = this.previzualizare;
      this.gataPrevizualizarea();
      this.latire = null;
      this.tragTabel = null;
      if (!anulat) this.fa({ fel: "schimba", el: [n] });
      this.o.laTrasare?.(null);
    } else if (a === "tabel-celule") {
      this.tragTabel = null;
      this.o.laSchimbare?.();
    } else if (a === "banda" && this.banda) {
      const b = this.banda;
      this.banda = null;
      for (const x of this.el) {
        const c = cutia(x);
        if (c.x >= b.x && c.y >= b.y && c.x + c.w <= b.x + b.w && c.y + c.h <= b.y + b.h) this.selectate.add(x.id);
      }
      this.o.laSchimbare?.();
    }
    this.latire = null;
    this.tragTabel = null;
    this.cere();
  }

  sterge(wx, wy, tol) {
    for (const x of this.el) if (!this.ascunse.has(x.id) && atinge(x, wx, wy, tol)) this.ascunse.add(x.id);
    this.cere();
  }

  /* =========================================================
     EDITORUL DE TEXT (casetă ori celulă de tabel)

     Scrisul îl face browserul (`contenteditable`). Formatul pe cuvinte
     (mărimea, culoarea, markerul) se pune ÎN MODEL, iar caseta se scrie din
     nou din el, cu selecția la loc: așa nu rămâne în ea nimic pus de browser
     după capul lui. Fără nimic selectat, formatul ales așteaptă la cursor și
     îl ia ce tastezi mai departe, ca în Word.

     CTRL+Z E AL CASETEI, nu al browserului: istoricul browserului nu știe de
     listele făcute singure ori de formatul pus din bară, și le sărea. Fiecare
     pas ține textul și selecția; tastatul se strânge pe cuvinte.
     ========================================================= */

  /** Ce trebuie știut ca să se citească textul din casetă. */
  optEditor(t = this.text) {
    return { m: t.m, baza: t.baza, z: this.vedere.z, c: t.c };
  }

  /**
   * Deschide editorul. `o`: { wx, wy, model, m, c, lat, ind, aliniere, id,
   * latFixa (celulă), tabel, celula, laLive(model), laGata(model, pastreaza, t) }.
   */
  deschideEditorul(o) {
    this.inchideTextul(true);
    const ta = document.createElement("div");
    ta.className = "ta-text";
    ta.contentEditable = "true";
    ta.spellcheck = false;
    const baza = marimeaMica(o.model, o.m);
    ta.innerHTML = inEditor(o.model, { m: o.m, baza });
    this.gazda.append(ta);
    const t = {
      ta, margine: null, ghid: null, wx: o.wx, wy: o.wy, m: o.m, baza, c: o.c, lat: o.lat || null, ind: o.ind || null,
      aliniere: o.aliniere || "l", latFixa: !!o.latFixa, laGata: o.laGata, laLive: o.laLive, tabel: o.tabel || null,
      celula: o.celula || null, id: o.id, sel: null, compun: false, asteapta: null,
      ist: { inapoi: [], inainte: [], cur: null, fel: "", cand: 0 },
    };
    if (!o.latFixa) {
      /* Marginea textului: o tragi, iar textul se reașază pe loc (previzualizare);
         dublu-clic pe ea o scoate (rândul merge cât e scris). */
      t.margine = document.createElement("div");
      t.margine.className = "ta-margine";
      t.margine.title = "Trage ca să alegi până unde merge rândul; dublu-clic: fără margine";
      t.margine.dataset.pastreazaTextul = "";
      t.ghid = document.createElement("div");
      t.ghid.className = "ta-ghid";
      this.gazda.append(t.ghid, t.margine);
      t.margine.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        t.margine.setPointerCapture(e.pointerId);
        const muta = (ev) => {
          const r = this.gazda.getBoundingClientRect();
          const wx = this.vedere.x + (ev.clientX - r.left) / this.vedere.z;
          t.lat = Math.max(t.m * 2, prinde(wx - t.wx));
          t.trimiteLive();
        };
        const gata = () => {
          t.margine.removeEventListener("pointermove", muta); t.margine.removeEventListener("pointerup", gata);
          ta.focus();
          this.pasInEditor("margine");
        };
        t.margine.addEventListener("pointermove", muta);
        t.margine.addEventListener("pointerup", gata);
      });
      t.margine.addEventListener("dblclick", () => { t.lat = null; t.trimiteLive(); ta.focus(); this.pasInEditor("margine"); });
    }
    /* Cât e deschisă caseta, modelul ține și rândurile goale de la coadă:
       cursorul poate sta pe ele, iar pozițiile selecției le numără. Ce pleacă
       la elevi și ce se salvează e fără ele (`modelDinParagrafe`, `dinEditor`). */
    t.model = () => dinParagrafe(paragrafeleDinEditor(ta, this.optEditor(t)));
    /* Așază paragrafele (marcajele, intrările), pune caseta la locul ei și
       trimite textul în lucru la elevi. */
    t.trimiteLive = () => {
      const opt = this.optEditor(t);
      const ps = paragrafeleDinEditor(ta, opt);
      const model = modelDinParagrafe(ps);
      const as = aseaza(this.ctx, model, { m: t.m, lat: t.lat, ind: t.ind, aliniere: t.aliniere });
      t.M1 = as.linii[0]?.M || t.baza;   // cea mai mare literă de pe primul rând
      refaParagrafele(ta, { ...opt, ctx: this.ctx, ps, as, ind: t.ind, aliniere: t.aliniere });
      this.pozitioneazaEditorul();
      t.laLive?.(model);
    };
    this.text = t;
    ta.addEventListener("beforeinput", (e) => {
      /* „Anulează" din meniul browserului ori de pe tastatura de pe ecran. */
      if (e.inputType === "historyUndo") { e.preventDefault(); this.inapoiInEditor(); }
      else if (e.inputType === "historyRedo") { e.preventDefault(); this.inainteInEditor(); }
    });
    /* Cât se compune o literă (tastaturi cu sugestii, accente moarte), caseta nu se atinge. */
    ta.addEventListener("compositionstart", () => { t.compun = true; });
    ta.addEventListener("compositionend", () => { t.compun = false; this.dupaIntrare({ inputType: "insertText", data: "" }); });
    ta.addEventListener("input", (e) => { if (!t.compun) this.dupaIntrare(e); });
    ta.addEventListener("keydown", (e) => this.tastaInEditor(e));
    /* Lipit în text: doar literele, fără formatarea de unde vin. */
    ta.addEventListener("paste", (e) => {
      e.stopPropagation();
      e.preventDefault();
      /* Rândurile făcute de lipit sunt copii ale celui în care lipești: se ține
         minte care e, ca „lista de la capăt" să nu ajungă pe fiecare (vezi `dupaIntrare`). */
      const aici = undeECursorul(ta);
      const pars = [...ta.children];
      t.lipit = aici ? { k: pars.indexOf(aici.d), n0: pars.length } : null;
      document.execCommand("insertText", false, e.clipboardData?.getData("text/plain") || "");
      t.lipit = null;
    });
    ta.addEventListener("blur", () => setTimeout(() => {
      if (this.text?.ta !== ta) return;
      const a = document.activeElement;
      if (a === ta || a?.closest?.("[data-pastreaza-textul]")) return;
      this.inchideTextul(true);
    }, 0));
    this.cere();
    t.trimiteLive();
    t.ist.cur = this.stareaEditorului();
    /* Cursorul intră pe loc în casetă (la Tab dintr-o celulă în alta, prima
       literă tastată repede n-are voie să se piardă), și încă o dată după ce
       browserul și-a terminat apăsarea de pe planșă, care altfel i-l ia. */
    ta.focus({ preventScroll: true });
    puneSelectia(ta, String(o.model?.s || "").length);
    setTimeout(() => {
      if (this.text !== t) return;
      ta.focus();
      /* Cursorul la capătul textului, nu la început. */
      const lung = dinEditor(ta, this.optEditor(t)).s.length;
      puneSelectia(ta, lung);
      t.sel = { a: lung, b: lung, intors: false };
      if (t.ist.cur) t.ist.cur.sel = t.sel;
      this.o.laFormat?.();
    }, 0);
    this.o.laSchimbare?.();
  }

  /* ---------- istoricul casetei (Ctrl+Z, Ctrl+Y) ---------- */

  /** Starea casetei deschise: textul, selecția, lățimea, intrarea, culoarea, mărimea. */
  stareaEditorului() {
    const t = this.text;
    return { model: t.model(), sel: selectiaIn(t.ta) || t.sel || null, lat: t.lat, ind: t.ind, c: t.c, m: t.m };
  }
  /**
   * S-a schimbat ceva în casetă: pasul se ține minte. Tastatul se strânge pe
   * cuvinte (literele la un loc, spațiile la un loc, ștersul la un loc), cât nu
   * trece o secundă și jumătate între apăsări; restul, câte un pas fiecare.
   */
  pasInEditor(fel) {
    const t = this.text;
    if (!t?.ist.cur) return;
    const i = t.ist;
    const noua = this.stareaEditorului();
    const v = i.cur;
    if (noua.lat === v.lat && noua.ind === v.ind && noua.c === v.c && noua.m === v.m
      && JSON.stringify(noua.model) === JSON.stringify(v.model)) { v.sel = noua.sel || v.sel; return; }
    const acum = Date.now();
    const lipit = fel === i.fel && ["tastat", "spatiu", "sters", "glisor"].includes(fel) && acum - i.cand < 1500;
    const goale = !i.inapoi.length || i.inainte.length > 0;
    if (!lipit) { i.inapoi.push(v); if (i.inapoi.length > 200) i.inapoi.shift(); }
    i.inainte = [];
    i.cur = noua; i.fel = fel; i.cand = acum;
    if (goale) this.o.laSchimbare?.();   // butoanele ↶ ↷ se aprind ori se sting
  }
  /** Pune în casetă o stare ținută minte. */
  puneStarea(s) {
    const t = this.text;
    t.lat = s.lat; t.ind = s.ind; t.c = s.c; t.m = s.m;
    this.rescrieEditorul(s.model, s.sel);
    t.trimiteLive();
    this.o.laSchimbare?.();
    this.o.laFormat?.();
  }
  inapoiInEditor() {
    const i = this.text?.ist;
    if (!i?.inapoi.length) return false;
    i.inainte.push(i.cur);
    i.cur = i.inapoi.pop();
    i.fel = "";
    this.puneStarea(i.cur);
    return true;
  }
  inainteInEditor() {
    const i = this.text?.ist;
    if (!i?.inainte.length) return false;
    i.inapoi.push(i.cur);
    i.cur = i.inainte.pop();
    i.fel = "";
    this.puneStarea(i.cur);
    return true;
  }
  /** Se poate da înapoi / înainte? În casetă, pașii ei; altfel, ai planșei. */
  get poateInapoi() { return this.text ? this.text.ist.inapoi.length > 0 : this.inapoi.length > 0; }
  get poateInainte() { return this.text ? this.text.ist.inainte.length > 0 : this.inainte.length > 0; }

  /**
   * Scrie din nou caseta din model, curat, cu selecția la loc. `asteptare`
   * ({ poz, f, m, c, h }): fără selecție, formatul ales așteaptă la cursor.
   */
  rescrieEditorul(model, sel = null, asteptare = null) {
    const t = this.text;
    const mic = marimeaMica(model, t.m);
    t.baza = asteptare?.m ? Math.min(mic, asteptare.m) : mic;
    t.ta.innerHTML = asteptare
      ? inEditorCuAsteptare(model, asteptare.poz, asteptare, { m: t.m, baza: t.baza })
      : inEditor(model, { m: t.m, baza: t.baza });
    t.asteapta = asteptare;
    this.pozitioneazaEditorul();
    t.ta.focus({ preventScroll: true });
    if (asteptare) cursorInAsteptare(t.ta);
    else if (sel) puneSelectia(t.ta, sel.a, sel.b, sel.intors);
    else puneSelectia(t.ta, model.s.length);
    t.sel = selectiaIn(t.ta) || sel || t.sel;
  }

  /** După orice apăsare care a schimbat textul. */
  dupaIntrare(e) {
    const t = this.text;
    if (!t) return;
    if (!curataAsteptarea(t.ta)) t.asteapta = null;
    else if (t.asteapta) { const unde = selectiaIn(t.ta); if (unde) t.asteapta.poz = unde.a; }
    /* Ce a pus browserul de capul lui (stiluri la lipirea a două paragrafe) ori
       o literă de bază rămasă alta se scriu la loc, curat, din model. */
    const model = t.model();
    if (!t.asteapta && (areStrain(t.ta) || marimeaMica(model, t.m) !== t.baza)) this.rescrieEditorul(model, selectiaIn(t.ta));
    const tip = e.inputType || "";
    const fel = tip === "insertText" ? (/^\s+$/.test(e.data || "") ? "spatiu" : "tastat")
      : /^delete/.test(tip) ? "sters" : tip === "insertParagraph" ? "paragraf" : /^format/.test(tip) ? "format" : "alt";
    /* Paragraful nou, făcut de Enter, e o copie a celui de deasupra: „de la
       capăt" rămâne doar pe cel dintâi. */
    if (tip === "insertParagraph") { const nou = undeECursorul(t.ta); if (nou) delete nou.d.dataset.d; }
    if (t.lipit && t.lipit.k >= 0) {
      const pars = [...t.ta.children];
      for (let k = t.lipit.k + 1; k <= t.lipit.k + (pars.length - t.lipit.n0) && k < pars.length; k++) delete pars[k].dataset.d;
    }
    this.pasInEditor(fel);
    /* Lista se pune singură, ca în Word: „1. ", „a) ", „- " la început de
       paragraf. E pasul ei: un Ctrl+Z o desface și rămâne ce ai tastat. */
    if (tip === "insertText" && e.data === " ") {
      const u = undeECursorul(t.ta);
      if (u && !u.d.dataset.l) {
        const l = autoLista(u.inainte);
        if (l && listaDinTaste(u.d, l)) {
          taieInceputul(u.d, u.inainte.length);
          t.sel = selectiaIn(t.ta) || t.sel;
          this.pasInEditor("lista");
        }
      }
    }
    t.trimiteLive();
    this.o.laFormat?.();
  }
  /** O schimbare făcută din bară ori din taste pe paragrafele casetei. */
  schimbatInEditor(fel = "format") {
    const t = this.text;
    if (!t) return;
    t.trimiteLive();
    this.pasInEditor(fel);
    this.o.laFormat?.();
  }

  tastaInEditor(e) {
    const t = this.text;
    if (!t) return;
    e.stopPropagation();
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key;
    const u = undeECursorul(t.ta);
    /* Escape închide caseta și păstrează ce ai scris (greșelile se dau înapoi cu Ctrl+Z). */
    if (k === "Escape") { this.inchideTextul(true); return; }
    if (ctrl && !e.altKey && /^[zy]$/i.test(k)) {
      e.preventDefault();
      if (/^y$/i.test(k) || e.shiftKey) this.inainteInEditor(); else this.inapoiInEditor();
      return;
    }
    /* Mărimea literei, ca în Word: Ctrl+Shift+> și Ctrl+Shift+< (pe mărimile din
       listă), Ctrl+] și Ctrl+[ (din unu în unu). După tastă, nu după literă:
       pe tastatura românească, acolo stau alte semne. */
    if (ctrl && !e.altKey && e.shiftKey && (e.code === "Period" || e.code === "Comma")) {
      e.preventDefault();
      const cu = e.code === "Period" ? 1 : -1;
      this.marimeaTextului((m) => marimeaVecina(m, cu));
      return;
    }
    if (ctrl && !e.altKey && !e.shiftKey && (e.code === "BracketRight" || e.code === "BracketLeft")) {
      e.preventDefault();
      const cu = e.code === "BracketRight" ? 1 : -1;
      this.marimeaTextului((m) => m + cu);
      return;
    }
    if (k === "Enter" && ctrl) { e.preventDefault(); this.inchideTextul(true); return; }
    if (k === "Enter" && e.altKey && !t.tabel) {
      /* Alt+Enter: textul se închide și se deschide unul nou chiar dedesubt. */
      e.preventDefault();
      const x = t.wx;
      this.inchideTextul(true);
      const el = this.el.find((y) => y.id === t.id);
      const y = el ? prinde(el.y + el.h + el.m * 0.25) : prinde(t.wy + t.m * RAND * 1.5);
      this.deschideTextul(x, y, null);
      return;
    }
    if (k === "Enter" && u && u.d.dataset.l && !u.d.textContent.replace(/​/g, "").trim()) {
      /* Enter pe un rând gol de listă, ca în Word: iese un nivel mai afară, iar
         de pe primul nivel lista se oprește. */
      e.preventDefault();
      if (Number(u.d.dataset.n) > 0) schimbaNivelul([u.d], -1);
      else { delete u.d.dataset.l; delete u.d.dataset.f; delete u.d.dataset.d; }
      this.schimbatInEditor();
      return;
    }
    if (k === "Enter" && e.shiftKey) { e.preventDefault(); document.execCommand("insertParagraph"); return; }
    if (k === "Backspace" && u && u.inainte === "" && (u.d.dataset.l || u.d.dataset.n || u.d.dataset.i)) {
      e.preventDefault();
      if (u.d.dataset.i && !u.d.dataset.l) delete u.d.dataset.i;
      else if (u.d.dataset.l) { delete u.d.dataset.l; delete u.d.dataset.f; delete u.d.dataset.d; } else schimbaNivelul([u.d], -1);
      this.schimbatInEditor();
      return;
    }
    if (k === "Tab") {
      e.preventDefault();
      const pars = paragrafeleSelectate(t.ta);
      /* În tabel, Tab pe un paragraf care nu e în listă trece la celula vecină. */
      if (t.tabel && !pars.some((d) => d.dataset.l)) { this.celulaVecina(e.shiftKey ? -1 : 1); return; }
      /* TAB PE UN PARAGRAF OBIȘNUIT FACE ALINEAT: intră doar primul rând (cerut
         de Marius pe 25 noiembrie 2026; înainte intra tot paragraful). Shift+Tab
         îl scoate. La liste, Tab schimbă nivelul, ca până acum. */
      const liste = pars.filter((d) => d.dataset.l);
      for (const d of pars) {
        if (d.dataset.l) continue;
        if (!e.shiftKey) d.dataset.i = "1";
        else if (d.dataset.i) delete d.dataset.i;
        else if (Number(d.dataset.n) > 0) schimbaNivelul([d], -1);
      }
      if (liste.length) schimbaNivelul(liste, e.shiftKey ? -1 : 1);
      this.schimbatInEditor();
      return;
    }
    if (ctrl && !e.shiftKey && /^[lerj]$/i.test(k)) {
      e.preventDefault();
      this.aliniazaText({ l: "l", e: "c", r: "r", j: "j" }[k.toLowerCase()]);
      return;
    }
    if (ctrl && e.shiftKey && /^l$/i.test(k)) { e.preventDefault(); this.puneListaText("b", "•"); }
  }

  /* ---------- formatul pe cuvinte: mărimea, culoarea, markerul ---------- */

  /** Dă cursorul înapoi casetei deschise, acolo unde era (după ce ai umblat
   *  pe bara de unelte); formatul care aștepta la cursor rămâne. */
  inapoiInCaseta() {
    const t = this.text;
    if (!t) return;
    const sel = t.sel;
    t.ta.focus({ preventScroll: true });
    if (t.asteapta && cursorInAsteptare(t.ta)) return;
    if (sel) puneSelectia(t.ta, sel.a, sel.b, sel.intors);
  }
  /** Selecția casetei deschise; cea ținută minte, cât ai mâna pe bara de unelte. */
  selectiaEditorului() {
    const t = this.text;
    return selectiaIn(t.ta) || t.sel || null;
  }
  /**
   * Un format pus în caseta deschisă. Cu ceva selectat: `pe(model, a, b)` →
   * model. Fără: `laCursor(formatul de acolo)` → formatul care așteaptă la
   * cursor. Într-o casetă goală, mărimea și culoarea sunt ale casetei înseși.
   */
  formatInEditor(pe, laCursor) {
    const t = this.text;
    let model = t.model();
    const sel = this.selectiaEditorului() || { a: model.s.length, b: model.s.length };
    if (sel.b > sel.a) {
      model = pe(model, sel.a, sel.b);
      /* Mărimea casetei rămâne cea a celor mai multe litere (la celule, a tabelului). */
      if (!t.tabel) {
        const mB = marimeaDeBaza(model, t.m);
        /* Un text care începe cu rânduri goale își ține mărimea casetei: ele
           n-au litere care s-o poarte și s-ar fi lungit odată cu ea. */
        if (mB !== t.m && paragrafele(model)[0].bucati.length) { model = cuBaza(model, t.m, mB); t.m = mB; }
      }
      this.rescrieEditorul(model, sel);
    } else {
      const acum = t.asteapta && t.asteapta.poz === sel.a
        ? { f: t.asteapta.f || 0, m: t.asteapta.m ?? t.m, c: t.asteapta.c || null, h: t.asteapta.h || null }
        : formatulIn(model, sel.a, sel.a, t.m);
      const f = laCursor({ ...acum });
      const goala = !model.s.replace(/\n/g, "");
      if (goala && !t.tabel) {
        /* Caseta e goală: mărimea și culoarea alese sunt ale ei. */
        if (f.m && f.m !== t.m) t.m = f.m;
        if (f.c && f.c !== t.c) { t.c = f.c; }
        f.m = t.m; f.c = null;
      }
      const gol = !f.f && (f.m ?? t.m) === t.m && !f.c && !f.h;
      this.rescrieEditorul(model, sel, goala && gol ? null : { poz: sel.a, f: f.f || 0, m: f.m ?? t.m, c: f.c || null, h: f.h || null });
    }
    this.schimbatInEditor();
  }

  /**
   * Mărimea literei, ca în Word. `v`: mărimea ori `m => m` (mai mare, mai mică).
   * În casetă: pe ce e selectat ori pe ce scrii mai departe. Altfel: pe textele
   * ori pe celulele alese, întregi. Mărimea aleasă rămâne și pentru textele noi.
   */
  marimeaTextului(v) {
    const fn = typeof v === "function" ? (m) => marimeBuna(v(m)) : () => marimeBuna(v);
    if (this.text) {
      const t = this.text;
      this.formatInEditor((mo, a, b) => cuMarime(mo, a, b, t.m, fn), (f) => ({ ...f, m: fn(f.m ?? t.m) }));
      const f = this.formatulAles();
      if (f.m) this.marimeText = f.m;
      return;
    }
    const tb = this.tabelulAles();
    let tinta = false;
    if (tb) {
      tinta = true;
      const z = this.zonaAleasa(tb);
      const tot = z.i0 === 0 && z.j0 === 0 && z.i1 === tb.cel.length - 1 && z.j1 === tb.col.length - 1;
      this.peTabel((n) => {
        for (let i = z.i0; i <= z.i1; i++) for (let j = z.j0; j <= z.j1; j++) {
          if (celOk(n, i, j)) n.cel[i][j] = cuMarime(n.cel[i][j], 0, String(n.cel[i][j].s || "").length, n.m, fn);
        }
        if (tot) {
          /* Tot tabelul la aceeași mărime: e mărimea tabelului, nu a fiecărui cuvânt. */
          const marimi = new Set();
          for (const rand of n.cel) for (const cel of rand) if (cel && !cel.x && cel.s) for (const { bucati } of paragrafele(cel)) for (const b of bucati) marimi.add(b.m ?? n.m);
          const una = marimi.size === 1 ? [...marimi][0] : marimi.size === 0 ? fn(n.m) : null;
          if (una && una !== n.m) {
            n.cel = n.cel.map((rand) => rand.map((cel) => (cel && !cel.x ? cuBaza(cel, n.m, una) : cel)));
            n.m = una;
          }
        }
        return n;
      });
    } else {
      const texte = this.el.filter((e) => this.selectate.has(e.id) && e.t === "x");
      if (texte.length) {
        tinta = true;
        this.fa({ fel: "schimba", el: texte.map((e) => {
          let n = cuMarime(copie(e), 0, e.s.length, e.m, fn);
          const mB = marimeaDeBaza(n, e.m);
          if (mB !== e.m && paragrafele(n)[0].bucati.length) { n = cuBaza(n, e.m, mB); n.m = mB; }
          return this.masoara(n);
        }) });
      }
    }
    /* Mărimea rămâne și pentru textele noi. Fără nimic ales, asta e tot ce
       face: alegi mărimea întâi, apoi scrii. */
    const f = tinta ? this.formatulAles() : null;
    this.marimeText = (f && f.m) || fn(this.marimeText);
    this.o.laFormat?.();
  }

  /** Culoarea textului deschis: pe ce e selectat ori pe ce scrii mai departe
   *  (într-o casetă goală, a casetei). */
  culoareText(c) {
    const t = this.text;
    if (!t) return;
    this.formatInEditor((mo, a, b) => cuCuloare(mo, a, b, c, t.c), (f) => ({ ...f, c: c === t.c ? null : c }));
  }

  /** Markerul (evidențierea) pe cuvinte; `null` îl scoate. În casetă: pe ce e
   *  selectat ori pe ce scrii mai departe. Altfel: pe textele ori celulele alese. */
  evidentiaza(h) {
    if (this.text) { this.formatInEditor((mo, a, b) => cuEvidentiere(mo, a, b, h), (f) => ({ ...f, h: h || null })); return; }
    this.peModele(() => ({}), (mo) => cuEvidentiere(mo, 0, String(mo.s || "").length, h));
  }

  /**
   * Formatul de arătat pe bară: { m, c, h, f }, cu `undefined` unde e amestecat.
   * Al selecției din casetă (ori al formatului care așteaptă la cursor), al
   * textelor ori celulelor alese, ori cel cu care pornesc textele noi.
   */
  formatulAles() {
    const t = this.text;
    if (t) {
      const s = this.selectiaEditorului() || { a: 0, b: 0 };
      if (t.asteapta && s.a === s.b && s.a === t.asteapta.poz) return { f: t.asteapta.f || 0, m: t.asteapta.m ?? t.m, c: t.asteapta.c || null, h: t.asteapta.h || null };
      return formatulIn(t.model(), s.a, s.b, t.m);
    }
    const peste = (modele) => {
      const f = modele.filter((x) => x.model.s).map((x) => formatulIn(x.model, 0, x.model.s.length, x.m));
      if (!f.length) return null;
      const la = (k) => (f.every((x) => x[k] === f[0][k]) ? f[0][k] : undefined);
      return { m: la("m"), c: la("c"), h: la("h"), f: f.reduce((x, y) => x & y.f, 7) };
    };
    const tb = this.tabelulAles();
    if (tb) return peste(this.celuleleAlese(tb).map(([i, j]) => ({ model: tb.cel[i][j], m: tb.m }))) || { m: tb.m, c: null, h: null, f: 0 };
    const texte = this.el.filter((e) => this.selectate.has(e.id) && e.t === "x");
    if (texte.length) return peste(texte.map((e) => ({ model: e, m: e.m }))) || { m: this.marimeText, c: null, h: null, f: 0 };
    return { m: this.marimeText, c: null, h: null, f: 0 };
  }

  /** Pune editorul (și marginea) unde trebuie, după vedere. */
  pozitioneazaEditorul() {
    const t = this.text;
    if (!t) return;
    const { x, y, z } = this.vedere;
    const ta = t.ta;
    /* Mărirea planșei, pentru tot ce e scris în mărimi de literă (bucățile cu
       altă mărime, intrările listelor). */
    ta.style.setProperty("--z", String(z));
    /* Lățimea și litera întâi: înălțimea casetei se măsoară după ele. */
    Object.assign(ta.style, {
      fontSize: `${t.baza * z}px`, color: t.c, fontFamily: LITERA,
      width: t.lat ? `${t.lat * z}px` : "", whiteSpace: t.lat ? "pre-wrap" : "pre",
    });
    /* În celulă, caseta stă unde va sta textul: sus, la mijloc ori jos. */
    if (t.tabel && t.celula) {
      const e = this.el.find((el) => el.id === t.tabel.id);
      const L = e && this.tabelul(e);
      const k = L?.celule.find((q) => q.i === t.celula.i && q.j === t.celula.j);
      if (k) {
        const h = (ta.offsetHeight || t.m * RAND * z) / z;
        const av = k.cel.av || "m";
        t.wy = e.y + k.y + (av === "s" ? L.pad : av === "j" ? Math.max(L.pad, k.h - L.pad - h) : Math.max(L.pad, (k.h - h) / 2));
        t.wx = e.x + k.x + L.pad;
      }
    }
    /* Caseta stă exact peste locul în care se desenează textul pe planșă: se
       ridică cu cât pune browserul rândul mai jos decât pânza și se dă înapoi
       cu chenarul ei, ca textul să nu sară la deschidere și la închidere. */
    const salt = saltulEditorului(this.ctx, t.M1 || t.baza);
    Object.assign(ta.style, { left: `${(t.wx - x) * z - 1}px`, top: `${(t.wy - salt - y) * z - 1}px` });
    if (t.margine) {
      const r = ta.getBoundingClientRect(), g = this.gazda.getBoundingClientRect();
      const lx = (t.lat ? (t.wx + t.lat - x) * z : r.right - g.left + 6);
      Object.assign(t.margine.style, { left: `${lx - 5}px`, top: `${r.top - g.top}px`, height: `${Math.max(r.height, t.m * z)}px` });
      Object.assign(t.ghid.style, { left: `${lx}px`, display: t.lat ? "" : "none" });
    }
  }

  /** Bold / italic / subliniat: în editor, pe ce e selectat în el; altfel, pe
   *  textele ori celulele alese, întregi. */
  formateaza(semn) {
    if (this.text) {
      this.text.ta.focus();
      document.execCommand(semn === BOLD ? "bold" : semn === ITALIC ? "italic" : "underline");
      return;   // schimbarea vine pe `input`, de unde se ține minte și pleacă la elevi
    }
    this.peModele((m) => ({ toate: bucatile(m).every(([n, f]) => !n || f & semn) }), (m, { toate }) => {
      const r = strange(bucatile(m).map(([n, f, a]) => [n, toate ? f & ~semn : f | semn, a]));
      const o = { ...m };
      if (r) o.r = r; else delete o.r;
      return o;
    });
  }
  /** Lista: în editor, pe paragrafele alese; altfel pe tot textul ales. */
  puneListaText(l, f) {
    if (this.text) {
      this.text.ta.focus();
      puneLista(paragrafeleSelectate(this.text.ta), l, f);
      this.schimbatInEditor();
      return;
    }
    this.peModele((m) => ({ toate: paragrafele(m).every((x) => x.p?.l === l && x.p?.f === f) }),
      (m, { toate }) => cuParagrafe(m, (p) => { if (toate || !l) { delete p.l; delete p.f; delete p.d; } else { p.l = l; p.f = f; } }));
  }
  /** Nivelul (Tab, Shift+Tab); lista își ia semnul nivelului nou, ca în Word. */
  nivelText(cu) {
    if (this.text) { this.text.ta.focus(); schimbaNivelul(paragrafeleSelectate(this.text.ta), cu); this.schimbatInEditor(); return; }
    this.peModele(() => ({}), (m) => {
      const ps = paragrafele(m).map((x) => (x.p ? { ...x.p } : {}));
      mutaNivelul(ps, ps.map((_, k) => k), cu);
      const o = { ...m };
      if (ps.some((p) => Object.keys(p).length)) o.p = ps.map((p) => (Object.keys(p).length ? p : null)); else delete o.p;
      return o;
    });
  }
  aliniazaText(a) {
    if (this.text) { this.text.ta.focus(); aliniaza(paragrafeleSelectate(this.text.ta), a); this.schimbatInEditor(); return; }
    /* Celulele alese: alinierea lor (ah), ca s-o aibă și paragrafele noi. */
    const tb = this.tabelulAles();
    if (tb) { this.peCelule((c) => { const o = cuParagrafe(c, (p) => { delete p.a; }); if (a === "l") delete o.ah; else o.ah = a; return o; }); return; }
    this.peModele(() => ({}), (m) => cuParagrafe(m, (p) => { if (a === "l") delete p.a; else p.a = a; }));
  }
  /** Cât intră un nivel de listă (cu previzualizare): pe textul deschis ori ales. */
  puneIndentarea(px) {
    this.indent = px;
    if (this.text && !this.text.tabel) { this.text.ind = px; this.text.trimiteLive(); this.pasInEditor("glisor"); return; }
    const noi = this.el.filter((e) => this.selectate.has(e.id) && e.t === "x").map((e) => this.masoara({ ...copie(e), ind: px }));
    if (noi.length) this.fa({ fel: "schimba", el: noi });
  }

  /** Aplică o schimbare pe textul ales: textele selectate, ori celulele alese
   *  (ori toate) ale tabelului ales. `pregatire(model)` → { toate }. */
  peModele(pregatire, schimba) {
    const tb = this.tabelulAles();
    if (tb) {
      const cel = this.celuleleAlese(tb);
      const st = { toate: cel.every(([i, j]) => pregatire(tb.cel[i][j]).toate) };
      this.peCelule((c) => schimba(c, st));
      return;
    }
    const texte = this.el.filter((e) => this.selectate.has(e.id) && e.t === "x");
    if (!texte.length) return;
    const st = { toate: texte.every((e) => pregatire(e).toate) };
    this.fa({ fel: "schimba", el: texte.map((e) => this.masoara(schimba(copie(e), st))) });
  }

  /* =========================================================
     CASETELE DE TEXT
     ========================================================= */
  deschideTextul(wx, wy, vechi = null) {
    const id = vechi?.id || idNou();
    const m = vechi ? vechi.m : this.marimeText;
    const c = vechi ? vechi.c : this.culoare;
    const element = (model, t) => this.masoara({
      id, t: "x", c: t.c || c, m: t.m || m, x: r1(t.wx), y: r1(t.wy), s: model.s, ...(model.r ? { r: model.r } : {}), ...(model.p ? { p: model.p } : {}),
      ...(t.lat ? { lat: r1(t.lat) } : {}), ...(t.ind ? { ind: r1(t.ind) } : {}),
    });
    this.deschideEditorul({
      wx, wy, model: vechi || { s: "" }, m, c, lat: vechi?.lat || null, ind: vechi ? vechi.ind || null : this.indent, id,
      laLive: (model) => this.o.laTrasare?.(model.s ? element(model, this.text) : null),
      laGata: (model, pastreaza, t) => {
        if (vechi) this.ascunse.delete(vechi.id);
        if (!pastreaza) return;
        const el = model.s ? element(model, t) : null;
        const schimbat = (a, b) => ["s", "r", "p", "lat", "ind", "m", "c"].some((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));
        if (vechi && !el) this.fa({ fel: "scoate", id: [vechi.id] });
        else if (vechi && schimbat(el, vechi)) this.fa({ fel: "schimba", el: [el] });
        else if (!vechi && el) this.fa({ fel: "pune", el: [el] });
      },
    });
    if (vechi) { this.ascunse.add(vechi.id); this.cere(); }
  }

  inchideTextul(pastreaza) {
    const t = this.text;
    if (!t) return;
    this.text = null;
    curataAsteptarea(t.ta);
    const model = dinEditor(t.ta, this.optEditor(t));
    t.ta.remove();
    t.margine?.remove();
    t.ghid?.remove();
    t.laGata?.(model, pastreaza, t);
    /* Textul în lucru pleacă de pe ecranele elevilor abia după ce a ajuns cel bun. */
    this.o.laTrasare?.(null);
    this.cere();
    this.o.laSchimbare?.();
  }

  /** Un text lipit (Ctrl+V) ajunge la mijlocul ecranului. */
  lipesteText(s) {
    const z = this.zonaVazuta();
    const el = this.masoara({ id: idNou(), t: "x", c: this.culoare, m: this.marimeText, x: prinde(z.x + z.w / 2 - 100), y: prinde(z.y + z.h / 2 - 20), s: s.slice(0, 4000) });
    this.fa({ fel: "pune", el: [el] });
  }

  /* =========================================================
     TABELELE
     ========================================================= */
  /** Un tabel nou, la mijlocul ecranului, pe grilă. */
  puneTabel(nr, nc) {
    const z = this.zonaVazuta();
    const m = this.marimeText;
    const e = this.masoara(tabelNou(nr, nc, { x: 0, y: 0, m, c: this.culoare }));
    e.x = prinde(z.x + Math.max(20, (z.w - e.w) / 2));
    e.y = prinde(z.y + Math.max(20, (z.h - e.h) / 3));
    this.fa({ fel: "pune", el: [e] });
    this.setUnealta("selectie");
    this.selectate = new Set([e.id]);
    this.celule = null;
    this.cere();
    this.o.laSchimbare?.();
  }
  /** Tabelul la care se lucrează: cel ales (singur) ori cel cu celula deschisă. */
  tabelulAles() {
    if (this.text?.tabel) return this.el.find((e) => e.id === this.text.tabel.id) || null;
    const u = this.singurul();
    return u?.t === "t" ? u : null;
  }
  /** Zona de celule la care se aplică o schimbare: cele alese, ori cea deschisă,
   *  ori tot tabelul. */
  zonaAleasa(e) {
    if (this.celule?.id === e.id) return this.celule;
    if (this.text?.tabel?.id === e.id) return { i0: this.text.celula.i, j0: this.text.celula.j, i1: this.text.celula.i, j1: this.text.celula.j };
    return { i0: 0, j0: 0, i1: e.cel.length - 1, j1: e.col.length - 1 };
  }
  celuleleAlese(e) {
    const z = this.zonaAleasa(e);
    const o = [];
    for (let i = z.i0; i <= z.i1; i++) for (let j = z.j0; j <= z.j1; j++) if (celOk(e, i, j)) o.push([i, j]);
    return o;
  }
  /** Schimbă celulele alese ale tabelului ales cu `fn(celulă) → celulă`. */
  peCelule(fn) {
    const e = this.tabelulAles();
    if (!e) return;
    const z = this.zonaAleasa(e);
    if (this.text?.tabel) this.inchideTextul(true);
    const n = copie(this.el.find((x) => x.id === e.id));
    for (let i = z.i0; i <= z.i1; i++) for (let j = z.j0; j <= z.j1; j++) if (celOk(n, i, j)) n.cel[i][j] = fn(copie(n.cel[i][j]));
    this.fa({ fel: "schimba", el: [this.masoara(n)] });
  }
  /** O schimbare a întregului tabel ales: `fn(copie) → copie`. */
  peTabel(fn) {
    const e = this.tabelulAles();
    if (!e) return;
    if (this.text?.tabel) this.inchideTextul(true);
    const n = fn(copie(this.el.find((x) => x.id === e.id)));
    if (n) this.fa({ fel: "schimba", el: [this.masoara(n)] });
  }

  /** Comenzile tabelului, din panou. */
  tabel(fel, v) {
    const e = this.tabelulAles();
    if (!e) return;
    const z = this.zonaAleasa(e);
    if (fel === "orizontal") this.aliniazaText(v);
    else if (fel === "vertical") this.peCelule((c) => { if (v === "m") delete c.av; else c.av = v; return c; });
    else if (fel === "fundal") this.peCelule((c) => { if (v) c.bg = v; else delete c.bg; return c; });
    else if (fel === "chenar") this.peTabel((n) => { n.ch = { ...n.ch, f: v }; return n; });
    else if (fel === "chenar-culoare") this.peTabel((n) => { n.ch = { ...n.ch, c: v }; return n; });
    else if (fel === "chenar-grosime") this.peTabel((n) => { n.ch = { ...n.ch, g: v }; return n; });
    else if (fel === "rand") this.peTabel((n) => adaugaRand(n, v === "sus" ? z.i0 : z.i1 + 1));
    else if (fel === "coloana") this.peTabel((n) => adaugaColoana(n, v === "stanga" ? z.j0 : z.j1 + 1));
    else if (fel === "sterge-rand") {
      if (e.cel.length <= z.i1 - z.i0 + 1) { this.fa({ fel: "scoate", id: [e.id] }); return; }
      this.peTabel((n) => { for (let i = z.i1; i >= z.i0; i--) stergeRand(n, i); return n; });
      this.celule = null;
    } else if (fel === "sterge-coloana") {
      if (e.col.length <= z.j1 - z.j0 + 1) { this.fa({ fel: "scoate", id: [e.id] }); return; }
      this.peTabel((n) => { for (let j = z.j1; j >= z.j0; j--) stergeColoana(n, j); return n; });
      this.celule = null;
    } else if (fel === "imbina") {
      if (z.i0 === z.i1 && z.j0 === z.j1) return;
      this.peTabel((n) => imbina(n, z));
      this.celule = { id: e.id, i0: z.i0, j0: z.j0, i1: z.i1, j1: z.j1 };
    } else if (fel === "desparte") {
      this.peTabel((n) => { for (let i = z.i0; i <= z.i1; i++) for (let j = z.j0; j <= z.j1; j++) desparte(n, i, j); return n; });
    } else if (fel === "sterge") this.fa({ fel: "scoate", id: [e.id] });
    this.cere();
    this.o.laSchimbare?.();
  }

  /** Deschide editorul într-o celulă a tabelului. */
  deschideCelula(e, i, j) {
    if (!celOk(e, i, j)) return;
    const L = this.tabelul(e);
    const k = L.celule.find((x) => x.i === i && x.j === j);
    if (!k) return;
    const cel = e.cel[i][j];
    const pad = L.pad;
    this.selectate = new Set([e.id]);
    this.celule = null;
    const tabelCu = (model) => {
      const cur = this.el.find((x) => x.id === e.id) || e;
      const n = copie(cur);
      const c = { ...n.cel[i][j], s: model.s };
      if (model.r) c.r = model.r; else delete c.r;
      if (model.p) c.p = model.p; else delete c.p;
      n.cel[i][j] = c;
      return this.masoara(n);
    };
    this.deschideEditorul({
      wx: e.x + k.x + pad, wy: e.y + k.y + pad, model: cel, m: e.m, c: e.c, lat: Math.max(e.m, k.w - 2 * pad),
      latFixa: true, aliniere: cel.ah || "l", tabel: { id: e.id }, celula: { i, j }, id: e.id,
      laLive: (model) => this.o.laTrasare?.(tabelCu(model)),
      laGata: (model, pastreaza) => {
        if (!pastreaza) return;
        const vechi = this.el.find((x) => x.id === e.id)?.cel?.[i]?.[j];
        if (!vechi) return;
        const schimbat = ["s", "r", "p"].some((x) => JSON.stringify(model[x] ?? (x === "s" ? "" : null)) !== JSON.stringify(vechi[x] ?? (x === "s" ? "" : null)));
        if (schimbat) this.fa({ fel: "schimba", el: [tabelCu(model)] });
      },
    });
  }
  /** Tab / Shift+Tab: celula următoare ori cea dinainte (la capăt, un rând nou). */
  celulaVecina(cu) {
    const t = this.text;
    if (!t?.tabel) return;
    const id = t.tabel.id;
    const { i, j } = t.celula;
    this.inchideTextul(true);
    let e = this.el.find((x) => x.id === id);
    if (!e) return;
    const nc = e.col.length, nr = e.cel.length;
    let k = i * nc + j;
    do { k += cu; } while (k >= 0 && k < nr * nc && !celOk(e, Math.floor(k / nc), k % nc));
    if (k >= nr * nc) {
      this.fa({ fel: "schimba", el: [this.masoara(adaugaRand(copie(e), nr))] });
      e = this.el.find((x) => x.id === id);
      k = nr * nc;
    }
    if (k < 0) return;
    this.deschideCelula(e, Math.floor(k / nc), k % nc);
  }

  /* ---------- imaginile și exportul ---------- */

  /** O imagine lipită ori aleasă: micșorată cât să nu încarce tabla. */
  async lipesteImagine(fisier) {
    const url = URL.createObjectURL(fisier);
    try {
      const img = await new Promise((da, nu) => { const i = new Image(); i.onload = () => da(i); i.onerror = nu; i.src = url; });
      const max = 1400;
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const x = c.getContext("2d");
      x.fillStyle = "#fff"; x.fillRect(0, 0, w, h);
      x.drawImage(img, 0, 0, w, h);
      let src = c.toDataURL("image/jpeg", 0.82);
      if (src.length > 180000) src = c.toDataURL("image/jpeg", 0.6);
      if (src.length > 180000) {
        const c2 = document.createElement("canvas");
        c2.width = Math.round(w * 0.6); c2.height = Math.round(h * 0.6);
        c2.getContext("2d").drawImage(c, 0, 0, c2.width, c2.height);
        src = c2.toDataURL("image/jpeg", 0.7);
      }
      const z = this.zonaVazuta();
      const fw = Math.min(w, z.w * 0.7), fh = fw * h / w;
      this.fa({ fel: "pune", el: [{ id: idNou(), t: "i", x: prinde(z.x + (z.w - fw) / 2), y: prinde(z.y + (z.h - fh) / 2), w: r1(fw), h: r1(fh), src }] });
    } finally { URL.revokeObjectURL(url); }
  }

  /** Pagina ca imagine PNG, cu tot desenul, pe fundalul ei. */
  imaginePng() {
    let b = null;
    for (const e of this.el) b = uneste(b, cutia(e));
    if (!b) b = this.zonaVazuta();
    b = { x: b.x - 30, y: b.y - 30, w: b.w + 60, h: b.h + 60 };
    const s = Math.min(2, 4000 / Math.max(b.w, b.h));
    const c = document.createElement("canvas");
    c.width = Math.round(b.w * s); c.height = Math.round(b.h * s);
    const veche = { ctx: this.ctx, vedere: this.vedere, W: this.W, H: this.H };
    this.ctx = c.getContext("2d");
    this.vedere = { x: b.x, y: b.y, z: s };
    this.W = c.width; this.H = c.height;
    this.pixel = 1;
    try { this.deseneaza(); } finally {
      this.pixel = 0;
      Object.assign(this, { ctx: veche.ctx, vedere: veche.vedere, W: veche.W, H: veche.H });
      this.cere();
    }
    return c.toDataURL("image/png");
  }
}

/* ---------- tabelele: rânduri, coloane, îmbinări ---------- */
/** Ancora celulei care acoperă (i, j). */
function ancora(n, i, j) {
  for (let a = 0; a <= i; a++) for (let b = 0; b <= j; b++) {
    const c = n.cel[a]?.[b];
    if (c && !c.x && a + (c.rs || 1) > i && b + (c.cs || 1) > j) return [a, b];
  }
  return [i, j];
}
function adaugaRand(n, la) {
  const nc = n.col.length;
  const rand = Array.from({ length: nc }, () => ({ s: "" }));
  if (la > 0 && la < n.cel.length) {
    for (let j = 0; j < nc; j++) {
      const [a, b] = ancora(n, la, j);
      if (a < la) {
        rand[j] = { s: "", x: 1 };
        if (b === j) n.cel[a][b].rs = (n.cel[a][b].rs || 1) + 1;
      }
    }
  }
  n.cel.splice(la, 0, rand);
  n.rh.splice(la, 0, n.rh[Math.min(la, n.rh.length - 1)] || n.m * 2);
  return n;
}
function adaugaColoana(n, la) {
  const nr = n.cel.length;
  const intre = la > 0 && la < n.col.length;
  const ancore = intre ? n.cel.map((_, i) => ancora(n, i, la)) : [];
  for (let i = 0; i < nr; i++) {
    let nou = { s: "" };
    if (intre) {
      const [a, b] = ancore[i];
      if (b < la) { nou = { s: "", x: 1 }; if (a === i) n.cel[a][b].cs = (n.cel[a][b].cs || 1) + 1; }
    }
    n.cel[i].splice(la, 0, nou);
  }
  n.col.splice(la, 0, n.col[Math.min(la, n.col.length - 1)] || n.m * 6);
  return n;
}
function stergeRand(n, k) {
  for (let j = 0; j < n.col.length; j++) {
    const [a, b] = ancora(n, k, j);
    if (b !== j) continue;
    const c = n.cel[a][b];
    if ((c.rs || 1) > 1) {
      if (a === k) n.cel[k + 1][j] = { ...c, rs: c.rs - 1 };
      else c.rs -= 1;
    }
  }
  n.cel.splice(k, 1);
  n.rh.splice(k, 1);
}
function stergeColoana(n, k) {
  for (let i = 0; i < n.cel.length; i++) {
    const [a, b] = ancora(n, i, k);
    if (a !== i) continue;
    const c = n.cel[a][b];
    if ((c.cs || 1) > 1) {
      if (b === k) n.cel[i][k + 1] = { ...c, cs: c.cs - 1 };
      else c.cs -= 1;
    }
  }
  for (const r of n.cel) r.splice(k, 1);
  n.col.splice(k, 1);
}
function imbina(n, z) {
  const texte = [];
  for (let i = z.i0; i <= z.i1; i++) for (let j = z.j0; j <= z.j1; j++) {
    const c = n.cel[i][j];
    if (c && !c.x && c.s) texte.push(c);
  }
  const prima = { ...n.cel[z.i0][z.j0] };
  /* Textele tuturor celulelor se pun unul sub altul, în ancoră. */
  if (texte.length > 1) {
    let s = "";
    const r = [], p = [];
    texte.forEach((c, k) => {
      if (k) { s += "\n"; r.push([1, 0]); }
      s += c.s;
      r.push(...bucatile(c));
      p.push(...paragrafele(c).map((x) => x.p));
    });
    prima.s = s;
    const rr = strange(r);
    if (rr) prima.r = rr; else delete prima.r;
    if (p.some(Boolean)) prima.p = p; else delete prima.p;
  } else if (texte.length === 1) Object.assign(prima, { s: texte[0].s, r: texte[0].r, p: texte[0].p });
  prima.rs = z.i1 - z.i0 + 1; prima.cs = z.j1 - z.j0 + 1;
  if (prima.rs === 1) delete prima.rs;
  if (prima.cs === 1) delete prima.cs;
  for (const k of ["r", "p"]) if (prima[k] == null) delete prima[k];
  for (let i = z.i0; i <= z.i1; i++) for (let j = z.j0; j <= z.j1; j++) n.cel[i][j] = { s: "", x: 1 };
  n.cel[z.i0][z.j0] = prima;
  return n;
}
function desparte(n, i, j) {
  const c = n.cel[i]?.[j];
  if (!c || c.x || ((c.rs || 1) === 1 && (c.cs || 1) === 1)) return;
  for (let a = i; a < i + (c.rs || 1); a++) for (let b = j; b < j + (c.cs || 1); b++) if (n.cel[a]?.[b]) n.cel[a][b] = { s: "" };
  delete c.rs; delete c.cs;
  n.cel[i][j] = c;
}

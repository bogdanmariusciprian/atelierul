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
//   { id, t: "x", c, m, x, y, s, w, h }                 text (m = mărimea literei)
//   { id, t: "i", x, y, w, h, src }                     imagine lipită
//
// OPERAȚIILE schimbă desenul și se pot da înapoi; tot ele pleacă pe canal:
//   { fel: "pune", el: [...], la?: [index, …] }   { fel: "scoate", id: [...] }
//   { fel: "schimba", el: [...] }                 { fel: "fundal", f }
// Fiecare operație aplicată întoarce opusa ei: așa se face Undo.
// Cuprins în română, nume în engleză.
// =========================================================

const r1 = (n) => Math.round(n * 10) / 10;
export const idNou = () => Math.random().toString(36).slice(2, 10);
const copie = (o) => JSON.parse(JSON.stringify(o));

export const FUNDALURI = ["alb", "patratele", "dictando", "puncte"];
const PAS_GRILA = 28;
const LITERA = '"Segoe UI", system-ui, sans-serif';

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
  if (e.t === "x" || e.t === "i") return { x: e.x, y: e.y, w: e.w || 0, h: e.h || 0 };
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
  if (e.t === "x" || e.t === "i") return true;
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
  else if (n.t === "x" || n.t === "i") { n.x = r1(n.x + dx); n.y = r1(n.y + dy); }
  else { n.x1 = r1(n.x1 + dx); n.x2 = r1(n.x2 + dx); n.y1 = r1(n.y1 + dy); n.y2 = r1(n.y2 + dy); }
  return n;
}

/** Elementul mărit de `s` ori, față de punctul (ox, oy). */
function marit(e, ox, oy, s) {
  const n = copie(e);
  const X = (x) => r1(ox + (x - ox) * s), Y = (y) => r1(oy + (y - oy) * s);
  if (n.t === "p") { for (let i = 0; i < n.pts.length; i += 2) { n.pts[i] = X(n.pts[i]); n.pts[i + 1] = Y(n.pts[i + 1]); } n.g = r1(Math.max(0.5, n.g * s)); }
  else if (n.t === "x") { n.x = X(n.x); n.y = Y(n.y); n.m = r1(Math.max(6, n.m * s)); n.w = r1(n.w * s); n.h = r1(n.h * s); }
  else if (n.t === "i") { n.x = X(n.x); n.y = Y(n.y); n.w = r1(n.w * s); n.h = r1(n.h * s); }
  else { n.x1 = X(n.x1); n.x2 = X(n.x2); n.y1 = Y(n.y1); n.y2 = Y(n.y2); n.g = r1(Math.max(0.5, n.g * s)); }
  return n;
}

export class Plansa {
  /**
   * @param {HTMLElement} gazda  locul planșei (se umple cu pânza)
   * @param {object} o
   * @param {boolean} o.poateScrie
   * @param {(op) => void} [o.laOperatie]       o operație făcută aici (de trimis, de salvat)
   * @param {(el|null) => void} [o.laTrasare]   desenul în curs (de trimis live)
   * @param {() => void} [o.laVedere]           s-a mișcat ori s-a mărit planșa
   * @param {() => void} [o.laManaMea]          omul a mișcat singur planșa
   * @param {() => void} [o.laMarime]           planșa și-a schimbat mărimea pe ecran
   * @param {() => void} [o.laSchimbare]        s-a schimbat ceva de arătat pe bară (undo, selecție)
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
    this.vedere = { x: 0, y: 0, z: 1 };
    this.unealta = "creion";
    this.culoare = "#1f2430";
    this.grosime = 3;
    this.marimeText = 28;
    this.inapoi = [];
    this.inainte = [];
    this.selectate = new Set();
    this.temp = null;          // desenul meu în curs
    this.strain = null;        // desenul în curs al profesorului (la cine privește)
    this.laser = null;
    this.ascunse = new Set();  // radiera în curs: elementele încă neșterse de-a binelea
    this.imagini = new Map();
    this.degete = new Map();
    this.spatiu = false;
    this.cerut = false;
    this.text = null;          // câmpul de text deschis

    this.marime();
    new ResizeObserver(() => { this.marime(); this.o.laMarime?.(); this.o.laVedere?.(); }).observe(gazda);
    this.leaga();
  }

  set poateScrie(v) { this.o.poateScrie = v; this.cursor(); }
  get poateScrie() { return !!this.o.poateScrie; }

  /* ---------- desenul întreg ---------- */
  incarca(desen) {
    this.inchideTextul(false);
    this.el = Array.isArray(desen?.el) ? copie(desen.el).filter((e) => e && typeof e === "object" && e.id && e.t) : [];
    this.fundal = FUNDALURI.includes(desen?.fundal) ? desen.fundal : "alb";
    this.inapoi = [];
    this.inainte = [];
    this.selectate.clear();
    this.temp = null;
    this.strain = null;
    this.ascunse.clear();
    this.cere();
    this.o.laSchimbare?.();
  }
  desenul() { return { fundal: this.fundal, el: this.el }; }

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
    } else if (op.fel === "fundal" && FUNDALURI.includes(op.f)) {
      if (op.f === this.fundal) return null;
      opus = { fel: "fundal", f: this.fundal };
      this.fundal = op.f;
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
    const op = this.inapoi.pop();
    if (!op) return;
    const opus = this.aplica(op);
    if (opus) this.inainte.push(opus);
    this.o.laOperatie?.(op);
    this.o.laSchimbare?.();
  }
  refa() {
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
    const noi = this.el.filter((e) => this.selectate.has(e.id)).map((e) => ({ ...mutat(e, 24, 24), id: idNou() }));
    if (!noi.length) return;
    this.fa({ fel: "pune", el: noi });
    this.selectate = new Set(noi.map((e) => e.id));
    this.cere();
  }
  /** Culoarea aleasă se pune și pe ce e selectat. */
  coloreazaSelectia(c) {
    const noi = this.el.filter((e) => this.selectate.has(e.id) && e.t !== "i").map((e) => ({ ...copie(e), c }));
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
  }
  mareste(f, sx = this.W / 2, sy = this.H / 2) {
    const { x, y, z } = this.vedere;
    const nz = Math.min(8, Math.max(0.1, z * f));
    const wx = x + sx / z, wy = y + sy / z;
    this.vedere = { z: nz, x: wx - sx / nz, y: wy - sy / nz };
    this.cere();
    this.o.laVedere?.();
  }
  /** Încape tot desenul; o pagină goală se întoarce la început. */
  potriveste() {
    let b = null;
    for (const e of this.el) b = uneste(b, cutia(e));
    if (!b) this.vedere = { x: 0, y: 0, z: 1 };
    else this.arataZona({ x: b.x - 40, y: b.y - 40, w: Math.max(b.w + 80, 300), h: Math.max(b.h + 80, 200) });
    this.cere();
    this.o.laVedere?.();
  }
  laMarimeaReala() { this.mareste(1 / this.vedere.z); }
  lume(cx, cy) {
    const r = this.panza.getBoundingClientRect();
    const { x, y, z } = this.vedere;
    return [x + (cx - r.left) / z, y + (cy - r.top) / z];
  }

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
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, this.W, this.H);
    this.grila();
    c.setTransform(d * z, 0, 0, d * z, -x * z * d, -y * z * d);
    for (const e of this.el) if (!this.ascunse.has(e.id)) this.element(e, this.mutare && this.selectate.has(e.id));
    if (this.strain) this.element(this.strain);
    if (this.temp) this.element(this.temp);
    if (this.laser) this.deseneazaLaser(this.laser);
    if (this.selectate.size) this.selectia();
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
    let pas = PAS_GRILA * z;
    if (pas < 8) return;
    const ox = -x * z % pas, oy = -y * z % pas;
    c.save();
    if (this.fundal === "puncte") {
      c.fillStyle = "#c9c1b7";
      for (let a = ox; a < this.W; a += pas) for (let b = oy; b < this.H; b += pas) c.fillRect(a - 1, b - 1, 2, 2);
    } else {
      c.strokeStyle = this.fundal === "dictando" ? "#c7d7ee" : "#e3ddd5";
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
      c.font = `${e.m}px ${LITERA}`;
      c.textBaseline = "top";
      String(e.s || "").split("\n").forEach((r, i) => c.fillText(r, e.x, e.y + i * e.m * 1.25));
    } else if (e.t === "i") {
      const img = this.imaginea(e.src);
      if (img.complete && img.naturalWidth) c.drawImage(img, e.x, e.y, e.w, e.h);
      else { c.strokeStyle = "#e3ddd5"; c.lineWidth = 1; c.strokeRect(e.x, e.y, e.w, e.h); }
    }
    c.restore();
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
    for (const e of this.el) if (this.selectate.has(e.id)) b = uneste(b, cutia(e));
    if (b && this.mutare) b = { ...b, x: b.x + this.mutare.dx, y: b.y + this.mutare.dy };
    if (b && this.scalare) {
      const { ox, oy, s } = this.scalare;
      b = { x: ox + (b.x - ox) * s, y: oy + (b.y - oy) * s, w: b.w * s, h: b.h * s };
    }
    return b;
  }
  selectia() {
    const b = this.cutiaSelectiei();
    if (!b) return;
    const c = this.ctx, z = this.vedere.z;
    c.save();
    c.strokeStyle = "#c2410c"; c.lineWidth = 1.5 / z; c.setLineDash([6 / z, 4 / z]);
    c.strokeRect(b.x - 6 / z, b.y - 6 / z, b.w + 12 / z, b.h + 12 / z);
    c.setLineDash([]);
    c.fillStyle = "#ffffff";
    const m = 14 / z;
    c.fillRect(b.x + b.w + 6 / z - m / 2, b.y + b.h + 6 / z - m / 2, m, m);
    c.strokeRect(b.x + b.w + 6 / z - m / 2, b.y + b.h + 6 / z - m / 2, m, m);
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
    if (u !== "selectie") { this.selectate.clear(); this.cere(); }
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
        this.o.laVedere?.();
      }
      this.o.laManaMea?.();
    }, { passive: false });
    p.addEventListener("dblclick", (e) => {
      if (!this.poateScrie || this.unealta !== "selectie") return;
      const [wx, wy] = this.lume(e.clientX, e.clientY);
      const t = [...this.el].reverse().find((x) => x.t === "x" && atinge(x, wx, wy, 4 / this.vedere.z));
      if (t) this.deschideTextul(t.x, t.y, t);
    });
    addEventListener("keydown", (e) => {
      if (e.code === "Space" && !this.text && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) {
        if (!this.spatiu) { this.spatiu = true; this.cursor(); }
        e.preventDefault();
      }
    });
    addEventListener("keyup", (e) => { if (e.code === "Space") { this.spatiu = false; this.cursor(); } });
    /* Un text deschis se închide (și se păstrează) la orice apăsare în afara lui. */
    document.addEventListener("pointerdown", (e) => {
      if (this.text && e.target !== this.text.ta && e.target !== this.panza) this.inchideTextul(true);
    }, true);
  }

  jos(e) {
    if (this.text && e.target === this.panza) this.inchideTextul(true);
    this.degete.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.panza.setPointerCapture(e.pointerId);
    /* Două degete: planșa se trage și se mărește; desenul început se lasă. */
    if (this.degete.size === 2) {
      this.temp = null; this.banda = null; this.mutare = null; this.scalare = null; this.ascunse.clear();
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
      this.temp = { id: idNou(), t, c: this.culoare, g: this.grosime, x1: r1(wx), y1: r1(wy), x2: r1(wx), y2: r1(wy) };
    } else if (u === "radiera") {
      this.urmaRadierei = [wx, wy];
      this.sterge(wx, wy, tol * 2);
    } else if (u === "laser") {
      this.laser = { t: "laser", pts: [r1(wx), r1(wy)] };
      clearTimeout(this.ceasLaser);
    } else if (u === "text") {
      const t = [...this.el].reverse().find((x) => x.t === "x" && atinge(x, wx, wy, tol));
      this.deschideTextul(t ? t.x : wx, t ? t.y : wy - this.marimeText * 0.6, t || null);
      this.actiune = null;
      e.preventDefault();
    } else if (u === "selectie") {
      const b = this.cutiaSelectiei();
      const m = 14 / this.vedere.z;
      if (b && Math.abs(wx - (b.x + b.w + 6 / this.vedere.z)) <= m && Math.abs(wy - (b.y + b.h + 6 / this.vedere.z)) <= m) {
        this.actiune = "scaleaza";
        this.scalare = { ox: b.x, oy: b.y, s: 1, w0: Math.max(1, b.w), h0: Math.max(1, b.h) };
      } else {
        const t = [...this.el].reverse().find((x) => atinge(x, wx, wy, tol, true));
        if (t) {
          if (e.shiftKey) { if (this.selectate.has(t.id)) this.selectate.delete(t.id); else this.selectate.add(t.id); }
          else if (!this.selectate.has(t.id)) this.selectate = new Set([t.id]);
          this.actiune = "muta";
          this.mutare = { x0: wx, y0: wy, dx: 0, dy: 0 };
        } else {
          if (!e.shiftKey) this.selectate.clear();
          this.actiune = "banda";
          this.banda = { x0: wx, y0: wy, x: wx, y: wy, w: 0, h: 0 };
        }
      }
      this.o.laSchimbare?.();
    }
    this.cere();
  }

  gestul() {
    const [a, b] = [...this.degete.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), v: { ...this.vedere } };
  }

  misca(e) {
    if (!this.degete.has(e.pointerId)) return;
    this.degete.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const a = this.actiune;
    if (a === "gest" && this.degete.size === 2) {
      const g0 = this.gest, g = this.gestul();
      const r = this.panza.getBoundingClientRect();
      const z = Math.min(8, Math.max(0.1, g0.v.z * g.d / g0.d));
      const wx = g0.v.x + (g0.cx - r.left) / g0.v.z, wy = g0.v.y + (g0.cy - r.top) / g0.v.z;
      this.vedere = { z, x: wx - (g.cx - r.left) / z, y: wy - (g.cy - r.top) / z };
      this.cere();
      this.o.laVedere?.();
      this.o.laManaMea?.();
      return;
    }
    if (a === "trage") {
      const s = this.start;
      this.vedere.x = s.x - (e.clientX - s.cx) / this.vedere.z;
      this.vedere.y = s.y - (e.clientY - s.cy) / this.vedere.z;
      this.cere();
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
      }
      this.temp.x2 = r1(x2); this.temp.y2 = r1(y2);
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
      this.mutare.dx = wx - this.mutare.x0; this.mutare.dy = wy - this.mutare.y0;
    } else if (a === "scaleaza" && this.scalare) {
      const s = this.scalare;
      s.s = Math.max(0.05, Math.max((wx - s.ox) / s.w0, (wy - s.oy) / s.h0));
    } else if (a === "banda" && this.banda) {
      const b = this.banda;
      b.x = Math.min(b.x0, wx); b.y = Math.min(b.y0, wy); b.w = Math.abs(wx - b.x0); b.h = Math.abs(wy - b.y0);
    } else return;
    this.cere();
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
      if (Math.abs(s - 1) > 0.005) this.fa({ fel: "schimba", el: this.el.filter((x) => this.selectate.has(x.id)).map((x) => marit(x, ox, oy, s)) });
    } else if (a === "banda" && this.banda) {
      const b = this.banda;
      this.banda = null;
      for (const x of this.el) {
        const c = cutia(x);
        if (c.x >= b.x && c.y >= b.y && c.x + c.w <= b.x + b.w && c.y + c.h <= b.y + b.h) this.selectate.add(x.id);
      }
      this.o.laSchimbare?.();
    }
    this.cere();
  }

  sterge(wx, wy, tol) {
    for (const x of this.el) if (!this.ascunse.has(x.id) && atinge(x, wx, wy, tol)) this.ascunse.add(x.id);
    this.cere();
  }

  /* ---------- textul ---------- */
  deschideTextul(wx, wy, vechi = null) {
    this.inchideTextul(true);
    const ta = document.createElement("textarea");
    ta.className = "ta-text";
    const m = vechi ? vechi.m : this.marimeText;
    const c = vechi ? vechi.c : this.culoare;
    ta.value = vechi ? vechi.s : "";
    ta.rows = 1;
    const { x, y, z } = this.vedere;
    Object.assign(ta.style, {
      left: `${(wx - x) * z}px`, top: `${(wy - y) * z}px`,
      fontSize: `${m * z}px`, color: c, fontFamily: LITERA,
    });
    this.gazda.append(ta);
    const creste = () => { ta.style.height = "auto"; ta.style.height = `${ta.scrollHeight}px`; ta.style.width = "auto"; ta.style.width = `${Math.max(40, ta.scrollWidth + 8)}px`; };
    ta.addEventListener("input", creste);
    ta.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") { this.inchideTextul(false); }
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { this.inchideTextul(true); }
    });
    ta.addEventListener("blur", () => setTimeout(() => { if (this.text?.ta === ta) this.inchideTextul(true); }, 0));
    this.text = { ta, wx, wy, vechi, m, c };
    if (vechi) this.ascunse.add(vechi.id);
    this.cere();
    setTimeout(() => { ta.focus(); creste(); }, 0);
  }

  inchideTextul(pastreaza) {
    const t = this.text;
    if (!t) return;
    this.text = null;
    t.ta.remove();
    if (t.vechi) this.ascunse.delete(t.vechi.id);
    const s = t.ta.value.replace(/\s+$/, "");
    if (pastreaza) {
      const el = s ? this.masoaraText({ id: t.vechi?.id || idNou(), t: "x", c: t.c, m: t.m, x: r1(t.wx), y: r1(t.wy), s }) : null;
      if (t.vechi && !el) this.fa({ fel: "scoate", id: [t.vechi.id] });
      else if (t.vechi && el.s !== t.vechi.s) this.fa({ fel: "schimba", el: [el] });
      else if (!t.vechi && el) this.fa({ fel: "pune", el: [el] });
    }
    this.cere();
  }

  masoaraText(e) {
    const c = this.ctx;
    c.save();
    c.font = `${e.m}px ${LITERA}`;
    const randuri = e.s.split("\n");
    e.w = r1(Math.max(...randuri.map((r) => c.measureText(r).width), 4));
    e.h = r1(randuri.length * e.m * 1.25);
    c.restore();
    return e;
  }

  /** Un text lipit (Ctrl+V) ajunge la mijlocul ecranului. */
  lipesteText(s) {
    const z = this.zonaVazuta();
    const el = this.masoaraText({ id: idNou(), t: "x", c: this.culoare, m: this.marimeText, x: r1(z.x + z.w / 2 - 100), y: r1(z.y + z.h / 2 - 20), s: s.slice(0, 4000) });
    this.fa({ fel: "pune", el: [el] });
  }

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
      this.fa({ fel: "pune", el: [{ id: idNou(), t: "i", x: r1(z.x + (z.w - fw) / 2), y: r1(z.y + (z.h - fh) / 2), w: r1(fw), h: r1(fh), src }] });
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
    const veche = { ctx: this.ctx, vedere: this.vedere, W: this.W, H: this.H, sel: this.selectate };
    this.ctx = c.getContext("2d");
    this.vedere = { x: b.x, y: b.y, z: s };
    this.W = c.width; this.H = c.height;
    this.selectate = new Set();
    this.pixel = 1;
    try { this.deseneaza(); } finally {
      this.pixel = 0;
      Object.assign(this, { ctx: veche.ctx, vedere: veche.vedere, W: veche.W, H: veche.H, selectate: veche.sel });
      this.cere();
    }
    return c.toDataURL("image/png");
  }
}

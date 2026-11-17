// =========================================================
// TEXTUL TABLEI ALBE: formatare, liste, aliniere, încadrare pe lățime.
//
// Folosit de casetele de text și de celulele tabelelor (vezi
// `tabla-alba-plansa.js`). Cerut de Marius pe 17 noiembrie 2026: „o experiență
// cât mai apropiată de Word".
//
// MODELUL unui text (mic, ca să încapă pe canalul live):
//   s   literele; paragrafele despărțite de „\n"
//   r   bucățile formatate: [[câte litere, semne], …]; semne: 1 bold,
//       2 italic, 4 subliniat (fără `r`, tot textul e simplu)
//   p   paragrafele, unul pe rând de „\n": null ori
//       { l: "b" | "n" | "a" (bulină, număr, literă), f: formatul („•",
//         „1.", „(1)", „a)" …), n: nivelul (0–5), a: "l" | "c" | "r" | "j" }
// Lângă el, la element: m (mărimea literei), lat (până unde merge rândul;
// fără ea, rândul merge cât e scris), ind (cât intră un nivel de listă).
//
// EDITORUL e un `contenteditable`: fiecare paragraf e un <div class="ta-p">
// cu `data-l`, `data-f`, `data-n`, `data-a`; marcajul (•, 1., a)) îl pune CSS
// din `data-m`, calculat aici, la fel ca pe tablă.
// Cuprins în română, nume în engleză.
// =========================================================

export const BOLD = 1, ITALIC = 2, SUBLINIAT = 4;
export const LITERA = '"Segoe UI", system-ui, sans-serif';
export const RAND = 1.25;                 // înălțimea rândului, în mărimi de literă

/* Formatele listelor, ca în Word. */
export const LISTE = {
  b: ["•", "◦", "▪", "–", "➢", "✓"],
  n: ["1.", "1)", "(1)", "I."],
  a: ["a.", "a)", "(a)", "A."],
};
export const NIVEL_MAX = 5;

const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const fontul = (f, m) => `${f & ITALIC ? "italic " : ""}${f & BOLD ? "700 " : ""}${m}px ${LITERA}`;

/* ---------- modelul, verificat ---------- */

/** Bucățile textului; dacă nu acoperă exact textul, e tot simplu. */
export function bucatile(t) {
  const s = String(t?.s || "");
  const ok = Array.isArray(t?.r) && t.r.every((x) => Array.isArray(x) && Number.isInteger(x[0]) && x[0] >= 0
    && Number.isInteger(x[1]) && x[1] >= 0 && x[1] <= 7) && t.r.reduce((a, x) => a + x[0], 0) === s.length;
  return ok ? t.r : [[s.length, 0]];
}

/** Bucățile, lipite unde au aceleași semne; `null` dacă tot textul e simplu. */
export function strange(r) {
  const o = [];
  for (const [n, f] of r) {
    if (!n) continue;
    const u = o[o.length - 1];
    if (u && u[1] === f) u[0] += n; else o.push([n, f]);
  }
  return o.length && o.some(([, f]) => f) ? o : null;
}

/** Un paragraf verificat ori null. */
function paragraful(x) {
  if (!x || typeof x !== "object") return null;
  const o = {};
  if (["b", "n", "a"].includes(x.l) && LISTE[x.l].includes(x.f)) { o.l = x.l; o.f = x.f; }
  if (Number.isInteger(x.n) && x.n > 0) o.n = Math.min(NIVEL_MAX, x.n);
  if (["c", "r", "j"].includes(x.a)) o.a = x.a;
  return Object.keys(o).length ? o : null;
}

/** Paragrafele textului: [{ bucati: [{s, f}], p }]. */
export function paragrafele(t) {
  const s = String(t?.s || "");
  const linii = [[]];
  let i = 0;
  for (const [n, f] of bucatile(t)) {
    s.slice(i, i + n).split("\n").forEach((b, k) => { if (k) linii.push([]); if (b) linii[linii.length - 1].push({ s: b, f }); });
    i += n;
  }
  const p = Array.isArray(t?.p) ? t.p : [];
  return linii.map((bucati, k) => ({ bucati, p: paragraful(p[k]) }));
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
  if (l === "n") return f === "I." ? `${roman(k)}.` : f.replace("1", String(k));
  if (l === "a") { const x = litera(k); return f === "A." ? `${x.toUpperCase()}.` : f.replace("a", x); }
  return "";
}

/** Marcajul fiecărui paragraf („" dacă nu e în listă). Numerotarea merge mai
 *  departe pe același nivel și se ia de la capăt după un paragraf obișnuit ori
 *  când se schimbă felul listei; un nivel mai adânc începe de la 1. */
export function marcajele(ps) {
  const nr = [], fel = [];
  return ps.map((p) => {
    if (!p?.l) { nr.length = 0; fel.length = 0; return ""; }
    const n = p.n || 0;
    const cheie = `${p.l}|${p.f}`;
    if (fel[n] !== cheie) { nr[n] = 0; fel[n] = cheie; }
    nr[n] = (nr[n] || 0) + 1;
    nr.length = n + 1; fel.length = n + 1;
    return marcajul(p.l, p.f, nr[n]);
  });
}

/* ---------- așezarea pe rânduri ---------- */

/**
 * Așază textul: împarte paragrafele în rânduri (la `lat`, dacă e), pune
 * marcajele listelor și aliniază rândurile.
 * @returns {{ linii: Array, w: number, h: number }}  linie: { y, marcaj?: {s, x}, bucati: [{s, f, x}], sub: [[x, w]] }
 */
export function aseaza(ctx, t, { m, lat = null, ind = null, aliniere = "l" }) {
  const pas = ind || m * 1.4;
  const lh = m * RAND;
  const ps = paragrafele(t);
  const marc = marcajele(ps.map((x) => x.p));
  const masoara = (s, f) => { ctx.font = fontul(f, m); return ctx.measureText(s).width; };
  const randuri = [];   // înainte de aliniere
  ps.forEach(({ bucati, p }, k) => {
    const n = p?.n || 0;
    const stanga = (n + (p?.l ? 1 : 0)) * pas;
    const loc = lat ? Math.max(m, lat - stanga) : Infinity;
    /* Cuvintele și spațiile, fiecare cu semnele lui. */
    const bucs = [];
    for (const b of bucati) for (const s of b.s.split(/(\s+)/)) if (s) bucs.push({ s, f: b.f, w: masoara(s, b.f), sp: /^\s+$/.test(s) });
    const linii = [[]];
    let lung = 0;
    for (const b of bucs) {
      const linia = linii[linii.length - 1];
      if (!b.sp && lung + b.w > loc && linia.some((x) => !x.sp)) {
        while (linia.length && linia[linia.length - 1].sp) lung -= linia.pop().w;
        linii.push([]); lung = 0;
      }
      if (b.sp && !linii[linii.length - 1].length && linii.length > 1) continue;   // spațiu la început de rând nou
      /* Un cuvânt mai lung decât rândul se rupe pe litere. */
      if (!b.sp && b.w > loc) {
        let bucata = "";
        for (const ch of b.s) {
          const w = masoara(bucata + ch, b.f);
          if (bucata && lung + w > loc) {
            linii[linii.length - 1].push({ s: bucata, f: b.f, w: masoara(bucata, b.f), sp: false });
            linii.push([]); lung = 0; bucata = ch;
          } else bucata += ch;
        }
        if (bucata) { const w = masoara(bucata, b.f); linii[linii.length - 1].push({ s: bucata, f: b.f, w, sp: false }); lung += w; }
        continue;
      }
      linii[linii.length - 1].push(b);
      lung += b.w;
    }
    linii.forEach((l, i) => {
      while (l.length && l[l.length - 1].sp) l.pop();
      randuri.push({ bucs: l, w: l.reduce((a, x) => a + x.w, 0), stanga, n, p, ultim: i === linii.length - 1,
        marcaj: i === 0 && p?.l ? { s: marc[k], x: n * pas } : null });
    });
  });
  const W = lat || Math.max(4, ...randuri.map((x) => x.stanga + x.w));
  const linii = randuri.map((rd, k) => {
    const a = rd.p?.a || aliniere;
    const liber = Math.max(0, W - rd.stanga - rd.w);
    let x = rd.stanga + (a === "c" ? liber / 2 : a === "r" ? liber : 0);
    const spatii = rd.bucs.filter((b) => b.sp).length;
    const intre = a === "j" && !rd.ultim && spatii && lat ? liber / spatii : 0;
    const bucati = [];
    const sub = [];
    for (const b of rd.bucs) {
      const w = b.w + (b.sp ? intre : 0);
      if (!b.sp) bucati.push({ s: b.s, f: b.f, x });
      if (b.f & SUBLINIAT) sub.push([x, w]);
      x += w;
    }
    return { y: k * lh, marcaj: rd.marcaj, bucati, sub };
  });
  return { linii, w: W, h: Math.max(1, linii.length) * lh };
}

/** Deseneaza textul așezat, cu colțul de sus la (x, y). */
export function deseneazaText(ctx, as, x, y, m, culoare) {
  ctx.save();
  ctx.fillStyle = culoare || "#1f2430";
  ctx.textBaseline = "top";
  for (const l of as.linii) {
    if (l.marcaj) { ctx.font = fontul(0, m); ctx.fillText(l.marcaj.s, x + l.marcaj.x, y + l.y); }
    for (const b of l.bucati) { ctx.font = fontul(b.f, m); ctx.fillText(b.s, x + b.x, y + l.y); }
    for (const [sx, w] of l.sub) ctx.fillRect(x + sx, y + l.y + m * 1.05, w, Math.max(1, m / 14));
  }
  ctx.restore();
}

/* ---------- editorul ---------- */

/** HTML-ul editorului pentru un text: câte un <div class="ta-p"> pe paragraf. */
export function inEditor(t) {
  const ps = t?.s ? paragrafele(t) : [{ bucati: [], p: null }];
  return ps.map(({ bucati, p }) => {
    const h = bucati.map(({ s, f }) => {
      let x = escH(s);
      if (f & SUBLINIAT) x = `<u>${x}</u>`;
      if (f & ITALIC) x = `<i>${x}</i>`;
      if (f & BOLD) x = `<b>${x}</b>`;
      return x;
    }).join("") || "<br>";
    const d = p ? `${p.l ? ` data-l="${p.l}" data-f="${escH(p.f)}"` : ""}${p.n ? ` data-n="${p.n}"` : ""}${p.a ? ` data-a="${p.a}"` : ""}` : "";
    return `<div class="ta-p"${d}>${h}</div>`;
  }).join("");
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

const pDin = (d) => paragraful({
  l: d.dataset.l, f: d.dataset.f, n: Number(d.dataset.n) || 0, a: d.dataset.a,
});

/** Textul din editor, ca model {s, r, p}. */
export function dinEditor(rad) {
  normalizeazaEditor(rad);
  const pars = [...rad.children].filter((d) => d.classList.contains("ta-p"));
  let s = "";
  const r = [];
  const ps = [];
  const adauga = (t, f) => { if (t) { s += t; r.push([t.length, f]); } };
  const mergi = (n, f) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { adauga(c.data.replace(/ /g, " ").replace(/\n/g, " "), f); continue; }
      if (c.nodeType !== 1 || c.nodeName === "BR") continue;
      let g = f;
      const st = c.style || {};
      if (/^(B|STRONG)$/.test(c.nodeName) || /^(bold|bolder|[6-9]00)$/.test(st.fontWeight || "")) g |= BOLD;
      if (/^(I|EM)$/.test(c.nodeName) || st.fontStyle === "italic") g |= ITALIC;
      if (c.nodeName === "U" || /underline/.test(`${st.textDecoration || ""} ${st.textDecorationLine || ""}`)) g |= SUBLINIAT;
      mergi(c, g);
    }
  };
  pars.forEach((d, k) => {
    if (k) adauga("\n", 0);
    mergi(d, 0);
    ps.push(pDin(d));
  });
  /* Paragrafele goale de la coadă nu rămân (afară de unul în listă). */
  while (ps.length > 1 && s.endsWith("\n") && !ps[ps.length - 1]) {
    s = s.slice(0, -1); ps.pop();
    let rest = 1;
    while (rest && r.length) { const u = r[r.length - 1]; const x = Math.min(u[0], rest); u[0] -= x; rest -= x; if (!u[0]) r.pop(); }
  }
  const o = { s, r: strange(r) };
  if (ps.some(Boolean)) o.p = ps;
  return o;
}

/** Pune pe paragrafele editorului marcajele, intrările și alinierea, la mărirea `z`. */
export function refaParagrafele(rad, { m, ind = null, z = 1, aliniere = "l" }) {
  normalizeazaEditor(rad);
  const pas = (ind || m * 1.4) * z;
  const pars = [...rad.children].filter((d) => d.classList.contains("ta-p"));
  const marc = marcajele(pars.map(pDin));
  pars.forEach((d, k) => {
    const p = pDin(d);
    const n = p?.n || 0;
    d.style.paddingLeft = `${(n + (p?.l ? 1 : 0)) * pas}px`;
    d.style.setProperty("--mx", `${n * pas}px`);
    d.style.textAlign = { c: "center", r: "right", j: "justify" }[p?.a || aliniere] || "left";
    if (marc[k]) d.dataset.m = marc[k]; else delete d.dataset.m;
  });
}

/** Paragrafele în care stă selecția (ori cursorul). */
export function paragrafeleSelectate(rad) {
  const sel = getSelection();
  const pars = [...rad.children].filter((d) => d.classList.contains("ta-p"));
  if (!sel.rangeCount || !rad.contains(sel.anchorNode)) return pars.slice(-1);
  const r = sel.getRangeAt(0);
  const alese = pars.filter((d) => r.intersectsNode(d));
  return alese.length ? alese : pars.slice(-1);
}

/** Lista pe paragrafele alese: pusă, ori scoasă dacă era deja exact aceea. */
export function puneLista(pars, l, f) {
  const toate = pars.every((d) => d.dataset.l === l && d.dataset.f === f);
  for (const d of pars) {
    if (toate || !l) { delete d.dataset.l; delete d.dataset.f; }
    else { d.dataset.l = l; d.dataset.f = f; }
  }
}
export function schimbaNivelul(pars, cu) {
  for (const d of pars) {
    const n = Math.max(0, Math.min(NIVEL_MAX, (Number(d.dataset.n) || 0) + cu));
    if (n) d.dataset.n = String(n); else delete d.dataset.n;
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
  return { d, inainte: r.toString() };
}

/** Scoate primele `k` litere din paragraf (după autoformatare). */
export function taieInceputul(d, k) {
  const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
  let rest = k;
  while (rest > 0 && w.nextNode()) {
    const t = w.currentNode;
    const x = Math.min(t.data.length, rest);
    t.data = t.data.slice(x);
    rest -= x;
  }
  if (!d.textContent) d.innerHTML = "<br>";
  const r = document.createRange();
  r.setStart(d, 0);
  r.collapse(true);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}

/** Ce listă cere începutul tastat al unui paragraf („1. ", „a) ", „- " …). */
export function autoLista(inainte) {
  if (/^[-*•]\s$/.test(inainte)) return { l: "b", f: inainte[0] === "-" ? "–" : "•" };
  let x;
  if ((x = /^\d+([.)])\s$/.exec(inainte))) return { l: "n", f: `1${x[1]}` };
  if (/^\(\d+\)\s$/.test(inainte)) return { l: "n", f: "(1)" };
  if ((x = /^[a-z]([.)])\s$/.exec(inainte))) return { l: "a", f: `a${x[1]}` };
  if (/^\([a-z]\)\s$/.test(inainte)) return { l: "a", f: "(a)" };
  if (/^[A-Z]\.\s$/.test(inainte) && inainte[0] !== "I") return { l: "a", f: "A." };
  if (/^I\.\s$/.test(inainte)) return { l: "n", f: "I." };
  return null;
}

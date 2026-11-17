// =========================================================
// TABLA ALBĂ (/tabla/, 0113), cerută de Marius pe 17 noiembrie 2026.
//
// PROFESORUL (adminul) scrie pe tabla smart din clasă; ce scrie apare pe loc
// la toți cei care au deschisă tabla clasei.
//   • Foldere pe clase, fiecare cu codul ei (`012c`). În fiecare clasă,
//     lecții; fiecare lecție are paginile ei de tablă și un material.
//   • Două file: Tabla (whiteboardul) și Material (o lecție HTML de-a lui,
//     urcată ca fișier, ori o pagină a sitului).
//   • „Conduc eu": elevii văd fila, pagina, bucata de planșă și derularea
//     materialului ale profesorului. „Liber": se plimbă singuri prin lecția
//     deschisă (file, pagini, material). Lecția o alege tot profesorul.
//
// VIZITATORUL (oricine nu e admin, logat ori nu) intră cu codul clasei și doar
// privește. Pagina NU are poarta de prelansare: codul e cheia ei.
// DIN LICEU (0114): titlul clasei („10D") duce la `/tabla/?clasa=10D`. Cât e
// deschis modulul Liceu, elevul intră așa fără cod; adminul ajunge pe clasa
// cu același nume (ori e întrebat dacă s-o facă).
//
// LIVE. Pe canalul clasei pleacă: `stare` (unde e profesorul; repetată la
// 3 secunde, ca un elev intrat târziu să afle singur), `op` (o schimbare a
// desenului, cu numărul ei, `rev`), `tras` (desenul în curs, ca să se vadă
// cum scrie) și `structura` (s-au schimbat lecțiile, paginile ori materialul:
// se citesc din nou). Cine primește o `op` care nu urmează numărului lui (a
// pierdut un mesaj) ia pagina din nou din bază. Ce rămâne se salvează în bază.
// Cuprins în română, nume în engleză.
// =========================================================
import { isAdmin } from "../../shared/scripts/session.js";
import {
  clasele, claseNoua, schimbaClasa, stergeClasa, lectieNoua, schimbaLectia, stergeLectia,
  paginileAdmin, paginaNoua, salveazaPagina, stergePagina, materialulAdmin,
  intraCuCodul, intraCuClasa, paginileCuCod, materialulCuCod, canalul,
} from "../../shared/scripts/tabla-alba-repo.js";
import { Plansa, FUNDALURI } from "./tabla-alba-plansa.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CHEIE_COD = "tabla-alba:cod";
const CHEIE_UNDE = "tabla-alba:unde";
const ia = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const pune = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* nimic */ } };
const ADRESA_BUNA = /^\/(?!\/)[A-Za-z0-9\-._~/%?=&#+]*$/;

const parametri = new URLSearchParams(location.search);
/* `?vizitator` arată adminului tabla cum o vede un elev. */
const admin = isAdmin() && !parametri.has("vizitator");
document.body.classList.toggle("ta--admin", admin);

/* ---------- starea paginii ---------- */
let clase = [];            // adminul: toate clasele
let clasa = null;          // clasa deschisă: { id, nume, cod?, lectii, stare }
let cod = "";              // vizitatorul: codul cu care a intrat
let lectie = null;         // lecția deschisă
let pagini = [];           // paginile ei: { id, ordine, desen: { rev, fundal, el } }
let pag = 0;               // pagina deschisă
let fila = "tabla";
let mod = "conduc";
let canal = null;
let legat = false;
let urmaresc = true;       // vizitatorul: planșa urmează ce vede profesorul
let prof = {};             // vizitatorul: ultima stare a profesorului
let ceasProf = 0;
const materiale = new Map();   // lecție → html

const bara = $("#bara");
const panou = $("#panou");
const scena = $("#scena");
const filaTabla = $("#fila-tabla");
const filaMaterial = $("#fila-material");
const unelte = $("#unelte");
const paginiEl = $("#pagini");
const zoomEl = $("#zoom");
const golEl = $("#gol");

const plansa = new Plansa($("#plansa"), {
  poateScrie: admin,
  unealta: "text",          // cerut de Marius: tabla pornește pe Text
  laOperatie: (op) => opMea(op),
  laTrasare: (el) => trasareMea(el),
  laVedere: () => { arataZoom(); if (admin) stareCurand(150); },
  laManaMea: () => { if (!admin && urmaresc) { urmaresc = false; deseneazaBara(); } },
  laMarime: () => { if (!admin && urmaresc && prof.vedere) plansa.arataZona(prof.vedere); },
  laSchimbare: () => deseneazaUneltele(),
});

/* =========================================================
   BARA DE SUS
   ========================================================= */
function deseneazaBara() {
  const titlu = clasa
    ? `<span class="ta-clasa">${esc(clasa.nume)}</span>${lectie ? `<span class="ta-lectie">${esc(lectie.titlu)}</span>` : ""}`
    : `<span class="ta-lectie">${admin ? "Alege o clasă" : ""}</span>`;
  const blocat = !admin && mod === "conduc";
  const file = clasa && lectie ? `<div class="ta-file" role="tablist">
      <button type="button" role="tab" data-fila="tabla" class="${fila === "tabla" ? "is-on" : ""}"${blocat ? " disabled" : ""}>Tabla</button>
      <button type="button" role="tab" data-fila="material" class="${fila === "material" ? "is-on" : ""}"${blocat ? " disabled" : ""}>Material</button>
    </div>` : "";
  const moduri = admin && clasa ? `<div class="ta-mod" role="group" aria-label="Cine conduce">
      <button type="button" data-mod="conduc" class="${mod === "conduc" ? "is-on" : ""}" title="Elevii văd ce vezi tu: fila, pagina, derularea">Conduc eu</button>
      <button type="button" data-mod="liber" class="${mod === "liber" ? "is-on" : ""}" title="Elevii se plimbă singuri prin lecția deschisă">Liber</button>
    </div>` : !admin && clasa ? `<span class="ta-chip">${mod === "conduc" ? "Profesorul conduce" : "Te poți plimba prin lecție"}</span>` : "";
  const codul = admin && clasa ? `<button type="button" class="ta-chip ta-chip--cod" data-bara="cod" title="Copiază adresa pentru elevi">Cod: <b>${esc(clasa.cod)}</b></button>` : "";
  const urmeaza = !admin && clasa && fila === "tabla" ? `<button type="button" class="ta-btn${urmaresc ? " is-on" : ""}" data-bara="urmaresc"
      title="${urmaresc ? "Planșa ta urmează ce vede profesorul" : "Te uiți singur; apasă ca să urmezi iar profesorul"}">${urmaresc ? "◉ Urmăresc" : "○ Mă uit singur"}</button>` : "";
  const stare = clasa ? `<span class="ta-stare" data-fel="${legat ? "live" : "eroare"}">${legat ? "live" : "fără legătură"}</span>` : "";
  bara.innerHTML = `
    ${admin ? `<button type="button" class="ta-btn ta-btn--panou" data-bara="panou" aria-expanded="${!panou.hidden}" title="Clasele și lecțiile">☰ Clase</button>` : `<a class="ta-acasa" href="/" title="Atelierul">◂</a>`}
    <span class="ta-marca">Tabla</span>
    <div class="ta-titlu">${titlu}</div>
    ${file}
    <span class="ta-g"></span>
    ${moduri}${codul}${urmeaza}${stare}
    ${!admin && clasa ? `<button type="button" class="ta-btn" data-bara="iesi" title="Ieși din clasa asta">Ieși</button>` : ""}
    <button type="button" class="ta-btn" data-bara="ecran" title="Pe tot ecranul">⛶</button>`;
}

bara.addEventListener("click", async (e) => {
  const f = e.target.closest("[data-fila]");
  if (f && !f.disabled) { schimbaFila(f.dataset.fila); return; }
  const m = e.target.closest("[data-mod]");
  if (m && admin) { mod = m.dataset.mod; deseneazaBara(); stareAcum(); return; }
  const b = e.target.closest("[data-bara]")?.dataset.bara;
  if (b === "panou") { panou.hidden = !panou.hidden; deseneazaBara(); }
  else if (b === "ecran") {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  } else if (b === "cod" && clasa) {
    const adresa = `${location.origin}/tabla/?cod=${clasa.cod}`;
    try { await navigator.clipboard.writeText(adresa); arataVestea(`Am copiat: ${adresa}`); }
    catch { prompt("Adresa pentru elevi:", adresa); }
  } else if (b === "urmaresc") {
    urmaresc = !urmaresc;
    if (urmaresc && prof.vedere) plansa.arataZona(prof.vedere);
    deseneazaBara();
  } else if (b === "iesi") {
    pune(CHEIE_COD, null);
    location.href = "/tabla/";
  }
});

let ceasVeste = null;
function arataVestea(text, eroare = false) {
  const v = $("#veste");
  v.textContent = text;
  v.classList.toggle("is-eroare", eroare);
  v.hidden = false;
  clearTimeout(ceasVeste);
  ceasVeste = setTimeout(() => { v.hidden = true; }, eroare ? 6000 : 2800);
}

/* =========================================================
   FILELE
   ========================================================= */
function schimbaFila(f) {
  if (f === fila) return;
  fila = f;
  arataFila();
  deseneazaBara();
  if (admin) stareAcum();
}
function arataFila() {
  const are = !!(clasa && lectie);
  filaTabla.hidden = !are || fila !== "tabla";
  filaMaterial.hidden = !are || fila !== "material";
  golEl.hidden = are;
  if (are && fila === "tabla") plansa.marime();
  if (are && fila === "material") deseneazaMaterialul();
}

/* =========================================================
   UNELTELE (adminul)
   ========================================================= */
const UNELTE = [
  ["selectie", "↖", "Selecție (V): muți, mărești, ștergi"],
  ["mana", "✋", "Mâna (H): tragi planșa"],
  ["creion", "✎", "Creion (P)"],
  ["marker", "▬", "Marker de evidențiere (M)"],
  ["radiera", "⌫", "Radieră (E)"],
  ["text", "T", "Text (T)"],
  ["linie", "╱", "Linie (L); cu Shift, dreaptă"],
  ["sageata", "➚", "Săgeată (A)"],
  ["dreptunghi", "▭", "Dreptunghi (R)"],
  ["elipsa", "◯", "Elipsă (O)"],
  ["laser", "✦", "Laser (K): arată, nu rămâne"],
];
const CULORI = ["#1f2430", "#c2410c", "#dc2626", "#2563eb", "#16a34a", "#7c3aed", "#ca8a04", "#ffffff"];
const GROSIMI = [[2, "subțire", 20], [4, "mijlocie", 28], [8, "groasă", 44]];
const NUME_FUNDAL = { alb: "Fără linii", patratele: "Pătrățele", dictando: "Dictando", puncte: "Puncte" };
/* Culorile paginii: albă, crem, verde de tablă, neagră și câteva pale. */
const CULORI_PAGINA = [["#ffffff", "Albă"], ["#fbf6ec", "Crem"], ["#fdf6c9", "Galben pal"], ["#e8f1fb", "Albastru pal"],
  ["#eaf6ec", "Verde pal"], ["#1f4d3a", "Verde de tablă"], ["#1e293b", "Albastru închis"], ["#1f2430", "Neagră"]];

function deseneazaUneltele() {
  if (!admin) { unelte.hidden = true; if (panouFundal) panouFundal.hidden = true; return; }
  unelte.hidden = false;
  const sel = plansa.selectate.size;
  unelte.innerHTML = `
    <div class="ta-grup">${UNELTE.map(([u, i, t]) => `<button type="button" class="ta-u${plansa.unealta === u ? " is-on" : ""}" data-u="${u}" title="${t}" aria-label="${t}">${i}</button>`).join("")}</div>
    <div class="ta-grup ta-culori">${CULORI.map((c) => `<button type="button" class="ta-cul${plansa.culoare === c ? " is-on" : ""}" data-c="${c}" style="--c:${c}" title="${c}" aria-label="Culoarea ${c}"></button>`).join("")}
      <label class="ta-cul ta-cul--alta" title="Altă culoare"><input type="color" value="${plansa.culoare}" data-alta></label></div>
    <div class="ta-grup">${GROSIMI.map(([g, t]) => `<button type="button" class="ta-gros${plansa.grosime === g ? " is-on" : ""}" data-g="${g}" title="Linie ${t}"><i style="--g:${g}px"></i></button>`).join("")}</div>
    <div class="ta-grup">
      <button type="button" class="ta-u" data-a="inapoi" title="Înapoi (Ctrl+Z)"${plansa.inapoi.length ? "" : " disabled"}>↶</button>
      <button type="button" class="ta-u" data-a="inainte" title="Înainte (Ctrl+Y)"${plansa.inainte.length ? "" : " disabled"}>↷</button>
      ${sel ? `<button type="button" class="ta-u" data-a="dubleaza" title="Dublează selecția (Ctrl+D)">⧉</button>
      <button type="button" class="ta-u ta-u--rosu" data-a="sterge" title="Șterge selecția (Delete)">🗑</button>` : ""}
    </div>
    <div class="ta-grup">
      <button type="button" class="ta-u" data-a="imagine" title="Pune o imagine (merge și Ctrl+V)">🖼</button>
      <button type="button" class="ta-u${fundalDeschis ? " is-on" : ""}" data-a="fundal" title="Fundalul paginii: culoarea și liniile" aria-expanded="${fundalDeschis}">▦</button>
      <button type="button" class="ta-u" data-a="png" title="Salvează pagina ca imagine">⤓</button>
      <button type="button" class="ta-u ta-u--rosu" data-a="goleste" title="Golește pagina">✕</button>
    </div>`;
  panouFundal.hidden = !fundalDeschis;
  panouFundal.innerHTML = fundalDeschis ? `<div class="ta-grup ta-fundal" role="group" aria-label="Fundalul paginii">
      <p>Culoarea paginii</p>
      <div class="ta-fundal__culori">${CULORI_PAGINA.map(([c, n]) => `<button type="button" class="ta-cul${plansa.culoareFundal === c ? " is-on" : ""}" data-fc="${c}" style="--c:${c}" title="${n}" aria-label="Pagina ${n.toLowerCase()}"></button>`).join("")}
        <label class="ta-cul ta-cul--alta" title="Altă culoare"><input type="color" value="${plansa.culoareFundal}" data-fc-alta></label></div>
      <p>Liniile</p>
      <div class="ta-fundal__linii">${FUNDALURI.map((f) => `<button type="button" class="ta-btn${plansa.fundal === f ? " is-on" : ""}" data-ff="${f}">${NUME_FUNDAL[f]}</button>`).join("")}</div>
    </div>` : "";
}

/* Panoul cu fundalul stă lângă bara de unelte, nu în ea: bara se derulează și
   l-ar fi tăiat jos, pe ecrane mai mici. */
let fundalDeschis = false;
const panouFundal = document.createElement("div");
panouFundal.className = "ta-fundal-panou";
panouFundal.hidden = true;
filaTabla.append(panouFundal);
/* Pe o pagină închisă, creionul negru nu se vede: trece singur pe alb (și invers). */
function culoareaPaginii(c) {
  plansa.fa({ fel: "culoare", c });
  const n = parseInt(c.slice(1), 16);
  const inchisa = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 140;
  if (inchisa && plansa.culoare === "#1f2430") plansa.culoare = "#ffffff";
  else if (!inchisa && plansa.culoare === "#ffffff") plansa.culoare = "#1f2430";
  deseneazaUneltele();
}
panouFundal.addEventListener("click", (e) => {
  const fc = e.target.closest("[data-fc]");
  if (fc) { culoareaPaginii(fc.dataset.fc); return; }
  const ff = e.target.closest("[data-ff]");
  if (ff) { plansa.fa({ fel: "fundal", f: ff.dataset.ff }); deseneazaUneltele(); }
});
panouFundal.addEventListener("change", (e) => { if (e.target.matches("[data-fc-alta]")) culoareaPaginii(e.target.value); });
unelte.addEventListener("click", (e) => {
  const u = e.target.closest("[data-u]");
  if (u) { plansa.setUnealta(u.dataset.u); return; }
  const c = e.target.closest("[data-c]");
  if (c) { puneCuloarea(c.dataset.c); return; }
  const g = e.target.closest("[data-g]");
  if (g) {
    plansa.grosime = Number(g.dataset.g);
    plansa.marimeText = GROSIMI.find((x) => x[0] === plansa.grosime)?.[2] || 28;
    deseneazaUneltele();
    return;
  }
  const a = e.target.closest("[data-a]")?.dataset.a;
  if (a === "inapoi") plansa.anuleaza();
  else if (a === "inainte") plansa.refa();
  else if (a === "sterge") plansa.stergeSelectia();
  else if (a === "dubleaza") plansa.dubleazaSelectia();
  else if (a === "imagine") $("#alege-imagine").click();
  else if (a === "fundal") { fundalDeschis = !fundalDeschis; deseneazaUneltele(); }
  else if (a === "png") {
    const l = document.createElement("a");
    l.href = plansa.imaginePng();
    l.download = `${clasa?.nume || "tabla"} - ${lectie?.titlu || ""} - pagina ${pag + 1}.png`.replace(/[\\/:*?"<>|]/g, "");
    l.click();
  } else if (a === "goleste") {
    if (plansa.el.length && confirm("Golești pagina asta? Se poate da înapoi cu ↶.")) plansa.golesteTot();
  }
});
unelte.addEventListener("input", (e) => { if (e.target.matches("[data-alta]")) puneCuloarea(e.target.value, false); });

function puneCuloarea(c, redeseneaza = true) {
  plansa.culoare = c;
  if (plansa.selectate.size) plansa.coloreazaSelectia(c);
  if (redeseneaza) deseneazaUneltele();
  else unelte.querySelectorAll(".ta-cul").forEach((b) => b.classList.toggle("is-on", b.dataset.c === c));
}

$("#alege-imagine").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (f && admin) await plansa.lipesteImagine(f).catch(() => arataVestea("Imaginea n-a putut fi citită.", true));
});

/* Tastele: unelte, Undo, ștergere. Nu și când scrii într-un câmp. */
addEventListener("keydown", (e) => {
  if (!admin || !lectie || fila !== "tabla") return;
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); if (e.shiftKey) plansa.refa(); else plansa.anuleaza(); return; }
  if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); plansa.refa(); return; }
  if ((e.ctrlKey || e.metaKey) && k === "d") { e.preventDefault(); plansa.dubleazaSelectia(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === "delete" || k === "backspace") { e.preventDefault(); plansa.stergeSelectia(); return; }
  if (k === "escape") { plansa.selectate.clear(); plansa.cere(); deseneazaUneltele(); return; }
  const u = { v: "selectie", h: "mana", p: "creion", m: "marker", e: "radiera", t: "text", l: "linie", a: "sageata", r: "dreptunghi", o: "elipsa", k: "laser" }[k];
  if (u) plansa.setUnealta(u);
});
addEventListener("paste", (e) => {
  if (!admin || !lectie || fila !== "tabla" || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
  const fisier = [...(e.clipboardData?.items || [])].find((x) => x.type.startsWith("image/"))?.getAsFile();
  if (fisier) { e.preventDefault(); plansa.lipesteImagine(fisier); return; }
  const text = e.clipboardData?.getData("text/plain");
  if (text?.trim()) { e.preventDefault(); plansa.lipesteText(text.trim()); }
});

/* ---------- mărirea ---------- */
function arataZoom() {
  const p = zoomEl.querySelector("[data-z='real']");
  if (p) p.textContent = `${Math.round(plansa.vedere.z * 100)}%`;
}
zoomEl.innerHTML = `<button type="button" data-z="minus" title="Mai mic">−</button>
  <button type="button" data-z="real" title="Mărimea reală">100%</button>
  <button type="button" data-z="plus" title="Mai mare">+</button>
  <button type="button" data-z="tot" title="Tot desenul pe ecran">⤢</button>`;
zoomEl.addEventListener("click", (e) => {
  const z = e.target.closest("[data-z]")?.dataset.z;
  if (!z) return;
  if (z === "minus") plansa.mareste(1 / 1.25);
  else if (z === "plus") plansa.mareste(1.25);
  else if (z === "real") plansa.laMarimeaReala();
  else plansa.potriveste();
  if (!admin && urmaresc) { urmaresc = false; deseneazaBara(); }
});

/* =========================================================
   PAGINILE
   ========================================================= */
function deseneazaPaginile() {
  const poate = admin || mod === "liber";
  paginiEl.innerHTML = `
    <button type="button" data-p="inapoi" title="Pagina dinainte"${poate && pag > 0 ? "" : " disabled"}>‹</button>
    ${pagini.map((_, i) => `<button type="button" class="ta-nr${i === pag ? " is-on" : ""}" data-p="${i}"${poate || i === pag ? "" : " disabled"}>${i + 1}</button>`).join("")}
    <button type="button" data-p="inainte" title="Pagina următoare"${poate && pag < pagini.length - 1 ? "" : " disabled"}>›</button>
    ${admin ? `<button type="button" data-p="noua" title="Pagină nouă">＋</button>
      ${pagini.length > 1 ? `<button type="button" data-p="sterge" class="ta-p-sterge" title="Șterge pagina asta">🗑</button>` : ""}` : ""}`;
}
paginiEl.addEventListener("click", async (e) => {
  const p = e.target.closest("[data-p]");
  if (!p || p.disabled) return;
  const v = p.dataset.p;
  if (v === "inapoi") mergiLaPagina(pag - 1);
  else if (v === "inainte") mergiLaPagina(pag + 1);
  else if (v === "noua" && admin) {
    await salveazaAcum();
    const n = await paginaNoua(lectie.id, pagini.length);
    if (!n) { arataVestea("Pagina nouă n-a intrat în bază.", true); return; }
    pagini.push(n);
    mergiLaPagina(pagini.length - 1);
    trimite("structura", {});
  } else if (v === "sterge" && admin) {
    if (!confirm(`Ștergi pagina ${pag + 1}, cu tot ce e desenat pe ea? Nu se mai poate aduce înapoi.`)) return;
    const id = pagini[pag].id;
    clearTimeout(ceasSalvare);
    if (!(await stergePagina(id))) { arataVestea("Pagina n-a putut fi ștearsă.", true); return; }
    pagini.splice(pag, 1);
    pag = Math.min(pag, pagini.length - 1);
    incarcaPagina();
    trimite("structura", {});
    stareAcum();
  } else if (/^\d+$/.test(v)) mergiLaPagina(Number(v));
});

async function mergiLaPagina(i) {
  if (i < 0 || i >= pagini.length || i === pag) return;
  if (admin) await salveazaAcum();
  else pastreazaPagina();
  pag = i;
  incarcaPagina();
  if (admin) stareAcum();
}
/* Vizitatorul ține desenul paginii pe care o lasă, cu numărul ei. */
function pastreazaPagina() {
  const p = pagini[pag];
  if (p) p.desen = { ...plansa.desenul(), rev: p.desen?.rev || 0 };
}
function incarcaPagina() {
  const p = pagini[pag];
  plansa.incarca(p?.desen);
  plansa.strain = null;
  if (!admin && urmaresc && prof.vedere) plansa.arataZona(prof.vedere);
  else if (admin) plansa.potriveste();
  deseneazaPaginile();
  deseneazaUneltele();
  arataZoom();
}

/* =========================================================
   LIVE: ce trimite profesorul
   ========================================================= */
function trimite(fel, payload) { if (admin && canal) canal.trimite(fel, { ...payload, ceas: Date.now() }); }

function stareaMea() {
  return {
    lectie: lectie?.id || null, pagina: pagini[pag]?.id || null, tab: fila, mod,
    /* O planșă încă nedesenată (fila ascunsă) n-are mărime: se trimite ce era. */
    vedere: plansa.W > 50 && plansa.H > 50 ? plansa.zonaVazuta() : clasa?.stare?.vedere || null,
    derulare: derulareaMea, rev: pagini[pag]?.desen?.rev || 0,
  };
}
let ceasStare = null;
function stareCurand(ms = 300) {
  clearTimeout(ceasStare);
  ceasStare = setTimeout(stareAcum, ms);
}
let ceasStareBaza = null;
function stareAcum() {
  if (!admin || !clasa) return;
  clearTimeout(ceasStare);
  const s = stareaMea();
  trimite("stare", s);
  clasa.stare = s;
  clearTimeout(ceasStareBaza);
  ceasStareBaza = setTimeout(() => schimbaClasa(clasa.id, { stare: s }), 1500);
}
/* Repetată, ca un elev intrat la mijlocul orei să afle singur unde suntem. */
setInterval(() => { if (admin && clasa) trimite("stare", stareaMea()); }, 3000);

function opMea(op) {
  const p = pagini[pag];
  if (!admin || !p) return;
  const rev = (p.desen?.rev || 0) + 1;
  p.desen = { ...plansa.desenul(), rev };
  const bucata = JSON.stringify(op);
  /* Pe canal încape cam 250 KB; o operație mai mare (o imagine mare) nu
     pleacă: elevii iau pagina din bază, după salvare. */
  if (bucata.length < 200000) trimite("op", { pagina: p.id, rev, op });
  salveazaCurand(bucata.length >= 200000);
}

let ceasTrasare = null, deTrimis = null, ultimaTrasare = 0;
function trasareMea(el) {
  if (!admin || !pagini[pag]) return;
  deTrimis = el;
  const acum = Date.now();
  if (!el) { clearTimeout(ceasTrasare); trimite("tras", { pagina: pagini[pag].id, el: null }); return; }
  if (acum - ultimaTrasare > 60) { ultimaTrasare = acum; trimite("tras", { pagina: pagini[pag].id, el }); return; }
  clearTimeout(ceasTrasare);
  ceasTrasare = setTimeout(() => { ultimaTrasare = Date.now(); trimite("tras", { pagina: pagini[pag]?.id, el: deTrimis }); }, 60);
}

/* ---------- salvarea paginii ---------- */
let ceasSalvare = null, deSalvat = null, spuneDupa = false;
function salveazaCurand(spune = false) {
  deSalvat = pagini[pag];
  spuneDupa ||= spune;
  clearTimeout(ceasSalvare);
  ceasSalvare = setTimeout(salveazaAcum, 800);
}
async function salveazaAcum() {
  clearTimeout(ceasSalvare);
  const p = deSalvat;
  deSalvat = null;
  if (!admin || !p) return;
  const ok = await salveazaPagina(p.id, p.desen);
  if (!ok) { arataVestea("Pagina NU s-a salvat: verifică netul.", true); deSalvat ||= p; return; }
  if (spuneDupa) { spuneDupa = false; trimite("reia", { pagina: p.id }); }
}
addEventListener("beforeunload", (e) => { if (deSalvat) { salveazaAcum(); e.preventDefault(); } });

/* =========================================================
   LIVE: ce primește vizitatorul
   ========================================================= */
function laMesaj(fel, m) {
  if (admin) return;
  if (fel === "stare") {
    if (typeof m.ceas === "number" && m.ceas < ceasProf) return;
    ceasProf = m.ceas || ceasProf;
    aplicaStarea(m);
  } else if (fel === "op") {
    const p = pagini.find((x) => x.id === m.pagina);
    if (!p) return;
    const al = p === pagini[pag];
    const rev = p.desen?.rev || 0;
    if (m.rev === rev + 1 && al) {
      plansa.aplica(m.op);
      p.desen = { ...plansa.desenul(), rev: m.rev };
    } else if (m.rev > rev) reiaPaginile(m.pagina, m.rev);
  } else if (fel === "tras") {
    if (m.pagina !== pagini[pag]?.id) return;
    if (m.el?.t === "laser") { plansa.laser = m.el; plansa.strain = null; }
    else { plansa.strain = m.el && typeof m.el === "object" ? m.el : null; if (!m.el) plansa.laser = null; }
    plansa.cere();
  } else if (fel === "reia") reiaPaginile();
  else if (fel === "structura") reiaTot();
}

async function aplicaStarea(s) {
  prof = s || {};
  const veche = mod;
  mod = s.mod === "liber" ? "liber" : "conduc";
  if (s.lectie && s.lectie !== lectie?.id) {
    const l = clasa.lectii.find((x) => x.id === s.lectie);
    if (!l) { await reiaTot(); return; }
    await deschideLectiaVizitator(l);
  } else if (!s.lectie && lectie) {
    lectie = null; pagini = []; arataFila(); deseneazaBara(); deseneazaGolul();
  }
  if (!lectie) { if (veche !== mod) deseneazaBara(); return; }
  if (mod === "conduc") {
    if (s.tab && s.tab !== fila) { fila = s.tab === "material" ? "material" : "tabla"; arataFila(); }
    const i = pagini.findIndex((p) => p.id === s.pagina);
    if (i < 0 && s.pagina) { reiaPaginile(); }
    else if (i >= 0 && i !== pag) { pastreazaPagina(); pag = i; incarcaPagina(); }
    if (fila === "material" && typeof s.derulare === "number") deruleazaLa(s.derulare);
  }
  if (urmaresc && s.vedere && fila === "tabla" && (mod === "conduc" || s.pagina === pagini[pag]?.id)) plansa.arataZona(s.vedere);
  /* A pierdut ceva (un mesaj căzut)? Numărul paginii profesorului o spune. */
  const p = pagini[pag];
  if (p && s.pagina === p.id && typeof s.rev === "number" && s.rev > (p.desen?.rev || 0)) reiaPaginile(p.id, s.rev);
  deseneazaBara();
  deseneazaPaginile();
}

/* Pagina se ia din nou din bază. Profesorul o salvează la o clipă după ce
   desenează; dacă baza n-o are încă la numărul cerut (`rev`), se mai încearcă. */
let ceasReia = null, reiaInZbor = false, dorit = null, incercari = 0;
function reiaPaginile(paginaId = null, rev = 0) {
  if (paginaId && rev) {
    if (dorit?.pagina !== paginaId || rev > dorit.rev) { dorit = { pagina: paginaId, rev }; incercari = 0; }
  }
  clearTimeout(ceasReia);
  ceasReia = setTimeout(async () => {
    if (reiaInZbor || !lectie) return;
    reiaInZbor = true;
    const id = pagini[pag]?.id;
    const p = await paginileCuCod(cod, lectie.id);
    reiaInZbor = false;
    if (!p) return;
    pagini = p;
    pag = Math.max(0, pagini.findIndex((x) => x.id === id));
    incarcaPagina();
    const x = dorit && pagini.find((y) => y.id === dorit.pagina);
    if (x && (x.desen?.rev || 0) < dorit.rev && ++incercari < 5) reiaPaginile();
    else dorit = null;
  }, 900 + incercari * 700);
}
async function reiaTot() {
  const r = await intraCuCodul(cod);
  if (!r.clasa) return;
  clasa = r.clasa;
  materiale.clear();
  lectie = null;
  await aplicaStarea(clasa.stare || {});
  if (fila === "material") deseneazaMaterialul();
}

async function deschideLectiaVizitator(l) {
  lectie = l;
  pagini = (await paginileCuCod(cod, l.id)) || [];
  const i = pagini.findIndex((p) => p.id === prof.pagina);
  pag = i >= 0 ? i : 0;
  if (mod === "conduc") fila = prof.tab === "material" ? "material" : "tabla";
  arataFila();
  incarcaPagina();
  deseneazaBara();
}

/* =========================================================
   MATERIALUL
   ========================================================= */
let derulareaMea = 0;
let ceasDerulare = null;
let materialAfisat = "";

async function deseneazaMaterialul() {
  if (!lectie) return;
  const m = lectie.material || {};
  const cheie = `${lectie.id}|${m.fel || ""}|${m.adresa || m.nume || ""}`;
  const unelteM = admin ? `<div class="ta-mat-unelte">
      <span>${m.fel === "fisier" ? `📄 ${esc(m.nume || "lecția.html")}` : m.fel === "pagina" ? `🔗 ${esc(m.adresa)}` : "Lecția n-are încă material."}</span>
      <span class="ta-g"></span>
      <button type="button" class="ta-btn" data-m="fisier">${m.fel === "fisier" ? "Înlocuiește fișierul" : "Urcă o lecție .html"}</button>
      <button type="button" class="ta-btn" data-m="pagina">Pagină de pe sit</button>
      ${m.fel ? `<button type="button" class="ta-btn ta-btn--rosu" data-m="scoate">Scoate</button>` : ""}
    </div>` : "";
  if (materialAfisat === cheie && filaMaterial.querySelector("iframe")) {
    const u = filaMaterial.querySelector(".ta-mat-unelte");
    if (u) u.outerHTML = unelteM;
    return;
  }
  materialAfisat = cheie;
  if (!m.fel) {
    filaMaterial.innerHTML = `${unelteM}<div class="ta-mat-gol">${admin
      ? "Pune aici lecția ta HTML: o urci ca fișier ori alegi o pagină a sitului."
      : "Profesorul n-a pus încă material la lecția asta."}</div>`;
    return;
  }
  filaMaterial.innerHTML = `${unelteM}<div class="ta-mat-gol">Se deschide materialul…</div>`;
  const cadru = document.createElement("iframe");
  cadru.className = "ta-mat-cadru";
  cadru.title = "Materialul lecției";
  if (m.fel === "pagina" && ADRESA_BUNA.test(m.adresa || "")) {
    cadru.src = m.adresa;
  } else if (m.fel === "fisier") {
    let html = materiale.get(lectie.id);
    if (html == null) {
      html = admin ? await materialulAdmin(lectie.id) : await materialulCuCod(cod, lectie.id);
      if (html == null) { filaMaterial.querySelector(".ta-mat-gol").textContent = "Materialul n-a putut fi adus."; return; }
      materiale.set(lectie.id, html);
    }
    if (materialAfisat !== cheie) return;
    cadru.srcdoc = html;
  } else return;
  filaMaterial.querySelector(".ta-mat-gol")?.remove();
  filaMaterial.append(cadru);
  cadru.addEventListener("load", () => legaDerularea(cadru));
}

/** Derularea materialului: la admin pleacă, la vizitator vine. */
function legaDerularea(cadru) {
  let w;
  try { w = cadru.contentWindow; void w.document; } catch { return; }
  const el = () => w.document.scrollingElement || w.document.documentElement;
  if (admin) {
    w.addEventListener("scroll", () => {
      const s = el();
      derulareaMea = Math.round((s.scrollTop / Math.max(1, s.scrollHeight - s.clientHeight)) * 10000) / 10000;
      clearTimeout(ceasDerulare);
      ceasDerulare = setTimeout(stareAcum, 120);
    }, { passive: true });
  } else if (mod === "conduc" && typeof prof.derulare === "number") deruleazaLa(prof.derulare);
}
function deruleazaLa(p) {
  const cadru = filaMaterial.querySelector("iframe");
  try {
    const d = cadru?.contentWindow?.document;
    const s = d && (d.scrollingElement || d.documentElement);
    if (s) s.scrollTop = p * Math.max(0, s.scrollHeight - s.clientHeight);
  } catch { /* altă origine: nu se poate */ }
}

filaMaterial.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-m]")?.dataset.m;
  if (!b || !admin || !lectie) return;
  if (b === "fisier") { $("#alege-material").click(); return; }
  if (b === "pagina") {
    const r = prompt("Adresa paginii de pe sit, de la bară încolo, de exemplu:\n/lectii/lectura/luceafarul/\n\nAtenție: cât e situl în prelansare, vizitatorii fără cont nu văd paginile lui; o lecție urcată ca fișier .html o văd toți.", lectie.material?.adresa || "/lectii/");
    if (r == null) return;
    const adresa = r.trim().replace(/^https?:\/\/[^/]+/i, "");
    if (!ADRESA_BUNA.test(adresa)) { arataVestea("Adresa trebuie să înceapă cu / și să fie de pe sit.", true); return; }
    await puneMaterialul({ fel: "pagina", adresa }, null);
  } else if (b === "scoate") {
    if (!confirm("Scoți materialul lecției? Fișierul urcat se șterge.")) return;
    await puneMaterialul({}, null);
  }
});
$("#alege-material").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f || !admin || !lectie) return;
  if (!/\.html?$/i.test(f.name)) { arataVestea("Alege un fișier .html.", true); return; }
  if (f.size > 3000000) { arataVestea("Fișierul are peste 3 MB. Micșorează imaginile din el.", true); return; }
  await puneMaterialul({ fel: "fisier", nume: f.name.slice(0, 120) }, await f.text());
});
async function puneMaterialul(material, html) {
  const ok = await schimbaLectia(lectie.id, { material, material_html: html });
  if (!ok) { arataVestea("Materialul n-a intrat în bază.", true); return; }
  lectie.material = material;
  if (html != null) materiale.set(lectie.id, html); else materiale.delete(lectie.id);
  materialAfisat = "";
  derulareaMea = 0;
  deseneazaMaterialul();
  trimite("structura", {});
  arataVestea("Materialul s-a salvat.");
}

/* =========================================================
   PANOUL CU CLASE ȘI LECȚII (adminul)
   ========================================================= */
function deseneazaPanoul() {
  if (!admin) { panou.hidden = true; return; }
  panou.innerHTML = `
    <div class="ta-panou__cap"><h2>Clase</h2><button type="button" class="ta-btn" data-c="noua">+ Clasă</button></div>
    ${clase.length ? "" : `<p class="ta-panou__gol">Încă nicio clasă. Fă prima: de exemplu „12C”.</p>`}
    ${clase.map((c) => `<section class="ta-cl${clasa?.id === c.id ? " is-on" : ""}">
        <div class="ta-cl__cap">
          <button type="button" class="ta-cl__nume" data-c="deschide" data-id="${c.id}">${esc(c.nume)}</button>
          <span class="ta-codul" title="Codul clasei">${esc(c.cod)}</span>
          <button type="button" class="ta-mic" data-c="schimba" data-id="${c.id}" title="Numele și codul">✎</button>
          <button type="button" class="ta-mic ta-mic--rosu" data-c="sterge" data-id="${c.id}" title="Șterge clasa">🗑</button>
        </div>
        ${clasa?.id === c.id ? `<ul class="ta-lec">${c.lectii.map((l) => `<li class="${lectie?.id === l.id ? "is-on" : ""}">
            <button type="button" class="ta-lec__titlu" data-l="deschide" data-id="${l.id}">${esc(l.titlu)}${l.material?.fel ? ` <small title="Are material">📄</small>` : ""}</button>
            <button type="button" class="ta-mic" data-l="sus" data-id="${l.id}" title="Mai sus">↑</button>
            <button type="button" class="ta-mic" data-l="schimba" data-id="${l.id}" title="Titlul">✎</button>
            <button type="button" class="ta-mic ta-mic--rosu" data-l="sterge" data-id="${l.id}" title="Șterge lecția">🗑</button>
          </li>`).join("")}
          <li><button type="button" class="ta-lec__noua" data-l="noua">+ Lecție</button></li></ul>` : ""}
      </section>`).join("")}`;
}

/** „12C" → „012c"; „9A" → „009a". Altfel, patru semne la întâmplare. */
function codPropus(nume) {
  const m = String(nume).toLowerCase().match(/(\d{1,3})\s*([a-z])/);
  let c = m ? `${m[1].padStart(3, "0")}${m[2]}` : "";
  if (!c || clase.some((x) => x.cod === c)) {
    do c = Array.from({ length: 4 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join("");
    while (clase.some((x) => x.cod === c));
  }
  return c;
}
const codBun = (c) => /^[0-9a-z]{4}$/.test(c);

panou.addEventListener("click", async (e) => {
  const c = e.target.closest("[data-c]");
  const l = e.target.closest("[data-l]");
  if (c) {
    const id = c.dataset.id;
    const k = clase.find((x) => x.id === id);
    if (c.dataset.c === "noua") {
      const nume = prompt("Numele clasei (de exemplu 12C):")?.trim();
      if (!nume) return;
      const codul = prompt("Codul de intrare pentru elevi: 4 litere mici ori cifre.", codPropus(nume))?.trim().toLowerCase();
      if (!codul) return;
      if (!codBun(codul)) { arataVestea("Codul are 4 semne: litere mici ori cifre (de exemplu 012c).", true); return; }
      const r = await claseNoua(nume.slice(0, 40), codul, clase.length);
      if (r.eroare) { arataVestea(r.eroare, true); return; }
      clase.push(r.clasa);
      deschideClasa(r.clasa);
    } else if (c.dataset.c === "deschide" && k) deschideClasa(k);
    else if (c.dataset.c === "schimba" && k) {
      const nume = prompt("Numele clasei:", k.nume)?.trim();
      if (!nume) return;
      const codul = prompt("Codul de intrare (4 litere mici ori cifre). Dacă îl schimbi, elevii intră cu cel nou.", k.cod)?.trim().toLowerCase();
      if (!codul || !codBun(codul)) { if (codul) arataVestea("Codul are 4 semne: litere mici ori cifre.", true); return; }
      const er = await schimbaClasa(k.id, { nume: nume.slice(0, 40), cod: codul });
      if (er) { arataVestea(er, true); return; }
      k.nume = nume.slice(0, 40); k.cod = codul;
      deseneazaPanoul(); deseneazaBara();
    } else if (c.dataset.c === "sterge" && k) {
      if (prompt(`Ștergi clasa „${k.nume}”, cu toate lecțiile, paginile și materialele ei? Nu se mai pot aduce înapoi.\n\nScrie numele clasei ca să confirmi:`)?.trim() !== k.nume) return;
      if (!(await stergeClasa(k.id))) { arataVestea("Clasa n-a putut fi ștearsă.", true); return; }
      clase = clase.filter((x) => x.id !== k.id);
      if (clasa?.id === k.id) inchideClasa();
      deseneazaPanoul();
    }
    return;
  }
  if (l && clasa) {
    const id = l.dataset.id;
    const x = clasa.lectii.find((y) => y.id === id);
    if (l.dataset.l === "noua") {
      const titlu = prompt("Titlul lecției:")?.trim();
      if (!titlu) return;
      const n = await lectieNoua(clasa.id, titlu.slice(0, 120), clasa.lectii.length);
      if (!n) { arataVestea("Lecția n-a intrat în bază.", true); return; }
      clasa.lectii.push(n);
      await deschideLectia(n);
      trimite("structura", {});
    } else if (l.dataset.l === "deschide" && x) deschideLectia(x);
    else if (l.dataset.l === "schimba" && x) {
      const titlu = prompt("Titlul lecției:", x.titlu)?.trim();
      if (!titlu || titlu === x.titlu) return;
      if (!(await schimbaLectia(x.id, { titlu: titlu.slice(0, 120) }))) { arataVestea("Titlul nu s-a salvat.", true); return; }
      x.titlu = titlu.slice(0, 120);
      deseneazaPanoul(); deseneazaBara();
      trimite("structura", {});
    } else if (l.dataset.l === "sus" && x) {
      const i = clasa.lectii.indexOf(x);
      if (i <= 0) return;
      clasa.lectii.splice(i, 1);
      clasa.lectii.splice(i - 1, 0, x);
      await Promise.all(clasa.lectii.map((y, k) => (y.ordine === k ? null : (y.ordine = k, schimbaLectia(y.id, { ordine: k })))));
      deseneazaPanoul();
      trimite("structura", {});
    } else if (l.dataset.l === "sterge" && x) {
      if (!confirm(`Ștergi lecția „${x.titlu}”, cu toate paginile ei și materialul? Nu se mai pot aduce înapoi.`)) return;
      if (!(await stergeLectia(x.id))) { arataVestea("Lecția n-a putut fi ștearsă.", true); return; }
      clasa.lectii = clasa.lectii.filter((y) => y.id !== x.id);
      if (lectie?.id === x.id) { lectie = null; pagini = []; arataFila(); deseneazaGolul(); stareAcum(); }
      deseneazaPanoul(); deseneazaBara();
      trimite("structura", {});
    }
  }
});

function legaCanalul() {
  canal?.opreste();
  legat = false;
  canal = canalul(clasa.id, laMesaj, (da) => {
    const era = legat;
    legat = da;
    if (da !== era) deseneazaBara();
    if (da && !era && !admin) reiaTot();
  });
}

async function deschideClasa(k) {
  if (clasa?.id === k.id) { deseneazaPanoul(); return; }
  await salveazaAcum();
  clasa = k;
  lectie = null;
  pagini = [];
  mod = k.stare?.mod === "liber" ? "liber" : "conduc";
  pune(CHEIE_UNDE, JSON.stringify({ clasa: k.id }));
  legaCanalul();
  deseneazaPanoul();
  const l = k.lectii.find((x) => x.id === k.stare?.lectie) || null;
  if (l) await deschideLectia(l, k.stare);
  else { arataFila(); deseneazaBara(); deseneazaGolul(); }
}
function inchideClasa() {
  canal?.opreste();
  canal = null;
  clasa = null; lectie = null; pagini = [];
  arataFila(); deseneazaBara(); deseneazaGolul();
}

async function deschideLectia(l, stare = null) {
  await salveazaAcum();
  lectie = l;
  let p;
  try { p = await paginileAdmin(l.id); } catch { arataVestea("Paginile n-au putut fi aduse.", true); return; }
  if (!p.length) { const n = await paginaNoua(l.id, 0); if (n) p = [n]; }
  pagini = p;
  const i = stare ? pagini.findIndex((x) => x.id === stare.pagina) : -1;
  pag = i >= 0 ? i : 0;
  fila = stare?.tab === "material" ? "material" : "tabla";
  materialAfisat = "";
  derulareaMea = 0;
  pune(CHEIE_UNDE, JSON.stringify({ clasa: clasa.id, lectie: l.id }));
  arataFila();
  incarcaPagina();
  if (stare?.vedere) plansa.arataZona(stare.vedere);
  deseneazaPanoul();
  deseneazaBara();
  stareAcum();
  if (innerWidth < 900) { panou.hidden = true; deseneazaBara(); }
}

function deseneazaGolul() {
  if (clasa && lectie) { golEl.hidden = true; return; }
  golEl.hidden = false;
  golEl.innerHTML = admin
    ? (clasa ? `<p>Clasa <b>${esc(clasa.nume)}</b> (cod <b>${esc(clasa.cod)}</b>). Alege o lecție din panou ori fă una nouă.</p>`
      : `<p>Alege o clasă din panou ori fă una nouă.</p>`)
    : `<p>Profesorul n-a deschis încă nicio lecție. Tabla apare aici singură, când începe.</p>`;
}

/* =========================================================
   INTRAREA CU COD (vizitatorul)
   ========================================================= */
function arataCodul(mesaj = "") {
  const f = $("#cod");
  f.hidden = false;
  scena.hidden = true;
  bara.hidden = true;
  f.innerHTML = `<form class="ta-cod__cutie" autocomplete="off">
      <span class="ta-marca ta-marca--mare">Tabla</span>
      <label for="cod-camp">Codul clasei</label>
      <input id="cod-camp" name="cod" inputmode="text" maxlength="4" placeholder="012c" spellcheck="false" autocapitalize="off" value="${esc(parametri.get("cod") || ia(CHEIE_COD) || "")}">
      <button type="submit" class="ta-btn ta-btn--plin">Intră</button>
      <p class="ta-cod__mesaj" role="status">${esc(mesaj)}</p>
      <p class="ta-cod__nota">Codul ți-l dă profesorul. Are patru semne, de exemplu <b>012c</b>.</p>
    </form>`;
  const camp = $("#cod-camp");
  camp.focus();
  f.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = camp.value.trim().toLowerCase();
    if (!codBun(c)) { f.querySelector(".ta-cod__mesaj").textContent = "Codul are patru semne: litere ori cifre."; return; }
    f.querySelector(".ta-cod__mesaj").textContent = "Se verifică…";
    await intraCu(c);
  });
}

async function intraCu(c, gata = null) {
  const r = gata ? { clasa: gata } : await intraCuCodul(c);
  if (r.eroare) { arataCodul("Fără legătură. Verifică netul și încearcă iar."); return; }
  if (!r.clasa) { pune(CHEIE_COD, null); arataCodul("Codul nu e bun. Verifică-l și încearcă iar."); return; }
  cod = c;
  pune(CHEIE_COD, c);
  clasa = r.clasa;
  $("#cod").hidden = true;
  scena.hidden = false;
  bara.hidden = false;
  document.title = `Tabla · ${clasa.nume}`;
  legaCanalul();
  deseneazaBara();
  deseneazaGolul();
  await aplicaStarea(clasa.stare || {});
  deseneazaGolul();
}

/* =========================================================
   PORNIREA
   ========================================================= */
deseneazaUneltele();
arataZoom();
if (admin) {
  panou.hidden = false;
  deseneazaBara();
  deseneazaGolul();
  try { clase = await clasele(); } catch (e) {
    arataVestea(`Clasele n-au putut fi aduse: ${e?.message || e}`, true);
  }
  deseneazaPanoul();
  let unde = null;
  try { unde = JSON.parse(ia(CHEIE_UNDE) || "null"); } catch { /* nimic */ }
  const numeClasa = (parametri.get("clasa") || "").trim().slice(0, 40);
  let k = clase.find((x) => x.id === unde?.clasa);
  if (numeClasa) {
    /* Venit din Liceu: clasa cu același nume; dacă n-o ai pe tablă, întreabă. */
    const dupaNume = clase.find((x) => x.nume.trim().toLowerCase() === numeClasa.toLowerCase());
    if (dupaNume) k = dupaNume;
    else {
      k = null;
      const propus = codPropus(numeClasa);
      if (confirm(`Clasa ${numeClasa} nu are încă tablă. O fac acum, cu codul ${propus}?`)) {
        const r = await claseNoua(numeClasa, propus, clase.length);
        if (r.eroare) arataVestea(r.eroare, true);
        else { clase.push(r.clasa); k = r.clasa; }
      }
    }
    history.replaceState(null, "", "/tabla/");
  }
  if (k) {
    const l = k.lectii.find((x) => x.id === unde.lectie);
    if (l && k.stare?.lectie !== l.id) k.stare = { ...(k.stare || {}), lectie: l.id };
    await deschideClasa(k);
  }
} else {
  panou.hidden = true;
  const numeClasa = (parametri.get("clasa") || "").trim();
  const c = (parametri.get("cod") || ia(CHEIE_COD) || "").trim().toLowerCase();
  if (numeClasa) {
    /* Venit din Liceu: clasa după nume, fără cod (cât e deschis Liceul). */
    $("#cod").hidden = true;
    const r = await intraCuClasa(numeClasa);
    if (r.clasa) await intraCu(r.clasa.cod, r.clasa);
    else arataCodul(r.eroare ? "Fără legătură. Verifică netul și încearcă iar."
      : `Tabla clasei ${numeClasa} nu e deschisă acum. Intră cu codul primit de la profesor.`);
  } else if (codBun(c)) { $("#cod").hidden = true; await intraCu(c); }
  else arataCodul();
}

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
// VIZITATORUL (oricine nu e admin, logat ori nu) doar privește, și numai cât
// e vizibilă tabla clasei. Fiecare clasă are trei stări (0116): „Automat" (la
// ora clasei din orar, ±2 minute, cu Liceul deschis), „Deschisă" (oricând) și
// „Închisă" (doar profesorul). Fără coduri. Intră din Liceu
// (titlul clasei duce la `/tabla/?clasa=10D`) ori de pe `/tabla/`, unde vede
// doar butoanele claselor deschise acum. Când tabla se închide, e scos pe loc.
// Pagina NU are poarta de prelansare: paza e în bază.
//
// LIVE. Pe canalul clasei pleacă: `stare` (unde e profesorul; repetată la
// 3 secunde, ca un elev intrat târziu să afle singur), `material` (ce s-a
// apăsat și derulat în lecția HTML, ca la telecomanda Liceului), `op` (o schimbare a
// desenului, cu numărul ei, `rev`), `tras` (desenul în curs, ca să se vadă
// cum scrie) și `structura` (s-au schimbat lecțiile, paginile ori materialul:
// se citesc din nou). Cine primește o `op` care nu urmează numărului lui (a
// pierdut un mesaj) ia pagina din nou din bază. Ce rămâne se salvează în bază.
// Cuprins în română, nume în engleză.
// =========================================================
import { isAdmin } from "../../shared/scripts/session.js";
import {
  clasele, claseNoua, schimbaClasa, stergeClasa, lectieNoua, schimbaLectia, stergeLectia,
  paginileAdmin, paginaNoua, salveazaPagina, stergePagina, materialulAdmin, setarileMele, salveazaSetarile,
  tableDeschise, intraCuClasa, tablaVizibila, paginileClasei, materialulClasei, canalul,
} from "../../shared/scripts/tabla-alba-repo.js";
import { ic } from "./tabla-alba-icone.js";
import { Plansa, FUNDALURI, CHENARE, LISTE, BOLD, ITALIC, SUBLINIAT, inchisa } from "./tabla-alba-plansa.js";
/* Puntea spre lecția HTML din fila Material e cea din modulul Liceu: ascultă
   din afară apăsările, tastele, gesturile și derularea, iar la elev le reface
   în același loc (vezi `fisa-punte.js` și `jurnal.js`). */
import { puntea } from "../../highschool/scripts/fisa-punte.js";
import { cePunem } from "../../highschool/scripts/jurnal.js";
import { cuAcelasiZar } from "../../highschool/scripts/zarul.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
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
let clasa = null;          // clasa deschisă: { id, nume, lectii, stare, acces? }
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
  const codul = admin && clasa ? `<div class="ta-mod ta-acces-bara" role="group" aria-label="Cine vede tabla clasei">${ACCES.map(([a, i, n, t]) =>
      `<button type="button" data-acces="${a}" class="${(clasa.acces || "automat") === a ? `is-on ta-acces--${a}` : ""}" title="${t}">${i} ${n}</button>`).join("")}</div>` : "";
  const urmeaza = !admin && clasa && fila === "tabla" ? `<button type="button" class="ta-btn${urmaresc ? " is-on" : ""}" data-bara="urmaresc"
      title="${urmaresc ? "Planșa ta urmează ce vede profesorul" : "Te uiți singur; apasă ca să urmezi iar profesorul"}">${urmaresc ? "◉ Urmăresc" : "○ Mă uit singur"}</button>` : "";
  const stare = clasa ? `<span class="ta-stare" data-fel="${legat ? "live" : "eroare"}">${legat ? "live" : "fără legătură"}</span>` : "";
  bara.innerHTML = `
    ${admin ? `<button type="button" class="ta-btn ta-btn--panou" data-bara="panou" aria-expanded="${!panou.hidden}" title="Clasele și lecțiile">${ic("panou", 18)} Clase</button>` : `<a class="ta-acasa" href="/" title="Atelierul">◂</a>`}
    <span class="ta-marca">Tabla</span>
    <div class="ta-titlu">${titlu}</div>
    ${file}
    <span class="ta-g"></span>
    ${moduri}${codul}${urmeaza}${stare}
    ${!admin && clasa ? `<button type="button" class="ta-btn" data-bara="iesi" title="Ieși din clasa asta">Ieși</button>` : ""}
    <button type="button" class="ta-btn" data-bara="ecran" title="Pe tot ecranul">${ic("potriveste", 18)}</button>`;
}

bara.addEventListener("click", async (e) => {
  const f = e.target.closest("[data-fila]");
  if (f && !f.disabled) { schimbaFila(f.dataset.fila); return; }
  const ac = e.target.closest("[data-acces]");
  if (ac && admin && clasa) { await puneAccesul(clasa, ac.dataset.acces); return; }
  const m = e.target.closest("[data-mod]");
  if (m && admin) { mod = m.dataset.mod; deseneazaBara(); stareAcum(); return; }
  const b = e.target.closest("[data-bara]")?.dataset.bara;
  if (b === "panou") { panou.hidden = !panou.hidden; deseneazaBara(); }
  else if (b === "ecran") {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  } else if (b === "urmaresc") {
    urmaresc = !urmaresc;
    if (urmaresc && prof.vedere) plansa.arataZona(prof.vedere);
    deseneazaBara();
  } else if (b === "iesi") {
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
  if (are && fila === "material") { deseneazaMaterialul(); if (!admin && mod === "conduc") aplicaMaterial(); }
}

/* =========================================================
   UNELTELE (adminul)
   ========================================================= */
/* Iconițele: un singur set, același stil (vezi `tabla-alba-icone.js`). */
const UNELTE = [
  ["selectie", ic("selectie"), "Selecție (V): alegi, muți, mărești; la text, marginea din dreapta îi alege lățimea"],
  ["mana", ic("mana"), "Mâna (H): tragi planșa"],
  ["creion", ic("creion"), "Creion (P)"],
  ["marker", ic("marker"), "Marker de evidențiere (M)"],
  ["radiera", ic("radiera"), "Radieră (E)"],
  ["text", ic("text"), "Text (T). Alt+Enter: un text nou chiar dedesubt"],
  ["linie", ic("linie"), "Linie (L); cu Shift, dreaptă"],
  ["sageata", ic("sageata"), "Săgeată (A)"],
  ["dreptunghi", ic("dreptunghi"), "Dreptunghi (R)"],
  ["elipsa", ic("elipsa"), "Elipsă (O)"],
  ["laser", ic("laser"), "Laser (K): arată, nu rămâne"],
];
const CULORI = ["#1f2430", "#c2410c", "#dc2626", "#2563eb", "#16a34a", "#7c3aed", "#ca8a04", "#ffffff"];
const GROSIMI = [[2, "subțire", 20], [4, "mijlocie", 28], [8, "groasă", 44]];
const NUME_FUNDAL = { alb: "Fără linii", patratele: "Pătrățele", dictando: "Dictando", puncte: "Puncte" };
/* Culorile paginii: albă, crem, verde de tablă, neagră și câteva pale. */
const CULORI_PAGINA = [["#ffffff", "Albă"], ["#fbf6ec", "Crem"], ["#fdf6c9", "Galben pal"], ["#e8f1fb", "Albastru pal"],
  ["#eaf6ec", "Verde pal"], ["#1f4d3a", "Verde de tablă"], ["#1e293b", "Albastru închis"], ["#1f2430", "Neagră"]];
/* Iconițele alinierii: patru rânduri, așezate ca textul. */
const svgAl = (a) => {
  const L = [[16, 10, 16, 8], [16, 10, 16, 8], [16, 10, 16, 8], [16, 16, 16, 10]][["l", "c", "r", "j"].indexOf(a)];
  return `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">${L.map((w, k) => {
    const x = a === "c" ? (20 - w) / 2 : a === "r" ? 18 - w : 2;
    return `<rect x="${x}" y="${3 + k * 4.2}" width="${w}" height="2" rx="1" fill="currentColor"/>`;
  }).join("")}</svg>`;
};
const ALINIERI = [["l", svgAl("l"), "La stânga (Ctrl+L)"], ["c", svgAl("c"), "La mijloc (Ctrl+E)"], ["r", svgAl("r"), "La dreapta (Ctrl+R)"], ["j", svgAl("j"), "Stânga-dreapta, justified (Ctrl+J)"]];
const NUME_LISTE = { b: "Buline", n: "Numere", a: "Litere" };
const NUME_CHENARE = { toate: "Toate", exterior: "Doar exteriorul", interior: "Doar interiorul", orizontale: "Doar orizontale", fara: "Fără chenare" };

/* ---------- implicitele tale, ținute în cont (0117) ---------- */
let setari = { culoare: "#1f2430", grosime: 3, marimeText: 28, fundalCuloare: "#ffffff", fundalLinii: "alb", indent: null };
let ceasSetari = null;
function tineMinte(ce) {
  Object.assign(setari, ce);
  clearTimeout(ceasSetari);
  ceasSetari = setTimeout(() => salveazaSetarile(setari), 800);
}
function aplicaSetarile() {
  plansa.culoare = setari.culoare;
  plansa.grosime = setari.grosime;
  plansa.marimeText = setari.marimeText;
  plansa.indent = setari.indent;
}
/** O pagină nouă pornește cu fundalul tău (culoarea și liniile). */
const desenNou = () => ({ rev: 0, el: [], culoare: setari.fundalCuloare, fundal: setari.fundalLinii });

/* Panoul de lângă bara de unelte: fundalul, listele ori tabelul nou; când e
   ales un tabel, panoul tabelului. */
let panouDeschis = null;
const panouFundal = document.createElement("div");
panouFundal.className = "ta-fundal-panou";
panouFundal.hidden = true;
panouFundal.dataset.pastreazaTextul = "";
filaTabla.append(panouFundal);
unelte.dataset.pastreazaTextul = "";
const formatBara = document.createElement("nav");
formatBara.className = "ta-format-bara";
formatBara.hidden = true;
formatBara.dataset.pastreazaTextul = "";
formatBara.setAttribute("aria-label", "Formatarea textului");
filaTabla.append(formatBara);

function deseneazaUneltele() {
  if (!admin) { unelte.hidden = true; if (panouFundal) panouFundal.hidden = true; if (formatBara) formatBara.hidden = true; return; }
  unelte.hidden = false;
  const sel = plansa.selectate.size;
  const buton = (cls, data, titlu, cont, on = false, dez = false) =>
    `<button type="button" class="ta-u${cls ? ` ${cls}` : ""}${on ? " is-on" : ""}" ${data} title="${titlu}" aria-label="${titlu}"${dez ? " disabled" : ""}>${cont}</button>`;
  unelte.innerHTML = `
    <div class="ta-grup">${UNELTE.map(([u, i, t]) => buton("", `data-u="${u}"`, t, i, plansa.unealta === u)).join("")}
      ${buton("", 'data-a="tabel-nou"', "Tabel nou", ic("tabel"), panouDeschis === "tabelNou")}</div>
    <div class="ta-grup ta-culori">${CULORI.map((c) => `<button type="button" class="ta-cul${plansa.culoare === c ? " is-on" : ""}" data-c="${c}" style="--c:${c}" title="${c}" aria-label="Culoarea ${c}"></button>`).join("")}
      <label class="ta-cul ta-cul--alta" title="Altă culoare"><input type="color" value="${plansa.culoare}" data-alta></label></div>
    <div class="ta-grup">${GROSIMI.map(([g, t]) => `<button type="button" class="ta-gros${plansa.grosime === g ? " is-on" : ""}" data-g="${g}" title="Linie ${t}"><i style="--g:${g}px"></i></button>`).join("")}</div>
    <div class="ta-grup">
      ${buton("", 'data-a="inapoi"', "Înapoi (Ctrl+Z)", ic("inapoi"), false, !plansa.inapoi.length)}
      ${buton("", 'data-a="inainte"', "Înainte (Ctrl+Y)", ic("inainte"), false, !plansa.inainte.length)}
      ${sel ? `${buton("", 'data-a="fata"', "În față, peste celelalte (Ctrl+])", ic("fata"))}
      ${buton("", 'data-a="spate"', "În spate, sub celelalte, și sub text (Ctrl+[)", ic("spate"))}
      ${buton("", 'data-a="dubleaza"', "Dublează selecția (Ctrl+D)", ic("dubleaza"))}
      ${buton("ta-u--rosu", 'data-a="sterge"', "Șterge selecția (Delete)", ic("sterge"))}` : ""}
    </div>
    <div class="ta-grup">
      ${buton("", 'data-a="imagine"', "Pune o imagine (merge și Ctrl+V)", ic("imagine"))}
      ${buton("", 'data-a="fundal"', "Fundalul paginii: culoarea și liniile", ic("fundal"), panouDeschis === "fundal")}
      ${buton("", 'data-a="png"', "Salvează pagina ca imagine", ic("descarca"))}
      ${buton("ta-u--rosu", 'data-a="goleste"', "Golește pagina", ic("goleste"))}
    </div>`;
  /* Formatarea textului, ca în Word: o bară orizontală, sus. */
  formatBara.hidden = false;
  formatBara.innerHTML = `<div class="ta-grup ta-format" title="Pe textul pe care îl scrii ori pe textele (celulele) alese">
      ${buton("", `data-f="${BOLD}"`, "Bold (Ctrl+B)", ic("bold"))}
      ${buton("", `data-f="${ITALIC}"`, "Italic (Ctrl+I)", ic("italic"))}
      ${buton("", `data-f="${SUBLINIAT}"`, "Subliniat (Ctrl+U)", ic("subliniat"))}
      ${ALINIERI.map(([a, i, t]) => buton("ta-u--mic", `data-al="${a}"`, t, i)).join("")}
      ${buton("", 'data-a="liste"', "Liste: buline, numere, litere; nivelul și distanța", ic("liste"), panouDeschis === "liste")}
      ${buton("", 'data-niv="-1"', "Mai puțin înăuntru (Shift+Tab)", ic("afara"))}
      ${buton("", 'data-niv="1"', "Mai înăuntru (Tab)", ic("inauntru"))}
    </div>`;
  deseneazaPanoulLateral();
}

function deseneazaPanoulLateral() {
  const tb = plansa.tabelulAles();
  const ce = panouDeschis || (tb ? "tabel" : null);
  panouFundal.hidden = !ce;
  if (ce === "fundal") {
    panouFundal.innerHTML = `<div class="ta-grup ta-fundal" role="group" aria-label="Fundalul paginii">
      <p>Culoarea paginii</p>
      <div class="ta-fundal__culori">${CULORI_PAGINA.map(([c, n]) => `<button type="button" class="ta-cul${plansa.culoareFundal === c ? " is-on" : ""}" data-fc="${c}" style="--c:${c}" title="${n}" aria-label="Pagina ${n.toLowerCase()}"></button>`).join("")}
        <label class="ta-cul ta-cul--alta" title="Altă culoare"><input type="color" value="${plansa.culoareFundal}" data-fc-alta></label></div>
      <p>Liniile</p>
      <div class="ta-fundal__linii">${FUNDALURI.map((f) => `<button type="button" class="ta-btn${plansa.fundal === f ? " is-on" : ""}" data-ff="${f}">${NUME_FUNDAL[f]}</button>`).join("")}</div>
      <p class="ta-nota">Paginile noi pornesc cu fundalul ales acum.</p>
    </div>`;
  } else if (ce === "liste") {
    const ind = plansa.text?.ind || plansa.indent || Math.round(plansa.marimeText * 1.4);
    panouFundal.innerHTML = `<div class="ta-grup ta-fundal ta-liste" role="group" aria-label="Liste">
      ${Object.entries(LISTE).map(([l, fs]) => `<p>${NUME_LISTE[l]}</p><div class="ta-liste__rand">${fs.map((f) =>
        `<button type="button" class="ta-btn" data-lista="${l}" data-lf="${f}" title="${NUME_LISTE[l]}: ${f}">${l === "b" ? f : f.replace("1", "1").replace("a", "a")}</button>`).join("")}</div>`).join("")}
      <div class="ta-liste__rand"><button type="button" class="ta-btn" data-lista="" title="Fără listă">Fără listă</button></div>
      <p>Nivelul</p>
      <div class="ta-liste__rand"><button type="button" class="ta-btn" data-niv="-1" title="Shift+Tab">⇤ Afară</button><button type="button" class="ta-btn" data-niv="1" title="Tab">Înăuntru ⇥</button></div>
      <p>Distanța indentării: <b data-ind-val>${Math.round(ind)}</b></p>
      <input type="range" min="8" max="160" step="2" value="${Math.round(ind)}" data-ind aria-label="Distanța indentării">
      <p class="ta-nota">Se pune și singură: „1. ", „a) ", „(1) ", „- " la început de rând.</p>
    </div>`;
  } else if (ce === "tabelNou") {
    panouFundal.innerHTML = `<div class="ta-grup ta-fundal ta-tabel-nou" role="group" aria-label="Tabel nou">
      <p>Tabel nou: <b data-dim>3 × 3</b></p>
      <div class="ta-grila">${Array.from({ length: 64 }, (_, k) => `<button type="button" data-tr="${Math.floor(k / 8) + 1}" data-tc="${(k % 8) + 1}" aria-label="${Math.floor(k / 8) + 1} rânduri, ${(k % 8) + 1} coloane"></button>`).join("")}</div>
      <p class="ta-nota">Treci peste pătrățele și apasă: rânduri × coloane.</p>
    </div>`;
  } else if (ce === "tabel") {
    const ch = tb.ch || {};
    const v = (x) => `data-tab="${x}"`;
    panouFundal.innerHTML = `<div class="ta-grup ta-fundal ta-tabel" role="group" aria-label="Tabelul">
      <p>Rânduri și coloane</p>
      <div class="ta-liste__rand">
        <button type="button" class="ta-btn" ${v("rand")} data-v="sus" title="Un rând deasupra">+ rând ↑</button>
        <button type="button" class="ta-btn" ${v("rand")} data-v="jos" title="Un rând dedesubt">+ rând ↓</button>
        <button type="button" class="ta-btn" ${v("coloana")} data-v="stanga" title="O coloană la stânga">+ col. ←</button>
        <button type="button" class="ta-btn" ${v("coloana")} data-v="dreapta" title="O coloană la dreapta">+ col. →</button>
        <button type="button" class="ta-btn ta-btn--rosu" ${v("sterge-rand")}>− rând</button>
        <button type="button" class="ta-btn ta-btn--rosu" ${v("sterge-coloana")}>− col.</button>
      </div>
      <div class="ta-liste__rand">
        <button type="button" class="ta-btn" ${v("imbina")} title="Unește celulele alese (le alegi trăgând peste ele)">Îmbină</button>
        <button type="button" class="ta-btn" ${v("desparte")} title="Desparte celulele îmbinate">Desparte</button>
      </div>
      <p>Alinierea în celule</p>
      <div class="ta-liste__rand">${ALINIERI.map(([a, i, t]) => `<button type="button" class="ta-btn" ${v("orizontal")} data-v="${a}" title="${t}">${i}</button>`).join("")}</div>
      <div class="ta-liste__rand">
        <button type="button" class="ta-btn" ${v("vertical")} data-v="s" title="Sus">⤒ sus</button>
        <button type="button" class="ta-btn" ${v("vertical")} data-v="m" title="La mijloc (implicit)">↕ mijloc</button>
        <button type="button" class="ta-btn" ${v("vertical")} data-v="j" title="Jos">⤓ jos</button>
      </div>
      <p>Fundalul celulelor</p>
      <div class="ta-fundal__culori">${["#fde68a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff", "#f1ebe4"].map((c) => `<button type="button" class="ta-cul" ${v("fundal")} data-v="${c}" style="--c:${c}" title="${c}"></button>`).join("")}
        <button type="button" class="ta-cul ta-cul--fara" ${v("fundal")} data-v="" title="Fără fundal">∅</button></div>
      <p>Chenarele</p>
      <div class="ta-fundal__linii">${CHENARE.map((f) => `<button type="button" class="ta-btn${(ch.f || "toate") === f ? " is-on" : ""}" ${v("chenar")} data-v="${f}">${NUME_CHENARE[f]}</button>`).join("")}</div>
      <div class="ta-liste__rand">
        ${[1, 1.5, 2.5, 4].map((g) => `<button type="button" class="ta-btn${(ch.g || 1.5) === g ? " is-on" : ""}" ${v("chenar-grosime")} data-v="${g}" title="Grosimea liniei">${g}</button>`).join("")}
        <label class="ta-cul ta-cul--alta" title="Culoarea chenarelor"><input type="color" value="${ch.c || "#1f2430"}" data-tab-culoare></label>
      </div>
      <div class="ta-liste__rand"><button type="button" class="ta-btn ta-btn--rosu" ${v("sterge")}>Șterge tabelul</button></div>
      <p class="ta-nota">Alegi celulele trăgând peste ele; dublu-clic într-o celulă ca să scrii (Tab trece mai departe). Marginile se trag; tabelul se mută de ✥.</p>
    </div>`;
  } else panouFundal.innerHTML = "";
}

/* Pe o pagină închisă, creionul negru nu se vede: trece singur pe alb (și invers). */
function culoareaPaginii(c) {
  plansa.fa({ fel: "culoare", c });
  if (inchisa(c) && plansa.culoare === "#1f2430") plansa.culoare = "#ffffff";
  else if (!inchisa(c) && plansa.culoare === "#ffffff") plansa.culoare = "#1f2430";
  tineMinte({ fundalCuloare: c, culoare: plansa.culoare });
  deseneazaUneltele();
}
/* Butoanele care lucrează pe textul deschis nu-i iau cursorul. */
for (const loc of [unelte, panouFundal, formatBara]) {
  loc.addEventListener("mousedown", (e) => {
    if (e.target.closest("button") && plansa.text) e.preventDefault();
  });
}
panouFundal.addEventListener("click", (e) => {
  const fc = e.target.closest("[data-fc]");
  if (fc) { culoareaPaginii(fc.dataset.fc); return; }
  const ff = e.target.closest("[data-ff]");
  if (ff) { plansa.fa({ fel: "fundal", f: ff.dataset.ff }); tineMinte({ fundalLinii: ff.dataset.ff }); deseneazaUneltele(); return; }
  const li = e.target.closest("[data-lista]");
  if (li) { plansa.puneListaText(li.dataset.lista, li.dataset.lf || ""); return; }
  const nv = e.target.closest("[data-niv]");
  if (nv) { plansa.nivelText(Number(nv.dataset.niv)); return; }
  const tr = e.target.closest("[data-tr]");
  if (tr) { panouDeschis = null; plansa.puneTabel(Number(tr.dataset.tr), Number(tr.dataset.tc)); deseneazaUneltele(); return; }
  const tb = e.target.closest("[data-tab]");
  if (tb) {
    const v = tb.dataset.v;
    plansa.tabel(tb.dataset.tab, tb.dataset.tab === "chenar-grosime" ? Number(v) : v);
    deseneazaUneltele();
  }
});
panouFundal.addEventListener("pointerover", (e) => {
  const tr = e.target.closest("[data-tr]");
  if (!tr) return;
  const r = Number(tr.dataset.tr), c = Number(tr.dataset.tc);
  panouFundal.querySelectorAll("[data-tr]").forEach((b) => b.classList.toggle("is-on", Number(b.dataset.tr) <= r && Number(b.dataset.tc) <= c));
  const d = panouFundal.querySelector("[data-dim]");
  if (d) d.textContent = `${r} × ${c}`;
});
panouFundal.addEventListener("input", (e) => {
  if (e.target.matches("[data-ind]")) {
    const px = Number(e.target.value);
    panouFundal.querySelector("[data-ind-val]").textContent = px;
    plansa.puneIndentarea(px);
    tineMinte({ indent: px });
  }
});
panouFundal.addEventListener("change", (e) => {
  if (e.target.matches("[data-fc-alta]")) culoareaPaginii(e.target.value);
  else if (e.target.matches("[data-tab-culoare]")) { plansa.tabel("chenar-culoare", e.target.value); deseneazaUneltele(); }
});

formatBara.addEventListener("click", (e) => {
  const fm = e.target.closest("[data-f]");
  if (fm) { plansa.formateaza(Number(fm.dataset.f)); return; }
  const al = e.target.closest("[data-al]");
  if (al) { plansa.aliniazaText(al.dataset.al); return; }
  const nv = e.target.closest("[data-niv]");
  if (nv) { plansa.nivelText(Number(nv.dataset.niv)); return; }
  if (e.target.closest('[data-a="liste"]')) { panouDeschis = panouDeschis === "liste" ? null : "liste"; deseneazaUneltele(); }
});
unelte.addEventListener("click", (e) => {
  const fm = e.target.closest("[data-f]");
  if (fm) { plansa.formateaza(Number(fm.dataset.f)); return; }
  const al = e.target.closest("[data-al]");
  if (al) { plansa.aliniazaText(al.dataset.al); return; }
  const nv = e.target.closest("[data-niv]");
  if (nv) { plansa.nivelText(Number(nv.dataset.niv)); return; }
  const u = e.target.closest("[data-u]");
  if (u) { panouDeschis = panouDeschis === "liste" ? "liste" : null; plansa.setUnealta(u.dataset.u); return; }
  const c = e.target.closest("[data-c]");
  if (c) { puneCuloarea(c.dataset.c); return; }
  const g = e.target.closest("[data-g]");
  if (g) {
    plansa.grosime = Number(g.dataset.g);
    plansa.marimeText = GROSIMI.find((x) => x[0] === plansa.grosime)?.[2] || 28;
    tineMinte({ grosime: plansa.grosime, marimeText: plansa.marimeText });
    deseneazaUneltele();
    return;
  }
  const a = e.target.closest("[data-a]")?.dataset.a;
  const comuta = (p) => { panouDeschis = panouDeschis === p ? null : p; deseneazaUneltele(); };
  if (a === "inapoi") plansa.anuleaza();
  else if (a === "inainte") plansa.refa();
  else if (a === "sterge") plansa.stergeSelectia();
  else if (a === "dubleaza") plansa.dubleazaSelectia();
  else if (a === "fata" || a === "spate") plansa.ordoneazaSelectia(a);
  else if (a === "imagine") $("#alege-imagine").click();
  else if (a === "fundal") comuta("fundal");
  else if (a === "liste") comuta("liste");
  else if (a === "tabel-nou") comuta("tabelNou");
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
  tineMinte({ culoare: c });
  if (plansa.text) plansa.culoareText(c);
  else if (plansa.selectate.size) plansa.coloreazaSelectia(c);
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
  if ((e.ctrlKey || e.metaKey) && (e.key === "]" || e.key === "[")) { e.preventDefault(); plansa.ordoneazaSelectia(e.key === "]" ? "fata" : "spate"); return; }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && /^[lerj]$/.test(k) && (plansa.selectate.size || plansa.tabelulAles())) {
    e.preventDefault();
    plansa.aliniazaText({ l: "l", e: "c", r: "r", j: "j" }[k]);
    return;
  }
  /* Pe textele selectate cu săgeata, întregi (în textul deschis le face browserul). */
  if ((e.ctrlKey || e.metaKey) && (k === "b" || k === "i" || k === "u")) {
    e.preventDefault();
    plansa.formateaza(k === "b" ? BOLD : k === "i" ? ITALIC : SUBLINIAT);
    return;
  }
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
zoomEl.innerHTML = `<button type="button" data-z="minus" title="Mai mic">${ic("minus", 18)}</button>
  <button type="button" data-z="real" title="Mărimea reală">100%</button>
  <button type="button" data-z="plus" title="Mai mare">${ic("plus", 18)}</button>
  <button type="button" data-z="tot" title="Tot desenul pe ecran">${ic("potriveste", 18)}</button>`;
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
    <button type="button" data-p="inapoi" title="Pagina dinainte"${poate && pag > 0 ? "" : " disabled"}>${ic("stanga", 18)}</button>
    ${pagini.map((_, i) => `<button type="button" class="ta-nr${i === pag ? " is-on" : ""}" data-p="${i}"${poate || i === pag ? "" : " disabled"}>${i + 1}</button>`).join("")}
    <button type="button" data-p="inainte" title="Pagina următoare"${poate && pag < pagini.length - 1 ? "" : " disabled"}>${ic("dreapta", 18)}</button>
    ${admin ? `<button type="button" data-p="noua" title="Pagină nouă">${ic("paginaNoua", 18)}</button>
      ${pagini.length > 1 ? `<button type="button" data-p="sterge" class="ta-p-sterge" title="Șterge pagina asta">${ic("sterge", 18)}</button>` : ""}` : ""}`;
}
paginiEl.addEventListener("click", async (e) => {
  const p = e.target.closest("[data-p]");
  if (!p || p.disabled) return;
  const v = p.dataset.p;
  if (v === "inapoi") mergiLaPagina(pag - 1);
  else if (v === "inainte") mergiLaPagina(pag + 1);
  else if (v === "noua" && admin) {
    await salveazaAcum();
    const n = await paginaNoua(lectie.id, pagini.length, desenNou());
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
    rev: pagini[pag]?.desen?.rev || 0,
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
setInterval(() => { if (admin && clasa) { trimite("stare", stareaMea()); trimiteMaterial(); } }, 3000);

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
  } else if (fel === "material") {
    ultimMaterial = m;
    if (mod === "conduc" && fila === "material") aplicaMaterial();
  } else if (fel === "reia") reiaPaginile();
  else if (fel === "inchis") tablaInchisa();
  else if (fel === "verifica") tablaVizibila(clasa?.id).then((v) => { if (v === false) tablaInchisa(); });
  else if (fel === "structura") reiaTot();
}

async function aplicaStarea(s) {
  prof = s || {};
  const veche = mod;
  mod = s.mod === "liber" ? "liber" : "conduc";
  /* Din „Liber" înapoi la „Conduc eu": lecția HTML a elevului poate să fi
     plecat în altă parte, deci se ia de la capăt după jurnalul profesorului. */
  if (veche === "liber" && mod === "conduc") urm.dinNou = true;
  filaMaterial.classList.toggle("ta-urmeaza", !admin && mod === "conduc");
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
    const p = await paginileClasei(clasa.id, lectie.id);
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
  const r = await intraCuClasa(clasa.nume);
  if (r.eroare) return;
  if (!r.clasa) { tablaInchisa(); return; }
  clasa = r.clasa;
  materiale.clear();
  lectie = null;
  await aplicaStarea(clasa.stare || {});
  if (fila === "material") deseneazaMaterialul();
}

async function deschideLectiaVizitator(l) {
  lectie = l;
  pagini = (await paginileClasei(clasa.id, l.id)) || [];
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
/* Fiecare deschidere a materialului are numărul ei: una pornită înainte, care
   încă aștepta fișierul, se lasă baltă. Altfel, două deschideri din aceeași
   clipă puneau două cadre unul sub altul. */
let materialAfisat = "";
let randMaterial = 0;
let cadruMat = null;
let punte = null;
const MAX_JURNAL = 2000;
/* La profesor: ce s-a făcut în material de la deschiderea lui. */
const jur = { cheie: "", jurnal: [], derulari: {}, slide: 0 };
/* La elev: ce s-a refăcut deja, ce e de refăcut după o reîncărcare. */
const urm = { aplicate: [], deRefacut: null, dinNou: false };
let ultimMaterial = null;

async function deseneazaMaterialul() {
  if (!lectie) return;
  const m = lectie.material || {};
  const cheie = `${lectie.id}|${m.fel || ""}|${m.adresa || m.nume || ""}`;
  const unelteM = admin ? `<div class="ta-mat-unelte">
      <span>${m.fel === "fisier" ? `${ic("fisier", 16)} ${esc(m.nume || "lecția.html")}` : m.fel === "pagina" ? `${ic("legatura", 16)} ${esc(m.adresa)}` : "Lecția n-are încă material."}</span>
      <span class="ta-g"></span>
      <button type="button" class="ta-btn" data-m="fisier">${m.fel === "fisier" ? "Înlocuiește fișierul" : "Urcă o lecție .html"}</button>
      <button type="button" class="ta-btn" data-m="pagina">Pagină de pe sit</button>
      ${m.fel ? `<button type="button" class="ta-btn ta-btn--rosu" data-m="scoate">Scoate</button>` : ""}
    </div>` : "";
  if (materialAfisat === cheie) {
    const u = filaMaterial.querySelector(".ta-mat-unelte");
    if (u) u.outerHTML = unelteM;
    return;
  }
  materialAfisat = cheie;
  const nr = ++randMaterial;
  punte?.uita?.();
  punte = null;
  cadruMat = null;
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
      html = admin ? await materialulAdmin(lectie.id) : await materialulClasei(clasa.id, lectie.id);
      if (nr !== randMaterial) return;
      if (html == null) { filaMaterial.querySelector(".ta-mat-gol").textContent = "Materialul n-a putut fi adus."; return; }
      materiale.set(lectie.id, html);
    }
    if (nr !== randMaterial) return;
    /* Același zar la profesor și la elevi: o lecție care amestecă ceva la
       întâmplare se așază la fel pe toate ecranele, iar apăsările nimeresc. */
    cadru.srcdoc = cuAcelasiZar(html, lectie.id);
  } else return;
  filaMaterial.querySelectorAll(".ta-mat-gol, iframe").forEach((x) => x.remove());
  filaMaterial.append(cadru);
  cadruMat = cadru;
  cadru.addEventListener("load", () => { if (cadru === cadruMat) legaPuntea(cadru, cheie); });
}

/** La fiecare încărcare a materialului: la profesor ascultă, la elev reface. */
function legaPuntea(cadru, cheie) {
  punte?.uita?.();
  punte = puntea(cadru);
  if (admin) {
    jur.cheie = cheie;
    jur.jurnal = [];
    jur.derulari = {};
    jur.slide = punte.slide();
    const inJurnal = (rand) => {
      if (jur.jurnal.length >= MAX_JURNAL) return;
      jur.jurnal.push(rand);
      trimiteMaterialDupaApasare();
    };
    punte.pePunere(inJurnal);
    punte.pePunereGest?.(inJurnal);
    punte.pePunereTasta?.(inJurnal);
    punte.pePunereInchidere?.(inJurnal);
    punte.pePunereDerulare?.((cale, loc) => { jur.derulari[cale] = loc; trimiteDerularea(); });
    trimiteMaterial();
    return;
  }
  punte.ecranulPlinRamaneAlTau();
  if (urm.deRefacut) {
    const lista = urm.deRefacut;
    urm.deRefacut = null;
    lista.forEach((c) => punte.apasa(c));
    urm.aplicate = lista.slice();
  } else urm.aplicate = [];
  if (mod === "conduc") aplicaMaterial();
}

/* ---------- la profesor: ce pleacă ---------- */
function trimiteMaterial() {
  if (!admin || !jur.cheie || jur.cheie !== materialAfisat || !punte) return;
  jur.slide = punte.slide();
  trimite("material", { lectie: lectie?.id, cheie: jur.cheie, slide: jur.slide, jurnal: jur.jurnal, derulari: jur.derulari });
}
/* Apăsarea e prinsă înainte s-o facă lecția; starea pleacă după, cu slide-ul
   ei adevărat (ca la telecomanda Liceului). */
let ceasApasare = null;
function trimiteMaterialDupaApasare() {
  if (ceasApasare !== null) return;
  ceasApasare = setTimeout(() => { ceasApasare = null; trimiteMaterial(); }, 0);
}
let ceasDerulare = null, ultimaDerulare = 0;
function trimiteDerularea() {
  clearTimeout(ceasDerulare);
  const ramas = 120 - (Date.now() - ultimaDerulare);
  const pleaca = () => { ultimaDerulare = Date.now(); trimiteMaterial(); };
  if (ramas <= 0) pleaca(); else ceasDerulare = setTimeout(pleaca, ramas);
}
/* Slide-ul schimbat altfel decât prin apăsare (din cod, la un temporizator):
   se întreabă lecția de trei ori pe secundă. */
setInterval(() => {
  if (admin && punte && fila === "material" && jur.cheie === materialAfisat && punte.slide() !== jur.slide) trimiteMaterial();
}, 350);

/* ---------- la elev: ce vine ---------- */
function aplicaMaterial() {
  const m = ultimMaterial;
  if (!m || admin || !punte || urm.deRefacut || !lectie || m.lectie !== lectie.id || m.cheie !== materialAfisat) return;
  const lista = Array.isArray(m.jurnal) ? m.jurnal.filter((x) => typeof x === "string") : [];
  if (urm.dinNou) { urm.dinNou = false; refaDeLaCapat(lista); return; }
  const ce = cePunem(urm.aplicate, lista);
  if (ce.fel === "de-la-capat") { refaDeLaCapat(lista); return; }
  if (ce.fel === "coada") {
    for (let i = ce.deLa; i < lista.length; i++) punte.apasa(lista[i]);
    urm.aplicate = lista.slice();
  }
  const altSlide = punte.fel !== "fara" && Number.isInteger(m.slide) && punte.slide() !== m.slide;
  if (altSlide) punte.laSlide(m.slide);
  const deruleaza = () => {
    if (!punte?.deruleaza) return;
    for (const [cale, loc] of Object.entries(m.derulari || {}).slice(0, 30)) punte.deruleaza(cale, loc);
  };
  deruleaza();
  if (altSlide) setTimeout(deruleaza, 350);
}
/** Lecția se ia de la început și se refac toate apăsările, după încărcare. */
function refaDeLaCapat(lista) {
  const cadru = cadruMat;
  if (!cadru) return;
  urm.deRefacut = lista.slice();
  urm.aplicate = [];
  try {
    if (cadru.srcdoc) cadru.srcdoc = cadru.srcdoc;
    else cadru.contentWindow.location.replace(cadru.contentWindow.location.href.split("#")[0]);
  } catch { urm.deRefacut = null; }
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
          ${(() => { const [a, i, n, t] = ACCES.find((x) => x[0] === (c.acces || "automat")); return `<button type="button"
            class="ta-acces ta-acces--${a}" data-c="acces" data-id="${c.id}" title="${n}: ${t} Apasă ca s-o treci mai departe.">${i}</button>`; })()}
          <button type="button" class="ta-mic" data-c="schimba" data-id="${c.id}" title="Numele clasei">${ic("creion", 16)}</button>
          <button type="button" class="ta-mic ta-mic--rosu" data-c="sterge" data-id="${c.id}" title="Șterge clasa">${ic("sterge", 16)}</button>
        </div>
        ${clasa?.id === c.id ? `<ul class="ta-lec">${c.lectii.map((l) => `<li class="${lectie?.id === l.id ? "is-on" : ""}">
            <button type="button" class="ta-lec__titlu" data-l="deschide" data-id="${l.id}">${esc(l.titlu)}${l.material?.fel ? ` <small title="Are material">${ic("fisier", 13)}</small>` : ""}</button>
            <button type="button" class="ta-mic" data-l="sus" data-id="${l.id}" title="Mai sus">${ic("sus", 16)}</button>
            <button type="button" class="ta-mic" data-l="schimba" data-id="${l.id}" title="Titlul">${ic("creion", 16)}</button>
            <button type="button" class="ta-mic ta-mic--rosu" data-l="sterge" data-id="${l.id}" title="Șterge lecția">${ic("sterge", 16)}</button>
          </li>`).join("")}
          <li><button type="button" class="ta-lec__noua" data-l="noua">+ Lecție</button></li></ul>` : ""}
      </section>`).join("")}`;
}

/* Cine vede tabla clasei (0116): [stare, semn, nume, ce înseamnă]. */
const ACCES = [
  ["automat", ic("ceas", 16), "Automat", "elevii o văd doar la ora clasei din orar (±2 minute), cu Liceul deschis."],
  ["deschisa", ic("deschis", 16), "Deschisă", "o vede oricine, oricând, logat ori nu."],
  ["inchisa", ic("inchis", 16), "Închisă", "n-o vede nimeni afară de tine, nici la ora clasei."],
];
/** Pune starea tablei clasei. Elevii care o au deschisă își verifică pe loc
 *  dacă o mai pot vedea (la „Închisă" sunt scoși direct). */
async function puneAccesul(k, a) {
  if (!ACCES.some((x) => x[0] === a) || k.acces === a) return;
  const er = await schimbaClasa(k.id, { acces: a });
  if (er) { arataVestea(`Nu s-a putut schimba: ${er}`, true); return; }
  k.acces = a;
  if (clasa?.id === k.id) trimite(a === "inchisa" ? "inchis" : "verifica", {});
  deseneazaPanoul();
  deseneazaBara();
  deseneazaGolul();
  const [, , n, t] = ACCES.find((x) => x[0] === a);
  arataVestea(`Tabla ${k.nume}, ${n.toLowerCase()}: ${t}`);
}

panou.addEventListener("click", async (e) => {
  const c = e.target.closest("[data-c]");
  const l = e.target.closest("[data-l]");
  if (c) {
    const id = c.dataset.id;
    const k = clase.find((x) => x.id === id);
    if (c.dataset.c === "noua") {
      const nume = prompt("Numele clasei, ca în orarul Liceului (de exemplu 12C):")?.trim();
      if (!nume) return;
      const r = await claseNoua(nume.slice(0, 40), clase.length);
      if (r.eroare) { arataVestea(r.eroare, true); return; }
      clase.push(r.clasa);
      deschideClasa(r.clasa);
    } else if (c.dataset.c === "deschide" && k) deschideClasa(k);
    else if (c.dataset.c === "acces" && k) {
      const i = ACCES.findIndex((x) => x[0] === (k.acces || "automat"));
      await puneAccesul(k, ACCES[(i + 1) % ACCES.length][0]);
    }
    else if (c.dataset.c === "schimba" && k) {
      const nume = prompt("Numele clasei, ca în orarul Liceului:", k.nume)?.trim();
      if (!nume || nume === k.nume) return;
      const er = await schimbaClasa(k.id, { nume: nume.slice(0, 40) });
      if (er) { arataVestea(er, true); return; }
      k.nume = nume.slice(0, 40);
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
      const n = await lectieNoua(clasa.id, titlu.slice(0, 120), clasa.lectii.length, desenNou());
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
  if (!p.length) { const n = await paginaNoua(l.id, 0, desenNou()); if (n) p = [n]; }
  pagini = p;
  const i = stare ? pagini.findIndex((x) => x.id === stare.pagina) : -1;
  pag = i >= 0 ? i : 0;
  fila = stare?.tab === "material" ? "material" : "tabla";
  materialAfisat = "";
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
    ? (clasa ? `<p>Clasa <b>${esc(clasa.nume)}</b> (${((ACCES.find((x) => x[0] === (clasa.acces || "automat")) || ACCES[0])[2]).toLowerCase()}). Alege o lecție din panou ori fă una nouă.</p>`
      : `<p>Alege o clasă din panou ori fă una nouă.</p>`)
    : `<p>Profesorul n-a deschis încă nicio lecție. Tabla apare aici singură, când începe.</p>`;
}

/* =========================================================
   INTRAREA (vizitatorul, 0115): fără coduri. Pe /tabla/ se văd doar butoanele
   claselor cu tabla deschisă acum; din Liceu se vine cu `?clasa=10D`.
   ========================================================= */
let ceasLista = null;
async function arataIntrarea(mesaj = "") {
  const f = $("#cod");
  f.hidden = false;
  scena.hidden = true;
  bara.hidden = true;
  clearInterval(ceasLista);
  const deseneaza = async () => {
    const lista = await tableDeschise();
    f.innerHTML = `<div class="ta-cod__cutie" role="status">
        <span class="ta-marca ta-marca--mare">Tabla</span>
        ${mesaj ? `<p class="ta-cod__mesaj">${esc(mesaj)}</p>` : ""}
        ${lista === null ? `<p class="ta-cod__nota">Fără legătură. Verifică netul.</p>`
          : lista.length ? lista.map((n) => `<button type="button" class="ta-btn ta-btn--plin" data-intra="${esc(n)}">Intră la ${esc(n)}</button>`).join("")
          : `<p class="ta-cod__nota">Nicio tablă deschisă acum.</p>`}
      </div>`;
  };
  await deseneaza();
  /* Lista se împrospătează singură: o tablă se deschide la începutul orei. */
  ceasLista = setInterval(() => { if (!document.hidden && !$("#cod").hidden) deseneaza(); }, 30000);
}
$("#cod").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-intra]");
  if (!b) return;
  b.disabled = true;
  await intraLaClasa(b.dataset.intra);
});

async function intraLaClasa(nume) {
  const r = await intraCuClasa(nume);
  if (r.eroare) { await arataIntrarea("Fără legătură. Verifică netul și încearcă iar."); return; }
  if (!r.clasa) { await arataIntrarea("Tabla clasei nu e deschisă acum."); return; }
  clearInterval(ceasLista);
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
  pazaInchiderii();
}

/* Tabla se închide (profesorul a închis-o, s-a terminat ora, s-a închis
   Liceul): elevul e scos pe loc. Profesorul anunță pe canal când o închide el;
   restul se află întrebând baza, la fiecare jumătate de minut și la fiecare
   întoarcere pe pagină. */
let ceasPaza = null;
function pazaInchiderii() {
  clearInterval(ceasPaza);
  const intreaba = async () => {
    if (!clasa || admin) return;
    if ((await tablaVizibila(clasa.id)) === false) tablaInchisa();
  };
  ceasPaza = setInterval(intreaba, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) intreaba(); });
}
function tablaInchisa() {
  if (admin || !clasa) return;
  clearInterval(ceasPaza);
  canal?.opreste();
  canal = null;
  clasa = null; lectie = null; pagini = [];
  plansa.incarca(null);
  materiale.clear();
  materialAfisat = "";
  filaMaterial.innerHTML = "";
  arataIntrarea("Tabla s-a închis.");
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
  /* Implicitele tale (culorile, grosimea, fundalul paginilor noi), din cont. */
  const s0 = await setarileMele();
  if (s0) Object.assign(setari, s0);
  aplicaSetarile();
  deseneazaUneltele();
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
      if (confirm(`Clasa ${numeClasa} nu are încă tablă. O fac acum?`)) {
        const r = await claseNoua(numeClasa, clase.length);
        if (r.eroare) arataVestea(r.eroare, true);
        else { clase.push(r.clasa); k = r.clasa; }
      }
    }
    history.replaceState(null, "", "/tabla/");
  }
  if (k) {
    const l = k.lectii.find((x) => x.id === unde?.lectie);
    if (l && k.stare?.lectie !== l.id) k.stare = { ...(k.stare || {}), lectie: l.id };
    await deschideClasa(k);
  }
} else {
  panou.hidden = true;
  const numeClasa = (parametri.get("clasa") || "").trim().slice(0, 40);
  if (numeClasa) { $("#cod").hidden = true; await intraLaClasa(numeClasa); }
  else await arataIntrarea();
}

// =========================================================
// #LaTablă, redactare: de la 5 la 18 enunțuri.
//
// TIPURI DE ESEU. Tabla știe mai multe eseuri, fiecare cu etichetele și cu
// treptele lui; le alegi sus. Fiecare are tabla lui: ce scrii la unul rămâne
// acolo când treci la altul. Acum sunt două, cu aceeași împărțire, doar cu
// alte etichete la repere:
//   încadrare în curent  – trăsături · scene semnificative · structură și compoziție
//   particularități (liric) – trăsături · două imagini poetice · compoziție și limbaj
//
// Cinci părți, în ordinea asta: Intro, Reper 1, Reper 2, Reper 3, Concluzie.
// Pe prima treaptă e câte un enunț pe parte. Pe treptele următoare, unele părți
// se rescriu în mai multe enunțuri, cu mai multe detalii, altele rămân cum erau.
//
//   treapta   Intro  Reper 1  Reper 2  Reper 3  Concluzie
//      5        1       1        1        1         1
//      8        1       2        2        2         1
//     14        1       4        4        4         1
//     18        1       4        8        4         1
//
// (regula lui Marius, 5 octombrie 2026). Intro și Concluzie nu se rescriu
// niciodată: după treapta 5 apar gata scrise, fără câmp. La fel o parte care
// are pe o treaptă tot atâtea enunțuri câte avea pe cea dinainte (Reper 1 și
// Reper 3 la 18). O parte care crește se rescrie pe grupuri: fiecare enunț
// de pe treapta dinainte stă deasupra, stins și fără număr, iar sub el sunt
// câmpurile în care se desface (doi, la dublare).
//
// Toate enunțurile unei trepte sunt numerotate de la 1 la capăt, și cele gata
// scrise; fără număr rămâne doar enunțul stins de deasupra unui grup.
//
// TIPURILE, ETICHETELE ȘI TREPTELE STAU ÎN PAGINĂ, pe butoanele tipurilor
// (`data-etichete`, `data-trepte`), nu și aici. Pagina și scriptul sunt ținute de browser fiecare pe socoteala lui,
// până la 10 minute după un push (GitHub Pages); cu numerele scrise în două
// locuri, o pagină nouă cu un script vechi ar fi avut butoane care nu fac nimic.
//
// LIVE (0106). Ce scrie adminul, plus treapta pe care e, pleacă în bază și
// ajunge pe loc la toți cei care au tabla deschisă. Ceilalți îl urmează de pe o
// treaptă pe alta. Tabla rămâne scrisă până apasă adminul „Golește", ca un elev
// intrat mai târziu să vadă ce e deja pe ea.
//
// ȘI ELEVUL SCRIE (0108, cerut de Marius pe 17 octombrie 2026). Profesorul
// pornește din tablă („Elevi care scriu") un anumit elev de la meditații;
// acela poate scrie în câmpurile enunțurilor, nimic altceva: treapta, tipul de
// eseu, fișa și golirea rămân ale profesorului. Fiindcă acum pot scrie doi
// oameni deodată, un enunț pleacă SINGUR (`scrieEnunt`), nu toată tabla, iar
// fiecare scriitor primește și ce scrie celălalt, fără să-i fie atins câmpul
// în care scrie chiar atunci.
//
// FIȘA WORD (0107). Sub enunțuri, adminul poate urca o fișă .docx; se vede ca
// în Word, cu pagini, la toți. Golirea curăță enunțurile, nu și fișa.
//
// LUCRĂRILE (17 octombrie 2026, modelul „Grilă"). Elevul pornit își păstrează
// în cont eseul lucrat: o lucrare = o operă + un tip de eseu, într-o zi, cu
// toate treptele ei (vezi `tabla-redactare-lucrari.js`). Opera e pe bară:
// luată din numele fișei Word, ori scrisă de profesor (✎). Din grilă,
// creionul profesorului aduce o lucrare pe tabla live (și elevul ei scrie mai
// departe în aceeași lucrare), iar creionul elevului i-o deschide doar lui.
//
// PENTRU CINE E LUCRUL (0109). Lucrarea de pe tabla live o salvează pagina
// PROFESORULUI, în contul elevilor aleși, nu pagina elevului: așa nu se pierde
// nimic dacă elevul închide tabla, dacă golirea vine prea repede ori dacă nu
// e nimeni pornit. La prima schimbare pe o lucrare nouă tabla îl întreabă pe
// profesor „pentru cine e lucrul acesta?" (elevi anume ori „doar live"), iar
// alegerea stă la vedere pe bară. Golirea salvează întâi.
// Cuprins în română, nume în engleză.
// =========================================================
import { isAdmin, CURRENT_USER } from "../../shared/scripts/session.js";
import { citesteTabla, scrieTabla, urmaresteTabla, urcaFisa, adresaFisa, stergeFisierFisa,
  scrieEnunt, poateScrieTabla, ascultaIngaduinta } from "../../shared/scripts/tabla-live-repo.js";
import { tutoringPupils, setPupilPermission } from "../../shared/scripts/pupils-repo.js";
import { saveSheet, salveazaLucrareaElevului } from "../../shared/scripts/board-repo.js";
import { deschideLucrarile, LECTIE, ziDeAzi, ziFrumoasa, operaDinFisa, operaDinText, textOpera, numeOpera }
  from "./tabla-redactare-lucrari.js";

const SLUG = "redactare-enunturi";

/* Tipurile de eseu, citite din butoanele lor:
     data-etichete="Intro|Reper 1 - …|…|Concluzie"
     data-trepte="5:1,1,1,1,1;8:1,2,2,2,1;…"   (treapta: câte enunțuri pe parte)
   O treaptă se ia doar dacă are câte un număr pe parte și suma lor e chiar
   numărul treptei. */
const TIPURI = (() => {
  const din = [...document.querySelectorAll(".tr-tip")].map((b) => {
    const etichete = String(b.dataset.etichete || "").split("|").map((x) => x.trim()).filter(Boolean);
    const trepte = String(b.dataset.trepte || "").split(";").map((t) => {
      const [n, parti] = t.split(":");
      return { n: Number(n), parti: String(parti || "").split(",").map(Number) };
    }).filter((t) => t.n > 0 && t.parti.length === etichete.length && t.parti.every((x) => x > 0)
      && t.parti.reduce((x, y) => x + y, 0) === t.n);
    return { cheie: b.dataset.tip, etichete, trepte };
  }).filter((t) => t.cheie && t.etichete.length >= 2 && t.trepte.length);
  return din.length ? din : [{
    cheie: "incadrare",
    etichete: ["Intro", "Reper 1 - trăsături", "Reper 2 - scene semnificative",
      "Reper 3 - structură și compoziție", "Concluzie"],
    trepte: [{ n: 5, parti: [1, 1, 1, 1, 1] }, { n: 8, parti: [1, 2, 2, 2, 1] },
      { n: 14, parti: [1, 4, 4, 4, 1] }, { n: 18, parti: [1, 4, 8, 4, 1] }],
  }];
})();

let tip = TIPURI[0].cheie;
const tipul = (c = tip) => TIPURI.find((t) => t.cheie === c) || TIPURI[0];
const trepteLe = () => tipul().trepte.map((t) => t.n);
const partiLa = (n) => tipul().trepte.find((t) => t.n === n).parti;
const treaptaDinainte = (n) => { const t = trepteLe(); return t[t.indexOf(n) - 1]; };
/** Clasa grupului: primul e Intro, ultimul Concluzie, între ele reperele. */
const claseParte = (p, cate) => (p === 0 ? "intro" : p === cate - 1 ? "concluzie" : `r${p}`);
/** Unde începe partea `p` în enunțurile treptei `n`. */
const inceputul = (n, p) => partiLa(n).slice(0, p).reduce((a, x) => a + x, 0);

/**
 * Partea `p` se scrie pe treapta `n`? Pe prima treaptă, da, toate. Mai sus,
 * doar dacă are mai multe enunțuri decât pe treapta dinainte; altfel ia
 * enunțurile de acolo, gata scrise.
 */
function seScrie(n, p) {
  const sus = treaptaDinainte(n);
  return !sus || partiLa(n)[p] > partiLa(sus)[p];
}

/**
 * Textul enunțului `j` din partea `p`, pe treapta `n`. O parte care nu se
 * scrie pe treapta asta îl ia de pe treapta dinainte (și tot așa, în jos).
 * @returns {{text: string, n: number, i: number}} unde stă de fapt enunțul
 */
function enuntul(n, p, j) {
  if (!seScrie(n, p)) return enuntul(treaptaDinainte(n), p, j);
  const i = inceputul(n, p) + j;
  return { text: enunturi[n][i] || "", n, i };
}

const CHEIE_MARIME = "tabla-redactare:marime";
/* Cât se așteaptă după ultima tastă până se trimite. Destul de scurt ca să
   pară live, destul de lung ca să nu plece o cerere la fiecare literă. */
const PAUZA_TRIMITERE = 300;

const foaie = document.getElementById("foaie");
const scrise = document.getElementById("scrise");
const stareEl = document.getElementById("stare");

/** Enunțuri goale pe toate treptele unui eseu. */
const gol = (t = tipul()) => Object.fromEntries(t.trepte.map(({ n }) => [n, Array(n).fill("")]));

/** Starea unui eseu (treapta și enunțurile), adusă la forma lui. */
function normalizeazaTip(t, d) {
  const e = gol(t);
  const din = d?.enunturi || {};
  for (const { n } of t.trepte) {
    const v = Array.isArray(din[n]) ? din[n] : [];
    e[n] = Array.from({ length: n }, (_, i) => String(v[i] ?? ""));
  }
  const trepte = t.trepte.map((x) => x.n);
  return { treapta: trepte.includes(Number(d?.treapta)) ? Number(d.treapta) : trepte[0], enunturi: e };
}

/**
 * Ce vine din bază, adus la forma pe care o știe pagina (orice lipsă = gol):
 * `{ tip, stari: { <tip>: {treapta, enunturi} }, fisa }`.
 * O tablă scrisă înainte de tipuri (`{treapta, enunturi}` direct) e eseul de
 * încadrare, singurul care exista atunci.
 */
function normalizeaza(d) {
  const tipuri = d?.tipuri
    || (d?.enunturi ? { incadrare: { treapta: d.treapta, enunturi: d.enunturi } } : {});
  const stari = Object.fromEntries(TIPURI.map((t) => [t.cheie, normalizeazaTip(t, tipuri[t.cheie])]));
  /* Fișa se ia doar dacă numele fișierului arată cum îl dă urcarea: altfel
     adresa ar putea trimite oriunde. */
  const f = d?.fisa;
  const fisa = f && /^[a-z0-9-]+\.docx$/.test(String(f.fisier || ""))
    ? { fisier: f.fisier, nume: String(f.nume || "fișa.docx"), marime: Number(f.marime) || 0 } : null;
  /* Opera scrisă de profesor (altfel se ia din numele fișei) și lucrarea adusă
     din grilă, în care scrie mai departe elevul ei. */
  const o = d?.opera;
  const opera = o && typeof o.nume === "string" && o.nume.trim()
    ? { nume: o.nume.trim().slice(0, 120), autor: String(o.autor || "").trim().slice(0, 120) } : null;
  const s = d?.sursa;
  const UUID = /^[0-9a-f-]{36}$/i;
  const sursa = s && UUID.test(String(s.id)) && UUID.test(String(s.elev)) && TIPURI.some((t) => t.cheie === s.tip)
    ? { id: s.id, elev: s.elev, tip: s.tip, titlu: String(s.titlu || "").slice(0, 200),
        zi: /^\d{4}-\d{2}-\d{2}$/.test(String(s.zi)) ? s.zi : ziDeAzi() } : null;
  /* Pentru cine e lucrul: elevii în contul cărora se salvează lucrarea, ori
     „doar live" (decis, fără elevi). Nedecis = încă n-a întrebat nimeni. */
  const pe = d?.pentru;
  const pentru = {
    decis: !!pe?.decis,
    elevi: (Array.isArray(pe?.elevi) ? pe.elevi : []).filter((e) => UUID.test(String(e?.id)))
      .slice(0, 20).map((e) => ({ id: e.id, nume: String(e.nume || "elev").slice(0, 80) })),
  };
  /* Când a început lucrarea de acum („2026-10-17T11:45"): intră în titlul ei, ca
     două lucrări la aceeași operă, în aceeași zi, să nu se calce. */
  const inceput = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(d?.inceput)) ? d.inceput : null;
  /* Lucrarea fiecărui elev, după prima salvare: „tip|elev" → id. De aici încolo
     se scrie doar în ea, oricât s-ar schimba titlul. */
  const ids = {};
  for (const [k, v] of Object.entries(d?.ids || {}).slice(0, 60)) {
    const [t, e] = String(k).split("|");
    if (TIPURI.some((x) => x.cheie === t) && UUID.test(String(e)) && UUID.test(String(v))) ids[`${t}|${e}`] = v;
  }
  return { tip: TIPURI.some((t) => t.cheie === d?.tip) ? d.tip : TIPURI[0].cheie, stari, fisa, opera, sursa, pentru, inceput, ids };
}

/* `admin` conduce tabla (treapta, tipul, fișa, golirea); `scriu` = poate scrie
   în câmpuri: adminul și elevul pornit de el (0108). */
let admin = isAdmin();
let ingaduit = false;
let scriu = admin;
/* Starea fiecărui eseu stă în `stari`; cea a eseului deschis e ținută la
   îndemână în `treapta` și `enunturi`, și pusă înapoi la schimbare ori trimitere. */
let stari = {};
let treapta = 0;
let enunturi = {};
let fisa = null;
let opera = null;      // opera scrisă de profesor; altfel, cea din numele fișei
let sursa = null;      // lucrarea adusă din grilă: { id, elev, tip, titlu, zi }
let privat = null;     // lucrarea deschisă doar pentru elev: { id, titlu, data }
let pentru = { decis: false, elevi: [] };   // în contul cui se salvează lucrul live
let inceput = null;    // când a început lucrarea live de acum
let ids = {};          // lucrarea fiecărui elev: „tip|elev" → id
function incarca(nou) {
  ({ tip, stari, fisa, opera, sursa, pentru, inceput, ids } = nou);
  ({ treapta, enunturi } = stari[tip]);
}
const pastreazaTipul = () => { stari[tip] = { treapta, enunturi }; };
incarca(normalizeaza(null));

const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Un enunț de scris: numărul lui pe treaptă și câmpul. */
function camp(n, i, nr) {
  return `<div class="tr-rand">
      <span class="tr-nr">${nr}.</span>
      <textarea class="tr-camp" rows="1" data-n="${n}" data-i="${i}"${scriu ? "" : " readonly tabindex=\"-1\""}
        aria-label="Enunțul ${nr} din ${n}" placeholder="${scriu ? `Enunțul ${nr}` : ""}">${esc(enunturi[n][i])}</textarea>
    </div>`;
}

/** Un enunț gata scris, adus de pe o treaptă de mai jos: cu număr, fără câmp. */
function fix(text, nr) {
  return `<div class="tr-rand tr-rand--fix">
      <span class="tr-nr">${nr}.</span>
      <p class="tr-fix">${text.trim() ? esc(text) : "<em>încă nescris</em>"}</p>
    </div>`;
}

function deseneaza() {
  const n = treapta;
  const sus = treaptaDinainte(n);
  document.body.classList.toggle("tr--citeste", !scriu);
  let nr = 0;
  const etichete = tipul().etichete;
  foaie.innerHTML = etichete.map((eticheta, p) => {
    const cati = partiLa(n)[p];
    let corp = "";
    if (!seScrie(n, p)) {
      /* Gata scrisă: enunțurile de pe treapta dinainte, numerotate aici. */
      corp = Array.from({ length: cati }, (_, j) => fix(enuntul(n, p, j).text, ++nr)).join("");
    } else if (!sus) {
      /* Prima treaptă: câte un câmp. */
      corp = Array.from({ length: cati }, (_, j) => camp(n, inceputul(n, p) + j, ++nr)).join("");
    } else {
      /* Partea crește: pe grupuri, câte unul pentru fiecare enunț de mai jos.
         Câți copii are fiecare: cât mai egal, cu unul în plus la cele dintâi
         (la dublare iese exact doi). */
      const parinti = partiLa(sus)[p];
      const baza = Math.floor(cati / parinti);
      const inPlus = cati % parinti;
      let j = 0;
      corp = Array.from({ length: parinti }, (_, k) => {
        const copii = baza + (k < inPlus ? 1 : 0);
        const parinte = enuntul(sus, p, k).text.trim();
        const html = `<div class="tr-subgrup">
            <p class="tr-parinte">${parinte ? esc(parinte) : "<em>enunțul de mai jos e încă gol</em>"}</p>
            ${Array.from({ length: copii }, () => camp(n, inceputul(n, p) + j++, ++nr)).join("")}
          </div>`;
        return html;
      }).join("");
    }
    return `<section class="tr-grup tr-grup--${claseParte(p, etichete.length)}${seScrie(n, p) ? "" : " tr-grup--fix"}">
        <span class="tr-eticheta">${esc(eticheta)}</span>
        ${corp}
      </section>`;
  }).join("");
  /* Treptele se desenează din eseul deschis: alt eseu poate avea alte trepte. */
  document.getElementById("trepte").innerHTML = trepteLe().map((t) => `<button type="button"
      role="tab" class="tr-treapta${t === n ? " is-on" : ""}" data-n="${t}" aria-selected="${t === n}"${
      !admin && !privat && t !== n ? " disabled" : ""}>${t}</button>`).join("");
  document.querySelectorAll(".tr-tip").forEach((b) => {
    const e = b.dataset.tip === tip;
    b.classList.toggle("is-on", e);
    b.setAttribute("aria-selected", String(e));
    b.disabled = privat ? !e : !admin && !e;
  });
  document.getElementById("goleste").hidden = !admin;
  if (btnElevi) btnElevi.hidden = !admin;
  deseneazaLucrarile();
  foaie.querySelectorAll(".tr-camp").forEach(potriveste);
  numara();
  deseneazaFisa();
}

/* Câmpul crește odată cu enunțul, fără bară de derulare în el. */
function potriveste(t) {
  t.style.height = "auto";
  t.style.height = `${t.scrollHeight}px`;
}

/** Câte enunțuri ale treptei au text, cu tot cu cele gata scrise. */
function numara() {
  let gata = 0;
  tipul().etichete.forEach((_, p) => {
    for (let j = 0; j < partiLa(treapta)[p]; j++) if (enuntul(treapta, p, j).text.trim()) gata++;
  });
  scrise.textContent = `${gata} / ${treapta} scrise`;
}

function arataStarea(text, fel = "") {
  stareEl.textContent = text;
  stareEl.dataset.fel = fel;
}

/* ---------- trimiterea ----------
   Toată tabla (treapta, tipul, fișa, golirea) o trimite doar adminul. Un enunț
   pleacă singur, de la oricine scrie (vezi `trimiteEnuntul`). */
let ceas = null;
let inZbor = false;
let maiAm = false;
function trimiteCurand() {
  if (privat) { salveazaPrivatCurand(); return; }
  if (!admin) return;
  arataStarea("se trimite…", "trimite");
  clearTimeout(ceas);
  ceas = setTimeout(trimite, PAUZA_TRIMITERE);
  lucrareaSeSchimba();
}
async function trimite() {
  /* O singură cerere pe drum. Dacă între timp s-a mai scris, se trimite încă
     o dată la sosire, cu tot ce e nou: ultima versiune ajunge mereu. */
  if (inZbor) { maiAm = true; return; }
  inZbor = true;
  pastreazaTipul();
  const ok = await scrieTabla(SLUG, { tip, tipuri: stari, fisa, opera, sursa, pentru, inceput, ids });
  inZbor = false;
  if (maiAm) { maiAm = false; trimite(); return; }
  arataStarea(ok ? "live · trimis" : "netrimis: verifică netul", ok ? "live" : "eroare");
}

/* Enunțurile scrise aici și încă neconfirmate de bază, pe chei „tip|n|i”. Ce
   vine din bază între timp nu le atinge: ultima vorbă e a celui care scrie. */
const murdare = new Map();
const ceasuri = new Map();
/* Golirea mută „generația": un enunț pornit înainte de golire nu mai pleacă după
   ea, altfel s-ar întoarce pe tabla abia golită. */
let generatie = 0;
function uitaTrimiterile() {
  generatie++;
  for (const c of ceasuri.values()) clearTimeout(c);
  ceasuri.clear();
  murdare.clear();
}
function trimiteEnuntul(n, i) {
  const cheie = `${tip}|${n}|${i}`;
  const t0 = tip;
  const g0 = generatie;
  murdare.set(cheie, enunturi[n][i]);
  arataStarea("se trimite…", "trimite");
  clearTimeout(ceasuri.get(cheie));
  ceasuri.set(cheie, setTimeout(async () => {
    const text = murdare.get(cheie);
    if (g0 !== generatie || text === undefined) return;
    const r = await scrieEnunt(SLUG, t0, Number(n), Number(i), text);
    if (murdare.get(cheie) === text) murdare.delete(cheie);
    if (r === "gata") { if (!murdare.size) arataStarea(admin ? "live · trimis" : "live · scrii și tu", "live"); }
    else if (r === "inchis") arataStarea("nu mai poți scrie acum", "eroare");
    else arataStarea("netrimis: verifică netul", "eroare");
  }, PAUZA_TRIMITERE));
}

function mergiLa(n) {
  if (!(admin || privat) || !trepteLe().includes(n) || n === treapta) return;
  treapta = n;
  deseneaza();
  document.querySelector(".tr-zona").scrollTop = 0;
  foaie.querySelector(".tr-camp")?.focus();
  trimiteCurand();
}

foaie.addEventListener("input", (e) => {
  const t = e.target.closest(".tr-camp");
  if (!t || !scriu) return;
  enunturi[t.dataset.n][Number(t.dataset.i)] = t.value;
  potriveste(t);
  numara();
  if (privat) { salveazaPrivatCurand(); return; }
  trimiteEnuntul(t.dataset.n, t.dataset.i);
  lucrareaSeSchimba();
});

/* Enter trece la enunțul următor; un enunț nu are nevoie de rând nou. */
foaie.addEventListener("keydown", (e) => {
  const t = e.target.closest(".tr-camp");
  if (!t || e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  const toate = [...foaie.querySelectorAll(".tr-camp")];
  toate[toate.indexOf(t) + 1]?.focus();
});

document.getElementById("trepte").addEventListener("click", (e) => {
  const b = e.target.closest(".tr-treapta");
  if (b) mergiLa(Number(b.dataset.n));
});

/** Treci la alt eseu: cel de acum își păstrează enunțurile și treapta. */
function schimbaTipul(c) {
  if (!admin || c === tip || !TIPURI.some((t) => t.cheie === c)) return;
  pastreazaTipul();
  tip = c;
  ({ treapta, enunturi } = stari[tip]);
  deseneaza();
  document.querySelector(".tr-zona").scrollTop = 0;
  foaie.querySelector(".tr-camp")?.focus();
  trimiteCurand();
}
document.querySelectorAll(".tr-tip").forEach((b) =>
  b.addEventListener("click", () => schimbaTipul(b.dataset.tip)));

/* Scrisul mai mare ori mai mic, pentru proiector. Al fiecăruia, în browserul lui. */
let marime = 1;
try { marime = Number(localStorage.getItem(CHEIE_MARIME)) || 1; } catch { /* nimic */ }
const punMarimea = () => {
  marime = Math.min(1.8, Math.max(0.8, Math.round(marime * 10) / 10));
  document.documentElement.style.setProperty("--tr-marime", marime);
  try { localStorage.setItem(CHEIE_MARIME, String(marime)); } catch { /* nimic */ }
  foaie.querySelectorAll(".tr-camp").forEach(potriveste);
};
document.getElementById("mic").addEventListener("click", () => { marime -= 0.1; punMarimea(); });
document.getElementById("mare").addEventListener("click", () => { marime += 0.1; punMarimea(); });

document.getElementById("goleste").addEventListener("click", async () => {
  if (!admin) return;
  if (!trepteLe().some((n) => enunturi[n].some((x) => x.trim()))) return;
  const nume = document.querySelector(`.tr-tip[data-tip="${tip}"]`)?.textContent.trim() || "acesta";
  /* ÎNTÂI SE SALVEAZĂ. Lucrarea pleacă în contul elevilor ei chiar acum, nu
     peste câteva secunde, ca golirea să nu-i ia ultimele rânduri. Dacă n-are
     niciun elev, tabla întreabă dacă o trimiți cuiva. */
  if (pentru.elevi.length) {
    arataSalvarea("se salvează înainte de golire…");
    if (!(await salveazaLaElevi())) {
      if (!confirm("Lucrarea NU s-a putut salva la elev (vezi mesajul de sub bară). Golești totuși tabla? Ce e scris se pierde.")) return;
    } else if (!confirm(`Lucrarea s-a salvat la ${pentru.elevi.map((e) => e.nume).join(", ")}.\n\nGolești eseul „${nume}" pentru un lucru nou? Celălalt eseu și fișa rămân.`)) return;
  } else {
    const ales = await intreaba("Lucrarea nu e salvată la niciun elev",
      `Ce e scris acum la „${nume}" se pierde la golire. O trimiți întâi în contul unui elev?`,
      [["trimite", "Aleg elevul și salvez", "plin"], ["goleste", "Golește fără salvare", "sterge"], ["nu", "Anulează", ""]]);
    if (ales === "nu" || !ales) return;
    if (ales === "trimite") {
      if (!(await alegePentru())) return;
      if (!pentru.elevi.length || !(await salveazaLaElevi())) return;
      if (!confirm(`Lucrarea s-a salvat la ${pentru.elevi.map((e) => e.nume).join(", ")}.\n\nGolești acum eseul „${nume}"?`)) return;
    }
  }
  clearTimeout(ceas);
  uitaTrimiterile();
  enunturi = gol();
  treapta = trepteLe()[0];
  sursa = null;           // tabla golită începe o lucrare nouă
  pentru = { decis: false, elevi: [] };
  inceput = null;
  ids = {};
  intrebatPentru = false;
  arataSalvarea("");
  deseneaza();
  arataStarea("se golește…", "trimite");
  await trimite();
  foaie.querySelector(".tr-camp")?.focus();
});

/* ---------- fișa Word de sub tablă ---------- */
const sectiuneFisa = document.getElementById("fisa");
const alegeFisa = document.getElementById("alege-fisa");
let fisaAfisata = "";        // fișierul desenat acum, ca să nu se redeseneze degeaba
let docxPreview = null;

const marimeMB = (o) => {
  if (!o) return "";
  if (o < 1024 * 1024) return ` · ${Math.max(1, Math.round(o / 1024))} KB`;
  return ` · ${(o / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
};

function deseneazaFisa(mesaj = "") {
  const unelte = admin
    ? `<div class="tr-fisa__unelte">
         <button type="button" class="tr-btn" data-fisa="urca">${fisa ? "Înlocuiește fișa" : "+ Urcă fișa Word"}</button>
         ${fisa ? `<button type="button" class="tr-btn tr-btn--sterge" data-fisa="scoate">Scoate fișa</button>` : ""}
         ${mesaj ? `<span class="tr-fisa__mesaj">${esc(mesaj)}</span>` : ""}
       </div>` : "";
  if (!fisa) {
    sectiuneFisa.hidden = !admin;
    sectiuneFisa.innerHTML = `<div class="tr-fisa__cap">${unelte}</div>`;
    fisaAfisata = "";
    return;
  }
  sectiuneFisa.hidden = false;
  /* A− și A+ sunt ale fiecăruia, nu ale tablei: elevul își mărește fișa pe
     ecranul lui, fără să i-o mărească și colegului. */
  const zoom = `<div class="tr-fisa__zoom" role="group" aria-label="Mărimea fișei">
      <button type="button" class="tr-btn" data-zoom="-1" title="Fișa mai mică">A−</button>
      <button type="button" class="tr-btn tr-fisa__procent" data-zoom="0" title="Înapoi cât ecranul">${Math.round(zoomFisa * 100)}%</button>
      <button type="button" class="tr-btn" data-zoom="1" title="Fișa mai mare">A+</button>
    </div>`;
  const cap = `<h2 class="tr-fisa__titlu">Fișa de lucru <small>${esc(fisa.nume)}${marimeMB(fisa.marime)}</small></h2>${zoom}${unelte}`;
  /* Aceeași fișă: se schimbă doar capul (un mesaj, butoanele); paginile rămân,
     nedesenate din nou. */
  if (fisaAfisata === fisa.fisier && sectiuneFisa.querySelector(".tr-fisa__pagini")) {
    sectiuneFisa.querySelector(".tr-fisa__cap").innerHTML = cap;
    return;
  }
  sectiuneFisa.innerHTML = `
    <div class="tr-fisa__cap">${cap}</div>
    <div class="tr-fisa__pagini"><p class="tr-fisa__stare">Se deschide fișa…</p></div>`;
  fisaAfisata = fisa.fisier;
  arataFisa(fisa.fisier, sectiuneFisa.querySelector(".tr-fisa__pagini"));
}

/** Aduce fișierul și îl desenează ca în Word, pagină cu pagină (docx-preview). */
async function arataFisa(fisier, unde) {
  try {
    docxPreview ||= await import("https://esm.sh/docx-preview@0.4.1?deps=jszip@3.10.1");
    const r = await fetch(adresaFisa(fisier));
    if (!r.ok) throw new Error(`fișa n-a venit (${r.status})`);
    const octeti = await r.arrayBuffer();
    if (fisaAfisata !== fisier) return;   // între timp a venit alta
    unde.innerHTML = "";
    await docxPreview.renderAsync(octeti, unde, null, {
      className: "docx", inWrapper: true, breakPages: true,
      /* Paginile se rup unde le-a rupt Word ultima dată, ca fișa să arate ca
         pe ecranul tău, nu ca o singură foaie lungă. */
      ignoreLastRenderedPageBreak: false, experimental: true,
    });
    incadreazaFisa();
  } catch (e) {
    console.warn("tabla-redactare, fișa:", e);
    if (fisaAfisata !== fisier) return;
    unde.innerHTML = `<p class="tr-fisa__stare">Fișa n-a putut fi arătată aici.
      <a href="${esc(adresaFisa(fisier))}" download>Descarc-o</a> și deschide-o în Word.</p>`;
  }
}

/* O pagină A4 are cam 794 px. Pe un ecran mai îngust (telefon, fereastră
   pe jumătate), pagina se micșorează cât să încapă, în loc să se deruleze în
   lateral. Pe ecran lat rămâne la mărimea ei. Peste asta vine mărirea aleasă
   cu A+ / A− (`zoomFisa`); mai mare decât ecranul, fișa se derulează în lateral. */
const CHEIE_ZOOM_FISA = "tabla-redactare:zoom-fisa";
let zoomFisa = 1;
try { zoomFisa = Number(localStorage.getItem(CHEIE_ZOOM_FISA)) || 1; } catch { /* nimic */ }
/* MĂRITĂ, FIȘA IESE DIN COLOANA TABLEI și se întinde pe toată lățimea ferestrei
   (cerut de Marius, 17 octombrie 2026: „să se întindă pe toată lățimea
   ferestrei, nu trunchiat"). Nu crește niciodată peste lățimea ferestrei:
   A+ se oprește acolo, ca pagina să nu fie tăiată pe margine. */
function puneZoomFisa(pas) {
  zoomFisa = pas === 0 ? 1 : Math.min(3, Math.max(0.5, Math.round((zoomFisa + pas * 0.25) * 100) / 100));
  incadreazaFisa();
  try { localStorage.setItem(CHEIE_ZOOM_FISA, String(zoomFisa)); } catch { /* nimic */ }
}
function incadreazaFisa() {
  sectiuneFisa.classList.toggle("tr-fisa--lat", zoomFisa > 1);
  const pagini = sectiuneFisa.querySelector(".tr-fisa__pagini");
  const invelis = pagini?.querySelector(".docx-wrapper");
  const pagina = invelis?.querySelector("section.docx");
  const procent = sectiuneFisa.querySelector(".tr-fisa__procent");
  if (!pagina) { if (procent) procent.textContent = `${Math.round(zoomFisa * 100)}%`; return; }
  invelis.style.zoom = "";
  /* Cât încape: lățimea locului împărțită la lățimea paginii, în mărimea ei. */
  const incape = pagini.clientWidth / pagina.offsetWidth;
  if (zoomFisa > incape && zoomFisa > 1) zoomFisa = Math.max(1, Math.floor(incape * 100) / 100);
  const scara = zoomFisa > 1 ? zoomFisa : Math.min(1, incape) * zoomFisa;
  if (scara !== 1) invelis.style.zoom = String(Math.floor(scara * 1000) / 1000);
  if (procent) procent.textContent = `${Math.round(zoomFisa * 100)}%`;
}
addEventListener("resize", incadreazaFisa);

sectiuneFisa.addEventListener("click", async (e) => {
  const z = e.target.closest("[data-zoom]");
  if (z) { puneZoomFisa(Number(z.dataset.zoom)); return; }
  const b = e.target.closest("[data-fisa]");
  if (!b || !admin) return;
  if (b.dataset.fisa === "urca") { alegeFisa.click(); return; }
  if (b.dataset.fisa === "scoate") {
    if (!confirm("Scoți fișa de sub tablă? Dispare și la elevi.")) return;
    const veche = fisa?.fisier;
    fisa = null;
    deseneazaFisa();
    clearTimeout(ceas);
    await trimite();
    stergeFisierFisa(veche);
  }
});

alegeFisa.addEventListener("change", async () => {
  const file = alegeFisa.files?.[0];
  alegeFisa.value = "";
  if (!file || !admin) return;
  deseneazaFisa("se urcă fișa…");
  const r = await urcaFisa(SLUG, file);
  if (r.eroare) { deseneazaFisa(r.eroare); return; }
  const veche = fisa?.fisier;
  fisa = r.fisa;
  deseneazaFisa();
  clearTimeout(ceas);
  await trimite();
  if (veche && veche !== fisa.fisier) stergeFisierFisa(veche);
});

addEventListener("resize", () => foaie.querySelectorAll(".tr-camp").forEach(potriveste));

/* ---------- „Elevi care scriu” (doar adminul) ----------
   Lista elevilor de la meditații, fiecare cu comutatorul lui, ca la „Etichetare”
   și „EleviMED”. Butonul se face aici, nu în pagină: pagina și scriptul pot fi
   ținute de browser pe socoteli diferite până la 10 minute după un push. */
const btnElevi = document.createElement("button");
btnElevi.type = "button";
btnElevi.className = "tr-btn tr-elevi__btn";
btnElevi.hidden = true;
btnElevi.setAttribute("aria-expanded", "false");
const panouElevi = document.createElement("div");
panouElevi.className = "tr-elevi";
panouElevi.hidden = true;
document.getElementById("goleste").before(btnElevi);
document.body.append(panouElevi);
let elevi = null;            // null = încă neadusă
let eleviProblema = "";
const eleviInZbor = new Set();

const catiScriu = () => (elevi || []).filter((p) => p.can.tabla).length;
function deseneazaElevii() {
  const n = catiScriu();
  btnElevi.innerHTML = `Elevi care scriu <b>${elevi ? n : "…"}</b>`;
  btnElevi.classList.toggle("is-on", n > 0);
  btnElevi.title = n > 0 ? "Elevii porniți pot scrie enunțuri pe tablă. Apasă ca să vezi lista."
    : "Niciun elev nu scrie acum. Apasă ca să pornești pe cine lucrează cu tine.";
  if (panouElevi.hidden) return;
  if (eleviProblema) {
    panouElevi.innerHTML = `<p class="tr-elevi__gol">N-am putut citi lista de la meditații.<br><code>${esc(eleviProblema)}</code></p>`;
    return;
  }
  if (!elevi) { panouElevi.innerHTML = `<p class="tr-elevi__gol">Se aduce lista…</p>`; return; }
  panouElevi.innerHTML = `<p class="tr-elevi__cap">Pot scrie enunțuri pe tablă</p>` + (elevi.length
    ? elevi.map((p) => `<div class="tr-elevi__rand">
        <span>${esc(p.name)}</span>
        <button type="button" class="tr-sw${p.can.tabla ? " is-on" : ""}" role="switch"
          aria-checked="${p.can.tabla}" data-elev="${esc(p.userId)}"${eleviInZbor.has(p.userId) ? " disabled" : ""}
          aria-label="${esc(p.name)}: ${p.can.tabla ? "scrie" : "nu scrie"}"><i aria-hidden="true"></i></button>
      </div>`).join("")
    : `<p class="tr-elevi__gol">N-ai încă elevi la meditații. Îi adaugi din planificator.</p>`);
}
async function aduElevii() {
  try { elevi = await tutoringPupils(); eleviProblema = ""; }
  catch (e) { eleviProblema = e?.message || String(e); console.warn("tabla, elevii:", eleviProblema); }
  deseneazaElevii();
}
btnElevi.addEventListener("click", (e) => {
  e.stopPropagation();
  panouElevi.hidden = !panouElevi.hidden;
  btnElevi.setAttribute("aria-expanded", String(!panouElevi.hidden));
  if (!panouElevi.hidden) {
    const r = btnElevi.getBoundingClientRect();
    panouElevi.style.top = `${r.bottom + 8}px`;
    panouElevi.style.right = `${Math.max(8, innerWidth - r.right)}px`;
    aduElevii();
  }
  deseneazaElevii();
});
panouElevi.addEventListener("click", async (e) => {
  e.stopPropagation();
  const sw = e.target.closest(".tr-sw");
  const p = sw && elevi?.find((x) => x.userId === sw.dataset.elev);
  if (!p || eleviInZbor.has(p.userId)) return;
  eleviInZbor.add(p.userId); deseneazaElevii();
  const vrut = !p.can.tabla;
  /* Dacă baza n-a primit, comutatorul nu se mișcă. */
  if (await setPupilPermission(p.userId, "tabla", vrut)) p.can = { ...p.can, tabla: vrut };
  eleviInZbor.delete(p.userId); deseneazaElevii();
});
document.addEventListener("click", () => {
  if (panouElevi.hidden) return;
  panouElevi.hidden = true;
  btnElevi.setAttribute("aria-expanded", "false");
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panouElevi.hidden) document.body.click(); });

/* ---------- opera și lucrările ----------
   Opera stă pe bară, la toți. O scrie profesorul (✎); până atunci se ia din
   numele fișei Word. Ea și tipul eseului sunt etichetele lucrărilor din grilă. */
const operaAcum = () => (privat ? privat.data.opera : opera || operaDinFisa(fisa?.nume)) || null;
const numeTip = (k) => document.querySelector(`.tr-tip[data-tip="${k}"]`)?.textContent.trim() || k;

const chipOpera = document.createElement("span");
chipOpera.className = "tr-opera";
(document.querySelector(".tr-lectie") || document.querySelector(".tr-marca"))?.after(chipOpera);
chipOpera.addEventListener("click", async (e) => {
  if (!e.target.closest("[data-opera]") || !admin) return;
  const r = prompt("Opera de pe tablă, cu autorul în paranteză, de exemplu: Moromeții (Marin Preda).\nLasă gol ca s-o ia din numele fișei Word.", textOpera(operaAcum()));
  if (r === null) return;
  opera = operaDinText(r);
  sursa = null;            // altă operă = altă lucrare
  pentru = { decis: pentru.decis, elevi: pentru.elevi };   // aceiași elevi, lucrare nouă
  inceput = null;
  ids = {};
  deseneaza();
  clearTimeout(ceas);
  await trimite();
});

const btnLucrari = document.createElement("button");
btnLucrari.type = "button";
btnLucrari.className = "tr-btn tr-lucrari__btn";
btnLucrari.hidden = true;
document.getElementById("goleste").before(btnLucrari);
btnLucrari.addEventListener("click", () => deschideLucrarile({
  admin, tipuri: TIPURI, numeTip, laPunePeTabla: punePeTabla, laLucreazaSingur: lucreazaSingur,
}));

/* Unde s-a salvat, sub bară, lângă starea live. */
const salvatEl = document.createElement("span");
salvatEl.className = "tr-salvat";
(document.querySelector(".tr-cap__jos") || stareEl.parentElement).prepend(salvatEl);
function arataSalvarea(text, eroare = false) {
  salvatEl.textContent = text;
  salvatEl.classList.toggle("is-eroare", eroare);
}

/* Banda de sus cât elevul lucrează singur pe o lucrare a lui. */
const bandaPrivat = document.createElement("div");
bandaPrivat.className = "tr-privat";
bandaPrivat.hidden = true;
document.querySelector(".tr-zona").prepend(bandaPrivat);
bandaPrivat.addEventListener("click", (e) => { if (e.target.closest("[data-iesi]")) ieseDinPrivat(); });

const chipPentru = document.createElement("button");
chipPentru.type = "button";
chipPentru.className = "tr-pentru";
chipPentru.hidden = true;
chipOpera.after(chipPentru);
chipPentru.addEventListener("click", () => { if (admin) alegePentru(); });

function deseneazaLucrarile() {
  chipPentru.hidden = !admin || !!privat;
  chipPentru.classList.toggle("is-live", pentru.decis && !pentru.elevi.length);
  chipPentru.classList.toggle("is-nedecis", !pentru.decis);
  chipPentru.innerHTML = !pentru.decis ? "❔ Pentru cine e lucrul?"
    : pentru.elevi.length ? `💾 Se salvează la: <b>${esc(pentru.elevi.map((e) => e.nume).join(", "))}</b>`
      : "⚠ Doar live, nesalvat";
  chipPentru.title = "Alege în contul cui se salvează lucrarea de pe tablă";
  if (!admin && !privat) {
    const eu = pentru.elevi.some((e) => e.id === CURRENT_USER.authId);
    arataSalvarea(eu ? "lucrarea se salvează în contul tău" : "");
  }
  const o = operaAcum();
  chipOpera.hidden = !o && !admin;
  chipOpera.innerHTML = `<span>Opera: <b>${esc(numeOpera(o))}</b>${o?.autor ? ` · ${esc(o.autor)}` : ""}</span>`
    + (admin ? `<button type="button" class="tr-opera__creion" data-opera title="Schimbă opera">✎</button>` : "");
  btnLucrari.hidden = !!privat || !(admin || CURRENT_USER.authId);
  btnLucrari.textContent = admin ? "📁 Lucrările elevilor" : "📁 Lucrările mele";
  bandaPrivat.hidden = !privat;
  if (privat) {
    bandaPrivat.innerHTML = `<span>✎ Lucrezi singur pe lucrarea ta: <b>${esc(numeOpera(privat.data.opera))} · ${esc(numeTip(privat.data.tip))}</b> · ${esc(ziFrumoasa(privat.data.zi))}. Ce scrii aici se salvează doar în contul tău; nu apare pe tabla live.</span>
      <button type="button" class="tr-btn" data-iesi>Înapoi la tabla live</button>`;
  }
}

/** Eseul deschis, ca lucrare: fiecare treaptă cu ceva scris, întreagă (și
 *  părțile luate de pe treapta dinainte), ca să se poată citi singură. */
function continutLucrare(op, zi, ora = "") {
  const trepte = {};
  for (const n of trepteLe()) {
    if (!enunturi[n]?.some((x) => String(x).trim())) continue;
    trepte[n] = tipul().etichete.flatMap((_, p) =>
      Array.from({ length: partiLa(n)[p] }, (_, j) => enuntul(n, p, j).text));
  }
  if (!Object.keys(trepte).length) return null;
  return { versiune: 1, opera: op ? { nume: op.nume, autor: op.autor || "" } : null, tip, zi, ...(ora ? { ora } : {}), treapta, trepte };
}
const treaptaAtinsa = (d) => Math.max(...Object.keys(d.trepte || {}).map(Number).filter((n) => trepteLe(d.tip).includes(n)), trepteLe(d.tip)[0]);

/* SALVAREA, DIN PAGINA PROFESORULUI (0109): la câteva secunde după fiecare
   schimbare (a lui ori a elevului), lucrarea pleacă în contul elevilor aleși.
   Salvările merg una după alta, niciodată două deodată. */
let ceasLaElevi = null;
let lantSalvari = Promise.resolve(true);
let intrebatPentru = false;     // s-a pus deja întrebarea la lucrarea asta
const areCeva = () => trepteLe().some((n) => enunturi[n]?.some((x) => String(x).trim()));
function lucrareaSeSchimba() {
  if (!admin || privat) return;
  if (!pentru.decis) {
    /* AVERTIZAREA: lucru nou, nimeni ales încă. Se întreabă o singură dată. */
    if (!intrebatPentru && areCeva()) { intrebatPentru = true; alegePentru(true); }
    return;
  }
  if (!pentru.elevi.length) return;
  arataSalvarea("se salvează…");
  clearTimeout(ceasLaElevi);
  ceasLaElevi = setTimeout(salveazaLaElevi, 2000);
}
function salveazaLaElevi() {
  clearTimeout(ceasLaElevi);
  lantSalvari = lantSalvari.then(salveazaAcum, salveazaAcum);
  return lantSalvari;
}
async function salveazaAcum() {
  if (!admin || privat || !pentru.elevi.length) return true;
  pastreazaTipul();
  const op = operaAcum();
  const rele = [];
  /* Prima salvare a unei lucrări îi fixează începutul (ziua și ora din titlu). */
  let deTrimis = false;
  if (!inceput) {
    const d = new Date();
    inceput = `${ziDeAzi()}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    deTrimis = true;
  }
  for (const e of pentru.elevi) {
    /* Lucrarea adusă din grilă e chiar a elevului ei: se scrie mai departe în ea. */
    const aLui = sursa && sursa.elev === e.id && sursa.tip === tip;
    const zi = aLui ? sursa.zi : inceput.slice(0, 10);
    const ora = aLui ? "" : inceput.slice(11);
    const continut = continutLucrare(op, zi, ora);
    if (!continut) return true;
    const titlu = aLui && sursa.titlu ? sursa.titlu : `${numeOpera(op)} · ${numeTip(tip)} · ${ziFrumoasa(zi)}, ${ora}`;
    const cheie = `${tip}|${e.id}`;
    const id = aLui ? sursa.id : ids[cheie] || null;
    /* Fără id e prima salvare: baza face mereu o lucrare nouă, chiar dacă titlul
       e luat, iar id-ul ei rămâne pe tablă pentru salvările următoare. */
    const r = await salveazaLucrareaElevului({ elev: e.id, lectie: LECTIE, titlu, data: continut, id, nou: !id });
    if (!r.id) rele.push(`${e.nume}: ${r.eroare}`);
    else if (!aLui && ids[cheie] !== r.id) { ids = { ...ids, [cheie]: r.id }; deTrimis = true; }
  }
  if (deTrimis) { clearTimeout(ceas); trimite(); }
  arataSalvarea(rele.length ? `nesalvat · ${rele.join(" · ")}` : `salvat la ${pentru.elevi.map((e) => e.nume).join(", ")}`, rele.length > 0);
  return !rele.length;
}

/* ---------- întrebările tablei ---------- */
const dialog = document.createElement("div");
dialog.className = "tr-dialog";
dialog.hidden = true;
document.body.append(dialog);
/** O întrebare cu butoane: `[cheie, text, fel]`. Întoarce cheia aleasă (null = închis). */
function intreaba(titlu, text, butoane, corp = "") {
  return new Promise((gata) => {
    dialog.innerHTML = `<div class="tr-dialog__card" role="dialog" aria-modal="true">
        <h3>${esc(titlu)}</h3>${text ? `<p>${esc(text)}</p>` : ""}${corp}
        <div class="tr-dialog__butoane">${butoane.map(([k, t, fel]) =>
          `<button type="button" class="tr-btn${fel ? ` tr-btn--${fel}` : ""}" data-alege="${esc(k)}">${esc(t)}</button>`).join("")}</div>
      </div>`;
    dialog.hidden = false;
    const inchide = (k) => { dialog.hidden = true; dialog.onclick = null; gata(k); };
    dialog.onclick = (e) => {
      if (e.target === dialog) return inchide(null);
      const b = e.target.closest("[data-alege]");
      if (b) inchide(b.dataset.alege);
    };
    dialog.querySelector("[data-alege]")?.focus();
  });
}
/** „Pentru cine e lucrul acesta?" Întoarce `true` dacă s-a hotărât ceva. */
async function alegePentru(laInceput = false) {
  let lista = [];
  try { lista = await tutoringPupils(); } catch { /* fără listă: rămâne „doar live" */ }
  const bifati = new Set(pentru.decis ? pentru.elevi.map((e) => e.id) : lista.filter((x) => x.can.tabla).map((x) => x.userId));
  const corp = lista.length
    ? `<div class="tr-dialog__elevi">${lista.map((x) => `<label><input type="checkbox" value="${esc(x.userId)}"${bifati.has(x.userId) ? " checked" : ""}>
        <span>${esc(x.name)}</span>${x.can.tabla ? `<small>scrie acum pe tablă</small>` : ""}</label>`).join("")}</div>`
    : `<p class="tr-dialog__nota">N-ai elevi la meditații, deci lucrarea poate fi doar live.</p>`;
  const ales = await intreaba("Pentru cine e lucrul acesta?",
    laInceput ? "Ai început o lucrare nouă pe tablă. Bifează elevul (ori elevii) în contul căruia se salvează, ori alege „Doar live”: atunci nu se salvează nicăieri."
      : "Lucrarea de pe tablă se salvează singură în contul elevilor bifați, la fiecare schimbare.",
    [["salveaza", "Salvează la cei bifați", "plin"], ["live", "Doar live, fără salvare", ""], ["nu", "Mai târziu", ""]], corp);
  if (ales === "salveaza") {
    const ids = [...dialog.querySelectorAll(".tr-dialog__elevi input:checked")].map((i) => i.value);
    if (!ids.length) { arataSalvarea("n-ai bifat niciun elev · lucrarea e doar live", true); pentru = { decis: true, elevi: [] }; }
    else pentru = { decis: true, elevi: ids.map((id) => ({ id, nume: lista.find((x) => x.userId === id)?.name || "elev" })) };
  } else if (ales === "live") {
    pentru = { decis: true, elevi: [] };
    arataSalvarea("");
  } else return false;
  deseneaza();
  clearTimeout(ceas);
  await trimite();
  if (pentru.elevi.length) await salveazaLaElevi();
  return true;
}

/** Creionul profesorului: lucrarea unui elev vine pe tabla live, pe tipul ei. */
async function punePeTabla(row, numeElev) {
  if (!admin) return;
  const d = row.data;
  if (!TIPURI.some((t) => t.cheie === d.tip)) return;
  if (!confirm(`Pui pe tabla live lucrarea lui ${numeElev}: „${row.title}"?\n\nCe e acum pe tablă la „${numeTip(d.tip)}" se înlocuiește. Celălalt tip de eseu și fișa rămân. Elevul, dacă e pornit, scrie mai departe în aceeași lucrare.`)) return;
  pastreazaTipul();
  tip = d.tip;
  stari[tip] = normalizeazaTip(tipul(tip), { treapta: d.treapta || treaptaAtinsa(d), enunturi: d.trepte });
  ({ treapta, enunturi } = stari[tip]);
  opera = d.opera || null;
  sursa = { id: row.id, elev: row.user_id, tip, titlu: row.title, zi: d.zi };
  pentru = { decis: true, elevi: [{ id: row.user_id, nume: numeElev }] };
  intrebatPentru = true;
  deseneaza();
  document.querySelector(".tr-zona").scrollTop = 0;
  clearTimeout(ceas);
  await trimite();
}

/** Creionul elevului: lucrarea lui, deschisă doar pentru el, în aceeași tablă. */
function lucreazaSingur(row) {
  const d = row.data;
  if (!TIPURI.some((t) => t.cheie === d.tip) || row.user_id !== CURRENT_USER.authId) return;
  pastreazaTipul();
  privat = { id: row.id, titlu: row.title, data: d };
  tip = d.tip;
  stari[tip] = normalizeazaTip(tipul(tip), { treapta: d.treapta || treaptaAtinsa(d), enunturi: d.trepte });
  ({ treapta, enunturi } = stari[tip]);
  scriu = true;
  deseneaza();
  arataStarea(vorbaRolului(), "live");
  arataSalvarea("");
  document.querySelector(".tr-zona").scrollTop = 0;
  foaie.querySelector(".tr-camp")?.focus();
}
let ceasPrivat = null;
function salveazaPrivatCurand() {
  arataSalvarea("se salvează…");
  clearTimeout(ceasPrivat);
  ceasPrivat = setTimeout(salveazaPrivat, 1200);
}
async function salveazaPrivat() {
  if (!privat) return;
  pastreazaTipul();
  const continut = continutLucrare(privat.data.opera, privat.data.zi);
  if (!continut) return;
  const { row, motiv } = await saveSheet({ id: privat.id, lessonSlug: LECTIE, title: privat.titlu, data: continut });
  if (row && privat) privat.data = continut;
  arataSalvarea(row ? "salvat în lucrarea ta" : `nesalvat: ${motiv}`, !row);
}
async function ieseDinPrivat() {
  clearTimeout(ceasPrivat);
  await salveazaPrivat();
  privat = null;
  incarca(normalizeaza(await citesteTabla(SLUG)));
  scriu = admin || ingaduit;
  arataSalvarea("");
  deseneaza();
  arataStarea(vorbaRolului(), "live");
  document.querySelector(".tr-zona").scrollTop = 0;
}

/* ---------- pornirea ---------- */
punMarimea();
deseneaza();
arataStarea("se încarcă…", "trimite");

const deLaBaza = await citesteTabla(SLUG);
incarca(normalizeaza(deLaBaza));
deseneaza();
if (scriu) foaie.querySelector(".tr-camp")?.focus();

/* Fiecare primește fiecare schimbare, și cine scrie (0108): celălalt scriitor
   poate fi la alt enunț. Ce n-a plecat încă de aici (`murdare`) rămâne cum e,
   iar câmpul în care scrii acum nu e atins deloc. */
urmaresteTabla(SLUG, (d) => {
  if (privat) return;     // cât lucrează singur, elevul nu e atins de tabla live
  const nou = normalizeaza(d);
  for (const [cheie, text] of murdare) {
    const [t, n, i] = cheie.split("|");
    if (nou.stari[t]?.enunturi[n]) nou.stari[t].enunturi[n][Number(i)] = text;
  }
  /* Treapta, tipul și fișa le schimbă doar adminul. La el rămân cum le are:
     un ecou mai vechi al propriei trimiteri nu-l mută înapoi. */
  if (admin) {
    pastreazaTipul();
    for (const t of TIPURI) nou.stari[t.cheie].treapta = stari[t.cheie].treapta;
    nou.tip = tip;
    nou.fisa = fisa;
    nou.opera = opera;
    nou.sursa = sursa;
    nou.pentru = pentru;
    nou.inceput = inceput;
    nou.ids = ids;
  }
  const altaTreapta = nou.tip !== tip || nou.stari[nou.tip].treapta !== treapta;
  const altaFisa = (nou.fisa?.fisier || "") !== (fisa?.fisier || "");
  incarca(nou);
  const zona = document.querySelector(".tr-zona");
  if (scriu && !altaTreapta && !altaFisa) {
    /* Pe aceeași treaptă se schimbă doar textele: se pun în câmpuri, pe loc,
       fără să se redeseneze tabla (care ți-ar lua cursorul). */
    foaie.querySelectorAll(".tr-camp").forEach((el) => {
      const v = enunturi[el.dataset.n][Number(el.dataset.i)];
      if (el !== document.activeElement && el.value !== v) { el.value = v; potriveste(el); }
    });
    numara();
    lucrareaSeSchimba();
    return;
  }
  /* Altfel tabla se desenează din nou. Derularea rămâne unde era, afară de
     trecerea pe altă treaptă. Fișa nu se redesenează dacă e aceeași. */
  const unde = zona.scrollTop;
  deseneaza();
  zona.scrollTop = altaTreapta ? 0 : unde;
  lucrareaSeSchimba();
}, (conectat) => {
  if (scriu) { if (conectat && stareEl.dataset.fel === "trimite" && !inZbor) arataStarea(vorbaRolului(), "live"); return; }
  arataStarea(conectat ? vorbaRolului() : "fără legătură live", conectat ? "live" : "eroare");
});

/* ---------- cine scrie ----------
   Elevul: profesorul îl pornește ori îl oprește, iar tabla i se deschide ori
   i se închide pe loc. */
/* Vorba de lângă punctul verde spune și cine ce poate, ca să se vadă dintr-o
   privire de ce un elev nu are câmpuri: nu e în cont, ori nu e pornit. */
function vorbaRolului() {
  if (privat) return "lucrezi singur · nu e live";
  if (admin) return "live";
  if (scriu) return "live · poți scrie și tu";
  return CURRENT_USER.authId ? "live · doar citești" : "live · intră în cont ca să poți scrie";
}
function aplicaRolul() {
  const acum = admin || ingaduit || !!privat;
  if (acum !== scriu) {
    scriu = acum;
    deseneaza();
    if (scriu) foaie.querySelector(".tr-camp")?.focus();
  }
  if (!admin && stareEl.dataset.fel !== "eroare") arataStarea(vorbaRolului(), "live");
}
let opresteAscultarea = () => {};
let cineAmIntrebat = null;   // contul pentru care s-a întrebat ultima oară
async function intreabaIngaduinta() {
  if (admin) return;
  const v = await poateScrieTabla();
  if (v !== ingaduit) { ingaduit = v; aplicaRolul(); }
}
async function aflaIngaduinta() {
  opresteAscultarea();
  opresteAscultarea = () => {};
  cineAmIntrebat = CURRENT_USER.authId;
  if (admin) { ingaduit = false; aplicaRolul(); return; }
  ingaduit = await poateScrieTabla();
  aplicaRolul();
  opresteAscultarea = ascultaIngaduinta((val) => { ingaduit = val; aplicaRolul(); });
}

/* PLASA. Vestea live că profesorul te-a pornit poate să nu ajungă (legătură
   căzută, pagină deschisă de mult). Atunci tabla întreabă și singură: din 10 în
   10 secunde cât e la vedere și ori de câte ori revii pe ea. Întrebarea e un
   singur „da/nu”, nu costă nimic. */
setInterval(() => { if (!document.hidden) intreabaIngaduinta(); }, 10000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) intreabaIngaduinta(); });

/* Rolul ori contul se pot schimba sub pagină (intrare ori ieșire din cont,
   sesiunea care sosește după pornire): atunci se întreabă din nou. */
addEventListener("atelier:role", () => {
  const acum = isAdmin();
  if (acum === admin && CURRENT_USER.authId === cineAmIntrebat) return;
  admin = acum;
  aflaIngaduinta();
});

/* La capăt, după ce tot ce folosesc există: cine are voie să scrie și lista elevilor. */
aflaIngaduinta();
if (admin) aduElevii(); else deseneazaElevii();

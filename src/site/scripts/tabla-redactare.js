// =========================================================
// #LaTablă, redactare: de la 5 la 18 enunțuri.
//
// Cinci părți, mereu aceleași, în ordinea asta: Intro, Reper 1 - trăsături,
// Reper 2 - scene semnificative, Reper 3 - structură și compoziție, Concluzie.
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
// PĂRȚILE FIECĂREI TREPTE STAU ÎN PAGINĂ, pe butoane (`data-parti`), nu și
// aici. Pagina și scriptul sunt ținute de browser fiecare pe socoteala lui,
// până la 10 minute după un push (GitHub Pages); cu numerele scrise în două
// locuri, o pagină nouă cu un script vechi ar fi avut butoane care nu fac nimic.
//
// LIVE (0106). Scrie doar adminul; tot ce scrie, plus treapta pe care e, pleacă
// în bază și ajunge pe loc la toți cei care au tabla deschisă. Ceilalți citesc
// doar și îl urmează de pe o treaptă pe alta. Tabla rămâne scrisă până apasă
// adminul „Golește", ca un elev intrat mai târziu să vadă ce e deja pe ea.
//
// FIȘA WORD (0107). Sub enunțuri, adminul poate urca o fișă .docx; se vede ca
// în Word, cu pagini, la toți. Golirea curăță enunțurile, nu și fișa.
// Cuprins în română, nume în engleză.
// =========================================================
import { isAdmin } from "../../shared/scripts/session.js";
import { citesteTabla, scrieTabla, urmaresteTabla, urcaFisa, adresaFisa, stergeFisierFisa }
  from "../../shared/scripts/tabla-live-repo.js";

const SLUG = "redactare-enunturi";

/* Cele cinci părți, cu etichetele lor. */
const PARTI = [
  { cheie: "intro", eticheta: "Intro" },
  { cheie: "r1", eticheta: "Reper 1 - trăsături" },
  { cheie: "r2", eticheta: "Reper 2 - scene semnificative" },
  { cheie: "r3", eticheta: "Reper 3 - structură și compoziție" },
  { cheie: "concluzie", eticheta: "Concluzie" },
];

/* Treptele și câte enunțuri are fiecare parte pe ele, citite din butoane. */
const STRUCTURA = (() => {
  const din = [...document.querySelectorAll(".tr-treapta")].map((b) => {
    const parti = String(b.dataset.parti || "").split(",").map(Number);
    return { n: Number(b.dataset.n), parti };
  }).filter((t) => t.n > 0 && t.parti.length === PARTI.length
    && t.parti.every((x) => x > 0) && t.parti.reduce((a, x) => a + x, 0) === t.n);
  return din.length ? din : [
    { n: 5, parti: [1, 1, 1, 1, 1] }, { n: 8, parti: [1, 2, 2, 2, 1] },
    { n: 14, parti: [1, 4, 4, 4, 1] }, { n: 18, parti: [1, 4, 8, 4, 1] },
  ];
})();
const TREPTE = STRUCTURA.map((t) => t.n);
const partiLa = (n) => STRUCTURA.find((t) => t.n === n).parti;
const treaptaDinainte = (n) => TREPTE[TREPTE.indexOf(n) - 1];
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

const gol = () => Object.fromEntries(TREPTE.map((n) => [n, Array(n).fill("")]));

/** Ce vine din bază, adus la forma pe care o știe pagina (orice lipsă = gol). */
function normalizeaza(d) {
  const e = gol();
  const din = d?.enunturi || {};
  for (const n of TREPTE) {
    const v = Array.isArray(din[n]) ? din[n] : [];
    e[n] = Array.from({ length: n }, (_, i) => String(v[i] ?? ""));
  }
  /* Fișa se ia doar dacă numele fișierului arată cum îl dă urcarea: altfel
     adresa ar putea trimite oriunde. */
  const f = d?.fisa;
  const fisa = f && /^[a-z0-9-]+\.docx$/.test(String(f.fisier || ""))
    ? { fisier: f.fisier, nume: String(f.nume || "fișa.docx"), marime: Number(f.marime) || 0 } : null;
  return { treapta: TREPTE.includes(Number(d?.treapta)) ? Number(d.treapta) : TREPTE[0], enunturi: e, fisa };
}

let scriu = isAdmin();
let { treapta, enunturi, fisa } = normalizeaza(null);

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
  foaie.innerHTML = PARTI.map((parte, p) => {
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
    return `<section class="tr-grup tr-grup--${parte.cheie}${seScrie(n, p) ? "" : " tr-grup--fix"}">
        <span class="tr-eticheta">${esc(parte.eticheta)}</span>
        ${corp}
      </section>`;
  }).join("");
  document.querySelectorAll(".tr-treapta").forEach((b) => {
    const e = Number(b.dataset.n) === n;
    b.classList.toggle("is-on", e);
    b.setAttribute("aria-selected", String(e));
    b.disabled = !scriu && !e;
  });
  document.getElementById("goleste").hidden = !scriu;
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
  PARTI.forEach((_, p) => {
    for (let j = 0; j < partiLa(treapta)[p]; j++) if (enuntul(treapta, p, j).text.trim()) gata++;
  });
  scrise.textContent = `${gata} / ${treapta} scrise`;
}

function arataStarea(text, fel = "") {
  stareEl.textContent = text;
  stareEl.dataset.fel = fel;
}

/* ---------- trimiterea (doar adminul) ---------- */
let ceas = null;
let inZbor = false;
let maiAm = false;
function trimiteCurand() {
  if (!scriu) return;
  arataStarea("se trimite…", "trimite");
  clearTimeout(ceas);
  ceas = setTimeout(trimite, PAUZA_TRIMITERE);
}
async function trimite() {
  /* O singură cerere pe drum. Dacă între timp s-a mai scris, se trimite încă
     o dată la sosire, cu tot ce e nou: ultima versiune ajunge mereu. */
  if (inZbor) { maiAm = true; return; }
  inZbor = true;
  const ok = await scrieTabla(SLUG, { treapta, enunturi, fisa });
  inZbor = false;
  if (maiAm) { maiAm = false; trimite(); return; }
  arataStarea(ok ? "live · trimis" : "netrimis: verifică netul", ok ? "live" : "eroare");
}

function mergiLa(n) {
  if (!scriu || !TREPTE.includes(n) || n === treapta) return;
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
  trimiteCurand();
});

/* Enter trece la enunțul următor; un enunț nu are nevoie de rând nou. */
foaie.addEventListener("keydown", (e) => {
  const t = e.target.closest(".tr-camp");
  if (!t || e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  const toate = [...foaie.querySelectorAll(".tr-camp")];
  toate[toate.indexOf(t) + 1]?.focus();
});

document.querySelectorAll(".tr-treapta").forEach((b) =>
  b.addEventListener("click", () => mergiLa(Number(b.dataset.n))));

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
  if (!scriu) return;
  if (!TREPTE.some((n) => enunturi[n].some((x) => x.trim()))) return;
  if (!confirm("Ștergi enunțurile de pe toate cele patru trepte? Se șterg și la elevi. Fișa Word rămâne.")) return;
  clearTimeout(ceas);
  enunturi = gol();
  treapta = TREPTE[0];
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
  const unelte = scriu
    ? `<div class="tr-fisa__unelte">
         <button type="button" class="tr-btn" data-fisa="urca">${fisa ? "Înlocuiește fișa" : "+ Urcă fișa Word"}</button>
         ${fisa ? `<button type="button" class="tr-btn tr-btn--sterge" data-fisa="scoate">Scoate fișa</button>` : ""}
         ${mesaj ? `<span class="tr-fisa__mesaj">${esc(mesaj)}</span>` : ""}
       </div>` : "";
  if (!fisa) {
    sectiuneFisa.hidden = !scriu;
    sectiuneFisa.innerHTML = `<div class="tr-fisa__cap">${unelte}</div>`;
    fisaAfisata = "";
    return;
  }
  sectiuneFisa.hidden = false;
  const cap = `<h2 class="tr-fisa__titlu">Fișa de lucru <small>${esc(fisa.nume)}${marimeMB(fisa.marime)}</small></h2>${unelte}`;
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
   lateral. Pe ecran lat rămâne la mărimea ei. */
function incadreazaFisa() {
  const pagini = sectiuneFisa.querySelector(".tr-fisa__pagini");
  const invelis = pagini?.querySelector(".docx-wrapper");
  const pagina = invelis?.querySelector("section.docx");
  if (!pagina) return;
  invelis.style.zoom = "";
  const scara = Math.min(1, pagini.clientWidth / pagina.offsetWidth);
  if (scara < 1) invelis.style.zoom = String(Math.floor(scara * 1000) / 1000);
}
addEventListener("resize", incadreazaFisa);

sectiuneFisa.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-fisa]");
  if (!b || !scriu) return;
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
  if (!file || !scriu) return;
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

/* ---------- pornirea ---------- */
punMarimea();
deseneaza();
arataStarea("se încarcă…", "trimite");

const deLaBaza = await citesteTabla(SLUG);
({ treapta, enunturi, fisa } = normalizeaza(deLaBaza));
deseneaza();
if (scriu) foaie.querySelector(".tr-camp")?.focus();

/* Cititorul primește fiecare schimbare. Adminul nu: ce vine e chiar ce a
   trimis el, iar aplicat peste ce scrie în clipa asta i-ar fi mâncat literele. */
urmaresteTabla(SLUG, (d) => {
  if (scriu) return;
  const nou = normalizeaza(d);
  const altaTreapta = nou.treapta !== treapta;
  ({ treapta, enunturi, fisa } = nou);
  /* Cititorul nu scrie nimic, deci tabla se poate desena din nou la fiecare
     schimbare, fără să-i strice vreun câmp. Derularea rămâne unde era, afară
     de trecerea pe altă treaptă. Fișa nu se redesenează dacă e aceeași. */
  const zona = document.querySelector(".tr-zona");
  const unde = zona.scrollTop;
  deseneaza();
  zona.scrollTop = altaTreapta ? 0 : unde;
}, (conectat) => {
  if (scriu) { if (conectat && stareEl.dataset.fel === "trimite" && !inZbor) arataStarea("live", "live"); return; }
  arataStarea(conectat ? "live" : "fără legătură live", conectat ? "live" : "eroare");
});

/* Rolul se poate schimba sub pagină (intrare ori ieșire din cont). */
addEventListener("atelier:role", () => {
  const acum = isAdmin();
  if (acum === scriu) return;
  scriu = acum;
  deseneaza();
});

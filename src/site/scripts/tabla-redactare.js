// =========================================================
// #LaTablă, redactare: de la 5 la 26 de enunțuri.
//
// Patru trepte: 5, 8, 14, 26. Pe prima scrii cinci enunțuri. Pe fiecare
// treaptă următoare, enunțurile de pe treapta dinainte se rescriu cu mai multe
// detalii.
//
// PRIMUL ȘI ULTIMUL NU SE DUBLEAZĂ, niciodată (regula lui Marius): pe fiecare
// treaptă se rescriu într-un singur enunț. Fiecare enunț din mijloc se
// dublează. De-aici numerele treptelor: 1 + 3×2 + 1 = 8, 1 + 6×2 + 1 = 14,
// 1 + 12×2 + 1 = 26. (O vreme totalurile au fost 10, 20, 40, cu mijlocul
// împărțit inegal; Marius a ales înapoi dublarea curată.)
//
// O TREAPTĂ PE ECRAN. Deasupra fiecărui grup stă, stins, enunțul din care
// pornește, ca să știi ce rescrii. Așa încape și pe proiector.
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
/* TREPTELE SE CITESC DIN BUTOANELE PAGINII, nu se scriu și aici. Pagina și
   scriptul sunt ținute de browser fiecare pe socoteala lui, până la 10 minute
   după un push (GitHub Pages); cu numerele scrise în două locuri, o pagină
   nouă cu un script vechi ar fi avut butoane care nu fac nimic. Așa, butonul
   apăsat e mereu o treaptă pe care scriptul o cunoaște. */
const TREPTE = (() => {
  const din = [...document.querySelectorAll(".tr-treapta")]
    .map((b) => Number(b.dataset.n)).filter((n) => n > 0);
  return din.length ? din : [5, 8, 14, 26];
})();
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
  return { treapta: TREPTE.includes(Number(d?.treapta)) ? Number(d.treapta) : 5, enunturi: e, fisa };
}

let scriu = isAdmin();
let { treapta, enunturi, fisa } = normalizeaza(null);

const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function camp(n, i) {
  return `<div class="tr-rand">
      <span class="tr-nr">${i + 1}.</span>
      <textarea class="tr-camp" rows="1" data-n="${n}" data-i="${i}"${scriu ? "" : " readonly tabindex=\"-1\""}
        aria-label="Enunțul ${i + 1} din ${n}" placeholder="${scriu ? `Enunțul ${i + 1}` : ""}">${esc(enunturi[n][i])}</textarea>
    </div>`;
}

function textParinte(sus, k) {
  const p = enunturi[sus][k].trim();
  return p ? esc(p) : `<em>enunțul ${k + 1} de la ${sus} e încă gol</em>`;
}

/** Treapta dinainte (8 → 5, 14 → 8, 26 → 14). */
const treaptaDinainte = (n) => TREPTE[TREPTE.indexOf(n) - 1];

/**
 * Cum se împart enunțurile treptei `n` pe enunțurile treptei dinainte.
 * Primul și ultimul au câte un singur „copil"; cele din mijloc își împart
 * restul. La 5 / 8 / 14 / 26 iese exact câte doi fiecare; dacă pagina ar avea
 * alte numere, restul se împarte cât mai egal, cu unul în plus la cele dintâi,
 * ca tabla să meargă oricum.
 * @returns {Array<{parinte: number, copii: number[], capat: "" | "primul" | "ultimul"}>}
 */
function grupuri(n) {
  const sus = treaptaDinainte(n);
  const mijlocSus = sus - 2;
  const mijlocJos = n - 2;
  const baza = Math.floor(mijlocJos / mijlocSus);
  const inPlus = mijlocJos % mijlocSus;
  const g = [{ parinte: 0, copii: [0], capat: "primul" }];
  let i = 1;
  for (let k = 0; k < mijlocSus; k++) {
    const cati = baza + (k < inPlus ? 1 : 0);
    g.push({ parinte: k + 1, copii: Array.from({ length: cati }, (_, j) => i + j), capat: "" });
    i += cati;
  }
  g.push({ parinte: sus - 1, copii: [n - 1], capat: "ultimul" });
  return g;
}

function deseneaza() {
  const n = treapta;
  document.body.classList.toggle("tr--citeste", !scriu);
  if (n === 5) {
    foaie.innerHTML = `<div class="tr-grup tr-grup--prima">${
      Array.from({ length: 5 }, (_, i) => camp(5, i)).join("")}</div>`;
  } else {
    const sus = treaptaDinainte(n);
    foaie.innerHTML = grupuri(n).map((g) => `<div class="tr-grup${g.capat ? " tr-grup--capat" : ""}">
          ${g.capat ? `<span class="tr-capat">${g.capat === "primul" ? "primul enunț" : "ultimul enunț"} · rămâne unul</span>` : ""}
          <p class="tr-parinte" data-k="${g.parinte}"><span class="tr-nr">${g.parinte + 1}.</span><span class="tr-parinte__t">${textParinte(sus, g.parinte)}</span></p>
          ${g.copii.map((i) => camp(n, i)).join("")}
        </div>`).join("");
  }
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

/** La cititor, o schimbare venită live: se pun doar textele, fără redesen,
 *  ca pagina să nu clipească și să nu sară derularea la fiecare literă. */
function improspateazaTextele() {
  foaie.querySelectorAll(".tr-camp").forEach((t) => {
    const v = enunturi[t.dataset.n][Number(t.dataset.i)];
    if (t.value !== v) { t.value = v; potriveste(t); }
  });
  if (treapta > 5) {
    foaie.querySelectorAll(".tr-parinte").forEach((p) => {
      const h = textParinte(treaptaDinainte(treapta), Number(p.dataset.k));
      const t = p.querySelector(".tr-parinte__t");
      if (t.innerHTML !== h) t.innerHTML = h;
    });
  }
  numara();
}

/* Câmpul crește odată cu enunțul, fără bară de derulare în el. */
function potriveste(t) {
  t.style.height = "auto";
  t.style.height = `${t.scrollHeight}px`;
}

function numara() {
  const gata = enunturi[treapta].filter((x) => x.trim()).length;
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
  treapta = 5;
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
  const altaFisa = (nou.fisa?.fisier || "") !== (fisa?.fisier || "");
  ({ treapta, enunturi, fisa } = nou);
  if (altaTreapta) { deseneaza(); document.querySelector(".tr-zona").scrollTop = 0; }
  else { improspateazaTextele(); if (altaFisa) deseneazaFisa(); }
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

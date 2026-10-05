// =========================================================
// #LaTablă, redactare: de la 5 la 40 de enunțuri.
//
// Patru trepte: 5, 10, 20, 40. Pe prima scrii cinci enunțuri. Pe fiecare
// treaptă următoare, fiecare enunț de pe treapta dinainte se rescrie în două,
// cu mai multe detalii: enunțul 1 de la 5 devine 1 și 2 la 10, enunțul 2
// devine 3 și 4, și tot așa. Deci enunțul k de pe o treaptă are „copiii"
// 2k-1 și 2k pe treapta următoare.
//
// O TREAPTĂ PE ECRAN. Deasupra fiecărei perechi stă, stins, enunțul din care
// pornește, ca să știi ce rescrii. Așa încape și pe proiector.
//
// LIVE (0106). Scrie doar adminul; tot ce scrie, plus treapta pe care e, pleacă
// în bază și ajunge pe loc la toți cei care au tabla deschisă. Ceilalți citesc
// doar și îl urmează de pe o treaptă pe alta. Tabla rămâne scrisă până apasă
// adminul „Golește", ca un elev intrat mai târziu să vadă ce e deja pe ea.
// Cuprins în română, nume în engleză.
// =========================================================
import { isAdmin } from "../../shared/scripts/session.js";
import { citesteTabla, scrieTabla, golesteTabla, urmaresteTabla } from "../../shared/scripts/tabla-live-repo.js";

const SLUG = "redactare-enunturi";
const TREPTE = [5, 10, 20, 40];
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
  return { treapta: TREPTE.includes(Number(d?.treapta)) ? Number(d.treapta) : 5, enunturi: e };
}

let scriu = isAdmin();
let { treapta, enunturi } = normalizeaza(null);

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

function deseneaza() {
  const n = treapta;
  document.body.classList.toggle("tr--citeste", !scriu);
  if (n === 5) {
    foaie.innerHTML = `<div class="tr-grup tr-grup--prima">${
      Array.from({ length: 5 }, (_, i) => camp(5, i)).join("")}</div>`;
  } else {
    const sus = n / 2;
    foaie.innerHTML = Array.from({ length: sus }, (_, k) => `<div class="tr-grup">
          <p class="tr-parinte" data-k="${k}"><span class="tr-nr">${k + 1}.</span><span class="tr-parinte__t">${textParinte(sus, k)}</span></p>
          ${camp(n, 2 * k)}
          ${camp(n, 2 * k + 1)}
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
      const h = textParinte(treapta / 2, Number(p.dataset.k));
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
  const ok = await scrieTabla(SLUG, { treapta, enunturi });
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
  if (!confirm("Ștergi tot ce e scris, pe toate cele patru trepte? Se șterge și la elevi.")) return;
  clearTimeout(ceas);
  enunturi = gol();
  treapta = 5;
  deseneaza();
  arataStarea("se golește…", "trimite");
  const ok = await golesteTabla(SLUG);
  arataStarea(ok ? "live · golit" : "negolit: verifică netul", ok ? "live" : "eroare");
  foaie.querySelector(".tr-camp")?.focus();
});

addEventListener("resize", () => foaie.querySelectorAll(".tr-camp").forEach(potriveste));

/* ---------- pornirea ---------- */
punMarimea();
deseneaza();
arataStarea("se încarcă…", "trimite");

const deLaBaza = await citesteTabla(SLUG);
({ treapta, enunturi } = normalizeaza(deLaBaza));
deseneaza();
if (scriu) foaie.querySelector(".tr-camp")?.focus();

/* Cititorul primește fiecare schimbare. Adminul nu: ce vine e chiar ce a
   trimis el, iar aplicat peste ce scrie în clipa asta i-ar fi mâncat literele. */
urmaresteTabla(SLUG, (d) => {
  if (scriu) return;
  const nou = normalizeaza(d);
  const altaTreapta = nou.treapta !== treapta;
  ({ treapta, enunturi } = nou);
  if (altaTreapta) { deseneaza(); document.querySelector(".tr-zona").scrollTop = 0; }
  else improspateazaTextele();
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

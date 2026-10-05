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
// NU SE SALVEAZĂ PE CONT: tabla e pentru oră. Ce scrii stă în
// `sessionStorage`, adică rezistă la o reîncărcare scăpată din greșeală, dar
// pleacă odată cu fila.
// Cuprins în română, nume în engleză.
// =========================================================

const TREPTE = [5, 10, 20, 40];
const CHEIE = "tabla-redactare:enunturi";
const CHEIE_MARIME = "tabla-redactare:marime";

const foaie = document.getElementById("foaie");
const scrise = document.getElementById("scrise");

/* { 5: ["", "", …], 10: [...], 20: [...], 40: [...] } */
function citeste() {
  let d = {};
  try { d = JSON.parse(sessionStorage.getItem(CHEIE) || "{}") || {}; } catch { d = {}; }
  for (const n of TREPTE) {
    const v = Array.isArray(d[n]) ? d[n] : [];
    d[n] = Array.from({ length: n }, (_, i) => String(v[i] ?? ""));
  }
  return d;
}
const enunturi = citeste();
const pastreaza = () => { try { sessionStorage.setItem(CHEIE, JSON.stringify(enunturi)); } catch { /* fără loc: rămâne în pagină */ } };

let treapta = 5;
try { const t = Number(sessionStorage.getItem(`${CHEIE}:treapta`)); if (TREPTE.includes(t)) treapta = t; } catch { /* nimic */ }

const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function camp(n, i) {
  return `<div class="tr-rand">
      <span class="tr-nr">${i + 1}.</span>
      <textarea class="tr-camp" rows="1" data-n="${n}" data-i="${i}"
        aria-label="Enunțul ${i + 1} din ${n}" placeholder="Enunțul ${i + 1}">${esc(enunturi[n][i])}</textarea>
    </div>`;
}

function deseneaza() {
  const n = treapta;
  if (n === 5) {
    foaie.innerHTML = `<div class="tr-grup tr-grup--prima">${
      Array.from({ length: 5 }, (_, i) => camp(5, i)).join("")}</div>`;
  } else {
    const sus = n / 2;
    foaie.innerHTML = Array.from({ length: sus }, (_, k) => {
      const parinte = enunturi[sus][k].trim();
      return `<div class="tr-grup">
          <p class="tr-parinte"><span class="tr-nr">${k + 1}.</span>${
            parinte ? esc(parinte) : `<em>enunțul ${k + 1} de la ${sus} e încă gol</em>`}</p>
          ${camp(n, 2 * k)}
          ${camp(n, 2 * k + 1)}
        </div>`;
    }).join("");
  }
  document.querySelectorAll(".tr-treapta").forEach((b) => {
    const e = Number(b.dataset.n) === n;
    b.classList.toggle("is-on", e);
    b.setAttribute("aria-selected", String(e));
  });
  foaie.querySelectorAll(".tr-camp").forEach(potriveste);
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

function mergiLa(n) {
  if (!TREPTE.includes(n) || n === treapta) return;
  treapta = n;
  try { sessionStorage.setItem(`${CHEIE}:treapta`, String(n)); } catch { /* nimic */ }
  deseneaza();
  document.querySelector(".tr-zona").scrollTop = 0;
  foaie.querySelector(".tr-camp")?.focus();
}

foaie.addEventListener("input", (e) => {
  const t = e.target.closest(".tr-camp");
  if (!t) return;
  enunturi[t.dataset.n][Number(t.dataset.i)] = t.value;
  potriveste(t);
  pastreaza();
  numara();
});

/* Enter trece la enunțul următor; un enunț nu are nevoie de rând nou. La
   ultimul câmp de pe treaptă, Enter nu face nimic. */
foaie.addEventListener("keydown", (e) => {
  const t = e.target.closest(".tr-camp");
  if (!t || e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  const toate = [...foaie.querySelectorAll(".tr-camp")];
  toate[toate.indexOf(t) + 1]?.focus();
});

document.querySelectorAll(".tr-treapta").forEach((b) =>
  b.addEventListener("click", () => mergiLa(Number(b.dataset.n))));

/* Scrisul mai mare ori mai mic, pentru proiector. Ținut minte în browser. */
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

document.getElementById("goleste").addEventListener("click", () => {
  if (!TREPTE.some((n) => enunturi[n].some((x) => x.trim()))) return;
  if (!confirm("Ștergi tot ce e scris, pe toate cele patru trepte?")) return;
  for (const n of TREPTE) enunturi[n] = Array(n).fill("");
  pastreaza();
  treapta = 5;
  deseneaza();
  foaie.querySelector(".tr-camp")?.focus();
});

addEventListener("resize", () => foaie.querySelectorAll(".tr-camp").forEach(potriveste));

punMarimea();
deseneaza();
foaie.querySelector(".tr-camp")?.focus();

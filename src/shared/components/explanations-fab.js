// =========================================================
// „EleviMED îmi transmit explicații Câmpina" — comutatoarele profesorului, pe elev.
//
// TEXTUL E ALES DE MARIUS, cuvânt cu cuvânt: „EleviMED" sunt elevii lui de
// la meditații, „îmi transmit" spune limpede în ce sens curge lucrul (de la
// ei către el), iar „Câmpina" leagă butonul de banca de itemi la care se
// scriu explicațiile. Nu-l prescurta și nu-l „îmbunătăți": rostul lui e ca
// peste șase luni să știe din prima ce face butonul.
//
// LA CE E BUN. Elevii de la meditații scriu explicații la itemii care n-au
// niciuna, dar numai cât stai cu ei. Butonul ăsta îi pornește și îi oprește unul
// câte unul, din orice pagină, ca să n-ai de umblat prin panouri când se așază
// la lucru. E fratele comutatorului de etichetare (`tagging-fab.js`) și se ține
// de aceleași reguli.
//
// UNUL SINGUR, CARE SE DESCHIDE, nu câte unul de elev. Cu trei elevi ar fi ieșit
// trei butoane plutitoare pe fiecare pagină, iar cu opt, un perete. Așa, ecranul
// arată la fel cu un elev și cu opt: un buton, care descoperă o listă scurtă.
//
// NUMAI PROFESORUL îl vede. Dincolo de ce se vede, baza refuză oricum orice
// scriere de la altcineva (migrarea 0087, politica de pe `planner_pupils`):
// butonul care lipsește e curtoazie, funcția din bază e paza.
//
// STILURILE ȘI LE ADUCE SINGUR, ca și vecinii lui, fiindcă trebuie să meargă și
// pe paginile care n-au foaia sitului.
// =========================================================
import { isAdmin } from "../scripts/session.js";
import { tutoringPupils, setPupilCanPropose } from "../scripts/test-repo.js";
import { fabDock } from "./fab-dock.js";

let root = null;
let btn = null;
let listEl = null;
let open = false;   // e desfăcută lista?
let pupils = [];
let busy = new Set(); // elevii pentru care așteptăm răspunsul serverului
/* De ce n-a venit lista, dacă n-a venit. „N-ai elevi" și „n-am putut întreba"
   arată la fel pe un ecran gol, dar înseamnă lucruri opuse: primul e o stare
   normală, al doilea e o defecțiune. Ținute la un loc, panoul minte cu
   încredere, iar tu cauți vina în altă parte. */
let problem = "";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function loadStyles(basePath) {
  if (document.querySelector("link[data-explan-css]")) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = `${basePath}src/shared/styles/explanations-fab.css`;
  l.setAttribute("data-explan-css", "");
  document.head.appendChild(l);
}

const enabledCount = () => pupils.filter((e) => e.canPropose).length;

function render() {
  if (!btn) return;
  const n = enabledCount();
  btn.classList.toggle("e-deschis", n > 0);
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  btn.innerHTML =
    '<span class="explan-fab__lucru">EleviMED îmi transmit explicații Câmpina</span>' +
    '<span class="explan-fab__stare">' +
      '<span class="explan-fab__semn" aria-hidden="true">' + (n > 0 ? "●" : "○") + "</span>" +
      (n > 0 ? `${n} ${n === 1 ? "elev pornit" : "elevi porniți"}` : "Niciun elev pornit") +
    "</span>";
  /* Sfatul spune același lucru ca butonul, cu aceleași cuvinte: „transmit", nu
     „propun". Două vorbe pentru aceeași faptă te pun să te întrebi dacă nu-s
     cumva două lucruri diferite. */
  btn.title = problem
    ? "N-am putut citi lista de la meditații. Apasă ca să vezi de ce."
    : n > 0
      ? "Elevii porniți îți transmit explicații la itemii de la Câmpina care n-au încă una. Apasă ca să vezi lista."
      : "Niciun elev nu-ți transmite explicații acum. Apasă ca să pornești pe cine lucrează cu tine.";

  listEl.hidden = !open;
  if (!open) return;
  if (problem) {
    listEl.innerHTML = `<li class="explan-fab__gol explan-fab__rau">
      N-am putut citi lista de la meditații.<br><code>${esc(problem)}</code>
    </li>`;
    return;
  }
  listEl.innerHTML = pupils.length
    ? pupils.map((e) => `
        <li class="explan-fab__rand">
          <span class="explan-fab__nume">${esc(e.name)}</span>
          <button type="button" class="explan-fab__sw${e.canPropose ? " e-on" : ""}"
            data-pupil="${esc(e.userId)}" role="switch"
            aria-checked="${e.canPropose ? "true" : "false"}"
            ${busy.has(e.userId) ? "disabled" : ""}
            aria-label="${esc(e.name)}: ${e.canPropose ? "poate propune" : "nu poate propune"}">
            <i aria-hidden="true"></i>
          </button>
        </li>`).join("")
    : `<li class="explan-fab__gol">N-ai încă elevi la meditații. Îi adaugi din planificator.</li>`;
}

async function toggle(userId) {
  const el = pupils.find((e) => e.userId === userId);
  if (!el || busy.has(userId)) return;
  busy.add(userId); render();
  const wanted = !el.canPropose;
  const ok = await setPupilCanPropose(userId, wanted);
  /* Dacă serverul n-a primit, comutatorul NU se mișcă. Unul care arată „pornit"
     fără să fie e mai rău decât unul care nu merge: te-ai bizui pe el și l-ai
     lăsa pe elev să scrie în gol. Aceeași regulă ca la etichetare. */
  if (ok) el.canPropose = wanted;
  busy.delete(userId); render();
}

export async function initExplanationProposals(basePath = "") {
  if (!isAdmin()) return;
  if (document.querySelector(".explan-fab-wrap")) return;
  loadStyles(basePath);

  /* Mănunchi propriu, nu al vecinilor. Aceeași lecție ca la etichetare: cine
     își rescrie tot cuprinsul la fiecare redesenare îți șterge butonul din
     mână, fără nicio urmă de greșeală nicăieri. Așezarea alături se face din
     foaia de stil, unde coordonatele se văd una lângă alta. */
  root = document.createElement("div");
  root.className = "explan-fab-wrap";
  fabDock(basePath).appendChild(root);   // rândul comun, nu direct în pagină

  btn = document.createElement("button");
  btn.type = "button";
  btn.className = "explan-fab";
  btn.addEventListener("click", () => { open = !open; render(); });
  root.appendChild(btn);

  listEl = document.createElement("ul");
  listEl.className = "explan-fab__lista";
  listEl.hidden = true;
  listEl.addEventListener("click", (e) => {
    const sw = e.target.closest(".explan-fab__sw");
    if (sw) toggle(sw.dataset.pupil);
  });
  root.appendChild(listEl);

  render();                    // întâi butonul, ca să nu clipească
  try {
    pupils = await tutoringPupils();
  } catch (e) {
    /* Motivul se arată pe ecran, nu doar în consolă: butonul stă pe toate
       paginile, iar cine îl apasă trebuie să afle din el de ce e gol. */
    problem = e?.message || String(e);
    console.warn("tutoringPupils:", problem);
  }
  render();
}

// =========================================================
// „Propuneri de explicații" — comutatoarele profesorului, pe elev.
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
import { elevilMeditatii, pornesteElevul } from "../scripts/test-repo.js";

let radacina = null;
let buton = null;
let lista = null;
let deschis = false;   // e desfăcută lista?
let elevi = [];
let ocupat = new Set(); // elevii pentru care așteptăm răspunsul serverului
/* De ce n-a venit lista, dacă n-a venit. „N-ai elevi" și „n-am putut întreba"
   arată la fel pe un ecran gol, dar înseamnă lucruri opuse: primul e o stare
   normală, al doilea e o defecțiune. Ținute la un loc, panoul minte cu
   încredere, iar tu cauți vina în altă parte. */
let eroare = "";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function aduStilurile(basePath) {
  if (document.querySelector("link[data-explan-css]")) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = `${basePath}src/shared/styles/explanations-fab.css`;
  l.setAttribute("data-explan-css", "");
  document.head.appendChild(l);
}

const catiPorniti = () => elevi.filter((e) => e.potPropune).length;

function deseneaza() {
  if (!buton) return;
  const n = catiPorniti();
  buton.classList.toggle("e-deschis", n > 0);
  buton.setAttribute("aria-expanded", deschis ? "true" : "false");
  buton.innerHTML =
    '<span class="explan-fab__lucru">Propuneri de explicații</span>' +
    '<span class="explan-fab__stare">' +
      '<span class="explan-fab__semn" aria-hidden="true">' + (n > 0 ? "●" : "○") + "</span>" +
      (n > 0 ? `${n} ${n === 1 ? "elev pornit" : "elevi porniți"}` : "Niciun elev pornit") +
    "</span>";
  buton.title = eroare
    ? "N-am putut citi lista de la meditații. Apasă ca să vezi de ce."
    : n > 0
      ? "Elevii porniți pot propune explicații la itemii fără explicație. Apasă ca să vezi lista."
      : "Niciun elev nu poate propune acum. Apasă ca să pornești pe cine lucrează cu tine.";

  lista.hidden = !deschis;
  if (!deschis) return;
  if (eroare) {
    lista.innerHTML = `<li class="explan-fab__gol explan-fab__rau">
      N-am putut citi lista de la meditații.<br><code>${esc(eroare)}</code>
    </li>`;
    return;
  }
  lista.innerHTML = elevi.length
    ? elevi.map((e) => `
        <li class="explan-fab__rand">
          <span class="explan-fab__nume">${esc(e.nume)}</span>
          <button type="button" class="explan-fab__sw${e.potPropune ? " e-on" : ""}"
            data-elev="${esc(e.userId)}" role="switch"
            aria-checked="${e.potPropune ? "true" : "false"}"
            ${ocupat.has(e.userId) ? "disabled" : ""}
            aria-label="${esc(e.nume)}: ${e.potPropune ? "poate propune" : "nu poate propune"}">
            <i aria-hidden="true"></i>
          </button>
        </li>`).join("")
    : `<li class="explan-fab__gol">N-ai încă elevi la meditații. Îi adaugi din planificator.</li>`;
}

async function comuta(userId) {
  const el = elevi.find((e) => e.userId === userId);
  if (!el || ocupat.has(userId)) return;
  ocupat.add(userId); deseneaza();
  const vrut = !el.potPropune;
  const bine = await pornesteElevul(userId, vrut);
  /* Dacă serverul n-a primit, comutatorul NU se mișcă. Unul care arată „pornit"
     fără să fie e mai rău decât unul care nu merge: te-ai bizui pe el și l-ai
     lăsa pe elev să scrie în gol. Aceeași regulă ca la etichetare. */
  if (bine) el.potPropune = vrut;
  ocupat.delete(userId); deseneaza();
}

export async function initPropuneriExplicatii(basePath = "") {
  if (!isAdmin()) return;
  if (document.querySelector(".explan-fab-wrap")) return;
  aduStilurile(basePath);

  /* Mănunchi propriu, nu al vecinilor. Aceeași lecție ca la etichetare: cine
     își rescrie tot cuprinsul la fiecare redesenare îți șterge butonul din
     mână, fără nicio urmă de greșeală nicăieri. Așezarea alături se face din
     foaia de stil, unde coordonatele se văd una lângă alta. */
  radacina = document.createElement("div");
  radacina.className = "explan-fab-wrap";
  document.body.appendChild(radacina);

  buton = document.createElement("button");
  buton.type = "button";
  buton.className = "explan-fab";
  buton.addEventListener("click", () => { deschis = !deschis; deseneaza(); });
  radacina.appendChild(buton);

  lista = document.createElement("ul");
  lista.className = "explan-fab__lista";
  lista.hidden = true;
  lista.addEventListener("click", (e) => {
    const sw = e.target.closest(".explan-fab__sw");
    if (sw) comuta(sw.dataset.elev);
  });
  radacina.appendChild(lista);

  deseneaza();                    // întâi butonul, ca să nu clipească
  try {
    elevi = await elevilMeditatii();
  } catch (e) {
    /* Motivul se arată pe ecran, nu doar în consolă: butonul stă pe toate
       paginile, iar cine îl apasă trebuie să afle din el de ce e gol. */
    eroare = e?.message || String(e);
    console.warn("elevilMeditatii:", eroare);
  }
  deseneaza();
}

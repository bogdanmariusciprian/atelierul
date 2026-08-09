// =========================================================
// Comutatorul „Etichetare" al profesorului, lângă butonul TO-DO.
//
// LA CE E BUN. Elevii pun etichete pe cuvinte, dar numai la meditație, cu tine
// lângă ei. Comutatorul ăsta deschide și închide treaba pentru toți deodată,
// din orice pagină, ca să n-ai de umblat prin panouri când se așază la lucru.
//
// SCRIE PE EL CE FACE, ȘI ÎN CE STARE E. Un bec verde-roșu ar fi cerut ținut
// minte care culoare ce înseamnă, iar tu îl vezi de câteva ori pe săptămână, nu
// de zece ori pe zi. De-aia butonul zice în litere „Etichetare: DESCHISĂ" ori
// „ÎNCHISĂ", iar culoarea vine pe deasupra, nu în locul cuvântului.
//
// NUMAI PROFESORUL îl vede. Iar dincolo de ce se vede, baza refuză oricum orice
// scriere de la altcineva (migrarea 0082): butonul care lipsește e curtoazie,
// funcția din bază e paza.
//
// STILURILE ȘI LE ADUCE SINGUR, ca și TO-DO-ul, fiindcă trebuie să meargă și pe
// paginile care n-au foaia sitului (cele două table, atelierul de redactare).
// =========================================================
import { isAdmin } from "../scripts/session.js";
import { eDeschis, pune, ascultaComutatorul, eDeschisDupaMemorie } from "../scripts/tagging-repo.js";

let radacina = null;
let buton = null;
let deschis = false;
let ocupat = false;

function aduStilurile(basePath) {
  if (document.querySelector("link[data-tagging-css]")) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = `${basePath}src/shared/styles/tagging.css`;
  l.setAttribute("data-tagging-css", "");
  document.head.appendChild(l);
}

function deseneaza() {
  if (!buton) return;
  buton.classList.toggle("e-deschis", deschis);
  buton.classList.toggle("e-ocupat", ocupat);
  buton.setAttribute("aria-pressed", deschis ? "true" : "false");
  buton.innerHTML =
    '<span class="tagging-fab__semn" aria-hidden="true">' + (deschis ? "●" : "○") + "</span>" +
    '<span class="tagging-fab__t">Etichetare</span>' +
    '<span class="tagging-fab__stare">' + (deschis ? "DESCHISĂ" : "ÎNCHISĂ") + "</span>";
  buton.title = deschis
    ? "Elevii de la meditații pot pune etichete pe cuvinte. Apasă ca să închizi."
    : "Elevii nu pot eticheta acum. Apasă ca să deschizi, cât lucrezi cu ei.";
}

async function comuta() {
  if (ocupat) return;
  ocupat = true; deseneaza();
  const vrut = !deschis;
  const bine = await pune(vrut);
  /* Dacă serverul n-a primit, starea de pe buton NU se schimbă. Un comutator
     care arată „deschis" fără să fie e mai rău decât unul care nu merge: te-ai
     baza pe el și ai lăsa elevii să scrie în gol. */
  if (bine) deschis = vrut;
  ocupat = false; deseneaza();
}

export async function initTagging(basePath = "") {
  if (!isAdmin()) return;
  if (document.querySelector(".tagging-fab")) return;
  aduStilurile(basePath);

  /* Locul e lângă TO-DO, în același mănunchi dacă el există deja: două butoane
     plutitoare care se așază fiecare după capul lui ajung, mai devreme sau mai
     târziu, unul peste altul. */
  radacina = document.querySelector(".todo-fab-wrap");
  if (!radacina) {
    radacina = document.createElement("div");
    radacina.className = "todo-fab-wrap";
    document.body.appendChild(radacina);
  }

  buton = document.createElement("button");
  buton.type = "button";
  buton.className = "tagging-fab";
  buton.addEventListener("click", comuta);
  radacina.appendChild(buton);

  // Întâi cu ce știam, ca butonul să nu clipească dintr-o stare în alta.
  deschis = eDeschisDupaMemorie();
  deseneaza();
  deschis = await eDeschis();
  deseneaza();

  // Dacă îl schimbi din altă filă, se vede și aici.
  ascultaComutatorul((val) => { deschis = val; deseneaza(); });
}

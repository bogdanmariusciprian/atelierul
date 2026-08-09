// =========================================================
// Comutatorul „Etichetare" al profesorului, lângă butonul TO-DO.
//
// LA CE E BUN. Elevii pun etichete pe cuvinte, dar numai la meditație, cu tine
// lângă ei. Comutatorul ăsta deschide și închide treaba pentru toți deodată,
// din orice pagină, ca să n-ai de umblat prin panouri când se așază la lucru.
//
// SPUNE ÎNTREG CE FACE, NU PE SCURT. Scria mai devreme doar „Etichetare:
// DESCHISĂ", și era prea puțin: peste o lună, „etichetare" singur nu-ți mai
// spune nici ce se etichetează, nici unde, nici cine. Un buton care stă pe toate
// paginile și se apasă o dată pe săptămână trebuie citit fără să-ți amintești
// nimic, deci scrie pe două rânduri: sus LUCRUL, jos STAREA, spusă din punctul
// de vedere al elevului, fiindcă despre îngăduința lui e vorba.
//
// Culoarea vine pe deasupra cuvintelor, nu în locul lor. Un bec verde-roșu ar fi
// cerut ținut minte care culoare ce înseamnă.
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
    '<span class="tagging-fab__lucru">Etichetare cuvinte fonetică din #LaTablă</span>' +
    '<span class="tagging-fab__stare">' +
      '<span class="tagging-fab__semn" aria-hidden="true">' + (deschis ? "●" : "○") + "</span>" +
      (deschis ? "Permisă elevilor" : "Blocată pentru elevi") +
    "</span>";
  buton.title = deschis
    ? "Elevii de la meditații pot pune etichete pe cuvinte. Apasă ca să blochezi."
    : "Elevii nu pot eticheta acum. Apasă ca să le permiți, cât lucrezi cu ei.";
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

  /* MĂNUNCHI PROPRIU, NU AL LUI TO-DO, deși stau unul lângă altul.

     Îl pusesem întâi în mănunchiul lui TO-DO, ca să nu se așeze fiecare după
     capul lui. Numai că TO-DO își REscrie tot cuprinsul la fiecare redesenare
     (`radacina.innerHTML = …`), iar el se redesenează îndată ce răspunde
     serverul. Butonul se năștea și pierea o clipă mai târziu, fără nicio urmă
     de greșeală nicăieri: se vedea doar că nu e.

     Regula pe care o iau de-aici: nu-ți lăsa lucrul într-o cutie pe care o
     stăpânește altcineva. Așezarea alături se face din foaia de stil, unde
     amândouă coordonatele se văd una lângă alta. */
  radacina = document.createElement("div");
  radacina.className = "tagging-fab-wrap";
  document.body.appendChild(radacina);

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

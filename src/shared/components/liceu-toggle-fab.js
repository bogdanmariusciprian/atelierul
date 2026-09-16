// =========================================================
// COMUTATORUL „LICEU: AFIȘAT / ASCUNS", plutitor, numai la profesor.
//
// Aprinde și stinge semnul din `school_config` (migrarea 0094). Stins, orarul și
// planificările nu se mai citesc de nimeni altcineva — nu „nu se mai desenează",
// ci chiar nu se mai dau, fiindcă politicile din bază întreabă semnul înainte de
// orice rând. Butonul ăsta e mânerul lacătului, nu lacătul.
//
// DACĂ BAZA N-A PRIMIT, COMUTATORUL NU SE MIȘCĂ. Regula de la butoanele cu
// elevi, și e cea mai importantă de aici: unul care arată „ascuns" fără să fie
// e mai rău decât unul care nu merge deloc, fiindcă pleci de la oră crezând că
// l-ai închis. De-aia se desenează ce s-a întors din bază, nu ce s-a apăsat.
//
// SE ANUNȚĂ CÂND SE SCHIMBĂ, printr-un eveniment pe fereastră: „L"-ul din
// marginea dreaptă se ia ori se pune pe loc, fără reîncărcat pagina. Altfel ar
// fi trebuit să dai refresh ca să vezi ce-ai făcut, iar asta n-o cerem nimănui.
//
// NUMAI PROFESORUL îl vede. Dincolo de ce se vede, baza refuză oricum orice
// scriere de la altcineva — am probat: un elev care cere schimbarea atinge zero
// rânduri, iar dacă încearcă să bage unul nou e refuzat.
// Cuprins în română, nume în engleză.
// =========================================================
import { isAdmin } from "../scripts/session.js";
import { aduLiceuDeschis, liceuDeschisStiut, puneLiceuDeschis } from "../scripts/liceu-gate.js";
import { fabDock } from "./fab-dock.js";

let stilPus = false;
function aduStilurile(basePath) {
  if (stilPus || document.querySelector("link[data-ltf-css]")) { stilPus = true; return; }
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = `${basePath}src/shared/styles/liceu-toggle-fab.css`;
  l.setAttribute("data-ltf-css", "");
  document.head.appendChild(l);
  stilPus = true;
}

const OCHI_DESCHIS = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  ><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;

const OCHI_TAIAT = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  ><path d="M3 3l18 18"/><path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.2 4.1"/><path
  d="M6.5 6.7A17.6 17.6 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`;

export async function initLiceuToggle(basePath = "") {
  if (window.__liceuToggleOn) return;
  if (!isAdmin()) return;
  /* În modul nu-l punem: acolo ești deja înăuntru, iar pagina n-are bara
     sitului și nici rândul de butoane plutitoare. */
  if (window.location.pathname.replace(/\/+$/, "") === "/liceu") return;
  window.__liceuToggleOn = true;

  aduStilurile(basePath);

  const manunchi = document.createElement("div");
  manunchi.className = "liceu-fab-wrap";
  fabDock(basePath).appendChild(manunchi);

  /* `null` = încă nu știm. Atunci butonul se arată amorțit și nu se apasă: un
     comutator care arată „ascuns" înainte să fi aflat ar fi o minciună. */
  let deschis = liceuDeschisStiut();
  let seLucreaza = false;

  function deseneaza() {
    const habar = deschis === null;
    const vorba = habar ? "Liceu…" : (deschis ? "Liceu: afișat" : "Liceu: ascuns");
    manunchi.innerHTML = `
      <button type="button" class="liceu-fab-btn${deschis ? " is-on" : ""}"
        ${habar || seLucreaza ? "disabled" : ""}
        role="switch" aria-checked="${deschis === true}"
        title="${habar
          ? "Aflu dacă modulul Liceu e deschis…"
          : (deschis
              ? "Modulul Liceu e deschis: elevii văd butonul „L” și orarul. Apasă ca să-l închizi."
              : "Modulul Liceu e închis: elevii n-au nici butonul, nici datele. Apasă ca să-l deschizi.")}"
        >${deschis ? OCHI_DESCHIS : OCHI_TAIAT}<span>${vorba}</span></button>`;
  }

  manunchi.addEventListener("click", async (e) => {
    if (!e.target.closest(".liceu-fab-btn")) return;
    if (seLucreaza || deschis === null) return;
    seLucreaza = true;
    deseneaza();

    const r = await puneLiceuDeschis(!deschis);
    /* Ce s-a întors din bază, nu ce s-a cerut. */
    deschis = r.da;
    seLucreaza = false;
    deseneaza();

    if (!r.mers) {
      manunchi.querySelector(".liceu-fab-btn")?.classList.add("a-dat-gres");
      setTimeout(() => manunchi.querySelector(".liceu-fab-btn")?.classList.remove("a-dat-gres"), 1400);
      return;
    }
    window.dispatchEvent(new CustomEvent("atelier:liceu-deschis", { detail: deschis }));
  });

  deseneaza();
  deschis = await aduLiceuDeschis();
  deseneaza();
}

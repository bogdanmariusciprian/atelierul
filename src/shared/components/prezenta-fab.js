// =========================================================
// BUTONUL „PREGĂTIRE BAC", plutitor, numai la profesor.
//
// Duce la pagina de prezență de la orele Google Meet (/comunitate/prezenta/).
// Datele vin singure din tabelul Google, prin funcția `primeste-prezenta`.
//
// NUMAI PROFESORUL îl vede. Dar butonul nu e lacătul: pagina se poate deschide
// și după adresă, iar acolo baza nu dă nimic nimănui afară de admin (RLS,
// migrarea 0110). Ascunderea de aici e doar ca elevii să nu dea peste el.
// Cuprins în română, nume în engleză.
// =========================================================
import { isAdmin } from "../scripts/session.js";
import { fabDock } from "./fab-dock.js";

const ADRESA = "/comunitate/prezenta/";

let stilPus = false;
function aduStilurile(basePath) {
  if (stilPus || document.querySelector("link[data-pzf-css]")) { stilPus = true; return; }
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = `${basePath}src/shared/styles/prezenta-fab.css`;
  l.setAttribute("data-pzf-css", "");
  document.head.appendChild(l);
  stilPus = true;
}

const BIFA = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  ><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>`;

export function initPrezenta(basePath = "") {
  if (window.__prezentaFabOn) return;
  if (!isAdmin()) return;
  /* Pe pagina însăși n-are rost: ești deja acolo. */
  if (window.location.pathname.replace(/\/+$/, "") === ADRESA.replace(/\/+$/, "")) return;
  window.__prezentaFabOn = true;

  aduStilurile(basePath);

  const manunchi = document.createElement("div");
  manunchi.className = "prezenta-fab-wrap";
  manunchi.innerHTML = `
    <a class="prezenta-fab-btn" href="${ADRESA}"
      title="Prezența la orele de pregătire pentru BAC (Google Meet)"
      >${BIFA}<span>Pregătire BAC</span></a>`;
  fabDock(basePath).appendChild(manunchi);
}

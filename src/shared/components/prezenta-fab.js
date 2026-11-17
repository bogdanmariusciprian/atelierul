// =========================================================
// BUTONUL „PREGĂTIRE BAC", plutitor, numai la profesor.
// Lângă el, butonul „Tabla", spre tabla albă (/tabla/, 0113).
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
const TABLA = "/tabla/";

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

const CREION = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  ><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 12l3-3 2 2 4-4"/></svg>`;

const BIFA = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  ><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>`;

export function initPrezenta(basePath = "") {
  if (window.__prezentaFabOn) return;
  if (!isAdmin()) return;
  /* Pe pagina însăși n-are rost un buton: ești deja acolo. */
  const aici = window.location.pathname.replace(/\/+$/, "");
  const butoane = [
    aici === ADRESA.replace(/\/+$/, "") ? "" : `<a class="prezenta-fab-btn" href="${ADRESA}"
      title="Prezența la orele de pregătire pentru BAC (Google Meet)"
      >${BIFA}<span>Pregătire BAC</span></a>`,
    /* Nu și pe pagina Admiterii la Drept: acolo nu se schimbă nimic. */
    aici === TABLA.replace(/\/+$/, "") || aici.startsWith("/teste/admitere-drept") ? "" : `<a class="prezenta-fab-btn prezenta-fab-btn--tabla" href="${TABLA}"
      title="Tabla albă a claselor: scrii, iar elevii văd live"
      >${CREION}<span>Tabla</span></a>`,
  ].filter(Boolean);
  if (!butoane.length) return;
  window.__prezentaFabOn = true;

  aduStilurile(basePath);

  const manunchi = document.createElement("div");
  manunchi.className = "prezenta-fab-wrap";
  manunchi.innerHTML = butoane.join("");
  fabDock(basePath).appendChild(manunchi);
}

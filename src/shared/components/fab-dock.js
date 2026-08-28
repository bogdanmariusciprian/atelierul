// =========================================================
// SUPORTUL BUTOANELOR PLUTITOARE, unul singur pentru toate.
//
// DE CE EXISTĂ. Până acum fiecare buton se așeza singur, cu `bottom` socotit din
// înălțimea vecinilor: etichetarea la 26, TO-DO la 92 (26+56+10), propunerile la
// 144 (92+42+10). Mergea, dar era o socoteală ținută în trei foi de stil
// deodată: cine schimba înălțimea unui buton îl acoperea pe altul, iar pe
// telefon TO-DO și etichetarea se călcau deja de o vreme.
//
// Acum stau în rând, într-un singur suport. Rândul își împarte singur locul,
// deci lățimile pot să se schimbe cu textul („Niciun elev pornit" față de „3
// elevi porniți") fără să mai socotească nimeni nimic.
//
// CE TREBUIE SĂ ȘTIE UN BUTON CARE INTRĂ AICI:
//   · nu-și mai pune `position: fixed`, `left`, `bottom` sau `z-index` – le are
//     de la suport;
//   · mănunchiul lui e `position: relative`, iar panoul care se deschide stă
//     `absolute` DEASUPRA lui, ca să nu umfle rândul;
//   · își cere locul în rând cu `order`, ca șirul lor să fie hotărât, nu lăsat
//     pe seama întâmplării (cine apucă să pornească întâi).
// =========================================================

let stilPus = false;

/** Suportul comun. Se naște la prima chemare, apoi se dă mai departe același. */
export function fabDock(basePath = "") {
  if (!stilPus && !document.querySelector("link[data-fab-dock-css]")) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = `${basePath}src/shared/styles/fab-dock.css`;
    l.setAttribute("data-fab-dock-css", "");
    document.head.appendChild(l);
    stilPus = true;
  }
  let dock = document.querySelector(".fab-dock");
  if (dock) return dock;
  dock = document.createElement("div");
  dock.className = "fab-dock";
  document.body.appendChild(dock);
  return dock;
}

// =========================================================
// BUTONUL PLUTITOR CU COMUTATOARE PE ELEV — scris o singură dată.
//
// LA CE E BUN. Profesorul dă îngăduințe pe om, nu pe tot situl: „elevul ăsta
// îmi transmite explicații", „elevul ăsta poate eticheta cuvinte". Butonul stă
// pe orice pagină, se deschide într-o listă scurtă cu elevii de la meditații și
// un comutator la fiecare.
//
// DE CE E UNUL SINGUR PENTRU AMÂNDOUĂ. Aveam deja butonul pentru explicații
// (0087); când Marius l-a cerut și la etichetare, a doua copie ar fi însemnat să
// scriu a doua oară aceleași reguli mărunte, dintre care una chiar se uită ușor:
// „dacă serverul n-a primit, comutatorul NU se mișcă". Un comutator care arată
// „pornit" fără să fie e mai rău decât unul care nu merge, fiindcă te bizui pe
// el și-l lași pe elev să scrie în gol. Scrisă o dată, regula nu se poate uita
// pe jumătate.
//
// CE ADUCE FIECARE BUTON DE LA EL: numele clasei mănunchiului (ca să-și știe
// locul în rând și să-l găsească probele), îngăduința pe care o dă, textul de pe
// el și sfaturile. Purtarea e aceeași.
//
// UNUL CARE SE DESCHIDE, nu câte unul de elev. Cu trei elevi ar fi ieșit trei
// butoane pe fiecare pagină, iar cu opt, un perete. Așa, ecranul arată la fel cu
// un elev și cu opt.
//
// NUMAI PROFESORUL îl vede. Dincolo de ce se vede, baza refuză oricum orice
// scriere de la altcineva (migrările 0087 și 0088): butonul care lipsește e
// curtoazie, funcția din bază e paza.
// =========================================================
import { isAdmin } from "../scripts/session.js";
import { tutoringPupils, setPupilPermission } from "../scripts/pupils-repo.js";
import { fabDock } from "./fab-dock.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let stilPus = false;
function aduStilurile(basePath) {
  if (stilPus || document.querySelector("link[data-psf-css]")) { stilPus = true; return; }
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = `${basePath}src/shared/styles/pupil-switch-fab.css`;
  l.setAttribute("data-psf-css", "");
  document.head.appendChild(l);
  stilPus = true;
}

/**
 * Face un buton plutitor cu comutatoare pe elev.
 *
 * @param {object} cfg
 * @param {string} cfg.wrapClass    clasa mănunchiului (`explan-fab-wrap`, `tagging-fab-wrap`)
 * @param {string} cfg.permission   cheia din `INGADUINTE` (`explicatii`, `etichetare`)
 * @param {string} cfg.label        rândul de sus, care spune ÎNTREG ce face butonul
 * @param {object} cfg.titles       sfaturile: { problem, none, some(n) }
 * @param {string} cfg.empty        ce scrie când n-ai niciun elev la meditații
 * @returns {(basePath?: string) => Promise<void>} funcția de pornire
 */
export function pupilSwitchFab(cfg) {
  let root = null, btn = null, listEl = null;
  let open = false;
  let pupils = [];
  const busy = new Set();     // elevii pentru care așteptăm răspunsul serverului
  /* De ce n-a venit lista, dacă n-a venit. „N-ai elevi" și „n-am putut întreba"
     arată la fel pe un ecran gol, dar înseamnă lucruri opuse: primul e o stare
     normală, al doilea e o defecțiune. Ținute la un loc, panoul minte cu
     încredere, iar tu cauți vina în altă parte – s-a și întâmplat, de două ori,
     pe același buton. */
  let problem = "";

  const cati = () => pupils.filter((p) => p.can?.[cfg.permission]).length;

  function deseneaza() {
    if (!btn) return;
    const n = cati();
    btn.classList.toggle("e-deschis", n > 0);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.innerHTML =
      `<span class="psf__lucru">${esc(cfg.label)}</span>` +
      '<span class="psf__stare">' +
        `<span class="psf__semn" aria-hidden="true">${n > 0 ? "●" : "○"}</span>` +
        (n > 0 ? `${n} ${n === 1 ? "elev pornit" : "elevi porniți"}` : "Niciun elev pornit") +
      "</span>";
    btn.title = problem ? cfg.titles.problem : n > 0 ? cfg.titles.some(n) : cfg.titles.none;

    listEl.hidden = !open;
    if (!open) return;
    if (problem) {
      listEl.innerHTML = `<li class="psf__gol psf__rau">
        N-am putut citi lista de la meditații.<br><code>${esc(problem)}</code>
      </li>`;
      return;
    }
    listEl.innerHTML = pupils.length
      ? pupils.map((p) => {
        const pornit = !!p.can?.[cfg.permission];
        return `
        <li class="psf__rand">
          <span class="psf__nume">${esc(p.name)}</span>
          <button type="button" class="psf__sw${pornit ? " e-on" : ""}"
            data-pupil="${esc(p.userId)}" role="switch"
            aria-checked="${pornit ? "true" : "false"}"
            ${busy.has(p.userId) ? "disabled" : ""}
            aria-label="${esc(p.name)}: ${pornit ? "pornit" : "oprit"}">
            <i aria-hidden="true"></i>
          </button>
        </li>`;
      }).join("")
      : `<li class="psf__gol">${esc(cfg.empty)}</li>`;
  }

  async function comuta(userId) {
    const p = pupils.find((x) => x.userId === userId);
    if (!p || busy.has(userId)) return;
    busy.add(userId); deseneaza();
    const vrut = !p.can?.[cfg.permission];
    const ok = await setPupilPermission(userId, cfg.permission, vrut);
    /* DACĂ SERVERUL N-A PRIMIT, COMUTATORUL NU SE MIȘCĂ. Regula stă aici, o
       singură dată, tocmai ca a doua copie a butonului să n-o poată uita. */
    if (ok) p.can = { ...p.can, [cfg.permission]: vrut };
    busy.delete(userId); deseneaza();
  }

  return async function porneste(basePath = "") {
    if (!isAdmin()) return;
    if (document.querySelector("." + cfg.wrapClass)) return;
    aduStilurile(basePath);

    /* MĂNUNCHI PROPRIU, nu al vecinilor. Lecția e veche și scumpă: pus în cutia
       lui TO-DO, butonul pierea, fiindcă TO-DO își rescrie tot cuprinsul la
       fiecare redesenare. Nu-ți lăsa lucrul într-o cutie stăpânită de altcineva.
       Așezarea în rând o face suportul comun (`fab-dock.css`). */
    root = document.createElement("div");
    root.className = `psf ${cfg.wrapClass}`;
    fabDock(basePath).appendChild(root);

    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "psf__btn";
    btn.addEventListener("click", () => { open = !open; deseneaza(); });
    root.appendChild(btn);

    listEl = document.createElement("ul");
    listEl.className = "psf__lista";
    listEl.hidden = true;
    listEl.addEventListener("click", (e) => {
      const sw = e.target.closest(".psf__sw");
      if (sw) comuta(sw.dataset.pupil);
    });
    root.appendChild(listEl);

    deseneaza();                    // întâi butonul, ca să nu clipească
    try {
      pupils = await tutoringPupils();
    } catch (e) {
      /* Motivul se arată PE ECRAN, nu doar în consolă: butonul stă pe toate
         paginile, iar cine îl apasă trebuie să afle din el de ce e gol. */
      problem = e?.message || String(e);
      console.warn(`${cfg.wrapClass}:`, problem);
    }
    deseneaza();
  };
}

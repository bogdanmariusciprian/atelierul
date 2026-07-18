// =========================================================
// One test category = one page (/teste/<slug>/).
//   • Presentation: the category's symbol, its colour, and two panels —
//     downloadable tests and the interactive practice.
//   • Only „Admitere Drept" is live; the rest simply say „va urma".
//   • #joc turns the page into the practice itself:
//       PUPIL / GUEST → the mini-game (tests-game.js)
//       ADMIN         → the item grid (tests-admin-grid.js)
//     A ?item=<uuid> deep link (from a flagged report) goes straight there.
// Content Romanian, identifiers English.
// =========================================================
import { TEST_CAT_BY_SLUG } from "./test-categories.js";
import { initTestGame } from "./tests-game.js";
import { initTestAdminGrid } from "./tests-admin-grid.js";
import { isAdmin } from "../../shared/scripts/session.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let root = null;
let cat = null;
let adminMode = false;

export function initTestCategory(mountEl, slug) {
  cat = TEST_CAT_BY_SLUG[slug];
  if (!mountEl || !cat) return;
  root = mountEl;
  // The whole page dresses in the category's colour.
  document.documentElement.style.setProperty("--cat-color", cat.color);
  adminMode = isAdmin();
  window.addEventListener("hashchange", route);
  // The session may settle after first paint (teacher signs in) → re-route.
  window.addEventListener("atelier:role", () => {
    const a = isAdmin();
    if (a !== adminMode) { adminMode = a; route(); }
  });
  route();
}

// Leaving the admin grid: drop its full-screen look AND unlock the page scroll
// (the grid locks <html>/<body> overflow while it's open).
function leaveAdminMode() {
  document.body.classList.remove("tg-mode");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

const wantsPractice = () =>
  (location.hash || "").replace(/^#/, "") === "joc"
  || !!new URLSearchParams(location.search).get("item"); // report deep link

function route() {
  const play = !!cat.live && wantsPractice();
  document.body.classList.toggle("tgame-active", play); // shrink the page hero while playing
  if (!play) { leaveAdminMode(); return renderIntro(); }
  if (adminMode) return initTestAdminGrid(root); // teacher → item grid
  leaveAdminMode();
  initTestGame(root, cat.slug);                  // pupil / guest → mini-game
}

function renderIntro() {
  root.className = "tcat";
  const soon = `<p class="tcat__soon">Va urma.</p>`;
  root.innerHTML = `
    <section class="tcat__hero">
      <span class="tcat__icon" aria-hidden="true">${cat.icon}</span>
      <div>
        <h1 class="tcat__title">${esc(cat.title)}</h1>
        <p class="tcat__desc">${esc(cat.desc)}</p>
      </div>
    </section>

    <div class="tcat__panels">
      <section class="tcat__panel">
        <h2 class="tcat__ph"><span aria-hidden="true">📄</span> Teste descărcabile</h2>
        ${cat.live
          ? `<p class="tcat__soon">Testele în format descărcabil vor fi disponibile în curând.</p>`
          : soon}
      </section>

      <section class="tcat__panel tcat__panel--play">
        <h2 class="tcat__ph"><span aria-hidden="true">🎮</span> Antrenament interactiv</h2>
        ${cat.live
          ? `<p class="tcat__lead">Rezolvi câte un item pe rând, cu explicație imediată. Cei greșiți revin până îi nimerești.</p>
             <a class="tcat__play" href="#joc">
               <span class="tcat__play__ic" aria-hidden="true">${adminMode ? "🛠️" : "▸"}</span>
               ${adminMode ? "Deschide grila de itemi" : "Începe antrenamentul"}
             </a>`
          : soon}
      </section>
    </div>`;
}

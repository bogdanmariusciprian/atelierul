// =========================================================
// Teste — category hub + routing.
//   • The category grid (only „Admitere Drept" is live; the rest show „în curând").
//   • Opening a live category:
//       - PUPIL / GUEST → the configurable mini-game (tests-game.js).
//       - ADMIN (teacher) → the Excel-like item editor (tests-admin-grid.js).
//   Content Romanian, identifiers English.
// =========================================================
import { initTestAdminGrid } from "./tests-admin-grid.js";
import { initTestGame } from "./tests-game.js";
import { isAdmin } from "../../shared/scripts/session.js";

const CATEGORIES = [
  { slug: "clasa-6", icon: "📘", color: "#0ea5e9", live: false,
    title: "Clasa a 6-a", desc: "Evaluarea Națională la clasa a VI-a — limbă și comunicare." },
  { slug: "clasa-8", icon: "📗", color: "#16a34a", live: false,
    title: "Clasa a 8-a", desc: "Evaluarea Națională — limba și literatura română." },
  { slug: "clasa-12", icon: "🎓", color: "#7c3aed", live: false,
    title: "Clasa a 12-a", desc: "Bacalaureat — proba de limba și literatura română." },
  { slug: "admitere-politie", icon: "🛡️", color: "#1d4ed8", live: false,
    title: "Admitere Poliție", desc: "Subiecte de limba română pentru admiterea la Academia de Poliție." },
  { slug: "admitere-drept", icon: "⚖️", color: "#b45309", live: true,
    title: "Admitere Drept", desc: "Itemi de limba română de la admiterea la Facultatea de Drept (2002–2026)." },
];
const CAT_BY_SLUG = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let root = null;
let adminMode = false;

// Leaving the admin grid: drop its full-screen look AND unlock the page scroll
// (the grid locks <html>/<body> overflow while it's open).
function leaveAdminMode() {
  document.body.classList.remove("tg-mode");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

export function initTestsHub(mountEl) {
  root = mountEl;
  adminMode = isAdmin();
  window.addEventListener("hashchange", route);
  // If the session settles / the teacher signs in after first paint, re-route.
  window.addEventListener("atelier:role", () => {
    const a = isAdmin();
    if (a !== adminMode) { adminMode = a; route(); }
  });
  route();
}

function route() {
  const slug = (location.hash || "").replace(/^#/, "");
  const cat = CAT_BY_SLUG[slug];
  const inGame = !!(cat && cat.live && !adminMode);
  document.body.classList.toggle("tgame-active", inGame); // shrink the „Teste" hero while playing
  if (cat && cat.live && adminMode) { initTestAdminGrid(root); return; } // teacher → editor
  leaveAdminMode();
  if (inGame) initTestGame(root, cat.slug); // pupil / guest → mini-game
  else renderHub();
}

// ---------- category grid ----------
function renderHub() {
  root.className = "tests-grid";
  root.innerHTML = CATEGORIES.map((c) => `
    <a class="test-card${c.live ? " is-live" : ""}" id="${c.slug}" href="#${c.slug}" style="--card-color:${c.color}">
      <span class="test-card__icon" aria-hidden="true">${c.icon}</span>
      <h2 class="test-card__title">${esc(c.title)}</h2>
      <p class="test-card__desc">${esc(c.desc)}</p>
      ${c.live ? `<span class="test-card__go">Deschide →</span>` : `<span class="test-card__soon">în curând</span>`}
    </a>`).join("");
}

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
import { fetchTestDownloads, fetchDriveFolderUrl } from "../../shared/scripts/test-repo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let root = null;
let cat = null;
let adminMode = false;
let downloads = []; // published files for this category, newest year first
let folderUrl = ""; // the Drive folder behind them, for „descarcă tot"

export function initTestCategory(mountEl, slug) {
  cat = TEST_CAT_BY_SLUG[slug];
  if (!mountEl || !cat) return;
  root = mountEl;
  // The whole page dresses in the category's colour, on a dark console base.
  document.documentElement.style.setProperty("--cat-color", cat.color);
  document.body.classList.add("tcat-page");
  adminMode = isAdmin();
  window.addEventListener("hashchange", route);
  // The session may settle after first paint (teacher signs in) → re-route.
  window.addEventListener("atelier:role", () => {
    const a = isAdmin();
    if (a !== adminMode) { adminMode = a; route(); }
  });
  route();
  // The files live on the teacher's Drive; the list of them lives in the DB.
  // Fetched after the first paint so the page never waits on it — and both at
  // once, so the panel doesn't redraw twice.
  Promise.all([fetchTestDownloads(cat.slug), fetchDriveFolderUrl(cat.slug)])
    .then(([rows, url]) => {
      downloads = rows;
      folderUrl = url;
      if (!wantsPractice()) renderIntro();
    });
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

// Grouped by year, and every button says plainly WHAT it hands you: the
// session, a short note, and the file kind. Nobody should have to click to
// find out what they're downloading.
function downloadList() {
  if (!downloads.length) {
    return `<p class="tcat__soon">Testele în format descărcabil vor fi disponibile în curând.</p>`;
  }
  const byYear = new Map();
  for (const d of downloads) {
    const y = d.year || "Fără an";
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(d);
  }
  // One line per year, in columns: the year on the left, then one slot per
  // session. Every row uses the SAME grid template, so the sessions line up
  // vertically down the whole list even when 2009 has one paper and 2010 has
  // three — a table, without a single ruled line. The widest year decides how
  // many slots there are; shorter years simply leave the tail empty.
  const cols = Math.max(1, ...[...byYear.values()].map((f) => f.length));
  const groups = [...byYear.entries()].map(([year, files]) => {
    const cells = files.map((f) => {
      // The year already labels the row — drop it from the session name so
      // „2024 - Iul - G1" reads simply „Iul - G1".
      const name = String(f.label || "").replace(new RegExp(`^\\s*${year}\\s*[-–·]?\\s*`), "").trim() || f.label;
      const tip = [f.note, f.kind || "PDF"].filter(Boolean).join(" · ");
      return `<a class="tdl__file" href="${esc(f.href)}" target="_blank" rel="noopener noreferrer"
                 title="Descarcă — ${esc(tip)}">${esc(name)}</a>`;
    }).join("");
    return `<div class="tdl__row">
        <span class="tdl__year">${esc(year)}</span>${cells}
      </div>`;
  }).join("");
  return `<div class="tdl" style="--tdl-cols: ${cols}">${groups}</div>
    <p class="tcat__hint">Fișierele se descarcă direct. În funcție de setările browserului, unele se pot deschide într-o filă nouă.</p>`;
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

    <!-- Two worlds side by side, neither nested in the other: the archive on
         its own light surface, the practice on its own dark card. The archive
         comes FIRST in the markup, so on a narrow screen it also comes first. -->
    <div class="tcat__split">
      <!-- Not gated on cat.live: a category can have papers to download long
           before it has an item bank to play with. -->
      <section class="tcat__files">
        <h2 class="tcat__ph">
          <span aria-hidden="true">📄</span> Teste descărcabile
          ${folderUrl
            ? `<a class="tdl__all" href="${esc(folderUrl)}" target="_blank" rel="noopener noreferrer"
                  title="Deschide folderul cu toate testele. De acolo le poți descărca pe toate deodată.">
                 <span class="tdl__all__ic" aria-hidden="true"></span> Toate, pe Drive
               </a>`
            : ""}
        </h2>
        ${downloadList()}
      </section>

      <aside class="tcat__gamecard">
        <span class="tcat__gamecard__ic" aria-hidden="true">${cat.icon}</span>
        <h2 class="tcat__gamecard__t">Antrenament interactiv</h2>
        ${cat.live
          ? `<p class="tcat__gamecard__lead">Rezolvi câte un item pe rând, cu explicație imediată. Cei greșiți revin până îi nimerești.</p>
             <a class="tcat__play" href="#joc">
               <span class="tcat__play__ic" aria-hidden="true">${adminMode ? "🛠️" : "▸"}</span>
               ${adminMode ? "Deschide grila de itemi" : "Începe antrenamentul"}
             </a>`
          : `<p class="tcat__gamecard__lead">Banca de itemi pentru această categorie se pregătește.</p>
             <span class="tcat__soon">Va urma.</span>`}
      </aside>
    </div>`;
}

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
  // A real <table>. Year down the side, one session per cell — which is what
  // this data actually is, so the element that describes it is the honest one.
  // It also solves the alignment for free: a table sizes each column to its
  // widest cell across ALL rows. (A CSS grid can't: every row is its own grid,
  // so `max-content` measures that row alone and the columns drift apart.)
  // The lines are simply not drawn.

  // The year already labels the row — drop it from the session name so
  // „2024 - Iulie - G1" reads simply „Iulie - G1".
  const sessionName = (f, year) =>
    String(f.label || "").replace(new RegExp(`^\\s*${year}\\s*[-–·]?\\s*`), "").trim() || String(f.label || "");
  // What kind of session it is, ignoring the group: „Iulie - G1" and the older
  // bare „Iulie" both answer „Iulie", so they share a column instead of
  // opening two that mean the same thing.
  const sessionKind = (name) => name.split(/\s+[-–]\s+/)[0].trim() || name;

  // A COLUMN IS A SESSION, not a position. 2026 has only its „Simulare mai",
  // and it belongs under the other years' „Simulare mai" — not in the first
  // free slot. Columns are the distinct sessions, in alphabetical order.
  const kinds = [...new Set(
    [...byYear.entries()].flatMap(([y, files]) => files.map((f) => sessionKind(sessionName(f, y))))
  )].sort((a, b) => a.localeCompare(b, "ro"));

  // Safety valve: past a handful of distinct sessions the table would grow
  // wider than the panel, so we fall back to filling cells left to right.
  const columnar = kinds.length <= 5;
  const cols = columnar ? kinds.length : Math.max(1, ...[...byYear.values()].map((f) => f.length));

  const rows = [...byYear.entries()].map(([year, files]) => {
    // Order inside a year comes from the session names, NOT from the stored
    // `sort`. That column can go stale — every row currently holds 0 — and a
    // page that renders differently depending on a field nobody maintains is
    // a page that breaks quietly. The names are the truth; use them.
    const ordered = [...files].sort((a, b) => {
      const ka = sessionKind(sessionName(a, year)), kb = sessionKind(sessionName(b, year));
      return kinds.indexOf(ka) - kinds.indexOf(kb)
          || sessionName(a, year).localeCompare(sessionName(b, year), "ro");
    });
    const cells = new Array(cols).fill("");
    for (const f of ordered) {
      const name = sessionName(f, year);
      const tip = [f.note, f.kind || "PDF"].filter(Boolean).join(" · ");
      // The teacher's mark: this paper is in the bank from end to end. It's a
      // separate link, next to the download — not wrapped around it, which
      // would be an <a> inside an <a>. Only for playable categories: promising
      // a game where there's no item bank would be a broken promise.
      const solved = f.solved && cat.live
        ? `<a class="tdl__solved" href="?an=${encodeURIComponent(year)}&ses=${encodeURIComponent(name)}#joc"
              title="Rezolvat integral în aplicație, cu explicații. Click pentru a te antrena pe această sesiune."
              aria-label="Rezolvat integral — antrenează-te pe ${esc(name)} ${esc(String(year))}">✓</a>`
        : "";
      const cell = `<a class="tdl__file" href="${esc(f.href)}" target="_blank" rel="noopener noreferrer"
                 title="Descarcă — ${esc(tip)}">${esc(name)}</a>${solved}`;
      // Its own column; if that one is taken (two „Iulie" in one year), the
      // next free one, so nothing is ever dropped.
      let at = columnar ? kinds.indexOf(sessionKind(name)) : -1;
      if (at < 0 || cells[at]) at = cells.findIndex((c) => !c);
      if (at < 0) { cells.push(cell); continue; }
      cells[at] = cell;
    }
    return `<tr><th scope="row" class="tdl__year">${esc(year)}</th>${
      cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  }).join("");
  return `<table class="tdl"><tbody>${rows}</tbody></table>
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

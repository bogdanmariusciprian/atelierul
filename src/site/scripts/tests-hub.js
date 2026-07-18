// =========================================================
// Teste — the category directory.
//   Each category now has its OWN page (/teste/<slug>/), which holds both the
//   downloadable tests and the practice. This hub is just the way in.
//   Old links like /teste/#admitere-drept are redirected, so nothing breaks.
// Content Romanian, identifiers English.
// =========================================================
import { TEST_CATEGORIES, TEST_CAT_BY_SLUG } from "./test-categories.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function initTestsHub(mountEl) {
  if (!mountEl) return;
  // Legacy hash route → the category's real page.
  const legacy = (location.hash || "").replace(/^#/, "");
  if (TEST_CAT_BY_SLUG[legacy]) { location.replace(`${legacy}/${location.search}`); return; }

  mountEl.className = "tests-grid";
  mountEl.innerHTML = TEST_CATEGORIES.map((c) => `
    <a class="test-card${c.live ? " is-live" : ""}" id="${c.slug}" href="${c.slug}/" style="--card-color:${c.color}">
      <span class="test-card__icon" aria-hidden="true">${c.icon}</span>
      <h2 class="test-card__title">${esc(c.title)}</h2>
      <p class="test-card__desc">${esc(c.desc)}</p>
      ${c.live ? `<span class="test-card__go">Deschide →</span>` : `<span class="test-card__soon">în curând</span>`}
    </a>`).join("");
}

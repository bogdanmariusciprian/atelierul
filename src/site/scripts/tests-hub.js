// =========================================================
// Teste — category hub + the "Admitere Drept" practice (PUPIL view).
//
//   • The category grid (only "Admitere Drept" is live; the rest show "în curând").
//   • Opening #admitere-drept:
//       - PUPIL / GUEST: only VERIFIED items, one per card. Pick an option → the
//         SERVER decides, reveals the EFFECTIVE correct letter (2026 answer when
//         set, else historical) + the observation, and — when the 2026 answer
//         differs from the historical one — a "pe gramatica veche" note. The
//         answer never sits in the page source.
//       - ADMIN (teacher): handed off to the Excel-like editor (tests-admin-grid.js).
//   • Item text may carry small formatting (bold/underline) → rendered SAFELY.
//   Content Romanian, identifiers English.
// =========================================================
import { fetchTestItems, fetchTestYears, checkTestItem } from "../../shared/scripts/test-repo.js";
import { initTestAdminGrid } from "./tests-admin-grid.js";
import { isAdmin } from "../../shared/scripts/session.js";
import { showToast } from "../../shared/scripts/toast.js";
import { sanitizeRich } from "../../shared/scripts/rich-text.js";

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

const OPTS = ["A", "B", "C", "D"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let root = null;
let adminMode = false;
const state = {
  exam: null,
  year: null,
  years: [],
  items: [],
  loading: false,
  answered: {}, // { [itemId]: { chosen, correct, correctAnswer, historical, observation } }
};

export function initTestsHub(mountEl) {
  root = mountEl;
  adminMode = isAdmin();
  window.addEventListener("hashchange", route);
  // If the session settles / the teacher signs in after first paint, re-route.
  window.addEventListener("atelier:role", () => {
    const a = isAdmin();
    if (a !== adminMode) { adminMode = a; route(); }
  });
  root.addEventListener("click", onClick);
  root.addEventListener("change", onChange);
  route();
}

function route() {
  const slug = (location.hash || "").replace(/^#/, "");
  const cat = CAT_BY_SLUG[slug];
  if (cat && cat.live) {
    if (adminMode) initTestAdminGrid(root);   // teacher → the Excel-like editor
    else openExam(cat.slug);                   // pupil → the practice cards
  } else {
    renderHub();
  }
}

// ---------- category grid ----------
function renderHub() {
  document.body.classList.remove("tg-mode"); // leave the admin full-screen editor look
  state.exam = null;
  root.className = "tests-grid";
  root.innerHTML = CATEGORIES.map((c) => `
    <a class="test-card${c.live ? " is-live" : ""}" id="${c.slug}" href="#${c.slug}" style="--card-color:${c.color}">
      <span class="test-card__icon" aria-hidden="true">${c.icon}</span>
      <h2 class="test-card__title">${esc(c.title)}</h2>
      <p class="test-card__desc">${esc(c.desc)}</p>
      ${c.live ? `<span class="test-card__go">Deschide →</span>` : `<span class="test-card__soon">în curând</span>`}
    </a>`).join("");
}

// ---------- one exam (pupil practice) ----------
async function openExam(exam) {
  document.body.classList.remove("tg-mode"); // pupil view is not the admin editor
  state.exam = exam;
  state.answered = {};
  root.className = "tests-exam";
  state.loading = true;
  renderExam();
  state.years = await fetchTestYears(exam);
  if (state.year == null || !state.years.some((y) => y.year === state.year)) {
    state.year = state.years.length ? state.years[state.years.length - 1].year : null;
  }
  await loadItems();
}

async function loadItems() {
  if (!state.exam) return;
  state.loading = true;
  renderExam();
  state.items = await fetchTestItems({ exam: state.exam, year: state.year }); // verified only (RLS)
  state.loading = false;
  renderExam();
}

function renderExam() {
  const cat = CAT_BY_SLUG[state.exam] || {};
  const yearSel = state.years.length
    ? `<label class="ti-filter">An
         <select id="ti-year">
           ${state.years.map((y) => `<option value="${y.year}"${y.year === state.year ? " selected" : ""}>${y.year} (${y.n})</option>`).join("")}
         </select>
       </label>`
    : "";

  let body;
  if (state.loading) {
    body = `<div class="ti-empty">Se încarcă itemii…</div>`;
  } else if (!state.items.length) {
    body = `<div class="ti-empty">Încă nu sunt itemi publicați pentru anul selectat. Revino în curând.</div>`;
  } else {
    body = `<div class="ti-list">${state.items.map(renderCard).join("")}</div>`;
  }

  root.innerHTML = `
    <div class="ti-bar">
      <a class="ti-back" href="#">‹ Toate testele</a>
      <h2 class="ti-title"><span aria-hidden="true">${cat.icon || "⚖️"}</span> ${esc(cat.title || "Admitere Drept")}</h2>
      ${yearSel}
    </div>
    ${body}`;

  // re-apply any answers already given (survives re-render)
  for (const id in state.answered) {
    const card = root.querySelector(`.ti-card[data-id="${id}"]`);
    if (card) paintAnswer(card, state.answered[id]);
  }
}

function renderCard(it) {
  const opts = OPTS
    .filter((k) => it.options[k] != null && it.options[k] !== "")
    .map((k) => `
      <button type="button" class="ti-opt" data-k="${k}">
        <span class="ti-opt__k">${k}</span>
        <span class="ti-opt__t">${sanitizeRich(it.options[k])}</span>
      </button>`).join("");

  return `
    <article class="ti-card" data-id="${it.id}">
      <header class="ti-card__head">
        <span class="ti-chip ti-year">${it.year ?? "—"}</span>
        ${it.session ? `<span class="ti-ses">${esc(it.session)}</span>` : ""}
        <span class="ti-no">Item ${it.itemNo ?? "—"}</span>
      </header>
      <p class="ti-q">${it.question ? sanitizeRich(it.question) : "<em>(enunț indisponibil)</em>"}</p>
      <div class="ti-opts">${opts || `<span class="ti-empty">(variante indisponibile)</span>`}</div>
      <div class="ti-feedback" hidden></div>
    </article>`;
}

// ---------- interactions ----------
function onChange(e) {
  const sel = e.target.closest("#ti-year");
  if (sel) { state.year = Number(sel.value); loadItems(); }
}

function onClick(e) {
  const opt = e.target.closest(".ti-opt");
  if (opt) submitAnswer(opt);
}

// PUPIL: pick an option → the server decides + reveals the answer.
async function submitAnswer(btn) {
  const card = btn.closest(".ti-card");
  const id = card?.dataset.id;
  if (!id || state.answered[id]) return; // one shot per item
  const k = btn.dataset.k;
  card.classList.add("is-checking");
  const res = await checkTestItem(id, k);
  card.classList.remove("is-checking");
  if (!res) { showToast("Nu am putut verifica acum. Încearcă din nou."); return; }
  const data = { chosen: k, ...res };
  state.answered[id] = data;
  paintAnswer(card, data);
}

function paintAnswer(card, data) {
  card.classList.add("is-answered", data.correct ? "is-correct" : "is-wrong");
  card.querySelectorAll(".ti-opt").forEach((b) => {
    b.disabled = true;
    const k = b.dataset.k;
    if (k === data.correctAnswer) b.classList.add("opt-correct");
    if (k === data.chosen && !data.correct) b.classList.add("opt-wrong");
  });
  const fb = card.querySelector(".ti-feedback");
  if (!fb) return;
  fb.hidden = false;
  const histNote = data.historical
    ? `<div class="ti-hist-note">Pe gramatica veche, răspunsul era <b>${esc(data.historical)}</b>.</div>`
    : "";
  fb.innerHTML = `
    <div class="ti-verdict ${data.correct ? "ok" : "no"}">
      ${data.correct ? "✓ Răspuns corect" : `✗ Greșit — corect era <b>${esc(data.correctAnswer)}</b>`}
    </div>
    ${histNote}
    ${data.observation ? `<div class="ti-obs"><span class="ti-obs__lab">Observație</span>${sanitizeRich(data.observation)}</div>` : ""}`;
}

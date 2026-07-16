// =========================================================
// Teste — hub of categories + the "Admitere Drept" item practice.
//
//   • The category grid (Clasa a 6-a … Admitere Drept). Only "Admitere Drept"
//     is live for now; the rest show "în curând".
//   • Opening #admitere-drept loads REAL items from Supabase (test-repo.js):
//       - a PUPIL/GUEST sees only VERIFIED items, one per card. They pick an
//         option → the SERVER says right/wrong, reveals the correct letter and
//         the observation (the answer never sits in the page source).
//       - the ADMIN (teacher) sees ALL items (incl. unverified + the answer),
//         can PUBLISH (verify) an item and edit its observation inline.
//   • Filtered by year (the item's label). Content Romanian, identifiers English.
// =========================================================
import {
  fetchTestItems, fetchTestYears, checkTestItem,
  adminFetchTestItems, setTestVerified, updateTestItem,
} from "../../shared/scripts/test-repo.js";
import { isAdmin } from "../../shared/scripts/session.js";
import { showToast } from "../../shared/scripts/toast.js";

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
const state = {
  admin: false,
  exam: null,
  year: null,
  years: [],
  items: [],
  loading: false,
  answered: {}, // { [itemId]: { chosen, correct, correctAnswer, observation } }
};

export function initTestsHub(mountEl) {
  root = mountEl;
  state.admin = isAdmin();
  window.addEventListener("hashchange", route);
  // If the session settles / the teacher signs in after first paint, re-render.
  window.addEventListener("atelier:role", () => {
    const a = isAdmin();
    if (a !== state.admin) { state.admin = a; if (state.exam) loadItems(); }
  });
  root.addEventListener("click", onClick);
  root.addEventListener("change", onChange);
  route();
}

function route() {
  const slug = (location.hash || "").replace(/^#/, "");
  const cat = CAT_BY_SLUG[slug];
  if (cat && cat.live) openExam(cat.slug);
  else renderHub();
}

// ---------- category grid ----------
function renderHub() {
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

// ---------- one exam (items) ----------
async function openExam(exam) {
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
  state.items = state.admin
    ? await adminFetchTestItems(state.exam, state.year)
    : await fetchTestItems({ exam: state.exam, year: state.year });
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

  const adminHint = state.admin
    ? `<p class="ti-adminhint">Ești în modul profesor: vezi și itemii nepublicați și răspunsul corect. Apasă <b>Publică</b> ca să-i faci vizibili elevilor.</p>`
    : "";

  let body;
  if (state.loading) {
    body = `<div class="ti-empty">Se încarcă itemii…</div>`;
  } else if (!state.items.length) {
    body = `<div class="ti-empty">${state.admin
      ? "Niciun item pentru anul selectat."
      : "Încă nu sunt itemi publicați pentru anul selectat. Revino în curând."}</div>`;
  } else {
    body = `<div class="ti-list">${state.items.map(renderCard).join("")}</div>`;
  }

  root.innerHTML = `
    <div class="ti-bar">
      <a class="ti-back" href="#">‹ Toate testele</a>
      <h2 class="ti-title"><span aria-hidden="true">${cat.icon || "⚖️"}</span> ${esc(cat.title || "Admitere Drept")}</h2>
      ${yearSel}
    </div>
    ${adminHint}
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
    .map((k) => {
      // Admin sees the correct option highlighted directly (and can't "answer").
      const isAns = state.admin && it.correct === k;
      return `
      <button type="button" class="ti-opt${isAns ? " opt-correct" : ""}" data-k="${k}"${state.admin ? " disabled" : ""}>
        <span class="ti-opt__k">${k}</span>
        <span class="ti-opt__t">${esc(it.options[k])}</span>
      </button>`;
    }).join("");

  // Admin sees the answer + publish toggle + editable observation.
  const adminTools = state.admin ? `
    <div class="ti-admin">
      <span class="ti-answer">Răspuns corect: <b>${esc(it.correct || "?")}</b></span>
      <button type="button" class="ti-pub${it.verified ? " is-on" : ""}" data-action="verify" data-id="${it.id}">
        ${it.verified ? "✓ Publicat" : "Publică"}
      </button>
      <label class="ti-obsedit">Observații (ce văd elevii după răspuns)
        <textarea class="ti-obs-input" data-id="${it.id}" rows="2" placeholder="Scrie o explicație…">${esc(it.observation)}</textarea>
        <button type="button" class="ti-obs-save" data-action="save-obs" data-id="${it.id}">Salvează</button>
      </label>
    </div>` : "";

  const cls = ["ti-card"];
  if (state.admin && !it.verified) cls.push("is-unverified");

  return `
    <article class="${cls.join(" ")}" data-id="${it.id}">
      <header class="ti-card__head">
        <span class="ti-chip ti-year">${it.year ?? "—"}</span>
        ${it.session ? `<span class="ti-ses">${esc(it.session)}</span>` : ""}
        <span class="ti-no">Item ${it.itemNo ?? "—"}</span>
        ${it.verified ? `<span class="ti-verified" title="Verificat">✓ verificat</span>` : (state.admin ? `<span class="ti-draft">nepublicat</span>` : "")}
      </header>
      <p class="ti-q">${it.question ? esc(it.question) : "<em>(enunț indisponibil)</em>"}</p>
      <div class="ti-opts">${opts || `<span class="ti-empty">(variante indisponibile)</span>`}</div>
      <div class="ti-feedback" hidden></div>
      ${adminTools}
    </article>`;
}

// ---------- interactions ----------
function onChange(e) {
  const sel = e.target.closest("#ti-year");
  if (sel) { state.year = Number(sel.value); loadItems(); }
}

async function onClick(e) {
  const opt = e.target.closest(".ti-opt");
  if (opt) return submitAnswer(opt);

  const verify = e.target.closest("[data-action=verify]");
  if (verify) return toggleVerify(verify);

  const saveObs = e.target.closest("[data-action=save-obs]");
  if (saveObs) return saveObservation(saveObs);
}

// PUPIL: pick an option → server decides + reveals the answer.
async function submitAnswer(btn) {
  const card = btn.closest(".ti-card");
  const id = card?.dataset.id;
  if (!id || state.answered[id] || state.admin) return; // one shot; admin doesn't answer
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
  if (fb) {
    fb.hidden = false;
    fb.innerHTML = `
      <div class="ti-verdict ${data.correct ? "ok" : "no"}">
        ${data.correct ? "✓ Răspuns corect" : `✗ Greșit — corect era <b>${esc(data.correctAnswer)}</b>`}
      </div>
      ${data.observation ? `<div class="ti-obs"><span class="ti-obs__lab">Observație</span>${esc(data.observation)}</div>` : ""}`;
  }
}

// ADMIN: publish / unpublish an item.
async function toggleVerify(btn) {
  const id = btn.dataset.id;
  const it = state.items.find((x) => x.id === id);
  if (!it) return;
  const next = !it.verified;
  btn.disabled = true;
  const ok = await setTestVerified(id, next);
  btn.disabled = false;
  if (!ok) { showToast("Nu am putut publica itemul."); return; }
  it.verified = next;
  const card = btn.closest(".ti-card");
  card.classList.toggle("is-unverified", !next);
  btn.classList.toggle("is-on", next);
  btn.textContent = next ? "✓ Publicat" : "Publică";
  const tag = card.querySelector(".ti-verified, .ti-draft");
  if (tag) { tag.className = next ? "ti-verified" : "ti-draft"; tag.textContent = next ? "✓ verificat" : "nepublicat"; }
  showToast(next ? "Item publicat — vizibil elevilor." : "Item retras.");
}

// ADMIN: save the observation shown to pupils after they answer.
async function saveObservation(btn) {
  const id = btn.dataset.id;
  const ta = root.querySelector(`.ti-obs-input[data-id="${id}"]`);
  if (!ta) return;
  btn.disabled = true;
  const ok = await updateTestItem(id, { observation: ta.value.trim() || null });
  btn.disabled = false;
  if (!ok) { showToast("Nu am putut salva observația."); return; }
  const it = state.items.find((x) => x.id === id);
  if (it) it.observation = ta.value.trim();
  showToast("Observație salvată.");
}

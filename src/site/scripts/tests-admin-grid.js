// =========================================================
// Teste → Admitere Drept — ADMIN grid (Excel-like), teacher only.
//
// A spreadsheet-style editor over `test_items` (loaded per year via the
// admin_test_items RPC, which returns the answers + unverified rows):
//   • fills the browser (width + height); sticky header + sticky first columns
//     (An/Sesiune/Nr); the active row highlighted with a gradient;
//   • filters: year, session, published/unpublished, flagged, missing-2026, search;
//   • EVERY cell is editable and SAVES to Supabase automatically (on blur / on
//     click — there is no submit button):
//       - Enunț / A–D / Observații = rich text (bold / underline / italic);
//       - An / Sesiune / Nr. = plain text;
//       - „Corect (ist.)" and „Corect 2026" = click one of A/B/C/D;
//       - „Publicat" (visible to pupils) and „★" (private teacher marker) = toggle.
//   A live "✓ Salvat" indicator confirms every write. Writes are RLS-gated to
//   the teacher; nothing here is shown to pupils.
// =========================================================
import {
  adminFetchTestItems, fetchTestYears, updateTestItem, setTestVerified, setTestFlagged,
} from "../../shared/scripts/test-repo.js";
import { sanitizeRich, stripRich, execBold, execUnderline, execItalic } from "../../shared/scripts/rich-text.js";
import { showToast } from "../../shared/scripts/toast.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LETTERS = ["A", "B", "C", "D"];

let root = null;
let wired = false;
const state = {
  exam: "admitere-drept",
  years: [], year: null,
  items: [], loading: false,
  session: "", status: "all", onlyFlagged: false, onlyNo2026: false, search: "",
  zoom: 1,
};

export async function initTestAdminGrid(mountEl) {
  root = mountEl;
  document.body.classList.add("tg-mode"); // full-screen editor look
  if (!wired) { wireEvents(); wired = true; }
  root.className = "tg-wrap";
  state.loading = true;
  render();
  if (!state.years.length) state.years = await fetchTestYears(state.exam);
  if (state.year == null || !state.years.some((y) => y.year === state.year)) {
    state.year = state.years.length ? state.years[state.years.length - 1].year : null;
  }
  await load();
}

async function load() {
  state.loading = true; render();
  state.items = await adminFetchTestItems(state.exam, state.year);
  state.loading = false; render();
}

const byId = (id) => state.items.find((x) => x.id === id);

function filtered() {
  const q = state.search.trim().toLowerCase();
  return state.items.filter((it) => {
    if (state.session && it.session !== state.session) return false;
    if (state.status === "pub" && !it.verified) return false;
    if (state.status === "draft" && it.verified) return false;
    if (state.onlyFlagged && !it.flagged) return false;
    if (state.onlyNo2026 && it.correct2026) return false;
    if (q) {
      const hay = [it.question, it.options.A, it.options.B, it.options.C, it.options.D, it.observation]
        .map((v) => stripRich(v).toLowerCase()).join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---------- render ----------
function render() {
  const sessions = [...new Set(state.items.map((i) => i.session).filter(Boolean))].sort();
  const rows = filtered();

  const yearsSel = state.years.map((y) =>
    `<option value="${y.year}"${y.year === state.year ? " selected" : ""}>${y.year} (${y.n})</option>`).join("");
  const sesSel = `<option value="">toate sesiunile</option>` +
    sessions.map((s) => `<option value="${esc(s)}"${s === state.session ? " selected" : ""}>${esc(s)}</option>`).join("");
  const chip = (key, val, label) =>
    `<button type="button" class="tg-chip${state[key] === val ? " on" : ""}" data-filter="${key}" data-val="${val}">${label}</button>`;
  const toggleChip = (key, label) =>
    `<button type="button" class="tg-chip${state[key] ? " on" : ""}" data-toggle="${key}">${label}</button>`;

  root.innerHTML = `
    <div class="tg-bar">
      <a class="tg-back" href="#">‹ Toate testele</a>
      <h2 class="tg-title">⚖️ Admitere Drept <span class="tg-sub">— editor profesor</span></h2>
    </div>

    <div class="tg-toolbar">
      <label class="tg-f">An <select id="tg-year">${yearsSel}</select></label>
      <label class="tg-f">Sesiune <select id="tg-ses">${sesSel}</select></label>
      <span class="tg-chips">
        ${chip("status", "all", "Toate")}${chip("status", "pub", "Publicate")}${chip("status", "draft", "Nepublicate")}
        ${toggleChip("onlyFlagged", "★ marcate")}${toggleChip("onlyNo2026", "fără 2026")}
      </span>
      <input id="tg-search" class="tg-search" type="search" placeholder="Caută în text…" value="${esc(state.search)}" />
      <span class="tg-fmt-group" title="Selectează text într-o celulă, apoi:">
        <button type="button" class="tg-fmt" data-fmt="bold"><b>B</b></button>
        <button type="button" class="tg-fmt" data-fmt="underline"><u>U</u></button>
        <button type="button" class="tg-fmt" data-fmt="italic"><i>I</i></button>
      </span>
      <span class="tg-zoom">
        <button type="button" class="tg-zbtn" data-zoom="out" title="Micșorează">−</button>
        <span class="tg-zval">${Math.round(state.zoom * 100)}%</span>
        <button type="button" class="tg-zbtn" data-zoom="in" title="Mărește">+</button>
        <button type="button" class="tg-zbtn" data-zoom="fit" title="Potrivește pe lățime (toate coloanele)">Fit</button>
      </span>
      <span class="tg-savestate" id="tg-save"></span>
      <span class="tg-count">${rows.length} / ${state.items.length} · ${state.items.filter((i) => i.verified).length} publicați</span>
    </div>

    <div class="tg-scroll">
      ${state.loading
        ? `<div class="tg-empty">Se încarcă…</div>`
        : (!rows.length ? `<div class="tg-empty">Niciun item pentru filtrele curente.</div>` : tableHtml(rows))}
    </div>
    <p class="tg-hint">Se salvează <b>automat</b> (nu e buton de submit): la ieșirea din celulă sau la clic pe A/B/C/D, ✓/★. Formatare: selectează text, apoi <b>B</b>/<u>U</u>/<i>I</i> (sau Ctrl+B/U/I). „★" = marcaj privat (doar pentru tine, ex. „de revăzut"; nu-l văd elevii).</p>`;
}

function tableHtml(rows) {
  return `
    <table class="tg-table">
      <thead>
        <tr>
          <th class="tg-fix tg-c1">An</th>
          <th class="tg-fix tg-c2">Sesiune</th>
          <th class="tg-fix tg-c3">Nr.</th>
          <th>Enunț</th>
          <th>A</th><th>B</th><th>C</th><th>D</th>
          <th title="Răspunsul din grila oficială (istoric)">Corect (ist.)</th>
          <th title="Răspunsul pe gramatica 2026">Corect 2026</th>
          <th>Observații</th>
          <th title="Vizibil elevilor">Publicat</th>
          <th title="Marcaj privat (de revăzut)">★</th>
        </tr>
      </thead>
      <tbody>${rows.map(rowHtml).join("")}</tbody>
    </table>`;
}

function letters(field, id, current) {
  return `<td class="tg-ans${field === "correct" ? " tg-ans--hist" : ""}" data-field="${field}" data-id="${id}">
    ${LETTERS.map((k) => `<button type="button" class="tg-letter${current === k ? " on" : ""}" data-k="${k}">${k}</button>`).join("")}
    ${field === "correct_2026" ? `<button type="button" class="tg-same" data-id="${id}" title="Pune la 2026 același răspuns ca cel istoric">= ist.</button>` : ""}
  </td>`;
}

function rowHtml(it) {
  const rid = it.id;
  const rich = (field, val, extra = "") =>
    `<td class="tg-cell tg-rich${extra}" contenteditable="true" data-id="${rid}" data-field="${field}">${sanitizeRich(val)}</td>`;
  const plain = (field, val, cls) =>
    `<td class="tg-fix ${cls} tg-edit" contenteditable="true" data-id="${rid}" data-field="${field}">${esc(val ?? "")}</td>`;
  return `
    <tr class="tg-row${it.verified ? " is-pub" : ""}${it.flagged ? " is-flag" : ""}" data-id="${rid}">
      ${plain("year", it.year, "tg-c1")}
      ${plain("session", it.session, "tg-c2")}
      ${plain("item_no", it.itemNo, "tg-c3")}
      ${rich("question", it.question, " tg-q-cell")}
      ${rich("option_a", it.options.A)}
      ${rich("option_b", it.options.B)}
      ${rich("option_c", it.options.C)}
      ${rich("option_d", it.options.D)}
      ${letters("correct", rid, it.correct)}
      ${letters("correct_2026", rid, it.correct2026)}
      ${rich("observation", it.observation)}
      <td class="tg-tg"><button type="button" class="tg-pub${it.verified ? " on" : ""}" data-action="pub" data-id="${rid}" title="${it.verified ? "Publicat — vizibil elevilor" : "Nepublicat"}">${it.verified ? "✓" : "○"}</button></td>
      <td class="tg-tg"><button type="button" class="tg-flag${it.flagged ? " on" : ""}" data-action="flag" data-id="${rid}" title="Marcaj privat">${it.flagged ? "★" : "☆"}</button></td>
    </tr>`;
}

// ---------- save-state indicator ----------
function showSaving() {
  const el = root.querySelector("#tg-save");
  if (el) { el.textContent = "Se salvează…"; el.className = "tg-savestate is-saving"; }
}
function showSaved(ok) {
  const el = root.querySelector("#tg-save");
  if (!el) return;
  el.textContent = ok ? "✓ Salvat" : "✗ Eroare";
  el.className = "tg-savestate " + (ok ? "is-ok" : "is-err");
  clearTimeout(showSaved._t);
  showSaved._t = setTimeout(() => { el.textContent = ""; el.className = "tg-savestate"; }, 1700);
}
function flash(el) {
  if (!el) return;
  el.classList.add("tg-saved");
  setTimeout(() => el.classList.remove("tg-saved"), 800);
}

// ---------- zoom (Excel-like) — the CSS var persists on `root` across renders ----------
function applyZoom() {
  root.style.setProperty("--tg-zoom", state.zoom);
  const lbl = root.querySelector(".tg-zval");
  if (lbl) lbl.textContent = Math.round(state.zoom * 100) + "%";
}
function computeFit() {
  const sc = root.querySelector(".tg-scroll");
  if (!sc) return state.zoom;
  root.style.setProperty("--tg-zoom", "1"); // measure the natural width first
  const z = Math.max(0.3, Math.min(1, (sc.clientWidth - 2) / sc.scrollWidth));
  return +z.toFixed(3);
}
function zoom(dir) {
  if (dir === "in") state.zoom = Math.min(1.6, +(state.zoom + 0.1).toFixed(2));
  else if (dir === "out") state.zoom = Math.max(0.4, +(state.zoom - 0.1).toFixed(2));
  else if (dir === "fit") state.zoom = computeFit();
  applyZoom();
}

// ---------- events (delegated on root) ----------
function wireEvents() {
  root.addEventListener("focusin", (e) => {
    const tr = e.target.closest(".tg-row");
    root.querySelectorAll(".tg-row.is-active").forEach((r) => r !== tr && r.classList.remove("is-active"));
    if (tr) tr.classList.add("is-active");
  });

  root.addEventListener("focusout", (e) => {
    const rich = e.target.closest(".tg-rich");
    if (rich) return saveRich(rich);
    const plainCell = e.target.closest(".tg-edit");
    if (plainCell) return savePlain(plainCell);
  });

  root.addEventListener("change", (e) => {
    if (e.target.id === "tg-year") { state.year = Number(e.target.value); state.session = ""; return load(); }
    if (e.target.id === "tg-ses") { state.session = e.target.value; return render(); }
  });

  root.addEventListener("input", (e) => {
    if (e.target.id === "tg-search") { state.search = e.target.value; renderBodyOnly(); }
  });

  // format buttons must NOT steal the caret from the focused cell
  root.addEventListener("mousedown", (e) => {
    const fmt = e.target.closest(".tg-fmt");
    if (fmt) {
      e.preventDefault();
      if (fmt.dataset.fmt === "bold") execBold();
      else if (fmt.dataset.fmt === "underline") execUnderline();
      else execItalic();
    }
  });

  root.addEventListener("click", (e) => {
    const zb = e.target.closest(".tg-zbtn");
    if (zb) return zoom(zb.dataset.zoom);
    const chip = e.target.closest("[data-filter]");
    if (chip) { state[chip.dataset.filter] = chip.dataset.val; return render(); }
    const tog = e.target.closest("[data-toggle]");
    if (tog) { state[tog.dataset.toggle] = !state[tog.dataset.toggle]; return render(); }

    const letter = e.target.closest(".tg-letter");
    if (letter) return saveLetter(letter.closest(".tg-ans"), letter.dataset.k);

    const same = e.target.closest(".tg-same");
    if (same) {
      const it = byId(same.dataset.id);
      if (it && it.correct) saveLetterValue(same.closest("td").parentElement.querySelector('.tg-ans[data-field="correct_2026"]'), it.correct);
      return;
    }

    const pub = e.target.closest("[data-action=pub]");
    if (pub) return togglePub(pub);
    const flag = e.target.closest("[data-action=flag]");
    if (flag) return toggleFlag(flag);
  });

  // Enter commits the cell (blur) instead of adding newlines.
  root.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && (e.target.closest(".tg-rich") || e.target.closest(".tg-edit"))) {
      e.preventDefault();
      e.target.blur();
    }
  });
}

// ---------- saves ----------
async function saveRich(cell) {
  const it = byId(cell.dataset.id); if (!it) return;
  const field = cell.dataset.field;
  const clean = sanitizeRich(cell.innerHTML);
  cell.innerHTML = clean;
  const map = { question: it.question, option_a: it.options.A, option_b: it.options.B,
                option_c: it.options.C, option_d: it.options.D, observation: it.observation };
  if (clean === (map[field] || "")) return;
  showSaving();
  const ok = await updateTestItem(it.id, { [field]: clean || null });
  if (!ok) { showSaved(false); showToast("Nu am putut salva."); return; }
  applyLocal(it, field, clean);
  showSaved(true); flash(cell);
}

async function savePlain(cell) {
  const it = byId(cell.dataset.id); if (!it) return;
  const field = cell.dataset.field;
  const raw = cell.textContent.trim();
  let val, curr;
  if (field === "year" || field === "item_no") {
    const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    val = Number.isFinite(n) ? n : null;
    curr = field === "year" ? it.year : it.itemNo;
  } else { val = raw || null; curr = it.session; }
  if (String(val ?? "") === String(curr ?? "")) { cell.textContent = curr ?? ""; return; }
  showSaving();
  const ok = await updateTestItem(it.id, { [field]: val });
  if (!ok) {
    showSaved(false);
    showToast("Nu am putut salva (poate un An/Sesiune/Nr deja folosit).");
    cell.textContent = curr ?? ""; // revert
    return;
  }
  if (field === "year") it.year = val; else if (field === "item_no") it.itemNo = val; else it.session = val;
  showSaved(true); flash(cell);
}

// click a letter in a Corect / Corect 2026 cell
function saveLetter(td, k) {
  const it = byId(td.dataset.id); if (!it) return;
  const field = td.dataset.field;
  // 2026 is optional → clicking the active one clears it; historical is required.
  const val = (field === "correct_2026" && it.correct2026 === k) ? null : k;
  saveLetterValue(td, val);
}
async function saveLetterValue(td, val) {
  if (!td) return;
  const it = byId(td.dataset.id); if (!it) return;
  const field = td.dataset.field;
  showSaving();
  const ok = await updateTestItem(it.id, { [field]: val });
  if (!ok) { showSaved(false); showToast("Nu am putut salva răspunsul."); return; }
  if (field === "correct_2026") it.correct2026 = val; else it.correct = val;
  td.querySelectorAll(".tg-letter").forEach((b) => b.classList.toggle("on", b.dataset.k === val));
  showSaved(true); flash(td);
}

async function togglePub(btn) {
  const it = byId(btn.dataset.id); if (!it) return;
  const next = !it.verified;
  showSaving();
  const ok = await setTestVerified(it.id, next);
  if (!ok) { showSaved(false); showToast("Nu am putut publica."); return; }
  it.verified = next;
  btn.classList.toggle("on", next); btn.textContent = next ? "✓" : "○";
  btn.closest(".tg-row").classList.toggle("is-pub", next);
  showSaved(true);
  showToast(next ? "Publicat — vizibil elevilor." : "Retras de la elevi.");
}

async function toggleFlag(btn) {
  const it = byId(btn.dataset.id); if (!it) return;
  const next = !it.flagged;
  showSaving();
  const ok = await setTestFlagged(it.id, next);
  if (!ok) { showSaved(false); showToast("Nu am putut marca."); return; }
  it.flagged = next;
  btn.classList.toggle("on", next); btn.textContent = next ? "★" : "☆";
  btn.closest(".tg-row").classList.toggle("is-flag", next);
  showSaved(true);
}

function renderBodyOnly() {
  const rows = filtered();
  const count = root.querySelector(".tg-count");
  if (count) count.textContent = `${rows.length} / ${state.items.length} · ${state.items.filter((i) => i.verified).length} publicați`;
  const scroll = root.querySelector(".tg-scroll");
  if (!scroll) return;
  if (!rows.length) { scroll.innerHTML = `<div class="tg-empty">Niciun item pentru filtrele curente.</div>`; return; }
  const tb = root.querySelector(".tg-table tbody");
  if (!tb) { scroll.innerHTML = tableHtml(rows); return; }
  tb.innerHTML = rows.map(rowHtml).join("");
}

function applyLocal(it, field, val) {
  if (field === "question") it.question = val;
  else if (field === "observation") it.observation = val;
  else if (field === "option_a") it.options.A = val;
  else if (field === "option_b") it.options.B = val;
  else if (field === "option_c") it.options.C = val;
  else if (field === "option_d") it.options.D = val;
}

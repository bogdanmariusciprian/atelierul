// =========================================================
// Teste → Admitere Drept — ADMIN grid (Excel-like), teacher only.
//
// A spreadsheet-style editor over `test_items` (loaded per year via the
// admin_test_items RPC, which returns the answers + unverified rows):
//   • fills the browser (width + height); sticky header + sticky first columns
//     (An/Sesiune/Nr); the active row highlighted with a gradient; zoom +/−/Fit.
//   • filters: year, session, „ascunde verificații", „fără 2026", free-text search.
//   • EVERY cell is editable and SAVES to Supabase automatically (on blur / on
//     click — there is no submit button):
//       - Enunț / A–D / Observații = rich text (bold / underline / italic);
//       - An / Sesiune / Nr. = plain text;
//       - „Corect (ist.)" and „Corect 2026" = click one of A/B/C/D;
//       - „Verificat" = toggle (verified → visible to pupils).
//   A live "✓ Salvat" indicator confirms every write. Writes are RLS-gated.
//
// Scroll: the PAGE scroll is locked in this mode and the grid scrolls on its own
// (overscroll-behavior: contain + a JS-measured height), so scrolling the table
// never jolts the page.
// =========================================================
import {
  adminFetchTestItems, fetchTestYears, updateTestItem, setTestVerified, setTestPublished,
} from "../../shared/scripts/test-repo.js";
import { sanitizeRich, stripRich, execBold, execUnderline, execItalic } from "../../shared/scripts/rich-text.js";
import { showToast } from "../../shared/scripts/toast.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LETTERS = ["A", "B", "C", "D"];
// „Publicat" icon — a clean upload glyph (arrow out of a tray), tinted via currentColor.
const UPLOAD_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
// „Verificat" icon — a dotted ring with a green tick that appears only when on.
const VERIFY_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="tg-dots" cx="12" cy="12" r="8.5" stroke-width="1.7" stroke-linecap="round" stroke-dasharray="0.2 3.15"/><path class="tg-tick" d="M6.4 12.4 L10.4 16.6 L18.4 6.8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

let root = null;
let wired = false;
const state = {
  exam: "admitere-drept",
  years: [], year: null,
  items: [], loading: false,
  session: "", hideVerified: false, onlyNo2026: false, search: "",
  zoom: 1,
  find: "", repl: "", frWhole: true, frCase: true,
};

export async function initTestAdminGrid(mountEl) {
  root = mountEl;
  lockPageScroll(true);                 // Excel-like full screen: no page scroll
  document.body.classList.add("tg-mode");
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

// Locking BOTH <html> and <body> is what actually stops the page from moving
// (the scroller can be either). tests-hub.js restores it when you leave.
function lockPageScroll(on) {
  const v = on ? "hidden" : "";
  document.documentElement.style.overflow = v;
  document.body.style.overflow = v;
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
    if (state.hideVerified && it.verified) return false;
    if (state.onlyNo2026 && it.correct2026) return false;
    if (q) {
      const hay = [it.question, it.options.A, it.options.B, it.options.C, it.options.D, it.observation]
        .map((v) => stripRich(v).toLowerCase()).join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---------- bold a whole column (current year) ----------
function fieldVal(it, field) {
  return field === "question" ? it.question
    : field === "observation" ? it.observation
    : field === "option_a" ? it.options.A
    : field === "option_b" ? it.options.B
    : field === "option_c" ? it.options.C
    : it.options.D;
}
const isBoldWrapped = (v) => /^<b>[\s\S]*<\/b>$/.test(String(v).trim());
function columnIsBold(field) {
  const vals = state.items.map((it) => fieldVal(it, field)).filter((v) => v && stripRich(v));
  return vals.length > 0 && vals.every(isBoldWrapped);
}
function boldColBtn(field) {
  return `<button type="button" class="tg-boldcol${columnIsBold(field) ? " on" : ""}" data-boldcol="${field}" title="Bold pe toată coloana (anul curent)">B</button>`;
}
async function bulkBold(field) {
  const on = !columnIsBold(field);
  const targets = [];
  for (const it of state.items) {
    const cur = fieldVal(it, field);
    if (!cur || !stripRich(cur)) continue;               // skip empty cells
    const b = isBoldWrapped(cur);
    let next = cur;
    if (on && !b) next = "<b>" + cur + "</b>";
    else if (!on && b) next = cur.trim().replace(/^<b>([\s\S]*)<\/b>$/, "$1");
    if (next !== cur) targets.push([it, next]);
  }
  if (!targets.length) { showToast(on ? "Coloana e deja bold." : "Nimic de scos."); return; }
  const save = root.querySelector("#tg-save");
  let done = 0, failed = 0;
  const CHUNK = 12;
  for (let i = 0; i < targets.length; i += CHUNK) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(targets.slice(i, i + CHUNK).map(async ([it, next]) => {
      const ok = await updateTestItem(it.id, { [field]: next });
      if (ok) { applyLocal(it, field, next); done++; } else failed++;
    }));
    if (save) { save.textContent = `Se salvează… ${done}/${targets.length}`; save.className = "tg-savestate is-saving"; }
  }
  showSaved(failed === 0);
  showToast(`${done} celule ${on ? "bolduite" : "fără bold"}` + (failed ? ` (${failed} eșuate)` : ""));
  render();
}

// ---------- add „;" at the end of a variant column (visible rows) ----------
function lastTextNode(content) {
  const w = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let last = null, n;
  while ((n = w.nextNode())) last = n;
  return last;
}
function setTrailingSemi(html, on) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html);
  const node = lastTextNode(tpl.content);
  if (!node) return null;
  const trimmed = node.nodeValue.replace(/\s+$/, "");
  const has = trimmed.endsWith(";");
  if (on && !has) node.nodeValue = trimmed + ";";
  else if (!on && has) node.nodeValue = trimmed.replace(/;+$/, "");
  else return null;                       // no change needed
  return sanitizeRich(tpl.innerHTML);
}
function columnHasSemi(field) {
  const vals = filtered().map((it) => fieldVal(it, field)).filter((v) => v && stripRich(v));
  return vals.length > 0 && vals.every((v) => stripRich(v).replace(/\s+$/, "").endsWith(";"));
}
function semiColBtn(field) {
  return `<button type="button" class="tg-semicol${columnHasSemi(field) ? " on" : ""}" data-semicol="${field}" title="Adaugă ; la finalul variantelor (intrări vizibile)">;</button>`;
}
async function bulkSemi(field) {
  const on = !columnHasSemi(field);
  const targets = [];
  for (const it of filtered()) {                 // ONLY the visible rows
    const cur = fieldVal(it, field);
    if (!cur || !stripRich(cur)) continue;
    const next = setTrailingSemi(cur, on);
    if (next != null && next !== cur) targets.push([it, next]);
  }
  if (!targets.length) { showToast(on ? "Toate au deja ; la final." : "Nimic de scos."); return; }
  const save = root.querySelector("#tg-save");
  let done = 0, failed = 0;
  const CHUNK = 12;
  for (let i = 0; i < targets.length; i += CHUNK) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(targets.slice(i, i + CHUNK).map(async ([it, next]) => {
      const ok = await updateTestItem(it.id, { [field]: next });
      if (ok) { applyLocal(it, field, next); done++; } else failed++;
    }));
    if (save) { save.textContent = `Se salvează… ${done}/${targets.length}`; save.className = "tg-savestate is-saving"; }
  }
  showSaved(failed === 0);
  showToast(`Am ${on ? "adăugat ; la" : "scos ; de la"} ${done} variante` + (failed ? ` (${failed} eșuate)` : ""));
  render();
}

// ---------- find & replace (visible rows only) ----------
// Replaces inside TEXT NODES only, so <b>/<u>/<i> formatting is never touched.
function replaceInHtml(html, find, repl, whole, cs) {
  if (!find) return null;
  const escd = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pat = whole ? `(?<![\\p{L}\\p{N}_])${escd}(?![\\p{L}\\p{N}_])` : escd;
  let re;
  try { re = new RegExp(pat, (cs ? "g" : "gi") + "u"); }
  catch { re = new RegExp(escd, cs ? "g" : "gi"); } // fallback if lookbehind/unicode unsupported
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html);
  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let changed = false;
  nodes.forEach((n) => {
    const nv = n.nodeValue.replace(re, () => repl);
    if (nv !== n.nodeValue) { n.nodeValue = nv; changed = true; }
  });
  return changed ? sanitizeRich(tpl.innerHTML) : null;
}

async function findReplace() {
  const find = state.find.trim();
  if (!find) { showToast("Scrie textul căutat."); return; }
  const repl = state.repl;
  const fields = ["question", "option_a", "option_b", "option_c", "option_d", "observation"];
  const targets = [];
  for (const it of filtered()) {                 // ONLY the visible rows
    for (const f of fields) {
      const cur = fieldVal(it, f);
      if (!cur) continue;
      const next = replaceInHtml(cur, find, repl, state.frWhole, state.frCase);
      if (next != null && next !== cur) targets.push([it, f, next]);
    }
  }
  if (!targets.length) { showToast(`„${find}" nu apare în intrările vizibile.`); return; }
  const save = root.querySelector("#tg-save");
  let done = 0, failed = 0;
  const CHUNK = 12;
  for (let i = 0; i < targets.length; i += CHUNK) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(targets.slice(i, i + CHUNK).map(async ([it, f, next]) => {
      const ok = await updateTestItem(it.id, { [f]: next });
      if (ok) { applyLocal(it, f, next); done++; } else failed++;
    }));
    if (save) { save.textContent = `Se salvează… ${done}/${targets.length}`; save.className = "tg-savestate is-saving"; }
  }
  showSaved(failed === 0);
  showToast(`Înlocuit în ${done} celule` + (failed ? ` (${failed} eșuate)` : ""));
  render();
}

// ---------- render ----------
function render() {
  const sessions = [...new Set(state.items.map((i) => i.session).filter(Boolean))].sort();
  const rows = filtered();

  const yearsSel = state.years.map((y) =>
    `<option value="${y.year}"${y.year === state.year ? " selected" : ""}>${y.year} (${y.n})</option>`).join("");
  const sesSel = `<option value="">toate sesiunile</option>` +
    sessions.map((s) => `<option value="${esc(s)}"${s === state.session ? " selected" : ""}>${esc(s)}</option>`).join("");
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
        ${toggleChip("hideVerified", "Ascunde verificații")}
        ${toggleChip("onlyNo2026", "fără 2026")}
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
      <span class="tg-count">${rows.length} / ${state.items.length} · ${state.items.filter((i) => i.verified).length} verificați</span>
    </div>

    <div class="tg-toolbar tg-fr-row">
      <span class="tg-frlabel">Caută &amp; înlocuiește <b>(doar în intrările vizibile)</b>:</span>
      <input id="tg-find" class="tg-frin" type="text" placeholder="caută" value="${esc(state.find)}" />
      <span class="tg-fr-arrow">→</span>
      <input id="tg-repl" class="tg-frin" type="text" placeholder="înlocuiește cu" value="${esc(state.repl)}" />
      <label class="tg-frchk"><input type="checkbox" id="tg-fr-whole"${state.frWhole ? " checked" : ""} /> cuvânt întreg</label>
      <label class="tg-frchk"><input type="checkbox" id="tg-fr-cs"${state.frCase ? " checked" : ""} /> Aa</label>
      <button type="button" class="tg-frbtn" data-action="find-replace">Înlocuiește</button>
    </div>

    <div class="tg-scroll">
      ${state.loading
        ? `<div class="tg-empty">Se încarcă…</div>`
        : (!rows.length ? `<div class="tg-empty">Niciun item pentru filtrele curente.</div>` : tableHtml(rows))}
    </div>
    <p class="tg-hint">Se salvează <b>automat</b> (nu e buton de submit): la ieșirea din celulă sau la clic pe A/B/C/D, Verificat sau Publicat. Formatare: selectează text, apoi <b>B</b>/<u>U</u>/<i>I</i> (sau Ctrl+B/U/I). <b>Verificat</b> ✓ = l-ai controlat tu (intern); <b>Publicat</b> 📤 = e vizibil elevilor.</p>`;
  requestAnimationFrame(fitHeight);
}

function tableHtml(rows) {
  return `
    <table class="tg-table">
      <thead>
        <tr>
          <th class="tg-fix tg-c1">An</th>
          <th class="tg-fix tg-c2">Sesiune</th>
          <th class="tg-fix tg-c3">Nr.</th>
          <th>Enunț ${boldColBtn("question")}</th>
          <th>A ${semiColBtn("option_a")}</th><th>B ${semiColBtn("option_b")}</th><th>C ${semiColBtn("option_c")}</th><th>D</th>
          <th title="Răspunsul din grila oficială (istoric)">Corect (ist.)</th>
          <th title="Răspunsul pe gramatica 2026">Corect 2026</th>
          <th>Observații</th>
          <th title="Verificat de profesor (control intern)">Verificat</th>
          <th title="Publicat → vizibil elevilor">Publicat</th>
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
    <tr class="tg-row${it.published ? " is-pub" : ""}" data-id="${rid}">
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
      <td class="tg-tg"><button type="button" class="tg-verify${it.verified ? " on" : ""}" data-action="verify" data-id="${rid}" title="${it.verified ? "Verificat" : "Neverificat"}">${VERIFY_SVG}</button></td>
      <td class="tg-tg"><button type="button" class="tg-publish${it.published ? " on" : ""}" data-action="publish" data-id="${rid}" title="${it.published ? "Publicat — vizibil elevilor" : "Nepublicat"}">${UPLOAD_SVG}</button></td>
    </tr>`;
}

// ---------- viewport-fit height (kills page/table scroll conflict) ----------
function fitHeight() {
  const sc = root && root.querySelector(".tg-scroll");
  if (!sc) return;
  const top = sc.getBoundingClientRect().top;
  sc.style.height = Math.max(180, window.innerHeight - top - 8) + "px";
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

// ---------- zoom — the CSS var persists on `root` across renders ----------
function applyZoom() {
  root.style.setProperty("--tg-zoom", state.zoom);
  const lbl = root.querySelector(".tg-zval");
  if (lbl) lbl.textContent = Math.round(state.zoom * 100) + "%";
}
function computeFit() {
  const sc = root.querySelector(".tg-scroll");
  if (!sc) return state.zoom;
  root.style.setProperty("--tg-zoom", "1");
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
  window.addEventListener("resize", fitHeight);

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
    if (e.target.id === "tg-fr-whole") { state.frWhole = e.target.checked; return; }
    if (e.target.id === "tg-fr-cs") { state.frCase = e.target.checked; return; }
  });

  root.addEventListener("input", (e) => {
    if (e.target.id === "tg-search") { state.search = e.target.value; renderBodyOnly(); }
    else if (e.target.id === "tg-find") state.find = e.target.value;
    else if (e.target.id === "tg-repl") state.repl = e.target.value;
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
    const bc = e.target.closest("[data-boldcol]");
    if (bc) return bulkBold(bc.dataset.boldcol);
    const sc = e.target.closest("[data-semicol]");
    if (sc) return bulkSemi(sc.dataset.semicol);
    const fr = e.target.closest("[data-action=find-replace]");
    if (fr) return findReplace();
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

    const verify = e.target.closest("[data-action=verify]");
    if (verify) return toggleVerified(verify);
    const publish = e.target.closest("[data-action=publish]");
    if (publish) return togglePublished(publish);
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
    cell.textContent = curr ?? "";
    return;
  }
  if (field === "year") it.year = val; else if (field === "item_no") it.itemNo = val; else it.session = val;
  showSaved(true); flash(cell);
}

function saveLetter(td, k) {
  const it = byId(td.dataset.id); if (!it) return;
  const field = td.dataset.field;
  const val = (field === "correct_2026" && it.correct2026 === k) ? null : k; // 2026 optional; historical required
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

async function toggleVerified(btn) {
  const it = byId(btn.dataset.id); if (!it) return;
  const next = !it.verified;
  showSaving();
  const ok = await setTestVerified(it.id, next);
  if (!ok) { showSaved(false); showToast("Nu am putut salva."); return; }
  it.verified = next;
  btn.classList.toggle("on", next); // the green tick shows/hides via the .on class
  showSaved(true);
  // With „Ascunde verificații" on, the row you just verified fades out after 1s.
  if (next && state.hideVerified) scheduleHide(btn.closest(".tg-row"), it);
}

function scheduleHide(row, it) {
  if (!row) return;
  setTimeout(() => {
    if (!row.isConnected || !state.hideVerified || !it.verified) return; // still applies?
    row.classList.add("tg-fading");
    setTimeout(() => { if (row.isConnected) row.remove(); syncCount(); }, 350);
  }, 1000);
}

function syncCount() {
  const count = root.querySelector(".tg-count");
  if (count) count.textContent = `${filtered().length} / ${state.items.length} · ${state.items.filter((i) => i.verified).length} verificați`;
}

async function togglePublished(btn) {
  const it = byId(btn.dataset.id); if (!it) return;
  const next = !it.published;
  showSaving();
  const ok = await setTestPublished(it.id, next);
  if (!ok) { showSaved(false); showToast("Nu am putut publica."); return; }
  it.published = next;
  btn.classList.toggle("on", next); // the upload icon stays; color signals the state
  btn.closest(".tg-row").classList.toggle("is-pub", next); // row "live" = published
  showSaved(true);
  showToast(next ? "Publicat — vizibil elevilor." : "Retras de la elevi.");
}

function renderBodyOnly() {
  const rows = filtered();
  const count = root.querySelector(".tg-count");
  if (count) count.textContent = `${rows.length} / ${state.items.length} · ${state.items.filter((i) => i.verified).length} verificați`;
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

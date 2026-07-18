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
  adminFetchTestItems, adminFetchTestItem, fetchTestYears, updateTestItem, TEST_ITEM_TYPES,
} from "../../shared/scripts/test-repo.js";
import { sanitizeRich, stripRich, execBold, execUnderline, execItalic, execStrike, execSuper, wrapSelection, formatState } from "../../shared/scripts/rich-text.js";
import { showToast } from "../../shared/scripts/toast.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LETTERS = ["A", "B", "C", "D"];
// Phone layout kicks in at ≤700px (e.g. Samsung S24 portrait). Above that the
// desktop Excel grid is used, completely unchanged.
const isMobile = () => window.matchMedia("(max-width: 700px)").matches;
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
  zoom: 1, mIndex: 0,
  find: "", repl: "", frWhole: true, frCase: true,
  colWidths: {}, // Excel-like column resize: 1-based column index → px width
};

export async function initTestAdminGrid(mountEl) {
  root = mountEl;
  if (!isMobile()) lockPageScroll(true); // desktop: Excel-like full screen (no page scroll). Phone scrolls normally.
  document.body.classList.add("tg-mode");
  if (!wired) { wireEvents(); wired = true; }
  root.className = "tg-wrap";
  state.loading = true;
  render();
  if (!state.years.length) state.years = await fetchTestYears(state.exam);
  // Deep link from a flagged report (?item=<uuid>) → land straight on that row.
  // Filters are cleared, otherwise the item could be filtered out of view.
  let jumpTo = null;
  const wanted = new URLSearchParams(location.search).get("item");
  if (wanted) {
    const it = await adminFetchTestItem(wanted);
    if (it) {
      jumpTo = it.id;
      state.year = it.year;
      state.session = ""; state.hideVerified = false; state.onlyNo2026 = false; state.search = "";
    }
  }
  if (state.year == null || !state.years.some((y) => y.year === state.year)) {
    state.year = state.years.length ? state.years[state.years.length - 1].year : null;
  }
  await load();
  if (jumpTo) revealRow(jumpTo);
}

// Bring one item into view and flash it, so it's obvious where you landed.
function revealRow(id) {
  if (isMobile()) {
    const i = filtered().findIndex((x) => x.id === id); // phone shows one card at a time
    if (i >= 0) { state.mIndex = i; render(); }
    return;
  }
  const el = root.querySelector(`.tg-row[data-id="${id}"]`);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("is-active", "tg-flash");
  setTimeout(() => el.classList.remove("tg-flash"), 2200);
}

// Locking BOTH <html> and <body> is what actually stops the page from moving
// (the scroller can be either). tests-hub.js restores it when you leave.
function lockPageScroll(on) {
  const v = on ? "hidden" : "";
  document.documentElement.style.overflow = v;
  document.body.style.overflow = v;
}

async function load() {
  await flushAll();               // save any pending edits before swapping the item set
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
  if (isMobile()) return renderMobile();   // phone layout — a completely separate DOM
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
      <a class="tg-back" href="./">‹ Înapoi</a>
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
        <button type="button" class="tg-fmt" data-fmt="strike" title="Tăiat"><s>S</s></button>
        <button type="button" class="tg-fmt" data-fmt="super" title="Exponent">x<sup>2</sup></button>
        <button type="button" class="tg-fmt" data-fmt="paren" title="Încadrează selecția în ( )">( )</button>
        <button type="button" class="tg-fmt" data-fmt="bracket" title="Încadrează selecția în [ ]">[ ]</button>
      </span>
      <span class="tg-zoom">
        <button type="button" class="tg-zbtn" data-zoom="out" title="Micșorează">−</button>
        <span class="tg-zval">${Math.round(state.zoom * 100)}%</span>
        <button type="button" class="tg-zbtn" data-zoom="in" title="Mărește">+</button>
        <button type="button" class="tg-zbtn" data-zoom="fit" title="Potrivește pe lățime (toate coloanele)">Fit</button>
      </span>
      <button type="button" class="tg-savebtn" data-action="save-all" title="Salvează tot ce e nesalvat">Salvează</button>
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
    <p class="tg-hint">Se salvează <b>pe item</b>: schimbările pleacă împreună când ieși de pe item, apeși <b>Salvează</b>, sau Verificat/Publicat (cu reîncercare dacă pică rețeaua). Indicatorul: „● nesalvate / ✓ Salvat". Formatare: selectează text, apoi <b>B</b>/<u>U</u>/<i>I</i> (sau Ctrl+B/U/I).</p>`;
  requestAnimationFrame(fitHeight);
  reapplyDirty();
  wireColResize();
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
          <th title="Tipuri de item (SF, MS, M, MIV, DEX, DOOM, G, F) — atinge ca să bifezi">Tipuri</th>
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

// Tap-chips to tag an item's topic type(s) — SF, MS, M, MIV, DEX, DOOM, G, F.
function typeChips(it) {
  const set = new Set(it.types || []);
  return TEST_ITEM_TYPES.map((t) =>
    `<button type="button" class="tg-typechip${set.has(t.code) ? " on" : ""}" data-typecode="${t.code}" data-id="${it.id}" title="${esc(t.label)}">${t.code}</button>`).join("");
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
      <td class="tg-types">${typeChips(it)}</td>
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

// ---------- Excel-like column resize (desktop table) ----------
// A single <style> holds per-column width rules (nth-child), so widths persist
// across re-renders. The sticky An/Sesiune/Nr columns are NOT resizable (their
// fixed left offsets would break).
function applyColWidths() {
  let style = document.getElementById("tg-colw");
  if (!style) { style = document.createElement("style"); style.id = "tg-colw"; document.head.appendChild(style); }
  style.textContent = Object.entries(state.colWidths)
    .map(([col, w]) => `.tg-table tr > *:nth-child(${col}){width:${w}px;min-width:${w}px;max-width:${w}px;}`)
    .join("");
}
function wireColResize() {
  const table = root.querySelector(".tg-table");
  if (!table) return;
  table.querySelectorAll("thead th").forEach((th, i) => {
    if (i < 3) return;                        // skip the sticky An / Sesiune / Nr
    if (th.querySelector(".tg-resizer")) return;
    const h = document.createElement("i");
    h.className = "tg-resizer";
    h.dataset.col = i + 1;                     // 1-based nth-child
    th.appendChild(h);
  });
  applyColWidths();
}
function startColResize(e, rz) {
  e.preventDefault();
  const col = rz.dataset.col;
  const th = rz.closest("th");
  const z = state.zoom || 1;
  const startX = e.clientX;
  const startW = th.getBoundingClientRect().width / z; // layout px (undo the CSS zoom)
  document.body.classList.add("tg-col-resizing");
  const move = (ev) => {
    state.colWidths[col] = Math.max(48, Math.round(startW + (ev.clientX - startX) / z));
    applyColWidths();
  };
  const up = () => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    document.body.classList.remove("tg-col-resizing");
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
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
  // Google-Docs-style safety net: write everything pending the moment the tab is
  // hidden (switched away / minimised) or closed, so nothing is lost on close.
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushAll(); });
  window.addEventListener("pagehide", () => flushAll());

  root.addEventListener("focusin", (e) => {
    const tr = e.target.closest(".tg-row");
    root.querySelectorAll(".tg-row.is-active").forEach((r) => r !== tr && r.classList.remove("is-active"));
    if (tr) tr.classList.add("is-active");
    // Moving to a DIFFERENT item (or to the toolbar) → flush the one we just left.
    const cell = e.target.closest("[data-id]");
    const newId = cell ? cell.dataset.id : null;
    if (activeItemId && newId !== activeItemId) flushItem(activeItemId);
    activeItemId = newId;
  });

  root.addEventListener("focusout", (e) => {
    const rich = e.target.closest(".tg-rich");
    if (rich) return queueRich(rich);           // queue only — flushed when you leave the item
    const plainCell = e.target.closest(".tg-edit");
    if (plainCell) return queuePlain(plainCell);
  });

  root.addEventListener("change", (e) => {
    if (e.target.id === "tg-year") { state.year = Number(e.target.value); state.session = ""; state.mIndex = 0; return load(); }
    if (e.target.id === "tg-ses") { state.session = e.target.value; state.mIndex = 0; return render(); }
    if (e.target.id === "tg-fr-whole") { state.frWhole = e.target.checked; return; }
    if (e.target.id === "tg-fr-cs") { state.frCase = e.target.checked; return; }
  });

  root.addEventListener("input", (e) => {
    if (e.target.id === "tg-search") { state.search = e.target.value; state.mIndex = 0; renderBodyOnly(); }
    else if (e.target.id === "tg-find") state.find = e.target.value;
    else if (e.target.id === "tg-repl") state.repl = e.target.value;
  });

  // format buttons must NOT steal the caret from the focused cell
  root.addEventListener("mousedown", (e) => {
    const rz = e.target.closest(".tg-resizer");
    if (rz) return startColResize(e, rz);   // drag a column border to resize (Excel-like)
    const fmt = e.target.closest(".tg-fmt");
    if (fmt) {
      e.preventDefault();
      const f = fmt.dataset.fmt;
      if (f === "bold") execBold();
      else if (f === "underline") execUnderline();
      else if (f === "italic") execItalic();
      else if (f === "strike") execStrike();
      else if (f === "super") execSuper();
      else if (f === "paren") wrapSelection("(", ")");
      else if (f === "bracket") wrapSelection("[", "]");
      updateFmtButtons();                 // reflect the new state on the format buttons
    }
  });

  // Keep B/U/I lit to match the formatting under the caret/selection.
  document.addEventListener("selectionchange", updateFmtButtons);

  root.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");   // phone: ‹ / › previous-next item
    if (nav) return mGo(nav.dataset.nav === "next" ? 1 : -1);
    const sav = e.target.closest("[data-action=save-all]");
    if (sav) return flushAll();                   // „Salvează" → write everything pending now
    const zb = e.target.closest(".tg-zbtn");
    if (zb) return zoom(zb.dataset.zoom);
    const bc = e.target.closest("[data-boldcol]");
    if (bc) return bulkBold(bc.dataset.boldcol);
    const sc = e.target.closest("[data-semicol]");
    if (sc) return bulkSemi(sc.dataset.semicol);
    const fr = e.target.closest("[data-action=find-replace]");
    if (fr) return findReplace();
    const tog = e.target.closest("[data-toggle]");
    if (tog) { state[tog.dataset.toggle] = !state[tog.dataset.toggle]; state.mIndex = 0; return render(); }

    const letter = e.target.closest(".tg-letter");
    if (letter) return saveLetter(letter.closest(".tg-ans"), letter.dataset.k);

    const typechip = e.target.closest(".tg-typechip");
    if (typechip) return toggleType(typechip);

    const same = e.target.closest(".tg-same");
    if (same) {
      const it = byId(same.dataset.id);
      // Find the 2026 answer cell for THIS item — works on the desktop row and the phone card alike.
      const td2026 = root.querySelector(`.tg-ans[data-field="correct_2026"][data-id="${same.dataset.id}"]`);
      if (it && it.correct && td2026) saveLetterValue(td2026, it.correct);
      return;
    }

    const verify = e.target.closest("[data-action=verify]");
    if (verify) return toggleVerified(verify);
    const publish = e.target.closest("[data-action=publish]");
    if (publish) return togglePublished(publish);
  });

  // Enter: in a TEXT cell = a new text line (<br>, saved to Supabase, shown to pupils);
  // in a plain An/Sesiune/Nr cell = commit (blur). Shift+Enter always adds a line.
  root.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + B / U / I inside a text cell → route through OUR tag-mode
    // formatters, so the output is <b>/<u>/<i> (not a <span style> the save
    // would drop) and the toolbar buttons stay in sync — same as the buttons.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if ((k === "b" || k === "u" || k === "i") && e.target.closest(".tg-rich")) {
        e.preventDefault();
        if (k === "b") execBold(); else if (k === "u") execUnderline(); else execItalic();
        updateFmtButtons();
        return;
      }
    }
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.target.closest(".tg-edit")) { e.preventDefault(); e.target.blur(); return; }
    if (e.target.closest(".tg-rich")) {
      e.preventDefault();
      try {
        if (!document.execCommand("insertLineBreak")) document.execCommand("insertHTML", false, "<br>");
      } catch { document.execCommand("insertHTML", false, "<br>"); }
    }
  });

  // Phone: a horizontal swipe = previous / next item (ignored while editing text
  // so the caret / text selection keeps working).
  let sx = 0, sy = 0, st = 0;
  root.addEventListener("touchstart", (e) => {
    if (!isMobile()) return;
    const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; st = Date.now();
  }, { passive: true });
  root.addEventListener("touchend", (e) => {
    if (!isMobile()) return;
    const ae = document.activeElement;
    if (ae && ae.isContentEditable) return;                 // don't hijack an edit
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Date.now() - st > 600) return;                      // too slow to be a swipe
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return; // must be clearly horizontal
    mGo(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// Light up the B/U/I buttons to match the formatting at the caret/selection.
function updateFmtButtons() {
  if (!root) return;
  const btns = root.querySelectorAll(".tg-fmt");
  if (!btns.length) return;
  const sel = document.getSelection();
  let node = sel && sel.anchorNode;
  if (node && node.nodeType === 3) node = node.parentElement;   // text node → its element
  const inRich = node && node.closest && node.closest(".tg-rich");
  if (!inRich) { btns.forEach((b) => b.classList.remove("on")); return; }
  const st = formatState();
  btns.forEach((b) => b.classList.toggle("on", !!st[b.dataset.fmt]));
}

// ---------- saves: batch per ITEM (not per cell) ----------
// Edits no longer hit Supabase one-by-one. Every change is QUEUED per item in
// `pending`, and the WHOLE item is written in ONE request when you leave it,
// press „Salvează", or verify/publish it — with retry on a flaky network and a
// visible „nesalvat / salvat" state. Fewer writes, nothing silently lost.
const pending = new Map(); // itemId -> { field: value, … } not yet in Supabase
let activeItemId = null;   // item currently being edited (so we flush it on leave)
const autoTimers = new Map(); // id -> debounce timer for Google-Docs-style auto-save

// Save an item shortly after you STOP editing it (even if you don't leave it),
// so work persists like Google Docs — type, and ~1.2s later it's in Supabase,
// even if you close the tab right after.
function scheduleAutoFlush(id) {
  clearTimeout(autoTimers.get(id));
  autoTimers.set(id, setTimeout(() => { autoTimers.delete(id); flushItem(id); }, 1200));
}

function richFieldValue(it, field) {
  return field === "question" ? it.question
    : field === "observation" ? it.observation
    : field === "option_a" ? it.options.A
    : field === "option_b" ? it.options.B
    : field === "option_c" ? it.options.C
    : it.options.D;
}

function queueChange(id, field, value) {
  let p = pending.get(id);
  if (!p) { p = {}; pending.set(id, p); }
  p[field] = value;
  markRowDirty(id, true);
  updateSaveState();
  scheduleAutoFlush(id); // auto-save ~1.2s after you stop (Google-Docs style)
}

// Toggle the „nesalvat" marker on an item's row (desktop) / card (phone).
function markRowDirty(id, dirty) {
  if (!root) return;
  const el = root.querySelector(`.tg-row[data-id="${id}"], .tgm-card[data-id="${id}"]`);
  if (el) el.classList.toggle("tg-dirty", dirty);
}

// After a re-render the DOM is fresh — re-paint the „nesalvat" markers.
function reapplyDirty() {
  pending.forEach((_p, id) => markRowDirty(id, true));
  updateSaveState();
}

// Live „nesalvat N / se salvează… / ✓ salvat" indicator (shared #tg-save).
function updateSaveState(saving) {
  const el = root && root.querySelector("#tg-save");
  if (!el) return;
  clearTimeout(updateSaveState._t);
  if (saving) { el.textContent = "Se salvează…"; el.className = "tg-savestate is-saving"; return; }
  const n = pending.size;
  if (n > 0) { el.textContent = `● ${n} nesalvat${n > 1 ? "e" : ""}`; el.className = "tg-savestate is-dirty"; return; }
  el.textContent = "✓ Salvat"; el.className = "tg-savestate is-ok";
  updateSaveState._t = setTimeout(() => {
    if (el && !pending.size) { el.textContent = ""; el.className = "tg-savestate"; }
  }, 1700);
}

async function updateWithRetry(id, patch, tries = 3) {
  for (let i = 0; i < tries; i++) {
    // eslint-disable-next-line no-await-in-loop
    if (await updateTestItem(id, patch)) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 350 * (i + 1)));
  }
  return false;
}

/** Write ALL queued changes for one item in a SINGLE request (with retry).
 *  On failure the item stays „nesalvat" (queued) so nothing is lost. */
async function flushItem(id) {
  clearTimeout(autoTimers.get(id)); autoTimers.delete(id); // cancel a scheduled auto-save; we're saving now
  const p = pending.get(id);
  if (!p || !Object.keys(p).length) return true;
  pending.delete(id);
  updateSaveState(true);
  const ok = await updateWithRetry(id, p);
  if (!ok) {
    const now = pending.get(id) || {};
    pending.set(id, { ...p, ...now }); // keep it (merge anything queued meanwhile)
    updateSaveState();
    showToast("Nu am putut salva itemul — rămâne «nesalvat». Reîncearcă.");
    return false;
  }
  markRowDirty(id, false);
  updateSaveState();
  return true;
}

/** Save everything still pending (before loading another year / leaving). */
async function flushAll() {
  for (const id of [...pending.keys()]) {
    // eslint-disable-next-line no-await-in-loop
    await flushItem(id);
  }
}

// Queue a rich cell's edit (Enunț / A–D / Observații) — no immediate write.
function queueRich(cell) {
  const it = byId(cell.dataset.id); if (!it) return;
  const field = cell.dataset.field;
  const clean = sanitizeRich(cell.innerHTML);
  cell.innerHTML = clean;
  if (clean === (richFieldValue(it, field) || "")) return; // nothing changed
  applyLocal(it, field, clean);
  queueChange(it.id, field, clean || null);
  flash(cell);
}

// Queue a plain cell's edit (An / Sesiune / Nr).
function queuePlain(cell) {
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
  if (field === "year") it.year = val; else if (field === "item_no") it.itemNo = val; else it.session = val;
  queueChange(it.id, field, val);
  flash(cell);
}

function saveLetter(td, k) {
  const it = byId(td.dataset.id); if (!it) return;
  const field = td.dataset.field;
  const val = (field === "correct_2026" && it.correct2026 === k) ? null : k; // 2026 optional; historical required
  saveLetterValue(td, val);
}
// Answer letters are queued too (one write per item), with instant highlight.
function saveLetterValue(td, val) {
  if (!td) return;
  const it = byId(td.dataset.id); if (!it) return;
  const field = td.dataset.field;
  if (field === "correct_2026") it.correct2026 = val; else it.correct = val;
  td.querySelectorAll(".tg-letter").forEach((b) => b.classList.toggle("on", b.dataset.k === val));
  queueChange(it.id, field, val);
  flash(td);
}

// Toggle a topic type on an item — queued like everything else (batch save).
function toggleType(chip) {
  const it = byId(chip.dataset.id); if (!it) return;
  const code = chip.dataset.typecode;
  const set = new Set(it.types || []);
  if (set.has(code)) set.delete(code); else set.add(code);
  it.types = TEST_ITEM_TYPES.map((t) => t.code).filter((c) => set.has(c)); // canonical order
  chip.classList.toggle("on", set.has(code));
  queueChange(it.id, "types", it.types);
}

async function toggleVerified(btn) {
  const it = byId(btn.dataset.id); if (!it) return;
  const next = !it.verified;
  it.verified = next;
  btn.classList.toggle("on", next);        // green tick shows/hides via the .on class
  syncCount();                             // refresh the „N verificați" count right away (was stale)
  queueChange(it.id, "verified", next);
  const ok = await flushItem(it.id);       // „verificat" = save the WHOLE item now (with retry)
  // With „Ascunde verificații" on, the item you just verified drops out.
  if (ok && next && state.hideVerified) {
    if (isMobile()) renderMobile();                 // phone: re-filter → auto-advances to the next item
    else scheduleHide(btn.closest(".tg-row"), it);  // desktop: fade the row out after 1s
  }
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
  const prog = root.querySelector(".tgm-progtxt"); // phone: refresh the „X verif." number too
  if (prog) prog.innerHTML = mProgHtml(filtered());
}

async function togglePublished(btn) {
  const it = byId(btn.dataset.id); if (!it) return;
  const next = !it.published;
  it.published = next;
  btn.classList.toggle("on", next); // the upload icon stays; color signals the state
  const pubRow = btn.closest(".tg-row"); // desktop only — the phone card has no table row
  if (pubRow) pubRow.classList.toggle("is-pub", next); // row "live" = published
  queueChange(it.id, "published", next);
  const ok = await flushItem(it.id); // publish = save the WHOLE item now (with retry)
  if (ok) showToast(next ? "Publicat — vizibil elevilor." : "Retras de la elevi.");
}

function renderBodyOnly() {
  if (isMobile()) return mUpdateBody();    // phone: refresh only card + progress, keep the search focused
  const rows = filtered();
  const count = root.querySelector(".tg-count");
  if (count) count.textContent = `${rows.length} / ${state.items.length} · ${state.items.filter((i) => i.verified).length} verificați`;
  const scroll = root.querySelector(".tg-scroll");
  if (!scroll) return;
  if (!rows.length) { scroll.innerHTML = `<div class="tg-empty">Niciun item pentru filtrele curente.</div>`; return; }
  const tb = root.querySelector(".tg-table tbody");
  if (!tb) { scroll.innerHTML = tableHtml(rows); reapplyDirty(); return; }
  tb.innerHTML = rows.map(rowHtml).join("");
  reapplyDirty();
}

function applyLocal(it, field, val) {
  if (field === "question") it.question = val;
  else if (field === "observation") it.observation = val;
  else if (field === "option_a") it.options.A = val;
  else if (field === "option_b") it.options.B = val;
  else if (field === "option_c") it.options.C = val;
  else if (field === "option_d") it.options.D = val;
}

// =========================================================
// PHONE layout (≤700px) — a completely separate render path. One item fills the
// screen as a big, stylus-friendly card; swipe or ‹ › moves between items.
// It reuses the SAME state and the SAME save handlers as the desktop grid (same
// .tg-rich / .tg-edit / .tg-ans / [data-action] hooks), so text edits, answers,
// verify and publish persist to Supabase in exactly the same way. The desktop
// table is never built on phones — and its markup/CSS is never touched.
// =========================================================
function mClamp(rows) {
  const n = (rows || filtered()).length;
  state.mIndex = n ? Math.max(0, Math.min(state.mIndex, n - 1)) : 0;
}

function mGo(delta) {
  const rows = filtered();
  if (!rows.length) return;
  const ae = document.activeElement;
  if (ae && ae.blur) ae.blur();                 // fire focusout → queue the open edit
  const cur = rows[state.mIndex];
  if (cur) flushItem(cur.id);                   // SAVE this item before moving on
  activeItemId = null;
  state.mIndex = Math.max(0, Math.min(state.mIndex + delta, rows.length - 1));
  renderMobile();
  window.scrollTo(0, 0);                         // show the new card from the top
}

function mLetters(field, id, current) {
  return `<div class="tg-ans tgm-ans${field === "correct" ? " tg-ans--hist" : ""}" data-field="${field}" data-id="${id}">
    ${LETTERS.map((k) => `<button type="button" class="tg-letter${current === k ? " on" : ""}" data-k="${k}">${k}</button>`).join("")}
    ${field === "correct_2026" ? `<button type="button" class="tg-same" data-id="${id}" title="Pune la 2026 același răspuns ca cel istoric">= ist.</button>` : ""}
  </div>`;
}

// Fields where the phone keyboard should NOT auto-capitalise: notes + answer
// options are lowercase fragments. Enunț keeps sentence-case (starts a sentence).
const NO_AUTOCAP = new Set(["observation", "option_a", "option_b", "option_c", "option_d"]);

function mCardHtml(it) {
  const rid = it.id;
  const rich = (field, val, extra = "") => {
    const caps = NO_AUTOCAP.has(field) ? ' autocapitalize="none"' : "";
    return `<div class="tg-rich${extra}" contenteditable="true"${caps} data-id="${rid}" data-field="${field}">${sanitizeRich(val)}</div>`;
  };
  const optRow = (k, field, val) =>
    `<div class="tgm-opt"><span class="tgm-optk">${k}</span>${rich(field, val, " tgm-optt")}</div>`;
  return `
    <div class="tgm-card${pending.has(it.id) ? " tg-dirty" : ""}" data-id="${rid}">
      <div class="tgm-head">
        <span class="tgm-year-chip">${esc(it.year ?? "")}</span>
        <span class="tgm-meta">
          <span class="tgm-ed tg-edit" contenteditable="true" data-id="${rid}" data-field="session" data-ph="sesiune">${esc(it.session || "")}</span>
          <span class="tgm-sep">·</span>nr
          <span class="tgm-ed tgm-ed--no tg-edit" contenteditable="true" data-id="${rid}" data-field="item_no">${esc(it.itemNo ?? "")}</span>
        </span>
        <span class="tgm-spacer"></span>
        <span class="tgm-dirty-chip" title="Modificări nesalvate">● nesalvat</span>
        <button type="button" class="tgm-verify${it.verified ? " on" : ""}" data-action="verify" data-id="${rid}" aria-label="${it.verified ? "Verificat" : "Marchează verificat"}">${VERIFY_SVG}</button>
        <button type="button" class="tgm-publish${it.published ? " on" : ""}" data-action="publish" data-id="${rid}" aria-label="${it.published ? "Publicat — vizibil elevilor" : "Publică"}">${UPLOAD_SVG}</button>
      </div>

      <div class="tgm-lab">enunț</div>
      ${rich("question", it.question, " tgm-q")}

      <div class="tgm-lab">variante</div>
      ${optRow("A", "option_a", it.options.A)}
      ${optRow("B", "option_b", it.options.B)}
      ${optRow("C", "option_c", it.options.C)}
      ${optRow("D", "option_d", it.options.D)}

      <div class="tgm-ans-wrap">
        <div class="tgm-ans-row"><span class="tgm-ans-lab">corect istoric</span>${mLetters("correct", rid, it.correct)}</div>
        <div class="tgm-ans-row"><span class="tgm-ans-lab">corect 2026</span>${mLetters("correct_2026", rid, it.correct2026)}</div>
      </div>

      <div class="tgm-lab">tipuri de item</div>
      <div class="tgm-types-edit">${typeChips(it)}</div>

      <div class="tgm-lab">observații <small>(le vede elevul)</small></div>
      ${rich("observation", it.observation, " tgm-obs")}
    </div>`;
}

function mBars() {
  const yearsSel = state.years.map((y) =>
    `<option value="${y.year}"${y.year === state.year ? " selected" : ""}>${y.year} (${y.n})</option>`).join("");
  return `
    <div class="tgm-top">
      <a class="tg-back" href="./" aria-label="Înapoi la categorie">‹</a>
      <select id="tg-year" class="tgm-year" aria-label="An">${yearsSel}</select>
      <input id="tg-search" class="tgm-search" type="search" placeholder="Caută…" value="${esc(state.search)}" />
      <button type="button" class="tg-chip tgm-chip${state.hideVerified ? " on" : ""}" data-toggle="hideVerified" title="Ascunde itemii verificați">✓ ascunde</button>
    </div>`;
}

function mProgHtml(rows) {
  const vCount = state.items.filter((i) => i.verified).length;
  return `${rows.length ? state.mIndex + 1 : 0} / ${rows.length}<small> · ${vCount} verif.</small>`;
}

function renderMobile() {
  const rows = filtered();
  mClamp(rows);
  const it = rows[state.mIndex];
  root.innerHTML = `
    <div class="tgm">
      ${mBars()}
      <div class="tgm-prog">
        <button type="button" class="tgm-navbtn" data-nav="prev" aria-label="Precedentul">‹</button>
        <span class="tgm-progtxt">${mProgHtml(rows)}</span>
        <button type="button" class="tgm-savebtn" data-action="save-all">Salvează</button>
        <span class="tg-savestate tgm-save" id="tg-save"></span>
        <button type="button" class="tgm-navbtn" data-nav="next" aria-label="Următorul">›</button>
      </div>
      ${state.loading
        ? `<div class="tg-empty">Se încarcă…</div>`
        : (!it ? `<div class="tg-empty">Niciun item pentru filtrele curente.</div>` : mCardHtml(it))}
      <div class="tgm-nav">
        <button type="button" class="tgm-navbig" data-nav="prev">‹ Înapoi</button>
        <span class="tgm-fmt" title="Selectează text, apoi formatează:">
          <button type="button" class="tg-fmt" data-fmt="bold"><b>B</b></button>
          <button type="button" class="tg-fmt" data-fmt="underline"><u>U</u></button>
          <button type="button" class="tg-fmt" data-fmt="italic"><i>I</i></button>
          <button type="button" class="tg-fmt" data-fmt="strike" title="Tăiat"><s>S</s></button>
          <button type="button" class="tg-fmt" data-fmt="super" title="Exponent">x<sup>2</sup></button>
          <button type="button" class="tg-fmt" data-fmt="paren" title="( )">( )</button>
          <button type="button" class="tg-fmt" data-fmt="bracket" title="[ ]">[ ]</button>
        </span>
        <button type="button" class="tgm-navbig" data-nav="next">Înainte ›</button>
      </div>
    </div>`;
  reapplyDirty();
}

// Refresh only the card + progress (used while typing in search, to keep focus).
function mUpdateBody() {
  const rows = filtered();
  mClamp(rows);
  const it = rows[state.mIndex];
  const prog = root.querySelector(".tgm-progtxt");
  if (prog) prog.innerHTML = mProgHtml(rows);
  const cur = root.querySelector(".tgm-card, .tgm .tg-empty");
  if (!cur) return;
  cur.outerHTML = state.loading
    ? `<div class="tg-empty">Se încarcă…</div>`
    : (!it ? `<div class="tg-empty">Niciun item pentru filtrele curente.</div>` : mCardHtml(it));
  reapplyDirty();
}

// =========================================================
// Teste → Admitere Drept — ADMIN grid (Excel-like), teacher only.
//
// A spreadsheet-style editor over `test_items` (loaded per year via the
// admin_test_items RPC, which returns the answers + unverified rows):
//   • rows × columns, sticky header + sticky first columns (An/Sesiune/Nr),
//     the active row highlighted with a gradient;
//   • filters: year, session, published/unpublished, flagged, missing-2026,
//     free-text search;
//   • inline editing that SAVES to Supabase on blur/change:
//       - Enunț / A–D / Observații = rich text (bold/underline, via rich-text.js);
//       - „Corect 2026" = A/B/C/D, with a „= ist." button (copy the historical one);
//       - „Publicat" (verified → visible to pupils) and „Marcaj" (private) toggles.
//   Writes are RLS-gated to the teacher; nothing here is shown to pupils.
// =========================================================
import {
  adminFetchTestItems, fetchTestYears, updateTestItem, setTestVerified, setTestFlagged,
} from "../../shared/scripts/test-repo.js";
import { sanitizeRich, stripRich, execBold, execUnderline } from "../../shared/scripts/rich-text.js";
import { showToast } from "../../shared/scripts/toast.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let root = null;
let wired = false;
const state = {
  exam: "admitere-drept",
  years: [],
  year: null,
  items: [],
  loading: false,
  // filters
  session: "",
  status: "all",   // all | pub | draft
  onlyFlagged: false,
  onlyNo2026: false,
  search: "",
};

export async function initTestAdminGrid(mountEl) {
  root = mountEl;
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
  state.loading = true;
  render();
  state.items = await adminFetchTestItems(state.exam, state.year);
  state.loading = false;
  render();
}

function byId(id) { return state.items.find((x) => x.id === id); }

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
  const cat = "⚖️ Admitere Drept";
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
      <h2 class="tg-title">${cat} <span class="tg-sub">— editor profesor</span></h2>
    </div>

    <div class="tg-toolbar">
      <label class="tg-f">An <select id="tg-year">${yearsSel}</select></label>
      <label class="tg-f">Sesiune <select id="tg-ses">${sesSel}</select></label>
      <span class="tg-chips">
        ${chip("status", "all", "Toate")}${chip("status", "pub", "Publicate")}${chip("status", "draft", "Nepublicate")}
        ${toggleChip("onlyFlagged", "★ marcate")}
        ${toggleChip("onlyNo2026", "fără 2026")}
      </span>
      <input id="tg-search" class="tg-search" type="search" placeholder="Caută în text…" value="${esc(state.search)}" />
      <span class="tg-fmt-group" title="Selectează text într-o celulă, apoi:">
        <button type="button" class="tg-fmt" data-fmt="bold"><b>B</b></button>
        <button type="button" class="tg-fmt" data-fmt="underline"><u>U</u></button>
      </span>
      <span class="tg-count">${rows.length} / ${state.items.length} itemi · ${state.items.filter((i) => i.verified).length} publicați</span>
    </div>

    <div class="tg-scroll">
      ${state.loading
        ? `<div class="tg-empty">Se încarcă…</div>`
        : (!rows.length
            ? `<div class="tg-empty">Niciun item pentru filtrele curente.</div>`
            : tableHtml(rows))}
    </div>
    <p class="tg-hint">Editează direct în celule; se salvează singur când ieși din celulă. Formatare: selectează text, apoi <b>B</b>/<u>U</u> sau Ctrl+B / Ctrl+U. „= ist." pune la 2026 același răspuns ca cel istoric.</p>`;
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
          <th title="Marcaj privat">★</th>
        </tr>
      </thead>
      <tbody>${rows.map(rowHtml).join("")}</tbody>
    </table>`;
}

function rowHtml(it) {
  const rid = it.id;
  const rich = (field, val) =>
    `<td class="tg-cell tg-rich" contenteditable="true" data-id="${rid}" data-field="${field}">${sanitizeRich(val)}</td>`;
  const opts = ["", "A", "B", "C", "D"].map((v) =>
    `<option value="${v}"${(it.correct2026 || "") === v ? " selected" : ""}>${v || "—"}</option>`).join("");
  return `
    <tr class="tg-row${it.verified ? " is-pub" : ""}${it.flagged ? " is-flag" : ""}" data-id="${rid}">
      <td class="tg-fix tg-c1">${it.year ?? ""}</td>
      <td class="tg-fix tg-c2">${esc(it.session)}</td>
      <td class="tg-fix tg-c3">${it.itemNo ?? ""}</td>
      ${rich("question", it.question)}
      ${rich("option_a", it.options.A)}
      ${rich("option_b", it.options.B)}
      ${rich("option_c", it.options.C)}
      ${rich("option_d", it.options.D)}
      <td class="tg-hist">${esc(it.correct || "?")}</td>
      <td class="tg-2026">
        <select class="tg-sel" data-id="${rid}" data-field="correct_2026" aria-label="Răspuns 2026">${opts}</select>
        <button type="button" class="tg-same" data-id="${rid}" title="Pune același răspuns ca cel istoric (${esc(it.correct || "?")})">= ist.</button>
      </td>
      ${rich("observation", it.observation)}
      <td class="tg-tg"><button type="button" class="tg-pub${it.verified ? " on" : ""}" data-action="pub" data-id="${rid}" title="${it.verified ? "Publicat — vizibil elevilor" : "Nepublicat"}">${it.verified ? "✓" : "○"}</button></td>
      <td class="tg-tg"><button type="button" class="tg-flag${it.flagged ? " on" : ""}" data-action="flag" data-id="${rid}" title="Marcaj privat">${it.flagged ? "★" : "☆"}</button></td>
    </tr>`;
}

// ---------- events (delegated on root) ----------
function wireEvents() {
  root.addEventListener("focusin", (e) => {
    const tr = e.target.closest(".tg-row");
    root.querySelectorAll(".tg-row.is-active").forEach((r) => r !== tr && r.classList.remove("is-active"));
    if (tr) tr.classList.add("is-active");
  });

  // save rich cells on blur
  root.addEventListener("focusout", async (e) => {
    const cell = e.target.closest(".tg-rich");
    if (!cell) return;
    const it = byId(cell.dataset.id);
    if (!it) return;
    const field = cell.dataset.field;
    const clean = sanitizeRich(cell.innerHTML);
    cell.innerHTML = clean; // normalise what we show to what we store
    const current = { question: it.question, option_a: it.options.A, option_b: it.options.B,
                      option_c: it.options.C, option_d: it.options.D, observation: it.observation }[field] || "";
    if (clean === (current || "")) return; // unchanged
    const ok = await updateTestItem(it.id, { [field]: clean || null });
    if (!ok) { showToast("Nu am putut salva. Reîncearcă."); return; }
    applyLocal(it, field, clean);
    flash(cell);
  });

  // selects (correct_2026)
  root.addEventListener("change", async (e) => {
    if (e.target.id === "tg-year") { state.year = Number(e.target.value); state.session = ""; return load(); }
    if (e.target.id === "tg-ses") { state.session = e.target.value; return render(); }
    const sel = e.target.closest(".tg-sel");
    if (sel) {
      const it = byId(sel.dataset.id);
      if (!it) return;
      const val = sel.value || null;
      const ok = await updateTestItem(it.id, { correct_2026: val });
      if (!ok) { showToast("Nu am putut salva răspunsul 2026."); return; }
      it.correct2026 = val;
      flash(sel.closest("td"));
    }
  });

  // search
  root.addEventListener("input", (e) => {
    if (e.target.id === "tg-search") { state.search = e.target.value; renderBodyOnly(); }
  });

  // clicks: chips, toggles, "= ist.", format buttons, back
  root.addEventListener("mousedown", (e) => {
    // format buttons must NOT steal the caret from the focused cell
    const fmt = e.target.closest(".tg-fmt");
    if (fmt) { e.preventDefault(); fmt.dataset.fmt === "bold" ? execBold() : execUnderline(); }
  });

  root.addEventListener("click", async (e) => {
    const chip = e.target.closest("[data-filter]");
    if (chip) { state[chip.dataset.filter] = chip.dataset.val; return render(); }
    const tog = e.target.closest("[data-toggle]");
    if (tog) { state[tog.dataset.toggle] = !state[tog.dataset.toggle]; return render(); }

    const same = e.target.closest(".tg-same");
    if (same) {
      const it = byId(same.dataset.id);
      if (!it || !it.correct) return;
      const ok = await updateTestItem(it.id, { correct_2026: it.correct });
      if (!ok) { showToast("Nu am putut copia răspunsul."); return; }
      it.correct2026 = it.correct;
      const sel = same.parentElement.querySelector(".tg-sel");
      if (sel) sel.value = it.correct;
      flash(same.closest("td"));
      return;
    }

    const pub = e.target.closest("[data-action=pub]");
    if (pub) {
      const it = byId(pub.dataset.id); if (!it) return;
      const next = !it.verified;
      const ok = await setTestVerified(it.id, next);
      if (!ok) { showToast("Nu am putut publica."); return; }
      it.verified = next;
      pub.classList.toggle("on", next); pub.textContent = next ? "✓" : "○";
      pub.closest(".tg-row").classList.toggle("is-pub", next);
      showToast(next ? "Publicat — vizibil elevilor." : "Retras de la elevi.");
      return;
    }

    const flag = e.target.closest("[data-action=flag]");
    if (flag) {
      const it = byId(flag.dataset.id); if (!it) return;
      const next = !it.flagged;
      const ok = await setTestFlagged(it.id, next);
      if (!ok) { showToast("Nu am putut marca."); return; }
      it.flagged = next;
      flag.classList.toggle("on", next); flag.textContent = next ? "★" : "☆";
      flag.closest(".tg-row").classList.toggle("is-flag", next);
      return;
    }
  });

  // Enter inside a rich cell = commit (blur), not a newline flood.
  root.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && e.target.closest(".tg-rich")) {
      e.preventDefault();
      e.target.blur();
    }
  });
}

// Re-render only the table body (used while typing in the search box, to keep focus).
function renderBodyOnly() {
  const tb = root.querySelector(".tg-table tbody");
  const rows = filtered();
  const count = root.querySelector(".tg-count");
  if (count) count.textContent = `${rows.length} / ${state.items.length} itemi · ${state.items.filter((i) => i.verified).length} publicați`;
  const scroll = root.querySelector(".tg-scroll");
  if (!scroll) return;
  if (!rows.length) { scroll.innerHTML = `<div class="tg-empty">Niciun item pentru filtrele curente.</div>`; return; }
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

function flash(el) {
  if (!el) return;
  el.classList.add("tg-saved");
  setTimeout(() => el.classList.remove("tg-saved"), 700);
}

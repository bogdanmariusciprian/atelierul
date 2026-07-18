// =========================================================
// Teste → mini-game (PUPIL / GUEST). One item at a time, click an answer to
// submit, see the observation, keep going until every item is answered right.
//
//   • CONFIG (two columns, no dropdowns): filters on the left, a LIVE summary
//     on the right showing the funnel narrow (all items → years/sessions →
//     types) plus the session's emoji and the start button.
//       - „Toți anii" / „Toate" are SHORTCUTS: pressing one includes
//         everything and leaves the individual chips unticked but tappable.
//         Ticking every option by hand makes the shortcut redundant, so it
//         goes disabled; untick one and it comes back.
//       - Topic types are a DRAG-TO-REORDER list; the order becomes the
//         playing order („Ordinea mea").
//   • GAME: progress bar + live corect / greșit / puncte, a discreet elapsed
//     timer, type labels. Correct → confetti + points fly in. Wrong → the page
//     quakes, the card flashes red and a copy flies into the „greșite" counter,
//     and the item returns to the BACK of the queue until it's answered right.
//   • SAVED SESSIONS (members): the pupil marks a session with an emoji; the
//     remaining queue + score autosave after every item, so they can leave and
//     resume from any device. Finishing deletes the session.
//
// CHEAT-SAFE: items ship without the answer key; the only way to learn the
// answer is answer_test_item AFTER a choice. Points are awarded server-side,
// once per (user, item, session) — resuming reuses the SAME session id, so a
// reload can't farm points. The saved queue holds only item ids.
// =========================================================
import {
  fetchTestItems, fetchTestItem, answerTestItem, TEST_ITEM_TYPES,
  fetchMyTestSessions, saveTestSession, deleteTestSession,
} from "../../shared/scripts/test-repo.js";
import { reportContent, createPost } from "../../shared/scripts/forum-repo.js";
import { sanitizeRich } from "../../shared/scripts/rich-text.js";
import { showToast } from "../../shared/scripts/toast.js";
import { isLoggedIn } from "../../shared/scripts/session.js";

const OPTS = ["A", "B", "C", "D"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TYPE_LABEL = Object.fromEntries(TEST_ITEM_TYPES.map((t) => [t.code, t.label]));
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
// Session markers the pupil picks from (first one is the default).
const EMOJIS = ["⚖️", "📚", "🔥", "🎯", "🦉", "🧠", "⭐", "🚀", "🌙", "☕", "🍀", "💎"];
const uuid = () => (crypto.randomUUID
  ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

let root = null;
const G = {
  exam: null, items: [], byId: new Map(),
  years: [], sessions: [], availTypes: [], typeCounts: {},
  // Each group has an explicit "all mode" (the shortcut is pressed) that is
  // NOT the same as "every option ticked by hand" — see pickGroup below.
  sel: { years: new Set(), sessions: new Set(), types: new Set(), order: "random" },
  all: { years: true, sessions: true, types: true },
  typeOrder: [], // the pupil's drag order → playing order under „Ordinea mea"
  emoji: EMOJIS[0], label: "",
  saved: [], savedId: null,
  sessionId: null, queue: [],
  // Every answer given this sitting, in order — powers the back/forward
  // review AND the results chart. Each entry is a closed book: it keeps the
  // answer the server revealed, so revisiting never re-asks the server.
  history: [], view: null, liveAnswered: false, itemStart: 0,
  total: 0, correct: 0, wrong: 0, points: 0,
  inGame: false, startAt: 0, elapsedBase: 0, timer: null,
};

const elapsedSec = () => G.elapsedBase + Math.floor((Date.now() - G.startAt) / 1000);
const fmtSec = (ms) => `${(ms / 1000).toFixed(1)}s`;
const plain = (s) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

// ---------- entry ----------
export async function initTestGame(mountEl, exam) {
  root = mountEl;
  G.exam = exam;
  G.inGame = false;
  root.className = "tgame-wrap";
  if (!root.__gameWired) {
    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    // Chart bars answer to both the mouse and the keyboard.
    root.addEventListener("mouseover", onBarPeek);
    root.addEventListener("focusin", onBarPeek);
    root.__gameWired = true;
  }
  if (!window.__tgameBeforeUnload) {
    window.__tgameBeforeUnload = true;
    window.addEventListener("beforeunload", (e) => { if (G.inGame) { e.preventDefault(); e.returnValue = ""; } });
  }
  root.innerHTML = `<div class="tgame-loading">Se încarcă itemii…</div>`;

  const items = await fetchTestItems({ exam }); // published only (RLS), all years
  G.items = items;
  G.byId = new Map(items.map((i) => [i.id, i]));
  G.years = [...new Set(items.map((i) => i.year).filter((y) => y != null))].sort((a, b) => Number(b) - Number(a));
  // Sessions come from the data itself (like years), so new ones show up on
  // their own as soon as the teacher publishes items for them.
  G.sessions = [...new Set(items.map((i) => i.session).filter(Boolean))].sort();
  G.typeCounts = {};
  items.forEach((i) => (i.types || []).forEach((t) => { G.typeCounts[t] = (G.typeCounts[t] || 0) + 1; }));
  G.availTypes = TEST_ITEM_TYPES.map((t) => t.code).filter((c) => G.typeCounts[c] > 0);
  G.typeOrder = [...G.availTypes];
  G.sel.years = new Set(); G.sel.sessions = new Set(); G.sel.types = new Set();
  G.all = { years: true, sessions: true, types: true };
  G.saved = isLoggedIn() ? await fetchMyTestSessions(exam) : [];
  renderConfig();
}

// ---------- selection model ----------
const UNIVERSE = {
  years: () => G.years.map(String),
  sessions: () => G.sessions,
  types: () => G.availTypes,
};

// The shortcut („Toți anii" / „Toate") turns ALL mode on and clears the manual
// ticks. Tapping a single option while in ALL mode narrows to just that one.
// Unticking the last one falls back to ALL (never leaves an empty selection).
function pickGroup(name, value) {
  const cur = G.sel[name];
  if (value === "all") { G.all[name] = true; cur.clear(); return; }
  if (G.all[name]) { G.all[name] = false; G.sel[name] = new Set([value]); return; }
  if (cur.has(value)) { cur.delete(value); if (!cur.size) G.all[name] = true; }
  else cur.add(value);
}

// The shortcut has nothing left to add once every option is ticked by hand →
// it goes disabled (and becomes available again the moment one is unticked).
const allRedundant = (name) => {
  const uni = UNIVERSE[name]();
  return uni.length > 0 && !G.all[name] && G.sel[name].size === uni.length;
};

// ---------- filtering / ordering ----------
function matchYearSession(it) {
  if (!G.all.years && !G.sel.years.has(String(it.year))) return false;
  if (!G.all.sessions && !G.sel.sessions.has(it.session || "")) return false;
  return true;
}
// Under „all types" untagged items still play (nothing is excluded); a proper
// subset filters to items carrying at least one of the chosen tags.
function matchType(it) {
  if (G.all.types || !G.sel.types.size) return true;
  return (it.types || []).some((t) => G.sel.types.has(t));
}
function matchingItems() { return G.items.filter((it) => matchYearSession(it) && matchType(it)); }

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function buildQueue(items) {
  const arr = [...items];
  const byNo = (a, b) => (Number(b.year) - Number(a.year)) || (Number(a.itemNo) - Number(b.itemNo));
  if (G.sel.order === "years") arr.sort(byNo);
  else if (G.sel.order === "mine") {
    // Rank by the pupil's drag order; untagged items go last.
    const rank = new Map(G.typeOrder.map((c, i) => [c, i]));
    const r = (it) => Math.min(...(it.types || []).map((t) => (rank.has(t) ? rank.get(t) : 99)).concat([99]));
    arr.sort((a, b) => r(a) - r(b) || byNo(a, b));
  } else if (G.sel.order === "types") {
    const ft = (it) => (it.types || [])[0] || "￿";
    arr.sort((a, b) => ft(a).localeCompare(ft(b)) || byNo(a, b));
  } else shuffle(arr);
  return arr.map((i) => i.id);
}

// ---------- saved sessions ----------
function currentConfig() {
  return {
    allYears: G.all.years, allSessions: G.all.sessions, allTypes: G.all.types,
    years: [...G.sel.years], sessions: [...G.sel.sessions], types: [...G.sel.types],
    order: G.sel.order, typeOrder: G.typeOrder,
  };
}
// Autosaves after every item, so leaving mid-game loses nothing.
function persist() {
  if (!G.savedId || !isLoggedIn()) return;
  saveTestSession({
    id: G.savedId, exam: G.exam, emoji: G.emoji, label: G.label,
    config: currentConfig(), queue: G.queue,
    stats: { total: G.total, correct: G.correct, wrong: G.wrong, points: G.points, elapsed: elapsedSec() },
  });
}
async function refreshSaved() {
  G.saved = isLoggedIn() ? await fetchMyTestSessions(G.exam) : [];
}

function resumeSession(id) {
  const s = G.saved.find((x) => x.id === id);
  if (!s) return;
  const c = s.config || {};
  G.all = { years: c.allYears !== false, sessions: c.allSessions !== false, types: c.allTypes !== false };
  G.sel.years = new Set(c.years || []);
  G.sel.sessions = new Set(c.sessions || []);
  G.sel.types = new Set(c.types || []);
  G.sel.order = c.order || "random";
  G.typeOrder = (c.typeOrder || []).filter((t) => G.availTypes.includes(t));
  for (const t of G.availTypes) if (!G.typeOrder.includes(t)) G.typeOrder.push(t);
  G.emoji = s.emoji; G.label = s.label;
  // An item may have been unpublished since — drop it rather than crash.
  G.queue = (s.queue || []).filter((qid) => G.byId.has(qid));
  const st = s.stats || {};
  G.total = st.total || G.queue.length;
  G.correct = st.correct || 0; G.wrong = st.wrong || 0; G.points = st.points || 0;
  G.elapsedBase = st.elapsed || 0;
  G.savedId = s.id;
  G.sessionId = s.id; // same session id → points stay deduped server-side
  if (!G.queue.length) {
    deleteTestSession(s.id);
    G.saved = G.saved.filter((x) => x.id !== s.id);
    showToast("Sesiunea era deja terminată.");
    return renderConfig();
  }
  // A resumed sitting starts a fresh review strip (the chart covers this sitting).
  G.history = []; G.view = null; G.liveAnswered = false;
  G.inGame = true; G.startAt = Date.now(); G.itemStart = Date.now();
  startTimer();
  renderGame();
}

// ---------- CONFIG screen ----------
function chip(attr, val, label, on, extra = "") {
  return `<button type="button" class="tgame-chip${on ? " on" : ""}" data-${attr}="${esc(val)}"${extra}>${label}</button>`;
}
// „all" shortcut + the individual options of one group
function groupChips(name, attr, allLabel, options) {
  const dis = allRedundant(name);
  const allChip = chip(attr, "all", allLabel, G.all[name],
    dis ? ` disabled title="Ai bifat deja tot — scurtătura n-are ce adăuga"` : "");
  return allChip + options.map(({ v, label, n }) => chip(
    attr, v,
    `${esc(label)}${n != null ? ` <span class="tgame-chip__n">${n}</span>` : ""}`,
    !G.all[name] && G.sel[name].has(v)
  )).join("");
}

function typeList() {
  const rows = G.typeOrder.map((code, i) => {
    const on = !G.all.types && G.sel.types.has(code);
    return `<li class="tgame-tl__row${on ? " on" : ""}" data-tcode="${esc(code)}">
        <span class="tgame-tl__grip" title="Trage ca să reordonezi" aria-hidden="true">⠿</span>
        <button type="button" class="tgame-tl__btn" data-type="${esc(code)}">${esc(TYPE_LABEL[code] || code)}</button>
        <span class="tgame-tl__n">${G.typeCounts[code] || 0}</span>
        <span class="tgame-tl__ord">${i + 1}</span>
      </li>`;
  }).join("");
  const missing = TEST_ITEM_TYPES.filter((t) => !(G.typeCounts[t.code] > 0)).map((t) =>
    `<li class="tgame-tl__row is-empty" title="Încă nu sunt itemi de acest tip">
       <span class="tgame-tl__grip" aria-hidden="true">⠿</span>
       <span class="tgame-tl__btn">${esc(t.label)}</span>
       <span class="tgame-tl__n">0</span>
     </li>`).join("");
  return `<ul class="tgame-tl" id="tgame-tl">${rows}${missing}</ul>`;
}

function savedStrip() {
  if (!G.saved.length) return "";
  const cards = G.saved.map((s) => {
    const st = s.stats || {};
    const left = (s.queue || []).length;
    const total = st.total || left;
    const done = Math.max(0, total - left);
    return `<div class="tgame-scard">
        <span class="tgame-scard__em" aria-hidden="true">${esc(s.emoji)}</span>
        <div class="tgame-scard__body">
          <p class="tgame-scard__t">${esc(s.label || "Sesiune fără nume")}</p>
          <p class="tgame-scard__m">${done} din ${total} · ${st.points || 0} puncte</p>
        </div>
        <button type="button" class="tgame-btn tgame-btn--sm" data-act="resume" data-id="${esc(s.id)}">Continuă ▸</button>
        <button type="button" class="tgame-scard__x" data-act="drop-session" data-id="${esc(s.id)}" title="Șterge sesiunea" aria-label="Șterge sesiunea">×</button>
      </div>`;
  }).join("");
  return `<div class="tgame-saved">
      <div class="tgame-cfg-lab">Continuă unde ai rămas</div>
      <div class="tgame-saved__row">${cards}</div>
    </div>`;
}

// The live funnel: how the pool narrows with each choice.
function funnel() {
  const all = G.items.length;
  const afterYs = G.items.filter(matchYearSession).length;
  const final = matchingItems().length;
  const pct = (v) => (all ? Math.max(2, Math.round((v / all) * 100)) : 0);
  const row = (lab, v, w, strong) => `
    <div class="tgame-fn__row">
      <span class="tgame-fn__lab">${lab}</span>
      <span class="tgame-fn__v${strong ? " is-final" : ""}">${v}</span>
    </div>
    <div class="tgame-fn__bar"><i style="width:${w}%"></i></div>`;
  const ysLab = G.all.years && G.all.sessions ? "toți anii, toate sesiunile"
    : `${G.all.years ? "toți anii" : [...G.sel.years].sort().reverse().join(", ")}${G.all.sessions ? "" : ` · ${[...G.sel.sessions].join(", ")}`}`;
  const tLab = G.all.types ? "toate tipurile" : `${G.sel.types.size} tipuri alese`;
  return `<div class="tgame-fn">
      ${row("toți itemii", all, 100)}
      ${row(esc(ysLab), afterYs, pct(afterYs))}
      ${row(esc(tLab), final, pct(final), true)}
    </div>`;
}

function renderConfig() {
  stopTimer();
  G.inGame = false;
  const n = matchingItems().length;
  const yearOpts = G.years.map((y) => ({ v: String(y), label: String(y) }));
  const sessOpts = G.sessions.map((s) => ({ v: s, label: s }));
  const orderChips = [["random", "Aleatoriu"], ["years", "Pe ani"], ["types", "Pe tipuri"]]
    .concat(G.typeOrder.length > 1 ? [["mine", "Ordinea mea"]] : [])
    .map(([v, l]) => chip("order", v, l, G.sel.order === v)).join("");
  const emojiChips = EMOJIS.map((em) =>
    `<button type="button" class="tgame-em${em === G.emoji ? " on" : ""}" data-emoji="${em}" aria-label="Semn: ${em}">${em}</button>`).join("");

  root.innerHTML = `
    <section class="tgame-config tgame-cfg2">
      <a class="tgame-back" href="#" data-act="home">‹ Toate testele</a>
      <div class="tgame-config__hero">
        <span class="tgame-config__badge" aria-hidden="true">⚖️</span>
        <h2 class="tgame-config__title">Antrenament — Admitere Drept</h2>
        <p class="tgame-config__sub">Alege ce exersezi, apoi rezolvi câte un item pe rând. Cei greșiți revin până îi nimerești.</p>
      </div>

      ${savedStrip()}

      <div class="tgame-cfg2__grid">
        <div class="tgame-cfg2__main">
          <div class="tgame-cfg-block">
            <div class="tgame-cfg-lab">Ani</div>
            <div class="tgame-chips">${groupChips("years", "year", "Toți anii", yearOpts)}</div>
          </div>

          ${G.sessions.length ? `
          <div class="tgame-cfg-block">
            <div class="tgame-cfg-lab">Sesiune</div>
            <div class="tgame-chips">${groupChips("sessions", "ses", "Toate", sessOpts)}</div>
          </div>` : ""}

          <div class="tgame-cfg-block">
            <div class="tgame-cfg-lab">Tipuri de itemi <span class="tgame-cfg-hint2">trage de ⠿ ca să stabilești ordinea</span></div>
            <div class="tgame-chips tgame-chips--tight">${G.availTypes.length ? chip("type", "all", "Toate", G.all.types, allRedundant("types") ? ` disabled title="Ai bifat deja tot — scurtătura n-are ce adăuga"` : "") : ""}</div>
            ${typeList()}
            ${G.availTypes.length ? "" : `<p class="tgame-cfg-hint">Categoriile se activează pe măsură ce profesorul marchează itemii.</p>`}
          </div>

          <div class="tgame-cfg-block">
            <div class="tgame-cfg-lab">Ordine</div>
            <div class="tgame-chips">${orderChips}</div>
          </div>
        </div>

        <aside class="tgame-cfg2__side">
          <div class="tgame-sum">
            <div class="tgame-sum__head">
              <span class="tgame-sum__em" aria-hidden="true">${esc(G.emoji)}</span>
              <div>
                <p class="tgame-sum__t">Sesiunea ta</p>
                <p class="tgame-sum__m">${isLoggedIn() ? "se salvează pe cont" : "conectează-te ca s-o poți relua"}</p>
              </div>
            </div>
            <div class="tgame-ems">${emojiChips}</div>
            <input class="tgame-nameinput" id="tgame-label" maxlength="40" placeholder="nume (ex. recapitulare sintaxă)" value="${esc(G.label)}" />
            ${funnel()}
            <button type="button" class="tgame-btn tgame-btn--primary tgame-btn--lg tgame-sum__go" data-act="start"${n ? "" : " disabled"}>
              Începe cu ${n} ${n === 1 ? "item" : "itemi"} ▸
            </button>
          </div>
        </aside>
      </div>
    </section>`;
  wireTypeDrag();
}

// Pointer-based drag (works with mouse AND touch, unlike HTML5 drag events).
// The DOM is reordered live; on release the new order is read back.
function wireTypeDrag() {
  const list = root.querySelector("#tgame-tl");
  if (!list) return;
  let row = null;
  list.addEventListener("pointerdown", (e) => {
    const grip = e.target.closest(".tgame-tl__grip");
    if (!grip) return;
    const li = grip.closest(".tgame-tl__row");
    if (!li || li.classList.contains("is-empty")) return;
    row = li;
    row.classList.add("is-dragging");
    grip.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  list.addEventListener("pointermove", (e) => {
    if (!row) return;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".tgame-tl__row");
    if (!over || over === row || over.classList.contains("is-empty") || over.parentElement !== list) return;
    const r = over.getBoundingClientRect();
    list.insertBefore(row, e.clientY > r.top + r.height / 2 ? over.nextSibling : over);
  });
  const end = () => {
    if (!row) return;
    row.classList.remove("is-dragging");
    row = null;
    G.typeOrder = [...list.querySelectorAll(".tgame-tl__row[data-tcode]")].map((li) => li.dataset.tcode);
    // Ordering by hand only means something under „Ordinea mea" — and that
    // chip only exists once there are at least two types to order.
    if (G.typeOrder.length > 1) G.sel.order = "mine";
    renderConfig();
  };
  list.addEventListener("pointerup", end);
  list.addEventListener("pointercancel", end);
}

// ---------- GAME ----------
function startGame() {
  const items = matchingItems();
  if (!items.length) { showToast("Nu există itemi pentru selecția ta."); return; }
  G.sessionId = uuid();
  G.savedId = isLoggedIn() ? G.sessionId : null; // same id in both places
  G.queue = buildQueue(items);
  G.total = items.length;
  G.correct = 0; G.wrong = 0; G.points = 0;
  G.elapsedBase = 0;
  G.history = []; G.view = null; G.liveAnswered = false;
  G.inGame = true; G.startAt = Date.now(); G.itemStart = Date.now();
  persist();
  startTimer();
  renderGame();
}

function hud() {
  const pct = G.total ? Math.round((G.correct / G.total) * 100) : 0;
  return `
    <div class="tgame-hud">
      <div class="tgame-hud__top">
        <a class="tgame-back" href="#" data-act="quit">‹ Renunț</a>
        <span class="tgame-hud__tag" aria-hidden="true">${esc(G.emoji)}${G.label ? ` ${esc(G.label)}` : ""}</span>
        <span class="tgame-timer" id="tgame-timer">${fmtTime(elapsedSec())}</span>
      </div>
      <div class="tgame-progress"><div class="tgame-progress__fill" id="tgame-fill" style="width:${pct}%"></div>
        <span class="tgame-progress__txt" id="tgame-ptxt">${G.correct} / ${G.total}</span>
      </div>
      <div class="tgame-hud__stats">
        <span class="tgame-stat ok"><b id="tgame-ok">${G.correct}</b> corecte</span>
        <span class="tgame-stat no"><b id="tgame-no">${G.wrong}</b> greșite</span>
        <span class="tgame-stat pts"><b id="tgame-pts">${G.points}</b> puncte</span>
      </div>
    </div>`;
}

// Shared card chrome. Topic tags read as FULL names (discreet grey), and the
// ⟳ button re-reads the teacher's latest wording without touching the answer.
function cardHead(it) {
  const labels = (it.types || []).map((c) =>
    `<span class="tgame-typelab">${esc(TYPE_LABEL[c] || c)}</span>`).join("");
  return `
    ${labels ? `<div class="tgame-types">${labels}</div>` : ""}
    <div class="tgame-cardmeta">${it.year ?? ""}${it.session ? ` · ${esc(it.session)}` : ""}${it.itemNo != null ? ` · itemul ${it.itemNo}` : ""}
      <button type="button" class="tgame-mini" data-act="refresh-item" title="Actualizează textul itemului (răspunsul tău rămâne)" aria-label="Actualizează textul itemului">⟳</button>
      <button type="button" class="tgame-report" data-act="report-item" title="Semnalează o eroare de conținut">⚑ eroare</button>
    </div>`;
}

const optionsHtml = (it, render) =>
  OPTS.filter((k) => it.options?.[k] != null && it.options[k] !== "").map((k) => render(k)).join("");

// Where we are on the strip of answered items (+ the live one at the end).
function navState() {
  const h = G.history.length;
  const liveIdx = G.liveAnswered ? h - 1 : h; // the live card IS the last entry once answered
  const total = liveIdx + 1;
  const idx = G.view === null ? liveIdx : G.view;
  return { h, liveIdx, total, idx };
}

// Back walks over what you've already answered; forward only ever lands on an
// item you've solved — or returns you to the live one. You can never skip ahead.
function navBar() {
  const { total, idx, liveIdx } = navState();
  if (total < 2) return "";
  return `<div class="tgame-nav">
      <button type="button" class="tgame-mini" data-act="prev-item"${idx > 0 ? "" : " disabled"} title="Itemul anterior" aria-label="Itemul anterior">‹</button>
      <span class="tgame-nav__pos">${idx + 1} / ${total}</span>
      <button type="button" class="tgame-mini" data-act="next-item"${idx < liveIdx ? "" : " disabled"} title="Itemul următor" aria-label="Itemul următor">›</button>
    </div>`;
}

function postBar(i) {
  const e = G.history[i];
  if (!e || !isLoggedIn()) return "";
  return `<div class="tgame-postbar">${e.posted
    ? `<span class="tgame-posted">✓ Postat pe pagina ta</span>`
    : `<button type="button" class="tgame-btn tgame-btn--sm" data-act="post-item" data-hi="${i}">📌 Postează pe pagina mea</button>`}</div>`;
}

// The live, unanswered item.
function renderLive() {
  if (!G.queue.length) return renderDone();
  const it = G.byId.get(G.queue[0]);
  const opts = optionsHtml(it, (k) => `
    <button type="button" class="tgame-opt" data-k="${k}">
      <span class="tgame-opt__k">${k}</span>
      <span class="tgame-opt__t">${sanitizeRich(it.options[k])}</span>
    </button>`);
  root.innerHTML = `
    <section class="tgame">
      ${hud()}
      <article class="tgame-card" data-id="${it.id}">
        ${cardHead(it)}
        <p class="tgame-q">${it.question ? sanitizeRich(it.question) : "<em>(enunț indisponibil)</em>"}</p>
        <div class="tgame-opts">${opts || `<span class="tgame-empty">(variante indisponibile)</span>`}</div>
        <div class="tgame-fb" hidden></div>
        <div class="tgame-next" hidden><button type="button" class="tgame-btn tgame-btn--primary" data-act="next">Continuă ▸</button></div>
        ${navBar()}
      </article>
    </section>`;
}

// An item that's already been answered — read-only, so no second attempt and
// no second helping of points. `isLive` adds the „Continuă" button.
function renderAnswered(i, isLive) {
  const e = G.history[i];
  if (!e) return renderLive();
  const it = G.byId.get(e.id) || { options: {} };
  const opts = optionsHtml(it, (k) => {
    const cls = k === e.correctAnswer ? " opt-correct" : (k === e.chosen && !e.correct ? " opt-wrong" : "");
    return `
    <button type="button" class="tgame-opt${cls}" disabled>
      <span class="tgame-opt__k">${k}</span>
      <span class="tgame-opt__t">${sanitizeRich(it.options[k])}</span>
    </button>`;
  });
  root.innerHTML = `
    <section class="tgame">
      ${hud()}
      <article class="tgame-card ${e.correct ? "is-correct" : "is-wrong"}${isLive ? "" : " is-review"}" data-id="${e.id}" data-hi="${i}" data-done="1">
        ${cardHead(it)}
        <p class="tgame-q">${it.question ? sanitizeRich(it.question) : ""}</p>
        <div class="tgame-opts">${opts}</div>
        <div class="tgame-fb">
          <div class="tgame-verdict ${e.correct ? "ok" : "no"}">${e.correct ? "✓ Corect" : `✗ Greșit — corect era <b>${esc(e.correctAnswer)}</b>`}</div>
          ${e.historical ? `<div class="tgame-hist">Pe gramatica veche, răspunsul era <b>${esc(e.historical)}</b>.</div>` : ""}
          ${e.observation ? `<div class="tgame-obs"><span class="tgame-obs__lab">Observație</span>${sanitizeRich(e.observation)}</div>` : ""}
          ${postBar(i)}
        </div>
        ${isLive ? `<div class="tgame-next"><button type="button" class="tgame-btn tgame-btn--primary" data-act="next">Continuă ▸</button></div>` : ""}
        ${navBar()}
      </article>
    </section>`;
}

// One entry point: review, answered-live, or fresh live.
function renderGame() {
  if (G.view !== null) return renderAnswered(G.view, false);
  if (G.liveAnswered && G.history.length) return renderAnswered(G.history.length - 1, true);
  return renderLive();
}

function goTo(newIdx) {
  const { total, liveIdx } = navState();
  if (newIdx < 0 || newIdx >= total) return;
  G.view = newIdx === liveIdx ? null : newIdx;
  renderGame();
}

function updateHud() {
  const set = (id, v) => { const el = root.querySelector("#" + id); if (el) el.textContent = v; };
  set("tgame-ok", G.correct); set("tgame-no", G.wrong); set("tgame-pts", G.points);
  set("tgame-ptxt", `${G.correct} / ${G.total}`);
  const fill = root.querySelector("#tgame-fill");
  if (fill) fill.style.width = (G.total ? Math.round((G.correct / G.total) * 100) : 0) + "%";
}

async function submit(btn) {
  const card = btn.closest(".tgame-card");
  if (!card || card.dataset.done) return;
  const id = card.dataset.id, k = btn.dataset.k;
  card.querySelectorAll(".tgame-opt").forEach((b) => (b.disabled = true));
  card.classList.add("is-checking");
  const res = await answerTestItem(id, k, G.sessionId);
  card.classList.remove("is-checking");
  if (!res) {
    showToast("Nu am putut verifica acum. Încearcă din nou.");
    card.querySelectorAll(".tgame-opt").forEach((b) => (b.disabled = false));
    return;
  }
  card.dataset.done = "1";
  card.dataset.correct = res.correct ? "1" : "0";
  if (res.correct) { G.correct++; G.points += res.points || 0; } else { G.wrong++; }

  // Close the book on this attempt: what the server revealed is kept locally,
  // so reviewing it later never asks again (and never re-awards points).
  G.history.push({
    id, chosen: k,
    correct: !!res.correct,
    correctAnswer: res.correctAnswer || "",
    observation: res.observation || "",
    historical: res.historical || "",
    points: res.awarded ? (res.points || 0) : 0,
    ms: Math.max(0, Date.now() - G.itemStart),
  });
  G.liveAnswered = true;

  card.classList.add(res.correct ? "is-correct" : "is-wrong");
  card.querySelectorAll(".tgame-opt").forEach((b) => {
    if (b.dataset.k === res.correctAnswer) b.classList.add("opt-correct");
    if (b.dataset.k === k && !res.correct) b.classList.add("opt-wrong");
  });

  const hist = res.historical ? `<div class="tgame-hist">Pe gramatica veche, răspunsul era <b>${esc(res.historical)}</b>.</div>` : "";
  const fb = card.querySelector(".tgame-fb");
  fb.hidden = false;
  fb.innerHTML = `
    <div class="tgame-verdict ${res.correct ? "ok" : "no"}">${res.correct ? "✓ Corect" : `✗ Greșit — corect era <b>${esc(res.correctAnswer)}</b>`}</div>
    ${hist}
    ${res.observation ? `<div class="tgame-obs"><span class="tgame-obs__lab">Observație</span>${sanitizeRich(res.observation)}</div>` : ""}
    ${postBar(G.history.length - 1)}`;
  card.querySelector(".tgame-next").hidden = false;
  const nav = card.querySelector(".tgame-nav");
  if (nav) nav.outerHTML = navBar(); // the strip grew by one

  updateHud();
  if (res.correct) { burstConfetti(card); if (res.awarded) floatPoints(res.points); }
  else wrongFx(card);
}

function advance() {
  const last = G.history[G.history.length - 1];
  const id = G.queue.shift();
  if (!(last && last.correct) && id != null) G.queue.push(id); // wrong → back of the queue
  G.liveAnswered = false;
  G.view = null;
  G.itemStart = Date.now();
  persist(); // progress is safe from here on
  if (!G.queue.length) return renderDone();
  renderGame();
}

// ---------- refresh one item's text ----------
// The teacher fixes a word mid-game → pull the new WORDING only. The answer
// already picked, the verdict and the score are untouched.
async function refreshItem(card) {
  const id = card?.dataset.id;
  if (!id || card.dataset.refreshing) return;
  card.dataset.refreshing = "1";
  const btn = card.querySelector('[data-act="refresh-item"]');
  btn?.classList.add("is-spinning");
  const fresh = await fetchTestItem(id);
  btn?.classList.remove("is-spinning");
  delete card.dataset.refreshing;
  if (!fresh) { showToast("N-am putut actualiza itemul acum."); return; }
  const old = G.byId.get(id);
  if (old) {
    old.question = fresh.question;
    old.options = fresh.options;
    old.observation = fresh.observation;
    old.types = fresh.types;
  } else G.byId.set(id, fresh);
  // Entries already answered carry their own copy of the explanation.
  if (fresh.observation) for (const e of G.history) if (e.id === id) e.observation = fresh.observation;
  renderGame();
  showToast("Item actualizat ✓");
}

// ---------- post an item on my page ----------
const AUDIENCES = [
  ["public", "🌐 Public", "oricine, chiar și fără cont"],
  ["members", "🎓 Elevii cu cont", "doar cine e conectat"],
  ["friends", "👥 Prietenii mei", "doar prietenii din listă"],
  ["private", "🔒 Doar eu", "însemnare personală"],
];

// Posts store plain text (escaped at render), so the item's rich markup is
// flattened here rather than shipped as tags.
function itemPostText(e) {
  const it = G.byId.get(e.id) || { options: {} };
  const head = `📘 Item admitere drept${it.year ? ` · ${it.year}` : ""}${it.session ? ` · ${it.session}` : ""}${it.itemNo != null ? ` · itemul ${it.itemNo}` : ""}`;
  const opts = OPTS.filter((k) => it.options?.[k] != null && it.options[k] !== "")
    .map((k) => `${k}) ${plain(it.options[k])}`).join("\n");
  const obs = e.observation ? `\n\n💡 ${plain(e.observation)}` : "";
  return `${head}\n\n${plain(it.question)}\n\n${opts}\n\n✅ Răspuns corect: ${e.correctAnswer}${obs}`;
}

function askAudience(onPick) {
  if (document.querySelector(".tgame-modal")) return;
  const back = document.createElement("div");
  back.className = "tgame-modal";
  back.innerHTML = `
    <div class="tgame-modal__card tgame-modal__card--wide" role="dialog" aria-modal="true" aria-label="Cine vede postarea?">
      <h3 class="tgame-modal__title">Cine vede postarea?</h3>
      <div class="tgame-audlist">
        ${AUDIENCES.map(([k, label, hint]) =>
          `<button type="button" class="tgame-audopt" data-aud="${k}"><b>${label}</b><span>${hint}</span></button>`).join("")}
      </div>
      <div class="tgame-modal__actions"><button type="button" class="tgame-btn" data-modal="cancel">Renunț</button></div>
    </div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.addEventListener("click", (ev) => {
    if (ev.target === back || ev.target.closest("[data-modal=cancel]")) return close();
    const pick = ev.target.closest("[data-aud]");
    if (pick) { close(); onPick(pick.dataset.aud); }
  });
  document.addEventListener("keydown", function esc3(ev) {
    if (ev.key === "Escape") { close(); document.removeEventListener("keydown", esc3); }
  });
}

function postItem(i) {
  const e = G.history[i];
  if (!e || e.posted || !isLoggedIn()) return;
  askAudience(async (audience) => {
    const row = await createPost({ type: "resursa", audience, text: itemPostText(e), surface: "wall" });
    if (!row) { showToast("N-am putut posta acum. Încearcă din nou."); return; }
    e.posted = true;
    showToast("📌 Postat pe pagina ta.");
    renderGame();
  });
}

// ---------- results chart ----------
function detailHtml(i) {
  const e = G.history[i];
  if (!e) return "";
  const it = G.byId.get(e.id) || { options: {} };
  const tags = (it.types || []).map((c) => `<span class="tgame-typelab">${esc(TYPE_LABEL[c] || c)}</span>`).join("");
  return `
    <p class="tgc-detail__meta">itemul ${i + 1} din ${G.history.length} · ${e.correct ? "✓ corect" : "✗ greșit"} · ${fmtSec(e.ms)}${e.points ? ` · +${e.points} puncte` : ""}</p>
    ${tags ? `<div class="tgame-types">${tags}</div>` : ""}
    <p class="tgc-detail__q">${it.question ? sanitizeRich(it.question) : ""}</p>
    <p class="tgc-detail__a">Ai bifat <b>${esc(e.chosen)}</b>${e.correct ? "" : ` — corect era <b>${esc(e.correctAnswer)}</b>`}</p>
    ${e.observation ? `<div class="tgame-obs"><span class="tgame-obs__lab">Observație</span>${sanitizeRich(e.observation)}</div>` : ""}`;
}

function resultsChart() {
  const h = G.history;
  if (!h.length) return "";
  const times = h.map((e) => e.ms);
  const maxMs = Math.max(...times, 1);
  const avgMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const fastest = h.reduce((a, b) => (b.ms < a.ms ? b : a));
  const bars = h.map((e, i) => `
    <button type="button" class="tgc-bar${e.correct ? " ok" : " no"}" data-hi="${i}"
      style="height:${Math.max(6, Math.round((e.ms / maxMs) * 100))}%"
      aria-label="Itemul ${i + 1}: ${e.correct ? "corect" : "greșit"}, ${fmtSec(e.ms)}"></button>`).join("");
  const stat = (v, l) => `<div class="tgc-stat"><b>${v}</b><span>${l}</span></div>`;
  return `
    <div class="tgc">
      <div class="tgc-stats">
        ${stat(G.correct, "corecte")}
        ${stat(G.wrong, "greșite")}
        ${stat(fmtSec(avgMs), "timp mediu")}
        ${stat(fmtSec(fastest.ms), "cel mai rapid")}
        ${stat(G.points, "puncte")}
      </div>
      <p class="tgc-hint">Fiecare bară e un răspuns, iar înălțimea ei e timpul de gândire. Treci peste ea (sau cu Tab) ca să vezi itemul.</p>
      <div class="tgc-plot">
        <div class="tgc-avgline" style="bottom:${Math.round((avgMs / maxMs) * 100)}%"><span>media ${fmtSec(avgMs)}</span></div>
        <div class="tgc-bars">${bars}</div>
      </div>
      <div class="tgc-detail" id="tgc-detail">${detailHtml(0)}</div>
    </div>`;
}

// ---------- DONE ----------
function renderDone() {
  stopTimer();
  G.inGame = false;
  const time = fmtTime(elapsedSec());
  // Finished sessions don't belong in „continuă" any more. Cleaned up in the
  // background so the celebration screen never waits on the network.
  if (G.savedId) {
    const done = G.savedId;
    G.savedId = null;
    G.saved = G.saved.filter((s) => s.id !== done);
    deleteTestSession(done);
  }
  root.innerHTML = `
    <section class="tgame tgame-done">
      <div class="tgame-done__badge" aria-hidden="true">✓</div>
      <h2 class="tgame-done__title">Gata! Ai rezolvat corect toți itemii.</h2>
      <p class="tgame-done__stats"><b>${G.total}</b> itemi · <b class="ok">${G.correct}</b> corecte · <b class="no">${G.wrong}</b> greșite · <b class="pts">${G.points}</b> puncte · timp <b>${time}</b></p>
      ${resultsChart()}
      <div class="tgame-done__actions">
        <button type="button" class="tgame-btn tgame-btn--primary" data-act="again">Încă o dată</button>
        <button type="button" class="tgame-btn" data-act="config">Altă configurație</button>
      </div>
    </section>`;
  burstConfetti(root.querySelector(".tgame-done__badge") || root);
}

// ---------- timer ----------
function startTimer() {
  stopTimer();
  G.timer = setInterval(() => {
    const el = root && root.querySelector("#tgame-timer");
    if (el) el.textContent = fmtTime(elapsedSec());
  }, 1000);
}
function stopTimer() { if (G.timer) { clearInterval(G.timer); G.timer = null; } }

// ---------- effects ----------
const CONFETTI_COLORS = ["#7c3aed", "#16a34a", "#f59e0b", "#2563eb", "#db2777", "#06b6d4"];
function burstConfetti(fromEl) {
  const r = (fromEl || root).getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + Math.min(r.height / 2, 140);
  const layer = document.createElement("div");
  layer.className = "tgame-confetti";
  for (let i = 0; i < 40; i++) {
    const p = document.createElement("i");
    const ang = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 170;
    p.style.cssText =
      `left:${cx}px;top:${cy}px;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};` +
      `--dx:${(Math.cos(ang) * dist).toFixed(0)}px;--dy:${(Math.sin(ang) * dist - 130).toFixed(0)}px;` +
      `--rot:${(Math.random() * 720 - 360).toFixed(0)}deg;--d:${(650 + Math.random() * 550).toFixed(0)}ms`;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1400);
}

function floatPoints(pts) {
  const anchor = root.querySelector("#tgame-pts");
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  const f = document.createElement("span");
  f.className = "tgame-ptsfloat";
  f.textContent = `+${pts}`;
  f.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top}px;`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1100);
}

function wrongFx(card) {
  const wrap = root.querySelector(".tgame") || root;
  card.classList.add("tgame-shake");
  wrap.classList.add("tgame-quake");
  setTimeout(() => { card.classList.remove("tgame-shake"); wrap.classList.remove("tgame-quake"); }, 650);
  // a copy of the card flies into the „greșite" counter
  const target = root.querySelector("#tgame-no");
  if (!target) return;
  const cr = card.getBoundingClientRect(), tr = target.getBoundingClientRect();
  const ghost = card.cloneNode(true);
  ghost.className = "tgame-card tgame-ghost is-wrong";
  ghost.style.cssText = `position:fixed;left:${cr.left}px;top:${cr.top}px;width:${cr.width}px;height:${cr.height}px;margin:0;`;
  document.body.appendChild(ghost);
  requestAnimationFrame(() => {
    const dx = (tr.left + tr.width / 2) - (cr.left + cr.width / 2);
    const dy = (tr.top + tr.height / 2) - (cr.top + cr.height / 2);
    ghost.style.transform = `translate(${dx.toFixed(0)}px,${dy.toFixed(0)}px) scale(0.04) rotate(-10deg)`;
    ghost.style.opacity = "0";
  });
  setTimeout(() => ghost.remove(), 700);
}

// styled „leave?" confirmation (in-app; the browser guards a real refresh/close)
function confirmLeave(onYes) {
  if (document.querySelector(".tgame-modal")) return;
  const kept = !!G.savedId;
  const back = document.createElement("div");
  back.className = "tgame-modal";
  back.innerHTML = `
    <div class="tgame-modal__card" role="dialog" aria-modal="true" aria-label="Părăsești jocul?">
      <div class="tgame-modal__icon" aria-hidden="true">${kept ? "💾" : "!"}</div>
      <h3 class="tgame-modal__title">Părăsești antrenamentul?</h3>
      <p class="tgame-modal__text">${kept
        ? `Sesiunea ${esc(G.emoji)} rămâne salvată — o reiei de unde ai rămas.`
        : "Progresul din această sesiune se pierde."}</p>
      <div class="tgame-modal__actions">
        <button type="button" class="tgame-btn" data-modal="cancel">Rămân</button>
        <button type="button" class="tgame-btn tgame-btn--danger" data-modal="yes">${kept ? "Salvez și ies" : "Părăsesc"}</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.addEventListener("click", (e) => {
    if (e.target === back || e.target.closest("[data-modal=cancel]")) return close();
    if (e.target.closest("[data-modal=yes]")) { close(); onYes(); }
  });
  document.addEventListener("keydown", function esc2(ev) {
    if (ev.key === "Escape") { close(); document.removeEventListener("keydown", esc2); }
  });
}

// ---------- events ----------
function onInput(e) {
  if (e.target.id === "tgame-label") G.label = e.target.value.slice(0, 40); // no re-render: keeps focus
}

function onBarPeek(e) {
  const bar = e.target.closest?.(".tgc-bar");
  if (!bar) return;
  const panel = root.querySelector("#tgc-detail");
  if (panel) panel.innerHTML = detailHtml(Number(bar.dataset.hi));
  root.querySelectorAll(".tgc-bar.on").forEach((b) => b.classList.remove("on"));
  bar.classList.add("on");
}

function onClick(e) {
  const year = e.target.closest("[data-year]");
  if (year) { pickGroup("years", year.dataset.year); return renderConfig(); }
  const ses = e.target.closest("[data-ses]");
  if (ses) { pickGroup("sessions", ses.dataset.ses); return renderConfig(); }
  const type = e.target.closest("[data-type]");
  if (type) { pickGroup("types", type.dataset.type); return renderConfig(); }
  const order = e.target.closest("[data-order]");
  if (order) { G.sel.order = order.dataset.order; return renderConfig(); }
  const em = e.target.closest("[data-emoji]");
  if (em) { G.emoji = em.dataset.emoji; return renderConfig(); }

  const act = e.target.closest("[data-act]");
  if (act) {
    const a = act.dataset.act;
    if (a === "home") { e.preventDefault(); stopTimer(); location.hash = ""; return; }
    if (a === "quit") {
      e.preventDefault();
      return confirmLeave(async () => {
        persist();
        G.inGame = false; stopTimer();
        await refreshSaved();
        renderConfig();
      });
    }
    if (a === "start" || a === "again") return startGame();
    if (a === "config") return renderConfig();
    if (a === "next") return advance();
    if (a === "prev-item") return goTo(navState().idx - 1);
    if (a === "next-item") return goTo(navState().idx + 1);
    if (a === "refresh-item") return refreshItem(e.target.closest(".tgame-card"));
    if (a === "post-item") return postItem(Number(act.dataset.hi));
    if (a === "resume") return resumeSession(act.dataset.id);
    if (a === "drop-session") {
      const id = act.dataset.id;
      deleteTestSession(id);
      G.saved = G.saved.filter((s) => s.id !== id);
      showToast("Sesiune ștearsă.");
      return renderConfig();
    }
    if (a === "report-item") {
      const card = e.target.closest(".tgame-card");
      if (card?.dataset.id && !card.dataset.reported) {
        card.dataset.reported = "1";
        reportContent("test_item", card.dataset.id);
        showToast("⚑ Mulțumim — profesorul verifică itemul.");
      }
      return;
    }
  }

  const opt = e.target.closest(".tgame-opt");
  if (opt && !opt.disabled) return submit(opt);
}

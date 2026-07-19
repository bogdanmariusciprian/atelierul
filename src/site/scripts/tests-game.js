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
  fetchMyTestSessions, saveTestSession, deleteTestSession, reportTestItem,
  useBooster, fetchBoosters, revealObservation,
} from "../../shared/scripts/test-repo.js";
import { initBonus, maybeSpawn, clearBonus } from "./bonus.js";
import { createPost } from "../../shared/scripts/forum-repo.js";
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
  sel: {
    years: new Set(), sessions: new Set(), types: new Set(), order: "random",
    // invatare = verdict now, misses come back · examen = mute, one pass
    // clasic   = 3 lives + flying bonuses · provocare = one life, no help
    mode: "invatare",
    limit: 0, // seconds allowed per item; 0 = no clock
  },
  all: { years: true, sessions: true, types: true },
  fx: { sound: true, vibrate: true },
  lives: 0, boosters: {}, cut: [], // cut = letters a booster hid on this item
  typeOrder: [], // the pupil's drag order → playing order under „Ordinea mea"
  emoji: EMOJIS[0], label: "",
  saved: [], savedId: null,
  sessionId: null, queue: [],
  // Every answer given this sitting, in order — powers the back/forward
  // review AND the results chart. Each entry is a closed book: it keeps the
  // answer the server revealed, so revisiting never re-asks the server.
  history: [], view: null, liveAnswered: false, itemStart: 0,
  reported: new Set(), // items already flagged this sitting (survives re-renders)
  total: 0, correct: 0, wrong: 0, points: 0,
  inGame: false, startAt: 0, elapsedBase: 0, timer: null,
  itemTimer: null, over: false, pausedAt: 0, // over = „fără greșeli" ended the run early
};

const elapsedSec = () => G.elapsedBase + Math.floor((Date.now() - G.startAt) / 1000);
const fmtSec = (ms) => `${(ms / 1000).toFixed(1)}s`;
const isExam = () => G.sel.mode === "examen";
const isClassic = () => G.sel.mode === "clasic";
// Lives belong to the MODE, so there's never a contradictory combination.
const MAX_LIVES = 4;
const livesFor = (mode) => (mode === "clasic" ? 3 : mode === "provocare" ? 1 : 0);
const BOOSTERS = {
  cut1: { icon: "➖", label: "Taie o variantă" },
  cut2: { icon: "✂️", label: "Taie două variante" },
  peek: { icon: "💡", label: "Explicația, 5 secunde" },
  life: { icon: "❤️", label: "+1 viață" },
};

// ---------- feel: sound + haptics (synthesised, so nothing to download) ----------
const FX_KEY = "tgame:fx";
const PACE_KEY = "tgame:pace";
let audioCtx = null;
function loadFx() {
  try { Object.assign(G.fx, JSON.parse(localStorage.getItem(FX_KEY) || "{}")); } catch { /* keep defaults */ }
}
function saveFx() {
  try { localStorage.setItem(FX_KEY, JSON.stringify(G.fx)); } catch { /* private mode */ }
}
function beep(kind) {
  if (!G.fx.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "triangle";
    o.connect(g); g.connect(audioCtx.destination);
    if (kind === "ok") { o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(990, t + 0.08); }
    else if (kind === "no") { o.frequency.setValueAtTime(230, t); o.frequency.setValueAtTime(150, t + 0.12); }
    else o.frequency.setValueAtTime(520, t); // neutral tick — exam mode must not leak the verdict
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.start(t); o.stop(t + 0.28);
  } catch { /* sound is a nicety, never a blocker */ }
}
function buzz(pattern) {
  if (!G.fx.vibrate || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}

// The pupil's own pace, remembered between sittings, so „≈ N minute" means
// something instead of being a guess.
function avgMsPerItem() {
  const v = Number(localStorage.getItem(PACE_KEY)) || 0;
  return v > 2000 ? v : 30000;
}
function rememberPace() {
  if (!G.history.length) return;
  const avg = G.history.reduce((a, e) => a + e.ms, 0) / G.history.length;
  const prev = Number(localStorage.getItem(PACE_KEY)) || avg;
  try { localStorage.setItem(PACE_KEY, String(Math.round(prev * 0.6 + avg * 0.4))); } catch { /* ignore */ }
}
const fmtMins = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 1 ? "sub un minut" : `≈ ${m} ${m === 1 ? "minut" : "minute"}`;
};

// ---------- entry ----------
export async function initTestGame(mountEl, exam) {
  root = mountEl;
  G.exam = exam;
  G.inGame = false;
  root.className = "tgame-wrap";
  loadFx(); // sound/haptics preference, remembered on this device
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
  // „Ți-am corectat itemul semnalat" → land on that item alone, no new game.
  const wanted = new URLSearchParams(location.search).get("item");
  if (wanted && G.byId.has(wanted)) return renderSingleItem(wanted);
  renderConfig();
}

// One item, read-only. The answer key is NOT shown: this is a „look what
// changed" view, not a shortcut around solving it.
function renderSingleItem(id) {
  const it = G.byId.get(id);
  const opts = optionsHtml(it, (k) => `
    <button type="button" class="tgame-opt" disabled>
      <span class="tgame-opt__k">${k}</span>
      <span class="tgame-opt__t">${sanitizeRich(it.options[k])}</span>
    </button>`);
  root.innerHTML = `
    <section class="tgame">
      <a class="tgame-back" href="#" data-act="config">‹ Înapoi la antrenament</a>
      <p class="tgame-single__note">✓ Profesorul a verificat itemul pe care l-ai semnalat. Așa arată acum.</p>
      <article class="tgame-card is-review" data-id="${it.id}">
        ${cardHead(it)}
        <p class="tgame-q">${it.question ? sanitizeRich(it.question) : ""}</p>
        <div class="tgame-opts">${opts}</div>
      </article>
      <div class="tgame-done__actions">
        <button type="button" class="tgame-btn tgame-btn--primary" data-act="config">Alege un antrenament ▸</button>
      </div>
    </section>`;
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
    mode: G.sel.mode, limit: G.sel.limit,
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
  G.sel.mode = c.mode || "invatare";
  G.sel.limit = Number(c.limit) || 0;
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
  G.history = []; G.view = null; G.liveAnswered = false; G.over = false;
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

// How many items each type contributes UNDER THE CURRENT year/session choice.
// The global tally decides which types exist at all; this one decides what the
// list shows, so the numbers here can never contradict the funnel.
function typeCountsNow() {
  const c = {};
  for (const it of G.items) {
    if (!matchYearSession(it)) continue;
    for (const t of it.types || []) c[t] = (c[t] || 0) + 1;
  }
  return c;
}

// RANK and QUANTITY are deliberately different visual languages: the rank is a
// small slot on the LEFT, welded to the drag handle (it reads as „position"),
// while the count sits right with its unit spelled out and a strength bar.
// Two bare numbers side by side were impossible to tell apart.
//
// The bar compares a type against the RICHEST type in the current pool, with a
// floor so a single item still shows a visible nub instead of nothing.
function typeList() {
  const counts = typeCountsNow();
  const max = Math.max(1, ...G.typeOrder.map((c) => counts[c] || 0));
  const locked = G.sel.order !== "mine"; // dragging only means something under „Ordinea mea"
  const qty = (n) => `
    <span class="tgame-tl__qty">
      <b>${n} ${n === 1 ? "item" : "itemi"}</b>
      <span class="tgame-tl__bar"><i style="width:${n ? Math.max(8, Math.round((n / max) * 100)) : 0}%"></i></span>
    </span>`;
  const rows = G.typeOrder.map((code, i) => {
    const n = counts[code] || 0;
    const on = !G.all.types && G.sel.types.has(code);
    return `<li class="tgame-tl__row${on ? " on" : ""}${n ? "" : " is-none"}" data-tcode="${esc(code)}">
        <span class="tgame-tl__grip"${locked ? "" : ` title="Trage ca să reordonezi"`} aria-hidden="true">⠿</span>
        <span class="tgame-tl__ord" title="Locul ${i + 1} în ordinea de joc">${i + 1}</span>
        <button type="button" class="tgame-tl__btn" data-type="${esc(code)}">${esc(TYPE_LABEL[code] || code)}</button>
        ${qty(n)}
      </li>`;
  }).join("");
  const missing = TEST_ITEM_TYPES.filter((t) => !(G.typeCounts[t.code] > 0)).map((t) =>
    `<li class="tgame-tl__row is-empty" title="Încă nu sunt itemi de acest tip">
       <span class="tgame-tl__grip" aria-hidden="true">⠿</span>
       <span class="tgame-tl__ord">·</span>
       <span class="tgame-tl__btn">${esc(t.label)}</span>
       <span class="tgame-tl__qty"><b>niciun item</b></span>
     </li>`).join("");
  return `
    ${locked ? `<p class="tgame-tl__hint">Alege <b>„Ordinea mea"</b> la Ordine ca să poți rearanja categoriile.</p>` : ""}
    <ul class="tgame-tl${locked ? " is-locked" : ""}" id="tgame-tl">${rows}${missing}</ul>`;
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
  const modeChips = [
    ["invatare", "📖 Învățare"], ["examen", "📝 Examen"],
    ["clasic", "❤️ Clasic"], ["provocare", "☠️ Provocare"],
  ].map(([v, l]) => chip("mode", v, l, G.sel.mode === v)).join("");
  const limitChips = [[0, "Fără"], [30, "30 s"], [60, "60 s"], [90, "90 s"]]
    .map(([v, l]) => chip("limit", String(v), l, G.sel.limit === v)).join("");
  // With a clock the run is predictable; without one we lean on your own pace.
  const estMs = G.sel.limit ? n * G.sel.limit * 1000 : n * avgMsPerItem();
  const emojiChips = EMOJIS.map((em) =>
    `<button type="button" class="tgame-em${em === G.emoji ? " on" : ""}" data-emoji="${em}" aria-label="Semn: ${em}">${em}</button>`).join("");

  root.innerHTML = `
    <section class="tgame-config tgame-cfg2 tstage tstage--cfg">
      <header class="tstage__top">
        <a class="tgame-back" href="#" data-act="home">‹ Înapoi</a>
        <div class="tgame-config__hero">
          <span class="tgame-config__badge" aria-hidden="true">⚖️</span>
          <div>
            <h2 class="tgame-config__title">Antrenament — Admitere Drept</h2>
            <p class="tgame-config__sub">Alege ce exersezi, apoi rezolvi câte un item pe rând.</p>
          </div>
        </div>
        ${savedStrip()}
      </header>

      <div class="tgame-cfg2__grid">
        <div class="tgame-cfg2__col">
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
            <div class="tgame-cfg-lab">Ordine</div>
            <div class="tgame-chips">${orderChips}</div>
          </div>

          <div class="tgame-cfg-block">
            <div class="tgame-cfg-lab">Timp pe item</div>
            <div class="tgame-chips">${limitChips}</div>
          </div>

          <div class="tgame-cfg-block tgame-cfg-block--grow">
            <div class="tgame-cfg-lab">Mod</div>
            <div class="tgame-chips">${modeChips}</div>
            <p class="tgame-cfg-hint">${{
              invatare: "Afli imediat dacă ai nimerit, iar explicația o deschizi când vrei tu. Itemii greșiți revin până îi rezolvi.",
              examen: "Răspunzi la tot fără să afli pe loc dacă ai nimerit; verdictele și explicațiile vin la final, ca la proba adevărată.",
              clasic: "Trei vieți, până la patru. Fiecare greșeală ia una. Din când în când trece o întrebare bonus: prinde-o, răspunde-i și câștigi un ajutor.",
              provocare: "O singură viață. Prima greșeală încheie runda — fără ajutoare, fără a doua șansă.",
            }[G.sel.mode]}</p>
          </div>
        </div>

        <div class="tgame-cfg2__col">
          <div class="tgame-cfg-block tgame-cfg-block--fill">
            <div class="tgame-cfg-lab">Tipuri de itemi</div>
            <div class="tgame-chips tgame-chips--tight">${G.availTypes.length ? chip("type", "all", "Toate", G.all.types, allRedundant("types") ? ` disabled title="Ai bifat deja tot — scurtătura n-are ce adăuga"` : "") : ""}</div>
            ${typeList()}
            ${G.availTypes.length ? "" : `<p class="tgame-cfg-hint">Categoriile se activează pe măsură ce profesorul marchează itemii.</p>`}
          </div>
        </div>

        <aside class="tgame-cfg2__col tgame-cfg2__side">
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
            <div class="tgame-sum__row">
              <span class="tgame-sum__est" title="${G.sel.limit ? "Din timpul pe care l-ai pus pe item" : "Din ritmul tău de până acum"}">⏱ ${n ? fmtMins(estMs) : "—"}</span>
              <span class="tgame-fx">
                <button type="button" class="tgame-fxbtn${G.fx.sound ? " on" : ""}" data-act="fx-sound" aria-label="Sunet" title="Sunet">${G.fx.sound ? "🔊" : "🔇"}</button>
                <button type="button" class="tgame-fxbtn${G.fx.vibrate ? " on" : ""}" data-act="fx-vibrate" aria-label="Vibrație" title="Vibrație">📳</button>
              </span>
            </div>
            <button type="button" class="tgame-btn tgame-btn--primary tgame-btn--lg tgame-sum__go" data-act="start"${n ? "" : " disabled"}>
              Începe cu ${n} ${n === 1 ? "item" : "itemi"} ▸
            </button>
          </div>
        </aside>
      </div>
    </section>`;
  wireTypeDrag();
}

// Drag to reorder — pointer events, so mouse and touch behave the same.
//   • the row LIFTS OUT of the list and floats over the page under the finger;
//   • the remaining rows slide apart to open a gap (FLIP: measure, move, animate);
//   • letting go anywhere outside the list cancels and the row flies home.
// Only wired under „Ordinea mea" — reordering a list nothing sorts by would be
// a lie, so elsewhere the handles are simply inert.
const DROP_PAD = 60; // how far outside the list still counts as „over" it
function wireTypeDrag() {
  const list = root.querySelector("#tgame-tl");
  if (!list || G.sel.order !== "mine") return;

  let st = null;
  const rows = () => [...list.querySelectorAll(".tgame-tl__row[data-tcode]")];

  // FLIP — remember where everyone is, reorder, then slide them from their old
  // spot to the new one so the gap opens smoothly instead of snapping.
  const flip = (mutate) => {
    const before = new Map(rows().map((r) => [r, r.getBoundingClientRect().top]));
    mutate();
    for (const r of rows()) {
      if (r === st?.row) continue; // the dragged row is hidden; the clone represents it
      const dy = before.get(r) - r.getBoundingClientRect().top;
      if (!dy) continue;
      r.style.transition = "none";
      r.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        r.style.transition = "transform 0.18s ease";
        r.style.transform = "";
      });
    }
  };

  const overList = (x, y) => {
    const b = list.getBoundingClientRect();
    return x >= b.left - DROP_PAD && x <= b.right + DROP_PAD
        && y >= b.top - DROP_PAD && y <= b.bottom + DROP_PAD;
  };

  list.addEventListener("pointerdown", (e) => {
    if (st) return;
    const grip = e.target.closest(".tgame-tl__grip");
    const row = grip?.closest(".tgame-tl__row");
    if (!row || !row.dataset.tcode) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);

    const r = row.getBoundingClientRect();
    const clone = row.cloneNode(true);
    clone.className = `tgame-tl__row tgame-tl__float${row.classList.contains("on") ? " on" : ""}`;
    clone.style.cssText = `left:${r.left}px; top:${r.top}px; width:${r.width}px;`;
    // Straight into <body>. A `position: fixed` box is only guaranteed to be
    // viewport-relative when NO ancestor establishes a containing block
    // (transform, filter, contain, will-change…). Parking it on <body> makes
    // the maths exact no matter what the page around it does later; the
    // console skin re-states the float's colours for this case.
    document.body.appendChild(clone);
    row.classList.add("is-ghost"); // keeps its space, so the list doesn't jump

    st = {
      row, clone,
      grabX: e.clientX - r.left, grabY: e.clientY - r.top,
      homeRect: r, homeNext: row.nextSibling,
    };
    document.body.classList.add("tgame-dragging");
  });

  list.addEventListener("pointermove", (e) => {
    if (!st) return;
    st.clone.style.left = `${e.clientX - st.grabX}px`;
    st.clone.style.top = `${e.clientY - st.grabY}px`;

    const inside = overList(e.clientX, e.clientY);
    st.clone.classList.toggle("is-out", !inside); // visual cue: this drop won't take
    if (!inside) return;

    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".tgame-tl__row");
    if (!over || over === st.row || !over.dataset.tcode || over.parentElement !== list) return;
    const b = over.getBoundingClientRect();
    flip(() => list.insertBefore(st.row, e.clientY > b.top + b.height / 2 ? over.nextSibling : over));
  });

  const finish = (cancelled) => {
    if (!st) return;
    const s = st;
    st = null;
    document.body.classList.remove("tgame-dragging");
    if (cancelled) list.insertBefore(s.row, s.homeNext); // back where it started
    const dest = cancelled ? s.homeRect : s.row.getBoundingClientRect();

    s.clone.classList.remove("is-out");
    s.clone.classList.add("is-landing");
    s.clone.style.left = `${dest.left}px`;
    s.clone.style.top = `${dest.top}px`;
    setTimeout(() => {
      s.clone.remove();
      s.row.classList.remove("is-ghost");
      for (const r of rows()) { r.style.transition = ""; r.style.transform = ""; }
      if (cancelled) return;
      G.typeOrder = rows().map((r) => r.dataset.tcode);
      renderConfig(); // repaint the rank slots
    }, 190);
  };

  list.addEventListener("pointerup", (e) => finish(!overList(e.clientX, e.clientY)));
  list.addEventListener("pointercancel", () => finish(true));
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
  G.history = []; G.view = null; G.liveAnswered = false; G.over = false;
  G.lives = livesFor(G.sel.mode); G.boosters = {}; G.cut = [];
  G.inGame = true; G.startAt = Date.now(); G.itemStart = Date.now();
  if (isClassic()) wireBonus();
  persist();
  startTimer();
  renderGame();
}

// The flying-bonus layer talks to the game through these four hooks. The
// clock hand-off matters most: engaging with a bonus must never cost you time
// on the item you're trying to win help for.
function wireBonus() {
  initBonus({
    sessionId: () => G.sessionId,
    onOpen: () => { stopItemClock(); G.pausedAt = Date.now(); },
    onClose: (note) => {
      if (G.pausedAt) { G.itemStart += Date.now() - G.pausedAt; G.pausedAt = 0; }
      if (note) showToast(note);
      startItemClock();
    },
    onBooster: async (kind) => {
      beep("ok"); buzz(30);
      showToast(`${BOOSTERS[kind].icon} Ai câștigat: ${BOOSTERS[kind].label}`, { kind: "success" });
      G.boosters = await fetchBoosters(G.sessionId);
      renderGame();
    },
  });
}

// In exam mode the HUD must stay mute: a live „corecte / greșite" tally would
// tell you the verdict the card is deliberately withholding.
function hudDone() { return isExam() ? G.history.length : G.correct; }

// Hearts: filled for what's left, hollow for what you've spent. The row grows
// to 4 if a booster pushed you past the starting three.
function hearts() {
  const start = livesFor(G.sel.mode);
  if (!start) return "";
  const cap = Math.max(start, G.lives);
  let out = "";
  for (let i = 0; i < cap; i++) out += i < G.lives ? "❤️" : "🖤";
  return `<span class="tgame-lives" title="${G.lives} ${G.lives === 1 ? "viață rămasă" : "vieți rămase"}">${out}</span>`;
}

// The satchel — tap one to spend it on the item in front of you.
function boosterBar() {
  if (!isClassic()) return "";
  const has = Object.entries(G.boosters).filter(([, q]) => q > 0);
  if (!has.length) return `<p class="tgame-boosters is-empty">Prinde o întrebare bonus ca să câștigi ajutoare.</p>`;
  return `<div class="tgame-boosters">${has.map(([k, q]) =>
    `<button type="button" class="tgame-booster" data-act="use-booster" data-kind="${k}" title="${esc(BOOSTERS[k].label)}">
       <span aria-hidden="true">${BOOSTERS[k].icon}</span><b>${q}</b>
     </button>`).join("")}</div>`;
}
function hud() {
  const exam = isExam();
  const pct = G.total ? Math.round((hudDone() / G.total) * 100) : 0;
  const stats = exam
    ? `<span class="tgame-stat"><b id="tgame-ok">${G.history.length}</b> din ${G.total} rezolvați</span>`
    : `<span class="tgame-stat ok"><b id="tgame-ok">${G.correct}</b> corecte</span>
       <span class="tgame-stat no"><b id="tgame-no">${G.wrong}</b> greșite</span>
       <span class="tgame-stat pts"><b id="tgame-pts">${G.points}</b> puncte</span>`;
  return `
    <div class="tgame-hud">
      <div class="tgame-hud__top">
        <a class="tgame-back" href="#" data-act="quit">‹ Renunț</a>
        <span class="tgame-hud__tag" aria-hidden="true">${esc(G.emoji)}${G.label ? ` ${esc(G.label)}` : ""}</span>
        <span class="tgame-timer" id="tgame-timer">${fmtTime(elapsedSec())}</span>
      </div>
      <div class="tgame-progress"><div class="tgame-progress__fill" id="tgame-fill" style="width:${pct}%"></div>
        <span class="tgame-progress__txt" id="tgame-ptxt">${hudDone()} / ${G.total}</span>
      </div>
      <div class="tgame-hud__stats">${stats}${hearts()}</div>
      ${boosterBar()}
    </div>`;
}

// Shared card chrome — ONE row: topic tags, then the item's coordinates, then
// the two actions. The question starts immediately under it, so nothing sits
// between the header and the text the pupil came to read.
function cardHead(it) {
  const labels = (it.types || []).map((c) =>
    `<span class="tgame-typelab">${esc(TYPE_LABEL[c] || c)}</span>`).join("");
  return `
    <div class="tgame-cardmeta">
      ${labels ? `<span class="tgame-types">${labels}</span>` : ""}
      <span class="tgame-cardmeta__id">${it.year ?? ""}${it.session ? ` · ${esc(it.session)}` : ""}${it.itemNo != null ? ` · itemul ${it.itemNo}` : ""}</span>
      <span class="tgame-cardmeta__acts">
        <button type="button" class="tgame-mini" data-act="refresh-item" title="Actualizează textul itemului (răspunsul tău rămâne)" aria-label="Actualizează textul itemului">⟳</button>
        ${G.reported.has(it.id)
          ? `<button type="button" class="tgame-report" disabled>⚑ semnalat</button>`
          : `<button type="button" class="tgame-report" data-act="report-item" title="Semnalează o eroare de conținut">⚑ eroare</button>`}
      </span>
    </div>`;
}

// ALWAYS four slots. An item with three options still reserves the fourth as
// an empty placeholder, so the block below never shifts from item to item.
const optionsHtml = (it, render) =>
  OPTS.map((k) => ((it.options?.[k] != null && it.options[k] !== "")
    ? render(k)
    : `<span class="tgame-opt tgame-opt--void" aria-hidden="true"></span>`)).join("");

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
  // A „taie o variantă" booster strikes wrong options out — it does NOT remove
  // the slot, so the block keeps its shape and you can see the help working.
  const opts = optionsHtml(it, (k) => G.cut.includes(k)
    ? `<span class="tgame-opt tgame-opt--cut" aria-hidden="true">
         <span class="tgame-opt__k">${k}</span><span class="tgame-opt__t">tăiată</span>
       </span>`
    : `<button type="button" class="tgame-opt" data-k="${k}">
         <span class="tgame-opt__k">${k}</span>
         <span class="tgame-opt__t">${sanitizeRich(it.options[k])}</span>
       </button>`);
  root.innerHTML = `
    <section class="tgame tstage tstage--play">
      <header class="tstage__top">
        ${hud()}
        ${G.sel.limit ? `<div class="tgame-clock"><i id="tgame-clock" style="width:100%"></i></div>` : ""}
      </header>
      <div class="tgame-play">
        <article class="tgame-card" data-id="${it.id}">
          ${cardHead(it)}
          <p class="tgame-q">${it.question ? sanitizeRich(it.question) : "<em>(enunț indisponibil)</em>"}</p>
          <div class="tgame-opts">${opts}</div>
          <footer class="tgame-cardfoot">
            ${navBar()}
            <div class="tgame-next" hidden><button type="button" class="tgame-btn tgame-btn--primary" data-act="next">Continuă ▸</button></div>
          </footer>
        </article>
        <aside class="tgame-side">
          <div class="tgame-fb">
            <p class="tgame-side__wait">Alege o variantă.<br />Verdictul apare aici.</p>
            ${G.sel.mode === "invatare" ? `
              <button type="button" class="tgame-obsbtn" data-act="peek-obs">Vezi explicația</button>
              <p class="tgame-side__note">Explicația arată raționamentul, nu varianta corectă. Pe aceea o afli după ce răspunzi.</p>` : ""}
          </div>
        </aside>
      </div>
    </section>`;
  startItemClock();
}

// An item that's already been answered — read-only, so no second attempt and
// no second helping of points. `isLive` adds the „Continuă" button.
function renderAnswered(i, isLive) {
  stopItemClock(); // a settled item is never on the clock
  const e = G.history[i];
  if (!e) return renderLive();
  const it = G.byId.get(e.id) || { options: {} };
  // Revisiting during an EXAM must stay as mute as the live card was: marking
  // the key here would hand over the answer the exam is withholding.
  const exam = isExam();
  const opts = optionsHtml(it, (k) => {
    const cls = exam
      ? (k === e.chosen ? " opt-picked" : "")
      : (k === e.correctAnswer ? " opt-correct" : (k === e.chosen && !e.correct ? " opt-wrong" : ""));
    return `
    <button type="button" class="tgame-opt${cls}" disabled>
      <span class="tgame-opt__k">${k}</span>
      <span class="tgame-opt__t">${sanitizeRich(it.options[k])}</span>
    </button>`;
  });
  const verdict = exam
    ? `<div class="tgame-verdict is-mute">Răspuns înregistrat${e.chosen && e.chosen !== "-" ? `: <b>${esc(e.chosen)}</b>` : " — n-ai apucat să bifezi"}</div>`
    : `<div class="tgame-verdict ${e.correct ? "ok" : "no"}">${e.correct ? "✓ Corect" : `✗ Greșit — corect era <b>${esc(e.correctAnswer)}</b>`}</div>
       ${e.historical ? `<div class="tgame-hist">Pe gramatica veche, răspunsul era <b>${esc(e.historical)}</b>.</div>` : ""}
       ${e.observation ? `<div class="tgame-obs"><span class="tgame-obs__lab">Observație</span>${sanitizeRich(e.observation)}</div>` : ""}
       ${postBar(i)}`;
  root.innerHTML = `
    <section class="tgame tstage tstage--play">
      <header class="tstage__top">${hud()}</header>
      <div class="tgame-play">
        <article class="tgame-card ${exam ? "" : (e.correct ? "is-correct" : "is-wrong")}${isLive ? "" : " is-review"}" data-id="${e.id}" data-hi="${i}" data-done="1">
          ${cardHead(it)}
          <p class="tgame-q">${it.question ? sanitizeRich(it.question) : ""}</p>
          <div class="tgame-opts">${opts}</div>
          <footer class="tgame-cardfoot">
            ${navBar()}
            ${isLive ? `<div class="tgame-next"><button type="button" class="tgame-btn tgame-btn--primary" data-act="next">Continuă ▸</button></div>` : ""}
          </footer>
        </article>
        <aside class="tgame-side">
          <div class="tgame-fb">${verdict}</div>
        </aside>
      </div>
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
  const wasLive = G.view === null;
  G.view = newIdx === liveIdx ? null : newIdx;
  const nowLive = G.view === null;
  // Reading an old item must not burn the current item's clock — pause it
  // while you're away and push the deadline back by exactly that long.
  if (wasLive && !nowLive) G.pausedAt = Date.now();
  else if (!wasLive && nowLive && G.pausedAt) { G.itemStart += Date.now() - G.pausedAt; G.pausedAt = 0; }
  renderGame();
}

function updateHud() {
  const set = (id, v) => { const el = root.querySelector("#" + id); if (el) el.textContent = v; };
  if (isExam()) set("tgame-ok", G.history.length);
  else { set("tgame-ok", G.correct); set("tgame-no", G.wrong); set("tgame-pts", G.points); }
  set("tgame-ptxt", `${hudDone()} / ${G.total}`);
  const fill = root.querySelector("#tgame-fill");
  if (fill) fill.style.width = (G.total ? Math.round((hudDone() / G.total) * 100) : 0) + "%";
}

async function submit(card, k) {
  if (!card || card.dataset.done) return;
  stopItemClock();
  const id = card.dataset.id;
  card.querySelectorAll(".tgame-opt").forEach((b) => (b.disabled = true));
  card.classList.add("is-checking");
  const res = await answerTestItem(id, k, G.sessionId);
  card.classList.remove("is-checking");
  if (!res) {
    showToast("Nu am putut verifica acum. Încearcă din nou.");
    card.querySelectorAll(".tgame-opt").forEach((b) => (b.disabled = false));
    startItemClock(); // give the clock back too
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

  const fb = root.querySelector(".tgame-fb"); // now lives in the side panel
  if (!fb) return;
  fb.hidden = false;

  if (isExam()) {
    // Nothing may leak in exam mode: no verdict, no key, no colours — and a
    // neutral tick, because even the sound would give the answer away.
    beep("tick"); buzz(15);
    fb.innerHTML = `<div class="tgame-verdict is-mute">Răspuns înregistrat · rezultatele vin la final</div>`;
  } else {
    card.classList.add(res.correct ? "is-correct" : "is-wrong");
    card.querySelectorAll(".tgame-opt").forEach((b) => {
      if (b.dataset.k === res.correctAnswer) b.classList.add("opt-correct");
      if (b.dataset.k === k && !res.correct) b.classList.add("opt-wrong");
    });
    const hist = res.historical ? `<div class="tgame-hist">Pe gramatica veche, răspunsul era <b>${esc(res.historical)}</b>.</div>` : "";
    fb.innerHTML = `
      <div class="tgame-verdict ${res.correct ? "ok" : "no"}">${res.correct ? "✓ Corect" : `✗ Greșit — corect era <b>${esc(res.correctAnswer)}</b>`}</div>
      ${hist}
      ${res.observation ? `
        <button type="button" class="tgame-obsbtn" data-act="show-obs">Vezi explicația</button>
        <div class="tgame-obs" hidden><span class="tgame-obs__lab">Observație</span>${sanitizeRich(res.observation)}</div>` : ""}
      ${postBar(G.history.length - 1)}`;
    if (res.correct) { beep("ok"); buzz(25); burstConfetti(card); if (res.awarded) floatPoints(res.points); }
    else { beep("no"); buzz([40, 60, 40]); wrongFx(card); }
  }

  // A miss costs a life in the modes that have them; at zero the run is over
  // and the satchel goes with it (the wallet is keyed to this session).
  if (!res.correct && livesFor(G.sel.mode) > 0) {
    G.lives = Math.max(0, G.lives - 1);
    buzz([70, 50, 70]);
    if (G.lives === 0) G.over = true;
  }

  const next = card.querySelector(".tgame-next");
  next.hidden = false;
  if (G.over) {
    const b = next.querySelector("[data-act=next]");
    if (b) b.textContent = "Vezi rezultatul ▸";
  }
  const nav = card.querySelector(".tgame-nav");
  if (nav) nav.outerHTML = navBar(); // the strip grew by one
  updateHud();
}

// ---------- boosters ----------
// The wallet lives on the server, so spending is authoritative: you can't use
// what you didn't win, and „peek" is the only route to an explanation before
// answering (the column itself is revoked).
async function spendBooster(kind) {
  if (!BOOSTERS[kind] || !(G.boosters[kind] > 0)) return;
  const card = root.querySelector(".tgame-card");
  if (kind !== "life") {
    if (!card || card.dataset.done) return showToast("Folosește ajutorul înainte să răspunzi.");
    if (kind === "cut1" || kind === "cut2") {
      const leftOptions = card.querySelectorAll(".tgame-opt").length;
      if (leftOptions <= 2) return showToast("Au mai rămas prea puține variante.");
    }
  }
  if (kind === "life" && G.lives >= MAX_LIVES) return showToast("Ai deja maximul de vieți.");

  const res = await useBooster(G.sessionId, kind, card?.dataset.id || null);
  if (!res || res.error) return showToast("Ajutorul nu s-a putut folosi.");
  G.boosters[kind] = Math.max(0, (G.boosters[kind] || 1) - 1);

  if (kind === "life") { G.lives = Math.min(MAX_LIVES, G.lives + 1); beep("ok"); buzz(30); return renderGame(); }
  if (kind === "peek") return peekObservation(res.observation);
  G.cut = Array.isArray(res.cut) ? res.cut.filter(Boolean) : [];
  beep("tick");
  renderGame();
}

// Five seconds of explanation, then it's gone — enough to grasp, not to copy.
function peekObservation(text) {
  if (!text) return showToast("Itemul ăsta n-are explicație scrisă.");
  const card = root.querySelector(".tgame-side") || root.querySelector(".tgame-card");
  if (!card) return;
  card.querySelector(".tgame-peek")?.remove();
  const box = document.createElement("div");
  box.className = "tgame-peek";
  box.innerHTML = `<span class="tgame-peek__lab">Explicația · 5 secunde</span>
    <div class="tgame-peek__txt">${sanitizeRich(text)}</div>
    <span class="tgame-peek__bar"><i></i></span>`;
  card.appendChild(box);
  beep("tick");
  setTimeout(() => box.remove(), 5000);
}

// ---------- per-item clock ----------
function startItemClock() {
  stopItemClock();
  if (!G.sel.limit || G.view !== null) return;
  const span = G.sel.limit * 1000;
  G.itemTimer = setInterval(() => {
    const left = G.itemStart + span - Date.now();
    const bar = root.querySelector("#tgame-clock");
    if (bar) {
      bar.style.width = `${Math.max(0, Math.min(100, (left / span) * 100))}%`;
      bar.parentElement.classList.toggle("is-low", left < span * 0.25);
    }
    if (left <= 0) {
      stopItemClock();
      const card = root.querySelector(".tgame-card");
      // A letter no option can match: the server closes the item and reveals
      // the key without awarding anything.
      if (card && !card.dataset.done) { buzz([60, 40, 60]); submit(card, "-"); }
    }
  }, 100);
}
function stopItemClock() { if (G.itemTimer) { clearInterval(G.itemTimer); G.itemTimer = null; } }

function advance() {
  const last = G.history[G.history.length - 1];
  const id = G.queue.shift();
  // In LEARNING mode a miss returns to the back of the queue until you get it.
  // In EXAM mode every item is asked exactly once, like the real paper.
  if (!isExam() && !(last && last.correct) && id != null) G.queue.push(id);
  G.liveAnswered = false;
  G.view = null;
  G.cut = []; // a fresh item comes with all its options back
  G.itemStart = Date.now();
  persist(); // progress is safe from here on
  if (G.over || !G.queue.length) return renderDone();
  renderGame();
  if (isClassic()) maybeSpawn(); // …and maybe something flies past
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
    // Only the wording travels — the explanation isn't part of a public fetch.
    old.question = fresh.question;
    old.options = fresh.options;
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

// Laid out in blocks, and the item's own formatting is CARRIED OVER: bold,
// italics and underline survive, because post bodies are now sanitised on read
// rather than flattened. Line breaks are plain „\n" — posts render pre-wrap.
function itemPostText(e) {
  const it = G.byId.get(e.id) || { options: {} };
  const coords = [it.year, it.session, it.itemNo != null ? `itemul ${it.itemNo}` : null]
    .filter(Boolean).join(" · ");
  const opts = OPTS
    .filter((k) => it.options?.[k] != null && it.options[k] !== "")
    .map((k) => `${k})  ${sanitizeRich(it.options[k])}`).join("\n");
  const parts = [
    "🏅 Item de admitere · Drept",
    coords,
    "",
    sanitizeRich(it.question),
    "",
    opts,
    "",
    `✅ Răspuns corect: ${e.correctAnswer}`,
    `🙋 Ce am răspuns: ${e.chosen && e.chosen !== "-" ? `${e.chosen} — ${e.correct ? "corect" : "greșit"}` : "n-am apucat să răspund"}`,
    `⭐ Puncte la acest item: ${e.points || 0}`,
  ];
  if (e.observation) parts.push("", "💡 Explicație", sanitizeRich(e.observation));
  return parts.join("\n");
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
    // „Reușită", not „Resursă": the pupil is sharing something they solved.
    // `generated` locks the body — this is a capture, not a draft.
    const row = await createPost({
      type: "reusita", audience, text: itemPostText(e), surface: "wall",
      generated: true, generatedFrom: G.exam, // frames it in this game's colour
    });
    if (!row) { showToast("N-am putut posta acum. Încearcă din nou."); return; }
    e.posted = true;
    showToast("📌 Postat pe pagina ta.");
    renderGame();
  });
}

// ---------- flag a content error ----------
// Which letter did the pupil pick on this card (if they'd answered yet)?
function chosenForCard(card) {
  const hi = card?.dataset.hi;
  if (hi != null && G.history[Number(hi)]) return G.history[Number(hi)].chosen;
  const last = G.history[G.history.length - 1];
  if (G.liveAnswered && last && last.id === card?.dataset.id) return last.chosen;
  return null;
}

// Guests report too — the RPC behind this accepts anonymous reports, they
// simply can't be replied to.
function askReport(card) {
  const id = card?.dataset.id;
  if (!id || G.reported.has(id)) return;
  if (document.querySelector(".tgame-modal")) return;
  const back = document.createElement("div");
  back.className = "tgame-modal";
  back.innerHTML = `
    <div class="tgame-modal__card tgame-modal__card--wide" role="dialog" aria-modal="true" aria-label="Semnalează o eroare">
      <h3 class="tgame-modal__title">Ce nu e în regulă la acest item?</h3>
      <p class="tgame-modal__text">Scrie pe scurt ce ai observat: o greșeală de tipar, un enunț neclar, un răspuns care ți se pare greșit…</p>
      <textarea class="tgame-reason" id="tgame-reason" rows="4" maxlength="500" placeholder="Explicația ta…"></textarea>
      <div class="tgame-modal__actions">
        <button type="button" class="tgame-btn" data-modal="cancel">Renunț</button>
        <button type="button" class="tgame-btn tgame-btn--primary" data-modal="send">Trimite semnalarea</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  const ta = back.querySelector("#tgame-reason");
  setTimeout(() => ta?.focus(), 30);
  const close = () => back.remove();
  back.addEventListener("click", async (ev) => {
    if (ev.target === back || ev.target.closest("[data-modal=cancel]")) return close();
    if (!ev.target.closest("[data-modal=send]")) return;
    const reason = (ta?.value || "").trim();
    if (!reason) { ta?.focus(); return showToast("Scrie pe scurt ce ai observat."); }
    close();
    const ok = await reportTestItem(id, reason, chosenForCard(card));
    if (!ok) return showToast("N-am putut trimite semnalarea. Încearcă din nou.");
    G.reported.add(id);
    const btn = card.querySelector('[data-act="report-item"]');
    if (btn) { btn.disabled = true; btn.removeAttribute("data-act"); btn.textContent = "⚑ semnalat"; }
    showToast("⚑ Mulțumim — profesorul verifică itemul.");
  });
  document.addEventListener("keydown", function esc4(ev) {
    if (ev.key === "Escape") { close(); document.removeEventListener("keydown", esc4); }
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
  stopItemClock();
  clearBonus();   // nothing keeps flying once the run is over
  rememberPace(); // your pace feeds the next run's estimate
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
    <section class="tgame tgame-done tstage tstage--done">
      <div class="tgame-done__badge" aria-hidden="true">${G.over ? "☠️" : "✓"}</div>
      <h2 class="tgame-done__title">${G.over
        ? "Ai pierdut seria — o greșeală a încheiat runda."
        : isExam() ? "Gata. Iată cum ai stat." : "Gata! Ai rezolvat corect toți itemii."}</h2>
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
  const mode = e.target.closest("[data-mode]");
  if (mode) { G.sel.mode = mode.dataset.mode; return renderConfig(); }
  const limit = e.target.closest("[data-limit]");
  if (limit) { G.sel.limit = Number(limit.dataset.limit) || 0; return renderConfig(); }
  const em = e.target.closest("[data-emoji]");
  if (em) { G.emoji = em.dataset.emoji; return renderConfig(); }

  const act = e.target.closest("[data-act]");
  if (act) {
    const a = act.dataset.act;
    if (a === "home") {
      e.preventDefault(); stopTimer();
      // Back to the category intro: drop BOTH #joc and any ?item= deep link.
      // (Clearing the hash alone does nothing when you arrived without one.)
      location.replace(location.pathname);
      return;
    }
    if (a === "quit") {
      e.preventDefault();
      return confirmLeave(async () => {
        persist();
        G.inGame = false; stopTimer(); stopItemClock(); clearBonus();
        await refreshSaved();
        renderConfig();
      });
    }
    if (a === "start" || a === "again") return startGame();
    if (a === "config") return renderConfig();
    if (a === "next") return advance();
    if (a === "fx-sound") { G.fx.sound = !G.fx.sound; saveFx(); if (G.fx.sound) beep("tick"); return renderConfig(); }
    if (a === "fx-vibrate") { G.fx.vibrate = !G.fx.vibrate; saveFx(); if (G.fx.vibrate) buzz(30); return renderConfig(); }
    if (a === "show-obs") {
      const box = act.parentElement?.querySelector(".tgame-obs");
      if (box) { box.hidden = false; act.remove(); }
      return;
    }
    if (a === "use-booster") return spendBooster(act.dataset.kind);
    if (a === "peek-obs") {
      const card = root.querySelector(".tgame-card");
      if (!card || card.dataset.done) return;
      revealObservation(card.dataset.id, G.sessionId).then((obs) => {
        const fb = root.querySelector(".tgame-fb");
        if (!fb) return;
        fb.innerHTML = obs
          ? `<div class="tgame-obs"><span class="tgame-obs__lab">Explicație</span>${sanitizeRich(obs)}</div>
             <p class="tgame-side__note">Acum alege varianta. Cea corectă ți se arată după ce răspunzi.</p>`
          : `<p class="tgame-side__wait">Itemul acesta n-are explicație scrisă.</p>`;
      });
      return;
    }
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
    if (a === "report-item") return askReport(e.target.closest(".tgame-card"));
  }

  const opt = e.target.closest(".tgame-opt");
  if (opt && !opt.disabled) return submit(opt.closest(".tgame-card"), opt.dataset.k);
}

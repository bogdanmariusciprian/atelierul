// =========================================================
// Teste → mini-game (PUPIL / GUEST). One item at a time, click an answer to
// submit, see the observation, keep going until every item is answered right.
//
// Flow:
//   1) CONFIG screen (no dropdowns — everything is tap-chips): pick years,
//      topic types, and the order (random / by year / by type). A live count
//      shows how many items match. „Începe" starts a session.
//   2) GAME: one item per screen with its type labels; click an option → the
//      SERVER decides (answer_test_item), reveals the correct letter + the
//      observation (always, right or wrong), and awards a few points once per
//      (item, session). A discreet elapsed timer + live corect/greșit counters.
//      A wrong item goes to the BACK of the queue and returns after the rest,
//      until it's answered correctly.
//   3) DONE: summary (items, corecte, greșite, time) + play again.
//
// CHEAT-SAFE: the answer key never ships — items are fetched without the
// `correct` columns; the only way to learn the answer is answer_test_item AFTER
// a choice is submitted. Points are awarded server-side only.
// =========================================================
import { fetchTestItems, answerTestItem, TEST_ITEM_TYPES } from "../../shared/scripts/test-repo.js";
import { sanitizeRich } from "../../shared/scripts/rich-text.js";
import { showToast } from "../../shared/scripts/toast.js";

const OPTS = ["A", "B", "C", "D"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TYPE_LABEL = Object.fromEntries(TEST_ITEM_TYPES.map((t) => [t.code, t.label]));
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

let root = null;
const G = {
  exam: null,
  items: [],                 // all published items for this exam
  byId: new Map(),
  years: [],                 // available years (desc)
  types: [],                 // available type codes present in the items
  sel: { years: new Set(), types: new Set(), order: "random" },
  sessionId: null,
  queue: [],                 // item ids still to answer (front = current)
  total: 0, correct: 0, wrong: 0,
  startAt: 0, timer: null,
};

// ---------- entry ----------
export async function initTestGame(mountEl, exam) {
  root = mountEl;
  G.exam = exam;
  root.className = "tgame-wrap";
  if (!root.__gameWired) { root.addEventListener("click", onClick); root.__gameWired = true; }
  root.innerHTML = `<div class="tgame-loading">Se încarcă itemii…</div>`;

  const items = await fetchTestItems({ exam }); // published only (RLS), all years
  G.items = items;
  G.byId = new Map(items.map((i) => [i.id, i]));
  G.years = [...new Set(items.map((i) => i.year).filter((y) => y != null))].sort((a, b) => b - a);
  const present = new Set();
  items.forEach((i) => (i.types || []).forEach((t) => present.add(t)));
  G.types = TEST_ITEM_TYPES.map((t) => t.code).filter((c) => present.has(c));
  // Default selection = everything.
  G.sel.years = new Set(G.years);
  G.sel.types = new Set(G.types);
  renderConfig();
}

// ---------- filtering / ordering ----------
function matchingItems() {
  return G.items.filter((it) => {
    if (G.sel.years.size && !G.sel.years.has(it.year)) return false;
    // Type filter only when types exist AND some are selected (empty = all).
    if (G.types.length && G.sel.types.size) {
      const its = it.types || [];
      if (!its.some((t) => G.sel.types.has(t))) return false;
    }
    return true;
  });
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQueue(items) {
  const arr = [...items];
  if (G.sel.order === "years") {
    arr.sort((a, b) => (b.year - a.year) || (a.itemNo - b.itemNo));
  } else if (G.sel.order === "types") {
    const firstType = (it) => (it.types || [])[0] || "￿";
    arr.sort((a, b) => firstType(a).localeCompare(firstType(b)) || (b.year - a.year) || (a.itemNo - b.itemNo));
  } else {
    shuffle(arr);
  }
  return arr.map((i) => i.id);
}

// ---------- CONFIG screen ----------
function renderConfig() {
  stopTimer();
  const n = matchingItems().length;
  const chip = (attr, val, label, on, title) =>
    `<button type="button" class="tgame-chip${on ? " on" : ""}" data-${attr}="${val}"${title ? ` title="${esc(title)}"` : ""}>${label}</button>`;

  const yearChips = chip("year", "all", "Toți anii", G.sel.years.size === G.years.length && G.years.length > 0)
    + G.years.map((y) => chip("year", y, y, G.sel.years.has(y))).join("");
  const typeBlock = G.types.length ? `
    <div class="tgame-cfg-block">
      <div class="tgame-cfg-lab">Tipuri de itemi</div>
      <div class="tgame-chips">
        ${chip("type", "all", "Toate", G.sel.types.size === G.types.length && G.types.length > 0)}
        ${G.types.map((c) => chip("type", c, esc(c), G.sel.types.has(c), TYPE_LABEL[c] || c)).join("")}
      </div>
    </div>` : "";
  const orderChips = [["random", "Aleatoriu"], ["years", "Pe ani"], ["types", "Pe tipuri"]]
    .map(([v, l]) => chip("order", v, l, G.sel.order === v)).join("");

  root.innerHTML = `
    <section class="tgame-config">
      <a class="tgame-back" href="#" data-act="home">‹ Toate testele</a>
      <h2 class="tgame-config__title">Configurează antrenamentul</h2>
      <p class="tgame-config__sub">Alege ce vrei să exersezi — poți selecta tot. Atinge ca să bifezi.</p>

      <div class="tgame-cfg-block">
        <div class="tgame-cfg-lab">Ani</div>
        <div class="tgame-chips">${yearChips}</div>
      </div>
      ${typeBlock}
      <div class="tgame-cfg-block">
        <div class="tgame-cfg-lab">Ordine</div>
        <div class="tgame-chips">${orderChips}</div>
      </div>

      <div class="tgame-cfg-foot">
        <span class="tgame-cfg-count"><b id="tgame-count">${n}</b> itemi selectați</span>
        <button type="button" class="tgame-btn tgame-btn--primary" data-act="start"${n ? "" : " disabled"}>Începe ▸</button>
      </div>
    </section>`;
}

// ---------- GAME ----------
function startGame() {
  const items = matchingItems();
  if (!items.length) { showToast("Nu există itemi pentru selecția ta."); return; }
  G.sessionId = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
  G.queue = buildQueue(items);
  G.total = items.length;
  G.correct = 0; G.wrong = 0;
  G.startAt = Date.now();
  startTimer();
  renderGame();
}

function scoreBar() {
  return `<a class="tgame-back" href="#" data-act="quit">‹ Renunț</a>
    <span class="tgame-timer" id="tgame-timer">${fmtTime(Math.floor((Date.now() - G.startAt) / 1000))}</span>
    <span class="tgame-score">
      <b class="ok">${G.correct}</b> corecte · <b class="no">${G.wrong}</b> greșite
      <span class="tgame-left">· ${G.queue.length} rămași</span>
    </span>`;
}

function renderGame() {
  if (!G.queue.length) return renderDone();
  const it = G.byId.get(G.queue[0]);
  const labels = (it.types || []).map((c) =>
    `<span class="tgame-typelab" title="${esc(TYPE_LABEL[c] || c)}">${esc(c)}</span>`).join("");
  const opts = OPTS.filter((k) => it.options[k] != null && it.options[k] !== "").map((k) => `
    <button type="button" class="tgame-opt" data-k="${k}">
      <span class="tgame-opt__k">${k}</span>
      <span class="tgame-opt__t">${sanitizeRich(it.options[k])}</span>
    </button>`).join("");

  root.innerHTML = `
    <section class="tgame">
      <div class="tgame-top">${scoreBar()}</div>
      <article class="tgame-card" data-id="${it.id}">
        ${labels ? `<div class="tgame-types">${labels}</div>` : ""}
        <div class="tgame-cardmeta">${it.year ?? ""}${it.session ? ` · ${esc(it.session)}` : ""}${it.itemNo != null ? ` · itemul ${it.itemNo}` : ""}</div>
        <p class="tgame-q">${it.question ? sanitizeRich(it.question) : "<em>(enunț indisponibil)</em>"}</p>
        <div class="tgame-opts">${opts || `<span class="tgame-empty">(variante indisponibile)</span>`}</div>
        <div class="tgame-fb" hidden></div>
        <div class="tgame-next" hidden><button type="button" class="tgame-btn tgame-btn--primary" data-act="next">Continuă ▸</button></div>
      </article>
    </section>`;
}

async function submit(btn) {
  const card = btn.closest(".tgame-card");
  if (!card || card.dataset.done) return;
  const id = card.dataset.id;
  const k = btn.dataset.k;
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
  if (res.correct) G.correct++; else G.wrong++;

  card.classList.add(res.correct ? "is-correct" : "is-wrong");
  card.querySelectorAll(".tgame-opt").forEach((b) => {
    if (b.dataset.k === res.correctAnswer) b.classList.add("opt-correct");
    if (b.dataset.k === k && !res.correct) b.classList.add("opt-wrong");
  });

  const hist = res.historical
    ? `<div class="tgame-hist">Pe gramatica veche, răspunsul era <b>${esc(res.historical)}</b>.</div>` : "";
  const pts = res.awarded ? ` <span class="tgame-pts">+${res.points}</span>` : "";
  const fb = card.querySelector(".tgame-fb");
  fb.hidden = false;
  fb.innerHTML = `
    <div class="tgame-verdict ${res.correct ? "ok" : "no"}">
      ${res.correct ? `✓ Corect${pts}` : `✗ Greșit — corect era <b>${esc(res.correctAnswer)}</b>`}
    </div>
    ${hist}
    ${res.observation ? `<div class="tgame-obs"><span class="tgame-obs__lab">Observație</span>${sanitizeRich(res.observation)}</div>` : ""}`;
  card.querySelector(".tgame-next").hidden = false;

  const score = root.querySelector(".tgame-score");
  if (score) score.innerHTML = `<b class="ok">${G.correct}</b> corecte · <b class="no">${G.wrong}</b> greșite <span class="tgame-left">· ${G.queue.length} rămași</span>`;
}

function advance() {
  const card = root.querySelector(".tgame-card");
  const wasCorrect = card && card.dataset.correct === "1";
  const id = G.queue.shift();               // remove the current item from the front
  if (!wasCorrect && id != null) G.queue.push(id); // wrong → back of the queue (returns later)
  if (!G.queue.length) return renderDone();
  renderGame();
}

// ---------- DONE ----------
function renderDone() {
  stopTimer();
  const time = fmtTime(Math.floor((Date.now() - G.startAt) / 1000));
  root.innerHTML = `
    <section class="tgame tgame-done">
      <div class="tgame-done__badge" aria-hidden="true">✓</div>
      <h2 class="tgame-done__title">Gata! Ai rezolvat corect toți itemii.</h2>
      <p class="tgame-done__stats">
        <b>${G.total}</b> itemi · <b class="ok">${G.correct}</b> corecte · <b class="no">${G.wrong}</b> greșite · timp <b>${time}</b>
      </p>
      <div class="tgame-done__actions">
        <button type="button" class="tgame-btn tgame-btn--primary" data-act="again">Încă o dată</button>
        <button type="button" class="tgame-btn" data-act="config">Altă configurație</button>
      </div>
    </section>`;
}

// ---------- timer ----------
function startTimer() {
  stopTimer();
  G.timer = setInterval(() => {
    const el = root && root.querySelector("#tgame-timer");
    if (el) el.textContent = fmtTime(Math.floor((Date.now() - G.startAt) / 1000));
  }, 1000);
}
function stopTimer() { if (G.timer) { clearInterval(G.timer); G.timer = null; } }

// ---------- events ----------
function onClick(e) {
  const year = e.target.closest("[data-year]");
  if (year) {
    const v = year.dataset.year;
    if (v === "all") G.sel.years = G.sel.years.size === G.years.length ? new Set() : new Set(G.years);
    else { const y = Number(v); G.sel.years.has(y) ? G.sel.years.delete(y) : G.sel.years.add(y); }
    return renderConfig();
  }
  const type = e.target.closest("[data-type]");
  if (type) {
    const v = type.dataset.type;
    if (v === "all") G.sel.types = G.sel.types.size === G.types.length ? new Set() : new Set(G.types);
    else G.sel.types.has(v) ? G.sel.types.delete(v) : G.sel.types.add(v);
    return renderConfig();
  }
  const order = e.target.closest("[data-order]");
  if (order) { G.sel.order = order.dataset.order; return renderConfig(); }

  const act = e.target.closest("[data-act]");
  if (act) {
    const a = act.dataset.act;
    if (a === "home") { e.preventDefault(); stopTimer(); location.hash = ""; return; }
    if (a === "quit") { e.preventDefault(); stopTimer(); return renderConfig(); }
    if (a === "start") return startGame();
    if (a === "again") return startGame();
    if (a === "config") return renderConfig();
    if (a === "next") return advance();
  }

  const opt = e.target.closest(".tgame-opt");
  if (opt && !opt.disabled) return submit(opt);
}

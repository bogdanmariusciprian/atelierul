// =========================================================
// Teste → mini-game (PUPIL / GUEST). One item at a time, click an answer to
// submit, see the observation, keep going until every item is answered right.
//
//   • CONFIG (tap-chips, no dropdowns): years, topic types, order. Clicking a
//     chip while ALL are selected NARROWS to just that one (intuitive); further
//     clicks add/remove; emptying the set falls back to „all". „Toate" = all.
//   • GAME: progress bar + live corect / greșit / puncte, a discreet elapsed
//     timer, type labels. Correct → confetti + points fly in. Wrong → the page
//     quakes, the card flashes red and a copy flies into the „greșite" counter,
//     and the item returns to the BACK of the queue until it's answered right.
//   • Leaving mid-game asks for confirmation (styled modal + a browser guard).
//
// CHEAT-SAFE: items ship without the answer key; the only way to learn the
// answer is answer_test_item AFTER a choice. Points are awarded server-side.
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
  exam: null, items: [], byId: new Map(),
  years: [], types: [],
  sel: { years: new Set(), types: new Set(), order: "random" },
  sessionId: null, queue: [],
  total: 0, correct: 0, wrong: 0, points: 0,
  inGame: false, startAt: 0, timer: null,
};

// ---------- entry ----------
export async function initTestGame(mountEl, exam) {
  root = mountEl;
  G.exam = exam;
  G.inGame = false;
  root.className = "tgame-wrap";
  if (!root.__gameWired) { root.addEventListener("click", onClick); root.__gameWired = true; }
  if (!window.__tgameBeforeUnload) {
    window.__tgameBeforeUnload = true;
    window.addEventListener("beforeunload", (e) => { if (G.inGame) { e.preventDefault(); e.returnValue = ""; } });
  }
  root.innerHTML = `<div class="tgame-loading">Se încarcă itemii…</div>`;

  const items = await fetchTestItems({ exam }); // published only (RLS), all years
  G.items = items;
  G.byId = new Map(items.map((i) => [i.id, i]));
  G.years = [...new Set(items.map((i) => i.year).filter((y) => y != null))].sort((a, b) => b - a);
  const present = new Set();
  items.forEach((i) => (i.types || []).forEach((t) => present.add(t)));
  G.types = TEST_ITEM_TYPES.map((t) => t.code).filter((c) => present.has(c));
  G.sel.years = new Set(G.years);   // default: everything
  G.sel.types = new Set(G.types);
  renderConfig();
}

// ---------- filtering / ordering ----------
function matchingItems() {
  return G.items.filter((it) => {
    if (G.sel.years.size && !G.sel.years.has(it.year)) return false;
    if (G.types.length && G.sel.types.size) {
      const its = it.types || [];
      if (!its.some((t) => G.sel.types.has(t))) return false;
    }
    return true;
  });
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function buildQueue(items) {
  const arr = [...items];
  if (G.sel.order === "years") arr.sort((a, b) => (b.year - a.year) || (a.itemNo - b.itemNo));
  else if (G.sel.order === "types") {
    const ft = (it) => (it.types || [])[0] || "￿";
    arr.sort((a, b) => ft(a).localeCompare(ft(b)) || (b.year - a.year) || (a.itemNo - b.itemNo));
  } else shuffle(arr);
  return arr.map((i) => i.id);
}

// Intuitive multi-select: clicking one while ALL are on → narrow to just it;
// otherwise toggle; emptying the set → back to all. „all" chip → everything.
function pick(setName, universe, value) {
  const cur = G.sel[setName];
  if (value === "all") { G.sel[setName] = new Set(universe); return; }
  if (cur.size === universe.length) { G.sel[setName] = new Set([value]); return; } // narrow from all
  if (cur.has(value)) { cur.delete(value); if (cur.size === 0) G.sel[setName] = new Set(universe); }
  else cur.add(value);
}

// ---------- CONFIG screen ----------
function renderConfig() {
  stopTimer();
  const n = matchingItems().length;
  const chip = (attr, val, label, on, title) =>
    `<button type="button" class="tgame-chip${on ? " on" : ""}" data-${attr}="${val}"${title ? ` title="${esc(title)}"` : ""}>${label}</button>`;
  const allYearsOn = G.years.length > 0 && G.sel.years.size === G.years.length;
  const allTypesOn = G.types.length > 0 && G.sel.types.size === G.types.length;

  const yearChips = chip("year", "all", "Toți anii", allYearsOn)
    + G.years.map((y) => chip("year", y, y, !allYearsOn && G.sel.years.has(y))).join("");
  const typeBlock = G.types.length ? `
    <div class="tgame-cfg-block">
      <div class="tgame-cfg-lab">Tipuri de itemi</div>
      <div class="tgame-chips">
        ${chip("type", "all", "Toate", allTypesOn)}
        ${G.types.map((c) => chip("type", c, esc(c), !allTypesOn && G.sel.types.has(c), TYPE_LABEL[c] || c)).join("")}
      </div>
    </div>` : "";
  const orderChips = [["random", "Aleatoriu"], ["years", "Pe ani"], ["types", "Pe tipuri"]]
    .map(([v, l]) => chip("order", v, l, G.sel.order === v)).join("");

  root.innerHTML = `
    <section class="tgame-config">
      <a class="tgame-back" href="#" data-act="home">‹ Toate testele</a>
      <div class="tgame-config__hero">
        <span class="tgame-config__badge" aria-hidden="true">⚖️</span>
        <h2 class="tgame-config__title">Antrenament — Admitere Drept</h2>
        <p class="tgame-config__sub">Alege ce exersezi, apoi rezolvi câte un item pe rând. Cei greșiți revin până îi nimerești. Atinge ca să bifezi.</p>
      </div>

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
        <button type="button" class="tgame-btn tgame-btn--primary tgame-btn--lg" data-act="start"${n ? "" : " disabled"}>Începe antrenamentul ▸</button>
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
  G.correct = 0; G.wrong = 0; G.points = 0;
  G.inGame = true; G.startAt = Date.now();
  startTimer();
  renderGame();
}

function hud() {
  const pct = G.total ? Math.round((G.correct / G.total) * 100) : 0;
  return `
    <div class="tgame-hud">
      <div class="tgame-hud__top">
        <a class="tgame-back" href="#" data-act="quit">‹ Renunț</a>
        <span class="tgame-timer" id="tgame-timer">${fmtTime(Math.floor((Date.now() - G.startAt) / 1000))}</span>
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
      ${hud()}
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
    ${res.observation ? `<div class="tgame-obs"><span class="tgame-obs__lab">Observație</span>${sanitizeRich(res.observation)}</div>` : ""}`;
  card.querySelector(".tgame-next").hidden = false;

  updateHud();
  if (res.correct) { burstConfetti(card); if (res.awarded) floatPoints(res.points); }
  else wrongFx(card);
}

function advance() {
  const card = root.querySelector(".tgame-card");
  const wasCorrect = card && card.dataset.correct === "1";
  const id = G.queue.shift();
  if (!wasCorrect && id != null) G.queue.push(id); // wrong → back of the queue
  if (!G.queue.length) return renderDone();
  renderGame();
}

// ---------- DONE ----------
function renderDone() {
  stopTimer();
  G.inGame = false;
  const time = fmtTime(Math.floor((Date.now() - G.startAt) / 1000));
  root.innerHTML = `
    <section class="tgame tgame-done">
      <div class="tgame-done__badge" aria-hidden="true">✓</div>
      <h2 class="tgame-done__title">Gata! Ai rezolvat corect toți itemii.</h2>
      <p class="tgame-done__stats"><b>${G.total}</b> itemi · <b class="ok">${G.correct}</b> corecte · <b class="no">${G.wrong}</b> greșite · <b class="pts">${G.points}</b> puncte · timp <b>${time}</b></p>
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
    if (el) el.textContent = fmtTime(Math.floor((Date.now() - G.startAt) / 1000));
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
  const back = document.createElement("div");
  back.className = "tgame-modal";
  back.innerHTML = `
    <div class="tgame-modal__card" role="dialog" aria-modal="true" aria-label="Părăsești jocul?">
      <div class="tgame-modal__icon" aria-hidden="true">!</div>
      <h3 class="tgame-modal__title">Părăsești antrenamentul?</h3>
      <p class="tgame-modal__text">Progresul din această sesiune se pierde.</p>
      <div class="tgame-modal__actions">
        <button type="button" class="tgame-btn" data-modal="cancel">Rămân</button>
        <button type="button" class="tgame-btn tgame-btn--danger" data-modal="yes">Părăsesc</button>
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
function onClick(e) {
  const year = e.target.closest("[data-year]");
  if (year) { pick("years", G.years, year.dataset.year === "all" ? "all" : Number(year.dataset.year)); return renderConfig(); }
  const type = e.target.closest("[data-type]");
  if (type) { pick("types", G.types, type.dataset.type); return renderConfig(); }
  const order = e.target.closest("[data-order]");
  if (order) { G.sel.order = order.dataset.order; return renderConfig(); }

  const act = e.target.closest("[data-act]");
  if (act) {
    const a = act.dataset.act;
    if (a === "home") { e.preventDefault(); stopTimer(); location.hash = ""; return; }
    if (a === "quit") { e.preventDefault(); return confirmLeave(() => { G.inGame = false; stopTimer(); renderConfig(); }); }
    if (a === "start" || a === "again") return startGame();
    if (a === "config") return renderConfig();
    if (a === "next") return advance();
  }

  const opt = e.target.closest(".tgame-opt");
  if (opt && !opt.disabled) return submit(opt);
}

// =========================================================
// Flying bonus questions (classic mode only).
//
// A short, easy question drifts across the screen for a few seconds. Catch it
// with a tap and answer it inside a tight window, and the server rolls you a
// booster. Ignore it and it simply flies off — never a penalty.
//
// Timing: a hard cooldown (never more often than every two minutes) and then
// only a CHANCE per item, so it stays sporadic instead of rhythmic.
//
// The host game is told when the modal opens and closes, because the item's
// own clock must PAUSE meanwhile — otherwise engaging with the bonus would
// cost you the very item you're trying to win help for.
//
// Content Romanian, identifiers English.
// =========================================================
import { fetchBonusQuestions, answerBonusQuestion } from "../../shared/scripts/test-repo.js";

const COOLDOWN_MS = 120000; // never more often than every 2 minutes
const SPAWN_CHANCE = 0.35;  // ...and even then, only sometimes
const FLIGHT_MS = 7000;     // how long it stays catchable
const ANSWER_MS = 15000;    // how long you have once you've caught it

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const B = { pool: [], lastAt: 0, flyer: null, modal: null, timer: null, hooks: {} };

const host = () => document.querySelector("main") || document.body;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** hooks: { sessionId(), onOpen(), onClose(), onBooster(kind) } */
export async function initBonus(hooks = {}) {
  B.hooks = hooks;
  // Start halfway through the cooldown: never on the very first item, but
  // not a full two minutes of nothing either.
  B.lastAt = Date.now() - COOLDOWN_MS / 2;
  if (!B.pool.length) B.pool = await fetchBonusQuestions();
}

export function bonusReady() { return B.pool.length > 0; }

/** Called by the game when a new item appears. Decides whether one flies by. */
export function maybeSpawn() {
  if (!B.pool.length || B.flyer || B.modal) return;
  if (Date.now() - B.lastAt < COOLDOWN_MS) return;
  if (Math.random() > SPAWN_CHANCE) return;
  spawn(B.pool[Math.floor(Math.random() * B.pool.length)]);
}

/** Tear everything down (leaving the game, run over). */
export function clearBonus() {
  stopTimer();
  B.flyer?.remove(); B.flyer = null;
  B.modal?.remove(); B.modal = null;
}

function stopTimer() { if (B.timer) { clearInterval(B.timer); B.timer = null; } }

function spawn(q) {
  B.lastAt = Date.now();
  const el = document.createElement("button");
  el.type = "button";
  el.className = "tbonus-flyer";
  el.setAttribute("aria-label", "Întrebare bonus — prinde-o");
  el.innerHTML = `<span class="tbonus-flyer__ic" aria-hidden="true">✦</span><span>bonus</span>`;
  // A lane across the upper area: never over the answer buttons.
  el.style.top = `${18 + Math.random() * 16}vh`;
  if (reducedMotion()) {
    // No flight for readers who asked for stillness — it just waits in a corner.
    el.classList.add("is-still");
  } else {
    el.style.animationDuration = `${FLIGHT_MS}ms`;
    el.classList.add(Math.random() < 0.5 ? "fly-lr" : "fly-rl");
  }
  el.addEventListener("click", () => open(q));
  host().appendChild(el);
  B.flyer = el;
  setTimeout(() => { if (B.flyer === el) { el.remove(); B.flyer = null; } }, FLIGHT_MS);
}

function open(q) {
  B.flyer?.remove(); B.flyer = null;
  if (B.modal) return;
  B.hooks.onOpen?.(); // freeze the item clock while we're in here

  const box = document.createElement("div");
  box.className = "tgame-modal tbonus-modal";
  box.innerHTML = `
    <div class="tgame-modal__card tgame-modal__card--wide" role="dialog" aria-modal="true" aria-label="Întrebare bonus">
      <div class="tbonus-bar"><i id="tbonus-bar"></i></div>
      <p class="tbonus-kicker">Întrebare bonus</p>
      <h3 class="tgame-modal__title tbonus-q">${esc(q.prompt)}</h3>
      <input class="tgame-nameinput tbonus-input" id="tbonus-input" maxlength="60" placeholder="răspunsul tău…" autocomplete="off" />
      <div class="tgame-modal__actions">
        <button type="button" class="tgame-btn" data-bonus="skip">Renunț</button>
        <button type="button" class="tgame-btn tgame-btn--primary" data-bonus="send">Răspunde</button>
      </div>
    </div>`;
  host().appendChild(box);
  B.modal = box;

  const input = box.querySelector("#tbonus-input");
  setTimeout(() => input?.focus(), 30);

  const deadline = Date.now() + ANSWER_MS;
  B.timer = setInterval(() => {
    const left = deadline - Date.now();
    const bar = box.querySelector("#tbonus-bar");
    if (bar) bar.style.width = `${Math.max(0, (left / ANSWER_MS) * 100)}%`;
    if (left <= 0) close("Prea târziu — a zburat.");
  }, 100);

  box.addEventListener("click", (e) => {
    if (e.target === box || e.target.closest("[data-bonus=skip]")) return close();
    if (e.target.closest("[data-bonus=send]")) send(q, input?.value || "");
  });
  box.addEventListener("keydown", (e) => { if (e.key === "Enter") send(q, input?.value || ""); });
}

async function send(q, text) {
  if (!B.modal || !text.trim()) return;
  stopTimer();
  const card = B.modal.querySelector(".tgame-modal__card");
  card.classList.add("is-checking");
  const res = await answerBonusQuestion(q.id, text, B.hooks.sessionId?.());
  card.classList.remove("is-checking");
  if (!res || res.error) return close("N-am putut verifica acum.");
  if (res.correct) {
    close();
    B.hooks.onBooster?.(res.booster);
  } else {
    close(`Nu de data asta — răspunsul era „${res.answer || "…"}".`);
  }
}

function close(note) {
  stopTimer();
  B.modal?.remove();
  B.modal = null;
  B.hooks.onClose?.(note); // hand the clock back
}

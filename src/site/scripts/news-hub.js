// =========================================================
// Home "Noutăți" section — two columns:
//   • left   : useful outbound links (dexonline etc.)
//   • right  : ONE "spotlight" card at a time, rotating on a timer
//              (ROTATE_MS). The card's own content is picked by date.
// The leaderboard lives in its own module, higher up the page.
// Zero backend: content comes from the shared data modules (DRY).
// =========================================================
import {
  WORDS_OF_DAY,
  DID_YOU_KNOW,
  WEEKLY_MISTAKES,
  PARONYMS,
  QUOTES,
  DOOM_NOTES,
  CHALLENGES,
  WHATS_NEW,
  USEFUL_LINKS,
} from "../../shared/scripts/news-data.js";
import { localDayNumber } from "../../shared/scripts/format.js";

// How often the spotlight card switches to the next one. 5 minutes for
// now; set to 3 * 60 * 60 * 1000 (3 hours) once the site is finished.
const ROTATE_MS = 5 * 60 * 1000;

// Whole days since the epoch (UTC). Same for everyone on a given day, so
// the "of the day" content is stable through the day and changes at
// midnight. Weekly cards advance every 7 days.
const dayNumber = localDayNumber(); // LOCAL day → conținutul „zilei" se schimbă la miezul nopții local
const daily = (list) => list[dayNumber % list.length];
const weekly = (list) => list[Math.floor(dayNumber / 7) % list.length];

// One card shell: colored tag (icon + name) + free-form body.
function card(color, icon, tag, body, extraClass = "") {
  return `
    <article class="news-card ${extraClass}" style="--card-color: ${color}">
      <span class="news-card__tag">
        <span class="news-card__icon" aria-hidden="true">${icon}</span>${tag}
      </span>
      ${body}
    </article>`;
}

function wordCard() {
  const w = daily(WORDS_OF_DAY);
  return card(
    "#7c3aed",
    "📖",
    "Cuvântul zilei",
    `<h3 class="news-card__title">${w.word}
       <span class="news-card__pos">· ${w.pos}</span></h3>
     <p class="news-card__text">${w.def}</p>
     <p class="news-card__quote">„${w.example}”</p>
     <a class="news-card__link" href="${w.href}" target="_blank" rel="noopener">
       vezi pe dexonline ↗</a>`
  );
}

function didYouKnowCard() {
  const d = daily(DID_YOU_KNOW);
  return card(
    "#f59e0b",
    "💡",
    "Știați că…",
    `<h3 class="news-card__title">${d.title}</h3>
     <p class="news-card__text">${d.text}</p>`
  );
}

function mistakeCard() {
  const m = weekly(WEEKLY_MISTAKES);
  return card(
    "#dc2626",
    "⚠️",
    "Greșeala săptămânii",
    `<h3 class="news-card__title">${m.title}</h3>
     <p class="news-card__row"><span class="news-card__mark news-card__mark--x">✗</span> ${m.wrong}</p>
     <p class="news-card__row"><span class="news-card__mark news-card__mark--ok">✓</span> ${m.right}</p>
     <p class="news-card__note">${m.note}</p>`
  );
}

function paronymCard() {
  const p = daily(PARONYMS);
  return card(
    "#0ea5e9",
    "🔀",
    "Paronime",
    `<h3 class="news-card__title">${p.a} ≠ ${p.b}</h3>
     <p class="news-card__text"><strong>${p.a}</strong> = ${p.aDef}.<br>
        <strong>${p.b}</strong> = ${p.bDef}.</p>`
  );
}

function quoteCard() {
  const q = daily(QUOTES);
  return card(
    "#16a34a",
    "❝",
    "Citatul zilei",
    `<p class="news-card__quote news-card__quote--big">„${q.text}”</p>
     <p class="news-card__author">— ${q.author}</p>`
  );
}

function doomCard() {
  const d = weekly(DOOM_NOTES);
  return card(
    "#6366f1",
    "📝",
    "Din DOOM",
    `<h3 class="news-card__title">${d.title}</h3>
     <p class="news-card__text">${d.text}</p>`
  );
}

function challengeCard() {
  const c = daily(CHALLENGES);
  return card(
    "#db2777",
    "🎯",
    "Provocarea zilei",
    `<p class="news-card__text">${c.question}</p>
     <button class="news-card__reveal" type="button" aria-expanded="false">
       Vezi răspunsul</button>
     <p class="news-card__answer" hidden>${c.answer}</p>`
  );
}

function whatsNewCard() {
  const items = WHATS_NEW.map(
    (n) => `<li class="news-card__new">${n.text}</li>`
  ).join("");
  return card(
    "#0f766e",
    "✨",
    "Ce-i nou pe Atelier",
    `<ul class="news-card__newlist">${items}</ul>`,
    "news-card--wide"
  );
}

function linksAside() {
  const links = USEFUL_LINKS.map(
    (l) => `
      <a class="news-links__item" href="${l.href}" target="_blank" rel="noopener">
        <span class="news-links__label">${l.label} ↗</span>
        <span class="news-links__note">${l.note}</span>
      </a>`
  ).join("");
  return `
    <aside class="news-links" aria-label="Linkuri utile">
      <h3 class="news-links__title"><span aria-hidden="true">🔗</span> Linkuri utile</h3>
      ${links}
    </aside>`;
}

// Bind the "Provocarea zilei" reveal button within a freshly rendered card.
function bindReveal(scope) {
  const btn = scope.querySelector(".news-card__reveal");
  if (!btn) return;
  const answer = btn.nextElementSibling;
  btn.addEventListener("click", () => {
    const open = answer.hasAttribute("hidden");
    answer.toggleAttribute("hidden", !open);
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Ascunde răspunsul" : "Vezi răspunsul";
  });
}

export function renderNews() {
  const mount = document.getElementById("news-hub");
  if (!mount) return;

  // All spotlight cards, built once. Only one is shown at a time.
  const cards = [
    wordCard(),
    didYouKnowCard(),
    mistakeCard(),
    paronymCard(),
    quoteCard(),
    doomCard(),
    challengeCard(),
    whatsNewCard(),
  ];

  mount.innerHTML = `
    <div class="news">
      ${linksAside()}
      <div class="news-spotlight">
        <div class="news-spotlight__slot"></div>
        <p class="news-spotlight__hint">Se schimbă la fiecare câteva minute ·
          <button class="news-spotlight__next" type="button">următorul ↻</button></p>
      </div>
    </div>`;

  const slot = mount.querySelector(".news-spotlight__slot");

  // Start on a time-based index so it's not always the same card on load,
  // then advance on the timer. Manual "next" also advances.
  let index = Math.floor(Date.now() / ROTATE_MS) % cards.length;

  function show(i, animate = true) {
    index = ((i % cards.length) + cards.length) % cards.length;
    if (animate) slot.classList.add("is-fading");
    // Swap after the fade-out (or immediately on first paint).
    const swap = () => {
      slot.innerHTML = cards[index];
      bindReveal(slot);
      slot.classList.remove("is-fading");
    };
    if (animate) setTimeout(swap, 180);
    else swap();
  }

  show(index, false);
  let timer = setInterval(() => show(index + 1), ROTATE_MS);

  mount.querySelector(".news-spotlight__next").addEventListener("click", () => {
    clearInterval(timer); // reset the clock so it's a full interval after a manual skip
    show(index + 1);
    timer = setInterval(() => show(index + 1), ROTATE_MS);
  });
}

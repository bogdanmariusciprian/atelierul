// =========================================================
// Extra interactive bits for the community landing page:
//   • rank simulator — sliders estimate your points & leaderboard place
//   • testimonials carousel — auto-rotating, with dots + arrows
//   • FAQ accordion — native <details>, styled
// Mock data, but the ranking is computed against the real user list.
// =========================================================
import { COMMUNITY_USERS, slugForUser } from "../../shared/scripts/community-data.js";
import { avatarForUser } from "../../shared/scripts/avatars.js";

const PTS_PER_LESSON = 70;
const PTS_PER_COMMENT = 8;
const BASE_POINTS = 120;

const TESTIMONIALS = [
  { name: "Ioana Stan", quote: "Am urcat 15 locuri în clasament într-o lună. Discuțiile la lecții m-au ajutat enorm." },
  { name: "Andrei Popescu", quote: "Cel mai bun loc să exersez pentru Bac. Prietenii mă țin motivat zi de zi." },
  { name: "Vlad Georgescu", quote: "Caietul digital plus punctele = o dependență sănătoasă de învățat." },
  { name: "Elena Dumitru", quote: "Am găsit colegi pentru admiterea la Drept. Învățăm împreună în fiecare seară." },
];

const FAQ = [
  { q: "Cât costă?", a: "Intrarea în comunitate e gratuită. Îți faci cont și începi imediat." },
  { q: "Cine îmi vede pagina?", a: "Tu alegi, din profil: doar prietenii, membrii conectați sau toată lumea. Implicit, doar membrii conectați — iar postările „doar prieteni” rămân mereu private." },
  { q: "Cum câștig puncte?", a: "Termini lecții, rezolvi exerciții, comentezi și îți menții streak-ul zilnic." },
  { q: "Pot șterge ce postez?", a: "Da, ai control complet asupra postărilor și notițelor tale." },
];

// ---------- Rank simulator ----------
function rankSim(mount) {
  if (!mount) return;
  const top = Math.max(...COMMUNITY_USERS.map((u) => u.points));

  mount.innerHTML = `
    <div class="sim">
      <div class="sim__controls">
        <label class="sim__row">
          <span>Lecții terminate: <b id="sim-l-out">8</b></span>
          <input type="range" id="sim-lessons" min="0" max="42" value="8" />
        </label>
        <label class="sim__row">
          <span>Comentarii scrise: <b id="sim-c-out">5</b></span>
          <input type="range" id="sim-comments" min="0" max="60" value="5" />
        </label>
      </div>
      <div class="sim__result">
        <div class="sim__points"><b id="sim-points">0</b><span>puncte estimate</span></div>
        <div class="sim__rank">ai fi pe locul <b id="sim-rank">–</b> din ${COMMUNITY_USERS.length + 1}</div>
        <div class="sim__gauge"><span class="sim__fill" id="sim-fill"></span></div>
        <p class="sim__neighbors" id="sim-neighbors"></p>
      </div>
    </div>`;

  const lessons = mount.querySelector("#sim-lessons");
  const comments = mount.querySelector("#sim-comments");
  const lOut = mount.querySelector("#sim-l-out");
  const cOut = mount.querySelector("#sim-c-out");
  const ptsEl = mount.querySelector("#sim-points");
  const rankEl = mount.querySelector("#sim-rank");
  const fill = mount.querySelector("#sim-fill");
  const neighbors = mount.querySelector("#sim-neighbors");

  function update() {
    const l = Number(lessons.value);
    const c = Number(comments.value);
    const pts = BASE_POINTS + l * PTS_PER_LESSON + c * PTS_PER_COMMENT;
    lOut.textContent = l;
    cOut.textContent = c;
    ptsEl.textContent = pts.toLocaleString("ro-RO");
    const rank = COMMUNITY_USERS.filter((u) => u.points > pts).length + 1;
    rankEl.textContent = rank;
    fill.style.width = `${Math.min(100, (pts / (top * 1.1)) * 100)}%`;

    const above = COMMUNITY_USERS.filter((u) => u.points > pts).sort((a, b) => a.points - b.points)[0];
    const below = COMMUNITY_USERS.filter((u) => u.points <= pts).sort((a, b) => b.points - a.points)[0];
    neighbors.innerHTML =
      (above ? `↑ ai depăși în curând pe <b>${above.name}</b> (${above.points.toLocaleString("ro-RO")}). ` : "🏆 ai fi pe primul loc! ") +
      (below ? `Deja treci de <b>${below.name}</b>.` : "");
  }

  lessons.addEventListener("input", update);
  comments.addEventListener("input", update);
  update();
}

// ---------- Testimonials carousel ----------
function testimonials(mount) {
  if (!mount) return;
  let i = 0;
  const dots = TESTIMONIALS.map((_, k) => `<button class="tm__dot" data-k="${k}" aria-label="Testimonial ${k + 1}"></button>`).join("");

  mount.innerHTML = `
    <div class="tm">
      <button class="tm__arrow" data-dir="-1" aria-label="Anteriorul">‹</button>
      <div class="tm__card" id="tm-card"></div>
      <button class="tm__arrow" data-dir="1" aria-label="Următorul">›</button>
    </div>
    <div class="tm__dots">${dots}</div>`;

  const card = mount.querySelector("#tm-card");
  const dotEls = [...mount.querySelectorAll(".tm__dot")];

  function show(n) {
    i = (n + TESTIMONIALS.length) % TESTIMONIALS.length;
    const t = TESTIMONIALS[i];
    // A testimonial's name links to that member's real profile. If the
    // account no longer exists (deleted), the link degrades to plain text.
    const user = COMMUNITY_USERS.find((u) => u.name === t.name);
    const href = user ? `../#u/${slugForUser(user.id)}` : null;
    const avatarId = user ? user.id : i + 1; // stable mock gif either way
    const nameHtml = href
      ? `<a class="tm__name cx-userlink" href="${href}" title="Vezi profilul">${t.name}</a>`
      : `<p class="tm__name" title="Cont șters">${t.name}</p>`;
    const avatarHtml = href
      ? `<a class="cx-avlink" href="${href}" title="Vezi profilul"><span class="tm__avatar tm__avatar--gif" style="background-image:url('../../../${avatarForUser(avatarId)}')" role="img" aria-label="${t.name}"></span></a>`
      : `<span class="tm__avatar tm__avatar--gif" style="background-image:url('../../../${avatarForUser(avatarId)}')" role="img" aria-label="${t.name}"></span>`;
    card.style.opacity = 0;
    setTimeout(() => {
      card.innerHTML = `
        ${avatarHtml}
        <blockquote class="tm__quote">„${t.quote}”</blockquote>
        ${nameHtml}`;
      card.style.opacity = 1;
    }, 150);
    dotEls.forEach((d, k) => d.classList.toggle("on", k === i));
  }

  mount.querySelectorAll(".tm__arrow").forEach((a) =>
    a.addEventListener("click", () => { show(i + Number(a.dataset.dir)); reset(); })
  );
  dotEls.forEach((d) => d.addEventListener("click", () => { show(Number(d.dataset.k)); reset(); }));

  let timer = setInterval(() => show(i + 1), 5000);
  function reset() { clearInterval(timer); timer = setInterval(() => show(i + 1), 5000); }
  mount.addEventListener("mouseenter", () => clearInterval(timer));
  mount.addEventListener("mouseleave", reset);

  show(0);
}

// ---------- FAQ accordion ----------
function faq(mount) {
  if (!mount) return;
  mount.innerHTML = `<div class="faq">${FAQ.map(
    (f) => `<details class="faq__item">
      <summary class="faq__q">${f.q}</summary>
      <p class="faq__a">${f.a}</p>
    </details>`
  ).join("")}</div>`;
}

// ---------- Sticky CTA ----------
// The landing is long — by the FAQ you've forgotten the button. A slim
// bar slides up after the first screen and keeps the door one tap away.
function stickyCta() {
  if (document.querySelector(".cl-sticky")) return;
  const bar = document.createElement("div");
  bar.className = "cl-sticky";
  bar.hidden = true;
  bar.innerHTML = `
    <span class="cl-sticky__text">Ți-a plăcut ce ai văzut?</span>
    <a class="btn btn--primary btn--sm" href="../login/">Creează cont gratuit</a>`;
  document.body.appendChild(bar);

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        bar.hidden = window.scrollY < 500;
        ticking = false;
      });
    },
    { passive: true }
  );
}

export function initLandingInteractive() {
  rankSim(document.getElementById("rank-sim"));
  testimonials(document.getElementById("testimonials"));
  faq(document.getElementById("faq"));
  stickyCta();
}

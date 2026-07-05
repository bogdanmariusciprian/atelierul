// =========================================================
// "Atelierul în cifre" — an interactive infographic on the community
// landing page. Numbers count up when scrolled into view; the per-domain
// bar chart animates its bars and can toggle between all planned lessons
// and the ones already available. Bars link to that domain's lessons.
// Data comes from the shared modules (mock, but real-shaped).
// =========================================================
import { LESSONS } from "../../shared/scripts/lessons-index.js";
import { LESSON_DOMAINS } from "../../shared/scripts/domains.js";
import { COMMUNITY_USERS } from "../../shared/scripts/community-data.js";

export function renderCommunityStats(mountId = "community-stats", basePath = "") {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const ready = LESSONS.filter((l) => l.ready).length;
  const points = COMMUNITY_USERS.reduce((s, u) => s + u.points, 0);
  const perDomain = LESSON_DOMAINS.map((d) => ({
    ...d,
    ready: LESSONS.filter((l) => l.domain === d.slug && l.ready).length,
    total: LESSONS.filter((l) => l.domain === d.slug).length,
  }));

  const counters = [
    { value: ready, label: "lecții disponibile" },
    { value: LESSON_DOMAINS.length, label: "domenii" },
    { value: COMMUNITY_USERS.length, label: "membri" },
    { value: points, label: "puncte adunate" },
    { value: 128, label: "comentarii" },
  ];

  mount.innerHTML = `
    <div class="stats">
      <div class="stats__counters">
        ${counters
          .map(
            (c) => `<div class="stat">
              <b class="stat__num" data-to="${c.value}">0</b>
              <span class="stat__label">${c.label}</span>
            </div>`
          )
          .join("")}
      </div>

      <div class="stats__chart">
        <div class="stats__head">
          <h3>Lecții pe domeniu</h3>
          <div class="stats__toggle" role="group" aria-label="Ce lecții afișăm">
            <button class="stats__seg on" data-mode="total" type="button">Toate</button>
            <button class="stats__seg" data-mode="ready" type="button">Gata acum</button>
          </div>
        </div>
        <div class="bars">
          ${perDomain
            .map(
              (d) => `<a class="bar" href="${basePath}src/site/pages/lessons.html#${d.slug}"
                        style="--c: ${d.color}" data-ready="${d.ready}" data-total="${d.total}">
                <span class="bar__label"><span aria-hidden="true">${d.icon}</span> ${d.label}</span>
                <span class="bar__track"><span class="bar__fill"></span></span>
                <span class="bar__val">0</span>
              </a>`
            )
            .join("")}
        </div>
      </div>
    </div>`;

  const nums = [...mount.querySelectorAll(".stat__num")];
  const bars = [...mount.querySelectorAll(".bar")];
  const segs = [...mount.querySelectorAll(".stats__seg")];
  let mode = "total";

  function applyBars() {
    const max = Math.max(...bars.map((b) => Number(b.dataset[mode])), 1);
    bars.forEach((bar) => {
      const v = Number(bar.dataset[mode]);
      bar.querySelector(".bar__fill").style.width = `${(v / max) * 100}%`;
      bar.querySelector(".bar__val").textContent = v;
    });
    segs.forEach((s) => s.classList.toggle("on", s.dataset.mode === mode));
  }

  function countUp() {
    const DURATION = 1100;
    const start = performance.now();
    const fmt = (n) => Math.round(n).toLocaleString("ro-RO");
    function frame(now) {
      const t = Math.min(1, (now - start) / DURATION);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      nums.forEach((n) => (n.textContent = fmt(Number(n.dataset.to) * ease)));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  segs.forEach((s) =>
    s.addEventListener("click", () => {
      mode = s.dataset.mode;
      applyBars();
    })
  );

  // Reveal: run the animations only once, when the block scrolls into view.
  let played = false;
  const play = () => {
    if (played) return;
    played = true;
    countUp();
    applyBars();
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          play();
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(mount);
  } else {
    play();
  }
}

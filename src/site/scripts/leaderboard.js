// =========================================================
// Leaderboard (homepage). Top 3 = gold/silver/bronze podium (winner
// centered, crowned, floating); ranks 4–10 fade in below. Each avatar
// wears a ring styled like the user's XP bar level, plus small badges on
// the ring: their level (bottom) and streak (top-right). Hovering a user
// unfolds their status inside the (over-sized) container. Mock data.
// =========================================================
import { topUsers, trendOf } from "../../shared/scripts/community-data.js";
import { avatarForUser } from "../../shared/scripts/avatars.js";
import { metaFromPoints, badgeHtml } from "../../shared/scripts/badges.js";
import { isLoggedIn } from "../../shared/scripts/session.js";
import { clapsFor, hasClapped, giveClap } from "../../shared/scripts/kudos.js";
import { showToast } from "../../shared/scripts/toast.js";
import { burstAt } from "../../shared/scripts/points-fx.js";

const ARROWS = { up: "▲", down: "▼", same: "•" };

export function renderLeaderboard(mountId = "leaderboard") {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const users = topUsers(10);
  const top = users.slice(0, 3);
  const rest = users.slice(3);

  // Shared badge data (level, prestige, ring gradient, streak) — same source
  // of truth as the community hub and comment threads (see badges.js).
  const meta = (u) => metaFromPoints(u.points, u.streak);

  // The week's biggest climber gets a "🚀 în formă" chip.
  const riser = [...users].sort((a, b) => {
    const ta = trendOf(a), tb = trendOf(b);
    return (tb.dir === "up" ? tb.n : -1) - (ta.dir === "up" ? ta.n : -1);
  })[0];
  const riserChip = (u) =>
    riser && u.id === riser.id && trendOf(u).dir === "up"
      ? `<span class="lb-riser" title="Cel mai mare urcuș săptămâna aceasta">🚀 în formă</span>`
      : "";

  // 👏 Applaud a member (logged-in only, once per day per member).
  const clapBtn = (u) => {
    const done = hasClapped(u.id);
    return `<button type="button" class="lb-clap${done ? " is-done" : ""}" data-clap="${u.id}"
        title="${done ? "Ai aplaudat azi" : "Aplaudă-l pe " + u.name.split(" ")[0]}">
        👏 <span class="lb-clap__n">${clapsFor(u.id)}</span>
      </button>`;
  };

  // Avatar + level ring + level/streak badges (used everywhere here).
  // GIF avatars load LAZILY (data-bg → applied when the board scrolls into
  // view) so the homepage doesn't pay for 10 animated GIFs up front.
  const ring = (u, m) => {
    const flow = m.level >= 12 ? " lb-ring--flow" : "";
    const prest = m.prestige >= 1 ? " lb-ring--prestige" : "";
    return `<span class="lb-ring${flow}${prest}" style="--ring:${m.fill}">
        <span class="lb-avatar lb-avatar--gif" data-bg="${avatarForUser(u.id)}" role="img" aria-label="${u.name}"></span>
        ${badgeHtml(m, "lb-badge")}
      </span>`;
  };

  const pod = (u, rank) => {
    if (!u) return "";
    const m = meta(u);
    return `<div class="lb-pod lb-pod--${rank}">
        <span class="lb-pod__aura" aria-hidden="true"></span>
        <span class="lb-pod__crown" aria-hidden="true">${rank === 1 ? "👑" : rank === 2 ? "🥈" : "🥉"}</span>
        ${ring(u, m)}
        <span class="lb-pod__name" data-user-name>${u.name.split(" ")[0]}</span>
        <span class="lb-pod__pts" data-to="${u.points}">0</span>
        ${riserChip(u)}
        ${clapBtn(u)}
        <span class="lb-pod__quote">„${u.status}”</span>
        <span class="lb-pod__base">${rank}</span>
      </div>`;
  };

  const podium = `<div class="lb-podium">${pod(top[1], 2)}${pod(top[0], 1)}${pod(top[2], 3)}</div>`;

  const rows = rest
    .map((u, i) => {
      const rank = i + 4;
      const m = meta(u);
      const tr = trendOf(u);
      return `<li class="lb-row" style="--i:${i}">
          <span class="lb-rank">
            <b class="lb-rank__n">${rank}</b>
            <span class="lb-trend lb-trend--${tr.dir}" title="${tr.dir === "up" ? "a urcat" : tr.dir === "down" ? "a coborât" : "neschimbat"}">${ARROWS[tr.dir]}${tr.n ? tr.n : ""}</span>
          </span>
          ${ring(u, m)}
          <span class="lb-main">
            <span class="lb-name" data-user-name>${u.name}</span> ${riserChip(u)}
            <span class="lb-detail"><span class="lb-quote">„${u.status}”</span></span>
          </span>
          ${clapBtn(u)}
          <span class="lb-points" data-to="${u.points}">0</span>
        </li>`;
    })
    .join("");

  mount.innerHTML = `
    <aside class="leaderboard" aria-label="Cei mai activi utilizatori">
      <h3 class="leaderboard__title"><span aria-hidden="true">🏆</span> Cei mai activi</h3>
      ${podium}
      <ol class="lb-list">${rows}</ol>
      <p class="leaderboard__foot">Treci peste un elev ca să-i vezi starea. Aplaudă-i pe cei care te inspiră. 👏</p>
    </aside>`;

  // 👏 clap handling (delegated; logged-in only).
  mount.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-clap]");
    if (!btn) return;
    if (!isLoggedIn()) {
      showToast("Conectează-te ca să poți aplauda 👏");
      return;
    }
    const id = Number(btn.dataset.clap);
    if (!giveClap(id)) return; // already today
    btn.classList.add("is-done");
    const n = btn.querySelector(".lb-clap__n");
    if (n) n.textContent = clapsFor(id);
    floatClap(btn);
  });

  countUp(mount);
  podiumConfetti(mount);
  lazyAvatars(mount);
}

// Load the animated GIF avatars (and start the aura animations) only when
// the leaderboard actually enters the viewport — first paint stays light.
function lazyAvatars(mount) {
  const board = mount.querySelector(".leaderboard");
  if (!board) return;
  const apply = () => {
    board.classList.add("is-live"); // CSS gates the aura animations on this
    board.querySelectorAll("[data-bg]").forEach((el) => {
      el.style.backgroundImage = `url('${el.dataset.bg}')`;
      el.removeAttribute("data-bg");
    });
  };
  if (!("IntersectionObserver" in window)) return apply();
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        apply();
        io.disconnect();
      }
    },
    { rootMargin: "200px" }
  );
  io.observe(board);
}

// A small "+1 👏" that pops off the button.
function floatClap(btn) {
  const f = document.createElement("span");
  f.className = "lb-clap__float";
  f.textContent = "+1 👏";
  btn.appendChild(f);
  setTimeout(() => f.remove(), 900);
}

// One confetti burst over the champion's crown, the first time the podium
// scrolls into view (per page load) — the top should FEEL like the top.
function podiumConfetti(mount) {
  const crown = mount.querySelector(".lb-pod--1 .lb-pod__crown");
  if (!crown || !("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        const r = crown.getBoundingClientRect();
        burstAt(r.left + r.width / 2, r.top + r.height / 2, 18);
        io.disconnect();
      }
    },
    { threshold: 0.4 }
  );
  io.observe(crown);
}

// Numbers count up from 0 → value once the leaderboard scrolls into view.
function countUp(mount) {
  const nums = [...mount.querySelectorAll("[data-to]")];
  if (!nums.length) return;
  const run = () => {
    const start = performance.now();
    const dur = 1100;
    const fmt = (n) => Math.round(n).toLocaleString("ro-RO");
    const frame = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      nums.forEach((n) => (n.textContent = fmt(Number(n.dataset.to) * e)));
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  if ("IntersectionObserver" in window) {
    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !done) {
          done = true;
          run();
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(mount);
  } else {
    run();
  }
}

// =========================================================
// Leaderboard (homepage) — REAL data from Supabase (public `profiles`).
// Top 3 = gold/silver/bronze podium; ranks 4–10 below. Level rings + badges
// are derived from each user's points (badges.js), same as everywhere.
//
// GATE (Marius's rule): the board only appears once there are at least
// GATE_MIN_USERS members (excluding admin) with >= GATE_MIN_POINTS points.
// Once shown, ALL members appear ranked by points — even those under 100.
// =========================================================
import { supabase } from "../../shared/scripts/supabase-client.js";
import { metaFromPoints, badgeHtml } from "../../shared/scripts/badges.js";
import { burstAt } from "../../shared/scripts/points-fx.js";

const GATE_MIN_USERS = 5;
const GATE_MIN_POINTS = 100;
const TOP_N = 10;

function initialsOf(name) {
  return (
    (name || "")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

// display_name / status_line come from users → escape before injecting.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export async function renderLeaderboard(mountId = "leaderboard") {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  mount.hidden = true; // stays hidden until the gate is met (no empty flash)

  // GATE — enough members with enough points to make a ranking meaningful.
  const { count, error: gateErr } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "member")
    .gte("points", GATE_MIN_POINTS);
  if (gateErr) return;
  if ((count ?? 0) < GATE_MIN_USERS) return; // not yet — leave it hidden

  // Passed → the top members by points (everyone, including under 100).
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_color, status_line, points")
    .eq("role", "member")
    .order("points", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(TOP_N);
  if (error || !users || users.length === 0) return;

  const top = users.slice(0, 3);
  const rest = users.slice(3);
  const meta = (u) => metaFromPoints(u.points, 0); // streak comes with its table later

  const ring = (u, m) => {
    const flow = m.level >= 12 ? " lb-ring--flow" : "";
    const prest = m.prestige >= 1 ? " lb-ring--prestige" : "";
    return `<span class="lb-ring${flow}${prest}" style="--ring:${m.fill}">
        <span class="lb-avatar" style="--a:${u.avatar_color}">${initialsOf(u.display_name)}</span>
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
        <span class="lb-pod__name" data-user-name>${esc(u.display_name.split(" ")[0])}</span>
        <span class="lb-pod__pts" data-to="${u.points}">0</span>
        ${u.status_line ? `<span class="lb-pod__quote">„${esc(u.status_line)}”</span>` : ""}
        <span class="lb-pod__base">${rank}</span>
      </div>`;
  };

  const podium = `<div class="lb-podium">${pod(top[1], 2)}${pod(top[0], 1)}${pod(top[2], 3)}</div>`;

  const rows = rest
    .map((u, i) => {
      const rank = i + 4;
      const m = meta(u);
      return `<li class="lb-row" style="--i:${i}">
          <span class="lb-rank"><b class="lb-rank__n">${rank}</b></span>
          ${ring(u, m)}
          <span class="lb-main">
            <span class="lb-name" data-user-name>${esc(u.display_name)}</span>
            ${u.status_line ? `<span class="lb-detail"><span class="lb-quote">„${esc(u.status_line)}”</span></span>` : ""}
          </span>
          <span class="lb-points" data-to="${u.points}">0</span>
        </li>`;
    })
    .join("");

  mount.innerHTML = `
    <aside class="leaderboard" aria-label="Cei mai activi utilizatori">
      <h3 class="leaderboard__title"><span aria-hidden="true">🏆</span> Cei mai activi</h3>
      ${podium}
      <ol class="lb-list">${rows}</ol>
      <p class="leaderboard__foot">Câștigi puncte terminând lecții și fiind activ în comunitate.</p>
    </aside>`;
  mount.hidden = false;

  countUp(mount);
  podiumConfetti(mount);
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

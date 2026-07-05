// =========================================================
// XP bar — a fixed strip under the header (logged-in users only), visible
// on every page and while scrolling. Shows the current level as a rich,
// progressive progress bar. 20 levels, each HARDER to fill (realistic
// curve) and each visibly FANCIER: things accumulate level by level —
//   • an emblem that upgrades (🌱 → … → 👑) with a rotating shine ring
//   • the bar thickens ~1px per level
//   • "prestige" stars above (sub-rank within a 4-level tier)
//   • the fill splits into glowing segments/pips
//   • milestone flags on the track light up as you pass them
//   • stripes → shimmer → gradient flow → gloss → sparkle → animated frame
// Level 20 also frames the whole page. Level-up pops a confetti burst from
// the bar tip + a "Nivel N!" toast. Mock (reads MY_PROFILE.points).
// =========================================================
import { MY_PROFILE } from "./community-data.js";
import { isLoggedIn, isAdmin, CURRENT_USER } from "./session.js";
import { burstAt } from "./points-fx.js";
import { notifTotal } from "./notif.js";

export const MAX_LEVEL = 20;

// Points to go FROM level n TO level n+1 (n^1.4 → smooth, realistic).
function levelCost(n) {
  return Math.round(60 * Math.pow(n, 1.4));
}
const THRESH = (() => {
  const t = [0, 0];
  for (let L = 2; L <= MAX_LEVEL; L++) t[L] = t[L - 1] + levelCost(L - 1);
  return t;
})();

// One full run = reach level 20 AND fill its bar. Completing a run =
// "prestige": the bar resets to level 1 and you earn a permanent star.
export const RUN_TOTAL = THRESH[MAX_LEVEL] + levelCost(MAX_LEVEL);

export function levelInfo(points) {
  const prestige = Math.floor(points / RUN_TOTAL); // completed runs = stars
  const p = points - prestige * RUN_TOTAL; // points within the current run
  let level = 1;
  for (let L = 1; L <= MAX_LEVEL; L++) {
    if (p >= THRESH[L]) level = L;
    else break;
  }
  const cur = THRESH[level];
  const next = level < MAX_LEVEL ? THRESH[level + 1] : RUN_TOTAL; // L20 fills toward prestige
  const pct = Math.max(0, Math.min(100, ((p - cur) / (next - cur)) * 100));
  return { level, prestige, pct, cur, next, pointsInRun: p, points };
}

// Emblems: growth → energy → medals → cosmic → trophy → crown ("toate").
const EMBLEMS = ["⚪", "🌱", "🌿", "🍀", "⭐", "🌟", "🔥", "⚡", "🥉", "🥈", "🥇", "🏅", "🎖️", "💎", "☄️", "🌠", "🚀", "🌌", "🏆", "👑"];

// Fill gradients: dull grey → wide holographic.
const FILLS = [
  "#c7ccd6",
  "#aab2c2",
  "linear-gradient(90deg,#8b93a5,#7c8598)",
  "linear-gradient(90deg,#8b5cf6,#a78bfa)",
  "linear-gradient(90deg,#7c3aed,#8b5cf6)",
  "linear-gradient(90deg,#7c3aed,#6366f1)",
  "linear-gradient(90deg,#7c3aed,#2563eb)",
  "linear-gradient(90deg,#6d28d9,#2563eb)",
  "linear-gradient(90deg,#7c3aed,#0891b2)",
  "linear-gradient(90deg,#7c3aed,#db2777)",
  "linear-gradient(90deg,#db2777,#f59e0b)",
  "linear-gradient(90deg,#7c3aed,#db2777,#0891b2)",
  "linear-gradient(90deg,#6d28d9,#db2777,#0891b2)",
  "linear-gradient(90deg,#7c3aed,#ec4899,#f59e0b)",
  "linear-gradient(90deg,#7c3aed,#2563eb,#0891b2,#22c55e)",
  "linear-gradient(90deg,#a21caf,#7c3aed,#2563eb,#0891b2)",
  "linear-gradient(90deg,#f59e0b,#db2777,#7c3aed,#2563eb)",
  "linear-gradient(90deg,#22d3ee,#818cf8,#e879f9,#f59e0b)",
  "linear-gradient(90deg,#7c3aed,#db2777,#f59e0b,#22c55e,#0891b2)",
  "linear-gradient(90deg,#a78bfa,#f472b6,#fbbf24,#34d399,#22d3ee,#a78bfa)",
];

// The full "skin" for a level: fill + accumulating feature classes + the
// emblem, segment count and prestige stars. Exported so the admin preview
// can render every level identically.
export function xpSkin(level) {
  const c = [];
  if (level >= 5) c.push("xp--seg");
  if (level >= 7) c.push("xp--stripes");
  if (level >= 8) c.push("xp--flags");
  if (level >= 9) c.push("xp--stripes-move");
  if (level >= 10) c.push("xp--shimmer");
  if (level >= 12) c.push("xp--flow");
  if (level >= 13) c.push("xp--ring");
  if (level >= 14) c.push("xp--gloss");
  if (level >= 16) c.push("xp--sparkle");
  if (level >= 18) c.push("xp--frameborder");
  if (level >= MAX_LEVEL) c.push("xp--max"); // level 20: wavy "sea" surface
  return {
    fill: FILLS[level - 1],
    classes: c.join(" "),
    emblem: EMBLEMS[level - 1],
    segCount: Math.min(16, 3 + Math.floor(level * 0.7)),
  };
}

// The inner HTML for a bar (shared by the live bar + admin previews).
export function xpBarMarkup(withMeta = true) {
  return `
    <div class="xp__inner container">
      <span class="xp__emblem"><span class="xp__ring"></span><span class="xp__emblem-ic">🌱</span></span>
      <span class="xp__badge"><b class="xp__lvl">1</b><span class="xp__lvl-lbl">Nivel</span></span>
      <div class="xp__wrap">
        <div class="xp__stars"></div>
        <div class="xp__track">
          <span class="xp__flag" style="left:33%"></span>
          <span class="xp__flag" style="left:66%"></span>
          <div class="xp__fill"><span class="xp__seg"></span><span class="xp__wave"></span><span class="xp__shine"></span><span class="xp__spark"></span></div>
        </div>
      </div>
      ${withMeta ? '<span class="xp__meta"></span>' : ""}
    </div>`;
}

// Permanent prestige stars (each earned by completing the whole bar), shown
// only from prestige 1 up, and drawn progressively bigger.
export function prestigeStarsHtml(prestige) {
  if (!prestige || prestige < 1) return "";
  const shown = Math.min(prestige, 5); // keep at most 5 stars
  let h = "";
  for (let i = 1; i <= shown; i++) {
    const size = (0.8 + (i - 1) * 0.3).toFixed(2); // 0.8 → 2.0rem, clearly bigger each step
    h += `<span class="xp__star" style="font-size:${size}rem">★</span>`;
  }
  if (prestige > 5) h += `<span class="xp__star--more">×${prestige}</span>`;
  return h;
}

// Apply a level's skin to a `.xp` element (live bar or a preview).
export function applyBar(barEl, level, pct, prestige = 0) {
  const s = xpSkin(level);
  barEl.className = `xp ${s.classes}${prestige >= 1 ? " xp--prestige xp--complete" : ""}${barEl.classList.contains("xp--preview") ? " xp--preview" : ""}`;
  barEl.dataset.level = level;
  barEl.style.setProperty("--xp-fill", s.fill);
  barEl.style.setProperty("--lvl", level);
  barEl.style.setProperty("--seg", s.segCount);
  const ic = barEl.querySelector(".xp__emblem-ic");
  if (ic) ic.textContent = s.emblem;
  const lvl = barEl.querySelector(".xp__lvl");
  if (lvl) lvl.textContent = level;
  const stars = barEl.querySelector(".xp__stars");
  if (stars) stars.innerHTML = prestigeStarsHtml(prestige);
  const fill = barEl.querySelector(".xp__fill");
  if (fill) fill.style.width = `${pct}%`;
  barEl.querySelectorAll(".xp__flag").forEach((f) => {
    const at = parseFloat(f.style.left) || 0;
    f.classList.toggle("is-passed", pct >= at);
  });
}

// ---------------- Live bar ----------------
let inited = false;
let el, spacer, frame, metaEl, toastEl, toastTimer;
let barBasePath = "";
let lastLevel = 0;
let lastPrestige = null;
let previewLevel = null;
let previewPrestige = 0;

export function initXpBar(basePath = "") {
  if (inited || typeof document === "undefined") return;
  inited = true;
  barBasePath = basePath;

  el = document.createElement("div");
  el.className = "xp";
  el.id = "xp-bar"; // the live bar (distinct from admin preview bars)
  el.setAttribute("role", "status");
  el.innerHTML = `${xpBarMarkup(true)}<div class="xp__toast" hidden></div>`;
  // The member's identity lives ON the progress row — like any real site.
  // It's a BUTTON: clicking it opens the notification center.
  el.querySelector(".xp__inner")?.insertAdjacentHTML("afterbegin", `<button type="button" class="xp__user" title="Click: Pagina mea · Hover: noutățile tale"></button>`);
  window.addEventListener("focus", updateUserChip);
  window.addEventListener("atelier:notifs", updateUserChip); // badge follows the tray

  spacer = document.createElement("div");
  spacer.className = "xp-spacer";

  frame = document.createElement("div");
  frame.className = "xp-frame";
  frame.setAttribute("aria-hidden", "true");
  frame.hidden = true;

  const attach = () => {
    document.body.appendChild(el); // fixed → top tracked to header bottom
    document.body.appendChild(frame);
    const header = document.getElementById("header");
    if (header && header.parentNode) header.insertAdjacentElement("afterend", spacer);
    else document.body.appendChild(spacer);
  };
  if (document.body) attach();
  else document.addEventListener("DOMContentLoaded", attach, { once: true });

  metaEl = el.querySelector(".xp__meta");
  toastEl = el.querySelector(".xp__toast");

  window.addEventListener("atelier:points", () => refresh(true));
  window.addEventListener("atelier:points-hit", pulse);
  window.addEventListener("atelier:role", refreshVisibility);

  // Click the PROGRESS BAR → an interactive peek at the NEXT level's bar.
  // (Clicks on the user chip are the chip's business — see site-chrome.)
  el.style.cursor = "pointer";
  el.title = "Vezi ce te așteaptă la nivelul următor";
  el.addEventListener("click", (e) => {
    if (e.target.closest(".xp__user")) return;
    showNextPopup(e);
  });

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateLayout();
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updateLayout);
  window.addEventListener("load", updateLayout);
  requestAnimationFrame(updateLayout);

  refreshVisibility();
}

/** Simulate a level + prestige (admin preview) so all skins, prestige
 *  stars and the page frame can be seen without earning points. Pass
 *  level = null to return to the real state. */
export function setPreview(level, prestige = 0) {
  previewLevel = level == null ? null : Math.max(1, Math.min(MAX_LEVEL, level | 0));
  previewPrestige = Math.max(0, prestige | 0);
  refreshVisibility();
}

/** The identity chip on the bar: avatar + name + the "what's new" BADGE.
 *  Clicking it opens the notification center (wired in site-chrome). */
function updateUserChip() {
  const chip = el?.querySelector(".xp__user");
  if (!chip) return;
  const avatar = MY_PROFILE.avatar
    ? `<span class="xp__user-av" style="background-image:url('${barBasePath}${MY_PROFILE.avatar}')" role="img" aria-label="Avatarul tău"></span>`
    : `<span class="xp__user-av xp__user-av--init" style="--a:${CURRENT_USER.color}">${CURRENT_USER.initials}</span>`;
  // Same source as the hover panel (notif.js) — badge ⇔ rows, always.
  const total = notifTotal();
  chip.innerHTML = `${avatar}<b class="xp__user-name">${CURRENT_USER.name}</b>${total ? `<b class="xp__user-badge">${total}</b>` : ""}`;
}

function refreshVisibility() {
  if (!el) return;
  // Members only — the ADMIN (teacher) doesn't earn points, so he has no
  // progress bar. Exception: while the admin simulator (Gamificare tab)
  // previews a level, the bar shows so he can see what members see.
  const on = isLoggedIn() && (!isAdmin() || previewLevel != null);
  el.style.display = on ? "" : "none";
  if (on) updateUserChip();
  spacer.style.display = on ? "" : "none";
  if (on) refresh(false);
  else {
    frame.hidden = true;
    document.body.classList.remove("has-maxframe");
  }
}

function refresh(canLevelUp) {
  if (!el || el.style.display === "none") return;
  const preview = previewLevel != null;
  const info = preview
    ? { level: previewLevel, pct: 62, prestige: previewPrestige, pointsInRun: 0, next: 0 }
    : levelInfo(MY_PROFILE.points);

  // Once bar 20 has been completed (prestige ≥ 1) the bar stays "drawn" in
  // its finished state (full, level-20 look, gently pulsing); from then on
  // only the stars grow. Before that, it shows the current level's progress.
  const completed = info.prestige >= 1;
  const dispLevel = completed ? MAX_LEVEL : info.level;
  const dispPct = completed ? 100 : info.pct;

  applyBar(el, dispLevel, dispPct, info.prestige);
  if (metaEl) {
    const star = info.prestige ? `⭐×${info.prestige} · ` : "";
    metaEl.textContent = completed
      ? `${star}bară completă`
      : preview
      ? `Nivel ${info.level} · previzualizare`
      : `${Math.round(info.pointsInRun).toLocaleString("ro-RO")} / ${info.next.toLocaleString("ro-RO")}`;
  }

  // Level 20 (or a completed bar) frames the whole page.
  const maxed = dispLevel >= MAX_LEVEL;
  frame.hidden = !maxed;
  document.body.classList.toggle("has-maxframe", maxed);

  if (canLevelUp && !preview) {
    if (lastPrestige != null && info.prestige > lastPrestige) prestigeUp(info);
    // Level-up toasts only during the first run (before the bar is completed).
    else if (info.prestige === 0 && lastLevel && info.level > lastLevel) levelUp(info);
  }
  if (!preview) {
    lastLevel = info.level;
    lastPrestige = info.prestige;
  }

  updateLayout();
}

function tipBurst(amount) {
  const fill = el.querySelector(".xp__fill");
  if (!fill) return;
  const fr = fill.getBoundingClientRect();
  if (fr.width > 0) burstAt(Math.min(fr.right, el.getBoundingClientRect().right - 10), fr.top + fr.height / 2, amount);
}

function levelUp(info) {
  // The full bar "molts" (shakes) and then transforms into the next one.
  el.classList.add("xp--levelup", "xp--molt");
  setTimeout(() => el.classList.remove("xp--molt"), 600);
  setTimeout(() => el.classList.remove("xp--levelup"), 900);
  toast(`Nivel ${info.level}! 🎉`);
  tipBurst(26);
}

// Completing the whole bar (level 20 filled) → prestige: reset to level 1,
// earn a permanent (bigger) star.
function prestigeUp(info) {
  el.classList.add("xp--levelup");
  setTimeout(() => el.classList.remove("xp--levelup"), 1200);
  toast(`Renaștere! ⭐ Prestige ${info.prestige}`);
  const r = el.getBoundingClientRect();
  burstAt(r.left + r.width / 2, r.bottom, 46);
}

function pulse() {
  if (!el || el.style.display === "none") return;
  el.classList.remove("xp--hit");
  void el.offsetWidth;
  el.classList.add("xp--hit");
  setTimeout(() => el.classList.remove("xp--hit"), 520);
}

// ---------------- "What's next" popup ----------------
// Click the live bar → a small interactive card showing the NEXT level's
// bar (fully drawn, animations running) + what it unlocks + points left.
// It retracts on any click or a mouse-wheel move.
const PERK_LABELS = {
  5: "bara se împarte în segmente luminoase",
  7: "dungi fine pe umplere",
  8: "steaguri de etapă pe traseu",
  9: "dungile încep să se miște",
  10: "strălucire (shimmer) pe umplere",
  12: "gradient curgător",
  13: "inel rotitor la emblemă",
  14: "reflexie gloss",
  16: "scântei",
  18: "ramă animată a barei",
  20: "valuri pe umplere + rama întregii pagini",
};

let popEl = null;

function perksFor(level) {
  const list = [`emblemă nouă: ${EMBLEMS[level - 1]}`, "culori noi pe umplere"];
  if (PERK_LABELS[level]) list.push(PERK_LABELS[level]);
  return list;
}

function showNextPopup(e) {
  e?.stopPropagation();
  if (popEl) return closeNextPopup();

  const preview = previewLevel != null;
  const info = preview
    ? { level: previewLevel, prestige: previewPrestige, pointsInRun: 0, next: 0 }
    : levelInfo(MY_PROFILE.points);
  const completed = info.prestige >= 1;
  const cur = completed ? MAX_LEVEL : info.level;
  const maxed = cur >= MAX_LEVEL;
  const next = Math.min(MAX_LEVEL, cur + 1);
  const remaining = preview || maxed ? null : Math.max(0, Math.round(info.next - info.pointsInRun));

  const title = maxed
    ? "Nivel maxim! Urmează o stea de prestige ⭐"
    : `Următorul nivel: ${next}`;
  const sub = maxed
    ? "Completează bara și primești o stea permanentă — bara renaște de la 1."
    : remaining != null
      ? `Îți mai trebuie <b>${remaining.toLocaleString("ro-RO")}</b> puncte. Așa va arăta bara ta:`
      : "Așa va arăta bara ta:";
  const perks = maxed
    ? [`o stea ⭐ permanentă deasupra barei`, `steaua crește cu fiecare renaștere`]
    : perksFor(next);

  popEl = document.createElement("div");
  popEl.className = "xp-pop";
  popEl.setAttribute("role", "dialog");
  popEl.setAttribute("aria-label", "Nivelul următor");
  popEl.innerHTML = `
    <div class="xp-pop__card">
      <p class="xp-pop__title">${title}</p>
      <p class="xp-pop__sub">${sub}</p>
      <div class="xp xp--preview xp-pop__bar">${xpBarMarkup(false)}</div>
      <ul class="xp-pop__perks">${perks.map((p) => `<li>${p}</li>`).join("")}</ul>
      <p class="xp-pop__hint">click sau scroll ca să închizi</p>
    </div>`;
  document.body.appendChild(popEl);

  const bar = popEl.querySelector(".xp-pop__bar");
  applyBar(bar, maxed ? MAX_LEVEL : next, 100, maxed ? info.prestige + 1 : info.prestige);
  requestAnimationFrame(() => popEl && popEl.classList.add("is-in"));

  // Any click or a wheel move retracts it (Esc too).
  popEl.addEventListener("click", closeNextPopup);
  window.addEventListener("wheel", closeNextPopup, { once: true, passive: true });
  window.addEventListener("keydown", escNextPopup);
}

function escNextPopup(e) {
  if (e.key === "Escape") closeNextPopup();
}

function closeNextPopup() {
  if (!popEl) return;
  const gone = popEl;
  popEl = null;
  window.removeEventListener("keydown", escNextPopup);
  gone.classList.remove("is-in");
  setTimeout(() => gone.remove(), 220);
}

function updateLayout() {
  const header = document.querySelector(".site-header");
  const headBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  const barVisible = el && el.style.display !== "none";
  // Offset for any sticky panel: it must clear the header AND the XP bar,
  // with a comfortable gap. Both shrink as you scroll, so we track them live
  // and expose one CSS variable used everywhere (single source of truth).
  let stickyTop = headBottom;
  if (barVisible) {
    el.style.top = `${headBottom}px`;
    if (spacer) spacer.style.height = `${el.offsetHeight}px`;
    stickyTop = headBottom + el.offsetHeight;
  }
  document.documentElement.style.setProperty("--sticky-top", `${Math.round(stickyTop) + 16}px`);
}

function toast(text) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.hidden = false;
  toastEl.classList.remove("is-in");
  void toastEl.offsetWidth;
  toastEl.classList.add("is-in");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("is-in");
    setTimeout(() => {
      toastEl.hidden = true;
    }, 320);
  }, 2200);
}

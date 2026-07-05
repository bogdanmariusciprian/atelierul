// =========================================================
// Points burst — a tasteful "you earned points" flourish around the
// cursor. One full-viewport canvas (pointer-events: none) draws crisp
// particles with real physics + a subtle expanding ring; a floating
// "+N" pill rises and fades. Brand palette, fine/feathered, no harsh glow.
//
// Decoupled via a global event so any module can trigger it without
// importing this file's internals:
//     pointsFx(amount)   → dispatches "atelier:points"
//     initPointsFx()     → sets up the overlay + cursor tracking (idempotent)
//
// Respects prefers-reduced-motion (shows just the "+N", no particles).
// =========================================================

const PALETTE = ["#7c3aed", "#db2777", "#0891b2", "#f59e0b", "#22c55e", "#ffffff"];
const EVT = "atelier:points";

let inited = false;
let canvas, ctx, layer;
let dpr = 1;
let particles = [];
let rings = [];
let running = false;
let lastT = 0;
const cursor = { x: 0, y: 0, has: false };
const reduce = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Trigger the effect from anywhere (decoupled). */
export function pointsFx(amount) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: { amount } }));
}

/** Set up the overlay + listeners once. Safe to call repeatedly. */
export function initPointsFx() {
  if (inited || typeof document === "undefined") return;
  inited = true;

  layer = document.createElement("div");
  layer.className = "points-fx";
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    pointerEvents: "none",
    overflow: "hidden",
  });

  canvas = document.createElement("canvas");
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
  layer.appendChild(canvas);
  ctx = canvas.getContext("2d");

  const attach = () => document.body && document.body.appendChild(layer);
  if (document.body) attach();
  else document.addEventListener("DOMContentLoaded", attach, { once: true });

  resize();
  window.addEventListener("resize", resize);

  // Track the cursor so bursts appear right where the user is.
  const track = (e) => {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    cursor.x = t.clientX;
    cursor.y = t.clientY;
    cursor.has = true;
  };
  window.addEventListener("pointermove", track, { passive: true });
  window.addEventListener("pointerdown", track, { passive: true });

  window.addEventListener(EVT, (e) => burst(e.detail && e.detail.amount));
}

function resize() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function pos() {
  return cursor.has ? { x: cursor.x, y: cursor.y } : { x: innerWidth / 2, y: innerHeight / 2 };
}

/** Fire a burst of `amount` points at the current cursor position, with a
 *  "+N" that flies toward the XP bar. */
export function burst(amount) {
  const { x, y } = pos();
  floatingLabel(x, y, amount);
  spawn(x, y, amount);
}

/** Particles-only burst at a given point (used for the level-up flourish
 *  from the XP bar tip). No floating number. */
export function burstAt(x, y, amount) {
  spawn(x, y, amount);
}

function spawn(x, y, amount) {
  if (reduce()) return; // motion-averse users: just the "+N"

  // Rings — thin, low-opacity, expand + fade (subtle, not a glow).
  rings.push({ x, y, r: 8, maxR: 90, life: 0, dur: 620, w: 2 });
  rings.push({ x, y, r: 4, maxR: 60, life: -90, dur: 520, w: 1.5 });

  // Particles — a scaled amount so bigger rewards feel bigger.
  const n = Math.max(16, Math.min(46, 14 + Math.round((amount || 10) * 1.1)));
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    // Bias slightly upward so it feels celebratory, like it "lifts".
    const speed = 52 + Math.random() * 165; // eased down a touch
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed - 62;
    const shape = Math.random() < 0.34 ? "star" : Math.random() < 0.6 ? "rect" : "dot";
    particles.push({
      x,
      y,
      vx,
      vy,
      size: shape === "dot" ? 2 + Math.random() * 3 : 3 + Math.random() * 5,
      color: PALETTE[(Math.random() * PALETTE.length) | 0],
      life: 0,
      dur: 900 + Math.random() * 750,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 9,
      shape,
    });
  }
  if (!running) {
    running = true;
    lastT = performance.now();
    requestAnimationFrame(loop);
  }
}

function loop(now) {
  const dt = Math.min(48, now - lastT) / 1000;
  lastT = now;
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  // Rings
  for (const r of rings) {
    r.life += dt * 1000;
    if (r.life < 0) continue;
    const t = r.life / r.dur;
    if (t >= 1) continue;
    const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
    const rad = r.r + (r.maxR - r.r) * e;
    ctx.beginPath();
    ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(124,58,237,${(1 - t) * 0.35})`;
    ctx.lineWidth = r.w;
    ctx.stroke();
  }
  rings = rings.filter((r) => r.life < r.dur);

  // Particles
  for (const p of particles) {
    p.life += dt * 1000;
    p.vy += 300 * dt; // gravity (a touch gentler)
    p.vx *= 0.985; // drag
    p.vy *= 0.985;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vrot * dt;
    const t = p.life / p.dur;
    const alpha = t >= 1 ? 0 : Math.pow(1 - t, 0.8);
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === "dot") {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === "rect") {
      ctx.fillRect(-p.size / 2, -p.size * 0.32, p.size, p.size * 0.64);
    } else {
      star(ctx, p.size * 1.5);
    }
    ctx.restore();
  }
  particles = particles.filter((p) => p.life < p.dur);

  if (particles.length || rings.length) {
    requestAnimationFrame(loop);
  } else {
    running = false;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
}

// A crisp 4-point sparkle.
function star(c, r) {
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    const a2 = a + Math.PI / 4;
    c.lineTo(Math.cos(a2) * r * 0.34, Math.sin(a2) * r * 0.34);
  }
  c.closePath();
  c.fill();
}

// The floating "+N" pill (DOM element → crisp text + gradient).
function floatingLabel(x, y, amount) {
  if (!layer) return;
  const el = document.createElement("span");
  el.className = "points-fx__num";
  el.textContent = `+${amount ?? 0}`;
  Object.assign(el.style, {
    position: "absolute",
    left: `${x}px`,
    top: `${y - 14}px`,
    transform: "translate(-50%,-50%)",
    font: "800 1.15rem/1 system-ui, sans-serif",
    letterSpacing: "0.01em",
    padding: "0.15rem 0.6rem",
    borderRadius: "999px",
    color: "#fff",
    background: "linear-gradient(135deg,#7c3aed,#db2777 55%,#0891b2)",
    boxShadow: "0 6px 18px -8px rgba(124,58,237,0.7)",
    whiteSpace: "nowrap",
    willChange: "transform, opacity",
  });
  layer.appendChild(el);

  // Where should the "+N" go? Toward the XP bar's fill tip, if present.
  const tgt = barTarget();

  let frames;
  if (reduce() || !tgt) {
    // No bar (or reduced motion): pop, linger, drift up + fade.
    frames = [
      { transform: "translate(-50%,-50%) translateY(6px) scale(0.6)", opacity: 0, offset: 0 },
      { transform: "translate(-50%,-50%) translateY(-8px) scale(1.12)", opacity: 1, offset: 0.1 },
      { transform: "translate(-50%,-50%) translateY(-12px) scale(1)", opacity: 1, offset: 0.16 },
      { transform: "translate(-50%,-50%) translateY(-30px) scale(1)", opacity: 1, offset: 0.72 },
      { transform: "translate(-50%,-50%) translateY(-52px) scale(1)", opacity: 0, offset: 1 },
    ];
  } else {
    // Pop + linger near the cursor, then fly to the bar and fade on arrival.
    const dx = tgt.x - x;
    const dy = tgt.y - y;
    frames = [
      { transform: "translate(-50%,-50%) translate(0,6px) scale(0.6)", opacity: 0, offset: 0 },
      { transform: "translate(-50%,-50%) translate(0,-8px) scale(1.12)", opacity: 1, offset: 0.08 },
      { transform: "translate(-50%,-50%) translate(0,-10px) scale(1)", opacity: 1, offset: 0.14 },
      { transform: "translate(-50%,-50%) translate(0,-12px) scale(1)", opacity: 1, offset: 0.5, easing: "cubic-bezier(0.5,0,0.75,0)" },
      { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(0.55)`, opacity: 0, offset: 1 },
    ];
    // When it "arrives", nudge the bar to react.
    setTimeout(() => window.dispatchEvent(new CustomEvent("atelier:points-hit")), 1900);
  }

  const anim = el.animate(frames, { duration: 2200, easing: "cubic-bezier(0.22,1,0.36,1)" });
  anim.onfinish = () => el.remove();
  anim.oncancel = () => el.remove();
}

/** The XP bar's fill tip (or center) in viewport coords, if the bar shows. */
function barTarget() {
  const bar = document.getElementById("xp-bar");
  if (!bar || bar.offsetParent === null) return null;
  const r = bar.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const fill = bar.querySelector(".xp__fill");
  const fr = fill ? fill.getBoundingClientRect() : r;
  const tipX = fill && fr.width > 0 ? Math.min(fr.right, r.right - 10) : r.left + r.width * 0.5;
  return { x: tipX, y: r.top + r.height / 2 };
}

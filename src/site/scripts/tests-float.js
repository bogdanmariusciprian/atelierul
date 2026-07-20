// =========================================================
// The „Exersează" ball, adrift in its tank — a Chuzzle-style blob.
//
// The tank is a fixed box beside the archive; the ball is a body inside it,
// moving on its own and bouncing off the walls. Because the tank is sticky, it
// stays put while a long list of papers scrolls past — so scrolling is the
// user shaking the container, and the body sloshes.
//
// Two simulations run side by side:
//
//   TRAVEL — constant velocity, integrated against real elapsed time so the
//   motion matches on a 60Hz and a 144Hz screen. Walls reflect it and keep a
//   fraction of the energy; a floor on the speed stops it dying in a corner.
//
//   JELLY — the shape is a DAMPED SPRING, not an animation. On impact it
//   squashes along the wall's normal by an amount proportional to how hard it
//   hit, then oscillates back to round on its own. That's why a fast bounce
//   looks heavier than a slow one without a single extra rule: the same spring
//   simply starts further from rest. Volume is roughly conserved — squashed on
//   one axis means stretched on the other — which is what makes it read as
//   rubber rather than as a picture being resized.
//
// Transforms are split across two elements on purpose: the outer one carries
// position and squash (world axes, so a wall on the left always squashes
// left-to-right), the inner one carries the tilt. Nesting them the other way
// would spin the squash along with the body and it would look like shearing.
//
// It refuses to run when it shouldn't: „reduced motion" in the OS, narrow
// screens, a hidden tab, or a tank scrolled out of view.
// Content Romanian, identifiers English.
// =========================================================

const REST = 0.86;       // energy kept after a wall bounce
const DRAG = 0.4;        // velocity lost per second while drifting
const V_MIN = 26;        // px/s — below this it gets a nudge, never stalls
const V_MAX = 520;       // px/s — above this it looks frantic, not playful
const TILT = 0.05;       // degrees of lean per px/s of horizontal speed
const HOVER_DAMP = 6;    // how hard the brakes are while pointed at
const SCROLL_PUSH = 2.2; // px/s of kick per px scrolled

// The jelly. K sets the wobble's pitch, C how fast it calms down.
// ζ = C / (2·√K) ≈ 0.4 — underdamped, so you get a couple of visible wobbles
// before it settles. Higher C and it would look like putty; lower and it would
// ring like a bell and never stop.
const K = 220, C = 12;
const SQUASH_MAX = 0.42; // hardest possible impact: 42% flatter
const BULGE = 0.8;       // how much of the squash comes back on the other axis
const IDLE_HZ = 0.55;    // the slow breathing while it drifts, in cycles/s
const IDLE_AMP = 0.022;

const reduceMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Start the float. Returns a stop() that undoes everything it hooked up. */
export function initFloatingPlay(tank) {
  const ball = tank?.querySelector(".tcat__ball");
  const inner = tank?.querySelector(".tcat__ball__in");
  if (!tank || !ball || !inner) return () => {};

  // Static fallback: centred, no loop, no listeners. Same button, same link —
  // only the motion is gone.
  if (reduceMotion() || !window.matchMedia("(min-width: 981px)").matches) {
    tank.classList.add("is-still");
    return () => tank.classList.remove("is-still");
  }

  const S = {
    x: 0, y: 0,
    vx: 150 * (Math.random() < 0.5 ? -1 : 1),
    vy: 110 * (Math.random() < 0.5 ? -1 : 1),
    tilt: 0,
    d: 0, dv: 0, axis: "x", // jelly: deformation, its velocity, which way
    t: Math.random() * 10,  // clock for the idle breathing
    hot: false,
    raf: 0, last: 0,
  };

  const bounds = () => ({
    w: Math.max(0, tank.clientWidth - ball.offsetWidth),
    h: Math.max(0, tank.clientHeight - ball.offsetHeight),
  });

  // Start in the middle third, so it never appears half-buried in a corner.
  const b0 = bounds();
  S.x = b0.w * (0.33 + Math.random() * 0.34);
  S.y = b0.h * (0.33 + Math.random() * 0.34);

  // A wall was hit: kick the spring. Sharper impacts start it further out, so
  // the wobble that follows is bigger and lasts longer — all from one number.
  const hit = (axis, speed) => {
    const strength = Math.min(SQUASH_MAX, Math.max(0.06, (speed / V_MAX) * SQUASH_MAX));
    if (Math.abs(strength) > Math.abs(S.d)) { S.axis = axis; S.d = strength; S.dv = 0; }
  };

  function draw() {
    // The idle breath rides on top of the impact spring, so the blob is never
    // perfectly still — that's most of what makes it feel alive.
    const idle = S.hot ? 0 : Math.sin(S.t * Math.PI * 2 * IDLE_HZ) * IDLE_AMP;
    const d = S.d + idle;
    const sx = S.axis === "x" ? 1 - d : 1 + d * BULGE;
    const sy = S.axis === "x" ? 1 + d * BULGE : 1 - d;
    ball.style.transform =
      `translate3d(${S.x.toFixed(1)}px, ${S.y.toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    inner.style.transform = `rotate(${S.tilt.toFixed(2)}deg)`;
  }
  draw();

  function step(now) {
    S.raf = requestAnimationFrame(step);
    // Clamp dt: a backgrounded tab hands back a huge gap, and integrating it
    // would teleport the body straight through a wall.
    const dt = Math.min(0.05, (now - (S.last || now)) / 1000);
    S.last = now;
    if (!dt) return;
    S.t += dt;

    const b = bounds();
    if (!b.w || !b.h) return; // tank not laid out yet

    if (S.hot) {
      const k = Math.exp(-HOVER_DAMP * dt);
      S.vx *= k; S.vy *= k;
    } else {
      const k = Math.exp(-DRAG * dt);
      S.vx *= k; S.vy *= k;
      const sp = Math.hypot(S.vx, S.vy);
      if (sp < V_MIN) {
        const a = sp > 1 ? Math.atan2(S.vy, S.vx) : Math.random() * Math.PI * 2;
        S.vx = Math.cos(a) * V_MIN * 1.6;
        S.vy = Math.sin(a) * V_MIN * 1.6;
      } else if (sp > V_MAX) {
        S.vx *= V_MAX / sp; S.vy *= V_MAX / sp;
      }
    }

    S.x += S.vx * dt;
    S.y += S.vy * dt;

    // Walls. Reflect, lose a little energy, put the body back inside, and tell
    // the jelly how hard it landed.
    if (S.x < 0) { S.x = 0; hit("x", Math.abs(S.vx)); S.vx = Math.abs(S.vx) * REST; }
    else if (S.x > b.w) { S.x = b.w; hit("x", Math.abs(S.vx)); S.vx = -Math.abs(S.vx) * REST; }
    if (S.y < 0) { S.y = 0; hit("y", Math.abs(S.vy)); S.vy = Math.abs(S.vy) * REST; }
    else if (S.y > b.h) { S.y = b.h; hit("y", Math.abs(S.vy)); S.vy = -Math.abs(S.vy) * REST; }

    // The spring, integrated semi-implicitly: update the velocity from the
    // current position, THEN move. Plain Euler quietly adds energy here and the
    // wobble would grow instead of dying.
    S.dv += (-K * S.d - C * S.dv) * dt;
    S.d += S.dv * dt;
    if (Math.abs(S.d) < 0.0006 && Math.abs(S.dv) < 0.01) { S.d = 0; S.dv = 0; }

    // Leans into the direction of travel, straightens up when you point at it —
    // the label is readable exactly when you want to read it.
    S.tilt = S.hot
      ? S.tilt * Math.exp(-HOVER_DAMP * dt)
      : Math.max(-14, Math.min(14, S.tilt + S.vx * TILT * dt * 10));

    draw();
  }

  const start = () => { if (!S.raf) { S.last = 0; S.raf = requestAnimationFrame(step); } };
  const stop = () => { if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; } };

  // ---- what shakes the tank ----
  let lastY = window.scrollY;
  const onScroll = () => {
    const d = window.scrollY - lastY;
    lastY = window.scrollY;
    // Opposite to the scroll: the tank moved, the body stayed. Capped so a
    // flick of the wheel doesn't fire it across the box.
    S.vy = Math.max(-V_MAX, Math.min(V_MAX, S.vy - d * SCROLL_PUSH));
    S.vx += (Math.random() - 0.5) * Math.abs(d) * 0.8; // a little slosh sideways
  };

  const hotSet = (on) => { S.hot = on; tank.classList.toggle("is-open", on); };
  const onEnter = () => hotSet(true);
  const onLeave = () => hotSet(false);
  const onVis = () => (document.hidden ? stop() : start());
  const onResize = () => {
    const b = bounds();
    S.x = Math.max(0, Math.min(b.w, S.x));
    S.y = Math.max(0, Math.min(b.h, S.y));
    draw();
  };

  ball.addEventListener("pointerenter", onEnter);
  ball.addEventListener("pointerleave", onLeave);
  ball.addEventListener("focus", onEnter);
  ball.addEventListener("blur", onLeave);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVis);

  // Off-screen → stop the loop entirely. Nothing to look at, nothing to spend.
  const io = new IntersectionObserver(([e]) => {
    e.isIntersecting && !document.hidden ? start() : stop();
  }, { threshold: 0 });
  io.observe(tank);

  start();

  return () => {
    stop();
    io.disconnect();
    ball.removeEventListener("pointerenter", onEnter);
    ball.removeEventListener("pointerleave", onLeave);
    ball.removeEventListener("focus", onEnter);
    ball.removeEventListener("blur", onLeave);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVis);
  };
}

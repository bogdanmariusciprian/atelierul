// =========================================================
// The „Exersează" ball — a Chuzzle-ish blob with weight, in its tank.
//
// The tank is a fixed box beside the archive. Because it's sticky, it holds
// still while a long list of papers scrolls past: scrolling is the reader
// shaking the container, and the ball answers.
//
// Three simulations, each doing one job:
//
//   WEIGHT — gravity pulls it down, so its resting place is the floor. It
//   bounces, each bounce lower than the last, then rolls and stops. Scrolling
//   throws it upward; it arcs and falls back. Nothing floats here: if you leave
//   the page alone, the ball settles, like an object would.
//
//   JELLY — the shape is a DAMPED SPRING, not an animation. On impact it
//   squashes along the wall's normal by an amount proportional to how hard it
//   hit, then oscillates back to round on its own. A fast bounce therefore
//   looks heavier than a slow one without any extra rule: the same spring
//   simply starts further from rest. Volume is roughly conserved — flatter on
//   one axis means fatter on the other — which is what reads as rubber instead
//   of as a picture being resized.
//
//   ROLL — the ball turns about its vertical axis by the distance it travels
//   divided by its radius, which is what rolling without slipping means. The
//   label is painted on the surface, so it swings away and vanishes round the
//   back, then comes round again. Point at the ball and the spin eases back to
//   zero, bringing the word to face you — it hides while it plays, and shows
//   itself the moment you want to read it.
//
// Transforms are split across elements on purpose: the outer one carries
// position and squash (world axes, so the floor always squashes top-to-bottom),
// the inner one carries the spin. Nested the other way, the squash would turn
// with the body and read as shearing.
//
// It refuses to run when it shouldn't: „reduced motion" in the OS, narrow
// screens, a hidden tab, or a tank scrolled out of view.
// Content Romanian, identifiers English.
// =========================================================

const G = 1500;          // px/s² — gravity. Earth-ish for a 124px ball.
const WALL_REST = 0.78;  // energy kept bouncing off a side wall
const FLOOR_REST = 0.62; // …and off the floor. Lower, so it settles quickly.
const AIR = 0.12;        // velocity lost per second in flight
const ROLL = 1.6;        // …and per second while rolling on the floor
const V_SLEEP = 42;      // px/s — under this, on the floor, it lies down
const V_MAX = 620;
const SPIN_HOVER = 7;    // how fast the label swings back to face you
const HOVER_DAMP = 6;
const SCROLL_PUSH = 3.4; // px/s of kick per px scrolled — must beat gravity

// The jelly. K sets the wobble's pitch, C how fast it calms down.
// ζ = C / (2·√K) ≈ 0.4 — underdamped, so a couple of visible wobbles before it
// settles. Higher C looks like putty; lower rings like a bell and never stops.
const K = 220, C = 12;
const SQUASH_MAX = 0.42;
const BULGE = 0.8;
const IDLE_HZ = 0.55, IDLE_AMP = 0.02;

const reduceMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Start the float. Returns a stop() that undoes everything it hooked up. */
export function initFloatingPlay(tank) {
  const ball = tank?.querySelector(".tcat__ball");
  const inner = tank?.querySelector(".tcat__ball__in");
  const shadow = tank?.querySelector(".tcat__shadow");
  if (!tank || !ball || !inner) return () => {};

  if (reduceMotion() || !window.matchMedia("(min-width: 981px)").matches) {
    tank.classList.add("is-still");
    return () => tank.classList.remove("is-still");
  }

  const S = {
    x: 0, y: 0,
    vx: 190 * (Math.random() < 0.5 ? -1 : 1),
    vy: 0,
    spin: 0,                // degrees turned about the vertical axis
    d: 0, dv: 0, axis: "y", // jelly: deformation, its velocity, which way
    t: Math.random() * 10,
    grounded: false,
    hot: false,
    raf: 0, last: 0,
  };

  const bounds = () => ({
    w: Math.max(0, tank.clientWidth - ball.offsetWidth),
    h: Math.max(0, tank.clientHeight - ball.offsetHeight),
  });

  // It starts up high and drops in — the fall is the introduction, and it says
  // „this thing has weight" before the reader has to guess.
  const b0 = bounds();
  S.x = b0.w * (0.25 + Math.random() * 0.5);
  S.y = 0;

  const hit = (axis, speed) => {
    const strength = Math.min(SQUASH_MAX, Math.max(0.06, (speed / V_MAX) * SQUASH_MAX * 1.6));
    if (strength > Math.abs(S.d)) { S.axis = axis; S.d = strength; S.dv = 0; }
  };

  function draw() {
    const b = bounds();
    // The breath only runs while it's awake; a ball lying still on the floor
    // that keeps pulsing looks like it's out of breath, not alive.
    const idle = S.hot || (S.grounded && Math.abs(S.vx) < 6)
      ? 0 : Math.sin(S.t * Math.PI * 2 * IDLE_HZ) * IDLE_AMP;
    const d = S.d + idle;
    const sx = S.axis === "x" ? 1 - d : 1 + d * BULGE;
    const sy = S.axis === "x" ? 1 + d * BULGE : 1 - d;
    ball.style.transform =
      `translate3d(${S.x.toFixed(1)}px, ${S.y.toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    inner.style.transform = `rotateY(${S.spin.toFixed(2)}deg)`;

    // The cast shadow is the other half of „weight": it tightens and darkens as
    // the ball nears the floor, spreads and fades as it rises. Without it, a
    // falling circle is just a circle moving down.
    if (shadow && b.h > 0) {
      const air = Math.max(0, Math.min(1, (b.h - S.y) / b.h)); // 0 = landed
      const k = 1 - air * 0.55;
      shadow.style.transform =
        `translate3d(${(S.x + ball.offsetWidth / 2).toFixed(1)}px, 0, 0) translateX(-50%) scale(${k.toFixed(3)}, ${k.toFixed(3)})`;
      shadow.style.opacity = (0.34 * k).toFixed(3);
    }
  }
  draw();

  function step(now) {
    S.raf = requestAnimationFrame(step);
    // Clamp dt: a backgrounded tab hands back a huge gap, and integrating it
    // would drop the ball straight through the floor.
    const dt = Math.min(0.05, (now - (S.last || now)) / 1000);
    S.last = now;
    if (!dt) return;
    S.t += dt;

    const b = bounds();
    if (!b.w || !b.h) return; // tank not laid out yet

    if (S.hot) {
      // Brakes, so a moving target becomes an easy one.
      const k = Math.exp(-HOVER_DAMP * dt);
      S.vx *= k;
      if (!S.grounded) S.vy = S.vy * k + G * dt * 0.25; // still falls, gently
    } else {
      S.vy += G * dt;
      const k = Math.exp(-(S.grounded ? ROLL : AIR) * dt);
      S.vx *= k;
      const sp = Math.hypot(S.vx, S.vy);
      if (sp > V_MAX) { S.vx *= V_MAX / sp; S.vy *= V_MAX / sp; }
    }

    S.x += S.vx * dt;
    S.y += S.vy * dt;

    // Side walls.
    if (S.x < 0) { S.x = 0; hit("x", Math.abs(S.vx)); S.vx = Math.abs(S.vx) * WALL_REST; }
    else if (S.x > b.w) { S.x = b.w; hit("x", Math.abs(S.vx)); S.vx = -Math.abs(S.vx) * WALL_REST; }

    // Ceiling and floor. On the floor, a slow enough arrival stops bouncing
    // altogether — otherwise it would jitter forever on ever-smaller hops, the
    // classic way a physics toy betrays itself.
    S.grounded = false;
    if (S.y < 0) { S.y = 0; hit("y", Math.abs(S.vy)); S.vy = Math.abs(S.vy) * WALL_REST; }
    else if (S.y >= b.h) {
      S.y = b.h;
      if (Math.abs(S.vy) > V_SLEEP) { hit("y", Math.abs(S.vy)); S.vy = -Math.abs(S.vy) * FLOOR_REST; }
      else { S.vy = 0; S.grounded = true; }
    }

    // The spring, integrated semi-implicitly: velocity first, then position.
    // Plain Euler quietly adds energy here and the wobble would grow, not die.
    S.dv += (-K * S.d - C * S.dv) * dt;
    S.d += S.dv * dt;
    if (Math.abs(S.d) < 0.0006 && Math.abs(S.dv) < 0.01) { S.d = 0; S.dv = 0; }

    // Rolling without slipping: turn = distance ÷ radius. Pointed at, the spin
    // eases to zero by the shortest way round, so the word comes to face you.
    if (S.hot) {
      const target = Math.round(S.spin / 360) * 360;
      S.spin += (target - S.spin) * Math.min(1, SPIN_HOVER * dt);
    } else {
      const radius = Math.max(1, ball.offsetWidth / 2);
      S.spin += (S.vx * dt) / radius * (180 / Math.PI);
      if (S.spin > 3600 || S.spin < -3600) S.spin %= 360; // keep the number small
    }

    draw();
  }

  const start = () => { if (!S.raf) { S.last = 0; S.raf = requestAnimationFrame(step); } };
  const stop = () => { if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; } };

  // ---- what shakes the tank ----
  let lastY = window.scrollY;
  const onScroll = () => {
    const d = window.scrollY - lastY;
    lastY = window.scrollY;
    // Opposite to the scroll: the tank moved, the ball stayed. This is what
    // has to beat gravity, which is why its constant is the largest here.
    S.vy = Math.max(-V_MAX, Math.min(V_MAX, S.vy - d * SCROLL_PUSH));
    S.vx += (Math.random() - 0.5) * Math.abs(d) * 1.1; // a little slosh sideways
    S.grounded = false;
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

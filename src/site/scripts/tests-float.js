// =========================================================
// The „Exersează" ball — a Chuzzle-ish balloon, in its tank.
//
// The tank is a fixed box beside the archive. Because it's sticky, it holds
// still while a long list of papers scrolls past: scrolling is the reader
// shaking the container, and the ball answers.
//
// Three simulations, each doing one job:
//
//   LIFT — gravity is gentle and the air is thick, which together make a
//   balloon rather than a stone: it sinks lazily (the fall tops out around
//   300px/s, G ÷ AIR), keeps most of its energy off a wall, and bobs several
//   times before lying down. Its resting place is still the floor — but it
//   takes its time getting there. Scrolling throws it up again.
//
//   JELLY — the shape is a DAMPED SPRING, not an animation. The squash is
//   strictly proportional to the speed of the impact: a slow graze dents it 4%,
//   a full-speed slam 45%, and everything in between lands in between. Then it
//   oscillates back to round on its own. Volume is roughly conserved — flatter
//   on one axis means fatter on the other — which is what reads as rubber
//   instead of as a picture being resized.
//
//   ROLL — the ball turns about its vertical axis by the distance it travels
//   divided by its radius, which is what rolling without slipping means. The
//   word is not laid in front of the ball but ON it: test-category.js pushes
//   every letter out to the surface and angles it along the curve, so the spin
//   carries the outer letters past the edge and backface-visibility hides them.
//   The word wraps around the back and comes round again. Point at the ball and
//   the spin eases to zero, bringing the word to face you — it hides while it
//   plays, and shows itself the moment you want to read it.
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

const G = 430;           // px/s² — gentle gravity: it sinks, it doesn't drop.
const WALL_REST = 0.88;  // energy kept bouncing off a side wall — light things keep more
const FLOOR_REST = 0.80; // …and off the floor. High, so it keeps bobbing a while.
const AIR = 1.4;         // velocity lost per second in flight. THIS is the balloon:
                         // thick air caps the fall at ~300px/s (v = G/AIR) and makes
                         // every movement lazy, instead of a rock in a vacuum.
const ROLL = 1.1;        // …and per second while rolling on the floor
const V_SLEEP = 24;      // px/s — under this, on the floor, it lies down
const V_MAX = 520;
const SPIN_HOVER = 7;    // how fast the label swings back to face you
const HOVER_DAMP = 6;
const SCROLL_PUSH = 2.6; // px/s of kick per px scrolled — a lighter body needs less

// The jelly. K sets the wobble's pitch, C how fast it calms down.
// ζ = C / (2·√K) ≈ 0.35 — underdamped, and softer than a rubber ball's would be,
// because a balloon's skin ripples more and for longer. Higher C looks like
// putty; lower rings like a bell and never stops.
const K = 150, C = 8.5;
const SQUASH_MAX = 0.45;
const V_REF = 420;       // the speed that produces the FULL squash
const V_DENT = 52;       // …and the speed under which it doesn't dent at all
const BULGE = 0.8;
const IDLE_HZ = 0.45, IDLE_AMP = 0.026;
const WAKE_EASE = 3.2;   // how fast the breathing fades in and out, per second

// The magnet. Not a constant pull but a spring whose stiffness rises as the
// pointer gets closer, plus damping that rises with it — that pairing is what
// makes it settle ONTO the cursor instead of orbiting around it. Gravity is
// eased out by the same factor, so near the pointer the balloon can hang in
// mid-air rather than sagging under it.
const MAG_R = 300;       // px — beyond this the pointer isn't felt at all
const MAG_K = 17;        // 1/s² of pull per px of distance, at full closeness
const MAG_C = 6.0;       // 1/s of damping, at full closeness

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
    awake: 1,               // breathing amplitude, eased — never switched
    pointer: null,          // {x, y} in tank coordinates, or null
    raf: 0, last: 0,
  };

  // The tank is sticky, so its position on screen changes as the page scrolls.
  // Cached rather than measured every frame: getBoundingClientRect forces the
  // browser to lay out, and doing that 60 times a second next to an animation
  // is how you turn a smooth toy into a stuttering one.
  let rect = null;
  const freshRect = () => (rect = tank.getBoundingClientRect());

  const bounds = () => ({
    w: Math.max(0, tank.clientWidth - ball.offsetWidth),
    h: Math.max(0, tank.clientHeight - ball.offsetHeight),
  });

  // It starts up high and drops in — the fall is the introduction, and it says
  // „this thing has weight" before the reader has to guess.
  const b0 = bounds();
  S.x = b0.w * (0.25 + Math.random() * 0.5);
  S.y = 0;

  // Strictly proportional to how fast it arrived: a slow graze barely dents the
  // surface, a fast slam flattens it to V_REF's worth.
  // Below V_DENT nothing happens at all. That deadzone is deliberate: the tiny
  // contacts a small scroll produces were each restarting the spring, and a
  // spring restarted twenty times a second is a stutter, not a wobble.
  const hit = (axis, speed) => {
    if (speed < V_DENT) return;
    const strength = Math.min(SQUASH_MAX, (speed / V_REF) * SQUASH_MAX);
    if (strength > Math.abs(S.d)) { S.axis = axis; S.d = strength; S.dv = 0; }
  };

  function draw() {
    const b = bounds();
    // The breath fades with S.awake instead of being switched off. Flipping it
    // between 0 and full amplitude mid-cycle made the balloon visibly jump the
    // instant it came to rest — a discontinuity in a value the eye is tracking.
    const idle = Math.sin(S.t * Math.PI * 2 * IDLE_HZ) * IDLE_AMP * S.awake;
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

    // ---- the magnet ----
    // Closeness runs 0 at the edge of MAG_R to 1 at the pointer, squared so the
    // pull stays polite far out and becomes insistent only up close. That curve
    // IS the effect: the balloon drifts on its own until your hand is near,
    // then increasingly wants to come to it.
    let w = 0;
    if (S.pointer) {
      const cx = S.x + ball.offsetWidth / 2, cy = S.y + ball.offsetHeight / 2;
      const dx = S.pointer.x - cx, dy = S.pointer.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < MAG_R) {
        w = (1 - dist / MAG_R) ** 2;
        // Spring toward the cursor, damped by the same factor. Both scale with
        // w, so the far field is a hint and the near field is a grip.
        S.vx += (dx * MAG_K - S.vx * MAG_C) * w * dt;
        S.vy += (dy * MAG_K - S.vy * MAG_C) * w * dt;
        if (w > 0.25) S.grounded = false; // it may leave the floor to come up
      }
    }

    if (S.hot) {
      // Brakes, so a moving target becomes an easy one.
      const k = Math.exp(-HOVER_DAMP * dt);
      S.vx *= k;
      if (!S.grounded) S.vy = S.vy * k + G * dt * 0.25 * (1 - w); // still falls, gently
    } else {
      S.vy += G * dt * (1 - w); // held up in proportion to how close you are
      const k = Math.exp(-(S.grounded ? ROLL : AIR) * dt);
      S.vx *= k;
      const sp = Math.hypot(S.vx, S.vy);
      if (sp > V_MAX) { S.vx *= V_MAX / sp; S.vy *= V_MAX / sp; }
    }

    // Awake follows „is anything actually happening", smoothly.
    const target = (S.grounded && Math.hypot(S.vx, S.vy) < 10) || S.hot ? 0 : 1;
    S.awake += (target - S.awake) * Math.min(1, WAKE_EASE * dt);

    S.x += S.vx * dt;
    S.y += S.vy * dt;

    // Side walls.
    if (S.x < 0) { S.x = 0; hit("x", Math.abs(S.vx)); S.vx = Math.abs(S.vx) * WALL_REST; }
    else if (S.x > b.w) { S.x = b.w; hit("x", Math.abs(S.vx)); S.vx = -Math.abs(S.vx) * WALL_REST; }

    // Ceiling and floor. On the floor, a slow enough arrival stops bouncing
    // altogether — otherwise it would jitter forever on ever-smaller hops, the
    // classic way a physics toy betrays itself.
    const wasGrounded = S.grounded;
    S.grounded = false;
    if (S.y < 0) { S.y = 0; hit("y", Math.abs(S.vy)); S.vy = Math.abs(S.vy) * WALL_REST; }
    else if (S.y >= b.h) {
      S.y = b.h;
      // Hysteresis: once asleep it takes a firmer knock to start hopping again
      // than it took to stop. With a single threshold, a body sitting right on
      // it flickers between bouncing and resting — the stutter you noticed.
      const wake = wasGrounded ? V_SLEEP * 2.2 : V_SLEEP;
      if (Math.abs(S.vy) > wake) { hit("y", Math.abs(S.vy)); S.vy = -Math.abs(S.vy) * FLOOR_REST; }
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
    if (Math.abs(d) < 2) return; // ignore the noise a trackpad emits at rest
    S.vy = Math.max(-V_MAX, Math.min(V_MAX, S.vy - d * SCROLL_PUSH));
    S.vx += (Math.random() - 0.5) * Math.abs(d) * 0.5; // a little slosh sideways
    S.grounded = false;
    freshRect(); // the tank is sticky: it just moved relative to the pointer
  };

  const hotSet = (on) => { S.hot = on; tank.classList.toggle("is-open", on); };
  const onEnter = () => hotSet(true);
  const onLeave = () => hotSet(false);
  const onVis = () => (document.hidden ? stop() : start());
  const onResize = () => {
    freshRect();
    const b = bounds();
    S.x = Math.max(0, Math.min(b.w, S.x));
    S.y = Math.max(0, Math.min(b.h, S.y));
    draw();
  };

  // The pointer is tracked over the whole window, not just the tank: the pull
  // has to start BEFORE the cursor arrives, otherwise there's nothing to feel.
  const onMove = (e) => {
    if (!rect) freshRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    // Only bother while the cursor is anywhere near the box.
    S.pointer = (x > -MAG_R && y > -MAG_R && x < rect.width + MAG_R && y < rect.height + MAG_R)
      ? { x, y } : null;
  };
  const onOut = (e) => { if (!e.relatedTarget && !e.toElement) S.pointer = null; };

  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onOut);
  ball.addEventListener("pointerenter", onEnter);
  ball.addEventListener("pointerleave", onLeave);
  ball.addEventListener("focus", onEnter);
  ball.addEventListener("blur", onLeave);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVis);
  freshRect();

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
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerleave", onOut);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVis);
  };
}

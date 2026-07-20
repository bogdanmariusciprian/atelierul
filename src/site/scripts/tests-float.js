// =========================================================
// The „Exersează" button, adrift in its tank.
//
// The tank is a fixed box beside the archive; the button is a body inside it,
// moving on its own and bouncing off the walls. Because the tank is sticky, it
// stays put while a long list of papers scrolls past — so scrolling is the
// user shaking the container, and the body sloshes.
//
// Physics kept deliberately small and honest:
//   • constant velocity, integrated per frame against real elapsed time, so
//     the motion is the same on a 60Hz and a 144Hz screen;
//   • elastic wall bounces with restitution < 1 (a little energy lost each
//     time), plus a floor on the speed so it never quietly dies;
//   • rotation proportional to horizontal velocity — it rolls;
//   • scrolling adds velocity OPPOSITE to the scroll: inertia, like water in a
//     glass you lift;
//   • hovering (or focusing) damps the motion almost to a stop, so a moving
//     target becomes an easy one, and the button opens to show what it offers.
//
// It refuses to run when it shouldn't: „reduced motion" in the OS, narrow
// screens, a hidden tab, or a tank scrolled out of view. A thing that bounces
// forever in a background tab is a battery bug with a personality.
// Content Romanian, identifiers English.
// =========================================================

const REST = 0.86;       // energy kept after a wall bounce
const DRAG = 0.4;        // velocity lost per second while drifting, in %
const V_MIN = 26;        // px/s — below this it gets a nudge, never stalls
const V_MAX = 520;       // px/s — above this it looks frantic, not playful
const SPIN = 0.05;       // degrees of roll per px/s of horizontal speed
const HOVER_DAMP = 6;    // how hard the brakes are while pointed at
const SCROLL_PUSH = 2.2; // px/s of kick per px scrolled

const reduceMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Start the float. Returns a stop() that undoes everything it hooked up. */
export function initFloatingPlay(tank) {
  const ball = tank?.querySelector(".tcat__ball");
  if (!tank || !ball) return () => {};

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
    angle: 0,
    hot: false,     // pointed at or focused → brakes on
    raf: 0, last: 0, visible: true,
  };

  const bounds = () => ({
    w: Math.max(0, tank.clientWidth - ball.offsetWidth),
    h: Math.max(0, tank.clientHeight - ball.offsetHeight),
  });

  // Start somewhere in the middle third, so it never appears half-buried in a
  // corner on first paint.
  const place = () => {
    const b = bounds();
    S.x = b.w * (0.33 + Math.random() * 0.34);
    S.y = b.h * (0.33 + Math.random() * 0.34);
  };
  place();

  const draw = () => {
    ball.style.transform =
      `translate3d(${S.x.toFixed(1)}px, ${S.y.toFixed(1)}px, 0) rotate(${S.angle.toFixed(2)}deg)`;
  };
  draw();

  function step(now) {
    S.raf = requestAnimationFrame(step);
    // Clamp dt: a backgrounded tab hands back a huge gap, and integrating it
    // would teleport the body straight through a wall.
    const dt = Math.min(0.05, (now - (S.last || now)) / 1000);
    S.last = now;
    if (!dt) return;

    const b = bounds();
    if (!b.w || !b.h) return; // tank not laid out yet

    if (S.hot) {
      // Brakes, not a freeze: it keeps creeping, which reads as alive.
      const k = Math.exp(-HOVER_DAMP * dt);
      S.vx *= k; S.vy *= k;
    } else {
      const k = Math.exp(-DRAG * dt);
      S.vx *= k; S.vy *= k;
      // Never let it stall in a corner: below the floor, give it a push in the
      // direction it was already going.
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

    // Walls. Reflect, lose a little energy, and put the body back inside —
    // otherwise a fast frame leaves it stuck outside, bouncing on the spot.
    if (S.x < 0) { S.x = 0; S.vx = Math.abs(S.vx) * REST; }
    else if (S.x > b.w) { S.x = b.w; S.vx = -Math.abs(S.vx) * REST; }
    if (S.y < 0) { S.y = 0; S.vy = Math.abs(S.vy) * REST; }
    else if (S.y > b.h) { S.y = b.h; S.vy = -Math.abs(S.vy) * REST; }

    // Rolling: it leans into the direction it travels, and straightens up when
    // you point at it, so the label is readable exactly when you want to read it.
    S.angle = S.hot ? S.angle * Math.exp(-HOVER_DAMP * dt) : S.angle + S.vx * SPIN * dt * 10;
    if (S.angle > 18) S.angle = 18;
    if (S.angle < -18) S.angle = -18;

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

  const hot = (on) => { S.hot = on; tank.classList.toggle("is-open", on); };
  const onEnter = () => hot(true);
  const onLeave = () => hot(false);

  const onVis = () => { document.hidden ? stop() : start(); };
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
    S.visible = e.isIntersecting;
    S.visible && !document.hidden ? start() : stop();
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

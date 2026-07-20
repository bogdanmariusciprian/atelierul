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
//   JELLY — the shape is TWO damped springs, one per axis, and an impact does
//   not set them: it gives them a PUSH. That distinction is the whole feel of
//   the thing. Setting the deformation makes the ball snap flat in a single
//   frame and then relax — a slap. Pushing the spring makes it flatten over
//   about a sixth of a second, overshoot, come back, overshoot less, and
//   settle: a wobble. The strength of the push is proportional to the speed of
//   the impact, so a graze ripples and a slam heaves.
//   One spring per axis, rather than one spring plus a „which way" flag, means
//   a corner hit wobbles on both axes at once, and a second knock while the
//   first is still ringing adds to it instead of overwriting it.
//   Volume is roughly conserved — flatter on one axis means fatter on the
//   other — which is what reads as rubber instead of a resized picture.
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

// THE JELLY, IN TWO MODES.
// A real skin doesn't ring at one pitch. Struck, it rings in several modes at
// once: a slow, deep swing that carries most of the movement, and faster
// ripples on top that die away quickly. Which modes get excited depends on how
// hard you hit it — a tap sets only the deep one going, a slam sets off the lot.
// That is precisely what „the wobble should match the force" means physically,
// and it can't be had by scaling one spring's amplitude: a loud tap and a soft
// slam would then look identical, just bigger and smaller.
//
// Mode 1 — the fundamental. Slow (1.7Hz), lightly damped, rings ~1.5s.
// Mode 2 — the first overtone, 2.6× faster and damped harder, gone in ~0.4s.
//          Its share grows with the SQUARE of the impact, so it's inaudible in
//          a graze and dominant in a slam. That's the shudder before the swing.
const K = 110, C = 4.6;               // ω=10.5 · ζ=0.22 · 1.67Hz
const MODE2 = 2.6;                    // pitch ratio of the overtone
const K2 = K * MODE2 * MODE2, C2 = 2 * 0.36 * Math.sqrt(K2);
const PEAK1 = 0.737, PEAK2 = 0.624;   // measured: what fraction of v₀/ω each reaches
const MODE2_MIX = 0.55;               // how much of a full-force hit goes overtone
// Two modes never peak at the same instant, so their sum falls short of the
// sum of their peaks — hence a gain, with the soft clamp in draw() catching the
// top. The exponent above 1 is what widens the dynamic range: it quietens the
// gentle end without touching the loud one, so a graze and a slam differ by
// nearly eightfold instead of threefold.
const AMP_GAIN = 2.3, AMP_CURVE = 1.5;

const SQUASH_MAX = 0.45;
const V_REF = 420;       // the speed at which the squash is essentially full
const V_DENT = 52;       // …and the speed under which it doesn't dent at all
// Restitution falls as the impact hardens: a hard hit spends more of itself on
// deforming the skin, so less comes back as bounce. Constant restitution is the
// tell of a simulation — real things bounce worse the harder they land.
const REST_LOSS = 0.22;
const BULGE = 0.8;
const IDLE_HZ = 0.45, IDLE_AMP = 0.026;

// The globe is tipped a few degrees toward the viewer, which turns the band of
// letters from a straight ring into an ellipse on screen. That ellipse is the
// clearest signal the eye gets that it is looking at a sphere. Pointed at, the
// tilt eases to zero and the word comes level to be read.
const GLOBE_TILT = -14;

// Motion stretch: a soft body elongates along the direction it travels. Purely
// axis-aligned here, so a diagonal cancels out — which is honest, because an
// axis-aligned scale genuinely cannot express a diagonal stretch.
const STRETCH = 0.16;
const STRETCH_EASE = 9;  // per second — how fast the stretch follows the speed

// Spin is now a real angular velocity with its own memory, not a number read
// off the horizontal speed. That's why a ball dropped straight down keeps
// turning: nothing took its angular momentum away.
const SPIN_AIR = 0.55;   // spin lost per second in flight
const SPIN_GRIP = 9;     // how fast the floor forces rolling-without-slipping
const WALL_GRIP = 0.42;  // how much of the tangential speed a wall turns to spin
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
  const globe = tank?.querySelector(".tcat__ball__globe");
  const shadow = tank?.querySelector(".tcat__shadow");
  if (!tank || !ball || !globe) return () => {};

  if (reduceMotion() || !window.matchMedia("(min-width: 981px)").matches) {
    tank.classList.add("is-still");
    return () => tank.classList.remove("is-still");
  }

  const S = {
    x: 0, y: 0,
    vx: 190 * (Math.random() < 0.5 ? -1 : 1),
    vy: 0,
    spin: 0, spinV: 0,      // angle, and angular velocity in deg/s
    stx: 0, sty: 0,         // eased motion stretch per axis
    cx: 0.5, cy: 0.5,       // where it last touched — the squash pivots there
    tilt: GLOBE_TILT,       // how far the globe is tipped, eased to 0 on hover
    // Jelly: per axis, the fundamental (a…) and the overtone (b…).
    ax1: 0, ax1v: 0, ax2: 0, ax2v: 0,
    ay1: 0, ay1v: 0, ay2: 0, ay2v: 0,
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

  // An impact PUSHES the spring; it never places it. The push is sized so the
  // wobble peaks near `strength`: for a lightly damped spring started from rest,
  // the peak is v₀ ÷ ω, so v₀ = strength · ω gets us there — about 0.15s later,
  // which is exactly the build-up that was missing.
  // Below V_DENT nothing happens at all. That deadzone is deliberate: the tiny
  // contacts a small scroll produces were each poking the spring, and a spring
  // poked twenty times a second is a stutter, not a wobble.
  // Each mode is pushed, never placed, and each push is sized so that mode's
  // peak lands where we want it — hence dividing by the measured peak ratios.
  const OM1 = Math.sqrt(K) / PEAK1;
  const OM2 = Math.sqrt(K2) / PEAK2;

  // `at` is where on the ball the wall touched, 0…1 on each axis.
  const hit = (axis, speed, at) => {
    if (speed < V_DENT) return;
    // tanh instead of a hard cap: the skin stiffens as it stretches, so the
    // squash approaches its limit smoothly instead of hitting a ceiling and
    // going flat. Above V_REF, harder hits keep sounding harder — through the
    // overtone — even though the depth barely grows.
    const hard = Math.min(1.6, speed / V_REF);
    const amp = SQUASH_MAX * AMP_GAIN * Math.tanh(hard ** AMP_CURVE);
    // The overtone's share rises with the square of the force. This is the line
    // that makes a graze and a slam different in KIND, not just in size.
    const mix = MODE2_MIX * Math.min(1, hard) ** 2;
    if (axis === "x") {
      S.ax1v += amp * (1 - mix) * OM1;
      S.ax2v += amp * mix * OM2;
      S.cx = at; S.cy = 0.5;
    } else {
      S.ay1v += amp * (1 - mix) * OM1;
      S.ay2v += amp * mix * OM2;
      S.cy = at; S.cx = 0.5;
    }
  };

  function draw() {
    const b = bounds();
    // The breath fades with S.awake instead of being switched off. Flipping it
    // between 0 and full amplitude mid-cycle made the balloon visibly jump the
    // instant it came to rest — a discontinuity in a value the eye is tracking.
    const idle = Math.sin(S.t * Math.PI * 2 * IDLE_HZ) * IDLE_AMP * S.awake;
    // Each axis is shortened by its own spring and fattened by the other's —
    // that cross term is what keeps the volume roughly constant. The motion
    // stretch rides on top: longer along the way it's going, thinner across.
    // The modes simply add — that superposition IS the physics. Clamped softly
    // with tanh rather than cut off, so a violent hit compresses toward the
    // limit instead of slamming into a flat ceiling.
    const soft = (v) => SQUASH_MAX * Math.tanh(v / SQUASH_MAX);
    const dx = soft(S.ax1 + S.ax2);
    const dy = soft(S.ay1 + S.ay2) + idle;
    const sx = 1 - dx + dy * BULGE + S.stx;
    const sy = 1 - dy + dx * BULGE + S.sty;

    // THE PIVOT. A ball flattening against the floor keeps its flat side ON the
    // floor — it does not shrink toward its own middle and float free. So the
    // squash pivots at the point of contact, and returns to the centre exactly
    // as fast as the deformation fades. Scaling about the centre was leaving a
    // visible gap under the ball at the very moment it should look pressed
    // hardest against the ground.
    const amt = Math.min(1, Math.hypot(dx, dy - idle) / SQUASH_MAX);
    const ox = 50 + (S.cx - 0.5) * 100 * amt;
    const oy = 50 + (S.cy - 0.5) * 100 * amt;
    ball.style.transformOrigin = `${ox.toFixed(1)}% ${oy.toFixed(1)}%`;

    ball.style.transform =
      `translate3d(${S.x.toFixed(1)}px, ${S.y.toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    // Tilt first, then spin: the letters turn about the sphere's own axis,
    // and that axis is what leans toward the viewer. The other order would
    // wobble the axis itself, like a top about to fall.
    globe.style.transform = `rotateX(${S.tilt.toFixed(2)}deg) rotateY(${S.spin.toFixed(2)}deg)`;

    // The cast shadow is the other half of „weight": it tightens and darkens as
    // the ball nears the floor, spreads and fades as it rises. Without it, a
    // falling circle is just a circle moving down.
    if (shadow && b.h > 0) {
      const air = Math.max(0, Math.min(1, (b.h - S.y) / b.h)); // 0 = landed
      const k = 1 - air * 0.55;
      // The contact patch widens as the ball flattens onto the floor, and the
      // shadow slides away from the light — which comes from up and to the
      // left, per the highlight painted on the sphere. A shadow sitting dead
      // centre under a lit ball is the giveaway of a fake.
      const spread = 1 + Math.max(0, dy) * 1.5;
      const lean = air * 16;
      shadow.style.transform =
        `translate3d(${(S.x + ball.offsetWidth / 2 + lean).toFixed(1)}px, 0, 0) translateX(-50%) `
        + `scale(${(k * spread).toFixed(3)}, ${k.toFixed(3)})`;
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

    // Side walls. The tangential speed — vertical, here — is partly turned into
    // spin by friction, the way a ball scuffed down a wall starts to turn.
    const radius = Math.max(1, ball.offsetWidth / 2);
    const toSpin = (v) => (v / radius) * (180 / Math.PI);
    // Harder landings give less back: more of the blow goes into working the
    // skin. A fixed restitution is one of the plainest tells of a simulation.
    const restFor = (base, speed) =>
      base * (1 - REST_LOSS * Math.min(1, speed / V_REF));
    if (S.x < 0) {
      S.x = 0; hit("x", Math.abs(S.vx), 0);
      S.spinV -= toSpin(S.vy) * WALL_GRIP;
      S.vx = Math.abs(S.vx) * restFor(WALL_REST, Math.abs(S.vx));
    } else if (S.x > b.w) {
      S.x = b.w; hit("x", Math.abs(S.vx), 1);
      S.spinV += toSpin(S.vy) * WALL_GRIP;
      S.vx = -Math.abs(S.vx) * restFor(WALL_REST, Math.abs(S.vx));
    }

    // Ceiling and floor. On the floor, a slow enough arrival stops bouncing
    // altogether — otherwise it would jitter forever on ever-smaller hops, the
    // classic way a physics toy betrays itself.
    const wasGrounded = S.grounded;
    S.grounded = false;
    if (S.y < 0) { S.y = 0; hit("y", Math.abs(S.vy), 0); S.vy = Math.abs(S.vy) * restFor(WALL_REST, Math.abs(S.vy)); }
    else if (S.y >= b.h) {
      S.y = b.h;
      hit("y", Math.abs(S.vy), 1);
      // Hysteresis: once asleep it takes a firmer knock to start hopping again
      // than it took to stop. With a single threshold, a body sitting right on
      // it flickers between bouncing and resting — the stutter you noticed.
      const wake = wasGrounded ? V_SLEEP * 2.2 : V_SLEEP;
      if (Math.abs(S.vy) > wake) { S.vy = -Math.abs(S.vy) * restFor(FLOOR_REST, Math.abs(S.vy)); }
      else { S.vy = 0; S.grounded = true; }
    }

    // Four springs now — two modes on each axis — integrated semi-implicitly:
    // velocity first, then position. Plain Euler quietly adds energy here and
    // the wobble would grow instead of dying.
    // The overtone is integrated in substeps: at 4.3Hz it is close enough to
    // the frame rate that a single step per frame would lose its shape, and on
    // a slow frame it would go unstable. Cheap insurance, four extra lines.
    const sub = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      S.ax1v += (-K * S.ax1 - C * S.ax1v) * h;  S.ax1 += S.ax1v * h;
      S.ay1v += (-K * S.ay1 - C * S.ay1v) * h;  S.ay1 += S.ay1v * h;
      S.ax2v += (-K2 * S.ax2 - C2 * S.ax2v) * h; S.ax2 += S.ax2v * h;
      S.ay2v += (-K2 * S.ay2 - C2 * S.ay2v) * h; S.ay2 += S.ay2v * h;
    }
    const quiet = (v, vv) => Math.abs(v) < 0.0004 && Math.abs(vv) < 0.01;
    if (quiet(S.ax1, S.ax1v)) { S.ax1 = 0; S.ax1v = 0; }
    if (quiet(S.ay1, S.ay1v)) { S.ay1 = 0; S.ay1v = 0; }
    if (quiet(S.ax2, S.ax2v)) { S.ax2 = 0; S.ax2v = 0; }
    if (quiet(S.ay2, S.ay2v)) { S.ay2 = 0; S.ay2v = 0; }

    // Spin has its own momentum now. Airborne it only bleeds off slowly, so a
    // ball thrown upward keeps turning through the whole arc — before, the spin
    // was read straight off the horizontal speed and so froze in mid-air
    // whenever the ball was travelling straight up or down, which is the one
    // thing balls never do. On the ground, friction pulls it toward
    // rolling-without-slipping.
    S.tilt += ((S.hot ? 0 : GLOBE_TILT) - S.tilt) * Math.min(1, SPIN_HOVER * dt);
    if (S.hot) {
      S.spinV *= Math.exp(-SPIN_HOVER * dt);
      const target = Math.round(S.spin / 360) * 360;
      S.spin += (target - S.spin) * Math.min(1, SPIN_HOVER * dt);
    } else {
      if (S.grounded) {
        const rolling = toSpin(S.vx);
        S.spinV += (rolling - S.spinV) * Math.min(1, SPIN_GRIP * dt);
      } else {
        S.spinV *= Math.exp(-SPIN_AIR * dt);
      }
      S.spin += S.spinV * dt;
      if (S.spin > 3600 || S.spin < -3600) S.spin %= 360; // keep the number small
    }

    // Motion stretch, eased so it swells and relaxes instead of tracking every
    // twitch of the velocity. Longer along the way it's going, thinner across.
    const tx = (Math.abs(S.vx) - Math.abs(S.vy)) / V_MAX * STRETCH;
    S.stx += (tx - S.stx) * Math.min(1, STRETCH_EASE * dt);
    S.sty += (-tx - S.sty) * Math.min(1, STRETCH_EASE * dt);

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

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

// A FOOTBALL, not a balloon. The change that matters most here is AIR, not
// restitution: at balloon drag the ball lost most of its speed on the way up,
// so each hop was a fraction of the last and it looked like it was landing in
// treacle. Thin the air and the same restitution suddenly gives a long, even
// run of bounces — 260, 142, 80, 46, 27… — which is what a real ball does.
const G = 1250;          // px/s² — it falls, it doesn't sink
const WALL_REST = 0.86;
const FLOOR_REST = 0.80; // a real football returns about 60% of drop height
const AIR = 0.22;        // thin air: the ball keeps what it has between bounces
const ROLL = 0.6;        // …and rolls well once it's down
const V_SLEEP = 14;      // px/s — low, so the last little hops still happen
const V_MAX = 900;       // a 260px drop already arrives at ~800px/s
const SPIN_HOVER = 7;    // how fast the label swings back to face you
const HOVER_DAMP = 6;
const SCROLL_PUSH = 4.2; // px/s of kick per px scrolled — mass needs a firmer shove

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
// Football skin: stiff and well damped. It judders rather than wobbles — about
// three times the pitch of the balloon and gone in half a second instead of
// two. A ball this heavy that jiggled like jelly would look weightless.
const K = 340, C = 15.5;              // ω=18.4 · ζ=0.42 · 2.93Hz
const MODE2 = 2.6;                    // pitch ratio of the overtone
const K2 = K * MODE2 * MODE2, C2 = 2 * 0.55 * Math.sqrt(K2);
const PEAK1 = 0.589, PEAK2 = 0.516;   // measured: what fraction of v₀/ω each reaches
const MODE2_MIX = 0.5;                // how much of a full-force hit goes overtone
// Two modes never peak at the same instant, so their sum falls short of the
// sum of their peaks — hence a gain, with the soft clamp in draw() catching the
// top. The exponent above 1 is what widens the dynamic range: it quietens the
// gentle end without touching the loud one, so a graze and a slam differ by
// nearly eightfold instead of threefold.
const AMP_GAIN = 1.8, AMP_CURVE = 1.4;

const SQUASH_MAX = 0.20; // a football barely deforms: 20% on the hardest landing
const V_REF = 700;       // the speed at which the squash is essentially full
const V_DENT = 70;       // …and the speed under which it doesn't dent at all
// Restitution falls as the impact hardens: a hard hit spends more of itself on
// deforming the skin, so less comes back as bounce. Constant restitution is the
// tell of a simulation — real things bounce worse the harder they land.
const REST_LOSS = 0.12;  // a firm ball loses less to deformation
const BULGE = 0.8;
const IDLE_HZ = 0.45, IDLE_AMP = 0.008;

// FREE ROTATION. The orientation is a 3×3 matrix with an angular-velocity
// VECTOR driving it, not a pair of angles. Euler angles cannot express tumbling:
// rotate about y then x, and the second rotation happens in the frame the first
// one left behind, so the axes drift and eventually collapse into each other —
// gimbal lock. Composing small rotations onto a matrix has neither problem, and
// CSS takes the result directly through matrix3d().
const SPIN_WOBBLE = 0.55; // how much of an off-centre impact becomes tumble
const ORTHO_EVERY = 30;   // frames between re-squaring the matrix

// Motion stretch: a soft body elongates along the direction it travels. Purely
// axis-aligned here, so a diagonal cancels out — which is honest, because an
// axis-aligned scale genuinely cannot express a diagonal stretch.
const STRETCH = 0.07;    // a firm ball hardly elongates
const STRETCH_EASE = 9;  // per second — how fast the stretch follows the speed

// Spin is now a real angular velocity with its own memory, not a number read
// off the horizontal speed. That's why a ball dropped straight down keeps
// turning: nothing took its angular momentum away.
const SPIN_AIR = 0.55;   // spin lost per second in flight
const SPIN_GRIP = 9;     // how fast the floor forces rolling-without-slipping
const WALL_GRIP = 0.42;  // how much of the tangential speed a wall turns to spin
const WAKE_EASE = 3.2;   // how fast the breathing fades in and out, per second

// THE MAGNET, as an inverse-square field.
// The first version was a spring: pull proportional to DISTANCE. That is
// backwards for a magnet — a spring pulls hardest when far and lets go as it
// arrives. Real attraction does the opposite, and the difference is the whole
// character of the thing: a field you barely feel across the box, that turns
// insistent in the last hundred pixels and irresistible in the last thirty.
//
//     a = A ÷ (d² + s²)
//
// The softening term s keeps it finite at the centre, where a true 1/d² would
// go to infinity and fling the ball through the wall. A window fades the far
// field to nothing by MAG_R, so there is no edge where the pull switches off.
//
// Gravity is NOT switched off any more. It stays on, always, and the field has
// to beat it — which it does inside about 170px. Below that the balloon lifts
// off the floor and rises to your hand; beyond it, it can only lean and roll
// along the ground toward you. That threshold is the honest version of what
// used to be a fudge, and it reads better: the ball is visibly deciding.
const MAG_R = 320;       // px — the field's reach
const MAG_A = 3.2e7;     // px³/s² — strength; a = A/(d²+s²). Raised with the
                         // ball's weight: the field still has to beat gravity,
                         // and gravity nearly tripled.
const MAG_SOFT = 42;     // px — softening, so the centre isn't a singularity
const MAG_MAX = 7000;    // px/s² — cap, roughly six times gravity
const MAG_EDDY = 2.2;    // 1/s of drag near the field, like eddy currents

// CONTACT. Inside this radius the field stops and a hold takes over: firm
// damping and a gentle centring. Without it the ball buzzed across the cursor
// two hundred times a second, because nothing in a pure field ever says „stop".
// Real magnets are stopped by touching something. The ball settles about 16px
// below the pointer — exactly where the hold balances gravity, which is the
// sag a real hanging magnet has.
const MAG_GRAB = 34;     // px
const MAG_GRAB_K = 78;   // 1/s² of centring — same ~16px sag under a heavier ball
const MAG_GRAB_C = 22;   // 1/s of damping while held

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
    // Orientation, row-major. Starts as identity: the word facing the reader.
    R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    wx: 0, wy: 0, wz: 0,    // angular velocity, rad/s, about the screen axes
    frame: 0,
    stx: 0, sty: 0,         // eased motion stretch per axis
    cx: 0.5, cy: 0.5,       // where it last touched — the squash pivots there
    // Jelly: per axis, the fundamental (a…) and the overtone (b…).
    ax1: 0, ax1v: 0, ax2: 0, ax2v: 0,
    ay1: 0, ay1v: 0, ay2: 0, ay2v: 0,
    t: Math.random() * 10,
    grounded: false,
    hot: false,
    awake: 1,               // breathing amplitude, eased — never switched
    held: false,            // snapped onto the pointer right now?
    pointer: null,          // {x, y} in tank coordinates, or null
    raf: 0, last: 0,
  };

  // The tank is sticky, so its position on screen changes as the page scrolls.
  // Cached rather than measured every frame: getBoundingClientRect forces the
  // browser to lay out, and doing that 60 times a second next to an animation
  // is how you turn a smooth toy into a stuttering one.
  let rect = null;
  const freshRect = () => (rect = tank.getBoundingClientRect());

  // R ← dR·R, where dR is the rotation of `ang` radians about a unit axis
  // (Rodrigues' formula). Small rotations composed frame by frame add up to any
  // orientation at all, which is exactly what tumbling needs.
  function spinBy(ax, ay, az, ang) {
    if (!ang) return;
    const c = Math.cos(ang), s2 = Math.sin(ang), t = 1 - c;
    const d = [
      t * ax * ax + c, t * ax * ay - s2 * az, t * ax * az + s2 * ay,
      t * ax * ay + s2 * az, t * ay * ay + c, t * ay * az - s2 * ax,
      t * ax * az - s2 * ay, t * ay * az + s2 * ax, t * az * az + c,
    ];
    const R = S.R, out = new Array(9);
    for (let r = 0; r < 3; r++)
      for (let c2 = 0; c2 < 3; c2++)
        out[r * 3 + c2] = d[r * 3] * R[c2] + d[r * 3 + 1] * R[3 + c2] + d[r * 3 + 2] * R[6 + c2];
    S.R = out;
  }

  // Floating-point error creeps in over thousands of multiplications and the
  // matrix slowly stops being a rotation — the ball would shear and shrink.
  // Gram-Schmidt puts it back; every half second is plenty.
  function orthonormalize() {
    const R = S.R;
    let n = Math.hypot(R[0], R[1], R[2]) || 1;
    R[0] /= n; R[1] /= n; R[2] /= n;
    const dot = R[0] * R[3] + R[1] * R[4] + R[2] * R[5];
    R[3] -= dot * R[0]; R[4] -= dot * R[1]; R[5] -= dot * R[2];
    n = Math.hypot(R[3], R[4], R[5]) || 1;
    R[3] /= n; R[4] /= n; R[5] /= n;
    R[6] = R[1] * R[5] - R[2] * R[4];
    R[7] = R[2] * R[3] - R[0] * R[5];
    R[8] = R[0] * R[4] - R[1] * R[3];
  }

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
    // CSS matrix3d is COLUMN-major, our R is row-major — hence the transpose in
    // the ordering below. Get it wrong and the ball turns the wrong way, which
    // is the sort of bug that looks like bad physics.
    const R = S.R;
    globe.style.transform =
      `matrix3d(${R[0]},${R[3]},${R[6]},0,${R[1]},${R[4]},${R[7]},0,${R[2]},${R[5]},${R[8]},0,0,0,0,1)`;

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
    let held = false, drag = 0;
    if (S.pointer) {
      const cx = S.x + ball.offsetWidth / 2, cy = S.y + ball.offsetHeight / 2;
      const dx = S.pointer.x - cx, dy = S.pointer.y - cy;
      const dist = Math.hypot(dx, dy) || 0.001;
      const ux = dx / dist, uy = dy / dist; // direction only; the law sets the size

      if (dist < MAG_GRAB) {
        // Snapped on. The moment of capture gets a squash, sized by how fast it
        // arrived — the little clunk a magnet makes when it takes hold.
        if (!S.held) hit(Math.abs(dx) > Math.abs(dy) ? "x" : "y", Math.hypot(S.vx, S.vy) * 0.55, 0.5);
        held = true;
        S.vx += dx * MAG_GRAB_K * dt;
        S.vy += dy * MAG_GRAB_K * dt;
        drag = MAG_GRAB_C;
        S.grounded = false;
      } else if (dist < MAG_R) {
        const t = dist / MAG_R;
        // Full strength out to 0.6 of the reach, then faded smoothly to nothing
        // — no edge where the field switches off under your hand.
        const window = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4) ** 2;
        const a = Math.min(MAG_MAX, MAG_A / (dist * dist + MAG_SOFT * MAG_SOFT)) * window;
        S.vx += ux * a * dt;
        S.vy += uy * a * dt;
        drag = MAG_EDDY * (1 - t) ** 2;
        if (a > G) S.grounded = false; // strong enough to lift it off the floor
      }
    }
    S.held = held;

    // Gravity always applies. The field either beats it or it doesn't.
    if (S.hot) {
      const k = Math.exp(-(HOVER_DAMP + drag) * dt);
      S.vx *= k;
      S.vy = S.vy * k + (held ? 0 : G * dt * 0.25);
    } else {
      S.vy += G * dt;
      const k = Math.exp(-((S.grounded ? ROLL : AIR) + drag) * dt);
      S.vx *= k; S.vy *= k;
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
    // Harder landings give less back: more of the blow goes into working the
    // skin. A fixed restitution is one of the plainest tells of a simulation.
    const restFor = (base, speed) =>
      base * (1 - REST_LOSS * Math.min(1, speed / V_REF));
    // A real ball almost never strikes dead centre, and it is off-centre hits
    // that make things tumble. Writing it out honestly:
    //
    //   contact point   r = −n·R + t        (t is the off-centre part, ⟂ n)
    //   impulse         J = n·j
    //   torque          τ = r × J = j·(t × n)      — the −n·R part cancels
    //   change in spin  Δω = τ ÷ I,  I = ⅖mR² for a solid sphere
    //
    // The offset lives partly in DEPTH, an axis the flat simulation has no
    // opinion about, so it's drawn at random. That single unknown is what turns
    // a wheel into a tumbling ball.
    const torque = (nx, ny, nz, j) => {
      let ax = Math.random() - 0.5, ay = Math.random() - 0.5, az = Math.random() - 0.5;
      const along = ax * nx + ay * ny + az * nz;      // strip the part along n:
      ax -= along * nx; ay -= along * ny; az -= along * nz; // an offset there is no offset
      const len = Math.hypot(ax, ay, az) || 1;
      const off = radius * 0.55 * Math.random();     // how far from centre it caught
      ax = ax / len * off; ay = ay / len * off; az = az / len * off;
      const k = SPIN_WOBBLE * j / (0.4 * radius * radius);
      S.wx += k * (ay * nz - az * ny);
      S.wy += k * (az * nx - ax * nz);
      S.wz += k * (ax * ny - ay * nx);
    };

    if (S.x < 0) {
      S.x = 0; hit("x", Math.abs(S.vx), 0);
      S.wz -= (S.vy / radius) * WALL_GRIP;   // friction along the wall → roll
      torque(1, 0, 0, Math.abs(S.vx));
      S.vx = Math.abs(S.vx) * restFor(WALL_REST, Math.abs(S.vx));
    } else if (S.x > b.w) {
      S.x = b.w; hit("x", Math.abs(S.vx), 1);
      S.wz += (S.vy / radius) * WALL_GRIP;
      torque(-1, 0, 0, Math.abs(S.vx));
      S.vx = -Math.abs(S.vx) * restFor(WALL_REST, Math.abs(S.vx));
    }

    // Ceiling and floor. On the floor, a slow enough arrival stops bouncing
    // altogether — otherwise it would jitter forever on ever-smaller hops, the
    // classic way a physics toy betrays itself.
    const wasGrounded = S.grounded;
    S.grounded = false;
    if (S.y < 0) {
      S.y = 0; hit("y", Math.abs(S.vy), 0); torque(0, 1, 0, Math.abs(S.vy));
      S.vy = Math.abs(S.vy) * restFor(WALL_REST, Math.abs(S.vy));
    } else if (S.y >= b.h) {
      S.y = b.h;
      hit("y", Math.abs(S.vy), 1);
      if (Math.abs(S.vy) > V_SLEEP) torque(0, -1, 0, Math.abs(S.vy));
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

    // Angular momentum, in three dimensions. Airborne it only bleeds off slowly.
    // On the ground, friction drives the roll axis toward the one rolling
    // without slipping demands — for motion along x on a floor whose normal
    // points up, that is ω = (v × n)/r, which comes out along −z.
    if (S.hot) {
      // Pointed at: stop turning, and let the orientation ease back to square
      // so the word faces the reader. Blending the matrix toward identity and
      // re-squaring it is the cheap, stable way to interpolate a rotation.
      const k = Math.min(1, SPIN_HOVER * dt);
      S.wx *= 1 - k; S.wy *= 1 - k; S.wz *= 1 - k;
      const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      for (let i = 0; i < 9; i++) S.R[i] += (I[i] - S.R[i]) * k;
      orthonormalize();
    } else {
      if (S.grounded) {
        const rolling = -S.vx / radius;
        S.wz += (rolling - S.wz) * Math.min(1, SPIN_GRIP * dt);
        S.wx *= Math.exp(-SPIN_GRIP * 0.5 * dt);
        S.wy *= Math.exp(-SPIN_GRIP * 0.5 * dt);
      } else {
        const k = Math.exp(-SPIN_AIR * dt);
        S.wx *= k; S.wy *= k; S.wz *= k;
      }
      const w = Math.hypot(S.wx, S.wy, S.wz);
      if (w > 1e-4) {
        const ang = w * dt;
        spinBy(S.wx / w, S.wy / w, S.wz / w, ang);
        if (++S.frame % ORTHO_EVERY === 0) orthonormalize();
      }
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

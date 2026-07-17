// =========================================================
// Shared header + footer (site "chrome") — written ONCE, used
// on every page (DRY). Each page calls renderChrome(basePath)
// with its path back to the project root, e.g.:
//   root page:        ""            (index.html)
//   lectii/:          "../"         (one level deep)
//   lectii/dom/lec/:  "../../../"   (three levels deep)
//
// Usage in a page:
//   <div id="header"></div> ... <div id="footer"></div>
//   <script type="module">
//     import { renderChrome } from "<basePath>src/shared/components/site-chrome.js";
//     renderChrome("<basePath>");
//   </script>
// =========================================================
import { APP_NAME } from "../scripts/config.js";
import { initPointsFx } from "../scripts/points-fx.js";
import { initXpBar } from "../scripts/xp-bar.js";
import { isAdmin } from "../scripts/session.js";
import { LESSONS } from "../scripts/lessons-index.js";
import { LESSON_DOMAINS } from "../scripts/domains.js";
import { initUserMenu } from "../scripts/user-menu.js";
import { fetchOpenModerationCount } from "../scripts/forum-repo.js";
import { fetchPendingCount, fetchPendingCountForLesson } from "../scripts/exercises-repo.js";
import { notifTotal, notifRows, consumeTray, relTime, loadNotifications, clearAllNotifications } from "../scripts/notif.js";
import { isLoggedIn, signOut } from "../scripts/session.js";
import { MY_PROFILE } from "../scripts/community-data.js";
import { CURRENT_USER } from "../scripts/session.js";
import { supabase } from "../scripts/supabase-client.js";
import { startPresence } from "../scripts/presence.js";
import { store } from "../scripts/store.js";
import { initMessenger, openMessenger } from "./messenger.js";
import { enforceGate, revealGate } from "../scripts/site-gate.js";

// Public navigation (visible to everyone). Labels are in Romanian
// (UI language); code identifiers stay in English.
// Logged-in users will get additional links, added later.
const NAV_LINKS = [
  // Home = the bare domain (atelierulderomana.ro), not …/index.html.
  { label: "Acasă", href: "" },
  { label: "Despre", href: "despre/" },
  { label: "Lecții", href: "lectii/" },
  { label: "Teste", href: "teste/" },
  // "Atelier" goes straight to the REAL forum (the hub).
  { label: "Atelier", href: "comunitate/#forum", title: "Forumul și comunitatea" },
  // The community LANDING is a sales pitch — pointless once you're in.
  { label: "Comunitate", href: "comunitate/descopera/", title: "Ce primești ca membru", guestOnly: true },
  // The account slot at the end is ROLE-AWARE (initNavUser): guests get the
  // "Intră în cont" button, members get their identity chip (name + XP).
];

export async function renderChrome(basePath = "") {
  // PRE-LAUNCH GATE, first of all: a non-team visitor is sent to /in-curand/ and
  // we stop here (the page stays hidden via main.css). A team account continues,
  // and we reveal the page once the essential chrome is in place (see below).
  if (!(await enforceGate())) return;

  // Every step is ISOLATED: a throw in one widget must NEVER take down the rest
  // of the chrome (header, nav, footer, logout). The label is logged so a
  // failing widget is obvious in the console instead of silently blanking the
  // page. The essential chrome (header/breadcrumbs/footer/user-menu) renders
  // FIRST, so navigation + logout are always available even if a later floating
  // widget fails.
  const safe = (fn, label) => {
    try {
      fn();
    } catch (e) {
      console.error(`[chrome] "${label}" failed:`, e);
    }
  };

  safe(seedIdentityFromCache, "seedIdentity"); // paint the RIGHT avatar instantly
  safe(initTheme, "theme"); // palette + light/dark BEFORE anything paints brand colors
  safe(injectSvgFilters, "svgFilters");
  // --- Essential chrome first (must always render) ---
  safe(() => renderHeader(basePath), "header");
  safe(() => renderPageBreadcrumbs(basePath), "breadcrumbs");
  safe(() => renderFooter(basePath), "footer");
  safe(revealGate, "revealGate"); // page is complete → show it (undo the flash-hide)
  safe(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, "sw"); // offline (network-first)
  safe(initUserMenu, "userMenu"); // right-click on any user name → copy/open
  // --- Visual flourishes + floating widgets (isolated) ---
  safe(initSmoothPageScroll, "smoothScroll");
  safe(initPointsFx, "pointsFx"); // cursor "points earned" flourish
  safe(() => initXpBar(basePath), "xpBar"); // permanent level/XP bar + identity
  safe(initAdminFrame, "adminFrame"); // pulsing page border in the admin role
  safe(() => initAdminQuickPanel(basePath), "adminQuickPanel"); // floating 🛡️ toolbox (admin)
  safe(() => initMessenger(basePath), "messenger"); // floating 💬 Messenger + guest contact
  safe(initGuestOneTap, "guestOneTap"); // Google One Tap for signed-out visitors
  safe(startPresence, "presence"); // heartbeat → last_seen (presence dots)
  if (!window.__identityCacheOn) {
    window.__identityCacheOn = true;
    window.addEventListener("atelier:role", cacheIdentity);
  }
  safe(hydrateMemberIdentity, "hydrateIdentity"); // member's real avatar/identity
}

// Identity cache (localStorage) so the correct avatar/name paints INSTANTLY on
// the next page instead of a split-second flash of the default. `seed` runs
// synchronously BEFORE the XP chip paints; `cache` refreshes it whenever the
// identity changes. Members only (the teacher has no avatar chip).
const IDENTITY_KEY = "atelier_identity";
function seedIdentityFromCache() {
  if (!isLoggedIn() || isAdmin() || !CURRENT_USER.authId) return;
  const c = store.get(IDENTITY_KEY, null);
  if (c && c.authId === CURRENT_USER.authId) {
    if ("avatar" in c) MY_PROFILE.avatar = c.avatar || null;
    if (c.color) CURRENT_USER.color = c.color;
    if (typeof c.points === "number") MY_PROFILE.points = c.points;
    if (c.name) {
      CURRENT_USER.name = c.name;
      CURRENT_USER.initials = c.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    }
  } else {
    // No cache for this user yet → paint NEUTRAL initials (not a stale default
    // gif) until the async hydrate brings the real avatar.
    MY_PROFILE.avatar = null;
  }
}
function cacheIdentity() {
  if (!isLoggedIn() || isAdmin() || !CURRENT_USER.authId) return;
  store.set(IDENTITY_KEY, {
    authId: CURRENT_USER.authId,
    avatar: MY_PROFILE.avatar || null,
    color: CURRENT_USER.color,
    name: CURRENT_USER.name,
    points: MY_PROFILE.points,
  });
}

// Load the signed-in MEMBER's own profile (avatar, name, colour, points)
// from Supabase on EVERY page, so their avatar & identity look the SAME
// everywhere — home, lessons, hub. Before this, only the community hub
// fetched it, so other pages fell back to the default avatar (the bug where
// the top-left chip and the Home chip showed an old/default picture).
// Members only — the teacher isn't in the game and has no avatar chip.
let _identityHydratedFor = null;
async function hydrateMemberIdentity() {
  if (!isLoggedIn() || isAdmin() || !CURRENT_USER.authId) return;
  if (_identityHydratedFor === CURRENT_USER.authId) return; // once per user
  _identityHydratedFor = CURRENT_USER.authId;
  try {
    const { data, error } = await supabase.rpc("get_my_profile");
    if (error) return;
    const prof = Array.isArray(data) ? data[0] : data;
    if (!prof) return;
    MY_PROFILE.avatar = prof.avatar || null;
    if (prof.points != null) MY_PROFILE.points = prof.points;
    if (prof.avatar_color) CURRENT_USER.color = prof.avatar_color;
    const dn = (prof.display_name || CURRENT_USER.name || "").replace(/[<>]/g, "");
    if (dn) {
      CURRENT_USER.name = dn;
      CURRENT_USER.initials = dn.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    }
    // Re-render the XP chip / nav with the fresh identity.
    window.dispatchEvent(new CustomEvent("atelier:role"));
  } catch {
    /* offline / RPC missing → keep defaults, never crash the page */
  }
}

// =========================================================
// THEME — the site has ONE look, "Arcade mentă" (light). It's the default
// palette in variables.css, so there's no palette/dark switching and no
// theme button. This only keeps the body.is-logged class in sync with the
// session (CSS uses it to hide guest-only nav links).
// =========================================================
function initTheme() {
  if (window.__themeOn) return;
  window.__themeOn = true;
  const applyRoleClass = () => document.body.classList.toggle("is-logged", isLoggedIn());
  applyRoleClass();
  window.addEventListener("atelier:role", applyRoleClass);
}

/**
 * Google One Tap for signed-out visitors — the small "Sign in with Google"
 * card Google shows (top-right) so login can happen from ANY page without
 * leaving it. The login page runs its own button + prompt, so we skip it
 * here. On a successful sign-in we reload so member/admin gating refreshes.
 */
function initGuestOneTap() {
  if (window.__oneTapOn) return;
  if (isLoggedIn()) return; // already signed in — nothing to prompt
  if (location.pathname.includes("/comunitate/login")) return; // login page owns it
  window.__oneTapOn = true;

  import("../scripts/google-onetap.js")
    .then(({ mountGoogleSignIn }) => mountGoogleSignIn(null, { oneTap: true }))
    .catch(() => {}); // Google's script blocked → simply no One Tap, no error

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) window.location.reload();
  });
}

// The "log out" glyph used by the header logout button (a door + arrow).
const LOGOUT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`;

/**
 * "Sign out?" confirmation dialog — a centered card over a backdrop that
 * blurs the whole page behind it. Escape / backdrop / "Anulează" dismiss;
 * "Ieși din cont" calls Supabase signOut and returns home, cleanly logged
 * out. Built on demand (only when the user clicks the logout icon).
 */
function confirmLogout(basePath) {
  if (document.querySelector(".logout-modal")) return;

  const overlay = document.createElement("div");
  overlay.className = "logout-modal";
  overlay.innerHTML = `
    <div class="logout-modal__backdrop"></div>
    <div class="logout-modal__card" role="dialog" aria-modal="true" aria-labelledby="logout-title">
      <span class="logout-modal__icon">${LOGOUT_ICON}</span>
      <p class="logout-modal__title" id="logout-title">Ieși din cont?</p>
      <p class="logout-modal__text">Te vom deconecta de pe acest dispozitiv.</p>
      <div class="logout-modal__actions">
        <button type="button" class="btn btn--ghost" data-act="cancel">Anulează</button>
        <button type="button" class="btn btn--primary" data-act="confirm">Ieși din cont</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add("has-modal");

  const close = () => {
    overlay.remove();
    document.body.classList.remove("has-modal");
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  overlay.addEventListener("click", async (e) => {
    if (
      e.target.classList.contains("logout-modal__backdrop") ||
      e.target.closest("[data-act='cancel']")
    ) {
      close();
      return;
    }
    const confirmBtn = e.target.closest("[data-act='confirm']");
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Se iese…";
      try {
        await signOut();
      } catch {
        /* even if the network call fails, send them home */
      }
      window.location.href = basePath || "./";
    }
  });

  overlay.querySelector("[data-act='cancel']")?.focus();
}

/**
 * Floating admin quick-panel — the teacher's toolbox, on EVERY page while
 * the admin role is active. One 🛡️ button (badge = things awaiting him)
 * that unfolds shortcuts straight into the hub's admin tabs, plus a
 * contextual action on lesson pages (that lesson's pending proposals).
 * Content moderation itself stays inline where the content lives.
 */
function initAdminQuickPanel(basePath) {
  if (window.__adminQuickOn) return;
  window.__adminQuickOn = true;
  // On the hub itself the sidebar already has everything — no duplicate fab.
  if (document.getElementById("community")) return;

  const HUB = `${basePath}comunitate/`;
  let fab = null;
  // Real pending-exercise counts (Supabase), cached; refreshed async so build()
  // stays synchronous. Default 0 until the first fetch resolves.
  let _exPending = 0;
  let _exLessonPending = 0;
  let _modPending = 0;

  const lessonSlug = () =>
    document.querySelector("[data-lesson-slug]")?.dataset.lessonSlug || null;

  const build = () => {
    const attention = _modPending + _exPending;
    const slug = lessonSlug();
    const here = _exLessonPending;
    const link = (href, icon, label, n = 0) =>
      `<a class="admin-quick__item" href="${href}">${icon} ${label}${n ? ` <b class="admin-quick__n">${n}</b>` : ""}</a>`;
    return `
      <button type="button" class="admin-quick__fab" title="Unelte de admin" aria-expanded="false">
        🛡️${attention ? `<b class="admin-quick__badge">${attention}</b>` : ""}
      </button>
      <div class="admin-quick__panel" hidden>
        <p class="admin-quick__title">Unelte de admin</p>
        ${link(`${HUB}#admin`, "🛡️", "Panou admin")}
        ${link(`${HUB}#admin/moderare`, "⚖️", "Moderare", _modPending)}
        ${link(`${HUB}#admin/utilizatori`, "👥", "Utilizatori")}
        ${link(`${HUB}#exercitii`, "🧩", "Exerciții în așteptare", _exPending)}
        ${slug ? link("#propose-exercise", "📘", "Propunerile acestei lecții", here) : ""}
        <p class="admin-quick__hint">Editezi/ștergi direct pe conținut — controalele ✎/🗑 apar inline.</p>
      </div>`;
  };

  // Fetch the REAL pending-exercise counts, then refresh the panel/badge
  // (keeping the panel open if it was). Async so build() stays synchronous.
  async function refreshCounts() {
    if (!isAdmin()) return;
    const slug = lessonSlug();
    [_exPending, _exLessonPending, _modPending] = await Promise.all([
      fetchPendingCount(),
      slug ? fetchPendingCountForLesson(slug) : Promise.resolve(0),
      fetchOpenModerationCount(),
    ]);
    if (!fab) return;
    const wasOpen = fab.classList.contains("is-open");
    fab.innerHTML = build();
    if (wasOpen) {
      fab.classList.add("is-open");
      const p = fab.querySelector(".admin-quick__panel");
      if (p) p.hidden = false;
      fab.querySelector(".admin-quick__fab")?.setAttribute("aria-expanded", "true");
    }
  }

  const apply = () => {
    const on = isAdmin();
    if (!on) {
      fab?.remove();
      fab = null;
      return;
    }
    if (!fab) {
      fab = document.createElement("div");
      fab.className = "admin-quick";
      document.body.appendChild(fab);
      fab.addEventListener("click", (e) => {
        const btn = e.target.closest(".admin-quick__fab");
        if (!btn) return;
        // Don't let this click reach the document's "click outside closes"
        // listener — rebuilding the panel detaches e.target, so that guard
        // would misfire and close the panel in the same click.
        e.stopPropagation();
        const willOpen = !fab.classList.contains("is-open");
        if (willOpen) fab.innerHTML = build(); // instant (cached counts)
        const panel = fab.querySelector(".admin-quick__panel");
        fab.classList.toggle("is-open", willOpen);
        if (panel) panel.hidden = !willOpen;
        fab.querySelector(".admin-quick__fab")?.setAttribute("aria-expanded", String(willOpen));
        if (willOpen) refreshCounts(); // then fetch fresh counts + rebuild
      });
      const close = () => {
        if (!fab) return;
        fab.classList.remove("is-open");
        const p = fab.querySelector(".admin-quick__panel");
        if (p) p.hidden = true;
        fab.querySelector(".admin-quick__fab")?.setAttribute("aria-expanded", "false");
      };
      document.addEventListener("click", (e) => {
        if (fab && !fab.contains(e.target)) close();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });
    }
    fab.innerHTML = build();
    refreshCounts(); // load real counts for the fab badge
  };

  apply();
  window.addEventListener("atelier:role", apply);
}

/**
 * Wayfinding for deep pages: lesson pages get an automatic breadcrumb
 * (Acasă › Lecții › domeniu › lecția curentă) derived from the lessons
 * catalogue — zero per-page wiring, one source of truth (DRY).
 */
function renderPageBreadcrumbs(basePath) {
  const slug = document.querySelector("[data-lesson-slug]")?.dataset.lessonSlug;
  if (!slug) return;
  const lesson = LESSONS.find((l) => l.slug === slug);
  if (!lesson) return;
  const domain = LESSON_DOMAINS.find((d) => d.slug === lesson.domain);

  const nav = document.createElement("nav");
  nav.className = "page-crumbs";
  nav.setAttribute("aria-label", "Unde te afli");
  nav.innerHTML = `
    <div class="container page-crumbs__inner">
      <a href="${basePath || "./"}">Acasă</a>
      <span aria-hidden="true">›</span>
      <a href="${basePath}lectii/">Lecții</a>
      ${domain ? `<span aria-hidden="true">›</span><span class="page-crumbs__domain">${domain.label}</span>` : ""}
      <span aria-hidden="true">›</span>
      <b class="page-crumbs__here">${lesson.title}</b>
    </div>`;

  // Sit right below the header (after the XP-bar spacer when present).
  const anchor = document.querySelector(".xp-spacer") || document.getElementById("header");
  if (anchor) anchor.insertAdjacentElement("afterend", nav);
}

/**
 * A gently pulsing border around the whole viewport (+ a small "MOD ADMIN"
 * tag) whenever the ADMIN role is active — on every page, so Marius always
 * knows which hat he's wearing. Follows role changes live via the
 * "atelier:role" event (dispatched by session.js on auth changes). Purely visual;
 * the real gating stays in the role checks.
 */
function initAdminFrame() {
  if (window.__adminFrameOn) return;
  window.__adminFrameOn = true;
  let pending = 0; // cached pending-exercise count (Supabase, refreshed async)
  let modPending = 0; // cached open-moderation count (reports + filter-held)

  const apply = () => {
    const on = isAdmin();
    document.body.classList.toggle("is-admin", on);
    let frame = document.querySelector(".admin-frame");
    if (on && !frame) {
      frame = document.createElement("div");
      frame.className = "admin-frame";
      frame.setAttribute("aria-hidden", "true");
      frame.innerHTML = `<span class="admin-frame__tag">🛡️ mod admin</span>`;
      document.body.appendChild(frame);
    }
    if (!on && frame) frame.remove();
    // CALM by default (thin, static); the full panic-room pulse fires only
    // while something actually awaits the teacher.
    if (on && frame) {
      const alert = modPending + pending > 0;
      frame.classList.toggle("admin-frame--alert", alert);
    }
  };

  // Real pending-exercise count → then re-evaluate the alert pulse.
  const refresh = async () => {
    if (!isAdmin()) return;
    try { pending = await fetchPendingCount(); } catch { pending = 0; }
    try { modPending = await fetchOpenModerationCount(); } catch { modPending = 0; }
    apply();
  };

  apply();
  refresh();
  window.addEventListener("atelier:role", () => { apply(); refresh(); });
  // Re-evaluate the alert state when the tab regains focus (cheap refresh).
  window.addEventListener("focus", apply);
}

/**
 * Eased (inertial) whole-page wheel scrolling for a finer feel.
 * Skips elements that scroll on their own (e.g. the lesson panel) and
 * respects the user's reduced-motion preference. Runs once.
 */
function initSmoothPageScroll() {
  if (window.__smoothScrollOn) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.__smoothScrollOn = true;

  let target = window.scrollY;
  let animating = false;

  function animate() {
    const cur = window.scrollY;
    const diff = target - cur;
    if (Math.abs(diff) < 0.5) {
      window.scrollTo(0, target);
      animating = false;
      return;
    }
    window.scrollTo(0, cur + diff * 0.18); // easing (snappier — closer to native feel)
    requestAnimationFrame(animate);
  }

  // Defer to ANY self-scrolling region under the cursor (messenger, hub chat,
  // notifications, lightbox, future overlays) so we never steal their wheel.
  // Generic — walks the ancestry looking for a real overflow — so there's no
  // allowlist to keep in sync every time a new scrollable panel is added.
  const selfScrolls = (node) => {
    for (let n = node; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      if (n.nodeType !== 1) continue;
      const oy = getComputedStyle(n).overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight - n.clientHeight > 1) return true;
    }
    return false;
  };

  window.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) return; // pinch-zoom
      // Never steal the wheel from a region that scrolls on its own.
      if (e.target instanceof Element && selfScrolls(e.target)) return;

      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;

      e.preventDefault();
      if (!animating) target = window.scrollY;
      target = Math.max(0, Math.min(max, target + e.deltaY));
      if (!animating) {
        animating = true;
        requestAnimationFrame(animate);
      }
    },
    { passive: false }
  );
}

/**
 * Inject reusable SVG filters once per page (DRY).
 * `inner-shadow` paints a shadow INSIDE the shape of any element it's
 * applied to (e.g. text), which plain CSS cannot do. Applied via CSS:
 *   filter: url(#inner-shadow);
 */
function injectSvgFilters() {
  if (document.getElementById("svg-filters")) return;

  const wrap = document.createElement("div");
  wrap.id = "svg-filters";
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  wrap.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="inner-shadow">
          <!-- 1. shift + blur a copy of the shape -->
          <feOffset dx="0" dy="3" />
          <feGaussianBlur stdDeviation="3" result="offset-blur" />
          <!-- 2. keep only the part OUTSIDE the shape (the inverse) -->
          <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
          <!-- 3. color that inverse black -> this becomes the inner shadow -->
          <feFlood flood-color="black" flood-opacity="0.9" result="color" />
          <feComposite operator="in" in="color" in2="inverse" result="shadow" />
          <!-- 4. draw the shadow back on top of the original text -->
          <feComposite operator="over" in="shadow" in2="SourceGraphic" />
        </filter>
      </defs>
    </svg>`;
  document.body.appendChild(wrap);
}

/** Canonical form of a path: no hash, no trailing "index.html" — so
 *  "/lectii/" and "/lectii/index.html" are the same page. */
function canonicalPath(path) {
  return path.split("#")[0].replace(/index\.html$/, "");
}

function renderHeader(basePath) {
  const mount = document.getElementById("header");
  if (!mount) return;

  const herePath = canonicalPath(window.location.pathname);

  const links = NAV_LINKS.map((link) => {
    // guest-only links are hidden via CSS once body.is-logged is set —
    // so the nav reacts live to the 🎭 role switch, no re-render needed.
    const cls = link.guestOnly ? ' class="nav-guest-only"' : "";
    // Absolute paths from the domain root — robust with clean URLs and no
    // longer dependent on how deep the current page is (basePath).
    const href = "/" + link.href; // "Acasă" → "/", "despre/" → "/despre/", …
    const linkPath = new URL(href, window.location.href).pathname;
    const isActive = canonicalPath(linkPath) === herePath;
    const active = isActive ? ' aria-current="page"' : "";
    const title = link.title ? ` title="${link.title}"` : "";
    // data-label lets CSS reserve the bold width up front (no hover shift).
    return `<a${cls}${active}${title} data-label="${link.label}" href="${href}">${link.label}</a>`;
  }).join("");

  mount.innerHTML = `
    <a class="skip-link" href="#continut">Sari la conținut</a>
    <header class="site-header">
      <div class="container site-header__inner">
        <a class="site-header__brand" href="/">
          <img class="site-header__logo" src="${basePath}assets/logo/logo.png" alt="${APP_NAME}" />
        </a>
        <nav class="main-nav" aria-label="Primary">
          ${links}
          <span class="nav-user-slot"></span>
        </nav>
      </div>
    </header>`;

  // The skip link's target: the page's <main> (id added here, DRY).
  const main = document.querySelector("main");
  if (main && !main.id) main.id = "continut";

  initNavUser(mount.querySelector(".nav-user-slot"), basePath);
  initNotifCenter(basePath);
  loadNotifications(); // fill the bell from REAL notifications (fires atelier:notifs)

  const header = mount.querySelector(".site-header");

  // The header is fixed; #header (mount) is a constant-height spacer so
  // the page never reflows as the header morphs → no jitter.
  const MORPH_RANGE = 130; // px of scroll over which bar → pill happens
  let expandedHeight = 0;

  const measure = () => {
    // Measure the expanded header height (with --p = 0) once, for the spacer.
    const prev = header.style.getPropertyValue("--p");
    header.style.setProperty("--p", "0");
    expandedHeight = header.offsetHeight;
    mount.style.height = `${expandedHeight}px`;
    header.style.setProperty("--p", prev || "0");
  };

  // Continuous morph: p = scroll progress 0..1 (no threshold, no toggle).
  const onScroll = () => {
    const p = Math.min(1, Math.max(0, window.scrollY / MORPH_RANGE));
    header.style.setProperty("--p", p.toFixed(3));
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  measure();
  onScroll();
}

/**
 * The account slot at the nav's end — like on any real site:
 *   guest  → the "Intră în cont" button
 *   member → identity chip: avatar + first name + level & XP (→ profile)
 *   admin  → identity chip: avatar + name + 🎓 Profesor (no XP — not in
 *            the game)
 * Follows role changes AND point gains live.
 */
function initNavUser(slot, basePath) {
  if (!slot) return;

  // The logout icon — same on every page for anyone signed in.
  const logoutBtn = `<button type="button" class="nav-logout" id="nav-logout" title="Ieși din cont" aria-label="Ieși din cont">${LOGOUT_ICON}</button>`;

  const build = () => {
    if (!isLoggedIn()) {
      slot.innerHTML = `<a class="btn btn--primary nav-cta" href="/comunitate/login/">Intră în cont</a>`;
      return;
    }
    // MEMBERS live on the XP bar row (name + avatar there, one row with the
    // progress — see xp-bar.js); the nav stays clean apart from logout. The
    // ADMIN has no XP bar, so his identity chip stays here.
    if (!isAdmin()) {
      slot.innerHTML = logoutBtn;
      return;
    }
    const avatar = MY_PROFILE.avatar
      ? `<span class="nav-user__av" style="background-image:url('${basePath}${MY_PROFILE.avatar}')" role="img" aria-label="Avatarul tău"></span>`
      : `<span class="nav-user__av nav-user__av--init" style="--a:${CURRENT_USER.color}">${CURRENT_USER.initials}</span>`;
    const total = notifTotal();
    slot.innerHTML = `
      <button type="button" class="nav-user" title="Click: profilul tău · Hover: noutățile tale">
        ${avatar}
        <span class="nav-user__id">
          <b class="nav-user__name">🎓 Profesor</b>
          <span class="nav-user__meta">cadru didactic</span>
        </span>
        ${total ? `<b class="nav-user__badge">${total}</b>` : ""}
      </button>
      ${logoutBtn}`;
  };

  // The logout icon opens the confirm dialog (delegated: the slot is rebuilt
  // on role/notif changes, so we listen on the stable slot element).
  slot.addEventListener("click", (e) => {
    if (e.target.closest("#nav-logout")) {
      e.preventDefault();
      confirmLogout(basePath);
    }
  });

  build();
  window.addEventListener("atelier:role", build);
  window.addEventListener("focus", build);
  window.addEventListener("atelier:notifs", build); // badge follows the tray
}

/**
 * NOTIFICATION CENTER — anchored to the logged user's NAME (the chip on
 * the XP bar for members, the nav chip for the admin). The badge with the
 * unread total sits on the chip; clicking the chip opens a properly
 * designed panel: typed rows (Prietenie / Mesaje / Activitate), aligned
 * icon–content–time columns, hover states, and doors to the hub.
 */
const NOTIF_ICONS = {
  friend: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M18 8v6M21 11h-6"/></svg>`,
  message: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
  comment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 20l1.4-4.2A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/></svg>`,
  like: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.35-9.5-8.5C1 9.5 2.5 6 6 6c2 0 3.2 1.2 4 2.3C10.8 7.2 12 6 14 6c3.5 0 5 3.5 3.5 6.5C19 16.65 12 21 12 21z"/></svg>`,
  reply: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17l-5-5 5-5"/><path d="M4 12h11a5 5 0 0 1 5 5v2"/></svg>`,
  award: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M9 14l-1.5 7L12 18l4.5 3L15 14"/></svg>`,
  mention: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"/></svg>`,
  poke: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h14"/><path d="M10 6l6 6-6 6"/><circle cx="20" cy="12" r="2"/></svg>`,
};
const NOTIF_KIND_LABELS = {
  friend: ["Cerere de prietenie", "#7c3aed"],
  message: ["Mesaj", "#0891b2"],
  comment: ["Comentariu", "#2563eb"],
  reply: ["Răspuns", "#16a34a"],
  like: ["Apreciere", "#db2777"],
  award: ["Recompensă", "#16a34a"],
  mention: ["Mențiune", "#0891b2"],
  poke: ["Poke", "#f59e0b"],
};

function initNotifCenter(basePath) {
  if (window.__notifCenterOn) return;
  window.__notifCenterOn = true;

  const HUB = `${basePath}comunitate/`;
  let panel = null;

  const row = ({ kind, title, text, time, href, unread }) => {
    const [label, color] = NOTIF_KIND_LABELS[kind] || NOTIF_KIND_LABELS.comment;
    return `<a class="notif__row${unread ? " is-unread" : ""}" href="${href}">
        <span class="notif__ic" style="--k:${color}">${NOTIF_ICONS[kind] || NOTIF_ICONS.comment}</span>
        <span class="notif__body">
          <span class="notif__kind" style="--k:${color}">${label}</span>
          <span class="notif__text">${title}</span>
          ${text ? `<span class="notif__snip">${text}</span>` : ""}
        </span>
        <span class="notif__time">${time || ""}</span>
      </a>`;
  };

  // The panel lists EXACTLY the tray items (notif.js) — same lists feed
  // the badge, so the number and the rows always match. Everything shown
  // disappears once the tray was viewed (consumeTray on close).
  const panelHtml = () => {
    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const titleFor = (n) => {
      const name = esc((n.payload || {}).actor_name || "Cineva");
      switch (n.type) {
        case "friend":
          return (n.payload || {}).kind === "accepted"
            ? `<b>${name}</b> ți-a acceptat cererea de prietenie`
            : `<b>${name}</b> vrea să-ți fie prieten(ă)`;
        case "message": return `<b>${name}</b> ți-a scris`;
        case "like": return `<b>${name}</b> ți-a apreciat o postare`;
        case "comment": return `<b>${name}</b> a comentat la postarea ta`;
        case "reply": return `<b>${name}</b> ți-a răspuns la un comentariu`;
        case "mention": return `<b>${name}</b> te-a menționat`;
        case "poke": return `<b>${name}</b> te-a înghiontit 👉`;
        case "award": {
          const p = n.payload || {};
          if (p.kind === "exercise-approved") return `Exercițiul tău a fost aprobat 🎉 <b>+${p.points || 0}</b> puncte`;
          if (p.kind === "exercise-rejected") return `Propunerea ta de exercițiu n-a fost aprobată de data asta`;
          return `Ai primit o recompensă`;
        }
        default: return `<b>${name}</b>`;
      }
    };
    const hrefFor = (n) => {
      const p = n.payload || {};
      if (n.type === "message") {
        // A pupil's message to the teacher lands in the admin inbox; else the thread.
        if (p.to_admin) return `${HUB}#mesaje`;
        return p.actor ? `${HUB}#msg/${p.actor}` : `${HUB}#mesaje`;
      }
      if (n.type === "friend") return `${HUB}#profil`;
      if (n.type === "award") return `${HUB}#exercitii`; // exercițiu aprobat/respins
      if (p.post_id) return `${HUB}#post/${p.post_id}`; // like/comment/reply/mention → postarea exactă
      return `${HUB}#forum`;
    };
    // Group repeated like/comment/reply notifications on the SAME post into one
    // row ("X și alți N ți-au apreciat o postare"). Other types stay individual.
    const GROUPABLE = new Set(["like", "comment", "reply"]);
    const groups = [];
    const byKey = new Map();
    for (const n of notifRows()) {
      const p = n.payload || {};
      const key = GROUPABLE.has(n.type) && p.post_id ? `${n.type}:${p.post_id}` : `solo:${n.id}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.count++;
        if (!n.read_at) existing.unread = true;
      } else {
        const g = { n, count: 1, unread: !n.read_at };
        byKey.set(key, g);
        groups.push(g);
      }
    }
    const groupTitle = (n, count) => {
      if (count <= 1) return titleFor(n);
      const name = esc((n.payload || {}).actor_name || "Cineva");
      const more = `și alți ${count - 1}`;
      switch (n.type) {
        case "like": return `<b>${name}</b> ${more} ți-au apreciat o postare`;
        case "comment": return `<b>${name}</b> ${more} au comentat la postarea ta`;
        case "reply": return `<b>${name}</b> ${more} ți-au răspuns`;
        default: return titleFor(n);
      }
    };
    const rows = groups.map((g) =>
      row({
        kind: g.n.type,
        title: groupTitle(g.n, g.count),
        text: (g.n.payload || {}).snippet ? `„${esc(g.n.payload.snippet)}”` : "",
        time: relTime(new Date(g.n.created_at).getTime()),
        href: hrefFor(g.n),
        unread: g.unread,
      })
    );
    return `
      <div class="notif" role="dialog" aria-label="Noutățile tale">
        <div class="notif__head">
          <b>Noutățile tale</b>
          ${notifTotal() ? `<span class="notif__total">${notifTotal()} noi</span>` : ""}
          ${notifRows().length ? `<button type="button" class="notif__clear" data-act="notif-clear" title="Șterge toate notificările">Șterge tot</button>` : ""}
        </div>
        ${!isAdmin() && CURRENT_USER.email
          ? `<div class="notif__me" title="Adresa ta de email (doar tu o vezi)">✉️ ${CURRENT_USER.email.replace(/[<>&"]/g, "")}</div>`
          : ""}
        <div class="notif__list">
          ${rows.join("") || `<p class="notif__empty">Ești la zi! 🎉 Tot istoricul e la „Activitatea mea”.</p>`}
        </div>
        <div class="notif__foot">
          <a href="${HUB}#activitate">Toată activitatea</a>
          <a href="${HUB}#mesaje">Mesaje</a>
          <a href="${HUB}#profil">Profilul tău</a>
        </div>
      </div>`;
  };

  let openedAt = 0;
  const close = () => {
    if (!panel) return;
    panel.remove();
    panel = null;
    // Viewed = seen: everything the tray showed leaves it and the badge
    // drops. Requests remain actionable in Profil, messages unread in
    // Mesaje — only the TRAY forgets them. A blink-open (cursor just
    // passing over the chip) does NOT count as "viewed".
    if (Date.now() - openedAt > 600) consumeTray();
  };

  const open = (anchor) => {
    close();
    openedAt = Date.now();
    panel = document.createElement("div");
    panel.className = "notif-wrap";
    panel.innerHTML = panelHtml();
    document.body.appendChild(panel);
    // "Șterge tot" — clear the tray without navigating.
    panel.querySelector("[data-act='notif-clear']")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearAllNotifications();
      close();
    });
    const r = anchor.getBoundingClientRect();
    const el = panel.firstElementChild;
    const w = Math.min(360, innerWidth - 16);
    el.style.width = `${w}px`;
    el.style.top = `${r.bottom + 8}px`;
    el.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  };

  // HOVER on the chip = notifications preview; CLICK on the chip = your
  // page. A small grace delay lets the cursor travel chip → panel.
  let closeTimer = null;
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(close, 220);
  };

  document.addEventListener("mouseover", (e) => {
    const chip = e.target.closest(".xp__user, .nav-user");
    if (chip) {
      clearTimeout(closeTimer);
      if (!panel) open(chip);
      return;
    }
    if (panel && panel.contains(e.target)) {
      clearTimeout(closeTimer); // resting on the panel keeps it open
      return;
    }
    if (panel) scheduleClose();
  });

  // TOUCH: no hover exists — a PRESS-AND-HOLD (~450ms) on the chip opens
  // the tray (Marius's rule: hover-urile se activează cu stylus sau
  // apăsare lungă); a short tap still navigates to "Pagina mea".
  let holdTimer = null;
  let heldOpen = false;
  let holdStart = null;
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    const chip = e.target.closest(".xp__user, .nav-user");
    if (!chip) return;
    heldOpen = false;
    holdStart = { x: e.clientX, y: e.clientY };
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      heldOpen = true;
      open(chip);
    }, 450);
  });
  const cancelHold = () => clearTimeout(holdTimer);
  document.addEventListener("pointerup", cancelHold);
  document.addEventListener("pointercancel", cancelHold);
  document.addEventListener("pointermove", (e) => {
    // A finger that wanders is scrolling, not holding.
    if (e.pointerType === "mouse" || !holdStart) return;
    if (Math.hypot(e.clientX - holdStart.x, e.clientY - holdStart.y) > 12) cancelHold();
  }, { passive: true });
  // The browser's own long-press menu would fight ours on the chip.
  document.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".xp__user, .nav-user")) e.preventDefault();
  });

  // Click on the chip → "Pagina mea" (the admin, who has no wall, lands on
  // his profile) — unless this very click was the tail of a long-press.
  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".xp__user, .nav-user");
    if (chip) {
      e.preventDefault();
      if (heldOpen) {
        heldOpen = false; // the hold already opened the tray — stay
        return;
      }
      close();
      window.location.href = `${HUB}#${isAdmin() ? "profil" : "pagina-mea"}`;
      return;
    }
    if (panel && !panel.contains(e.target)) close();
  });

  window.addEventListener("scroll", close, { passive: true });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  window.addEventListener("atelier:role", close);
}

function renderFooter(basePath) {
  const mount = document.getElementById("footer");
  if (!mount) return;

  const year = new Date().getFullYear();
  mount.innerHTML = `
    <footer class="site-footer">
      <div class="container site-footer__cols">
        <div class="site-footer__col">
          <p class="site-footer__brand">${APP_NAME}</p>
          <p class="site-footer__tag">Limba și literatura română, pe înțelesul tău.</p>
        </div>
        <nav class="site-footer__col" aria-label="Navigare">
          <p class="site-footer__head">Navigare</p>
          <a href="/">Acasă</a>
          <a href="/despre/">Despre</a>
          <a href="/lectii/">Lecții</a>
          <a href="/comunitate/#forum">Atelier</a>
        </nav>
        <nav class="site-footer__col" aria-label="Legal">
          <p class="site-footer__head">Legal</p>
          <a href="/termeni/">Termeni de utilizare</a>
          <a href="/confidentialitate/">Confidențialitate</a>
        </nav>
        <div class="site-footer__col">
          <p class="site-footer__head">Contact</p>
          <button type="button" class="site-footer__contact" id="footer-contact">${isAdmin() ? "✉️ Mesaje" : "✉️ Scrie-i profesorului"}</button>
        </div>
      </div>
      <div class="container site-footer__inner">
        <p>&copy; ${year} ${APP_NAME} — Limba și literatura română.</p>
      </div>
    </footer>`;

  // "Scrie-i profesorului" opens the floating Messenger straight in the teacher
  // thread (pupil), the list (teacher) or the contact form (guest).
  mount.querySelector("#footer-contact")?.addEventListener("click", () => openMessenger({ teacher: true }));
}

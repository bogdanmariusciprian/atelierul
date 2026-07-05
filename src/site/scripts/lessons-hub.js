// =========================================================
// Lessons hub: an "explorer" — domains as tabs on the left, the
// selected domain's lessons on the right (each a progress-ring node).
// Only one domain is shown at a time, so the whole page doesn't scroll.
// Data comes from the shared modules (DRY): domains + lessons.
// =========================================================
import { LESSON_DOMAINS } from "../../shared/scripts/domains.js";
import { LESSONS } from "../../shared/scripts/lessons-index.js";
import { isLessonDone } from "./lesson-progress.js";
import { isLoggedIn } from "../../shared/scripts/session.js";

/** Ring progress for a lesson: 100% once its page was marked finished.
 *  Keyed by the STABLE lesson slug (not the URL). */
function lessonProgress(lesson) {
  if (!lesson.slug) return 0;
  return isLessonDone(lesson.slug) ? 100 : 0;
}

/**
 * One node in a domain's lesson track: circular index + progress ring,
 * with the lesson label beside it. `progress` is 0–100 (percent
 * complete); 0 until connected to the logged-in user's data. The ring
 * uses pathLength="100" so the dasharray value is the percentage.
 */
function nodeMarkup(lesson, index, basePath, progress = 0) {
  const ready = lesson.ready && lesson.href;
  const ring = `
    <svg class="node__ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="node__track" cx="50" cy="50" r="42" pathLength="100" />
      <circle class="node__progress" cx="50" cy="50" r="42" pathLength="100"
              style="stroke-dasharray: ${progress} 100" />
    </svg>
    <span class="node__index">${index}</span>`;
  const summary = lesson.summary
    ? `<span class="track-node__summary">${lesson.summary}</span>`
    : "";

  // Planned title (no page yet): non-clickable, marked "în curând".
  if (!ready) {
    return `
      <li class="track-node track-node--soon">
        <span class="node">${ring}</span>
        <span class="track-node__label">
          <span class="track-node__title">${lesson.title}
            <span class="track-node__soon">în curând</span>
          </span>
          ${summary}
        </span>
      </li>`;
  }

  const href = `${basePath}${lesson.href}`;
  return `
    <li class="track-node">
      <a class="node" href="${href}" aria-label="${lesson.title}">${ring}</a>
      <a class="track-node__label" href="${href}">
        <span class="track-node__title">${lesson.title}</span>
        ${summary}
      </a>
    </li>`;
}

/** Fold diacritics + case so "virgula" also finds „Virgulă”. */
function fold(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Global lesson search — type anything, get matching lessons across ALL
 * domains instantly (title + summary), with the domain shown as a chip.
 * Ready lessons link straight to their page; planned ones say "în curând".
 */
function initLessonsSearch(mount, basePath) {
  const input = mount.querySelector("#lessons-search");
  const results = mount.querySelector("#lessons-search-results");
  if (!input || !results) return;

  const domainOf = (slug) => LESSON_DOMAINS.find((d) => d.slug === slug);

  const show = (q) => {
    const fq = fold(q.trim());
    if (fq.length < 2) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }
    const hits = LESSONS.filter((l) => fold(`${l.title} ${l.summary || ""}`).includes(fq)).slice(0, 8);
    results.innerHTML = hits.length
      ? hits
          .map((l) => {
            const d = domainOf(l.domain);
            const chip = d ? `<span class="lessons-search__chip" style="--c:${d.color}">${d.label}</span>` : "";
            return l.ready && l.href
              ? `<a class="lessons-search__hit" href="${basePath}${l.href}">${chip}<span>${l.title}</span></a>`
              : `<span class="lessons-search__hit lessons-search__hit--soon">${chip}<span>${l.title}</span><em>în curând</em></span>`;
          })
          .join("")
      : `<p class="lessons-search__none">Nicio lecție nu se potrivește. Încearcă alt cuvânt.</p>`;
    results.hidden = false;
  };

  input.addEventListener("input", () => show(input.value));
  input.addEventListener("focus", () => show(input.value));
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".lessons-search")) results.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") results.hidden = true;
  });

  // Keyboard navigation: ↓/↑ walk the results, Enter opens the active one.
  input.addEventListener("keydown", (e) => {
    if (results.hidden) return;
    const hits = [...results.querySelectorAll("a.lessons-search__hit")];
    if (!hits.length) return;
    const cur = hits.findIndex((h) => h.classList.contains("is-active"));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? (cur + 1) % hits.length : (cur - 1 + hits.length) % hits.length;
      hits.forEach((h, i) => h.classList.toggle("is-active", i === next));
      hits[next].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && cur >= 0) {
      e.preventDefault();
      hits[cur].click();
    }
  });
}

export function renderLessonsHub(basePath = "") {
  const mount = document.getElementById("lessons-hub");
  if (!mount) return;

  const countLabel = (n) => `${n} ${n === 1 ? "lecție" : "lecții"}`;

  // A domain's SVG, tinted with its accent color via a CSS mask. Same
  // icons as the Home cards. Set inline so the URL resolves to the page.
  const maskStyle = (domain) => {
    if (!domain.watermark) return "";
    const u = `${basePath}${domain.watermark}`;
    return `background: var(--card-color);` +
      `-webkit-mask: url('${u}') no-repeat center / contain;` +
      `mask: url('${u}') no-repeat center / contain;`;
  };
  const iconMarkup = (domain, cls) =>
    domain.watermark
      ? `<span class="${cls}" aria-hidden="true" style="${maskStyle(domain)}"></span>`
      : `<span class="${cls}" aria-hidden="true">${domain.icon}</span>`;

  const tabs = LESSON_DOMAINS.map((domain) => {
    const count = LESSONS.filter((l) => l.domain === domain.slug).length;
    return `
      <button class="domain-tab" type="button" data-target="${domain.slug}"
              style="--card-color: ${domain.color}">
        ${iconMarkup(domain, "domain-tab__icon")}
        <span class="domain-tab__label">${domain.label}</span>
        <span class="domain-tab__count">${count}</span>
      </button>`;
  }).join("");

  const panels = LESSON_DOMAINS.map((domain) => {
    const lessons = LESSONS.filter((l) => l.domain === domain.slug);
    const track = lessons.length
      ? `<ol class="lesson-track">${lessons
          .map((l, i) => nodeMarkup(l, i + 1, basePath, lessonProgress(l)))
          .join("")}</ol>`
      : `<p class="lesson-track__empty">În curând.</p>`;

    // Dots are generated dynamically by fancy-scroll.js (as many as
    // needed for a smooth scroll), so this container starts empty.
    const dots = lessons.length
      ? `<nav class="scroll-dots" aria-hidden="true"></nav>`
      : "";

    return `
      <section class="domain-panel" id="${domain.slug}"
               style="--card-color: ${domain.color}">
        <div class="domain-panel__viewport">
          <header class="domain-panel__head">
            ${iconMarkup(domain, "domain-panel__watermark")}
            <span class="domain-panel__icon" aria-hidden="true">${
              domain.watermark
                ? `<span class="domain-panel__iconimg" style="${maskStyle(domain)}"></span>`
                : domain.icon
            }</span>
            <div>
              <h2 class="domain-panel__title">${domain.label}</h2>
              <p class="domain-panel__meta">${countLabel(lessons.length)}</p>
            </div>
          </header>
          ${track}
        </div>
        <div class="panel-blur panel-blur--top" aria-hidden="true"></div>
        <div class="panel-blur panel-blur--bottom" aria-hidden="true"></div>
        <div class="panel-inset" aria-hidden="true"></div>
        ${dots}
        ${
          lessons.length
            ? `<button class="domain-panel__expand" type="button" aria-expanded="false">
                 <span class="domain-panel__expand-label">Extinde toate lecțiile</span>
                 <svg class="domain-panel__expand-icon" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                      stroke-linejoin="round" aria-hidden="true">
                   <path d="m6 9 6 6 6-6" />
                 </svg>
               </button>`
            : ""
        }
      </section>`;
  }).join("");

  // Guests learn WHY the progress rings exist — a reason to join.
  const progressHint = !isLoggedIn()
    ? `<p class="lessons-hint">🔓 Inelele arată progresul tău pe lecții.
         <a href="${basePath}comunitate/login/">Creează-ți cont</a> ca să ți-l salvezi.</p>`
    : "";

  mount.innerHTML = `
    <div class="lessons-search">
      <input class="lessons-search__input" id="lessons-search" type="search"
        placeholder="🔍 Caută o lecție (ex: virgula, verbul, metafora)…" autocomplete="off" />
      <div class="lessons-search__results" id="lessons-search-results" hidden></div>
    </div>
    ${progressHint}
    <div class="lessons-explorer">
      <nav class="domain-tabs" aria-label="Domenii">${tabs}</nav>
      <div class="domain-panels">${panels}</div>
    </div>`;

  initLessonsSearch(mount, basePath);

  const tabButtons = mount.querySelectorAll(".domain-tab");
  const panelSections = mount.querySelectorAll(".domain-panel");

  function activate(slug) {
    tabButtons.forEach((t) =>
      t.classList.toggle("is-active", t.dataset.target === slug)
    );
    panelSections.forEach((p) => p.classList.toggle("is-active", p.id === slug));
  }

  tabButtons.forEach((tab) =>
    tab.addEventListener("click", () => {
      activate(tab.dataset.target);
      history.replaceState(null, "", `#${tab.dataset.target}`);
    })
  );

  // Cap each panel to the height of the tabs column so its bottom lines up
  // with the last tab. Re-measured on resize (tab wrapping, font changes…).
  const explorer = mount.querySelector(".lessons-explorer");
  const tabsNav = mount.querySelector(".domain-tabs");
  const syncPanelHeight = () => {
    if (!explorer || !tabsNav) return;
    explorer.style.setProperty("--panel-h", `${tabsNav.offsetHeight}px`);
  };
  syncPanelHeight();
  window.addEventListener("resize", syncPanelHeight);

  // Expand/collapse: the bottom bar toggles between the capped, scrollable
  // panel and a full-length one. fancy-scroll.js reacts to the size change
  // (via ResizeObserver) and drops the dots/blur on its own.
  mount.querySelectorAll(".domain-panel__expand").forEach((btn) => {
    const panel = btn.closest(".domain-panel");
    const label = btn.querySelector(".domain-panel__expand-label");
    btn.addEventListener("click", () => {
      const expanded = panel.classList.toggle("is-expanded");
      btn.setAttribute("aria-expanded", String(expanded));
      label.textContent = expanded ? "Restrânge" : "Extinde toate lecțiile";
    });
  });

  // Open the domain from the URL hash (e.g. coming from a Home card),
  // otherwise the first domain.
  const fromHash = location.hash.slice(1);
  const initial = LESSON_DOMAINS.some((d) => d.slug === fromHash)
    ? fromHash
    : LESSON_DOMAINS[0].slug;
  activate(initial);
}

// =========================================================
// Lesson panel scroll UX (no classic scrollbar):
//   • a side "dot stepper" whose dots are scroll positions (not
//     lessons). Enough dots are generated to fit the panel height so
//     scrolling glides through them one by one; click a dot to jump.
//   • progressive-blur edges (top/bottom) that appear when there's
//     more content to scroll in that direction.
//   • eased (smooth) wheel + dot-click scrolling.
// Native scrollbar is hidden via CSS. Reused by every panel (DRY).
// =========================================================

const DOT_SLOT = 18; // px per dot (dot size + gap)

function setupPanel(panel) {
  const vp = panel.querySelector(".domain-panel__viewport");
  if (!vp) return;

  const dotsNav = panel.querySelector(".scroll-dots");
  const blurTop = panel.querySelector(".panel-blur--top");
  const blurBottom = panel.querySelector(".panel-blur--bottom");
  const head = vp.querySelector(".domain-panel__head");

  let dots = [];
  let target = vp.scrollTop;
  let animating = false;

  // --- eased scrolling (shared by wheel + dot clicks) ---
  function animate() {
    const diff = target - vp.scrollTop;
    if (Math.abs(diff) < 0.5) {
      vp.scrollTop = target;
      animating = false;
      return;
    }
    vp.scrollTop += diff * 0.18; // easing (lower = smoother/slower)
    requestAnimationFrame(animate);
  }

  function scrollToPos(top) {
    const max = vp.scrollHeight - vp.clientHeight;
    target = Math.max(0, Math.min(max, top));
    if (!animating) {
      animating = true;
      requestAnimationFrame(animate);
    }
  }

  // --- build exactly as many dots as fit / are needed ---
  function buildDots() {
    if (!dotsNav) return;
    const scrollable = vp.scrollHeight - vp.clientHeight;

    if (scrollable <= 4) {
      dotsNav.innerHTML = "";
      dots = [];
      dotsNav.style.display = "none";
      return;
    }
    dotsNav.style.display = "";

    // ~1 dot per 120px of content (about one wheel step), capped to fit.
    const maxDots = Math.max(3, Math.floor((vp.clientHeight - 60) / DOT_SLOT));
    const desired = Math.round(scrollable / 120) + 1;
    const count = Math.min(desired, maxDots);

    if (dots.length !== count) {
      dotsNav.innerHTML = Array.from(
        { length: count },
        (_, i) => `<button class="scroll-dot" data-index="${i}" type="button"></button>`
      ).join("");
      dots = [...dotsNav.querySelectorAll(".scroll-dot")];

      dots.forEach((dot, i) => {
        dot.addEventListener("click", () => {
          const max = vp.scrollHeight - vp.clientHeight;
          scrollToPos((i / (dots.length - 1)) * max);
        });
      });
    }
  }

  function update() {
    const { scrollTop, scrollHeight, clientHeight } = vp;
    const scrollable = scrollHeight - clientHeight;

    // Progressive-blur edges.
    blurTop?.classList.toggle("is-visible", scrollTop > 6);
    blurBottom?.classList.toggle(
      "is-visible",
      scrollable > 6 && scrollTop < scrollable - 6
    );

    // Active dot follows scroll progress; snaps to the last one at bottom.
    if (dots.length > 1) {
      const progress = scrollable > 0 ? scrollTop / scrollable : 0;
      let active = Math.round(progress * (dots.length - 1));
      if (scrollTop >= scrollable - 2) active = dots.length - 1;
      dots.forEach((dot, i) => dot.classList.toggle("is-active", i === active));
    }
  }

  function refresh() {
    // Position the top blur right under the sticky header.
    if (head) panel.style.setProperty("--head-h", `${head.offsetHeight}px`);
    buildDots();
    update();

    // Flag overflow so the expand bar only shows when there's more to see.
    // While expanded there's no scroll, so keep the last compact value.
    if (!panel.classList.contains("is-expanded")) {
      const scrollable = vp.scrollHeight - vp.clientHeight;
      panel.classList.toggle("has-overflow", scrollable > 4);
    }
  }

  vp.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", refresh);
  if ("ResizeObserver" in window) {
    new ResizeObserver(refresh).observe(vp);
  }

  // Eased wheel scrolling instead of abrupt native jumps.
  vp.addEventListener(
    "wheel",
    (e) => {
      // Expanded → no internal scroll; let the page scroll natively.
      if (panel.classList.contains("is-expanded")) return;

      const scrollable = vp.scrollHeight - vp.clientHeight;
      if (scrollable <= 0) return;

      // At an edge and scrolling further out → let the page scroll.
      if (
        (vp.scrollTop <= 0 && e.deltaY < 0) ||
        (vp.scrollTop >= scrollable && e.deltaY > 0)
      ) {
        return;
      }

      e.preventDefault();
      if (!animating) target = vp.scrollTop;
      scrollToPos(target + e.deltaY);
    },
    { passive: false }
  );

  // Watermark flees the cursor: it slides opposite to the mouse across
  // the header, then glides back to its resting place on leave.
  const watermark = head?.querySelector(".domain-panel__watermark");
  if (head && watermark) {
    head.addEventListener("pointermove", (e) => {
      watermark.style.transition = ""; // quick, responsive flee (CSS default)
      const rect = head.getBoundingClientRect();
      const ww = watermark.offsetWidth || 112;
      const wh = watermark.offsetHeight || 112;
      // Cursor position within the header, 0..1.
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      // Move away: anchored top-right, so drift left as cursor goes right.
      const x = -fx * (rect.width - ww * 0.5);
      const y = (0.5 - fy) * (rect.height + wh * 0.3);
      const r = -14 + (1 - fx) * 28; // slight tilt with position
      watermark.style.transform =
        `translate(${x}px, ${y}px) rotate(${r}deg) scale(1.12)`;
    });

    head.addEventListener("pointerleave", () => {
      // Slow, lazy drift back to its resting place.
      watermark.style.transition =
        "transform 2.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease";
      watermark.style.transform = ""; // back to the CSS resting transform
    });
  }

  refresh();
}

/** Enhance every lesson panel. Call once after the hub is rendered. */
export function initFancyScroll() {
  document.querySelectorAll(".domain-panel").forEach(setupPanel);
}

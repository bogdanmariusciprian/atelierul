// =========================================================
// Home page logic: render the lesson-domain cards.
// Domains come from the shared data module (DRY).
// A domain may declare a `watermark` (SVG) that reacts to the cursor,
// reusing the same "flee the pointer" motion as the lesson panels.
// =========================================================
import { LESSON_DOMAINS } from "../../shared/scripts/domains.js";

/** basePath = path from this page back to project root. */
export function renderDomainCards(basePath = "") {
  const mount = document.getElementById("domain-cards");
  if (!mount) return;

  mount.innerHTML = LESSON_DOMAINS.map((domain) => {
    // The mask URL is set inline (not via a CSS var) so it resolves
    // relative to the page, not to the stylesheet's folder.
    const wm = `${basePath}${domain.watermark}`;
    const watermark = domain.watermark
      ? `<span class="domain-card__watermark" aria-hidden="true"
              style="-webkit-mask: url('${wm}') no-repeat center / contain;
                     mask: url('${wm}') no-repeat center / contain;"></span>`
      : "";
    return `
      <a class="domain-card domain-card--${domain.slug}"
         href="${basePath}lectii/#${domain.slug}">
        ${watermark}
        <h3 class="domain-card__title">${domain.label}</h3>
      </a>`;
  }).join("");

  wireWatermarks(mount);
}

/**
 * Watermark "flees" the cursor: it slides opposite to the mouse across the
 * card, then glides slowly back to rest on leave. Same feel as the lesson
 * panel watermark (see fancy-scroll.js), tuned for the smaller card.
 */
function wireWatermarks(mount) {
  mount.querySelectorAll(".domain-card").forEach((card) => {
    const wm = card.querySelector(".domain-card__watermark");
    if (!wm) return;

    card.addEventListener("pointermove", (e) => {
      wm.style.transition = ""; // quick, responsive flee
      const r = card.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width; // 0..1
      const fy = (e.clientY - r.top) / r.height;
      const x = -(fx - 0.5) * 60; // drift opposite to the cursor
      const y = -(fy - 0.5) * 40;
      const rot = -8 + (0.5 - fx) * 24;
      wm.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(1.12)`;
    });

    card.addEventListener("pointerleave", () => {
      wm.style.transition = "transform 2.6s cubic-bezier(0.22, 1, 0.36, 1)";
      wm.style.transform = ""; // back to the CSS resting transform
    });
  });
}

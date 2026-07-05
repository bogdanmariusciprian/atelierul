// =========================================================
// Right-click menu on user names — anywhere one appears (posts, comments,
// leaderboards, testimonials…). Offers: copy the name, open the profile,
// copy the profile link. One document-level listener (DRY), initialized
// once from site-chrome's renderChrome.
// =========================================================
import { showToast } from "./toast.js";

// Everything that displays a user's name. Elements without a profile link
// (leaderboards, deleted accounts, the professor) still get "copy name".
const NAME_SELECTOR = ".cx-userlink, .cx-username, .thr__name, a.tm__name, [data-user-name]";

let menuEl = null;

export function initUserMenu() {
  if (window.__userMenuOn || typeof document === "undefined") return;
  window.__userMenuOn = true;

  document.addEventListener("contextmenu", (e) => {
    const target = e.target.closest(NAME_SELECTOR);
    if (!target) {
      closeMenu();
      return; // normal browser menu elsewhere
    }
    e.preventDefault();
    openMenu(target, e.clientX, e.clientY);
  });

  // Any click, scroll, resize or Esc dismisses it.
  document.addEventListener("click", closeMenu);
  window.addEventListener("scroll", closeMenu, { passive: true });
  window.addEventListener("resize", closeMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}

/** The displayed name, without decorations like the "🎓 Profesor" tag. */
function cleanName(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll(".cx-teacher, .cx-adminchip").forEach((n) => n.remove());
  return clone.textContent.replace(/^@/, "").trim();
}

function openMenu(target, x, y) {
  closeMenu();
  const name = cleanName(target);
  if (!name) return;
  const href = target.closest("a[href]")?.href || null;

  const item = (action, icon, label) =>
    `<button type="button" class="user-menu__item" data-menu="${action}">${icon} ${label}</button>`;
  menuEl = document.createElement("div");
  menuEl.className = "user-menu";
  menuEl.setAttribute("role", "menu");
  menuEl.innerHTML = [
    item("copy-name", "📋", "Copiază numele"),
    href ? item("open-profile", "👤", "Vezi profilul") : "",
    href ? item("copy-link", "🔗", "Copiază linkul profilului") : "",
  ].join("");
  document.body.appendChild(menuEl);

  // Keep it on screen.
  const r = menuEl.getBoundingClientRect();
  menuEl.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`;
  menuEl.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`;

  menuEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-menu]");
    if (!btn) return;
    e.stopPropagation();
    const copy = (text, done) =>
      navigator.clipboard
        ?.writeText(text)
        .then(() => showToast(done, { kind: "success" }))
        .catch(() => showToast("Nu s-a putut copia", { kind: "error" }));
    switch (btn.dataset.menu) {
      case "copy-name":
        copy(name, `📋 „${name}” copiat`);
        break;
      case "open-profile":
        window.location.href = href;
        break;
      case "copy-link":
        copy(href, "🔗 Link de profil copiat");
        break;
    }
    closeMenu();
  });
}

function closeMenu() {
  if (menuEl) {
    menuEl.remove();
    menuEl = null;
  }
}

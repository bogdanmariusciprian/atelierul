// =========================================================
// Tiny site-wide toast (single source of truth, DRY). Use it whenever an
// action needs lightweight confirmation the UI doesn't otherwise show
// (reshare, copy, save…). Bottom-center pill, auto-dismiss, stacks up to
// three, respects prefers-reduced-motion (no slide, just fade).
//
//   import { showToast } from ".../toast.js";
//   showToast("Postare redistribuită pe pagina ta ↪");
//   showToast("Nu s-a putut copia", { kind: "error" });
// =========================================================

let host = null;

function ensureHost() {
  if (host && document.body.contains(host)) return host;
  host = document.createElement("div");
  host.className = "toasts";
  host.setAttribute("aria-live", "polite");
  document.body.appendChild(host);
  return host;
}

/** Show a toast. kind: "info" (default) | "success" | "error". */
export function showToast(message, { kind = "info", duration = 2600 } = {}) {
  const h = ensureHost();
  // Keep at most 3 on screen — drop the oldest.
  while (h.children.length >= 3) h.firstElementChild.remove();

  const t = document.createElement("div");
  t.className = `toast toast--${kind}`;
  t.textContent = message;
  h.appendChild(t);
  requestAnimationFrame(() => t.classList.add("is-in"));

  const close = () => {
    t.classList.remove("is-in");
    setTimeout(() => t.remove(), 250);
  };
  t.addEventListener("click", close);
  setTimeout(close, duration);
  return t;
}

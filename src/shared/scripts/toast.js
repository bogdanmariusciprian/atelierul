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

/** Show a toast. kind: "info" (default) | "success" | "error".
 *  Optional `action: { label, onClick }` adds a button (e.g. „Pune la loc"
 *  for Undo); when present, the toast lingers longer so it can be pressed. */
export function showToast(message, { kind = "info", duration = 2600, action = null } = {}) {
  const h = ensureHost();
  // Keep at most 3 on screen – drop the oldest.
  while (h.children.length >= 3) h.firstElementChild.remove();

  const t = document.createElement("div");
  t.className = `toast toast--${kind}${action ? " toast--action" : ""}`;

  const close = () => {
    t.classList.remove("is-in");
    setTimeout(() => t.remove(), 250);
  };

  if (action && action.label) {
    // An action toast is two parts: the message, and a button that must NOT be
    // swallowed by the pill's click-to-dismiss (hence stopPropagation).
    const msg = document.createElement("span");
    msg.className = "toast__msg";
    msg.textContent = message;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast__action";
    btn.textContent = action.label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      close();
      try { action.onClick?.(); } catch { /* the caller owns its errors */ }
    });
    t.append(msg, btn);
  } else {
    t.textContent = message;
  }

  h.appendChild(t);
  requestAnimationFrame(() => t.classList.add("is-in"));
  t.addEventListener("click", close);
  // A pressable action needs breathing room; a plain toast keeps its short life.
  setTimeout(close, action ? Math.max(duration, 7000) : duration);
  return t;
}

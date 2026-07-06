// =========================================================
// Reusable confirmation dialog — a centered card over a blurred backdrop
// (same look as the header logout). Replaces the browser's native confirm(),
// which can't be styled. Returns a Promise<boolean>.
//
//   if (await confirmDialog("Ștergi asta?", { danger: true })) { ... }
// =========================================================
export function confirmDialog(message, opts = {}) {
  const {
    title = "Ești sigur?",
    okLabel = "Confirmă",
    cancelLabel = "Anulează",
    danger = false,
  } = opts;

  return new Promise((resolve) => {
    if (document.querySelector(".confirm-modal")) return resolve(false);

    const overlay = document.createElement("div");
    overlay.className = "confirm-modal";
    overlay.innerHTML = `
      <div class="confirm-modal__backdrop"></div>
      <div class="confirm-modal__card" role="dialog" aria-modal="true" aria-label="${title}">
        <p class="confirm-modal__title">${title}</p>
        <p class="confirm-modal__text">${message}</p>
        <div class="confirm-modal__actions">
          <button type="button" class="btn btn--ghost" data-act="cancel">${cancelLabel}</button>
          <button type="button" class="btn btn--primary${danger ? " confirm-modal__ok--danger" : ""}" data-act="ok">${okLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add("has-modal");

    const close = (val) => {
      overlay.remove();
      document.body.classList.remove("has-modal");
      document.removeEventListener("keydown", onKey);
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKey);

    overlay.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("confirm-modal__backdrop") ||
        e.target.closest("[data-act='cancel']")
      ) {
        close(false);
      } else if (e.target.closest("[data-act='ok']")) {
        close(true);
      }
    });

    overlay.querySelector("[data-act='ok']")?.focus();
  });
}

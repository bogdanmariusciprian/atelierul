// =========================================================
// Interactive benefits: a small discovery game on the landing page.
// A few benefits show face-down ("?"); click to flip and reveal them.
// Others appear over time with a "Nou ✨" badge. A counter tracks how
// many you've uncovered, with a little celebration at the end.
// =========================================================

const BENEFITS = [
  { icon: "📄", title: "Pagina ta", text: "Un profil ca al tău: postează, împărtășește progresul, adună prieteni.", revealed: true },
  { icon: "🏅", title: "Puncte și clasament", text: "Fiecare lecție și exercițiu îți aduce puncte. Urcă în topul celor mai activi.", revealed: true },
  { icon: "💬", title: "Discuții la lecții", text: "Comentează, întreabă și primește răspunsuri de la colegi și profesori." },
  { icon: "⭐", title: "Lecții preferate", text: "Salvează lecțiile importante și revino la ele cu un click." },
  { icon: "📓", title: "Caietul tău", text: "Notițele tale, într-un singur loc, mereu la îndemână." },
  { icon: "🔥", title: "Motivație zilnică", text: "Streak-uri, prieteni și obiective care te țin pe drum.", later: 1 },
  { icon: "🎁", title: "Insigne și surprize", text: "Recompense pentru realizări și mici surprize pentru cei constanți.", later: 2 },
];

export function initBenefits(mountId = "benefits") {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const total = BENEFITS.length;
  let discovered = 0;

  mount.innerHTML = `
    <p class="bx-progress">Descoperite: <b id="bx-count">0</b>/${total}
      <span id="bx-msg" class="bx-msg"></span></p>
    <div class="bx-grid" id="bx-grid"></div>`;

  const grid = mount.querySelector("#bx-grid");
  const countEl = mount.querySelector("#bx-count");
  const msgEl = mount.querySelector("#bx-msg");

  function refresh() {
    countEl.textContent = discovered;
    msgEl.textContent = discovered >= total ? "🎉 Le-ai descoperit pe toate!" : "";
  }

  function addCard(b, isNew) {
    const el = document.createElement(b.revealed ? "div" : "button");
    el.className = "bx-card" + (b.revealed ? " is-open" : "") + (isNew ? " bx-card--new" : "");
    if (!b.revealed) el.type = "button";
    el.innerHTML = `
      <div class="bx-card__inner">
        <div class="bx-card__front">
          ${isNew ? '<span class="bx-badge">Nou ✨</span>' : ""}
          <span class="bx-q" aria-hidden="true">?</span>
          <span class="bx-hint">Apasă să descoperi</span>
        </div>
        <div class="bx-card__back">
          <span class="bx-icon" aria-hidden="true">${b.icon}</span>
          <h3>${b.title}</h3>
          <p>${b.text}</p>
        </div>
      </div>`;

    if (b.revealed) {
      discovered += 1;
    } else {
      el.addEventListener("click", () => {
        if (el.classList.contains("is-open")) return;
        el.classList.add("is-open");
        discovered += 1;
        refresh();
      });
    }
    grid.appendChild(el);
  }

  BENEFITS.filter((b) => !b.later).forEach((b) => addCard(b, false));
  refresh();

  // The rest appear over time, as fresh mystery cards to uncover.
  BENEFITS.filter((b) => b.later).forEach((b) => {
    setTimeout(() => addCard(b, true), b.later * 7000);
  });
}

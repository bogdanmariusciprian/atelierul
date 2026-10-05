// =========================================================
// GRILA CU LĂMURIRI: întrebări care nu notează, ci explică.
//
//   <div class="gx">
//     <p class="gx__q">întrebarea</p>
//     <ol class="gx__var">
//       <li><button type="button" class="gx__opt" data-ok>varianta bună</button>
//           <div class="gx__lam" hidden>de ce e bună, plus ceva în plus</div></li>
//       <li><button type="button" class="gx__opt">altă variantă</button>
//           <div class="gx__lam" hidden>de ce nu e bună</div></li>
//     </ol>
//   </div>
//
// Fiecare variantă are lămurirea ei. O variantă greșită nu dezvăluie
// răspunsul: elevul citește de ce nu merge și încearcă alta. După ce a
// găsit-o pe cea bună, le poate deschide și pe celelalte, ca să vadă de ce
// nu se potrivesc. Nu se ține scor, doar câte întrebări au fost lămurite.
//
// Separat de `lesson-engine.js` (grilele celorlalte lecții), care arată
// răspunsul corect la prima greșeală și n-are loc de lămuriri.
// =========================================================

export function initGrila(root = document) {
  const intrebari = [...root.querySelectorAll(".gx")];
  if (!intrebari.length) return;
  const contoare = [...root.querySelectorAll("[data-gx-gasite]")];

  const numara = () => {
    const gasite = intrebari.filter((q) => q.classList.contains("is-gasita")).length;
    contoare.forEach((c) => { c.textContent = `${gasite} / ${intrebari.length}`; });
  };

  for (const q of intrebari) {
    for (const opt of q.querySelectorAll(".gx__opt")) {
      const lam = opt.nextElementSibling;
      opt.setAttribute("aria-expanded", "false");
      opt.addEventListener("click", () => {
        const bun = opt.hasAttribute("data-ok");
        opt.classList.add(bun ? "is-buna" : "is-gresita");
        opt.setAttribute("aria-expanded", "true");
        if (lam) lam.hidden = false;
        if (bun && !q.classList.contains("is-gasita")) {
          q.classList.add("is-gasita");
          numara();
        }
      });
    }
  }
  numara();
}

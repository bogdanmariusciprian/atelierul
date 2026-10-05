// =========================================================
// GRILA CU LĂMURIRI: întrebări care nu notează, ci explică.
//
//   <div class="gx-carusel" data-gx-carusel>
//     <div class="gx" data-grup="Din lecție">
//       <p class="gx__q">întrebarea</p>
//       <ol class="gx__var">
//         <li><button type="button" class="gx__opt" data-ok>varianta bună</button>
//             <div class="gx__lam" hidden>de ce e bună, plus ceva în plus</div></li>
//         <li><button type="button" class="gx__opt">altă variantă</button>
//             <div class="gx__lam" hidden>de ce nu e bună</div></li>
//       </ol>
//     </div>
//     …
//   </div>
//
// Fiecare variantă are lămurirea ei. O variantă greșită nu dezvăluie
// răspunsul: elevul citește de ce nu merge și încearcă alta. După ce a
// găsit-o pe cea bună, le poate deschide și pe celelalte. Nu se ține scor.
//
// CARUSEL: o singură întrebare pe ecran, cu „Înapoi" / „Următoarea", un
// punct pentru fiecare întrebare (verde când e lămurită), săgețile de la
// tastatură și glisarea pe telefon. Fără JS, întrebările stau una sub alta.
//
// Separat de `lesson-engine.js` (grilele celorlalte lecții), care arată
// răspunsul corect la prima greșeală și n-are loc de lămuriri.
// =========================================================

function legaIntrebarea(q, laGasire) {
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
        laGasire();
      }
    });
  }
}

function faCarusel(carusel) {
  const intrebari = [...carusel.querySelectorAll(".gx")];
  const n = intrebari.length;
  let i = 0;

  carusel.classList.add("is-carusel");
  carusel.setAttribute("role", "region");
  carusel.setAttribute("aria-roledescription", "carusel");
  carusel.setAttribute("aria-label", "Întrebări");
  carusel.tabIndex = -1;

  const sus = document.createElement("div");
  sus.className = "gx-car__sus";
  sus.innerHTML = `
    <span class="gx-car__grup"></span>
    <span class="gx-car__poz" aria-live="polite"></span>
    <span class="gx-car__lamurite">lămurite: <b data-gx-gasite></b></span>`;
  const jos = document.createElement("div");
  jos.className = "gx-car__jos";
  jos.innerHTML = `
    <button type="button" class="gx-car__btn" data-pas="-1">← Înapoi</button>
    <div class="gx-car__puncte" role="tablist" aria-label="Alege întrebarea">
      ${intrebari.map((_, k) => `<button type="button" class="gx-car__punct" role="tab" aria-label="Întrebarea ${k + 1}"></button>`).join("")}
    </div>
    <button type="button" class="gx-car__btn gx-car__btn--plin" data-pas="1">Următoarea →</button>`;
  carusel.prepend(sus);
  carusel.append(jos);

  const grup = sus.querySelector(".gx-car__grup");
  const poz = sus.querySelector(".gx-car__poz");
  const puncte = [...jos.querySelectorAll(".gx-car__punct")];
  const [inapoi, inainte] = jos.querySelectorAll("[data-pas]");

  function arata(k, directie = 0) {
    i = Math.max(0, Math.min(n - 1, k));
    intrebari.forEach((q, j) => {
      q.hidden = j !== i;
      q.classList.remove("intra-dreapta", "intra-stanga");
    });
    if (directie) intrebari[i].classList.add(directie > 0 ? "intra-dreapta" : "intra-stanga");
    grup.textContent = intrebari[i].dataset.grup || "";
    poz.textContent = `Întrebarea ${i + 1} din ${n}`;
    puncte.forEach((p, j) => {
      p.classList.toggle("is-aici", j === i);
      p.setAttribute("aria-selected", String(j === i));
    });
    inapoi.disabled = i === 0;
    inainte.disabled = i === n - 1;
  }

  /* Dacă ai apăsat de jos, iar întrebarea nouă e mai scurtă, ecranul ar
     rămâne sub ea: îl aduc înapoi la începutul caruselului. */
  function mergi(pas) {
    arata(i + pas, pas);
    const r = carusel.getBoundingClientRect();
    if (r.top < 0) carusel.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  inapoi.addEventListener("click", () => mergi(-1));
  inainte.addEventListener("click", () => mergi(1));
  puncte.forEach((p, k) => p.addEventListener("click", () => arata(k, Math.sign(k - i))));

  carusel.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); mergi(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); mergi(-1); }
  });

  /* Glisare pe telefon: doar când mișcarea e clar orizontală, ca derularea
     paginii în sus și în jos să rămână liberă. */
  let x0 = null, y0 = 0;
  carusel.addEventListener("touchstart", (e) => {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  carusel.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) mergi(dx < 0 ? 1 : -1);
  }, { passive: true });

  const marcheaza = () => intrebari.forEach((q, j) =>
    puncte[j].classList.toggle("is-gasita", q.classList.contains("is-gasita")));

  arata(0);
  return marcheaza;
}

export function initGrila(root = document) {
  const intrebari = [...root.querySelectorAll(".gx")];
  if (!intrebari.length) return;
  const marcatori = [...root.querySelectorAll("[data-gx-carusel]")].map(faCarusel);
  const contoare = [...root.querySelectorAll("[data-gx-gasite]")];   // după carusel: el îl aduce pe al lui

  const numara = () => {
    const gasite = intrebari.filter((q) => q.classList.contains("is-gasita")).length;
    contoare.forEach((c) => { c.textContent = `${gasite} / ${intrebari.length}`; });
    marcatori.forEach((m) => m());
  };

  intrebari.forEach((q) => legaIntrebarea(q, numara));
  numara();
}

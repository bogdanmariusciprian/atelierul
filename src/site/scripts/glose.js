// =========================================================
// BULELE DE LĂMURIRE dintr-o lecție: un cuvânt subliniat cu puncte care, la
// hover ori la atingere, arată o notă scurtă (o traducere, un citat, o
// explicație).
//
//   <span class="glosa" tabindex="0" role="button">cuvântul<span class="glosa__text" hidden>nota</span></span>
//
// O SINGURĂ BULĂ pe pagină, mutată lângă cuvântul activ. Nu stă în cuvânt
// (cum stăteau bulele făcute doar din CSS) fiindcă acolo ieșea din ecran la
// marginea dreaptă, pe telefon, iar o notă lungă se tăia. Aici se așază sub
// cuvânt, rămâne înăuntrul ecranului și sare deasupra când jos nu încape.
//
// Pe telefon nu există hover: atingerea o deschide, altă atingere oriunde o
// închide. Cu tastatura: Tab pe cuvânt, Enter, Esc.
// =========================================================

export function initGlose(root = document) {
  const termeni = [...root.querySelectorAll(".glosa")];
  if (!termeni.length) return;

  const bula = document.createElement("div");
  bula.className = "glosa-bula";
  bula.id = "glosa-bula";
  bula.setAttribute("role", "tooltip");
  bula.tabIndex = -1;   // un click în bulă o focusează, deci nu e luat drept „ai plecat"
  bula.hidden = true;
  document.body.append(bula);

  let activ = null;     // cuvântul a cărui notă se vede
  let fixat = false;    // deschisă prin click: nu se închide când pleacă mouse-ul
  let pleaca;           // întârzierea închiderii, ca să poți trece cu mouse-ul pe bulă

  function aseaza() {
    if (!activ) return;
    const MARGINE = 12;
    /* Cuvântul poate fi rupt pe două rânduri: bula se ia după ultimul. */
    const randuri = activ.getClientRects();
    const r = randuri[randuri.length - 1] || activ.getBoundingClientRect();
    const lat = Math.min(416, innerWidth - 2 * MARGINE);
    bula.style.width = `${lat}px`;
    const inalt = bula.offsetHeight;
    const stanga = Math.max(MARGINE, Math.min(r.left, innerWidth - lat - MARGINE));
    const jos = r.bottom + 8 + inalt <= innerHeight - MARGINE || r.top - 8 - inalt < MARGINE;
    bula.dataset.parte = jos ? "jos" : "sus";
    bula.style.left = `${stanga + scrollX}px`;
    bula.style.top = `${(jos ? r.bottom + 8 : r.top - 8 - inalt) + scrollY}px`;
  }

  function arata(t, prinClick = false) {
    clearTimeout(pleaca);
    if (activ && activ !== t) ascunde();
    activ = t;
    fixat = fixat || prinClick;
    bula.innerHTML = t.querySelector(".glosa__text")?.innerHTML || "";
    bula.hidden = false;
    t.classList.add("is-open");
    t.setAttribute("aria-expanded", "true");
    t.setAttribute("aria-describedby", bula.id);
    aseaza();
  }

  function ascunde() {
    clearTimeout(pleaca);
    if (!activ) return;
    activ.classList.remove("is-open");
    activ.setAttribute("aria-expanded", "false");
    activ.removeAttribute("aria-describedby");
    activ = null;
    fixat = false;
    bula.hidden = true;
  }

  const ascundeIncet = () => { if (!fixat) pleaca = setTimeout(ascunde, 160); };

  for (const t of termeni) {
    t.setAttribute("aria-expanded", "false");
    t.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && !fixat) arata(t); });
    t.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") ascundeIncet(); });
    t.addEventListener("click", (e) => {
      e.stopPropagation();
      if (activ === t && fixat) ascunde(); else arata(t, true);
    });
    t.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (activ === t) ascunde(); else arata(t, true);
      }
    });
    t.addEventListener("blur", (e) => { if (activ === t && e.relatedTarget !== bula) ascunde(); });
  }

  bula.addEventListener("pointerenter", () => clearTimeout(pleaca));
  bula.addEventListener("pointerleave", ascundeIncet);
  bula.addEventListener("click", (e) => e.stopPropagation());
  bula.addEventListener("blur", (e) => { if (e.relatedTarget !== activ) ascunde(); });
  document.addEventListener("click", ascunde);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") ascunde(); });
  addEventListener("resize", ascunde);
}

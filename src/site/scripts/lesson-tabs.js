// =========================================================
// File în lecție (Introducere / Aprofundare / …).
//
// O lecție poate avea două drumuri spre același lucru: unul scurt, pentru
// prima întâlnire, și unul cu metoda de lucru, pentru cine vrea mai mult.
// Filele le țin pe amândouă în aceeași pagină, fără s-o lungească.
//
// Modulul e GENERIC: nu știe nimic despre textul argumentativ. Găsește orice
// grup de file dintr-o lecție și îl leagă. A doua lecție cu file nu mai cere
// niciun rând de cod aici.
//
// Marcajul de care are nevoie:
//   <div class="lesson-tabs" role="tablist">
//     <button class="lesson-tab is-on" role="tab" aria-controls="fila-x" data-tab="x">…</button>
//   <div class="lesson-tabpanel" id="fila-x" role="tabpanel">…</div>
// =========================================================

/** Deschide fila cu numele dat, în grupul dat. */
function arata(grup, nume) {
  const file = [...grup.querySelectorAll(".lesson-tab")];
  const gasit = file.some((f) => f.dataset.tab === nume);
  if (!gasit) return false;

  file.forEach((f) => {
    const activ = f.dataset.tab === nume;
    f.classList.toggle("is-on", activ);
    f.setAttribute("aria-selected", activ ? "true" : "false");
    // Numai fila deschisă e oprire de tastatură. Așa Tab sare peste celelalte,
    // iar între ele te muți cu săgețile, cum se poartă filele peste tot.
    f.tabIndex = activ ? 0 : -1;
    const panou = document.getElementById(f.getAttribute("aria-controls"));
    if (panou) panou.hidden = !activ;
  });
  return true;
}

export function initLessonTabs() {
  const grupuri = document.querySelectorAll(".lesson-tabs");
  if (!grupuri.length) return;

  grupuri.forEach((grup) => {
    const file = [...grup.querySelectorAll(".lesson-tab")];
    if (!file.length) return;

    // Starea de pornire: fila din adresă, dacă există, altfel prima.
    // Adresa contează: profesorul poate trimite un link direct la
    // „…/textul-argumentativ/#aprofundare" și elevul cade exact acolo.
    const dinAdresa = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!arata(grup, dinAdresa)) arata(grup, file[0].dataset.tab);

    grup.addEventListener("click", (e) => {
      const f = e.target.closest(".lesson-tab");
      if (!f) return;
      arata(grup, f.dataset.tab);
      // Schimbăm adresa fără să sărim în pagină: `replaceState` nu adaugă un
      // pas în istoric, deci butonul „înapoi" al browserului duce tot la
      // pagina dinainte, nu la fila dinainte.
      history.replaceState(null, "", "#" + f.dataset.tab);
    });

    grup.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const i = file.findIndex((f) => f.classList.contains("is-on"));
      const j = (i + (e.key === "ArrowRight" ? 1 : -1) + file.length) % file.length;
      e.preventDefault();
      arata(grup, file[j].dataset.tab);
      file[j].focus();
      history.replaceState(null, "", "#" + file[j].dataset.tab);
    });
  });

  // Cineva lipește un link cu altă filă în bara de adrese: îl ascultăm.
  window.addEventListener("hashchange", () => {
    const nume = decodeURIComponent(location.hash.replace(/^#/, ""));
    grupuri.forEach((grup) => arata(grup, nume));
  });
}

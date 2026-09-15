// =========================================================
// PAGINA-ȘABLON A LECȚIILOR SCRISE DE ELEVI (0089 + 0090).
//
// O SINGURĂ PAGINĂ pentru toate lecțiile publicate, nu câte un fișier de
// fiecare. Marius a ales așa („pe sit, pe loc, dintr-o pagină-șablon"), și e
// alegerea bună: o lecție publicată de profesor din panou n-are cum să nască un
// fișier în depozit, fiindcă situl stă pe GitHub Pages, iar fișierele se nasc
// numai la un commit. Textul vine din bază, la deschiderea paginii.
//
// FĂRĂ HASH e lista lecțiilor publicate; cu `#adresa-ei` e lecția.
//
// TEXTUL E CURĂȚAT A DOUA OARĂ, AICI. A fost curățat și la scriere, dar
// curățarea de atunci s-a petrecut în browserul elevului, adică exact acolo
// unde nu avem încredere. Cine ar ocoli pagina și ar scrie de-a dreptul în
// tabel, tot prin `sanitizeLesson` trece înainte să ajungă pe ecranul altcuiva.
// Cuprins în română, nume în engleză.
// =========================================================
import { LESSON_DOMAINS } from "../../shared/scripts/domains.js";
import { sanitizeLesson } from "../../shared/scripts/lesson-rich.js";
import { publishedLessons, publishedLessonBySlug } from "../../shared/scripts/lesson-proposals-repo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const domeniul = (slug) => LESSON_DOMAINS.find((d) => d.slug === slug) || null;

const zi = (d) => {
  try { return new Date(d).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return ""; }
};

/** Adresa cerută: ce stă după `#`, curățat de tot ce n-are ce căuta într-o
 *  adresă (litere mici, cifre și cratime, cum le face `slug_din_titlu`). */
const adresaCeruta = () =>
  decodeURIComponent(location.hash.slice(1)).trim().toLowerCase().replace(/[^a-z0-9-]/g, "");

function listaHtml(lectii, basePath) {
  if (!lectii.length) {
    return `
      <div class="pl-gol">
        <h1>Lecții scrise de elevi</h1>
        <p>Încă nu e publicată niciuna. Când profesorul publică prima, apare aici.</p>
        <p><a class="btn btn--ghost" href="${basePath}lectii/">Toate lecțiile</a></p>
      </div>`;
  }
  return `
    <div class="pl-lista">
      <h1>Lecții scrise de elevi</h1>
      <p class="pl-lista__lead">Lecții propuse de elevi și publicate de profesor.</p>
      <ul class="pl-lista__ul">${lectii.map((l) => {
        const d = domeniul(l.domain);
        return `<li class="pl-lista__li"${d ? ` style="--c:${d.color}"` : ""}>
          <a href="#${esc(l.slug)}">
            ${d ? `<span class="pl-chip">${esc(d.label)}</span>` : ""}
            <b>${esc(l.title)}</b>
            <em>${zi(l.published_at)}</em>
          </a>
        </li>`;
      }).join("")}</ul>
      <p><a class="btn btn--ghost" href="${basePath}lectii/">Toate lecțiile</a></p>
    </div>`;
}

function lectieHtml(l, basePath) {
  const d = domeniul(l.domain);
  const file = Array.isArray(l.pages) ? l.pages : [];
  /* O singură filă n-are nevoie de file: un rând de file cu un singur buton e
     o unealtă care nu face nimic. */
  const cuFile = file.length > 1;

  const capulFilelor = !cuFile ? "" : `
    <div class="pl-file" role="tablist" aria-label="Filele lecției">
      ${file.map((f, i) => `
        <button type="button" class="pl-fila${i === 0 ? " on" : ""}" role="tab"
          aria-selected="${i === 0}" aria-controls="pl-f${i}" id="pl-t${i}" data-i="${i}">
          ${esc(f.name || `Fila ${i + 1}`)}
        </button>`).join("")}
    </div>`;

  const cuprins = file.map((f, i) => `
    <div class="pl-cuprins lt" id="pl-f${i}" role="${cuFile ? "tabpanel" : "document"}"
      ${cuFile ? `aria-labelledby="pl-t${i}"` : ""} ${i === 0 ? "" : "hidden"}>
      ${sanitizeLesson(f.body)}
    </div>`).join("");

  return `
    <article class="pl"${d ? ` style="--lesson-color:${d.color}"` : ""}>
      <nav class="page-crumbs" aria-label="Unde te afli">
        <a href="${basePath}">Acasă</a> <span aria-hidden="true">›</span>
        <a href="${basePath}lectii/">Lecții</a>
        ${d ? `<span aria-hidden="true">›</span><a href="${basePath}lectii/#${d.slug}">${esc(d.label)}</a>` : ""}
      </nav>
      ${d ? `<span class="pl-tag">${esc(d.label)}</span>` : ""}
      <h1 class="pl-titlu">${esc(l.title)}</h1>
      <p class="pl-sub">Lecție scrisă de un elev · publicată ${zi(l.published_at)}</p>
      ${capulFilelor}
      ${cuprins}
      <nav class="pl-jos">
        <a class="btn btn--ghost" href="#">Toate lecțiile scrise de elevi</a>
        <a class="btn btn--primary" href="${basePath}lectii/">Toate lecțiile</a>
      </nav>
    </article>`;
}

function negasitHtml() {
  return `
    <div class="pl-gol">
      <h1>Lecția asta nu se găsește</h1>
      <p>Ori a fost scoasă de pe sit, ori adresa e greșită.</p>
      <p><a class="btn btn--ghost" href="#">Lecțiile scrise de elevi</a></p>
    </div>`;
}

/** Filele, pe pagina publicată. Ascunderea se face cu `hidden`, nu prin
 *  ștergere: un text scos din pagină nu mai poate fi găsit cu Ctrl+F și nici
 *  citit de un cititor de ecran care merge înainte și înapoi prin ea. */
function legaFilele(vas) {
  const file = [...vas.querySelectorAll(".pl-fila")];
  if (!file.length) return;
  vas.addEventListener("click", (e) => {
    const b = e.target.closest(".pl-fila");
    if (!b) return;
    const i = Number(b.dataset.i);
    file.forEach((f, k) => {
      f.classList.toggle("on", k === i);
      f.setAttribute("aria-selected", String(k === i));
    });
    vas.querySelectorAll(".pl-cuprins").forEach((c, k) => { c.hidden = k !== i; });
  });
}

export async function renderProposedLesson(basePath = "") {
  const vas = document.getElementById("lectie-propusa");
  if (!vas) return;

  const deseneaza = async () => {
    const adresa = adresaCeruta();
    vas.innerHTML = `<p class="pl-astept">Aduc lecția…</p>`;

    if (!adresa) {
      vas.innerHTML = listaHtml(await publishedLessons(), basePath);
      document.title = "Lecții scrise de elevi — Atelierul-LRO";
      return;
    }
    const l = await publishedLessonBySlug(adresa);
    if (!l) { vas.innerHTML = negasitHtml(); return; }
    vas.innerHTML = lectieHtml(l, basePath);
    document.title = `${l.title} — Atelierul-LRO`;
    legaFilele(vas);
  };

  await deseneaza();
  /* Adresa se schimbă și fără reîncărcare (din listă în lecție și înapoi). */
  window.addEventListener("hashchange", deseneaza);
}

// =========================================================
// Lessons hub: an "explorer" — domains as tabs on the left, the
// selected domain's lessons on the right (each a progress-ring node).
// Only one domain is shown at a time, so the whole page doesn't scroll.
// Data comes from the shared modules (DRY): domains + lessons.
// =========================================================
import { LESSON_DOMAINS } from "../../shared/scripts/domains.js";
import { LESSONS } from "../../shared/scripts/lessons-index.js";
import { isLessonDone, mergeServerProgress } from "./lesson-progress.js";
import { fetchMyLessonProgress } from "../../shared/scripts/forum-repo.js";
import { isAdmin, isLoggedIn } from "../../shared/scripts/session.js";
import { publishedLessons } from "../../shared/scripts/lesson-proposals-repo.js";
import { bacSlugs, puneBac } from "../../shared/scripts/lesson-badges-repo.js";
import {
  fileSiEtichete, adaugaFila, redenumesteFila, stergeFila, puneEticheta,
} from "../../shared/scripts/lesson-tabs-repo.js";
import { lectiiPdf, urcaPdf, inlocuiestePdf, stergePdf } from "../../shared/scripts/lesson-pdf-repo.js";

let _progressSynced = false; // pull server completion state once per page

/* LECȚIILE SCRISE DE ELEVI (0089) stau în bază, nu în catalogul din cod: se
   publică din panou, fără commit, deci codul n-are de unde le ști. Se aduc o
   dată pe pagină și se așază la coada domeniului lor, după lecțiile tale.
   Până vin, hubul arată ce știe; când vin, se redesenează. */
let _propuseAduse = false;
let _propuse = [];

/* SEMNUL „BAC" (0103) stă tot în bază: îl pune Marius din pagină, cu
   comutatorul de lângă fiecare lecție, fără commit. Se aduce o dată pe pagină,
   ca lecțiile elevilor. Comutatorul apare doar în domeniile de aici; semnul
   pus se vede la oricine. */
const DOMENII_BAC = ["literatura-liceu"];
let _bacAdus = false;
let _bac = new Set();

/* FILELE DIN PANOU (0104): „Toate", apoi filele domeniului („Curente
   literare", „Opere", câte mai pune Marius). O lecție stă în oricâte file,
   după eticheta pusă de el din pagină. Eticheta NU se vede lângă titlu, ca
   „BAC": e doar locul în care se găsește lecția. Toate stau în bază și se aduc
   o dată pe pagină. */
const DOMENII_CU_FILE = ["literatura-liceu"];
let _fileAduse = false;
let _file = [];                    // [{ id, domeniu, nume, ordine }], în ordine
let _etichete = new Map();         // fila_id → Set de slug-uri
const _filaActiva = new Map();     // domeniu → id-ul filei ori "toate"
let _editez = null;                // { domeniu, id } cât adminul scrie un nume (id null = filă nouă)
let _eroareFila = "";

/* LECȚIILE PDF (0105): urcate de Marius din panou, doar la Literatură (liceu).
   Stau în bază și se aduc o dată pe pagină, ca lecțiile elevilor; se deschid
   pe pagina-șablon `lectii/pdf/#adresa`. */
const DOMENII_PDF = ["literatura-liceu"];
let _pdfAduse = false;
let _pdf = [];                     // rândurile din `lectii_pdf`
let _formPdf = null;               // domeniul în care e deschis formularul de urcare

const fileleDomeniului = (domeniu) => _file.filter((f) => f.domeniu === domeniu);
const inFila = (filaId, lesson) => !!lesson.slug && !!_etichete.get(filaId)?.has(lesson.slug);

/** Fila deschisă într-un domeniu; „toate" dacă fila aleasă nu mai există. */
function filaActiva(domeniu) {
  const id = _filaActiva.get(domeniu) || "toate";
  return id === "toate" || _file.some((f) => f.id === id) ? id : "toate";
}

const scapa = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const semnulBac = () =>
  `<span class="track-node__bac" role="img"
         aria-label="Lecție pentru bacalaureat">BAC</span>`;

/** Catalogul din cod, lecțiile PDF și lecțiile publicate de elevi, în aceeași formă. */
/* Fișele PDF stau în ordine alfabetică, nu în ordinea urcării. Cu `numeric`,
   „L. 9" vine înaintea lui „L. 10", ca la numere, nu ca la litere. */
const alfabetic = (a, b) => a.titlu.localeCompare(b.titlu, "ro", { numeric: true, sensitivity: "base" });

function toateLectiile() {
  const pdf = [..._pdf].sort(alfabetic).map((p) => ({
    domain: p.domeniu,
    slug: p.slug,
    title: p.titlu,
    href: `lectii/pdf/#${p.slug}`,
    summary: p.rezumat || "",
    ready: true,
    pdf: p,
  }));
  return [...LESSONS, ...pdf, ..._propuse.map((l) => ({
    domain: l.domain,
    slug: `propusa-${l.slug}`,
    title: l.title,
    href: `lectii/propuse/#${l.slug}`,
    summary: "Lecție scrisă de un elev.",
    ready: true,
    deElev: true,
  }))];
}

/** Ring progress for a lesson: 100% once its page was marked finished.
 *  Keyed by the STABLE lesson slug (not the URL). */
function lessonProgress(lesson) {
  if (!lesson.slug) return 0;
  return isLessonDone(lesson.slug) ? 100 : 0;
}

/**
 * One node in a domain's lesson track: circular index + progress ring,
 * with the lesson label beside it. `progress` is 0–100 (percent
 * complete); 0 until connected to the logged-in user's data. The ring
 * uses pathLength="100" so the dasharray value is the percentage.
 */
function nodeMarkup(lesson, index, basePath, progress = 0) {
  const bac = !!lesson.slug && _bac.has(lesson.slug);
  /* Comutatorul stă în afara legăturii lecției: un buton nu are voie să stea
     într-un link. Doar adminul îl vede, doar la domeniile cu semn. */
  const comutator = lesson.slug && isAdmin() && DOMENII_BAC.includes(lesson.domain)
    ? `<button class="track-node__bac-comutator${bac ? " is-on" : ""}" type="button"
               data-bac="${lesson.slug}" aria-pressed="${bac}"
               title="${bac ? "Scoate semnul BAC" : "Pune semnul BAC"}">BAC</button>`
    : "";
  /* Etichetele, tot doar pentru admin: câte un comutator pe filă. */
  const etichete = lesson.slug && isAdmin() && DOMENII_CU_FILE.includes(lesson.domain)
    ? fileleDomeniului(lesson.domain).map((f) => {
        const pus = inFila(f.id, lesson);
        return `<button class="track-node__eticheta${pus ? " is-on" : ""}" type="button"
                        data-fila="${f.id}" data-slug="${lesson.slug}" aria-pressed="${pus}"
                        title="${pus ? "Scoate din fila" : "Pune în fila"} „${scapa(f.nume)}”">${scapa(f.nume)}</button>`;
      }).join("")
    : "";
  /* La lecțiile PDF, adminul le mai poate înlocui fișierul ori le poate șterge. */
  const pdfUnelte = lesson.pdf && isAdmin()
    ? `<button class="track-node__pdf-unealta" type="button" data-inlocuieste="${lesson.slug}"
               title="Pune alt PDF în locul acestuia">înlocuiește</button>
       <button class="track-node__pdf-unealta track-node__pdf-unealta--sterge" type="button"
               data-sterge-pdf="${lesson.slug}" title="Șterge lecția">șterge</button>`
    : "";
  const unelte = comutator || etichete || pdfUnelte
    ? `<span class="track-node__admin">${etichete}${comutator}${pdfUnelte}</span>`
    : "";
  const ready = lesson.ready && lesson.href;
  const ring = `
    <svg class="node__ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="node__track" cx="50" cy="50" r="42" pathLength="100" />
      <circle class="node__progress" cx="50" cy="50" r="42" pathLength="100"
              style="stroke-dasharray: ${progress} 100" />
    </svg>
    <span class="node__index">${index}</span>`;
  const summary = lesson.summary
    ? `<span class="track-node__summary">${lesson.summary}</span>`
    : "";

  // Semnul de tablă: doar iconul, fără cuvinte, ca traseul să rămână o listă
  // de titluri. Ce înseamnă se află la hover și la focus.
  //
  // Stă ÎN titlu, nu lângă el, dinadins: e o însușire a lecției ăleia, nu un
  // buton de sine stătător. De-aia n-are nici `tabindex` – un element pe care
  // se poate ajunge cu tastatura n-are voie să stea într-un link. Cine merge
  // cu tastatura ajunge pe legătura lecției, iar lămurirea se arată atunci.
  const tabla = lesson.board
    ? `<span class="track-node__board" role="img"
             aria-label="Lecția asta are tablă interactivă"
             data-tip="Lecția asta are tablă interactivă"></span>`
    : "";

  /* Lecțiile scrise de elevi se văd de la o poștă că sunt ale lor. Nu ca să fie
     puse mai jos, ci fiindcă cine citește are dreptul să știe cine a scris. */
  const deElev = lesson.deElev
    ? `<span class="track-node__pupil" role="img"
             aria-label="Lecție scrisă de un elev"
             data-tip="Lecție scrisă de un elev">elev</span>`
    : "";

  // Planned title (no page yet): non-clickable, marked "în curând".
  if (!ready) {
    return `
      <li class="track-node track-node--soon">
        <span class="node">${ring}</span>
        <span class="track-node__label">
          <span class="track-node__title">${lesson.title}${tabla}${bac ? semnulBac() : ""}
            <span class="track-node__soon">în curând</span>
          </span>
          ${summary}
        </span>
      </li>`;
  }

  const href = `${basePath}${lesson.href}`;
  return `
    <li class="track-node">
      <a class="node" href="${href}" aria-label="${lesson.title}">${ring}</a>
      <a class="track-node__label" href="${href}">
        <span class="track-node__title">${lesson.title}${tabla}${deElev}${bac ? semnulBac() : ""}</span>
        ${summary}
      </a>
      ${unelte}
    </li>`;
}

/** Fold diacritics + case so "virgula" also finds „Virgulă”. */
function fold(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Global lesson search — type anything, get matching lessons across ALL
 * domains instantly (title + summary), with the domain shown as a chip.
 * Ready lessons link straight to their page; planned ones say "în curând".
 */
function initLessonsSearch(mount, basePath) {
  const input = mount.querySelector("#lessons-search");
  const results = mount.querySelector("#lessons-search-results");
  if (!input || !results) return;

  const domainOf = (slug) => LESSON_DOMAINS.find((d) => d.slug === slug);

  const show = (q) => {
    const fq = fold(q.trim());
    if (fq.length < 2) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }
    const hits = toateLectiile().filter((l) => fold(`${l.title} ${l.summary || ""}`).includes(fq)).slice(0, 8);
    results.innerHTML = hits.length
      ? hits
          .map((l) => {
            const d = domainOf(l.domain);
            const chip = d ? `<span class="lessons-search__chip" style="--c:${d.color}">${d.label}</span>` : "";
            return l.ready && l.href
              ? `<a class="lessons-search__hit" href="${basePath}${l.href}">${chip}<span>${l.title}</span></a>`
              : `<span class="lessons-search__hit lessons-search__hit--soon">${chip}<span>${l.title}</span><em>în curând</em></span>`;
          })
          .join("")
      : `<p class="lessons-search__none">Nicio lecție nu se potrivește. Încearcă alt cuvânt.</p>`;
    results.hidden = false;
  };

  input.addEventListener("input", () => show(input.value));
  input.addEventListener("focus", () => show(input.value));
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".lessons-search")) results.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") results.hidden = true;
  });

  // Keyboard navigation: ↓/↑ walk the results, Enter opens the active one.
  input.addEventListener("keydown", (e) => {
    if (results.hidden) return;
    const hits = [...results.querySelectorAll("a.lessons-search__hit")];
    if (!hits.length) return;
    const cur = hits.findIndex((h) => h.classList.contains("is-active"));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? (cur + 1) % hits.length : (cur - 1 + hits.length) % hits.length;
      hits.forEach((h, i) => h.classList.toggle("is-active", i === next));
      hits[next].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && cur >= 0) {
      e.preventDefault();
      hits[cur].click();
    }
  });
}

/** Lista unui domeniu, după fila deschisă. Numerele încep de la 1 în fiecare filă. */
function trackMarkup(domeniu, lessons, basePath) {
  const activa = filaActiva(domeniu);
  const arata = activa === "toate" ? lessons : lessons.filter((l) => inFila(activa, l));
  if (arata.length) {
    return `<ol class="lesson-track">${arata
      .map((l, i) => nodeMarkup(l, i + 1, basePath, lessonProgress(l)))
      .join("")}</ol>`;
  }
  return `<p class="lesson-track__empty">${lessons.length ? "Nicio lecție în fila asta încă." : "În curând."}</p>`;
}

/** Rândul cu file de deasupra listei. Gol dacă domeniul n-are file (și nu ești admin). */
function fileMarkup(domeniu, lessons) {
  if (!DOMENII_CU_FILE.includes(domeniu)) return "";
  const file = fileleDomeniului(domeniu);
  const admin = isAdmin();
  if (!file.length && !admin) return "";
  const activa = filaActiva(domeniu);
  const numar = (id) => (id === "toate" ? lessons.length : lessons.filter((l) => inFila(id, l)).length);
  const camp = (valoare) => `
    <span class="domain-subtab domain-subtab--edit">
      <input class="domain-subtab__input" type="text" maxlength="40" value="${scapa(valoare)}"
             placeholder="Numele filei" aria-label="Numele filei" />
      ${_eroareFila ? `<span class="domain-subtab__eroare">${scapa(_eroareFila)}</span>` : ""}
    </span>`;

  const butoane = [{ id: "toate", nume: "Toate" }, ...file].map((f) => {
    if (_editez && _editez.domeniu === domeniu && _editez.id === f.id) return camp(f.nume);
    const e = f.id === activa;
    const adminFila = admin && e && f.id !== "toate"
      ? `<span class="domain-subtab__unelte">
           <button type="button" class="domain-subtab__unealta" data-redenumeste="${f.id}" title="Redenumește fila">✎</button>
           <button type="button" class="domain-subtab__unealta" data-sterge="${f.id}" title="Șterge fila">×</button>
         </span>`
      : "";
    return `<span class="domain-subtab-wrap">
        <button type="button" class="domain-subtab${e ? " is-active" : ""}" role="tab"
                aria-selected="${e}" data-fila="${f.id}">${scapa(f.nume)}<span class="domain-subtab__count">${numar(f.id)}</span></button>${adminFila}
      </span>`;
  }).join("");

  const nou = admin
    ? (_editez && _editez.domeniu === domeniu && _editez.id === null
        ? camp("")
        : `<button type="button" class="domain-subtab domain-subtab--add" data-adauga title="Filă nouă">+</button>`)
    : "";
  return `<div class="domain-subtabs__row" role="tablist" aria-label="File">${butoane}${nou}</div>`;
}

/** Sub listă, doar pentru admin: butonul „+ Adaugă un PDF", ori formularul. */
function pdfAdminMarkup(domeniu) {
  if (!isAdmin() || !DOMENII_PDF.includes(domeniu)) return "";
  if (_formPdf !== domeniu) {
    return `<button type="button" class="pdf-adauga" data-pdf-deschide>+ Adaugă un PDF</button>`;
  }
  return `
    <form class="pdf-form" novalidate>
      <label class="pdf-form__camp">
        <span>Fișierul (PDF, cel mult 20 MB)</span>
        <input type="file" name="fisier" accept="application/pdf,.pdf" />
      </label>
      <label class="pdf-form__camp">
        <span>Titlul</span>
        <input type="text" name="titlu" maxlength="120" placeholder="Luceafărul: comentariu pe tablouri" />
      </label>
      <label class="pdf-form__camp">
        <span>O frază despre lecție <em>(nu e obligatorie)</em></span>
        <input type="text" name="rezumat" maxlength="200" />
      </label>
      <div class="pdf-form__jos">
        <button type="submit" class="pdf-form__urca">Urcă</button>
        <button type="button" class="pdf-form__renunta" data-pdf-renunta>Renunță</button>
        <span class="pdf-form__stare" aria-live="polite"></span>
      </div>
    </form>`;
}

/** Redesenează filele și lista unui singur panou, fără să atingă restul paginii. */
function redeseneazaPanoul(panel, basePath) {
  const domeniu = panel.id;
  const lessons = toateLectiile().filter((l) => l.domain === domeniu);
  const vp = panel.querySelector(".domain-panel__viewport");
  const sus = vp ? vp.scrollTop : 0;
  panel.querySelector(".domain-subtabs").innerHTML = fileMarkup(domeniu, lessons);
  panel.querySelector(".domain-panel__track").innerHTML = trackMarkup(domeniu, lessons, basePath);
  panel.querySelector(".domain-panel__pdf").innerHTML = pdfAdminMarkup(domeniu);
  /* Numărul de lecții, în antet și în fila din stânga: s-a schimbat dacă
     a venit ori a plecat un PDF. */
  const meta = panel.querySelector(".domain-panel__meta");
  if (meta) meta.textContent = `${lessons.length} ${lessons.length === 1 ? "lecție" : "lecții"}`;
  const tab = document.querySelector(`.domain-tab[data-target="${domeniu}"] .domain-tab__count`);
  if (tab) tab.textContent = lessons.length;
  if (vp) vp.scrollTop = sus;
  leaga(panel, basePath);
  panel.querySelector(".domain-subtab__input")?.focus();
}

/** Leagă butoanele dintr-o bucată de pagină (toată lista ori un singur panou). */
function leaga(radacina, basePath) {
  leagaPdf(radacina, basePath);

  /* Comutatorul „BAC": schimbă semnul pe loc, în rândul lui, fără să
     redeseneze lista (ar închide panoul extins și ar pierde derularea). */
  radacina.querySelectorAll(".track-node__bac-comutator").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const slug = btn.dataset.bac;
      btn.disabled = true;
      const { ok, bac } = await puneBac(slug, !_bac.has(slug));
      btn.disabled = false;
      if (bac) _bac.add(slug); else _bac.delete(slug);
      btn.classList.toggle("is-on", bac);
      btn.setAttribute("aria-pressed", String(bac));
      btn.title = bac ? "Scoate semnul BAC" : "Pune semnul BAC";
      const titlu = btn.closest(".track-node").querySelector(".track-node__title");
      titlu.querySelector(".track-node__bac")?.remove();
      if (bac) titlu.insertAdjacentHTML("beforeend", semnulBac());
      if (!ok) clatina(btn);
    });
  });

  /* Eticheta: lecția intră ori iese din filă. Panoul se redesenează, fiindcă
     se schimbă numerele de pe file și, în fila deschisă, chiar lista. */
  radacina.querySelectorAll(".track-node__eticheta").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { fila, slug } = btn.dataset;
      btn.disabled = true;
      const { ok, pus } = await puneEticheta(fila, slug, !inFila(fila, { slug }));
      if (!_etichete.has(fila)) _etichete.set(fila, new Set());
      if (pus) _etichete.get(fila).add(slug); else _etichete.get(fila).delete(slug);
      const panel = btn.closest(".domain-panel");
      redeseneazaPanoul(panel, basePath);
      if (!ok) {
        const nou = panel.querySelector(`.track-node__eticheta[data-fila="${fila}"][data-slug="${slug}"]`);
        if (nou) clatina(nou);
      }
    });
  });

  radacina.querySelectorAll(".domain-subtab[data-fila]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.closest(".domain-panel");
      _filaActiva.set(panel.id, btn.dataset.fila);
      _editez = null;
      redeseneazaPanoul(panel, basePath);
    });
  });

  radacina.querySelectorAll("[data-adauga]").forEach((btn) => {
    btn.addEventListener("click", () => {
      _editez = { domeniu: btn.closest(".domain-panel").id, id: null };
      _eroareFila = "";
      redeseneazaPanoul(btn.closest(".domain-panel"), basePath);
    });
  });

  radacina.querySelectorAll("[data-redenumeste]").forEach((btn) => {
    btn.addEventListener("click", () => {
      _editez = { domeniu: btn.closest(".domain-panel").id, id: btn.dataset.redenumeste };
      _eroareFila = "";
      redeseneazaPanoul(btn.closest(".domain-panel"), basePath);
    });
  });

  radacina.querySelectorAll("[data-sterge]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const f = _file.find((x) => x.id === btn.dataset.sterge);
      if (!f) return;
      if (!confirm(`Ștergi fila „${f.nume}”? Lecțiile rămân; pleacă doar din fila asta.`)) return;
      btn.disabled = true;
      if (await stergeFila(f.id)) {
        _file = _file.filter((x) => x.id !== f.id);
        _etichete.delete(f.id);
        _filaActiva.set(f.domeniu, "toate");
      }
      redeseneazaPanoul(btn.closest(".domain-panel"), basePath);
    });
  });

  /* Câmpul de nume: Enter salvează, Esc ori clicul în altă parte renunță. */
  radacina.querySelectorAll(".domain-subtab__input").forEach((input) => {
    const panel = input.closest(".domain-panel");
    const renunta = () => {
      if (!_editez) return;
      _editez = null;
      _eroareFila = "";
      redeseneazaPanoul(panel, basePath);
    };
    let salvez = false;
    input.addEventListener("keydown", async (e) => {
      if (e.key === "Escape") { e.preventDefault(); renunta(); return; }
      if (e.key !== "Enter" || salvez) return;
      e.preventDefault();
      salvez = true;
      const { domeniu, id } = _editez;
      const r = id === null
        ? await adaugaFila(domeniu, input.value,
            Math.max(0, ...fileleDomeniului(domeniu).map((f) => f.ordine)) + 1)
        : await redenumesteFila(id, input.value);
      salvez = false;
      if (r.eroare) {
        _eroareFila = r.eroare;
        redeseneazaPanoul(panel, basePath);
        const nou = panel.querySelector(".domain-subtab__input");
        if (nou) nou.value = input.value;
        return;
      }
      if (id === null) {
        _file.push(r.fila);
        _filaActiva.set(domeniu, r.fila.id);
      } else {
        _file = _file.map((f) => (f.id === id ? r.fila : f));
      }
      _editez = null;
      _eroareFila = "";
      redeseneazaPanoul(panel, basePath);
    });
    input.addEventListener("blur", () => { if (!salvez) setTimeout(renunta, 120); });
  });
}

/** Uneltele PDF ale adminului: urcare, înlocuire, ștergere. */
function leagaPdf(radacina, basePath) {
  radacina.querySelectorAll("[data-pdf-deschide]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.closest(".domain-panel");
      _formPdf = panel.id;
      redeseneazaPanoul(panel, basePath);
      panel.querySelector(".pdf-form input[type=file]")?.focus();
    });
  });

  radacina.querySelectorAll("[data-pdf-renunta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      _formPdf = null;
      redeseneazaPanoul(btn.closest(".domain-panel"), basePath);
    });
  });

  radacina.querySelectorAll(".pdf-form").forEach((form) => {
    const panel = form.closest(".domain-panel");
    const fisier = form.elements.fisier;
    const titlu = form.elements.titlu;
    const stare = form.querySelector(".pdf-form__stare");
    /* Titlul se propune din numele fișierului, cât timp nu l-ai scris tu. */
    let titluScris = false;
    titlu.addEventListener("input", () => { titluScris = true; });
    fisier.addEventListener("change", () => {
      const f = fisier.files[0];
      if (f && !titluScris) titlu.value = f.name.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").trim();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const butoane = form.querySelectorAll("button, input");
      butoane.forEach((b) => { b.disabled = true; });
      stare.textContent = "Se urcă…";
      const r = await urcaPdf({
        file: fisier.files[0], titlu: titlu.value, rezumat: form.elements.rezumat.value, domeniu: panel.id,
      });
      if (r.eroare) {
        butoane.forEach((b) => { b.disabled = false; });
        stare.textContent = r.eroare;
        return;
      }
      _pdf.push(r.lectie);
      /* Dacă era deschisă o filă, lecția nouă intră și în ea: acolo te uitai. */
      const fila = filaActiva(panel.id);
      if (fila !== "toate") {
        const { pus } = await puneEticheta(fila, r.lectie.slug, true);
        if (pus) {
          if (!_etichete.has(fila)) _etichete.set(fila, new Set());
          _etichete.get(fila).add(r.lectie.slug);
        }
      }
      _formPdf = null;
      redeseneazaPanoul(panel, basePath);
    });
  });

  radacina.querySelectorAll("[data-inlocuieste]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lectie = _pdf.find((p) => p.slug === btn.dataset.inlocuieste);
      if (!lectie) return;
      const alege = document.createElement("input");
      alege.type = "file";
      alege.accept = "application/pdf,.pdf";
      alege.addEventListener("change", async () => {
        const f = alege.files[0];
        if (!f) return;
        btn.disabled = true;
        btn.textContent = "se urcă…";
        const r = await inlocuiestePdf(lectie, f);
        if (r.eroare) {
          btn.disabled = false;
          btn.textContent = "înlocuiește";
          btn.title = r.eroare;
          clatina(btn);
          return;
        }
        _pdf = _pdf.map((p) => (p.id === r.lectie.id ? r.lectie : p));
        redeseneazaPanoul(btn.closest(".domain-panel"), basePath);
      });
      alege.click();
    });
  });

  radacina.querySelectorAll("[data-sterge-pdf]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const lectie = _pdf.find((p) => p.slug === btn.dataset.stergePdf);
      if (!lectie) return;
      if (!confirm(`Ștergi lecția „${lectie.titlu}”? Se șterge și fișierul PDF.`)) return;
      btn.disabled = true;
      if (!(await stergePdf(lectie))) { btn.disabled = false; clatina(btn); return; }
      _pdf = _pdf.filter((p) => p.id !== lectie.id);
      _bac.delete(lectie.slug);
      _etichete.forEach((s) => s.delete(lectie.slug));
      redeseneazaPanoul(btn.closest(".domain-panel"), basePath);
    });
  });
}

/** Un mic tremur: baza n-a primit schimbarea, iar butonul arată ce a rămas. */
function clatina(el) {
  el.animate([{ transform: "translateX(-3px)" }, { transform: "translateX(3px)" },
    { transform: "none" }], { duration: 220 });
}

export function renderLessonsHub(basePath = "") {
  const mount = document.getElementById("lessons-hub");
  if (!mount) return;

  const countLabel = (n) => `${n} ${n === 1 ? "lecție" : "lecții"}`;

  // A domain's SVG, tinted with its accent color via a CSS mask. Same
  // icons as the Home cards. Set inline so the URL resolves to the page.
  const maskStyle = (domain) => {
    if (!domain.watermark) return "";
    const u = `${basePath}${domain.watermark}`;
    return `background: var(--card-color);` +
      `-webkit-mask: url('${u}') no-repeat center / contain;` +
      `mask: url('${u}') no-repeat center / contain;`;
  };
  const iconMarkup = (domain, cls) =>
    domain.watermark
      ? `<span class="${cls}" aria-hidden="true" style="${maskStyle(domain)}"></span>`
      : `<span class="${cls}" aria-hidden="true">${domain.icon}</span>`;

  const catalog = toateLectiile();

  const tabs = LESSON_DOMAINS.map((domain) => {
    const count = catalog.filter((l) => l.domain === domain.slug).length;
    return `
      <button class="domain-tab" type="button" data-target="${domain.slug}"
              style="--card-color: ${domain.color}">
        ${iconMarkup(domain, "domain-tab__icon")}
        <span class="domain-tab__label">${domain.label}</span>
        <span class="domain-tab__count">${count}</span>
      </button>`;
  }).join("");

  const panels = LESSON_DOMAINS.map((domain) => {
    const lessons = catalog.filter((l) => l.domain === domain.slug);
    const track = `<div class="domain-panel__track">${trackMarkup(domain.slug, lessons, basePath)}</div>`;

    // Dots are generated dynamically by fancy-scroll.js (as many as
    // needed for a smooth scroll), so this container starts empty.
    const dots = lessons.length
      ? `<nav class="scroll-dots" aria-hidden="true"></nav>`
      : "";

    return `
      <section class="domain-panel" id="${domain.slug}"
               style="--card-color: ${domain.color}">
        <div class="domain-panel__viewport">
          <header class="domain-panel__head">
            ${iconMarkup(domain, "domain-panel__watermark")}
            <span class="domain-panel__icon" aria-hidden="true">${
              domain.watermark
                ? `<span class="domain-panel__iconimg" style="${maskStyle(domain)}"></span>`
                : domain.icon
            }</span>
            <div>
              <h2 class="domain-panel__title">${domain.label}</h2>
              <p class="domain-panel__meta">${countLabel(lessons.length)}</p>
            </div>
          </header>
          <div class="domain-subtabs">${fileMarkup(domain.slug, lessons)}</div>
          ${track}
          <div class="domain-panel__pdf">${pdfAdminMarkup(domain.slug)}</div>
        </div>
        <div class="panel-blur panel-blur--top" aria-hidden="true"></div>
        <div class="panel-blur panel-blur--bottom" aria-hidden="true"></div>
        <div class="panel-inset" aria-hidden="true"></div>
        ${dots}
        ${
          lessons.length
            ? `<button class="domain-panel__expand" type="button" aria-expanded="false">
                 <span class="domain-panel__expand-label">Extinde toate lecțiile</span>
                 <svg class="domain-panel__expand-icon" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                      stroke-linejoin="round" aria-hidden="true">
                   <path d="m6 9 6 6 6-6" />
                 </svg>
               </button>`
            : ""
        }
      </section>`;
  }).join("");

  // Guests learn WHY the progress rings exist — a reason to join.
  const progressHint = !isLoggedIn()
    ? `<p class="lessons-hint">🔓 Inelele arată progresul tău pe lecții.
         <a href="${basePath}comunitate/login/">Creează-ți cont</a> ca să ți-l salvezi.</p>`
    : "";

  mount.innerHTML = `
    <div class="lessons-search">
      <input class="lessons-search__input" id="lessons-search" type="search"
        placeholder="🔍 Caută o lecție (ex: virgula, verbul, metafora)…" autocomplete="off" />
      <div class="lessons-search__results" id="lessons-search-results" hidden></div>
    </div>
    ${progressHint}
    <div class="lessons-explorer">
      <nav class="domain-tabs" aria-label="Domenii">${tabs}</nav>
      <div class="domain-panels">${panels}</div>
    </div>`;

  initLessonsSearch(mount, basePath);
  leaga(mount, basePath);

  const tabButtons = mount.querySelectorAll(".domain-tab");
  const panelSections = mount.querySelectorAll(".domain-panel");

  function activate(slug) {
    tabButtons.forEach((t) =>
      t.classList.toggle("is-active", t.dataset.target === slug)
    );
    panelSections.forEach((p) => p.classList.toggle("is-active", p.id === slug));
  }

  tabButtons.forEach((tab) =>
    tab.addEventListener("click", () => {
      activate(tab.dataset.target);
      history.replaceState(null, "", `#${tab.dataset.target}`);
    })
  );

  // Cap each panel to the height of the tabs column so its bottom lines up
  // with the last tab. Re-measured on resize (tab wrapping, font changes…).
  const explorer = mount.querySelector(".lessons-explorer");
  const tabsNav = mount.querySelector(".domain-tabs");
  const syncPanelHeight = () => {
    if (!explorer || !tabsNav) return;
    explorer.style.setProperty("--panel-h", `${tabsNav.offsetHeight}px`);
  };
  syncPanelHeight();
  window.addEventListener("resize", syncPanelHeight);

  // Expand/collapse: the bottom bar toggles between the capped, scrollable
  // panel and a full-length one. fancy-scroll.js reacts to the size change
  // (via ResizeObserver) and drops the dots/blur on its own.
  mount.querySelectorAll(".domain-panel__expand").forEach((btn) => {
    const panel = btn.closest(".domain-panel");
    const label = btn.querySelector(".domain-panel__expand-label");
    btn.addEventListener("click", () => {
      const expanded = panel.classList.toggle("is-expanded");
      btn.setAttribute("aria-expanded", String(expanded));
      label.textContent = expanded ? "Restrânge" : "Extinde toate lecțiile";
    });
  });

  // Open the domain from the URL hash (e.g. coming from a Home card),
  // otherwise the first domain.
  const fromHash = location.hash.slice(1);
  const initial = LESSON_DOMAINS.some((d) => d.slug === fromHash)
    ? fromHash
    : LESSON_DOMAINS[0].slug;
  activate(initial);

  /* Lecțiile PDF, aduse O DATĂ pe pagină, pentru oricine. */
  if (!_pdfAduse) {
    _pdfAduse = true;
    lectiiPdf().then((l) => {
      if (!l.length) return;
      _pdf = l;
      renderLessonsHub(basePath);
    });
  }

  /* Filele și etichetele, aduse O DATĂ pe pagină, pentru oricine. */
  if (!_fileAduse) {
    _fileAduse = true;
    fileSiEtichete().then(({ file, etichete }) => {
      if (!file.length) return;
      _file = file;
      _etichete = etichete;
      renderLessonsHub(basePath);
    });
  }

  /* Semnele „BAC", aduse O DATĂ pe pagină, pentru oricine. */
  if (!_bacAdus) {
    _bacAdus = true;
    bacSlugs().then((s) => {
      if (!s.size) return;
      _bac = s;
      renderLessonsHub(basePath);
    });
  }

  /* Lecțiile publicate de elevi, aduse O DATĂ pe pagină. Se cer și pentru un
     vizitator nelogat: sunt conținut de sit, ca oricare altă lecție. */
  if (!_propuseAduse) {
    _propuseAduse = true;
    publishedLessons().then((l) => {
      if (!l.length) return;
      _propuse = l;
      renderLessonsHub(basePath);
    });
  }

  // Cross-device: pull real completion state ONCE, then re-render so the rings
  // reflect lessons finished on other devices too.
  if (isLoggedIn() && !_progressSynced) {
    _progressSynced = true;
    fetchMyLessonProgress().then((set) => {
      if (mergeServerProgress([...set])) renderLessonsHub(basePath);
    });
  }
}

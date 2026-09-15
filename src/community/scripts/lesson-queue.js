// =========================================================
// COADA DE LECȚII A PROFESORULUI (0089 + 0090).
//
// Elevul trimite, profesorul citește. Aici se poate: citi lecția pe file, i se
// poate îndrepta titlul și textul, și apoi publicată ori trimisă înapoi cu o
// vorbă de îndreptat.
//
// ÎNDREPTAREA ȘI PUBLICAREA SUNT UN SINGUR PAS, dinadins: `publish_lesson` ia și
// titlul, și filele. Altfel ar fi fost două drumuri („salvez" apoi „public"),
// iar drumul în doi pași se rupe mereu la mijloc: rămâne o lecție îndreptată
// dar nepublicată, și nimeni nu mai știe dacă a fost citită.
//
// Ca și ecranul elevului, componenta asta se descurcă singură: hubul îi lasă un
// loc gol, iar ea își ține datele, ascultătorii și desenul. Vezi de ce, pe larg,
// în `lesson-writer.js`.
//
// PAZA NU E AICI. `admin_pending_lessons`, `publish_lesson`, `reject_lesson` cer
// toate rolul de profesor, în bază. Ecranul ăsta n-ar putea fi folosit de un
// elev nici dacă ar ajunge la el.
// Cuprins în română, nume în engleză.
// =========================================================
import { LESSON_DOMAINS } from "../../shared/scripts/domains.js";
import { showToast } from "../../shared/scripts/toast.js";
import { confirmDialog } from "../../shared/scripts/confirm.js";
import { lessonEditor } from "../../shared/components/lesson-editor.js";
import { stripLesson } from "../../shared/scripts/lesson-rich.js";
import {
  pendingLessons, publishLesson, rejectLesson, publishedLessons, unpublishLesson,
} from "../../shared/scripts/lesson-proposals-repo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const stare = {
  incarcat: false,
  lista: [],
  peSit: [],        // lecțiile deja publicate, ca să se poată și scoate
  peSitAduse: false,
  fila: "asteptare", // "asteptare" | "pe-sit"
  deschisa: null,   // { id, title, domain, authorName, pages } cât timp e citită una
  lucrez: false,
};

let editor = null;
let radacina = null;
let anuntaSchimbarea = null;   // ca numărul din bara de administrare să se potrivească

const domeniuLabel = (slug) =>
  LESSON_DOMAINS.find((d) => d.slug === slug)?.label || slug || "–";

const zi = (d) => {
  try { return new Date(d).toLocaleDateString("ro-RO", { day: "numeric", month: "long" }); }
  catch { return ""; }
};

function privire(pages) {
  const t = stripLesson((Array.isArray(pages) ? pages : [])[0]?.body || "");
  return t.length > 180 ? `${t.slice(0, 180)}…` : t;
}

function listaHtml() {
  if (!stare.incarcat) return `<p class="lq-gol">Aduc lecțiile trimise…</p>`;
  if (!stare.lista.length) {
    return `<p class="lq-gol">Nicio lecție de citit. Când un elev cu dreptul „Lecții"
      trimite una, apare aici.</p>`;
  }
  return `<ul class="lq-lista">${stare.lista.map((l) => {
    const nr = l.pages.length;
    return `
      <li class="lq-rand">
        <div class="lq-rand__cap">
          <b class="lq-rand__titlu">${esc(l.title)}</b>
          <span class="lq-rand__cine">${esc(l.authorName)}</span>
        </div>
        <p class="lq-rand__meta">${esc(domeniuLabel(l.domain))} ·
          ${nr} ${nr === 1 ? "filă" : "file"} · trimisă ${zi(l.createdAt)}</p>
        <p class="lq-rand__privire">${esc(privire(l.pages))}</p>
        <div class="lq-rand__act">
          <button type="button" class="lq-btn lq-btn--bun" data-act="citeste" data-id="${l.id}">Citește și hotărăște</button>
        </div>
      </li>`;
  }).join("")}</ul>`;
}

/* LECȚIILE DEJA PE SIT, ca profesorul să le poată și scoate. Scoaterea nu
   șterge nimic: lecția se întoarce în așteptare, de unde poate fi publicată din
   nou. De-aia butonul spune „Scoate de pe sit", nu „Șterge". */
function peSitHtml() {
  if (!stare.peSitAduse) return `<p class="lq-gol">Aduc lecțiile publicate…</p>`;
  if (!stare.peSit.length) {
    return `<p class="lq-gol">Nicio lecție scrisă de elevi nu e pe sit acum.</p>`;
  }
  return `<ul class="lq-lista">${stare.peSit.map((l) => `
    <li class="lq-rand">
      <div class="lq-rand__cap">
        <b class="lq-rand__titlu">${esc(l.title)}</b>
      </div>
      <p class="lq-rand__meta">${esc(domeniuLabel(l.domain))} ·
        publicată ${zi(l.published_at)} · <code>/lectii/propuse/#${esc(l.slug || "")}</code></p>
      <div class="lq-rand__act">
        <button type="button" class="lq-btn lq-btn--rau" data-act="scoate" data-id="${l.id}">Scoate de pe sit</button>
      </div>
    </li>`).join("")}</ul>`;
}

function fileHtml() {
  /* Numele acțiunii e `coada-fila`, nu `fila`: editorul de lecție folosește
     `fila` pentru filele LUI, iar apăsările din el urcă până aici. Două acțiuni
     cu același nume ar fi însemnat că o apăsare pe fila lecției schimbă fila
     cozii și mătură editorul de pe ecran. */
  const f = (id, text, n) => `
    <button type="button" class="lq-tab${stare.fila === id ? " on" : ""}"
      data-act="coada-fila" data-fila="${id}">${text}${n ? ` <b>${n}</b>` : ""}</button>`;
  return `<div class="lq-tabs">
    ${f("asteptare", "În așteptare", stare.lista.length)}
    ${f("pe-sit", "Pe sit", stare.peSit.length)}
  </div>`;
}

function deschisaHtml() {
  const d = stare.deschisa;
  return `
    <div class="lq-una">
      <button type="button" class="lq-inapoi" data-act="inchide">‹ Toate lecțiile trimise</button>
      <p class="lq-una__cine">Trimisă de <b>${esc(d.authorName)}</b> ·
        ${esc(domeniuLabel(d.domain))}</p>

      <label class="lq-camp">
        <span class="lq-camp__lab">Titlul cu care se publică</span>
        <input type="text" class="lq-input" data-rol="titlu" maxlength="120" value="${esc(d.title)}">
      </label>

      <div class="lq-editor" data-rol="editor"></div>

      <div class="lq-jos">
        <button type="button" class="lq-btn lq-btn--bun" data-act="publica"${
          stare.lucrez ? " disabled" : ""}>Publică pe sit</button>
        <span class="lq-sfat">Ce îndrepți aici se publică: elevul nu mai trece încă o dată prin ea.</span>
      </div>

      <!-- TRIMISUL ÎNAPOI STĂ CU VORBA LUI LA UN LOC, nu după un buton.
           Un elev care primește lecția înapoi fără să i se spună ce să schimbe
           o trimite a doua oară la fel; câmpul de față face vorba obligatorie,
           iar așezarea lui lângă buton o face și de neocolit. -->
      <div class="lq-inapoiere">
        <label class="lq-camp">
          <span class="lq-camp__lab">Ce are de îndreptat</span>
          <textarea class="lq-input lq-textarea" data-rol="nota" rows="2" maxlength="500"
            placeholder="Ex.: exemplele de la fila a doua nu se potrivesc cu regula."
            >${esc(d.nota || "")}</textarea>
        </label>
        <button type="button" class="lq-btn lq-btn--rau" data-act="respinge"${
          stare.lucrez ? " disabled" : ""}>Trimite înapoi elevului</button>
      </div>
    </div>`;
}

function deseneaza() {
  if (!radacina) return;
  /* Fără titlu propriu: panoul de administrare pune deja unul deasupra („Lecții
     propuse"), iar două titluri unul sub altul n-ar spune nimic în plus. */
  radacina.innerHTML = `
    <div class="lq">
      ${stare.deschisa ? deschisaHtml()
        : `${fileHtml()}${stare.fila === "pe-sit" ? peSitHtml() : listaHtml()}`}
    </div>`;

  if (stare.deschisa) {
    editor = lessonEditor(radacina.querySelector("[data-rol='editor']"), {
      pages: stare.deschisa.pages,
      onChange: (file) => { if (stare.deschisa) stare.deschisa.pages = file; },
    });
  } else {
    editor = null;
  }
}

/* Filele se iau BRUTE (cu tot cu cele încă goale): asta e ce are profesorul pe
   masă. Curățarea și cernutul se fac abia la publicare, în `publica()`. */
function aduna() {
  if (!stare.deschisa || !radacina) return;
  const t = radacina.querySelector("[data-rol='titlu']");
  if (t) stare.deschisa.title = t.value;
  const n = radacina.querySelector("[data-rol='nota']");
  if (n) stare.deschisa.nota = n.value;
  if (editor) stare.deschisa.pages = editor.brute();
}

async function incarca() {
  stare.lista = await pendingLessons();
  stare.incarcat = true;
  if (typeof anuntaSchimbarea === "function") anuntaSchimbarea(stare.lista);
}

/** Lecțiile de pe sit se cer abia când profesorul se uită la ele: coada e
 *  pentru ce are de făcut acum, nu pentru ce a făcut deja. */
async function incarcaPeSit() {
  stare.peSit = await publishedLessons();
  stare.peSitAduse = true;
  deseneaza();
}

async function scoate(id) {
  const l = stare.peSit.find((x) => String(x.id) === String(id));
  const da = await confirmDialog(
    `„${esc(l?.title || "Lecția")}” nu se mai vede pe sit. Nu se pierde: se întoarce în așteptare.`,
    { title: "Scoți lecția de pe sit?", okLabel: "Scot", danger: true });
  if (!da) return;
  const r = await unpublishLesson(id);
  if (!r.ok) { showToast(r.message, { kind: "error" }); return; }
  showToast("Lecția s-a întors în așteptare.", { kind: "success" });
  await incarca();
  await incarcaPeSit();
}

async function publica() {
  aduna();
  const d = stare.deschisa;
  if (!d) return;
  const titlu = String(d.title || "").trim();
  if (titlu.length < 3) { showToast("Titlul e prea scurt.", { kind: "error" }); return; }
  /* Ce se publică e CURĂȚAT, nu ce e pe masă: textul a fost scris de un elev,
     deci trece prin listele albe încă o dată înainte să ajungă pe sit. */
  const file = editor ? editor.valoare() : [];
  if (!file.length) { showToast("Lecția n-are nicio filă cu text.", { kind: "error" }); return; }

  stare.lucrez = true; deseneaza();
  const r = await publishLesson(d.id, { title: titlu, pages: file });
  stare.lucrez = false;

  if (!r.ok) { showToast(r.message, { kind: "error" }); deseneaza(); return; }
  showToast(`„${r.title}” e pe sit.`, { kind: "success" });
  stare.deschisa = null;
  await incarca();
  deseneaza();
}

async function respinge() {
  const d = stare.deschisa;
  if (!d) return;
  aduna();
  const camp = radacina.querySelector("[data-rol='nota']");
  const nota = String(d.nota || "").trim();
  /* Vorba de îndreptat NU e la mâna profesorului: fără ea, elevul primește
     lecția înapoi și n-are de unde ști ce să schimbe. */
  if (nota.length < 3) {
    showToast("Scrie-i întâi ce are de îndreptat.", { kind: "error" });
    if (camp) camp.focus();
    return;
  }
  const da = await confirmDialog(`Lecția se întoarce la ${esc(d.authorName)}, cu vorba ta.`, {
    title: "Trimiți lecția înapoi?", okLabel: "Trimit înapoi",
  });
  if (!da) return;

  stare.lucrez = true; deseneaza();
  const r = await rejectLesson(d.id, nota);
  stare.lucrez = false;

  if (!r.ok) { showToast(r.message, { kind: "error" }); deseneaza(); return; }
  showToast("Lecția s-a întors la elev.", { kind: "success" });
  stare.deschisa = null;
  await incarca();
  deseneaza();
}

async function inchide() {
  aduna();
  const da = await confirmDialog("Îndreptările pe care le-ai făcut și nu le-ai publicat se pierd.", {
    title: "Închizi lecția?", okLabel: "Închid",
  });
  if (!da) return;
  stare.deschisa = null;
  deseneaza();
}

function apasa(e) {
  const b = e.target.closest("[data-act]");
  if (!b || !radacina.contains(b)) return;
  const act = b.dataset.act;
  if (!["citeste", "inchide", "publica", "respinge", "coada-fila", "scoate"].includes(act)) return;

  if (act === "coada-fila") {
    stare.fila = b.dataset.fila;
    deseneaza();
    if (stare.fila === "pe-sit" && !stare.peSitAduse) incarcaPeSit();
    return;
  }
  if (act === "scoate") { scoate(b.dataset.id); return; }
  if (act === "citeste") {
    const l = stare.lista.find((x) => String(x.id) === b.dataset.id);
    if (!l) return;
    stare.deschisa = {
      id: l.id, title: l.title || "", domain: l.domain,
      authorName: l.authorName || "elev", nota: "",
      pages: l.pages.length ? l.pages : [{ name: "Lecția", body: "" }],
    };
    deseneaza();
    return;
  }
  if (act === "inchide") { inchide(); return; }
  if (act === "publica") { publica(); return; }
  if (act === "respinge") { respinge(); }
}

/**
 * Așază coada în locul lăsat gol de panoul de administrare.
 * @param {HTMLElement} loc
 * @param {{lista?: Array, onSchimbare?: Function}} cfg
 *   `lista` = ce a adus deja panoul la pornire (ca să nu se ceară de două ori);
 *   `onSchimbare` = cum află bara din stânga că s-a schimbat numărul.
 */
export function mountLessonQueue(loc, { lista = null, onSchimbare = null } = {}) {
  if (!loc) return;
  anuntaSchimbarea = onSchimbare;
  if (radacina === loc) return;
  radacina = loc;
  radacina.addEventListener("mousedown", apasa);

  /* Lista panoului e cea bună CÂT TIMP nu citim o lecție anume: panoul o aduce
     odată cu tot restul, la pornire, și o aduce încă o dată dacă a venit ceva
     nou. Cât e una deschisă, n-o atingem: profesorul e cu mâna pe ea.
     (Fără regula asta, componenta ar fi rămas cu lista goală de la prima
     așezare, dinainte ca panoul să apuce să citească baza.) */
  if (Array.isArray(lista) && !stare.deschisa) {
    stare.lista = lista;
    stare.incarcat = true;
  }
  deseneaza();
  if (!stare.incarcat) incarca().then(deseneaza);
}

/** Locul gol pe care-l lasă panoul. */
export const lessonQueueSlot = () => `<div id="cx-lesson-queue"></div>`;

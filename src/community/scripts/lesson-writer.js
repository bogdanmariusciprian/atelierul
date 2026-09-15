// =========================================================
// ECRANUL ELEVULUI CARE SCRIE O LECȚIE (0089 + 0090).
//
// O COMPONENTĂ CARE SE DESCURCĂ SINGURĂ. Hubul comunității se redesenează
// întreg la fiecare apăsare (`mount.innerHTML = ...`), iar un câmp editabil pus
// în calea lui ar fi pierdut cursorul, selecția și, mai rău, ce scria elevul în
// clipa aceea. De-aia ecranul ăsta nu trece prin desenul hubului: hubul lasă un
// loc gol, iar aici se așază o componentă cu datele ei, cu ascultătorii ei și cu
// desenul ei. Hubul capătă trei rânduri, nu trei sute.
//
// STAREA TRĂIEȘTE ÎN MODUL, nu în pagină: dacă hubul se redesenează (a venit o
// înștiințare, s-a apăsat altceva), componenta se așază din nou și găsește
// ciorna acolo unde era. Fără asta, o redesenare din senin ar fi șters lecția.
//
// PAZA NU E AICI. Baza știe cine are dreptul: RLS îl cere la scriere, iar
// `poate_propune_lectie()` îl spune. Butonul stins e doar bună-cuviință.
// Cuprins în română, nume în engleză.
// =========================================================
import { LESSON_DOMAINS } from "../../shared/scripts/domains.js";
import { showToast } from "../../shared/scripts/toast.js";
import { confirmDialog } from "../../shared/scripts/confirm.js";
import { lessonEditor } from "../../shared/components/lesson-editor.js";
import { stripLesson } from "../../shared/scripts/lesson-rich.js";
import {
  myLessonProposals, createLessonProposal, updateLessonProposal, deleteLessonProposal,
} from "../../shared/scripts/lesson-proposals-repo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const STARI = {
  in_asteptare: { text: "În așteptare", fel: "asteapta" },
  publicata: { text: "Publicată", fel: "buna" },
  respinsa: { text: "Trimisă înapoi", fel: "rea" },
};

/* Ciorna și lista, ținute afară din pagină ca să treacă peste redesenări. */
const stare = {
  incarcat: false,
  lista: [],
  ciorna: null,      // { id|null, title, domain, pages } cât timp e deschis editorul
  trimit: false,
};

let editor = null;
let radacina = null;
let caleaSitului = "";   // ce pune hubul înaintea adreselor („../", de obicei)

const domeniuLabel = (slug) =>
  LESSON_DOMAINS.find((d) => d.slug === slug)?.label || slug || "–";

/** O privire scurtă în lecție, pentru listă: primele cuvinte din prima filă. */
function privire(pages) {
  const intai = (Array.isArray(pages) ? pages : [])[0];
  const t = stripLesson(intai?.body || "");
  return t.length > 140 ? `${t.slice(0, 140)}…` : t;
}

function listaHtml() {
  if (!stare.incarcat) {
    return `<p class="lw-gol">Îți aduc lecțiile…</p>`;
  }
  if (!stare.lista.length) {
    return `<p class="lw-gol">N-ai trimis încă nicio lecție. Scrie una: se vede pe sit
      după ce o citește profesorul.</p>`;
  }
  return `<ul class="lw-lista">${stare.lista.map((l) => {
    const s = STARI[l.status] || { text: l.status, fel: "asteapta" };
    const nrFile = Array.isArray(l.pages) ? l.pages.length : 0;
    /* Butoanele se dau după soartă, nu de-a valma: o lecție publicată nu se mai
       schimbă de aici (ar însemna să se schimbe singură pe sit), iar una
       trimisă înapoi se ia de la capăt cu tot cu ce-a scris. */
    const butoane = l.status === "publicata"
      ? `<a class="lw-btn" href="${caleaSitului}lectii/propuse/#${esc(l.slug || "")}">Vezi lecția pe sit</a>`
      : `<button type="button" class="lw-btn" data-act="deschide" data-id="${l.id}">Deschide</button>
         ${l.status === "in_asteptare"
           ? `<button type="button" class="lw-btn lw-btn--rau" data-act="retrage" data-id="${l.id}">Retrage</button>`
           : ""}`;
    return `
      <li class="lw-rand">
        <div class="lw-rand__cap">
          <b class="lw-rand__titlu">${esc(l.title)}</b>
          <span class="lw-stare lw-stare--${s.fel}">${s.text}</span>
        </div>
        <p class="lw-rand__meta">${esc(domeniuLabel(l.domain))} ·
          ${nrFile} ${nrFile === 1 ? "filă" : "file"}</p>
        ${l.note ? `<p class="lw-nota"><b>De la profesor:</b> ${esc(l.note)}</p>` : ""}
        <p class="lw-rand__privire">${esc(privire(l.pages))}</p>
        <div class="lw-rand__act">${butoane}</div>
      </li>`;
  }).join("")}</ul>`;
}

function ciornaHtml() {
  const c = stare.ciorna;
  return `
    <div class="lw-ciorna">
      <div class="lw-camp2">
        <label class="lw-camp">
          <span class="lw-camp__lab">Titlul lecției</span>
          <input type="text" class="lw-input" data-rol="titlu" maxlength="120"
            value="${esc(c.title)}" placeholder="Ex.: Virgula în fraza cu subordonată">
        </label>
        <label class="lw-camp lw-camp--mic">
          <span class="lw-camp__lab">Domeniul</span>
          <select class="lw-input" data-rol="domeniu">
            ${LESSON_DOMAINS.map((d) => `<option value="${d.slug}"${
              d.slug === c.domain ? " selected" : ""}>${esc(d.label)}</option>`).join("")}
          </select>
        </label>
      </div>

      <div class="lw-editor" data-rol="editor"></div>

      <div class="lw-jos">
        <button type="button" class="lw-btn lw-btn--bun" data-act="trimite"${
          stare.trimit ? " disabled" : ""}>${
          c.id ? "Salvează schimbările" : "Trimite lecția profesorului"}</button>
        <button type="button" class="lw-btn" data-act="renunta">Renunț</button>
        <span class="lw-sfat">Profesorul o citește, poate s-o îndrepte și apoi o publică.</span>
      </div>
    </div>`;
}

function deseneaza() {
  if (!radacina) return;
  /* Editorul se face DUPĂ ce intră desenul în pagină, ca să aibă unde sta. */
  radacina.innerHTML = `
    <div class="lw">
      <div class="cx-head">
        <h1 class="cx-head__title">Scriu o lecție</h1>
        <p class="cx-head__sub">Scrii lecția pe file, o trimiți, iar profesorul o publică pe sit.</p>
      </div>
      ${stare.ciorna ? ciornaHtml() : `
        <div class="lw-sus">
          <button type="button" class="lw-btn lw-btn--bun" data-act="noua">Scriu o lecție nouă</button>
        </div>
        ${listaHtml()}`}
    </div>`;

  if (stare.ciorna) {
    const loc = radacina.querySelector("[data-rol='editor']");
    editor = lessonEditor(loc, {
      pages: stare.ciorna.pages,
      /* Fiecare schimbare se ține minte în ciornă, dar NU redesenează nimic: o
         redesenare la fiecare tastă ar muta cursorul de sub degetul elevului. */
      onChange: (file) => { if (stare.ciorna) stare.ciorna.pages = file; },
    });
  } else {
    editor = null;
  }
}

/** Ce e acum în editor și în cele două câmpuri de sus, adunat în ciornă.
 *  Filele se iau BRUTE, cu tot cu cele încă goale: ciorna e ce are elevul pe
 *  masă, nu ce e gata de trimis. Curățatul și cernutul se fac la trimitere. */
function adunaCiorna() {
  if (!stare.ciorna || !radacina) return;
  const t = radacina.querySelector("[data-rol='titlu']");
  const d = radacina.querySelector("[data-rol='domeniu']");
  if (t) stare.ciorna.title = t.value;
  if (d) stare.ciorna.domain = d.value;
  if (editor) stare.ciorna.pages = editor.brute();
}

async function incarca() {
  try {
    stare.lista = await myLessonProposals();
  } catch {
    stare.lista = [];
    showToast("N-am putut citi lecțiile tale.", { kind: "error" });
  }
  stare.incarcat = true;
  if (!stare.ciorna) deseneaza();
}

async function trimite() {
  adunaCiorna();
  const c = stare.ciorna;
  if (!c) return;

  const titlu = String(c.title || "").trim();
  if (titlu.length < 3) {
    showToast("Dă-i lecției un titlu (măcar trei litere).", { kind: "error" });
    return;
  }
  /* CE PLEACĂ E CURĂȚAT, nu ce e pe masă: `valoare()` trece filele prin listele
     albe și le lasă afară pe cele fără text. Ciorna rămâne cum era. */
  const file = editor ? editor.valoare() : [];
  if (!file.length) {
    showToast("Lecția n-are nicio filă cu text.", { kind: "error" });
    return;
  }

  stare.trimit = true;
  deseneaza();
  const r = c.id
    ? await updateLessonProposal(c.id, { title: titlu, domain: c.domain, pages: file })
    : await createLessonProposal({ title: titlu, domain: c.domain, pages: file });
  stare.trimit = false;

  if (!r.ok) {
    showToast(r.message, { kind: "error" });
    deseneaza();
    return;
  }
  showToast(c.id ? "Schimbările s-au salvat." : "Lecția a plecat la profesor.", { kind: "success" });
  stare.ciorna = null;
  await incarca();
  deseneaza();
}

async function retrage(id) {
  const da = await confirmDialog("Lecția asta se șterge de tot, cu tot ce ai scris în ea.", {
    title: "Retragi propunerea?", okLabel: "Retrag", danger: true,
  });
  if (!da) return;
  const r = await deleteLessonProposal(id);
  if (!r.ok) { showToast(r.message, { kind: "error" }); return; }
  showToast("Propunerea a fost retrasă.", { kind: "success" });
  await incarca();
  deseneaza();
}

async function renunta() {
  /* Ciorna nesalvată se pierde, deci se întreabă; dar numai dacă are ce pierde,
     iar „are ce pierde" înseamnă filele CU TEXT, nu filele goale de care elevul
     habar n-are că există. */
  const areText = editor ? editor.valoare().length > 0 : false;
  adunaCiorna();
  if (areText) {
    const da = await confirmDialog("Ce n-ai trimis se pierde.", {
      title: "Ieși din lecție?", okLabel: "Ies", danger: true,
    });
    if (!da) return;
  }
  stare.ciorna = null;
  deseneaza();
}

function apasa(e) {
  const b = e.target.closest("[data-act]");
  if (!b || !radacina.contains(b)) return;
  /* Numai acțiunile ecranului ăstuia; butoanele editorului au ale lor și se
     opresc în el. */
  const act = b.dataset.act;
  if (!["noua", "deschide", "retrage", "trimite", "renunta"].includes(act)) return;

  if (act === "noua") {
    stare.ciorna = { id: null, title: "", domain: LESSON_DOMAINS[0].slug,
                     pages: [{ name: "Lecția", body: "" }] };
    deseneaza();
    return;
  }
  if (act === "deschide") {
    const l = stare.lista.find((x) => String(x.id) === b.dataset.id);
    if (!l) return;
    stare.ciorna = {
      id: l.id, title: l.title || "", domain: l.domain || LESSON_DOMAINS[0].slug,
      pages: Array.isArray(l.pages) && l.pages.length ? l.pages : [{ name: "Lecția", body: "" }],
    };
    deseneaza();
    return;
  }
  if (act === "retrage") { retrage(b.dataset.id); return; }
  if (act === "trimite") { trimite(); return; }
  if (act === "renunta") { renunta(); }
}

/**
 * Așază ecranul în locul lăsat gol de hub. Se cheamă după FIECARE redesenare a
 * hubului; dacă e deja aici, se așază din nou din starea ținută în modul.
 */
export function mountLessonWriter(loc, basePath = "") {
  if (!loc) return;
  caleaSitului = basePath;
  if (radacina === loc) return;           // deja așezat aici
  radacina = loc;
  radacina.addEventListener("mousedown", apasa);
  deseneaza();
  if (!stare.incarcat) incarca();
}

/** Locul gol pe care-l lasă hubul. */
export const lessonWriterSlot = () => `<div id="cx-lesson-writer"></div>`;

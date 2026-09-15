// =========================================================
// EDITORUL DE LECȚIE, cu file.
//
// Cererea lui Marius (12 septembrie 2026): „elevul cu drept de Lecții să poată
// posta o lecție pe mai multe pagini, iar la editarea de text să aibă
// disponibile toate opțiunile de formatare necesare (by default, textul se
// aliniază justified): bold, italic, underline, font size etc. La partea de
// liste automate, să se facă indentările corespunzătoare nivelului de tip
// părinte-copil. pentru bullets, folosești caracterul «•»."
//
// CE ÎNTOARCE: un obiect cu `valoare()` (filele, gata de trimis) și
// `distruge()`. Nu salvează el nimic și nu știe nimic despre bază: cine îl
// cheamă hotărăște când se scrie. Așa poate sta și în pagina elevului, și în
// coada profesorului, unde salvarea înseamnă altceva.
//
// TEXTUL SE CURĂȚĂ ÎN DOUĂ LOCURI, și niciunul nu e „la fiecare tastă": o
// curățare la fiecare tastă ar reface câmpul sub degetul omului și i-ar muta
// cursorul. Se curăță (1) la LIPIT, fiindcă un text adus din Word se vede pe loc
// și trebuie să arate de la început ca lecția publicată, și (2) la IEȘIRE, când
// se cere valoarea, fiindcă acolo se hotărăște ce pleacă spre bază.
// Cuprins în română, nume în engleză.
// =========================================================
import {
  sanitizeLesson, isLessonEmpty, lessonFormatState, blocCurent,
  execBold, execItalic, execUnderline, execStrike,
  execTreapta, execAliniere, execListaBuline, execListaNumere,
  execIndent, execOutdent, prepareLessonField,
} from "../scripts/lesson-rich.js";

const MAX_FILE = 20;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* SEMNELE DE ALINIERE SUNT DESENATE, nu scrise cu caractere. Întâi pusesem
   săgeți („⋘", „⋙"), și se vedea de departe greșeala: „la mijloc" și „la
   dreapta" ajunseseră cu același semn, fiindcă printre caractere nu există o
   pereche care să spună cele patru alinieri fără să se calce. Patru dungi
   desenate le spun pe toate patru, în orice font. */
const dungi = (lungimi) =>
  `<svg viewBox="0 0 16 12" width="15" height="12" aria-hidden="true">${
    lungimi.map(([x, w], i) =>
      `<rect x="${x}" y="${i * 3 + 0.5}" width="${w}" height="1.6" rx="0.8" fill="currentColor"/>`
    ).join("")}</svg>`;

const SEMN_ALINIERE = {
  justify: dungi([[1, 14], [1, 14], [1, 14], [1, 14]]),
  stanga: dungi([[1, 14], [1, 9], [1, 14], [1, 8]]),
  centru: dungi([[1, 14], [3.5, 9], [1, 14], [4, 8]]),
  dreapta: dungi([[1, 14], [6, 9], [1, 14], [7, 8]]),
};

/* Bara de unelte, scrisă o dată. Fiecare buton spune ce face ȘI la hover:
   semnele singure („B", „•") nu se învață de la sine. */
const UNELTE = [
  { grup: "scriere", butoane: [
    { act: "bold", semn: "<b>B</b>", spusa: "Îngroșat (Ctrl+B)" },
    { act: "italic", semn: "<i>I</i>", spusa: "Înclinat (Ctrl+I)" },
    { act: "underline", semn: "<u>U</u>", spusa: "Subliniat (Ctrl+U)" },
    { act: "strike", semn: "<s>S</s>", spusa: "Tăiat" },
  ] },
  { grup: "liste", butoane: [
    { act: "lista-buline", semn: "•", spusa: "Listă cu buline" },
    { act: "lista-numere", semn: "1.", spusa: "Listă numerotată" },
    { act: "outdent", semn: "⇤", spusa: "Scoate un nivel (Shift+Tab)" },
    { act: "indent", semn: "⇥", spusa: "Intră un nivel (Tab)" },
  ] },
  { grup: "aliniere", butoane: [
    { act: "al-justify", semn: SEMN_ALINIERE.justify, spusa: "Pe amândouă marginile (cum e din oficiu)" },
    { act: "al-stanga", semn: SEMN_ALINIERE.stanga, spusa: "La stânga" },
    { act: "al-centru", semn: SEMN_ALINIERE.centru, spusa: "La mijloc" },
    { act: "al-dreapta", semn: SEMN_ALINIERE.dreapta, spusa: "La dreapta" },
  ] },
];

const TREPTE = [
  ["obisnuit", "Text obișnuit"],
  ["titlu-mare", "Titlu mare"],
  ["titlu-mic", "Titlu mic"],
  ["marunt", "Text mărunt"],
];

/**
 * @param {HTMLElement} gazda  unde se desenează editorul
 * @param {{pages?: Array<{name:string, body:string}>, onChange?: Function}} cfg
 */
export function lessonEditor(gazda, { pages = [], onChange = null } = {}) {
  /* Starea trăiește AICI, nu în pagină: filele se pot muta și șterge, iar o
     stare citită din DOM s-ar pierde la fiecare redesenare. */
  let file = (Array.isArray(pages) && pages.length ? pages : [{ name: "Lecția", body: "" }])
    .slice(0, MAX_FILE)
    .map((f) => ({ name: String(f?.name || "Filă").slice(0, 40), body: String(f?.body || "") }));
  let laCare = 0;

  const anunta = () => { if (typeof onChange === "function") onChange(brute()); };

  /** Filele AȘA CUM SUNT, cu tot cu cele încă goale. Asta se ține minte afară,
   *  ca ciornă: o filă tocmai adăugată și încă nescrisă trebuie să fie acolo
   *  când editorul se așază din nou, altfel i-ar dispărea elevului de sub mână.
   *  Curățarea vine abia la `valoare()`, adică la trimitere. */
  function brute() {
    tineMinte();
    return file.map((f) => ({ name: f.name, body: f.body }));
  }

  /** Filele, curățate, gata de trimis. Cele goale de tot nu pleacă: o filă fără
   *  text ar cădea la verificarea din bază și ar opri toată lecția. */
  function valoare() {
    tineMinte();
    return file
      .map((f) => ({ name: f.name.trim() || "Filă", body: sanitizeLesson(f.body) }))
      .filter((f) => !isLessonEmpty(f.body));
  }

  /** Ce e acum în câmpul editabil intră în starea filei deschise. */
  function tineMinte() {
    const c = gazda.querySelector("[data-rol='camp']");
    if (c && file[laCare]) file[laCare].body = c.innerHTML;
  }

  function butonHtml(b) {
    return `<button type="button" class="led-btn" data-act="${b.act}"
      title="${esc(b.spusa)}" aria-label="${esc(b.spusa)}">${b.semn}</button>`;
  }

  function deseneaza() {
    const f = file[laCare] || { name: "", body: "" };
    gazda.innerHTML = `
      <div class="led">
        <div class="led-file" role="tablist" aria-label="Filele lecției">
          ${file.map((x, i) => `
            <button type="button" class="led-fila${i === laCare ? " on" : ""}"
              role="tab" aria-selected="${i === laCare}" data-act="fila" data-i="${i}">
              ${esc(x.name || "Filă")}
            </button>`).join("")}
          ${file.length < MAX_FILE
            ? `<button type="button" class="led-fila led-fila--plus" data-act="fila-noua"
                 title="Adaugă o filă">+</button>` : ""}
        </div>

        <div class="led-filabar">
          <label class="led-nume">
            <span class="led-nume__lab">Numele filei</span>
            <input type="text" class="led-input" data-rol="nume" maxlength="40"
              value="${esc(f.name)}" placeholder="Teorie, Exemple, Exerciții…">
          </label>
          <span class="led-filabar__act">
            <button type="button" class="led-btn" data-act="fila-stanga" title="Mută fila la stânga"
              ${laCare === 0 ? "disabled" : ""}>‹</button>
            <button type="button" class="led-btn" data-act="fila-dreapta" title="Mută fila la dreapta"
              ${laCare === file.length - 1 ? "disabled" : ""}>›</button>
            <button type="button" class="led-btn led-btn--rau" data-act="fila-sterge"
              title="Șterge fila asta" ${file.length === 1 ? "disabled" : ""}>🗑</button>
          </span>
        </div>

        <div class="led-unelte" role="toolbar" aria-label="Unelte de scriere">
          <select class="led-select" data-rol="treapta" aria-label="Felul textului">
            ${TREPTE.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}
          </select>
          ${UNELTE.map((g) => `<span class="led-grup" data-grup="${g.grup}">
            ${g.butoane.map(butonHtml).join("")}</span>`).join("")}
        </div>

        <div class="led-camp lt" contenteditable="true" role="textbox" aria-multiline="true"
          data-rol="camp" aria-label="Cuprinsul filei">${f.body}</div>

        <p class="led-sfat">Tab intră un nivel în listă, Shift+Tab îl scoate.
          Textul se aliniază pe amândouă marginile; celelalte alinieri sunt pentru abateri.</p>
      </div>`;
    prepareLessonField();
    potrivesteUneltele();
  }

  /** Butoanele se aprind după ce e pornit acolo unde stă cursorul. */
  function potrivesteUneltele() {
    const st = lessonFormatState();
    const pune = (act, pornit) => {
      const b = gazda.querySelector(`[data-act="${act}"]`);
      if (b) { b.classList.toggle("on", !!pornit); b.setAttribute("aria-pressed", pornit ? "true" : "false"); }
    };
    pune("bold", st.bold); pune("italic", st.italic);
    pune("underline", st.underline); pune("strike", st.strike);
    pune("lista-buline", st.listaBuline); pune("lista-numere", st.listaNumere);
    ["justify", "stanga", "centru", "dreapta"].forEach((a) => pune(`al-${a}`, st.aliniere === a));
    const sel = gazda.querySelector("[data-rol='treapta']");
    if (sel) sel.value = st.treapta;
  }

  const camp = () => gazda.querySelector("[data-rol='camp']");

  function apasa(e) {
    const b = e.target.closest("[data-act]");
    if (!b || !gazda.contains(b)) return;
    const act = b.dataset.act;

    /* Filele: schimbare, adăugare, mutare, ștergere. Fiecare ține minte întâi
       ce s-a scris, altfel fila părăsită ar pleca goală. */
    if (act === "fila") { tineMinte(); laCare = Number(b.dataset.i); deseneaza(); return; }
    if (act === "fila-noua") {
      tineMinte();
      if (file.length >= MAX_FILE) return;
      file.push({ name: `Fila ${file.length + 1}`, body: "" });
      laCare = file.length - 1;
      deseneaza(); anunta(); return;
    }
    if (act === "fila-stanga" || act === "fila-dreapta") {
      tineMinte();
      const j = laCare + (act === "fila-stanga" ? -1 : 1);
      if (j < 0 || j >= file.length) return;
      [file[laCare], file[j]] = [file[j], file[laCare]];
      laCare = j; deseneaza(); anunta(); return;
    }
    if (act === "fila-sterge") {
      if (file.length === 1) return;
      file.splice(laCare, 1);
      laCare = Math.max(0, laCare - 1);
      deseneaza(); anunta(); return;
    }

    /* Poruncile de scriere lucrează pe selecția din câmp, deci câmpul trebuie
       să aibă focusul: un buton apăsat cu mouse-ul i-l ia dacă nu-l cerem
       înapoi, iar porunca ar cădea în gol. */
    e.preventDefault();
    const c = camp();
    if (c) c.focus();

    switch (act) {
      case "bold": execBold(); break;
      case "italic": execItalic(); break;
      case "underline": execUnderline(); break;
      case "strike": execStrike(); break;
      case "lista-buline": execListaBuline(); break;
      case "lista-numere": execListaNumere(); break;
      case "indent": execIndent(); break;
      case "outdent": execOutdent(); break;
      case "al-justify": execAliniere("justify"); break;
      case "al-stanga": execAliniere("stanga"); break;
      case "al-centru": execAliniere("centru"); break;
      case "al-dreapta": execAliniere("dreapta"); break;
      default: return;
    }
    potrivesteUneltele();
    tineMinte(); anunta();
  }

  function schimba(e) {
    if (!e.target.dataset) return;
    if (e.target.dataset.rol === "treapta") {
      const c = camp(); if (c) c.focus();
      execTreapta(e.target.value);
      potrivesteUneltele(); tineMinte(); anunta();
      return;
    }
    if (e.target.dataset.rol === "nume") {
      if (file[laCare]) file[laCare].name = e.target.value.slice(0, 40);
      /* Numele se schimbă și pe filă, fără să redesenez tot: o redesenare i-ar
         lua focusul din câmpul în care tocmai scrie. */
      const fila = gazda.querySelector(`.led-fila[data-i="${laCare}"]`);
      if (fila) fila.textContent = file[laCare].name || "Filă";
      anunta();
    }
  }

  /* TAB ÎN LISTĂ, nu în afara câmpului. Într-un text, Tab mută focusul la
     butonul următor, ceea ce aici ar fi o supărare: cine scrie o listă se
     așteaptă să intre un nivel. În AFARA listei îl lăsăm browserului, ca
     tastatura să poată ieși din câmp. */
  function taste(e) {
    if (e.key !== "Tab") { return; }
    const b = blocCurent();
    const inLista = b && b.tagName.toLowerCase() === "li";
    if (!inLista) return;
    e.preventDefault();
    if (e.shiftKey) execOutdent(); else execIndent();
    potrivesteUneltele(); tineMinte(); anunta();
  }

  /* LIPITUL SE CURĂȚĂ PE LOC, nu abia la salvare. Un text lipit din Word aduce
     cu el zeci de `<span style>`, culori și fonturi; curățarea de la salvare
     le-ar fi aruncat oricum, dar până atunci elevul ar fi scris într-o filă
     care arată cu totul altfel decât lecția publicată, și n-ar fi înțeles de ce
     „i s-a stricat" textul la trimitere. */
  function lipeste(e) {
    const c = camp();
    if (!c || !c.contains(e.target)) return;
    e.preventDefault();
    const dt = e.clipboardData;
    const html = dt ? dt.getData("text/html") : "";
    const text = dt ? dt.getData("text/plain") : "";
    const curat = html
      ? sanitizeLesson(html)
      /* Text simplu: rândurile goale despart paragrafe, restul rămân rânduri. */
      : text.split(/\n{2,}/).map((p) =>
          `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
    if (!curat) return;
    try { document.execCommand("insertHTML", false, curat); } catch { /* ignoră */ }
    potrivesteUneltele(); tineMinte(); anunta();
  }

  const laMutareCursor = () => potrivesteUneltele();
  const laScriere = (e) => {
    if (e.target.dataset && e.target.dataset.rol === "nume") { schimba(e); return; }
    tineMinte(); anunta();
  };

  gazda.addEventListener("mousedown", apasa);
  gazda.addEventListener("change", schimba);
  gazda.addEventListener("input", laScriere);
  gazda.addEventListener("keydown", taste);
  gazda.addEventListener("keyup", laMutareCursor);
  gazda.addEventListener("click", laMutareCursor);
  gazda.addEventListener("paste", lipeste);

  deseneaza();

  return {
    valoare,
    brute,
    /** Pune alte file în editor (de pildă când profesorul deschide altă
     *  propunere din coadă, fără să facă un editor nou). */
    pune(noile) {
      file = (Array.isArray(noile) && noile.length ? noile : [{ name: "Lecția", body: "" }])
        .slice(0, MAX_FILE)
        .map((f) => ({ name: String(f?.name || "Filă").slice(0, 40), body: String(f?.body || "") }));
      laCare = 0;
      deseneaza();
    },
    distruge() {
      gazda.removeEventListener("mousedown", apasa);
      gazda.removeEventListener("change", schimba);
      gazda.removeEventListener("input", laScriere);
      gazda.removeEventListener("keydown", taste);
      gazda.removeEventListener("keyup", laMutareCursor);
      gazda.removeEventListener("click", laMutareCursor);
      gazda.removeEventListener("paste", lipeste);
      gazda.innerHTML = "";
    },
  };
}

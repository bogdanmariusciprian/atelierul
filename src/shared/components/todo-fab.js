// =========================================================
// Butonul „TO-DO" al profesorului, în colțul din stânga jos, pe toate paginile.
//
// LA CE E BUN. Notezi ce ai de făcut CHIAR ACOLO unde ți-ai dat seama, iar nota
// rămâne legată de pagina aceea. A doua zi deschizi pagina și te așteaptă în ea.
// Un caiet de notițe deschis pe alt ecran se uită; unul care iese singur în
// calea ta, nu.
//
// DOUĂ FILE, ȘI AMÂNDOUĂ TREBUIE. „Aici" e lucrul de acum. „Toate" e ce ai
// împrăștiat prin site, așezat pe pagini, cu legătură spre fiecare: fără ea,
// notițele scrise prin colțuri s-ar pierde, iar o listă din care nu mai găsești
// nimic e mai rea decât nicio listă.
//
// NUMAI PROFESORUL. Nu se desenează deloc pentru ceilalți, nici ascuns: ce nu
// există în pagină nu se poate deschide cu unealta de dezvoltare. Iar dincolo de
// ce se vede, serverul refuză oricum orice cerere (migrarea 0081): butonul care
// lipsește e curtoazie, politica din bază e paza.
//
// STILURILE ȘI LE ADUCE SINGUR. Widgetul merge și pe paginile care n-au foaia
// sitului (cele două table, atelierul de redactare), deci nu se poate sprijini
// pe ea. Vezi `todo.css`. Content Romanian, identifiers English.
// =========================================================
import { isAdmin } from "../scripts/session.js";
import {
  cheiaPaginii, numelePaginii, listTodos, addTodo,
  setTodoDone, setTodoBody, removeTodo, pePagini,
} from "../scripts/todo-repo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let radacina = null;
let toate = [];
let fila = "aici";      // „aici" | „toate"
let deschis = false;
let bazaSitului = "";

/** Foaia de stil, adusă o singură dată, oricâte pagini ar chema widgetul. */
function aduStilurile(basePath) {
  const href = `${basePath}src/shared/styles/todo.css`;
  if (document.querySelector(`link[data-todo-css]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  l.setAttribute("data-todo-css", "");
  document.head.appendChild(l);
}

const alePaginii = () => toate.filter((t) => t.path === cheiaPaginii());
const deFacutAici = () => alePaginii().filter((t) => !t.done).length;

function notaHtml(t, cuPagina = false) {
  return `<div class="todo-nota${t.done ? " e-facuta" : ""}" data-id="${esc(t.id)}">
      <input type="checkbox" data-todo="bifa"${t.done ? " checked" : ""}
        aria-label="Gata: ${esc(t.body.slice(0, 40))}">
      <span class="todo-nota__t" data-todo="scrie" contenteditable="false"
        role="textbox" tabindex="0">${esc(t.body)}</span>
      <button type="button" class="todo-nota__x" data-todo="sterge"
        title="Șterge notița" aria-label="Șterge notița">×</button>
    </div>`;
}

function listaHtml() {
  if (fila === "aici") {
    const ale = alePaginii();
    if (!ale.length) {
      return `<p class="todo-gol">Nicio notiță pe pagina asta.
        Scrie una sus: rămâne legată de pagină și te așteaptă aici data viitoare.</p>`;
    }
    return ale.map((t) => notaHtml(t)).join("");
  }
  if (!toate.length) return `<p class="todo-gol">N-ai nicio notiță nicăieri.</p>`;
  return pePagini(toate).map((p) => `<div class="todo-pag">
      <a class="todo-pag__cap" href="${esc(p.path)}">
        ${esc(p.title || "Pagină")}
        ${p.deFacut ? `<span class="todo-pag__n">${p.deFacut}</span>` : ""}
        <span class="todo-pag__cale">${esc(p.path)}</span>
      </a>
      ${p.note.map((t) => notaHtml(t, true)).join("")}
    </div>`).join("");
}

function deseneaza() {
  if (!radacina) return;
  const n = deFacutAici();
  radacina.innerHTML = `
    <div class="todo-panel"${deschis ? "" : " hidden"}>
      <div class="todo-panel__cap">
        <b>TO-DO</b>
        <span class="todo-panel__unde">${esc(numelePaginii())}</span>
        <button type="button" class="todo-panel__x" data-todo="inchide"
          title="Închide" aria-label="Închide">×</button>
      </div>
      <div class="todo-file">
        <button type="button" class="${fila === "aici" ? "on" : ""}" data-todo="fila" data-val="aici">Aici</button>
        <button type="button" class="${fila === "toate" ? "on" : ""}" data-todo="fila" data-val="toate">Toate</button>
      </div>
      <div class="todo-scris">
        <textarea data-todo="camp" rows="1" placeholder="Ce ai de făcut aici?"
          aria-label="Notiță nouă"></textarea>
        <button type="button" data-todo="adauga">Adaugă</button>
      </div>
      <div class="todo-lista">${listaHtml()}</div>
    </div>
    <button type="button" class="todo-fab" data-todo="deschide"
      aria-expanded="${deschis}" title="Notițele tale pentru pagina asta">
      TO-DO${n ? `<span class="todo-fab__n">${n}</span>` : ""}
    </button>`;
}

/** Adaugă ce s-a scris în câmp. */
async function adauga() {
  const camp = radacina.querySelector('[data-todo="camp"]');
  const text = camp ? camp.value.trim() : "";
  if (!text) { camp?.focus(); return; }
  const rand = await addTodo(text, cheiaPaginii(), numelePaginii());
  if (!rand) return;
  toate = [rand, ...toate];
  deseneaza();
  radacina.querySelector('[data-todo="camp"]')?.focus();
}

function leagaEvenimente() {
  radacina.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-todo]");
    if (!el) return;
    const ce = el.dataset.todo;

    if (ce === "deschide") { deschis = !deschis; deseneaza();
      if (deschis) radacina.querySelector('[data-todo="camp"]')?.focus(); return; }
    if (ce === "inchide") { deschis = false; return deseneaza(); }
    if (ce === "fila") { fila = el.dataset.val; return deseneaza(); }
    if (ce === "adauga") return adauga();

    const nota = el.closest(".todo-nota");
    if (!nota) return;
    const id = nota.dataset.id;
    if (ce === "sterge") {
      if (!(await removeTodo(id))) return;
      toate = toate.filter((t) => t.id !== id);
      return deseneaza();
    }
  });

  /* Bifa se face din `change`, nu din `click`: așa merge și de la tastatură. */
  radacina.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.dataset.todo !== "bifa") return;
    const id = el.closest(".todo-nota")?.dataset.id;
    if (!id) return;
    const gata = el.checked;
    toate = toate.map((t) => (t.id === id ? { ...t, done: gata } : t));
    deseneaza();
    if (await setTodoDone(id, gata)) return;
    toate = toate.map((t) => (t.id === id ? { ...t, done: !gata } : t));
    deseneaza();
  });

  /* Textul se schimbă pe loc: dublu-click îl face scriibil, iar plecarea de pe
     el îl salvează. Fără fereastră aparte, fiindcă o notiță e un rând, nu un
     document. */
  radacina.addEventListener("dblclick", (e) => {
    const t = e.target.closest('[data-todo="scrie"]');
    if (!t) return;
    t.setAttribute("contenteditable", "true");
    t.focus();
  });
  radacina.addEventListener("focusout", async (e) => {
    const t = e.target.closest?.('[data-todo="scrie"][contenteditable="true"]');
    if (!t) return;
    t.setAttribute("contenteditable", "false");
    const id = t.closest(".todo-nota")?.dataset.id;
    const text = t.textContent.trim();
    const vechi = toate.find((x) => x.id === id);
    if (!id || !text || !vechi || text === vechi.body) { deseneaza(); return; }
    toate = toate.map((x) => (x.id === id ? { ...x, body: text } : x));
    if (!(await setTodoBody(id, text))) {
      toate = toate.map((x) => (x.id === id ? { ...x, body: vechi.body } : x));
    }
    deseneaza();
  });

  /* Ctrl+Enter adaugă, ca să nu iei mâna de pe tastatură. Escape închide. */
  radacina.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && deschis) { deschis = false; deseneaza(); return; }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.target.dataset?.todo === "camp") {
      e.preventDefault();
      adauga();
    }
  });

  /* În hub, uneltele se schimbă din hash, nu din adresă nouă. Notițele trebuie
     să se schimbe odată cu ele, altfel ai vedea nota de la moderare stând peste
     tabla de fonetică. */
  window.addEventListener("hashchange", deseneaza);
}

/**
 * Pune butonul în pagină. `basePath` e drumul până la rădăcina sitului, același
 * pe care îl primește și bara sitului („", „../", „../../../../").
 */
export async function initTodo(basePath = "") {
  if (!isAdmin()) return;
  if (document.querySelector(".todo-fab-wrap")) return;
  bazaSitului = basePath;
  aduStilurile(basePath);

  radacina = document.createElement("div");
  radacina.className = "todo-fab-wrap";
  document.body.appendChild(radacina);
  leagaEvenimente();
  deseneaza();

  toate = await listTodos();
  deseneaza();
}

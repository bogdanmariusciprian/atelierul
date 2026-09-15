// =========================================================
// MODULUL „LICEU": cadrul.
//
// Panou în stânga, cuprins în dreapta. Butoanele din panou vin mai târziu;
// acum se face scheletul, iar un buton nou va însemna o intrare în `VEDERI`.
//
// TREI HOTĂRÂRI, ca să se înțeleagă de ce arată așa:
//
// 1. DE SINE STĂTĂTOR. Nici antet, nici subsol, nici butoanele plutitoare ale
//    sitului: pagina nu cheamă `renderChrome()`. Singura ieșire e săgeata din
//    colțul de sus-stânga, care își schimbă vorba.
//
// 2. ÎNAPOI ÎNSEAMNĂ „UNDE AM FOST", NU „CU UN NIVEL MAI SUS". De-aia nu ținem
//    un teanc de mână, ci folosim chiar istoria browserului (`pushState` /
//    `popstate`): ea E un teanc, și unul pe care Back-ul browserului îl știe
//    deja. Un teanc al nostru pe lângă al lui s-ar fi dezacordat de ele la
//    prima apăsare pe Back, iar butonul ar fi dus în altă parte decât săgeata
//    de sus a browserului. Adâncimea se ține în starea fiecărui pas, ca să
//    știm când s-a golit: atunci săgeata scrie „Înapoi la site".
//
// 3. LĂȚIMEA PANOULUI E A CONTULUI, nu a browserului. Trece prin `punLocal`,
//    care lipește numele contului la cheie: doi oameni pe același calculator
//    nu-și mută unul altuia panoul. (Pățania din `session.js`.)
// Cuprins în română, nume în engleză.
// =========================================================
import { iaLocal, punLocal } from "../../shared/scripts/session.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Măsurile panoului, în pixeli. Sub minim nu mai încape un nume de buton; peste
   maxim, cuprinsul din dreapta ajunge o fâșie. */
const LAT_MIN = 180;
const LAT_MAX = 560;
const LAT_START = 264;
const PAS = 16;                       // cât mută o apăsare de săgeată

const CHEIE_LAT = "liceu:latimea-panoului";
const CHEIE_STRANS = "liceu:panoul-strans";

/**
 * VEDERILE. Deocamdată niciuna: Marius a spus „n-avem butoane încă".
 * Un buton nou = o intrare aici, și atât. Forma:
 *   { id: "ceva", nume: "Ceva", grup: "Un titlu", desen: () => "<html>" }
 * `grup` e neobligatoriu; vederile fără grup stau primele.
 */
const VEDERI = [];

const vedereaDupaId = (id) => VEDERI.find((v) => v.id === id) || null;

const stare = {
  vedere: null,          // id-ul vederii deschise; `null` = ecranul de acasă
  adancime: 0,           // câți pași am făcut ÎN modul
  latime: LAT_START,
  strans: false,
};

let radacina = null;
let caleaSitului = "";

/* ---------------- ruta ---------------- */

const hashPentru = (id) => (id ? `#/v/${encodeURIComponent(id)}` : "#/");

function citesteRuta() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  if (!h.startsWith("v/")) return null;
  const id = h.slice(2);
  return vedereaDupaId(id) ? id : null;
}

/**
 * Deschide o vedere. Pune un pas în istoria browserului, deci Back-ul lui și
 * săgeata noastră ajung în același loc.
 */
function navigheaza(id) {
  if (id === stare.vedere) return;
  stare.adancime += 1;
  history.pushState({ liceu: stare.adancime }, "", hashPentru(id));
  stare.vedere = id;
  deseneaza();
}

/**
 * Săgeata din colțul de sus-stânga. Cât timp am pași în urmă, scoate câte unul;
 * când s-a golit, iese din modul.
 */
function inapoi() {
  if (stare.adancime > 0) { history.back(); return; }
  location.href = caleaSitului || "/";
}

/* ---------------- lățimea panoului ---------------- */

const inMargini = (n) => Math.min(LAT_MAX, Math.max(LAT_MIN, Math.round(n)));

function puneLatimea(px, tineMinte = false) {
  stare.latime = inMargini(px);
  radacina.style.setProperty("--panou", `${stare.latime}px`);
  const m = radacina.querySelector("[data-rol='maner']");
  if (m) m.setAttribute("aria-valuenow", String(stare.latime));
  if (tineMinte) punLocal(CHEIE_LAT, stare.latime);
}

function strange(da) {
  stare.strans = !!da;
  radacina.classList.toggle("lic--strans", stare.strans);
  punLocal(CHEIE_STRANS, stare.strans);
  const b = radacina.querySelector("[data-act='burger']");
  if (b) {
    b.setAttribute("aria-expanded", String(!stare.strans));
    b.title = stare.strans ? "Arată panoul" : "Ascunde panoul";
  }
}

/* TRAGEREA, cu evenimente de pointer: unul singur pentru maus, deget și creion.
   `setPointerCapture` face ca mișcarea să rămână a mânerului chiar dacă
   degetul iese de pe el — altfel, tras repede, panoul rămânea în urmă și se
   oprea din mers. */
function legaManerul(maner) {
  let pornit = false;

  maner.addEventListener("pointerdown", (e) => {
    if (stare.strans) return;
    pornit = true;
    maner.setPointerCapture(e.pointerId);
    radacina.classList.add("lic--trage");
    e.preventDefault();
  });

  maner.addEventListener("pointermove", (e) => {
    if (!pornit) return;
    /* Lățimea e distanța de la marginea din stânga a modulului până la deget,
       nu poziția în fereastră: modulul poate să nu înceapă la zero. */
    puneLatimea(e.clientX - radacina.getBoundingClientRect().left);
  });

  const gata = (e) => {
    if (!pornit) return;
    pornit = false;
    try { maner.releasePointerCapture(e.pointerId); } catch { /* deja eliberat */ }
    radacina.classList.remove("lic--trage");
    punLocal(CHEIE_LAT, stare.latime);
  };
  maner.addEventListener("pointerup", gata);
  maner.addEventListener("pointercancel", gata);

  /* CU TASTATURA. Un mâner care se mișcă numai cu mausul e o unealtă pe
     jumătate; `role="separator"` cu `tabindex` e chiar tiparul pentru asta. */
  maner.addEventListener("keydown", (e) => {
    if (stare.strans) return;
    const pas = e.shiftKey ? PAS * 4 : PAS;
    if (e.key === "ArrowLeft") puneLatimea(stare.latime - pas, true);
    else if (e.key === "ArrowRight") puneLatimea(stare.latime + pas, true);
    else if (e.key === "Home") puneLatimea(LAT_MIN, true);
    else if (e.key === "End") puneLatimea(LAT_MAX, true);
    else return;
    e.preventDefault();
  });

  /* Dublu-click pe mâner: înapoi la lățimea din oficiu. */
  maner.addEventListener("dblclick", () => puneLatimea(LAT_START, true));
}

/* ---------------- desenul ---------------- */

const SAGEATA = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>`;

const BURGER = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;

function panouHtml() {
  if (!VEDERI.length) {
    return `<p class="lic-panou__gol">Aici vin butoanele.</p>`;
  }
  /* Vederile se strâng pe grupuri, în ordinea în care apar în `VEDERI`. Cele
     fără grup stau primele, fără titlu deasupra. */
  const grupuri = [];
  for (const v of VEDERI) {
    const nume = v.grup || "";
    let g = grupuri.find((x) => x.nume === nume);
    if (!g) { g = { nume, vederi: [] }; grupuri.push(g); }
    g.vederi.push(v);
  }
  return grupuri.map((g) => `
    <div class="lic-grup">
      ${g.nume ? `<p class="lic-grup__titlu">${esc(g.nume)}</p>` : ""}
      ${g.vederi.map((v) => `
        <button type="button" class="lic-buton${v.id === stare.vedere ? " on" : ""}"
          data-act="vedere" data-id="${esc(v.id)}"
          ${v.id === stare.vedere ? 'aria-current="page"' : ""}>${esc(v.nume)}</button>`).join("")}
    </div>`).join("");
}

function cuprinsHtml() {
  const v = vedereaDupaId(stare.vedere);
  if (v) {
    try { return v.desen(); }
    catch (err) {
      console.error("[liceu]", err);
      return `<div class="lic-gol"><p>Ecranul ăsta n-a putut fi afișat.</p></div>`;
    }
  }
  return `
    <div class="lic-gol">
      <h1>Liceu</h1>
      <p>Panoul din stânga e gol deocamdată. Când capătă butoane, ce alegi acolo
         se deschide aici.</p>
    </div>`;
}

function deseneaza() {
  const acasa = stare.adancime === 0;
  radacina.innerHTML = `
    <div class="lic-sus">
      <button type="button" class="lic-inapoi" data-act="inapoi"
        title="${acasa ? "Înapoi la site" : "Înapoi"}">
        ${SAGEATA}<span>${acasa ? "Înapoi la site" : "Înapoi"}</span>
      </button>
      <button type="button" class="lic-burger" data-act="burger"
        aria-expanded="${!stare.strans}" aria-controls="lic-panou"
        title="${stare.strans ? "Arată panoul" : "Ascunde panoul"}">
        ${BURGER}<span class="sr-only">Panoul</span>
      </button>
    </div>

    <aside class="lic-panou" id="lic-panou" ${stare.strans ? "inert" : ""}>
      ${panouHtml()}
    </aside>

    <div class="lic-maner" data-rol="maner" role="separator" tabindex="0"
      aria-orientation="vertical" aria-label="Lățimea panoului"
      aria-valuemin="${LAT_MIN}" aria-valuemax="${LAT_MAX}" aria-valuenow="${stare.latime}"></div>

    <main class="lic-cuprins" id="lic-cuprins">${cuprinsHtml()}</main>`;

  puneLatimea(stare.latime);
  legaManerul(radacina.querySelector("[data-rol='maner']"));
}

/* ---------------- apăsările ---------------- */

function apasa(e) {
  const b = e.target.closest("[data-act]");
  if (!b || !radacina.contains(b)) return;
  const act = b.dataset.act;
  if (act === "inapoi") { inapoi(); return; }
  if (act === "burger") { strange(!stare.strans); return; }
  if (act === "vedere") { navigheaza(b.dataset.id); }
}

/* ---------------- pornirea ---------------- */

/**
 * @param {HTMLElement} gazda
 * @param {string} basePath  ce se pune înaintea adreselor („../" de obicei)
 */
export function renderHighschool(gazda, basePath = "") {
  radacina = gazda;
  caleaSitului = basePath;
  if (!radacina) return;

  stare.latime = inMargini(Number(iaLocal(CHEIE_LAT, LAT_START)) || LAT_START);
  stare.vedere = citesteRuta();

  /* CINE INTRĂ DE-A DREPTUL pe adresa unei vederi (dintr-un mesaj, dintr-un
     favorit) e la PRIMUL lui ecran, oricât de adânc ar fi acela. Deci adâncimea
     pleacă de la zero, iar săgeata îi spune cinstit „Înapoi la site": n-are
     unde să se întoarcă înăuntru, fiindcă n-a fost nicăieri. */
  stare.adancime = 0;
  history.replaceState({ liceu: 0 }, "", hashPentru(stare.vedere));

  radacina.addEventListener("click", apasa);

  /* Back-ul browserului și săgeata noastră trec amândouă pe aici. */
  window.addEventListener("popstate", (e) => {
    stare.adancime = Number(e.state?.liceu) || 0;
    stare.vedere = citesteRuta();
    deseneaza();
  });

  deseneaza();
  /* Strângerea se pune DUPĂ primul desen: `strange` caută butonul în pagină. */
  strange(iaLocal(CHEIE_STRANS, false) === true);
}

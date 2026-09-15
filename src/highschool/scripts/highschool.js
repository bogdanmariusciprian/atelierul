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
import { CLASE } from "./classes.js";
import { hourCard } from "./hour-card.js";
import { stareaDeAcum } from "./school-time.js";
import { fetchZiua, fetchSaptamana, fetchConfig, fetchPlan, ziuaISO } from "./liceu-repo.js";
import { fiseleClasei, fisaDupaId, adresaFisei, FELUL_FISEI } from "./fise.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* LĂȚIMEA PANOULUI N-ARE MARGINI PUSE DE NOI (cerut de Marius: „oricât vreau
   eu"). Singura margine e cea fizică: mânerul nu poate ieși din ecran, fiindcă
   atunci n-ar mai avea nimeni de ce trage înapoi. Deci zero la stânga, iar la
   dreapta cât ține modulul, fără lățimea mânerului.

   La zero, panoul dispare de tot; se întoarce trăgând mânerul de pe margine,
   ori din burger. */
const MANER = 6;                      // lățimea mânerului, aceeași ca în CSS
const LAT_START = 264;                // de unde pleacă, prima dată și la dublu-click
const PAS = 16;                       // cât mută o apăsare de săgeată

const CHEIE_LAT = "liceu:latimea-panoului";
const CHEIE_STRANS = "liceu:panoul-strans";

/**
 * VEDERILE. Un buton nou = o intrare aici, și atât. Forma:
 *   { id: "ceva", nume: "Ceva", grup: "Un titlu", desen: () => "<html>" }
 * `grup` e neobligatoriu; vederile fără grup stau primele.
 *
 * Deocamdată sunt numai cele șapte clase, născute din `CLASE`: ecranul de
 * pornire le arată ca niște cartonașe, iar apăsarea uneia deschide vederea ei.
 * Panoul din stânga rămâne gol dinadins, până spui ce butoane vrei acolo: dacă
 * le-aș fi pus și acolo, ar fi fost aceeași listă de două ori pe ecran.
 */
const VEDERI = CLASE.map((c) => ({
  id: `clasa-${c.cod.toLowerCase()}`,
  nume: c.cod,
  ascunsaInPanou: true,
  desen: () => vedereDeClasa(c),
}));

const vedereaDupaId = (id) => VEDERI.find((v) => v.id === id) || null;

const stare = {
  vedere: null,          // id-ul vederii deschise; `null` = ecranul de acasă
  adancime: 0,           // câți pași am făcut ÎN modul
  latime: LAT_START,
  strans: false,
};

let radacina = null;
let caleaSitului = "";
let card = null;          // cardul plutitor cu ora, făcut o singură dată

/* ---------------- ruta ---------------- */

/** `ruta` e deja de forma „v/ceva" ori „f/ceva"; `null` = acasă. */
const hashPentru = (ruta) => (ruta ? `#/${ruta}` : "#/");

/* Ruta e ori o vedere („v/clasa-9b"), ori o fișă („f/9b-4-b"). Se ține ca text,
   fiindcă teancul de pași al browserului o poartă înapoi așa cum e. */
function citesteRuta() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  if (h.startsWith("v/")) { const id = h.slice(2); return vedereaDupaId(id) ? `v/${id}` : null; }
  if (h.startsWith("f/")) { const id = h.slice(2); return fisaDupaId(id) ? `f/${id}` : null; }
  return null;
}

const rutaE = (fel) => String(stare.vedere || "").startsWith(`${fel}/`);
const rutaId = () => String(stare.vedere || "").slice(2);

/**
 * Deschide o vedere. Pune un pas în istoria browserului, deci Back-ul lui și
 * săgeata noastră ajung în același loc.
 */
function navigheaza(ruta) {
  if (ruta === stare.vedere) return;
  stare.adancime += 1;
  history.pushState({ liceu: stare.adancime }, "", hashPentru(ruta));
  stare.vedere = ruta;
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

/** Cât de lat poate fi panoul ACUM: tot modulul, fără mâner. Se socotește la
 *  fiecare atingere, nu o dată la pornire: fereastra se poate schimba. */
const latMax = () => Math.max(0, (radacina?.clientWidth || window.innerWidth) - MANER);

/**
 * DOUĂ LĂȚIMI, NU UNA, și e o deosebire care se simte:
 *   · `stare.latime` e cea ALEASĂ de om, și numai el o schimbă;
 *   · cea PUSĂ în pagină e aceea tăiată la cât încape acum.
 * Dacă fereastra se micșorează, punem mai puțin, dar nu uităm alegerea; când
 * fereastra se face la loc mare, panoul se întoarce singur la lățimea ta. Cu o
 * singură valoare, o fereastră micșorată o dată ți-ar fi mâncat alegerea pentru
 * totdeauna.
 */
function aplicaLatimea() {
  const px = Math.min(stare.latime, latMax());
  radacina.style.setProperty("--panou", `${px}px`);
  /* LA ZERO, PANOUL SE SCOATE DE TOT din pagină. O coloană de zero pixeli tot
     lasă marginile dinăuntru să se vadă, adică o fâșie de vreo șaisprezece
     pixeli care arată ca o greșeală. Mânerul RĂMÂNE, ca să ai de ce trage
     înapoi. */
  radacina.classList.toggle("lic--zero", px === 0);
  const m = radacina.querySelector("[data-rol='maner']");
  if (m) {
    m.setAttribute("aria-valuenow", String(px));
    m.setAttribute("aria-valuemax", String(latMax()));
  }
}

function puneLatimea(px, tineMinte = false) {
  /* Tăiat la marginea fizică: mânerul n-are voie să iasă din ecran, altfel n-ar
     mai avea nimeni de ce trage înapoi. În rest, zero e o lățime la fel de bună
     ca oricare alta. */
  stare.latime = Math.min(latMax(), Math.max(0, Math.round(px)));
  aplicaLatimea();
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
    else if (e.key === "Home") puneLatimea(0, true);
    else if (e.key === "End") puneLatimea(latMax(), true);
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
  /* Vederile cu `ascunsaInPanou` nu apar aici: au alt drum spre ele (acum,
     cartonașele de pe ecranul de pornire). */
  const ale = VEDERI.filter((v) => !v.ascunsaInPanou);
  if (!ale.length) {
    return `<p class="lic-panou__gol">Aici vin butoanele.</p>`;
  }
  /* Vederile se strâng pe grupuri, în ordinea în care apar în `VEDERI`. Cele
     fără grup stau primele, fără titlu deasupra. */
  const grupuri = [];
  for (const v of ale) {
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

/* ---------------- ecranul de pornire: clasele ---------------- */

/**
 * Cartonașele claselor, de sticlă.
 *
 * STICLA ARE NEVOIE DE CEVA DEDESUBT. `backdrop-filter` tulbură ce e ÎN SPATELE
 * elementului; pe un fundal plat n-ar avea ce tulbura, iar cartonașul ar arăta
 * ca o casetă spălăcită. De-aia sub ele stau câteva pete de culoare mari și
 * neclare (`.lic-aurora`), luate chiar din nuanțele claselor: sticla capătă ce
 * să frângă, iar culorile se văd prin ea.
 *
 * MĂRIMILE SUNT DE DEGET, NU DE MAUS: modulul se folosește pe tabla din clasă.
 * Un cartonaș are cel puțin 170 de pixeli înălțime, iar codul clasei e scris
 * mare, ca să se citească de la câțiva metri.
 */
function cartonaseHtml() {
  return `
    <div class="lic-acasa">
      <div class="lic-aurora" aria-hidden="true">
        ${CLASE.map((c) => `<span style="--h:${c.hue}"></span>`).join("")}
      </div>

      <h1 class="lic-acasa__titlu">Clasele mele</h1>

      <ul class="lic-carduri">
        ${CLASE.map((c) => `
          <li>
            <button type="button" class="lic-card" style="--h:${c.hue}"
              data-act="vedere" data-id="clasa-${c.cod.toLowerCase()}">
              <span class="lic-card__cod">${esc(c.cod)}</span>
              <span class="lic-card__stralucire" aria-hidden="true"></span>
            </button>
          </li>`).join("")}
      </ul>
    </div>`;
}

/* Planificările cerute pe parcurs, ținute ca să nu se ceară de două ori. */
const planuri = {};

async function aduPlanul(clasa) {
  if (planuri[clasa]) return;
  planuri[clasa] = { seAduce: true, ore: [] };
  const r = await fetchPlan(clasa);
  planuri[clasa] = { seAduce: false, ore: r.date || [] };
  /* Dacă între timp ai plecat pe alt ecran, nu-l smulgem de sub tine. */
  if (rutaE("v") && rutaId() === `clasa-${clasa.toLowerCase()}`) deseneaza();
}

const ziScurta = (iso) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("ro-RO",
      { weekday: "short", day: "numeric", month: "short" });
  } catch { return iso; }
};

/**
 * Vederea unei clase: TOATE orele din planificare, cu titlurile lor.
 *
 * Orele care au deja o fișă se deschid și se văd întregi; celelalte stau
 * stinse, ca niște locuri pregătite. Așa se vede dintr-o privire cât e făcut
 * din an și cât mai e de făcut, iar o fișă nouă „umple" rândul ei fără să umble
 * nimeni prin cod: se potrivesc după numărul orei.
 *
 * La clasele a 12-a nu se înșiră nimic (cerut de Marius): rămân doar fișele,
 * dacă are vreuna.
 */
function vedereDeClasa(c) {
  const fise = fiseleClasei(c.cod);
  const peOra = new Map(fise.map((f) => [f.ora, f]));

  const cap = `<h1 class="lic-clasa__cod">${esc(c.cod)}</h1>`;

  if (c.faraOre) {
    return `
      <div class="lic-clasa" style="--h:${c.hue}">
        ${cap}
        ${fise.length ? listaFiselor(fise) : `<p class="lic-clasa__gol">Clasa asta n-are încă fișe.</p>`}
      </div>`;
  }

  const p = planuri[c.cod];
  if (!p) { aduPlanul(c.cod); }
  if (!p || p.seAduce) {
    return `<div class="lic-clasa" style="--h:${c.hue}">${cap}
      <p class="lic-clasa__gol">Aduc planificarea…</p></div>`;
  }
  if (!p.ore.length) {
    return `<div class="lic-clasa" style="--h:${c.hue}">${cap}
      <p class="lic-clasa__gol">Planificarea clasei ăsteia n-a fost încă adusă în bază.</p></div>`;
  }

  /* Un titlu de unitate la fiecare unitate nouă: o sută de rânduri la rând se
     citesc ca o listă fără capete. */
  let unitateaDeSus = null;
  const randuri = p.ore.map((o) => {
    const f = peOra.get(o.nr);
    const nouaUnitate = o.unitatea && o.unitatea !== unitateaDeSus;
    if (nouaUnitate) unitateaDeSus = o.unitatea;
    const cuprins = `
      <span class="lic-ora__nr">Ora ${o.nr}</span>
      <span class="lic-ora__ce">
        <b>${o.titlu ? esc(o.titlu) : `<i>${esc(o.fel || "fără titlu")}</i>`}</b>
        <small>${ziScurta(o.data)} · ${esc(o.ora)}</small>
      </span>
      <span class="lic-ora__semn">${f ? esc(f.fel) : ""}</span>`;
    return `
      ${nouaUnitate ? `<li class="lic-unit">${esc(o.unitatea)}</li>` : ""}
      <li>${f
        ? `<a class="lic-ora" href="#/f/${esc(f.id)}"
             title="${esc(FELUL_FISEI[f.fel]?.ce || "")}">${cuprins}</a>`
        : `<span class="lic-ora lic-ora--fara"
             title="Ora asta n-are încă fișă">${cuprins}</span>`}</li>`;
  }).join("");

  const cuFisa = p.ore.filter((o) => peOra.has(o.nr)).length;
  return `
    <div class="lic-clasa" style="--h:${c.hue}">
      ${cap}
      <p class="lic-clasa__cate">${cuFisa} din ${p.ore.length} ore au fișă</p>
      <ul class="lic-ore">${randuri}</ul>
    </div>`;
}

/** Lista simplă de fișe, pentru clasele fără înșiruirea orelor. */
function listaFiselor(fise) {
  return `<ul class="lic-ore">${fise.map((f) => `
    <li><a class="lic-ora" href="#/f/${esc(f.id)}">
      <span class="lic-ora__nr">Ora ${f.ora}</span>
      <span class="lic-ora__ce"><b>${esc(f.titlu)}</b>
        <small>${esc(FELUL_FISEI[f.fel]?.ce || "")}</small></span>
      <span class="lic-ora__semn">${esc(f.fel)}</span>
    </a></li>`).join("")}</ul>`;
}

/**
 * O fișă, arătată NEATINSĂ.
 *
 * Într-un `<iframe>`, nu desfăcută și pusă la loc de mine: fișierele lui Marius
 * își poartă singure stilurile și scripturile. Lipite de-a dreptul în pagină,
 * stilurile lor s-ar fi bătut cu ale modulului în amândouă sensurile — ale lui
 * ar fi stricat cardul, iar ale mele i-ar fi schimbat fișa pe care o arată la
 * clasă. Cadrul le ține fiecare la ea acasă.
 */
function vedereDeFisa(f) {
  return `
    <div class="lic-fisa">
      <div class="lic-fisa__bar">
        <span class="lic-fisa__titlu">
          <b>${esc(f.clasa)} · Ora ${f.ora}</b>
          <small>${esc(f.titlu)}</small>
        </span>
        <a class="lic-btn" href="${adresaFisei(f, caleaSitului)}" target="_blank" rel="noopener"
           title="Deschide fișa singură, într-o filă nouă">Singură ↗</a>
      </div>
      <iframe class="lic-fisa__cadru" src="${adresaFisei(f, caleaSitului)}"
        title="${esc(f.titlu)}"></iframe>
    </div>`;
}

function cuprinsHtml() {
  try {
    if (rutaE("f")) {
      const f = fisaDupaId(rutaId());
      if (f) return vedereDeFisa(f);
    }
    if (rutaE("v")) {
      const v = vedereaDupaId(rutaId());
      if (v) return v.desen();
    }
    return cartonaseHtml();
  } catch (err) {
    console.error("[liceu]", err);
    return `<div class="lic-gol"><p>Ecranul ăsta n-a putut fi afișat.</p></div>`;
  }
}

function deseneaza() {
  const acasa = stare.adancime === 0;
  /* O fișă umple cuprinsul până la margini: fără marginile lui interioare și
     fără derularea lui, fiindcă fișa își are derularea ei, în cadru. */
  radacina.classList.toggle("lic--fisa", rutaE("f"));
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
      aria-valuemin="0" aria-valuenow="${stare.latime}"><i aria-hidden="true"></i></div>

    <main class="lic-cuprins" id="lic-cuprins">${cuprinsHtml()}</main>`;

  aplicaLatimea();
  legaManerul(radacina.querySelector("[data-rol='maner']"));
}

/**
 * Casa cardului cu ora, făcută O SINGURĂ DATĂ și lipită de `<body>`, nu în
 * modul.
 *
 * Două motive, amândouă pățite:
 *   · `deseneaza()` rescrie tot ce e în modul; dacă locuia acolo, cardul ar fi
 *     fost ucis la fiecare schimbare de ecran, iar ceasul lui ar fi rămas să
 *     bată într-un nod rupt din pagină;
 *   · e `position: fixed`, iar un `transform` pe orice părinte ar fi rupt
 *     fixarea și l-ar fi pus să se plimbe cu pagina.
 */
function faCardul() {
  if (card) return;
  const casa = document.createElement("div");
  casa.className = "lic-orcard";
  casa.id = "lic-orcard";
  document.body.appendChild(casa);
  card = hourCard(casa, oraDeArata);
}

/* Orarul, adus o dată la deschiderea paginii. Cardul îl întreabă de o sută de
   ori pe minut (are un ceas care bate la secundă), deci n-are cum să ceară
   serverul de fiecare dată: ce s-a adus stă aici, iar socoteala „ce oră e acum"
   se face în browser, din datele astea. */
const orarul = { zi: null, ore: [], saptamana: [], intervale: [], adus: false };

async function aduOrarul() {
  const azi = ziuaISO();
  const [z, s, c] = await Promise.all([fetchZiua(azi), fetchSaptamana(), fetchConfig()]);
  orarul.zi = azi;
  orarul.ore = z.date || [];
  orarul.saptamana = s.date || [];
  orarul.intervale = (c.date || {}).intervale || [];
  /* Fără intervale nu se poate socoti nimic: ceasurile orelor vin din ele. Dacă
     lipsesc (baza încă nu e umplută), cardul rămâne cu ceasul lui și spune
     cinstit că n-are orar, în loc să arate o zi goală ca și cum ar fi liber. */
  orarul.adus = orarul.intervale.length > 0;
  if (card) card.improspateaza();
}

/**
 * Ce arată cardul. Se cheamă din secundă în secundă, deci nu atinge rețeaua:
 * socotește din ce s-a adus la deschidere.
 *
 * ZIUA SE POATE SCHIMBA SUB NOI. Tabla din clasă stă aprinsă și peste noapte;
 * dacă pagina rămâne deschisă, la miezul nopții orele de „azi" ar fi ale zilei
 * de ieri. Când data nu se mai potrivește, se cere ziua nouă.
 */
function oraDeArata() {
  if (!orarul.adus) return null;
  const azi = ziuaISO();
  if (azi !== orarul.zi) { orarul.zi = azi; aduOrarul(); }
  return stareaDeAcum({
    acum: new Date(),
    oreleZilei: orarul.ore,
    saptamana: orarul.saptamana,
    intervale: orarul.intervale,
  });
}

/* ---------------- apăsările ---------------- */

function apasa(e) {
  /* LEGĂTURILE DINĂUNTRU TREC TOT PRIN `navigheaza`. O legătură `#/...` apăsată
     de-a dreptul ar schimba adresa fără să treacă pe la noi: pagina nu s-ar
     redesena, iar adâncimea n-ar crește, deci săgeata „Înapoi" ar minți. Le
     prindem aici și le trimitem pe același drum ca butoanele. */
  const a = e.target.closest('a[href^="#/"]');
  if (a && radacina.contains(a)) {
    e.preventDefault();
    navigheaza(a.getAttribute("href").slice(2));
    return;
  }

  const b = e.target.closest("[data-act]");
  if (!b || !radacina.contains(b)) return;
  const act = b.dataset.act;
  if (act === "inapoi") { inapoi(); return; }
  if (act === "burger") { strange(!stare.strans); return; }
  if (act === "vedere") { navigheaza(`v/${b.dataset.id}`); }
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

  /* LĂȚIMEA ȚINUTĂ MINTE, cu grijă la amândouă capetele.
       · un ZERO salvat e o lățime adevărată (ai tras panoul închis), deci nu se
         poate folosi `|| LAT_START`: ar fi redeschis panoul la fiecare intrare;
       · dar nici `Number(...)` de-a dreptul: la prima intrare nu e nimic salvat,
         iar `Number(null)` dă tot zero, deci panoul s-ar fi născut închis.
     Se întreabă întâi dacă E un număr, apoi cât e. */
  const salvata = iaLocal(CHEIE_LAT, null);
  stare.latime = typeof salvata === "number" && Number.isFinite(salvata) && salvata >= 0
    ? salvata
    : LAT_START;
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

  /* Fereastra s-a schimbat: punem cât încape acum, fără să atingem alegerea. */
  window.addEventListener("resize", aplicaLatimea);

  deseneaza();
  /* Strângerea se pune DUPĂ primul desen: `strange` caută butonul în pagină. */
  strange(iaLocal(CHEIE_STRANS, false) === true);
  faCardul();
  /* Orarul vine pe urmă, fără să țină pagina în loc: cardul se arată cu ceasul
     lui, iar când datele ajung se împrospătează singur. */
  aduOrarul().catch((e) => console.warn("[liceu] orarul:", e));
}

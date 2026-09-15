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
//    O singură excepție, la vederile cu `inapoiAcasa` (deocamdată orarul): din
//    ele săgeata duce la clase. Motivul e scris la `inapoi()`.
//
// 3. LĂȚIMEA PANOULUI E A CONTULUI, nu a browserului. Trece prin `punLocal`,
//    care lipește numele contului la cheie: doi oameni pe același calculator
//    nu-și mută unul altuia panoul. (Pățania din `session.js`.)
// Cuprins în română, nume în engleză.
// =========================================================
import { iaLocal, punLocal } from "../../shared/scripts/session.js";
import { CLASE } from "./classes.js";
import { hourCard } from "./hour-card.js";
import { stareaDeAcum, numeZi, minute, ora2, LUCRATOARE } from "./school-time.js";
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
/* `inapoiAcasa` = din vederea asta, săgeata duce la cartonașele claselor, nu la
   ecranul de dinainte. E scris ca însușire a vederii, nu ghicit din `id`, ca
   butoanele care vor veni în panou să aleagă fiecare pentru ea. */
const VEDERI = [
  { id: "orar", nume: "Orar", desen: () => vedereDeOrar(), inapoiAcasa: true },
  /* Clasele au alt drum spre ele — cartonașele de pe ecranul de pornire — deci
     nu se mai înșiră și în panou: ar fi fost aceeași listă de două ori. */
  ...CLASE.map((c) => ({
    id: `clasa-${c.cod.toLowerCase()}`,
    nume: c.cod,
    ascunsaInPanou: true,
    desen: () => vedereDeClasa(c),
  })),
];

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

/** Vederea deschisă acum, dacă e o vedere (nu o fișă, nu ecranul de pornire). */
const vedereaDeAcum = () => (rutaE("v") ? vedereaDupaId(rutaId()) : null);

/**
 * Săgeata din colțul de sus-stânga. Cât timp am pași în urmă, scoate câte unul;
 * când s-a golit, iese din modul.
 *
 * ORARUL FACE EXCEPȚIE (`inapoiAcasa`). El se deschide dintr-un buton al
 * panoului, deci se ajunge în el de oriunde: de pe cartonașe, dintr-o clasă,
 * din mijlocul unei fișe. „Unde am fost" ar fi însemnat, de acolo, orice, iar
 * săgeata ar fi dus de fiecare dată în altă parte. Din orar duce la clase.
 *
 * Pasul orarului se ÎNLOCUIEȘTE, nu se pune altul peste el. Cu un pas nou,
 * Back-ul browserului te-ar fi întors în orar, de unde săgeata te-ar fi scos
 * iarăși la clase: un du-te-vino fără capăt. Înlocuit, orarul iese din teanc,
 * iar cele două săgeți — a noastră și a browserului — rămân de acord, cum spune
 * regula 2 din capul fișierului.
 */
function inapoi() {
  if (vedereaDeAcum()?.inapoiAcasa) {
    stare.vedere = null;
    history.replaceState({ liceu: stare.adancime }, "", hashPentru(null));
    deseneaza();
    return;
  }
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
      ${g.vederi.map((v) => {
        /* Ruta e „v/orar", butonul poartă doar „orar": se compară partea de
           după fel, nu textul întreg. */
        const aici = rutaE("v") && rutaId() === v.id;
        return `
        <button type="button" class="lic-buton${aici ? " on" : ""}"
          data-act="vedere" data-id="${esc(v.id)}"
          ${aici ? 'aria-current="page"' : ""}>${esc(v.nume)}</button>`;
      }).join("")}
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

/* ---------------- ecranul: orarul săptămânii ---------------- */

const ZI_LUNG = {
  luni: "Luni", marti: "Marți", miercuri: "Miercuri", joi: "Joi", vineri: "Vineri",
};

/**
 * Luni–vineri, cu datele lor, pentru săptămâna pe care o arată grila.
 *
 * Orarul se repetă de la o săptămână la alta, dar numărul orei din planificare
 * nu: aceeași casetă de marți e a patra oră săptămâna asta și a noua peste
 * două. Numărul cere, deci, o DATĂ, nu doar o zi a săptămânii.
 *
 * Sâmbăta și duminica se arată săptămâna care VINE: în weekend te uiți în orar
 * ca să-ți pregătești luni, nu ca să vezi ce-a fost vineri.
 */
function zileleSaptamanii(acum = new Date()) {
  const d = new Date(acum.getFullYear(), acum.getMonth(), acum.getDate());
  const aCata = d.getDay() === 0 ? 7 : d.getDay();   // duminică = 7, ca în bază
  d.setDate(d.getDate() + (aCata >= 6 ? 8 - aCata : 1 - aCata));
  return LUCRATOARE.map((z, i) => {
    const zi = new Date(d);
    zi.setDate(d.getDate() + i);
    return { zi: z, data: ziuaISO(zi) };
  });
}

/** „14–18 septembrie", ori „28 septembrie – 2 octombrie" peste pragul lunii. */
function spanulZilelor(a, b) {
  try {
    const x = new Date(`${a}T00:00:00`);
    const y = new Date(`${b}T00:00:00`);
    const luna = (d) => d.toLocaleDateString("ro-RO", { month: "long" });
    return x.getMonth() === y.getMonth()
      ? `${x.getDate()}–${y.getDate()} ${luna(y)}`
      : `${x.getDate()} ${luna(x)} – ${y.getDate()} ${luna(y)}`;
  } catch { return ""; }
}

/**
 * Numerele „5/95" ale săptămânii, gata de căutat pe celulă.
 *
 * Cheia e `clasa|data|ceas`, adică exact îmbinarea pe care o face și funcția din
 * bază: planificarea se leagă de orar pe clasă, pe ziua din calendar și pe
 * ceasul de început. `ora` din planificare e scrisă neîmpodobită („8:00", nu
 * „08:00"), la fel ca `start`-ul intervalului, deci cele două se potrivesc de-a
 * dreptul; `ora2()` e numai pentru citit, nu pentru potrivit.
 *
 * Numitorul e numărul de rânduri din planificarea clasei. Am verificat pe bază
 * că e același cu `school_plan_meta.totaluri.ore` la toate șapte clasele, deci
 * n-am mai adus încă un tabel pentru o cifră pe care o am deja.
 */
function numereleSaptamanii(zile) {
  const aleSaptamanii = new Set(zile.map((z) => z.data));
  const harta = new Map();
  for (const c of CLASE) {
    const p = planuri[c.cod];
    if (!p || p.seAduce || !p.ore.length) continue;
    const total = p.ore.length;
    for (const o of p.ore) {
      if (aleSaptamanii.has(o.data)) harta.set(`${c.cod}|${o.data}|${o.ora}`, { nr: o.nr, total });
    }
  }
  return harta;
}

/**
 * Grila orarului: zilele pe orizontală, ceasurile pe verticală.
 *
 * Se arată NUMAI intervalele în care chiar ai ore. Școala are treisprezece, tu
 * ai ore în șase; un tabel cu șapte rânduri goale nu spune nimic și împinge
 * restul afară din ecran.
 *
 * Orarul se desenează pe loc, din ce s-a adus la deschiderea paginii. Numerele
 * din colțul celulelor vin pe urmă, din planificări, și se așază singure când
 * sosesc: grila nu așteaptă după ele.
 */
function vedereDeOrar() {
  const ore = orarul.saptamana;
  const iv = orarul.intervale;
  if (!ore.length || !iv.length) {
    return `<div class="lic-orar"><h1 class="lic-orar__titlu">Orar</h1>
      <p class="lic-clasa__gol">Orarul n-a fost adus.</p></div>`;
  }

  const folosite = iv
    .filter((i) => ore.some((o) => String(o.period) === String(i.id)))
    .sort((a, b) => minute(a.start) - minute(b.start));

  const pe = new Map(ore.map((o) => [`${o.zi}|${o.period}`, o]));
  const azi = numeZi(new Date());
  const m = new Date().getHours() * 60 + new Date().getMinutes();
  const culoarea = (cod) => CLASE.find((c) => c.cod === cod)?.hue ?? 250;

  /* Planificările tuturor claselor din grilă: din ele iese numărul din colțul
     fiecărei celule. Se cer o dată și rămân ținute minte, iar până sosesc grila
     se vede întreagă, doar fără numere — nu ține nimic în loc. */
  const zile = zileleSaptamanii();
  CLASE.forEach((c) => { if (!planuri[c.cod]) aduPlanul(c.cod); });
  const numere = numereleSaptamanii(zile);

  const cap = `<tr><th class="lic-orar__colt"></th>${
    zile.map(({ zi }) => `<th class="lic-orar__zi${zi === azi ? " azi" : ""}">${ZI_LUNG[zi]}</th>`).join("")
  }</tr>`;

  const randuri = folosite.map((i) => {
    const acum = m >= minute(i.start) && m < minute(i.end);
    return `<tr class="${acum ? "acum" : ""}">
      <th class="lic-orar__ceas"><b>${esc(ora2(i.start))}</b><small>${esc(ora2(i.end))}</small></th>
      ${zile.map(({ zi, data }) => {
        const o = pe.get(`${zi}|${i.id}`);
        if (!o) return `<td class="lic-orar__gol"></td>`;
        /* Zilele fără număr sunt zilele fără oră în planificare: vacanțe,
           sărbători, săptămâna dinaintea orarului ăstuia. Celula rămâne
           întreagă, doar fără cifra din colț. */
        const n = numere.get(`${o.clasa}|${data}|${i.start}`);
        return `<td class="lic-orar__cel${zi === azi ? " azi" : ""}" style="--h:${culoarea(o.clasa)}">
          <a href="#/v/clasa-${esc(o.clasa.toLowerCase())}">
            <b>${esc(o.clasa)}</b>${o.sala ? `<small>${esc(String(o.sala).toUpperCase())}</small>` : ""}
            ${n ? `<i class="lic-orar__nr"
                     title="A ${n.nr}-a oră din cele ${n.total} la ${esc(o.clasa)}">${n.nr}/${n.total}</i>` : ""}
          </a></td>`;
      }).join("")}
    </tr>`;
  }).join("");

  /* Săptămâna e scrisă: fără ea, „5/95" ar sta pe o grilă care arată la fel în
     toate săptămânile anului și n-ar spune al cui e numărul. */
  const span = spanulZilelor(zile[0].data, zile[zile.length - 1].data);
  return `
    <div class="lic-orar">
      <h1 class="lic-orar__titlu">Orar</h1>
      <p class="lic-orar__sub">${ore.length} ore pe săptămână${
        span ? ` · ${esc(span)}` : ""}. Apeși o oră și intri la clasa ei.</p>
      <div class="lic-orar__vas">
        <table class="lic-orar__t"><thead>${cap}</thead><tbody>${randuri}</tbody></table>
      </div>
    </div>`;
}

/* Planificările cerute pe parcurs, ținute ca să nu se ceară de două ori. */
const planuri = {};

async function aduPlanul(clasa) {
  if (planuri[clasa]) return;
  planuri[clasa] = { seAduce: true, ore: [] };
  const r = await fetchPlan(clasa);
  planuri[clasa] = { seAduce: false, ore: r.date || [] };
  /* Dacă între timp ai plecat pe alt ecran, nu-l smulgem de sub tine. Orarul
     intră și el la socoteală: numerele din colțul celulelor vin din aceleași
     planificări, deci grila se umple pe măsură ce sosesc. */
  const unde = rutaId();
  if (rutaE("v") && (unde === `clasa-${clasa.toLowerCase()}` || unde === "orar")) cereDesen();
}

/* UN SINGUR DESEN LA MAI MULTE VENIRI. Orarul cere deodată planificările tuturor
   celor șapte clase; dacă fiecare ar fi cerut desenul ei, ecranul s-ar fi rescris
   de șapte ori într-o secundă, cu clipit cu tot. Cererile se strâng într-una
   singură, pe cadrul următor. */
let desenCerut = false;
function cereDesen() {
  if (desenCerut) return;
  desenCerut = true;
  requestAnimationFrame(() => { desenCerut = false; deseneaza(); });
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
 * Clasele cu `faraOre` nu înșiră nimic: rămân doar fișele, dacă au vreuna. Acum
 * n-o poartă niciuna (vezi `classes.js`), dar ecranul știe s-o facă.
 */
function vedereDeClasa(c) {
  const fise = fiseleClasei(c.cod);
  /* O fișă poate ține mai multe ore (o lecție întinsă pe o săptămână), deci se
     așază pe fiecare dintre ele: din oricare oră a Luceafărului se deschide
     același poem. */
  const peOra = new Map();
  fise.forEach((f) => f.ore.forEach((o) => peOra.set(o, f)));

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
      <span class="lic-ora__semn">${esc(f?.fel)}</span>`;
    return `
      ${nouaUnitate ? `<li class="lic-unit">${esc(o.unitatea)}</li>` : ""}
      <li>${f
        ? `<a class="lic-ora" href="#/f/${esc(f.id)}"
             title="${esc(vorbaFisei(f))}">${cuprins}</a>`
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

/** Ce scrie pe fișă când treci peste ea. Litera spune cel mai mult, dar nu toate
 *  fișele au una (vezi `fise.js`); atunci vorbește titlul ei. */
const vorbaFisei = (f) => FELUL_FISEI[f?.fel]?.ce || f?.titlu || "";

/** Lista simplă de fișe, pentru clasele fără înșiruirea orelor. */
function listaFiselor(fise) {
  return `<ul class="lic-ore">${fise.map((f) => `
    <li><a class="lic-ora" href="#/f/${esc(f.id)}">
      <span class="lic-ora__nr">${f.ore.length > 1 ? `Orele ${f.ore.join(", ")}` : `Ora ${f.ora}`}</span>
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
 *
 * `?in=liceu` e singurul lucru pe care i-l spune modulul fișei: „ești arătată
 * înăuntru". Fișa face ce vrea cu vorba asta ori o trece cu vederea — cele trei
 * prezentări n-o bagă în seamă, Luceafărul se face străveziu ca să stea pe
 * culoarea modulului, nu pe a lui. Semnul se pune NUMAI pe cadru; „Singură ↗"
 * deschide fișa curată, așa cum e ea pe sit.
 */
function vedereDeFisa(f) {
  return `
    <div class="lic-fisa">
      <div class="lic-fisa__bar">
        <span class="lic-fisa__titlu">
          <b>${esc(f.clasa)} · ${f.ore.length > 1 ? `Orele ${esc(f.ore.join(", "))}` : `Ora ${f.ora}`}</b>
          <small>${esc(f.titlu)}</small>
        </span>
        <a class="lic-btn" href="${adresaFisei(f, caleaSitului)}" target="_blank" rel="noopener"
           title="Deschide fișa singură, într-o filă nouă">Singură ↗</a>
      </div>
      <iframe class="lic-fisa__cadru" src="${adresaFisei(f, caleaSitului)}?in=liceu"
        allow="fullscreen" allowfullscreen
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
  /* Săgeata spune unde duce, nu doar că duce undeva. Trei vorbe, în ordinea
     asta: din orar scoate la clase; din restul scoate un pas; când teancul e
     gol, scoate din modul. */
  const vorbaInapoi = vedereaDeAcum()?.inapoiAcasa
    ? "Înapoi la clase"
    : (stare.adancime === 0 ? "Înapoi la site" : "Înapoi");
  /* Două ecrane umplu cuprinsul până la margini, fiecare din alt motiv:
     fișa fiindcă își are derularea ei, în cadru; ecranul de pornire fiindcă
     fundalul lui colorat trebuie să ajungă în toate colțurile, iar cartonașele
     stau pe mijloc, și pe orizontală, și pe verticală. */
  radacina.classList.toggle("lic--fisa", rutaE("f"));
  radacina.classList.toggle("lic--acasa", !stare.vedere);
  radacina.innerHTML = `
    <div class="lic-sus">
      <button type="button" class="lic-inapoi" data-act="inapoi"
        title="${vorbaInapoi}">
        ${SAGEATA}<span>${vorbaInapoi}</span>
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
/**
 * CE FEL DE CARD SE CERE AICI.
 *
 * Peste o fișă, cardul întreg stă în drum: fișa e o prezentare ținută la clasă,
 * iar de pe ea n-ai nevoie decât de ceas și de cât mai e până la pauză. Pe tot
 * ecranul, chiar și atâta trebuie să se dea la o parte din calea degetului.
 *
 * `document.fullscreenElement` se uită în pagina GAZDĂ. Când fișa cere ecranul
 * plin din interiorul cadrului, cel trecut pe tot ecranul e chiar `<iframe>`-ul,
 * deci tot aici se vede. `webkitFullscreenElement` e pentru browserele mai
 * vechi, care n-au prins încă numele fără prefix.
 */
function felulCardului() {
  if (!rutaE("f")) return "plin";
  const plin = document.fullscreenElement || document.webkitFullscreenElement || null;
  return plin ? "fantoma" : "prezentare";
}

function faCardul() {
  if (card) return;
  const casa = document.createElement("div");
  casa.className = "lic-orcard";
  casa.id = "lic-orcard";
  document.body.appendChild(casa);
  card = hourCard(casa, oraDeArata, felulCardului);
  /* Intrarea și ieșirea din ecranul plin, prinse pe loc. Cardul își verifică
     modul și singur, o dată pe secundă, dar o secundă de card larg peste un
     slide se vede. */
  const schimbat = () => card && card.improspateaza();
  document.addEventListener("fullscreenchange", schimbat);
  document.addEventListener("webkitfullscreenchange", schimbat);
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
  /* Dacă tocmai te uitai la grila orarului cât se aduceau datele, se redesenează
     ca s-o vezi plină, nu cu „orarul n-a fost adus". */
  if (rutaE("v") && rutaId() === "orar") deseneaza();
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

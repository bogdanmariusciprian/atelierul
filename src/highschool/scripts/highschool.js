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
//    prima apăsare pe Back.
//    Două locuri fac excepție, și amândouă duc la ecranul cu clasele: orarul
//    (și orice vedere cu `inapoiAcasa`), fiindcă se ajunge în el de oriunde; și
//    un ecran deschis de-a dreptul pe adresa lui, fiindcă de-acolo n-ai fost
//    nicăieri înăuntru.
//    Iar ECRANUL CU CLASELE E RĂDĂCINA: de pe el se iese la sit, oricum ai fi
//    ajuns acolo. Toate trei sunt scrise într-un singur loc, `sageataInapoi()`.
//
// 3. LĂȚIMEA PANOULUI E A CONTULUI, nu a browserului. Trece prin `punLocal`,
//    care lipește numele contului la cheie: doi oameni pe același calculator
//    nu-și mută unul altuia panoul. (Pățania din `session.js`.)
// Cuprins în română, nume în engleză.
// =========================================================
import { iaLocal, punLocal, isAdmin } from "../../shared/scripts/session.js";
import { aduLiceuDeschis } from "../../shared/scripts/liceu-gate.js";
import { CLASE } from "./classes.js";
import { hourCard } from "./hour-card.js";
import { stareaDeAcum, numeZi, minute, ora2, LUCRATOARE } from "./school-time.js";
import {
  fetchZiua, fetchOrarul, fetchConfig, fetchPlan, fetchFisa,
  salveazaFisa, stergeFisa, ziuaISO,
} from "./liceu-repo.js";
import {
  aduFisele, fiseleClasei, fisaDupaId, adresaFisei, cheiaFisei, cheiaNoua, FELUL_FISEI,
} from "./fise.js";
import { puntea, vorbaPuntii } from "./fisa-punte.js";
import { telecomanda, MAX_JURNAL } from "./telecomanda.js";
import { cePunem } from "./jurnal.js";
import { cuAcelasiZar } from "./zarul.js";

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
  /* Clasele au alt drum spre ele – cartonașele de pe ecranul de pornire – deci
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
  /* Săptămâna la care te uiți în grilă, ca luni a ei („2026-09-21"). `null` =
     săptămâna de acum. Umblatul prin ele nu schimbă nimic altundeva – nici
     cardul, nici listele claselor, nici adresa din bara browserului. De-aia stă
     aici, în stare, și nu în rută.
     Săptămâna a luat locul orarului: mergând din săptămână în săptămână treci
     oricum prin toate orarele anului, iar eticheta îți spune pe care ești. Două
     perechi de săgeți, una pentru orare și una pentru săptămâni, ar fi cerut să
     ții minte care ce face. */
  saptamanaAleasa: null,
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
 * CE FACE SĂGEATA din colțul de sus-stânga, și ce scrie pe ea – dintr-un singur
 * loc. Vorba și fapta se scriau în două locuri, și tocmai asta le-a despărțit o
 * dată: butonul spunea „Înapoi" pe ecranul cu clasele, dar de-acolo n-avea unde
 * să se întoarcă.
 *
 * Trei feluri, în ordinea în care se întreabă:
 *
 * 1. ECRANUL CU CLASELE E RĂDĂCINA MODULULUI. De-acolo se iese la sit, și nu se
 *    mai numără pașii: „Clasele mele" înseamnă capăt, oricum ai ajuns la el.
 *
 * 2. ORARUL (și orice vedere cu `inapoiAcasa`) duce la clase. El se deschide
 *    dintr-un buton al panoului, deci se ajunge în el de oriunde – de pe
 *    cartonașe, dintr-o clasă, din mijlocul unei fișe – iar „unde am fost" ar fi
 *    însemnat, de acolo, orice.
 *
 * 3. CINE A INTRAT DE-A DREPTUL pe adresa unui ecran (dintr-un mesaj, dintr-un
 *    favorit) n-a fost nicăieri înăuntru: „un pas în urmă" l-ar fi scos din sit
 *    de la prima apăsare. Duce tot la clase.
 *
 * În rest, un pas în urmă, prin chiar istoria browserului.
 */
function sageataInapoi() {
  if (!stare.vedere) return { vorba: "Înapoi la site", fel: "sit" };
  if (vedereaDeAcum()?.inapoiAcasa) return { vorba: "Înapoi la clase", fel: "clase" };
  if (stare.adancime === 0) return { vorba: "Înapoi la clase", fel: "clase" };
  return { vorba: "Înapoi", fel: "pas" };
}

function inapoi() {
  const { fel } = sageataInapoi();
  if (fel === "sit") { location.href = caleaSitului || "/"; return; }
  if (fel === "clase") {
    /* Pasul se ÎNLOCUIEȘTE, nu se pune altul peste el. Cu un pas nou, Back-ul
       browserului te-ar fi întors de unde tocmai ai plecat, de unde săgeata
       te-ar fi scos iarăși la clase: un du-te-vino fără capăt. Înlocuit, ecranul
       iese din teanc. */
    stare.vedere = null;
    history.replaceState({ liceu: stare.adancime }, "", hashPentru(null));
    deseneaza();
    return;
  }
  history.back();
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
   degetul iese de pe el – altfel, tras repede, panoul rămânea în urmă și se
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

/* CÂND SE ÎNTOARCE PAGINA, vineri seara. Cerut de Marius: la ceasul ăsta
   săptămâna s-a încheiat, iar orarul pe care vrea să-l vadă e al celei care
   vine. Zece minute înainte de miezul nopții, nu la miezul nopții, fiindcă
   vineri seara se pregătește lunea. */
const VINERI_SEARA = 23 * 60 + 50;

/**
 * Luni–vineri, cu datele lor, pentru săptămâna pe care o arată grila.
 *
 * Orarul se repetă de la o săptămână la alta, dar numărul orei din planificare
 * nu: aceeași casetă de marți e a patra oră săptămâna asta și a noua peste
 * două. Numărul cere, deci, o DATĂ, nu doar o zi a săptămânii.
 *
 * SE TRECE LA SĂPTĂMÂNA CARE VINE vineri de la 23:50, și rămâne așa toată
 * sâmbăta și duminica: de-atunci încolo, cine se uită în orar se uită ca să-și
 * pregătească lunea, nu ca să vadă ce-a fost.
 */
/** Cele cinci zile lucrătoare care încep la lunea dată. */
function zileleDeLa(luni) {
  const d = new Date(`${luni}T12:00:00`);
  return LUCRATOARE.map((z, i) => {
    const zi = new Date(d);
    zi.setDate(d.getDate() + i);
    return { zi: z, data: ziuaISO(zi) };
  });
}

function zileleSaptamanii(acum = new Date()) {
  const d = new Date(acum.getFullYear(), acum.getMonth(), acum.getDate());
  const aCata = d.getDay() === 0 ? 7 : d.getDay();   // duminică = 7, ca în bază
  const minutul = acum.getHours() * 60 + acum.getMinutes();
  const sEncheiat = aCata >= 6 || (aCata === 5 && minutul >= VINERI_SEARA);
  /* `8 - aCata` duce la lunea care vine, și merge la fel pentru vineri (+3),
     sâmbătă (+2) și duminică (+1). `1 - aCata` duce la lunea săptămânii de acum. */
  d.setDate(d.getDate() + (sEncheiat ? 8 - aCata : 1 - aCata));
  return zileleDeLa(ziuaISO(d));
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

/** Lunea săptămânii de acum, cea de la care pornește grila. */
const luneaDeAcum = () => zileleSaptamanii()[0].data;

/** Lunea săptămânii arătate: cea aleasă cu săgețile, ori cea de acum. */
const luneaDinGrila = () => stare.saptamanaAleasa || luneaDeAcum();

/** Lunea de peste `cate` săptămâni față de `luni`. */
function luneaDeLanga(luni, cate) {
  const d = new Date(`${luni}T12:00:00`);
  d.setDate(d.getDate() + cate * 7);
  return ziuaISO(d);
}

/**
 * Cât de departe se poate umbla: de la săptămâna primului orar până la
 * săptămâna ultimei ore din planificări.
 *
 * Dincolo de capete nu e nimic de văzut – nici orar, nici numere – iar o grilă
 * goală, la care ai ajuns apăsând o săgeată, se citește ca o stricăciune. Mai
 * bine nu se apasă.
 */
function margini() {
  const primulOrar = (orarul.orare || [])[0]?.din || null;
  const stanga = primulOrar ? zileleSaptamanii(new Date(`${primulOrar}T12:00:00`))[0].data : null;
  let ultima = "";
  for (const c of CLASE) {
    const p = planuri[c.cod];
    if (!p || p.seAduce) continue;
    for (const o of p.ore) if (o.data > ultima) ultima = o.data;
  }
  const dreapta = ultima ? zileleSaptamanii(new Date(`${ultima}T12:00:00`))[0].data : null;
  return { stanga, dreapta };
}

/* Semnul fișei, în colțul celulei. O foaie cu un colț îndoit: se citește ca
   „aici e ceva de deschis", nu ca încă o cifră. */
const FISA_SEMN = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  ><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>`;

/** „21 – 25 sept." ori „28 sept. – 2 oct.", scurt, pentru urechile filei. */
function spanScurt(luni) {
  const z = zileleDeLa(luni);
  try {
    const a = new Date(`${z[0].data}T12:00:00`);
    const b = new Date(`${z[4].data}T12:00:00`);
    const l = (d) => d.toLocaleDateString("ro-RO", { month: "short" }).replace(/\.$/, "");
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()}–${b.getDate()} ${l(b)}`
      : `${a.getDate()} ${l(a)} – ${b.getDate()} ${l(b)}`;
  } catch { return ""; }
}

/**
 * Antetul orarului: titlul centrat, iar sub el săptămâna ca o FILĂ DE DOSAR, cu
 * urechile săptămânilor vecine ieșind de sub ea.
 *
 * DE CE URECHI, și nu două săgeți. O săgeată spune doar „mai e ceva acolo".
 * Urechea spune CE e acolo – „14–18 sept." – deci știi unde ajungi înainte să
 * apeși, și știi unde ești fără să citești data din mijloc. Pe tablă, unde
 * apeși cu degetul și nu revii ușor dintr-o apăsare greșită, asta contează.
 *
 * FILA CURENTĂ E COLORATĂ ȘI SCRIE „acum". Când ai plecat de pe ea, fila se
 * face searbădă și răsare calea de întoarcere. Starea se vede din culoare, nu
 * dintr-o vorbă pe care trebuie s-o cauți.
 *
 * Nu schimbă nimic altundeva în modul: nici cardul cu ora, nici listele
 * claselor, nici adresa din bara browserului. E o privire, nu o unealtă.
 */
function randulDeSusAlOrarului(peZi, span, zile) {
  const etichete = [...new Set(peZi.map((z) => z.eticheta).filter(Boolean))];
  const luni = luneaDinGrila();
  const { stanga, dreapta } = margini();
  const eDeAcum = stare.saptamanaAleasa === null;
  const sapt = saptamanaDeScoala(zile);

  const potInapoi = !(stanga && luni <= stanga);
  const potInainte = !(dreapta && luni >= dreapta);

  const ureche = (incotro, cate) => {
    const se = incotro === "sapt-inapoi" ? potInapoi : potInainte;
    if (!se) return `<span class="lic-fila__ureche lic-fila__ureche--stinsa" aria-hidden="true"></span>`;
    const vecina = spanScurt(luneaDeLanga(luni, cate));
    return `<button type="button" class="lic-fila__ureche" data-act="${incotro}"
      title="${incotro === "sapt-inapoi" ? "Săptămâna de dinainte" : "Săptămâna de după"}">${esc(vecina)}</button>`;
  };

  return `
    <div class="lic-antet">
      <h1 class="lic-orar__titlu">Orar</h1>
      ${etichete.length
        ? `<p class="lic-antet__orar">${etichete.map(esc).join(" + ")}</p>`
        : ""}

      <div class="lic-file">
        ${ureche("sapt-inapoi", -1)}
        <div class="lic-fila${eDeAcum ? " lic-fila--acum" : ""}">
          <span class="lic-fila__sus">
            ${sapt ? `săptămâna ${sapt.nr}` : "în afara cursurilor"}${eDeAcum ? " · acum" : ""}
          </span>
          <b class="lic-fila__span">${esc(span)}</b>
        </div>
        ${ureche("sapt-inainte", 1)}
      </div>
      <div class="lic-file__dunga${eDeAcum ? " lic-file__dunga--acum" : ""}"></div>

      ${eDeAcum ? "" : `<p class="lic-antet__revino">
        <button type="button" class="lic-orare__azi" data-act="sapt-acum">
          înapoi la săptămâna aceasta</button></p>`}
    </div>`;
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
  const iv = orarul.intervale;

  /* SĂPTĂMÂNA ARĂTATĂ: cea de acum, ori cea la care ai umblat cu săgețile. */
  const zile = zileleDeLa(luneaDinGrila());

  /* FIECARE ZI ÎȘI ARE ORARUL EI. Nu „orarul de azi": duminica, grila arată
     săptămâna care vine, iar aceea poate merge pe alt orar decât cel de acum.
     Așa se vede cum trebuie și o schimbare picată în mijlocul săptămânii. */
  const peZi = zile.map(({ zi, data }) => {
    const { ore, eticheta } = orarulLa(data);
    return { zi, data, eticheta, ore: ore.filter((o) => o.zi === zi) };
  });

  if (!iv.length) {
    return `<div class="lic-orar"><h1 class="lic-orar__titlu">Orar</h1>
      <p class="lic-clasa__gol">Orarul n-a fost adus.</p></div>`;
  }
  const span = spanulZilelor(zile[0].data, zile[zile.length - 1].data);
  const felurile = new Map(zile.map(({ data }) => [data, felulZilei(data)]));

  /* ORELE SE NUMĂRĂ NUMAI PE ZILELE DE CURS. Orarul nu știe de vacanțe: pe 30
     noiembrie, care e liber, el tot spune că ai 11B la 8:00. Numărate și
     acelea, grila căpăta rânduri care nu se vedeau nicăieri (un interval
     folosit numai de o zi liberă), iar o săptămână întreagă de vacanță ar fi
     desenat cinci coloane în loc să-și spună numele. */
  const toateOrele = peZi
    .filter((z) => felurile.get(z.data).fel === "curs")
    .flatMap((z) => z.ore);

  /* O SĂPTĂMÂNĂ FĂRĂ NICIO ORĂ NU E O STRICĂCIUNE. Antetul rămâne, ca să te
     poți întoarce cu urechile filei, iar în locul grilei scrie de ce e goală –
     din structura anului, pe numele ei. Fără antet, ai fi ajuns într-o fundătură
     din care nu se mai iese. */
  if (!toateOrele.length) {
    const nume = [...new Set([...felurile.values()]
      .filter((f) => f.fel !== "curs").map((f) => f.eticheta))];
    return `
      <div class="lic-orar">
        ${randulDeSusAlOrarului(peZi, span, zile)}
        <div class="lic-gol">
          <p>${nume.length ? esc(nume.join(" · ")) : "Săptămâna asta n-are nicio oră în orar."}</p>
        </div>
      </div>`;
  }

  const folosite = iv
    .filter((i) => toateOrele.some((o) => String(o.period) === String(i.id)))
    .sort((a, b) => minute(a.start) - minute(b.start));

  const pe = new Map(peZi.flatMap((z) => z.ore.map((o) => [`${z.zi}|${o.period}`, o])));
  const aziZi = numeZi(new Date());
  const aziData = ziuaISO();
  const m = new Date().getHours() * 60 + new Date().getMinutes();
  const culoarea = (cod) => CLASE.find((c) => c.cod === cod)?.hue ?? 250;

  /* Planificările tuturor claselor din grilă: din ele iese numărul din colțul
     fiecărei celule. Se cer o dată și rămân ținute minte, iar până sosesc grila
     se vede întreagă, doar fără numere – nu ține nimic în loc. */
  CLASE.forEach((c) => { if (!planuri[c.cod]) aduPlanul(c.cod); });
  const numere = numereleSaptamanii(zile);

  /* Fișele, pe clasă și număr de oră: din ele iese semnul care duce de-a dreptul
     în material, fără să mai treci prin lista clasei. */
  const fisePeOra = new Map();
  for (const c of CLASE) {
    for (const f of fiseleClasei(c.cod)) {
      for (const o of f.ore) fisePeOra.set(`${c.cod}|${o}`, f);
    }
  }

  /* ORA CARE URMEAZĂ, însemnată numai când NU ești într-una. Cât ești la clasă,
     rândul de acum e deja aprins; două semne deodată s-ar fi bătut cap în cap. */
  let ceUrmeaza = null;
  if (zile.some((z) => z.data === aziData)) {
    const aleZilei = folosite
      .filter((i) => pe.get(`${aziZi}|${i.id}`))
      .sort((a, b) => minute(a.start) - minute(b.start));
    const acum = aleZilei.find((i) => m >= minute(i.start) && m < minute(i.end));
    if (!acum) ceUrmeaza = aleZilei.find((i) => minute(i.start) > m) || null;
  }

  const cap = `<tr><th class="lic-orar__colt"></th>${
    zile.map(({ zi, data }) => {
      const f = felurile.get(data);
      return `<th class="lic-orar__zi${zi === aziZi ? " azi" : ""}${
        f.fel === "curs" ? "" : " lic-orar__zi--liber"}">${ZI_LUNG[zi]}</th>`;
    }).join("")
  }</tr>`;

  /* Zilele libere își iau coloana o dată, pe toate rândurile: `rowspan` în
     primul rând, apoi sărite. Cinci celule goale una sub alta n-ar fi spus de ce
     sunt goale, iar asta e tot rostul. */
  const randuri = folosite.map((i, rand) => {
    const acum = m >= minute(i.start) && m < minute(i.end);
    return `<tr class="${acum ? "acum" : ""}">
      <th class="lic-orar__ceas"><b>${esc(ora2(i.start))}</b><small>${esc(ora2(i.end))}</small></th>
      ${zile.map(({ zi, data }) => {
        const felZi = felurile.get(data);
        if (felZi.fel !== "curs") {
          if (rand > 0) return "";
          return `<td class="lic-orar__liber lic-orar__liber--${esc(felZi.fel)}"
            rowspan="${folosite.length}"><span>${esc(felZi.eticheta)}</span></td>`;
        }

        const o = pe.get(`${zi}|${i.id}`);
        if (!o) return `<td class="lic-orar__gol"></td>`;

        const n = numere.get(`${o.clasa}|${data}|${i.start}`);
        const f = n ? fisePeOra.get(`${o.clasa}|${n.nr}`) : null;
        /* Trecut = zi trecută, ori azi și ora s-a încheiat. */
        const trecuta = data < aziData || (data === aziData && m >= minute(i.end));
        const urmatoarea = ceUrmeaza && data === aziData && i.id === ceUrmeaza.id;
        const peste = urmatoarea ? minute(i.start) - m : 0;

        return `<td class="lic-orar__cel${zi === aziZi ? " azi" : ""}${
          trecuta ? " lic-orar__cel--trecuta" : ""}${
          urmatoarea ? " lic-orar__cel--urmeaza" : ""}" style="--h:${culoarea(o.clasa)}">
          <a href="#/v/clasa-${esc(o.clasa.toLowerCase())}">
            <b>${esc(o.clasa)}</b>${o.sala ? `<small>${esc(String(o.sala).toUpperCase())}</small>` : ""}
            ${n ? `<i class="lic-orar__nr"
                     title="A ${n.nr}-a oră din cele ${n.total} la ${esc(o.clasa)}">${n.nr}/${n.total}</i>` : ""}
            ${urmatoarea ? `<i class="lic-orar__peste">peste ${peste} min</i>` : ""}
          </a>
          ${f ? `<button type="button" class="lic-orar__fisa" data-act="fisa-din-grila"
                   data-id="${esc(f.id)}" title="Deschide fișa: ${esc(f.titlu)}"
                   aria-label="Deschide fișa de la ${esc(o.clasa)}, ora ${n.nr}">${FISA_SEMN}</button>` : ""}
        </td>`;
      }).join("")}
    </tr>`;
  }).join("");

  return `
    <div class="lic-orar">
      ${randulDeSusAlOrarului(peZi, span, zile)}
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
    /* 11F și 12F ajung aici, și e în regulă: au câte o oră pe săptămână în orar,
       dar n-au planificare. Ecranul lor există (cerut de Marius), doar că e gol
       până apare una. */
    return `<div class="lic-clasa" style="--h:${c.hue}">${cap}
      <p class="lic-clasa__gol">Clasa asta n-are încă planificare în bază.
        Orele ei se văd în orar; lista de aici se umple când intră planificarea.</p></div>`;
  }

  /* BENZILE DE ORAR, în ordine, ca să se vadă de unde încolo s-a mutat ora.
     Prima nu se pune: „Orar – 7 sept." deasupra primei ore a anului n-ar spune
     nimic, fiindcă n-a fost niciun orar înaintea lui. */
  const benziDeOrar = (orarul.orare || []).slice(1);
  let urmatoareaBanda = 0;

  /* Un titlu de unitate la fiecare unitate nouă: o sută de rânduri la rând se
     citesc ca o listă fără capete. */
  let unitateaDeSus = null;
  const randuri = p.ore.map((o) => {
    const f = peOra.get(o.nr);
    const nouaUnitate = o.unitatea && o.unitatea !== unitateaDeSus;
    if (nouaUnitate) unitateaDeSus = o.unitatea;

    /* BANDA SE SCRIE ÎNAINTEA PRIMEI ORE CARE MERGE PE ORARUL CEL NOU, inclusiv
       când ora aceea cade fix în ziua intrării în vigoare – de-aia `<=`, nu `<`.
       E regula din documentul de predare al lui Marius (§5), unde scrie că s-a
       greșit de două ori cu `<`: banda ajungea SUB chiar ora pe care o descrie. */
    let banda = "";
    while (urmatoareaBanda < benziDeOrar.length
           && benziDeOrar[urmatoareaBanda].din <= o.data) {
      const b = benziDeOrar[urmatoareaBanda++];
      banda += `<li class="lic-banda-orar">${esc(b.eticheta || `Orar nou, din ${b.din}`)}</li>`;
    }
    const cuprins = `
      <span class="lic-ora__nr">Ora ${o.nr}</span>
      <span class="lic-ora__ce">
        <b>${o.titlu ? esc(o.titlu) : `<i>${esc(o.fel || "fără titlu")}</i>`}</b>
        <small>${ziScurta(o.data)} · ${esc(o.ora)}</small>
      </span>
      <span class="lic-ora__semn">${esc(f?.fel)}</span>`;
    return `
      ${banda}
      ${nouaUnitate ? `<li class="lic-unit">${esc(o.unitatea)}</li>` : ""}
      <li class="lic-rand">${f
        ? `<a class="lic-ora" href="#/f/${esc(f.id)}"
             title="${esc(vorbaFisei(f))}">${cuprins}</a>`
        : `<span class="lic-ora lic-ora--fara"
             title="Ora asta n-are încă fișă">${cuprins}</span>`}${unelteleOrei(c, o, f)}</li>`;
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

const PLUS = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
  stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;

/* SCHIMBUL, nu o săgeată rotită. Cercul cu săgeată se citește peste tot ca
   „reîncarcă"; aici nu reîncarci nimic, ci pui altă variantă în locul celei de
   acum. Două săgeți care se încrucișează spun chiar asta. */
/* CELE PATRU LINII SE SCRIU PE UN SINGUR RÂND. Rupt între `/` și `>`, browserul
   citește liniile de după ca fiind ÎNĂUNTRUL primeia, iar dintr-un `path` nu se
   desenează copii: ieșea o singură săgeată, ca un „reîncarcă". Pățanie, nu
   toană. */
const SCHIMB = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  ><path d="M3 5h13a2 2 0 0 1 2 2v8"/><path d="M14 11l4 4 4-4"/><path d="M21 19H8a2 2 0 0 1-2-2V9"/><path d="M10 13L6 9l-4 4"/></svg>`;

const COS = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  ><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg>`;

/**
 * Semnele de lângă o oră, pe care le vede DOAR profesorul.
 *
 * Stau chiar pe rândul orei, nu într-un buton „Fișă nouă" undeva sus: ești deja
 * cu ochii pe ora aceea, deci clasa, numărul și titlul se știu din rândul pe
 * care ai apăsat și nu le mai alegi din nicio listă. Asta era tot rostul.
 */
function unelteleOrei(c, o, f) {
  if (!isAdmin()) return "";
  const cheie = `${c.cod}|${o.nr}`;
  if (!f) {
    return `<span class="lic-unelte">
      <button type="button" class="lic-unealta" data-act="fisa-noua" data-cheie="${esc(cheie)}"
        title="Urcă o fișă pentru ora asta" aria-label="Urcă o fișă">${PLUS}</button>
    </span>`;
  }
  /* Numai fișele din găleată se înlocuiesc și se șterg de aici. Cele cu `cale`
     sunt lecții ale sitului: acelea se schimbă acolo unde stau, nu din modul. */
  if (f.cale) return "";
  return `<span class="lic-unelte">
    <button type="button" class="lic-unealta" data-act="fisa-inlocuieste" data-cheie="${esc(cheie)}"
      title="Urcă altă variantă peste asta" aria-label="Înlocuiește fișa">${SCHIMB}</button>
    <button type="button" class="lic-unealta lic-unealta--rau" data-act="fisa-sterge" data-id="${esc(f.id)}"
      title="Șterge fișa" aria-label="Șterge fișa">${COS}</button>
  </span>`;
}

/**
 * Culoarea modulului, trimisă fișei odată cu `?in=liceu`.
 *
 * PE TOT ECRANUL, PAGINA FIȘEI E SINGURA CARE SE MAI VEDE. Sub orice element
 * trecut pe tot ecranul, browserul așterne o pânză neagră; o fișă străvezie o
 * lasă la iveală, și în loc de fundalul modulului iese negru cu litere abia
 * citibile. Fișa își pune atunci culoarea asta și pânza rămâne acoperită.
 *
 * Se citește de pe `body`, de unde o pune `base.css`. Dacă iese străvezie, nu se
 * trimite nimic: fișa rămâne pe fundalul ei deschis, niciodată pe negru.
 */
function culoareaModulului() {
  try {
    const c = getComputedStyle(document.body).backgroundColor || "";
    return /^(transparent|rgba\(0,\s*0,\s*0,\s*0\))$/.test(c.trim()) ? "" : c;
  } catch { return ""; }
}

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

/* ---------------- telecomanda ---------------- */

const CHEIE_ROL = "liceu:telecomanda-rol";

/* Cine e aparatul ăsta: `null` = nimeni, singur. Se ține minte pe cont – și
   tabla, nelogată, are sertarul ei – ca să rămână „urmez" peste reîncărcări;
   altfel, la fiecare pornire a dimineții ar trebui apăsat din nou, pe un ecran
   la care ajungi greu. */

/** Rolul ținut minte, curățat: „conduc" e numai al profesorului. Se curăță aici,
 *  la citire, fiindcă primul desen vine înaintea pornirii telecomenzii, și n-ar
 *  fi bine ca butonul să apară apăsat la cineva care oricum nu poate conduce. */
function rolulTinutMinte() {
  const r = iaLocal(CHEIE_ROL, null);
  return r === "conduc" && !isAdmin() ? null : r;
}

/* Cât timp fără niciun mesaj înseamnă „nu conduce nimeni". Cel care conduce
   repetă din trei în trei secunde, deci opt e larg chiar și pe net de școală. */
const TACERE = 8000;

const telec = {
  rol: rolulTinutMinte(),
  legat: "rupt",     // leg | legat | rupt
  vina: "",
  fir: null,         // legătura deschisă
  bate: null,        // ceasul: la „conduc" întreabă fișa, la „urmez" pândește tăcerea
  punte: null,       // puntea spre fișa de acum
  venit: 0,          // clipa ultimului mesaj primit; 0 = încă niciunul

  /* La „conduc": ce s-a apăsat de la deschiderea fișei, în ordine. */
  jurnal: [],
  jurnalFisa: "",

  /* La „urmez": ce am apăsat deja, ca să știu de unde încolo e nou. Se ține
     toată lista, nu doar câte sunt: dacă ale noastre s-au despărțit pe drum,
     numărul ar fi arătat la fel și n-am fi aflat niciodată. */
  aplicate: [],
  aplicateFisa: "",
  deRefacut: null,   // lista de refăcut după ce se reîncarcă fișa
  dinNou: false,     // prima aliniere după „Urmez" ia fișa de la capăt
  slideCerut: 0,
};

/** Conduce cineva chiar acum? Numai pentru cel care urmează. */
const seConduce = () => telec.venit > 0 && Date.now() - telec.venit < TACERE;

/**
 * Puntea spre fișa din cadru, refăcută la fiecare încărcare (cadrul e altul, și
 * fereastra dinăuntru la fel).
 */
function legPuntea() {
  const cadru = radacina?.querySelector(".lic-fisa__cadru");
  telec.punte?.uita?.();
  telec.punte = cadru ? puntea(cadru) : null;
  potrivestePuntea();
  return telec.punte;
}

/**
 * Leagă puntea la rolul de acum: cel care conduce ascultă apăsările, cel care
 * urmează își apără ecranul plin. Se cheamă și la fiecare încărcare a fișei, și
 * la fiecare schimbare de rol – altfel, apăsând „Conduc" în mijlocul orei, n-ar
 * fi ascultat nimeni până la următoarea fișă.
 */
function potrivestePuntea() {
  const p = telec.punte;
  if (!p) return;
  /* Se dezleagă întâi, oricare ar fi rolul nou: trecând la „urmez",
     ascultătorul vechi ar fi rămas agățat de fișă – iar acolo e otravă curată,
     fiindcă apăsările pe care le face chiar el, de la distanță, i s-ar fi
     întors în jurnal ca și cum le-ar fi făcut cineva. */
  p.uita();

  if (telec.rol === "urmez") { p.nuAtingeEcranul(); return; }
  if (!isAdmin()) return;

  /* SE SCRIE ÎN JURNAL ȘI CÂND NU CONDUCE NIMENI. Pare risipă și e tocmai
     lucrul care salvează ora: dacă ai deschis fișa, ai arătat trei lucruri și
     abia pe urmă ți-ai adus aminte să apeși „Conduc", jurnalul le are pe toate
     trei, iar tabla le prinde din urmă din primul mesaj. Altfel ar fi pornit de
     la o fișă curată și ar fi rămas cu trei lucruri în minus toată ora, fără ca
     cineva să priceapă de ce. */
  p.pePunere((cale) => {
    const fisa = rutaId();
    if (telec.jurnalFisa !== fisa) { telec.jurnal = []; telec.jurnalFisa = fisa; }
    if (telec.jurnal.length >= MAX_JURNAL) return;
    telec.jurnal.push(cale);
    /* Silit, ca să plece pe loc: o apăsare care ajunge la tablă peste o
       treime de secundă se vede ca întârziere, de față cu clasa. */
    if (telec.rol === "conduc") telec.fir?.trimite(true);
  });
}

/**
 * Pornește ori oprește telecomanda, după rolul ales.
 *
 * CONDUCE NUMAI PROFESORUL, URMEAZĂ ORICINE. Tabla din clasă nu e logată în
 * niciun cont, iar un elev poate urmări lecția pe ecranul lui – de-aia „urmez"
 * nu cere nimic. „Conduc" cere: altfel, oricine din fundul clasei ar putea da
 * slide-urile mai departe. Oprirea de-aici e numai pentru ochi; cea adevărată e
 * în bază, unde politica de scriere cere profesorul (migrarea 0100).
 *
 * CEL CARE CONDUCE ÎȘI ÎNTREABĂ FIȘA, nu așteaptă ca ea să-i spună. De trei ori
 * pe secundă o întreabă „la ce slide ești?", și trimite doar când s-a schimbat.
 * Așa, fișa n-are nimic de anunțat: cele patru rânduri ale înțelegerii rămân
 * patru, și niciun element nou pus vreodată în lecție nu cere ceva în plus.
 */
function pornesteTelecomanda() {
  if (telec.fir) { telec.fir.opreste(); telec.fir = null; }
  if (telec.bate) { clearInterval(telec.bate); telec.bate = null; }
  telec.legat = "rupt"; telec.vina = ""; telec.venit = 0;
  /* Ce am apăsat ca urmăritor se uită: e socoteala altei legături. Jurnalul MEU
     de apăsări nu se atinge – el ține de fișa deschisă, nu de legătură, și
     tocmai el e cel care aduce tabla din urmă când apeși „Conduc" mai târziu. */
  telec.aplicate = []; telec.aplicateFisa = ""; telec.deRefacut = null;
  /* La intrarea în „urmez", prima aliniere se face cu fișa luată de la capăt:
     tabla poate să fi fost atinsă cu degetul înainte de apăsarea butonului, iar
     apăsările profesorului puse peste o fișă deja umblată ar fi dat altceva. */
  telec.dinNou = telec.rol === "urmez";
  if (!telec.rol) return;
  if (telec.rol === "conduc" && !isAdmin()) { telec.rol = null; return; }

  telec.fir = telecomanda({
    rol: telec.rol,
    peLegatura: (cum, vina) => {
      telec.legat = cum;
      telec.vina = vina || "";
      /* Numai bara se schimbă, nu tot ecranul: un desen întreg ar fi rupt
         cadrul fișei din pagină și ar fi reîncărcat-o. */
      picteazaBaraTelec();
    },
    stareaMea: () => {
      /* SE TRIMITE ȘI DE PE O FIȘĂ CARE NU VORBEȘTE (`fel === "fara"`, cum e
         Luceafărul). Slide-ul ei va fi mereu 0 și n-are ce strica, dar
         apăsările merg – și tocmai alea sunt lecția acolo. */
      if (!rutaE("f")) return null;
      const p = telec.punte;
      const fisa = rutaId();
      return {
        fisa,
        slide: p ? p.slide() : 0,
        jurnal: telec.jurnalFisa === fisa ? telec.jurnal : [],
      };
    },
    peStare: (s) => {
      /* CADRUL SE ÎNGHEAȚĂ ABIA CÂND CHIAR CONDUCE CINEVA, nu la apăsarea
         butonului. Cine apasă „Urmez" când nu conduce nimeni ar fi rămas cu
         lecția moartă în mână, fără să priceapă de ce. Clasa se pune pe loc,
         fără desen: un desen ar fi reîncărcat fișa.
         Se întreabă ÎNAINTE de a pune clipa nouă – așa prinde și pornirea, și
         întoarcerea după o tăcere. Cu `!telec.venit`, a doua n-ar fi prins-o. */
      const eraTacere = !seConduce();
      telec.venit = Date.now();
      if (eraTacere) {
        radacina?.querySelector(".lic-fisa")?.classList.add("lic-fisa--urmeaza");
        picteazaBaraTelec();
      }

      /* Fișa cerută nu e cea deschisă: se deschide ea întâi. Restul vine cu
         mesajul următor, care e la cel mult trei secunde. */
      if (s.fisa && s.fisa !== rutaId()) { navigheaza(`f/${s.fisa}`); return; }

      telec.slideCerut = s.slide;
      impacaJurnalul(s.fisa, s.jurnal);
      /* Dacă tocmai s-a pornit o reîncărcare, puntea de acum se duce odată cu
         fereastra veche: slide-ul îl pune `refaApasarile`, după ce fișa revine. */
      if (telec.deRefacut) return;

      const p = telec.punte;
      if (!p || p.fel === "fara") return;
      /* ÎNTREBĂM FIȘA UNDE E, nu ne ținem minte unde am pus-o. Cel care conduce
         repetă starea din trei în trei secunde, și n-are rost să-i dăm de
         fiecare dată același „du-te la 5" – ar reporni animațiile slide-ului.
         Iar dacă fișa s-a reîncărcat între timp și a căzut la început, tot de-
         aici se ridică singură, fiindcă întrebarea spune adevărul.
         SE PUNE LA URMĂ, după apăsări: printre ele sunt și cele pe săgețile de
         navigare, iar slide-ul e cuvântul care încheie. */
      if (p.slide() === s.slide) return;
      p.laSlide(s.slide);
    },
  });

  if (telec.rol === "conduc") {
    telec.bate = setInterval(() => telec.fir && telec.fir.trimite(), 350);
  } else {
    /* Cel care urmează pândește tăcerea: dacă nu mai vine nimic, scrie pe bară
       că nu conduce nimeni și dezgheață cadrul, ca lecția să rămână a lui. */
    let inainte = seConduce();
    telec.bate = setInterval(() => {
      const acum = seConduce();
      if (acum === inainte) return;
      inainte = acum;
      if (!acum) radacina?.querySelector(".lic-fisa")?.classList.remove("lic-fisa--urmeaza");
      picteazaBaraTelec();
    }, 2000);
  }
}

/** Aduce apăsările tablei la zi, după lista celui care conduce. Ce e de făcut
 *  se hotărăște în `jurnal.js`; aici se face. */
function impacaJurnalul(fisa, jurnal) {
  if (telec.deRefacut) return;               // se reîncarcă acum; nu ne încurcăm
  const lista = Array.isArray(jurnal) ? jurnal : [];
  if (telec.aplicateFisa !== fisa) { telec.aplicateFisa = fisa; telec.aplicate = []; }

  if (telec.dinNou) {
    if (refaDeLaCapat(fisa, lista)) { telec.dinNou = false; return; }
    /* N-are ce reîncărca (n-a ajuns încă la o fișă): rămâne de făcut. */
  }

  const ce = cePunem(telec.aplicate, lista);
  if (ce.fel === "nimic") return;
  if (ce.fel === "de-la-capat") { refaDeLaCapat(fisa, lista); return; }

  const p = telec.punte;
  if (!p) return;
  for (let i = ce.deLa; i < lista.length; i++) p.apasa(lista[i]);
  telec.aplicate = lista.slice();
}

/** Fișa se ia de la început, apoi se refac apăsările. Refacerea o face
 *  ascultătorul de „încărcat", fiindcă până atunci n-are ce apăsa.
 *  @returns {boolean} dacă s-a apucat chiar să reîncarce */
function refaDeLaCapat(fisa, lista) {
  const cadru = radacina?.querySelector(".lic-fisa__cadru");
  if (!cadru) return false;
  telec.aplicateFisa = fisa;
  telec.aplicate = [];
  telec.deRefacut = lista.slice();
  try { cadru.contentWindow.location.reload(); return true; }
  catch { telec.deRefacut = null; return false; }   // altă origine: n-avem ce reface
}

/** După ce fișa s-a încărcat din nou: apasă tot jurnalul, apoi pune slide-ul. */
function refaApasarile() {
  if (!telec.deRefacut) return;
  const lista = telec.deRefacut;
  telec.deRefacut = null;
  const p = telec.punte;
  if (!p) return;
  lista.forEach((cale) => p.apasa(cale));
  telec.aplicate = lista.slice();
  if (p.fel !== "fara" && p.slide() !== telec.slideCerut) p.laSlide(telec.slideCerut);
}

function alegeRolul(rol) {
  if (rol === "conduc" && !isAdmin()) return;
  const inainte = telec.rol;
  telec.rol = telec.rol === rol ? null : rol;
  punLocal(CHEIE_ROL, telec.rol);

  /* IEȘIND DIN „URMEZ", JURNALUL MEU DEVINE CE-AM URMAT. Cât am urmat, apăsările
     n-au venit de la degetul meu, deci nu s-au scris în jurnal – dar ele S-AU
     ÎNTÂMPLAT în fișa asta. Dacă mă apuc acum să conduc de pe aparatul ăsta,
     trebuie să pot spune tot ce s-a făcut în ea, nu doar de la butonul apăsat
     încoace. */
  if (inainte === "urmez" && telec.rol !== "urmez") {
    telec.jurnal = telec.aplicate.slice();
    telec.jurnalFisa = telec.aplicateFisa;
  }

  pornesteTelecomanda();
  /* NU UN DESEN ÎNTREG. Ar fi pus alt cadru în pagină, adică ar fi reîncărcat
     fișa – ai fi apăsat „Conduc" în mijlocul orei și lecția s-ar fi întors la
     primul slide, de față cu clasa. Se schimbă numai ce ține de rol: bara și
     îngheț-dezgheț cadrul. Nimic altceva din ecran nu atârnă de `telec.rol`. */
  radacina?.querySelector(".lic-fisa")
    ?.classList.toggle("lic-fisa--urmeaza", telec.rol === "urmez" && seConduce());
  /* Puntea e aceeași, dar are altă treabă acum: ascultă apăsările ori își apără
     ecranul plin. Fără rândul ăsta, „Conduc" apăsat în mijlocul orei n-ar fi
     ascultat nimic până la fișa următoare. */
  potrivestePuntea();
  picteazaBaraTelec();
}

/* ---------------- ecranul: o fișă ---------------- */

/* Fișele aduse din găleată, ținute cât ține fila. O adresă `blob:` rămâne bună
   până se închide fila, deci a doua deschidere a aceleiași fișe e pe loc – iar
   la 4 MB bucata, asta se simte. */
const fiseAduse = {};

/**
 * Aduce o fișă din găleată și o preface în adresă `blob:`.
 *
 * NU MAI E NICIO PLASĂ SPRE DEPOZIT. A fost una cât fișierele au stat în două
 * locuri deodată; folderul `liceu/fise/` e șters, deci găleata e singurul drum,
 * iar o greșeală se vede ca greșeală, nu ca o fișă care vine de altundeva.
 */
async function aduFisa(f) {
  if (fiseAduse[f.id]) return;
  fiseAduse[f.id] = { seAduce: true, url: "", vina: "" };
  try {
    const html = await fetchFisa(cheiaFisei(f));
    fiseAduse[f.id] = {
      seAduce: false,
      url: URL.createObjectURL(new Blob([cuAcelasiZar(html, f.id)], { type: "text/html" })),
      vina: "",
    };
  } catch (err) {
    const vina = err?.message || String(err);
    console.warn(`[liceu] fișa ${f.id} n-a venit din găleată:`, vina);
    fiseAduse[f.id] = { seAduce: false, url: "", vina };
  }
  /* Dacă între timp ai plecat pe alt ecran, nu-l smulgem de sub tine. */
  if (rutaE("f") && rutaId() === f.id) cereDesen();
}

const TELEC_SEMN = {
  conduc: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  urmez: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    ><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
};

/**
 * Rândul telecomenzii: cine e aparatul ăsta și cum stă legătura.
 *
 * DOUĂ BUTOANE, NU O ÎMPERECHERE. Pe tablă apeși „Urmez", pe laptop „Conduc".
 * Fără coduri, fără căutat aparate: spui limpede ce e fiecare, iar dacă te
 * răzgândești, apeși din nou pe același buton și te desprinzi.
 *
 * „URMEZ" E LA VEDEREA TUTUROR, „CONDUC" NUMAI LA PROFESOR. Tabla din clasă nu
 * e logată, deci butonul ei nu poate cere cont; iar un elev care vrea să vadă
 * lecția pe ecranul lui n-are de ce să fie oprit. Cine conduce rămâne unul
 * singur – și asta o ține baza, nu butonul de-aici.
 */
function randTelecomanda(punte) {
  const r = telec.rol;
  /* La „urmez", „legată" ar fi fost o jumătate de adevăr: legătura ține, dar
     poate nu conduce nimeni de partea cealaltă. Spunem care din două. */
  const tacere = telec.legat === "legat" && r === "urmez" && !seConduce();
  const stare = telec.legat === "legat" && r === "urmez"
    ? (tacere ? "nu conduce nimeni" : "merg după profesor")
    : { leg: "mă leg…", legat: "legată", rupt: "nelegată" }[telec.legat];
  const felStare = tacere ? "tacere" : telec.legat;

  const buton = (care, vorba) => `
    <button type="button" class="lic-telec__buton${r === care ? " on" : ""}"
      data-act="telec-${care}" aria-pressed="${r === care}"
      title="${care === "conduc"
        ? "Aparatul ăsta conduce: ce faci aici se vede pe tablă"
        : "Aparatul ăsta urmează: arată ce derulează profesorul"}"
      >${TELEC_SEMN[care]}${vorba}</button>`;

  /* Vorba vine din puntea însăși, nu scrisă a doua oară aici: se despărțiseră
     deja o dată, iar cea de-aici mai spunea „fără interacțiuni" după ce
     interacțiunile începuseră să meargă. */
  const vorba = vorbaPuntii[punte?.fel] || "";

  return `
    <div class="lic-telec">
      ${isAdmin() ? buton("conduc", "Conduc") : ""}
      ${buton("urmez", "Urmez")}
      ${r ? `<span class="lic-telec__stare lic-telec__stare--${felStare}">${esc(stare)}</span>` : ""}
      ${r && vorba ? `<span class="lic-telec__vina">${esc(vorba)}</span>` : ""}
      ${r && telec.legat === "rupt" && telec.vina
        ? `<span class="lic-telec__vina">${esc(telec.vina)}</span>` : ""}
    </div>`;
}

/** Desenează din nou NUMAI rândul telecomenzii. Un desen întreg ar fi rupt
 *  cadrul fișei din pagină și ar fi reîncărcat-o – adică ar fi luat-o de la
 *  primul slide, în mijlocul orei. */
function picteazaBaraTelec() {
  const loc = radacina?.querySelector(".lic-telec");
  if (!loc) return;
  const nou = document.createElement("div");
  nou.innerHTML = randTelecomanda(telec.punte);
  const gata = nou.firstElementChild;
  if (gata) loc.replaceWith(gata);
}

/** Bara de sus a fișei, aceeași oricum ar veni pagina. */
function baraDeFisa(f, adresaSingura, semn = "") {
  return `
    <div class="lic-fisa__bar">
      <span class="lic-fisa__titlu">
        <b>${esc(f.clasa)} · ${f.ore.length > 1 ? `Orele ${esc(f.ore.join(", "))}` : `Ora ${f.ora}`}</b>
        <small>${esc(f.titlu)}${semn ? ` · <i>${esc(semn)}</i>` : ""}</small>
      </span>
      ${randTelecomanda(telec.punte)}
      ${adresaSingura
        ? `<a class="lic-btn" href="${adresaSingura}" target="_blank" rel="noopener"
             title="Deschide fișa singură, într-o filă nouă">Singură ↗</a>`
        : ""}
    </div>`;
}

/**
 * O fișă, arătată NEATINSĂ.
 *
 * Într-un `<iframe>`, nu desfăcută și pusă la loc de mine: fișierele lui Marius
 * își poartă singure stilurile și scripturile. Lipite de-a dreptul în pagină,
 * stilurile lor s-ar fi bătut cu ale modulului în amândouă sensurile – ale lui
 * ar fi stricat cardul, iar ale mele i-ar fi schimbat fișa pe care o arată la
 * clasă. Cadrul le ține fiecare la ea acasă.
 *
 * DOUĂ FELURI DE FIȘE, de când avem găleata (migrarea 0095):
 *   · cele din GĂLEATĂ – cele nouă de la clasă. Nu au adresă pe sit, fiindcă
 *     găleata e privată: vin ca text și se fac adresă `blob:`. Cu semnul stins,
 *     nu vin deloc, și asta e tot rostul mutării;
 *   · cele din SIT – deocamdată Luceafărul, lecție publică la `lectii/lectura/`,
 *     unde îi e locul. Ele primesc `?in=liceu` și culoarea modulului, ca să se
 *     așeze în cadru; cele din găleată n-au nevoie, n-au fundal al lor.
 *
 * `?in=liceu` e singurul lucru pe care i-l spune modulul unei fișe din sit:
 * „ești arătată înăuntru". Fișa face ce vrea cu vorba asta ori o trece cu
 * vederea. Semnul se pune NUMAI pe cadru; „Singură ↗" deschide fișa curată.
 */
function vedereDeFisa(f) {
  if (f.cale) {
    const adresa = adresaFisei(f, caleaSitului);
    const bg = culoareaModulului();
    const inCadru = `${adresa}?in=liceu${bg ? `&bg=${encodeURIComponent(bg)}` : ""}`;
    /* Și fișa din sit se încremenește cât urmează. Lipsea, și tabla ar fi putut
       fi abătută cu degetul tocmai la Luceafărul. */
    return `
      <div class="lic-fisa${telec.rol === "urmez" && seConduce() ? " lic-fisa--urmeaza" : ""}">
        ${baraDeFisa(f, adresa)}
        <iframe class="lic-fisa__cadru" src="${inCadru}"
          allow="fullscreen" allowfullscreen
          title="${esc(f.titlu)}"></iframe>
      </div>`;
  }

  const adusa = fiseAduse[f.id];
  if (!adusa) { aduFisa(f); }
  if (!adusa || adusa.seAduce) {
    return `
      <div class="lic-fisa">
        ${baraDeFisa(f, "")}
        <p class="lic-clasa__gol">Aduc fișa…</p>
      </div>`;
  }

  /* Găleata n-a răspuns. Se spune de ce, pe șleau, în loc să rămână un cadru
     alb din care nu înțelege nimeni nimic. */
  if (!adusa.url) {
    return `
      <div class="lic-fisa">
        ${baraDeFisa(f, "")}
        <div class="lic-gol">
          <p>Fișa asta n-a venit din găleată.</p>
          <p class="lic-gol__vina">${esc(adusa.vina)}</p>
        </div>
      </div>`;
  }

  /* CÂT URMEAZĂ, CADRUL NU SE LASĂ ATINS. Tabla e interactivă; dacă un elev
     apasă pe slide, ea s-ar abate de la ce conduci tu, iar tu n-ai avea de unde
     ști – comanda următoare ar aduce-o înapoi, dar între timp arată altceva
     decât crezi. Mai bine nu se poate atinge deloc. */
  const urmeaza = telec.rol === "urmez" && seConduce();
  return `
    <div class="lic-fisa${urmeaza ? " lic-fisa--urmeaza" : ""}">
      ${baraDeFisa(f, adusa.url)}
      <iframe class="lic-fisa__cadru" src="${adusa.url}"
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
  /* Vorba de pe săgeată vine din aceeași socoteală ca fapta ei (`sageataInapoi`),
     nu dintr-una paralelă: altfel se despart, și s-au despărțit deja o dată. */
  const vorbaInapoi = sageataInapoi().vorba;
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

  /* PUNTEA SE LEAGĂ DUPĂ CE CADRUL S-A ÎNCĂRCAT, nu acum: `contentWindow` e
     gol până atunci, iar `fisaLiceu` nici n-a apucat să existe. La fiecare
     desen cadrul e altul, deci și puntea se face din nou. */
  telec.punte?.uita?.();
  telec.punte = null;
  const cadru = radacina.querySelector(".lic-fisa__cadru");
  if (cadru) {
    /* NU `{ once: true }`. Fișa se mai încarcă o dată, de bunăvoie, când tabla
       rămâne în urmă și o ia de la capăt (`refaDeLaCapat`); cu „o singură
       dată", a doua încărcare ar fi rămas fără punte, deci mută. */
    const leaga = () => { legPuntea(); refaApasarile(); picteazaBaraTelec(); };
    cadru.addEventListener("load", leaga);
    /* Dacă s-a încărcat deja (fișă adusă din memorie), `load` nu mai vine. */
    if (cadru.contentDocument?.readyState === "complete") leaga();
  }
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

const CHEIE_LOC = "liceu:cardul-locul";

/**
 * CARDUL SE TRAGE UNDE VREI, iar locul lui se ține minte pe cont.
 *
 * Până acum locul îl ghiceam eu: dreapta jos, și stânga jos peste o fișă,
 * fiindcă se bătea cu panoul Luceafărului. Ghicitul ține până la prima fișă cu
 * uneltele în alt colț. Așa, muți o dată și gata.
 *
 * SE PUNE `left`/`top` ÎN STIL, PE ELEMENT. Foaia îl așază din colțuri
 * (`inset-block-end`, `inset-inline-end`), iar peste o fișă îl mută în stânga;
 * un stil scris pe element bate toate regulile din foaie, deci alegerea ta
 * rămâne oriunde ar fi cardul.
 *
 * SE ȚINE ÎN PIXELI, NU ÎN PROCENTE. Pe un ecran mai mic, procentele l-ar fi
 * lipit de altceva decât colțul la care te uitai; pixelii, tăiați la marginea
 * ferestrei, îl păstrează unde l-ai pus, iar dacă nu mai încape, îl aduc
 * înăuntru.
 */
function mutaCardul(casa) {
  let locul = iaLocal(CHEIE_LOC, null);
  const bun = (l) => l && typeof l.x === "number" && typeof l.y === "number"
    && Number.isFinite(l.x) && Number.isFinite(l.y);

  function aseaza() {
    if (!bun(locul)) {
      casa.style.removeProperty("left");
      casa.style.removeProperty("top");
      casa.style.removeProperty("inset-inline-end");
      casa.style.removeProperty("inset-block-end");
      return;
    }
    const c = casa.getBoundingClientRect();
    /* Tăiat la marginea ferestrei: cardul n-are voie să iasă din ecran, nici
       când l-ai pus bine pe un monitor mare și deschizi pe altul mic. */
    const x = Math.min(Math.max(0, locul.x), Math.max(0, window.innerWidth - c.width));
    const y = Math.min(Math.max(0, locul.y), Math.max(0, window.innerHeight - c.height));
    casa.style.left = `${x}px`;
    casa.style.top = `${y}px`;
    casa.style.insetInlineEnd = "auto";
    casa.style.insetBlockEnd = "auto";
  }

  let trage = false, aMiscat = false, dx = 0, dy = 0;
  /* PRAGUL DE PATRU PIXELI. Fără el, o apăsare pe butonul de ascuns ar fi
     pornit o mutare de un pixel, iar apăsarea s-ar fi pierdut. */
  const PRAG = 4;

  casa.addEventListener("pointerdown", (e) => {
    /* Pe butoanele dinăuntru nu se trage: ele se apasă. Cardul se prinde de
       orice altceva. */
    if (e.target.closest("button, a")) return;
    const c = casa.getBoundingClientRect();
    dx = e.clientX - c.left;
    dy = e.clientY - c.top;
    trage = true; aMiscat = false;
    casa.setPointerCapture(e.pointerId);
  });

  casa.addEventListener("pointermove", (e) => {
    if (!trage) return;
    const x = e.clientX - dx;
    const y = e.clientY - dy;
    if (!aMiscat) {
      const c = casa.getBoundingClientRect();
      if (Math.abs(x - c.left) < PRAG && Math.abs(y - c.top) < PRAG) return;
      aMiscat = true;
      casa.classList.add("lic-orcard--trage");
    }
    locul = { x, y };
    aseaza();
  });

  const gata = (e) => {
    if (!trage) return;
    trage = false;
    try { casa.releasePointerCapture(e.pointerId); } catch { /* deja eliberat */ }
    casa.classList.remove("lic-orcard--trage");
    if (aMiscat) punLocal(CHEIE_LOC, locul);
  };
  casa.addEventListener("pointerup", gata);
  casa.addEventListener("pointercancel", gata);

  /* O apăsare care a fost de fapt o tragere nu trebuie să ajungă la butoanele
     de dedesubt: se oprește în drum. */
  casa.addEventListener("click", (e) => {
    if (aMiscat) { e.stopPropagation(); e.preventDefault(); aMiscat = false; }
  }, true);

  /* Dublu-click: înapoi în colțul din oficiu, ca la mânerul panoului. */
  casa.addEventListener("dblclick", (e) => {
    if (e.target.closest("button, a")) return;
    locul = null;
    punLocal(CHEIE_LOC, null);
    aseaza();
  });

  window.addEventListener("resize", aseaza);
  aseaza();
}

function faCardul() {
  if (card) return;
  const casa = document.createElement("div");
  casa.className = "lic-orcard";
  casa.id = "lic-orcard";
  document.body.appendChild(casa);
  card = hourCard(casa, oraDeArata, felulCardului);
  mutaCardul(casa);
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
const orarul = {
  zi: null, ore: [], toate: [], intervale: [], orare: [],
  /* Structura anului (ordinul 3.194/2026): vacanțele, zilele libere,
     săptămânile de curs și cele două speciale. Din ea află grila de ce e goală
     o zi – altfel, o vacanță arată la fel cu o zi în care n-au venit datele. */
  structura: {},
  adus: false,
};

/**
 * Ce fel de zi e. Se întreabă în ordinea asta, și ordinea contează: o zi liberă
 * căzută într-o vacanță e tot vacanță, iar 5 octombrie e zi liberă, nu o zi de
 * curs din săptămâna 5.
 */
function felulZilei(data) {
  const s = orarul.structura || {};
  for (const v of s.vacante || []) {
    if (data >= v.start && data <= v.sfarsit) return { fel: "vacanta", eticheta: v.eticheta };
  }
  for (const z of s.zileLibere || []) {
    if (z.data === data) return { fel: "liber", eticheta: z.eticheta };
  }
  for (const w of s.saptamani || []) {
    if (w.special && data >= w.start && data <= w.sfarsit) {
      return { fel: "special", eticheta: w.special };
    }
  }
  return { fel: "curs", eticheta: "" };
}

/**
 * A câta săptămână de școală e cea arătată, după structura anului.
 *
 * Se caută săptămâna care se SUPRAPUNE cu zilele arătate, nu una care începe
 * fix lunea: săptămâna 30 pornește miercuri, 5 mai, fiindcă luni și marți sunt
 * încă vacanță de primăvară.
 */
function saptamanaDeScoala(zile) {
  const de = zile[0].data;
  const pana = zile[zile.length - 1].data;
  return (orarul.structura?.saptamani || [])
    .find((w) => w.start <= pana && w.sfarsit >= de) || null;
}

/**
 * Orarul în vigoare la o ANUMITĂ zi, cu eticheta lui.
 *
 * Nu „orarul de azi". Grila arată o săptămână care poate fi alta decât cea de
 * azi – duminica arată săptămâna care vine – iar lista unei clase se întinde
 * peste tot anul. Fiecare ecran întreabă pentru ziua pe care o arată.
 */
function orarulLa(data) {
  const valabile = (orarul.toate || []).filter((r) => r.deLa <= data);
  if (!valabile.length) return { ore: [], eticheta: "" };
  /* Cel mai nou dintre cele începute. */
  const deLa = valabile.reduce((m, r) => (r.deLa > m ? r.deLa : m), "");
  const ale = valabile.filter((r) => r.deLa === deLa);
  return { ore: ale, eticheta: ale[0]?.eticheta || "" };
}

async function aduOrarul() {
  const azi = ziuaISO();
  const [z, t, c] = await Promise.all([fetchZiua(azi), fetchOrarul(), fetchConfig()]);
  orarul.zi = azi;
  orarul.ore = z.date || [];
  orarul.toate = t.date || [];
  orarul.intervale = (c.date || {}).intervale || [];
  orarul.structura = (c.date || {}).structura || {};
  /* Cele trei orare ale anului, cu etichetele lor, în ordine: din ele se nasc
     benzile din lista unei clase. Se scot din rândurile de mai sus, nu se cer
     încă o dată. */
  const vazute = new Map();
  for (const r of orarul.toate) if (!vazute.has(r.deLa)) vazute.set(r.deLa, r.eticheta);
  orarul.orare = [...vazute].map(([din, eticheta]) => ({ din, eticheta }))
    .sort((a, b) => a.din.localeCompare(b.din));
  /* Fără intervale nu se poate socoti nimic: ceasurile orelor vin din ele. Dacă
     lipsesc (baza încă nu e umplută), cardul rămâne cu ceasul lui și spune
     cinstit că n-are orar, în loc să arate o zi goală ca și cum ar fi liber. */
  orarul.adus = orarul.intervale.length > 0;
  if (card) card.improspateaza();
  /* Dacă tocmai te uitai la grila orarului ori la o clasă cât se aduceau datele,
     se redesenează: grila ca s-o vezi plină, clasa ca să-i apară benzile de
     orar, care vin din ce tocmai a sosit. */
  if (rutaE("v")) deseneaza();
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
    /* Cardul caută „următoarea zi cu ore", deci îi trebuie orarul de AZI, nu
       cel al săptămânii arătate în grilă. */
    saptamana: orarulLa(azi).ore,
    intervale: orarul.intervale,
  });
}

/* ---------------- urcarea unei fișe ---------------- */

/**
 * Fereastra de urcare, deschisă de „+" ori de „înlocuiește".
 *
 * TREI LUCRURI VIN DE-A GATA din rândul pe care ai apăsat: clasa, ora și
 * titlul lecției din planificare. Rămâne să alegi fișierul; litera și titlul se
 * pot schimba, dacă vrei altele.
 *
 * NUMELE DIN GĂLEATĂ ÎL PUNE CODUL – `11d-5-b.html` – oricum s-ar chema
 * fișierul pe discul tău. De-aia nu mai redenumești nimic: diacriticele care
 * opreau urcarea nu mai ajung niciodată până acolo.
 */
function fereastraDeFisa({ clasa, nr, titlu, fisaVeche }) {
  const vechi = document.getElementById("lic-urcare");
  if (vechi) vechi.remove();

  const d = document.createElement("dialog");
  d.id = "lic-urcare";
  d.className = "lic-urcare";
  d.innerHTML = `
    <form method="dialog" class="lic-urcare__form">
      <h2 class="lic-urcare__titlu">${fisaVeche ? "Înlocuiește fișa" : "Fișă nouă"}</h2>
      <p class="lic-urcare__unde">${esc(clasa)} · Ora ${nr}</p>

      <label class="lic-urcare__camp">
        <span>Fișierul</span>
        <input type="file" name="fisier" accept=".html,text/html" required />
      </label>

      <label class="lic-urcare__camp">
        <span>Titlul, cum se va vedea în listă</span>
        <input type="text" name="titlu" value="${esc(fisaVeche?.titlu || titlu || "")}" required />
      </label>

      <label class="lic-urcare__camp">
        <span>Felul</span>
        <select name="fel">
          ${["", "A", "B", "C"].map((x) => `
            <option value="${x}" ${(fisaVeche?.fel || "B") === x ? "selected" : ""}>${
              x ? `${x} – ${esc(FELUL_FISEI[x].ce)}` : "fără literă"}</option>`).join("")}
        </select>
      </label>

      <p class="lic-urcare__vina" data-rol="vina" hidden></p>

      <div class="lic-urcare__butoane">
        <button type="button" class="lic-btn" data-act="urcare-lasa">Renunță</button>
        <button type="submit" class="lic-btn lic-btn--tare" data-rol="urca">
          ${fisaVeche ? "Înlocuiește" : "Urcă"}
        </button>
      </div>
    </form>`;
  document.body.appendChild(d);

  const form = d.querySelector("form");
  const vina = d.querySelector("[data-rol='vina']");
  const btn = d.querySelector("[data-rol='urca']");

  /* `seUrca` ține fereastra deschisă cât se urcă: altfel, o apăsare pe lângă ea
     ar fi închis-o la mijlocul drumului, iar greșeala, dacă venea, n-ar mai fi
     avut unde să se arate. */
  let seUrca = false;

  d.addEventListener("click", (e) => {
    if (e.target.closest("[data-act='urcare-lasa']")) { d.close(); return; }
    /* APĂSAREA PE LÂNGĂ FEREASTRĂ o închide. Pânza din spate e o parte a
       ferestrei, nu un element al ei, deci o apăsare pe ea are drept țintă chiar
       `<dialog>`-ul. Dinăuntru, țintă e mereu altceva – formularul îi umple tot
       locul, fiindcă marginile sunt ale lui, nu ale ferestrei. */
    if (e.target === d && !seUrca) d.close();
  });

  form.addEventListener("submit", async (e) => {
    /* Fereastra NU se închide la trimitere: rămâne deschisă cât se urcă, ca să
       aibă unde să apară greșeala dacă baza refuză. */
    e.preventDefault();
    const file = form.fisier.files?.[0];
    if (!file) return;

    seUrca = true;
    btn.disabled = true;
    btn.textContent = "Urc…";
    vina.hidden = true;

    try {
      const fel = form.fel.value;
      await salveazaFisa({
        clasa, ore: [nr], fel, titlu: form.titlu.value.trim(),
        /* La înlocuire se păstrează numele vechi, chiar dacă ai schimbat litera:
           altfel ar fi rămas în găleată și fișierul vechi, sub numele lui, iar
           fișa ar fi avut două trupuri. */
        fisier: fisaVeche?.fisier || cheiaNoua(clasa, nr, fel),
        file,
      });
      await aduFisele();
      /* Fișa ținută în memorie de la deschiderea de dinainte nu mai e bună. */
      delete fiseAduse[(fisaVeche?.id) || cheiaNoua(clasa, nr, fel).replace(/\.html$/, "")];
      d.close();
      deseneaza();
    } catch (err) {
      vina.textContent = err?.message || String(err);
      vina.hidden = false;
      btn.disabled = false;
      btn.textContent = fisaVeche ? "Înlocuiește" : "Urcă";
    } finally {
      seUrca = false;
    }
  });

  d.addEventListener("close", () => d.remove());
  d.showModal();
}

/** Ora din planificare pe care s-a apăsat („11D|5"), cu titlul ei. */
function oraDupaCheie(cheie) {
  const [cod, nrText] = String(cheie || "").split("|");
  const nr = Number(nrText);
  const plan = planuri[cod];
  const o = plan?.ore?.find((x) => x.nr === nr) || null;
  return { clasa: cod, nr, titlu: o?.titlu || "" };
}

async function stergeFisaDinLista(id) {
  const f = fisaDupaId(id);
  if (!f) return;
  if (!window.confirm(`Ștergi fișa „${f.titlu}"? Se scoate și fișierul din găleată.`)) return;
  try {
    await stergeFisa({ slug: f.id, fisier: f.fisier });
    delete fiseAduse[f.id];
    await aduFisele();
    deseneaza();
  } catch (err) {
    console.warn("[liceu] ștergerea fișei:", err?.message || err);
    window.alert(`Fișa n-a putut fi ștearsă: ${err?.message || err}`);
  }
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
  if (act === "vedere") { navigheaza(`v/${b.dataset.id}`); return; }

  /* Uneltele de pe rândul orei. Se opresc aici, ca apăsarea să nu meargă mai
     departe la rândul de dedesubt, care deschide fișa. */
  if (act === "fisa-noua" || act === "fisa-inlocuieste") {
    e.preventDefault();
    const unde = oraDupaCheie(b.dataset.cheie);
    const peOra = new Map();
    fiseleClasei(unde.clasa).forEach((f) => f.ore.forEach((o) => peOra.set(o, f)));
    fereastraDeFisa({ ...unde, fisaVeche: act === "fisa-inlocuieste" ? peOra.get(unde.nr) : null });
    return;
  }
  if (act === "fisa-sterge") { e.preventDefault(); stergeFisaDinLista(b.dataset.id); return; }

  if (act === "telec-conduc") { alegeRolul("conduc"); return; }
  if (act === "telec-urmez") { alegeRolul("urmez"); return; }

  /* Umblatul prin orarele anului. Nu trece prin `navigheaza`: nu e un ecran
     nou, e același ecran cu altă privire, iar săgeata „Înapoi" n-are de ce să
     numere pașii ăștia. */
  /* Semnul fișei din celula orarului: duce de-a dreptul în material. Se oprește
     aici, ca apăsarea să nu meargă mai departe la legătura spre clasă, pe care
     semnul stă călare. */
  if (act === "fisa-din-grila") {
    e.preventDefault();
    navigheaza(`f/${b.dataset.id}`);
    return;
  }

  if (act === "sapt-inapoi" || act === "sapt-inainte" || act === "sapt-acum") {
    if (act === "sapt-acum") { stare.saptamanaAleasa = null; deseneaza(); return; }
    const noua = luneaDeLanga(luneaDinGrila(), act === "sapt-inainte" ? 1 : -1);
    const { stanga, dreapta } = margini();
    if (stanga && noua < stanga) return;
    if (dreapta && noua > dreapta) return;
    /* Pe săptămâna de acum nu se ține nimic: așa, când te întorci pe ecran,
       grila pornește iar de la ea, nu de unde ai lăsat-o. Privirea înapoi nu se
       lipește de tine. */
    stare.saptamanaAleasa = noua === luneaDeAcum() ? null : noua;
    deseneaza();
  }
}

/* ---------------- modulul închis ---------------- */

/**
 * Ce vede cineva care intră pe link cu semnul stins.
 *
 * NU E O PERDEA PESTE CEVA. Sub fereastră nu se desenează nimic de ascuns și nu
 * se cere nimic de la bază – nici orarul, nici planificările, nici cartonașele
 * claselor. Iar dacă cineva ar cere datele de mână, politicile din bază i le
 * refuză oricum (migrarea 0094). Fereastra e ușa închisă, nu un capac pus peste
 * o masă întinsă.
 *
 * Rămâne numai fundalul colorat al modulului, încețoșat, ca pagina să nu arate
 * ca o eroare a sitului: nu e stricată, e închisă.
 */
function ecranulInchis() {
  radacina.classList.remove("lic--fisa");
  radacina.classList.add("lic--acasa", "lic--inchis");
  radacina.innerHTML = `
    <div class="lic-acasa">
      <div class="lic-aurora" aria-hidden="true">
        ${CLASE.map((c) => `<span style="--h:${c.hue}"></span>`).join("")}
      </div>

      <div class="lic-inchis" role="alertdialog" aria-labelledby="lic-inchis-t">
        <h1 class="lic-inchis__titlu" id="lic-inchis-t">Partea asta e închisă</h1>
        <p class="lic-inchis__vorba">
          Liceul se deschide când îl deschide profesorul. Până atunci nu e nimic
          de văzut aici, nici măcar pe ocolite.
        </p>
        <a class="lic-inchis__btn" href="${esc(caleaSitului) || "/"}">Înapoi la site</a>
      </div>
    </div>`;
}

/* ---------------- pornirea ---------------- */

/**
 * @param {HTMLElement} gazda
 * @param {string} basePath  ce se pune înaintea adreselor („../" de obicei)
 */
export async function renderHighschool(gazda, basePath = "") {
  radacina = gazda;
  caleaSitului = basePath;
  if (!radacina) return;

  /* SEMNUL, ÎNAINTE DE ORICE. Profesorul intră mereu – el are de unde-l aprinde.
     Pentru ceilalți, cu semnul stins nu se desenează modulul și nu se cere
     nicio dată: se pune fereastra și ne oprim aici.
     Pagina e ținută ascunsă de poartă până sfârșim, deci nu apucă nimeni să
     vadă modulul o clipă înainte de fereastră. */
  if (!isAdmin() && !(await aduLiceuDeschis())) { ecranulInchis(); return; }

  /* Lista fișelor, o dată, înainte de primul desen: ruta se citește din ea
     (`#/f/11d-5-b` are nevoie să știe că fișa aia există), iar fără ea cineva
     care intră de-a dreptul pe adresa unei fișe ar fi ajuns pe ecranul de
     pornire, fără nicio vorbă. */
  try { await aduFisele(); }
  catch (e) { console.warn("[liceu] lista fișelor:", e?.message || e); }

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

  /* SĂPTĂMÂNA SE ÎNTOARCE SINGURĂ, fără să umble nimeni la pagină. Pe tabla din
     clasă modulul stă deschis ore întregi, iar pragul de vineri seara ar fi
     trecut pe lângă el: ai fi văzut luni dimineața săptămâna trecută, fiindcă
     grila se desenase vineri la prânz.
     Se uită la CE SĂPTĂMÂNĂ ar trebui arătată, nu la ceas, deci prinde și
     pragul de vineri, și miezul nopții, cu aceeași socoteală. Cât umbli prin
     orarele vechi nu se atinge nimic: amintirea ta e mai importantă decât
     punctualitatea mea. */
  let saptamanaDesenata = zileleSaptamanii()[0].data;
  setInterval(() => {
    const acum = zileleSaptamanii()[0].data;
    if (acum === saptamanaDesenata) return;
    saptamanaDesenata = acum;
    if (stare.saptamanaAleasa) return;
    if (rutaE("v") && rutaId() === "orar") deseneaza();
  }, 20000);

  deseneaza();
  /* Strângerea se pune DUPĂ primul desen: `strange` caută butonul în pagină. */
  strange(iaLocal(CHEIE_STRANS, false) === true);
  faCardul();
  /* Telecomanda, dacă aparatul ăsta are un rol ținut minte din altă zi. */
  pornesteTelecomanda();
  /* Orarul vine pe urmă, fără să țină pagina în loc: cardul se arată cu ceasul
     lui, iar când datele ajung se împrospătează singur. */
  aduOrarul().catch((e) => console.warn("[liceu] orarul:", e));
}

// =========================================================
// Teste → Admitere Câmpina — jocul elevului.
//
// FIȘIER PROPRIU, nu o ramură într-al Dreptului: lucrul aici nu poate strica
// jocul care merge deja. Ce e cu adevărat comun — chemările spre Supabase —
// stă în `test-repo.js`, unde îi e locul; iar înfățișarea cărții de item
// (`.tgame-card`, `.tgame-opt`, verdictul) e vocabularul de stil al sitului,
// pe care îl FOLOSESC fără să-l ating, ca itemul să arate la fel oriunde.
//
// PATRU MODURI, fiecare cu altă întrebare pusă elevului:
//   • Relaxed  - „vreau să văd tot subiectul." Toată sesiunea pe o pagină, pe
//     file de ani. Apeși, se face verde ori roșu, iar tu îți scrii explicația
//     ta lângă item. Fără puncte, fără ceas: aici se citește, nu se aleargă.
//   • Classic  - 3 lives (până la 6), cel mult 30 de itemi, câte unul pe ecran.
//     Unii itemi sunt „de viață": nimerit, îți dă o inimă; greșit, nu-ți ia
//     niciuna. Are configurator, ca la Drept.
//   • Adventure - tot ce ai ales, item cu item, numerotat 1..N. Greșitul se duce
//     la coada rândului și revine până îl nimerești.
//   • Level-up - 5 itemi pe level, o greșeală și s-a terminat. Levelurile
//     sunt strânse în worlds, fiecare cu înfățișarea lui, și se adună badges.
//
// CINSTIT PRIN CONSTRUCȚIE. Itemii pleacă de pe server fără răspuns (coloana
// `correct` are SELECT-ul revocat). Singura cale de a afla răspunsul e să-l
// dai: `check_test_item` (fără puncte) ori `answer_test_item` (cu puncte, o
// singură dată pe item și sesiune, socotite de server). Modul Relaxed cheamă
// dinadins varianta FĂRĂ puncte: cu tot subiectul deschis în față, ai putea
// apăsa toate cele patru variante și tot le-ai aduna.
// =========================================================
import {
  fetchTestItems, checkTestItem, answerTestItem, reportTestItem, TEST_ITEM_TYPES,
  fetchMyProgress, saveMyProgress, clearMyProgress,
  fetchMyLevels, saveMyLevel, clearMyLevels, fetchMyBadges, awardBadge,
  canPropose, proposeExplanation, myProposals,
} from "../../shared/scripts/test-repo.js";
import { sanitizeRich } from "../../shared/scripts/rich-text.js";
import { showToast } from "../../shared/scripts/toast.js";
import { isLoggedIn } from "../../shared/scripts/session.js";
import { CHAPTERS, LEVELS_PER_CHAPTER, storyFragment } from "./campina-poveste.js";

const OPTS = ["A", "B", "C", "D"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TYPE_LABEL = Object.fromEntries(TEST_ITEM_TYPES.map((t) => [t.code, t.label]));
const uuid = () => (crypto.randomUUID
  ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

/* VOCABULARUL DE JOC E ÎN ENGLEZĂ, restul textului în română, și e o despărțire
   voită. „Lives", „Level", „Chapter", „Streak", „Game Over" sunt semne, nu
   explicații: orice copil le-a văzut în orice joc și le citește dintr-o
   privire, iar engleza le dă chiar aerul de joc. Tot ce EXPLICĂ, în schimb,
   rămâne românesc: acolo se înțelege, iar înțelegerea se face în limba ta. */

let root = null;

const J = {
  exam: "admitere-campina",
  items: [], byId: new Map(),
  papers: [], // { key, year, sessionId, items: [] } — o „hârtie" = o sesiune de admitere
  years: [],
  globalNo: new Map(), // id → numărul lui din toată banca, 1..N
  loaded: false,
  screen: "pick", // pick | relaxed | classic | adventure | levelup
  /* Unde ești ÎN modul ales. Relaxed n-are faze (e o singură pagină); Classic
     și Adventure merg config → joc → gata; Level-up, hartă → joc → gata. */
  phase: "config",
  // — Relaxed —
  pickedYear: null, pickedPaper: null,
  answers: {}, // id → { chosen, isRight, key, explanation, historical }
  notes: {},       // id → text scris de elev
  // — modurile pe un item pe ecran —
  queue: [],       // ids, în ordinea de jucat
  position: 0,
  currentAnswer: null, // verdictul itemului de acum, cât timp e pe ecran
  rightCount: 0, wrongCount: 0, points: 0,
  lives: 0,
  lifeItems: new Set(), // itemii care dau o inimă, aleși la pornire
  sessionId: null,      // id-ul rundei, pentru punctele date de server
  done: false,
  // — Level-up —
  chapter: 0, level: 0,
  levelLog: new Map(), // level → { tries, passed }
  badges: new Set(),  // codurile câștigate
  freshBadges: new Set(), // insignele câștigate ACUM, ca să pâlpâie o dată
  streak: 0,            // leveluri trecute la rând, fără cădere
  chapterReset: false, // a patra greșeală a luat capitolul de la capăt
  chapterDone: false, // levelul ăsta a fost ultimul din capitol
  /* A cerut elevul explicația la itemul de acum? Numai la Level-up: acolo
     ecranul pleacă singur, iar cererea îl oprește până citește. Se stinge la
     fiecare item nou, ca butonul să se ceară din nou. */
  explanationAsked: false,
  timers: [],         // ceasurile mersului singur, oprite la orice plecare
  // — configurator (Classic / Adventure) —
  cfg: { years: new Set(), types: new Set(), allYears: true, allTypes: true },
  reported: new Set(),
  /* Propunerile de explicații: dacă profesorul m-a pornit, și în ce stare e
     ce am trimis până acum (id item → „in_asteptare”/„aprobata”/„respinsa”). */
  canPropose: false,
  proposals: {},
};

/* Stilurile proprii și le aduce singur modulul, socotite față de EL, nu față de
   pagina care-l cheamă: așa merge oriunde, fără să numere nimeni „../". */
function loadStyles() {
  if (document.querySelector("link[data-campina-css]")) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = new URL("../styles/tests-campina.css", import.meta.url).href;
  l.setAttribute("data-campina-css", "");
  document.head.appendChild(l);
}

// ---------- intrare ----------
export async function initTestGameCampina(mountEl, exam) {
  root = mountEl;
  J.exam = exam || "admitere-campina";
  loadStyles();
  if (!eventsBound) { bindEvents(); eventsBound = true; }
  if (!J.loaded) {
    renderLoading();
    await loadItems();
  }
  await loadProgress();
  render();
}

/* PROGRESUL STĂ PE CONT, nu în browser. Vizitatorul joacă mai departe, dar
   nimic nu-i rămâne după ce închide fila; i-o spunem pe față, în ecranul de
   alegere, în loc să-l lăsăm să afle singur. Nu ținem nimic în `localStorage`:
   pe un calculator împărțit, acolo ar fi ajuns munca lui sub ochii altuia. */
async function loadProgress() {
  if (!isLoggedIn()) { J.answers = {}; J.notes = {}; J.levelLog = new Map(); J.badges = new Set(); return; }
  /* Dacă serverul nu răspunde, jocul MERGE MAI DEPARTE, doar fără ce-ai lucrat
     înainte. Înainte, o singură chemare căzută oprea tot `init`-ul și pagina
     rămânea la „Se aduc itemii…", ceea ce arăta ca un joc stricat, nu ca o
     legătură proastă. */
  const [progressRows, levelLog, badges] = await Promise.all([
    fetchMyProgress(J.exam).catch(() => []),
    fetchMyLevels(J.exam).catch(() => []),
    fetchMyBadges(J.exam).catch(() => []),
  ]);
  J.answers = {};
  J.notes = {};
  for (const r of progressRows) {
    if (r.chosen) {
      J.answers[r.itemId] = {
        chosen: r.chosen, isRight: r.correct, key: r.answerKey,
        explanation: r.observation || "", historical: null,
      };
    }
    if (r.note) J.notes[r.itemId] = r.note;
  }
  J.levelLog = new Map(levelLog.map((l) => [l.level, { tries: l.tries, passed: l.passed }]));
  J.badges = new Set(badges.map((b) => b.code));

  /* Pot propune explicații? Se întreabă baza, nu se ghicește din rol: e o
     îngăduință pe care profesorul o aprinde și o stinge cât lucrează cu elevul.
     Dacă întrebarea cade, răspunsul e „nu": mai bine lipsește un câmp decât să
     scrie elevul într-un loc care oricum îl refuză. */
  J.canPropose = await canPropose().catch(() => false);
  J.proposals = J.canPropose ? await myProposals(J.exam).catch(() => ({})) : {};
}

/* Cel mai înalt level trecut se AFLĂ din leveluri, nu se ține de mână într-un
   contor: un contor s-ar putea desincroniza de listă, iar lista e adevărul. */
const maxLevel = () => {
  let m = 0;
  for (const [n, l] of J.levelLog) if (l.passed && n > m) m = n;
  return m;
};

async function loadItems() {
  const items = await fetchTestItems({ exam: J.exam });
  J.items = items;
  J.byId = new Map(items.map((it) => [it.id, it]));
  /* HÂRTIILE. O hârtie = o sesiune de admitere, adică o pereche an+sesiune.
     Ordinea LOR e alfabetică pe nume, nu pe calendar — și e voit: aici nu
     citești o arhivă, ci alegi dintr-o listă scurtă „pe care o rezolv?", iar o
     listă de ales se așază după eticheta pe care o citești. Calendarul e treaba
     paginii de descărcări, unde subiectele chiar sunt o cronologie. */
  const pe = new Map();
  for (const it of items) {
    const key = `${it.year}|${it.session}`;
    if (!pe.has(key)) pe.set(key, { key, year: it.year, sessionId: it.session, items: [] });
    pe.get(key).items.push(it);
  }
  J.papers = [...pe.values()].sort((a, b) => a.year - b.year || a.sessionId.localeCompare(b.sessionId, "ro"));
  J.papers.forEach((h) => h.items.sort((a, b) => (a.itemNo ?? 0) - (b.itemNo ?? 0)));
  /* NUMĂRUL GLOBAL, 1..N peste toată banca. Un item poartă pe hârtia lui un
     număr de la 1 la 60, iar acela se repetă la fiecare sesiune: în Level-up,
     unde treci prin toată banca în ordine, „itemul 7" n-ar spune nimic. Așa,
     „#412 din 902" spune și unde ești, și cât a mai rămas.

     Se scoate din ACEEAȘI listă din care `nivelele()` taie feliile de câte
     cinci, nu dintr-o socoteală paralelă. De aceea levelul L ține exact
     numerele (L-1)*5+1 … L*5, iar cele două nu se pot despărți niciodată.

     Adăugarea unei sesiuni NOI (an mai mare) lasă numerele de până acum neatinse
     și continuă de la capăt. O sesiune mai VECHE, strecurată între ani, le-ar
     muta pe toate de după ea; atunci s-ar muta și levelurile, deci problema ar
     fi oricum mai adâncă decât numerotarea, iar răspunsul ei ar fi un număr
     păstrat în bază. Până acolo, ordinea firească e și cea așteptată. */
  J.globalNo = new Map();
  let n = 0;
  for (const h of J.papers) for (const it of h.items) J.globalNo.set(it.id, ++n);

  J.years = [...new Set(J.papers.map((h) => h.year))].sort((a, b) => a - b);
  J.pickedYear = J.years[J.years.length - 1] ?? null;
  J.pickedPaper = papersOfYear(J.pickedYear)[0]?.key ?? null;
  J.cfg.years = new Set();
  J.cfg.types = new Set();
  J.loaded = true;
}

const papersOfYear = (year) => J.papers.filter((h) => h.year === year);
const paper = (key) => J.papers.find((h) => h.key === key) || null;
/* Numele scurt al unei hârtii: „V1 - ianuarie (Câmpina)" → „V1 · ianuarie".
   Școala e deja scrisă alături, ca etichetă; scrisă de două ori, n-ar spune
   nimic în plus și ar lungi fiecare pastilă. */
const shortName = (s) => String(s || "").replace(/\s*\([^()]+\)\s*$/, "").replace(/\s+-\s+/, " · ").trim();
const wakeFrom = (s) => (String(s || "").match(/\(([^()]+)\)\s*$/) || [])[1] || "";

// ---------- bucăți folosite de toate modurile ----------

function renderLoading() {
  root.className = "cmp";
  root.innerHTML = `<p class="cmp-wait">Se aduc itemii…</p>`;
}

/* Cele patru sloturi sunt MEREU desenate: un item cu trei variante păstrează al
   patrulea gol, ca blocul să nu-și schimbe înălțimea de la un item la altul și
   ochiul să nu sară. */
const optionsHtml = (it, cum) =>
  OPTS.map((k) => ((it.options?.[k] != null && it.options[k] !== "")
    ? cum(k)
    : `<span class="tgame-opt tgame-opt--void" aria-hidden="true"></span>`)).join("");

function typeLabels(it) {
  const l = (it.types || []).map((c) => `<span class="tgame-typelab">${esc(TYPE_LABEL[c] || c)}</span>`).join("");
  return l ? `<span class="tgame-types">${l}</span>` : "";
}

function itemHead(it) {
  return `<div class="tgame-cardmeta">
      ${typeLabels(it)}
      <span class="tgame-cardmeta__id">${it.year ?? ""}${it.session ? ` · ${esc(shortName(it.session))}` : ""}${it.itemNo != null ? ` · itemul ${it.itemNo}` : ""}</span>
      <span class="tgame-cardmeta__acts">
        ${J.reported.has(it.id)
          ? `<button type="button" class="tgame-report" disabled>⚑ semnalat</button>`
          : `<button type="button" class="tgame-report" data-act="report" data-id="${it.id}" title="Semnalează o eroare de conținut">⚑ eroare</button>`}
      </span>
    </div>`;
}

/* Verdictul, spus la fel peste tot. `historical` apare doar când răspunsul de azi
   diferă de cel de pe hârtie — și atunci merită spus, fiindcă elevul are baremul
   tipărit în față și ar crede că greșim noi. */
function verdictHtml(r, laCerere = false) {
  if (!r) return "";
  const are = !!(r.explanation || "").trim();
  /* LA CERERE, NUMAI LA LEVEL-UP. Acolo ecranul pleacă singur după 350 ms (ori
     700 la greșeală), deci o explicație pusă de-a dreptul abia ar clipi: n-ar
     apuca s-o citească nimeni, dar ar încărca ecranul la fiecare item. Iar
     Level-up e cursa cu poveste – acolo citești fragmentul, nu gramatica. Deci
     apare un buton, iar apăsarea lui OPREȘTE plecarea; altfel butonul ar fi o
     glumă: îl apeși și ecranul fuge de sub el.

     Butonul apare numai dacă itemul CHIAR are explicație: unul care se apasă și
     nu face nimic e mai rău decât unul care lipsește. */
  const explicatia = are
    ? `<div class="tgame-obs"><span class="tgame-obs__lab">Observație</span>${sanitizeRich(r.explanation)}</div>`
    : "";
  const laLevelUp = !laCerere ? explicatia
    : !are ? ""
      : J.explanationAsked
        ? `${explicatia}
           <button type="button" class="tgame-btn tgame-btn--primary cmp-resume" data-act="resume">Mai departe ▸</button>`
        /* ACEEAȘI ÎNFĂȚIȘARE ȘI ACELAȘI TEXT CA LA ADMITERE DREPT, unde butonul
           ăsta există de mult (`.tgame-obsbtn`, „Vezi explicația"). N-am inventat
           altul: două butoane care fac același lucru în două jocuri ale
           aceluiași sit n-au de ce arăta diferit. Dreptul nu e atins, doar i se
           împrumută clasa din foaia împărțită. */
        : `<button type="button" class="tgame-obsbtn" data-act="explain">Vezi explicația</button>`;
  return `<div class="tgame-verdict ${r.isRight ? "ok" : "no"}">${r.isRight
    ? "✓ Corect"
    : `✗ Greșit — corect era <b>${esc(r.key)}</b>`}</div>
    ${r.historical ? `<div class="tgame-hist">Pe gramatica veche, răspunsul era <b>${esc(r.historical)}</b>.</div>` : ""}
    ${laLevelUp}`;
}

// ---------- ecranul de alegere a modului ----------

const MODES = [
  {
    id: "relaxed", label: "Relaxed", sign: "🫖",
    scurt: "Tot subiectul, dintr-o privire",
    lung: `Alegi un an și o sesiune, iar subiectul întreg ți se așterne în față.
           Apeși o variantă: se face verde ori roșie pe loc. Lângă fiecare item
           ai un loc unde să-ți scrii explicația TA, iar aceea rămâne a ta.
           Fără lives, fără ceas, fără puncte.`,
  },
  {
    id: "classic", label: "Classic", sign: "🎯",
    scurt: "3 lives, 30 de itemi",
    lung: `Câte un item pe ecran. Pornești cu trei inimi și poți ajunge la șase:
           printre itemi sunt câțiva <b>extra life</b>, însemnați, care îți dau o
           inimă dacă-i nimerești și nu-ți iau niciuna dacă greșești. Runda ține
           până la 30 de itemi sau până rămâi fără lives.`,
  },
  {
    id: "adventure", label: "Adventure", sign: "🧭",
    scurt: "Tot, până iese",
    lung: `Toți itemii aleși, unul câte unul, numerotați. Cel greșit nu se pierde:
           se duce la coada rândului și revine mai târziu, până îl nimerești.
           Vezi mereu câți ai bun, câți greșit și câți ți-au mai rămas.`,
  },
  {
    id: "levelup", label: "Level-up", sign: "🔥",
    scurt: "5 itemi pe level, 3 greșeli pe capitol",
    lung: `Cinci itemi pe level, iar o greșeală îl închide. Ai voie la trei
           greșeli într-un capitol; a patra îl ia de la început, cu tot cu
           levelurile trecute în el. Cele 18 capitole duc un caz adevărat de
           furt de patrimoniu, de la alarma din muzeu până la sentință, iar
           fiecare level trecut descoperă un fragment nou din dosar.
           Pe drum aduni badges.`,
  },
];

function renderModePicker() {
  const n = J.items.length;
  const cards = MODES.map((m) => {
    const badge = m.id === "levelup" && maxLevel() > 0
      ? `<span class="cmp-mode__badge">Level ${maxLevel()}</span>` : "";
    return `<button type="button" class="cmp-mode" data-act="mode" data-mode="${m.id}">
        <span class="cmp-mode__sign" aria-hidden="true">${m.sign}</span>
        <span class="cmp-mode__body">
          <span class="cmp-mode__name">${esc(m.label)}${badge}</span>
          <span class="cmp-mode__short">${esc(m.scurt)}</span>
          <span class="cmp-mode__long">${m.lung}</span>
        </span>
      </button>`;
  }).join("");
  const noAccount = isLoggedIn() ? "" : `
    <p class="cmp-guest"><i class="cmp-guest__s" aria-hidden="true">🔓</i>
      Joci ca vizitator: totul merge, dar nimic nu se ține minte după ce închizi fila.
      Cu un cont, îți rămân bifele, explicațiile scrise de tine, levelurile și badges.</p>`;
  root.className = "cmp";
  root.innerHTML = `
    <section class="cmp-pick">
      <header class="cmp-pick__head">
        <h2 class="cmp-pick__title">Cum vrei să lucrezi azi?</h2>
        <p class="cmp-pick__sub">${n} de itemi din ${J.papers.length} sesiuni de admitere,
          de la Câmpina, Cluj-Napoca, Fălticeni, Drăgășani și Oradea.
          Patru feluri de a-i lua în piept.</p>
      </header>
      ${noAccount}
      <div class="cmp-modes">${cards}</div>
    </section>`;
}

// ---------- 1. RELAXAT ----------

/* O SINGURĂ CALE DE SALVARE pentru un item, ca să nu existe două care se pot
   despărți. Trimite tot rândul, și bifa, și explicația: masa are cheie primară
   pe (elev, item), deci scrierea e o suprapunere, nu o adăugare. */
async function saveItem(id) {
  if (!isLoggedIn()) return;
  const r = J.answers[id];
  if (!r) return;
  await saveMyProgress({
    exam: J.exam, itemId: id,
    chosen: r.chosen, correct: r.isRight, answerKey: r.key,
    observation: r.explanation, note: J.notes[id] || "",
  });

  /* NOTA PLEACĂ ȘI CA PROPUNERE, dar numai dacă sunt toate trei la un loc:
     profesorul m-a pornit, itemul n-are încă explicație, iar ce-am scris e o
     explicație, nu un început de frază. Nota rămâne oricum a mea, mai sus:
     propunerea e o copie trimisă, nu o mutare. */
  if (!J.canPropose) return;
  if ((r.explanation || "").trim()) return;             // itemul are deja explicație
  const text = (J.notes[id] || "").trim();
  if (text.length < 10) return;
  const ok = await proposeExplanation({ exam: J.exam, itemId: id, text });
  if (ok) J.proposals[id] = "in_asteptare";
}

/* Cât s-a lucrat dintr-o hârtie. Se numără din răspunsurile ținute minte, nu
   dintr-un contor de sine stătător: un contor s-ar putea desincroniza, lista de
   răspunsuri nu — ea E adevărul. */
function paperTally(h) {
  let answered = 0, rightCount = 0;
  for (const it of h.items) {
    const r = J.answers[it.id];
    if (!r) continue;
    answered++;
    if (r.isRight) rightCount++;
  }
  return { answered, rightCount, total: h.items.length };
}

function yearTabs() {
  return J.years.map((year) => {
    const hs = papersOfYear(year);
    const total = hs.reduce((a, h) => a + h.items.length, 0);
    const answered = hs.reduce((a, h) => a + paperTally(h).answered, 0);
    const done = answered >= total && total > 0;
    return `<button type="button" class="cmp-tab${year === J.pickedYear ? " is-on" : ""}${done ? " is-done" : ""}"
        role="tab" aria-selected="${year === J.pickedYear}" data-act="year" data-year="${year}"
        title="${year}: ${hs.length === 1 ? "o sesiune" : hs.length + " sesiuni"}, ${total} de itemi">
        <span class="cmp-tab__nr">${year}</span>
        <span class="cmp-tab__dots">${hs.map(() => "<i></i>").join("")}</span>
      </button>`;
  }).join("");
}

function paperChips() {
  return papersOfYear(J.pickedYear).map((h) => {
    const s = paperTally(h);
    const wake = wakeFrom(h.sessionId);
    return `<button type="button" class="cmp-paper${h.key === J.pickedPaper ? " is-on" : ""}"
        data-act="paper" data-key="${esc(h.key)}">
        <b>${esc(shortName(h.sessionId))}</b>
        ${wake ? `<span class="cmp-paper__school">${esc(wake)}</span>` : ""}
        <span class="cmp-paper__n">${s.answered}/${s.total}</span>
      </button>`;
  }).join("");
}

function relaxedItem(it, i) {
  const r = J.answers[it.id];
  const noteText = J.notes[it.id] || "";
  const options = optionsHtml(it, (k) => {
    let cls = "";
    if (r) {
      if (k === r.key) cls = " opt-correct";
      else if (k === r.chosen) cls = " opt-wrong";
    }
    return `<button type="button" class="tgame-opt${cls}" data-act="answer-relaxed"
        data-id="${it.id}" data-k="${k}"${r ? " disabled" : ""}>
        <span class="tgame-opt__k">${k}</span>
        <span class="tgame-opt__t">${sanitizeRich(it.options[k])}</span>
      </button>`;
  });
  /* Locul tău de explicat apare DOAR după ce ai ales. Înainte de asta ar fi o
     cutie goală lângă fiecare item — și, mai rău, te-ar pune să-ți motivezi un
     răspuns pe care încă nu l-ai dat. */
  /* Când elevul e pornit de profesor ȘI itemul n-are explicație, nota lui e și o
     propunere. I se spune limpede: altfel ar scrie pentru el și ar afla abia
     mai târziu că textul a plecat mai departe. */
  const propune = r && J.canPropose && !(r.explanation || "").trim();
  const proposalState = { in_asteptare: "trimisă profesorului", aprobata: "publicată la toți", respinsa: "nefolosită de data asta" }[J.proposals[it.id]] || "";
  const alTau = r ? `
    <div class="cmp-note${propune ? " e-propune" : ""}">
      <label class="cmp-note__lab" for="nota-${it.id}">Explicația ta${propune
        ? ` <span class="cmp-note__catre">ajunge și la profesor</span>` : ""}</label>
      <textarea class="cmp-note__in" id="nota-${it.id}" data-act="note" data-id="${it.id}"
        rows="2" maxlength="800"
        placeholder="${propune
          ? "Itemul ăsta n-are explicație. Scrie-o tu, cu vorbele tale; dacă profesorul o aprobă, o vor citi toți."
          : "De ce e corect așa? Scrie cu vorbele tale, te ajută la recitire."}">${esc(noteText)}</textarea>
      <span class="cmp-note__state" data-nota-stare="${it.id}">${noteText ? "✓ salvat" : ""}</span>
      ${proposalState ? `<span class="cmp-note__prop">${esc(proposalState)}</span>` : ""}
    </div>` : "";
  return `<article class="tgame-card cmp-item${r ? (r.isRight ? " is-correct" : " is-wrong") : ""}" data-id="${it.id}">
      <div class="cmp-item__nr" aria-hidden="true">${i + 1}</div>
      ${itemHead(it)}
      <p class="tgame-q">${it.question ? sanitizeRich(it.question) : "<em>(enunț indisponibil)</em>"}</p>
      <div class="tgame-opts">${options}</div>
      ${r ? `<div class="cmp-item__fb">${verdictHtml(r)}</div>` : ""}
      ${alTau}
    </article>`;
}

function renderRelaxed() {
  const h = paper(J.pickedPaper) || papersOfYear(J.pickedYear)[0];
  if (!h) { root.innerHTML = `<p class="cmp-wait">Nu sunt itemi aici.</p>`; return; }
  J.pickedPaper = h.key;
  const s = paperTally(h);
  const percent = s.total ? Math.round((s.answered / s.total) * 100) : 0;
  root.className = "cmp cmp--relax";
  root.innerHTML = `
    <section class="cmp-relax">
      ${topBar("Relaxed", "🫖")}
      <div class="cmp-tabs" role="tablist" aria-label="Anii cu subiecte">${yearTabs()}</div>
      <div class="cmp-papers">${paperChips()}</div>
      <div class="cmp-progress">
        <div class="cmp-progress__bar"><i style="width:${percent}%"></i></div>
        <p class="cmp-progress__txt">
          <b>${s.answered}</b> din ${s.total} rezolvați${s.answered ? ` · <b class="is-ok">${s.rightCount}</b> corecți` : ""}
          ${s.answered ? `<button type="button" class="cmp-link" data-act="clear-paper">șterge răspunsurile de aici</button>` : ""}
        </p>
      </div>
      <div class="cmp-list">${h.items.map((it, i) => relaxedItem(it, i)).join("")}</div>
    </section>`;
}

async function answerRelaxed(btnEl) {
  const id = btnEl.dataset.id;
  const k = btnEl.dataset.k;
  const card = btnEl.closest(".cmp-item");
  if (!id || !k || J.answers[id]) return;
  card?.classList.add("is-checking");
  /* FĂRĂ PUNCTE aici, dinadins: cu tot subiectul deschis, ai putea apăsa toate
     cele patru variante și le-ai aduna oricum. Punctele stau în modurile unde
     un item îți e pus o singură dată. */
  const r = await checkTestItem(id, k);
  card?.classList.remove("is-checking");
  if (!r) { showToast("N-am putut verifica acum. Mai încearcă."); return; }
  J.answers[id] = {
    chosen: k, isRight: r.correct, key: r.correctAnswer,
    explanation: r.observation || "", historical: r.historical || null,
  };
  saveItem(id);
  /* Se redesenează DOAR cardul acesta, nu toată lista: pe o sesiune de 60 de
     itemi, un redesen întreg ar arunca pagina înapoi sus și ai pierde locul. */
  const fresh = document.createElement("div");
  const it = J.byId.get(id);
  const i = (paper(J.pickedPaper)?.items || []).findIndex((x) => x.id === id);
  fresh.innerHTML = relaxedItem(it, i < 0 ? 0 : i);
  card?.replaceWith(fresh.firstElementChild);
  refreshTally();
}

/* Numai cifrele de sus, nu toată pagina — vezi motivul de mai sus. */
function refreshTally() {
  const h = paper(J.pickedPaper);
  if (!h) return;
  const s = paperTally(h);
  const percent = s.total ? Math.round((s.answered / s.total) * 100) : 0;
  const bara = root.querySelector(".cmp-progress__bar i");
  if (bara) bara.style.width = `${percent}%`;
  const txt = root.querySelector(".cmp-progress__txt");
  if (txt) {
    txt.innerHTML = `<b>${s.answered}</b> din ${s.total} rezolvați${s.answered ? ` · <b class="is-ok">${s.rightCount}</b> corecți` : ""}
      ${s.answered ? `<button type="button" class="cmp-link" data-act="clear-paper">șterge răspunsurile de aici</button>` : ""}`;
  }
  const chips = root.querySelector(".cmp-papers");
  if (chips) chips.innerHTML = paperChips();
  const file = root.querySelector(".cmp-tabs");
  if (file) file.innerHTML = yearTabs();
}

let noteTimer = null;
function writeNote(field) {
  const id = field.dataset.id;
  if (!id) return;
  J.notes[id] = field.value;
  const stare = root.querySelector(`[data-nota-stare="${id}"]`);
  if (stare) stare.textContent = "se scrie…";
  clearTimeout(noteTimer);
  /* Se scrie la o secundă după ce te-ai oprit din tastat, nu la fiecare literă:
     altfel am bate drumul la server de zeci de ori pe rând, degeaba. */
  noteTimer = setTimeout(async () => {
    if (!isLoggedIn()) { if (stare) stare.textContent = "nesalvat (n-ai cont)"; return; }
    if (stare) stare.textContent = "se salvează…";
    await saveItem(id);
    if (stare) stare.textContent = J.notes[id] ? "✓ salvat" : "";
  }, 1000);
}

async function clearPaper() {
  const h = paper(J.pickedPaper);
  if (!h) return;
  const ids = h.items.map((it) => it.id).filter((id) => J.answers[id]);
  for (const id of ids) delete J.answers[id];
  renderRelaxed();
  /* Ștergerea locală se vede pe loc, iar cea de pe server vine din urmă. Dacă
     serverul refuză, spun; nu prefac că s-a întâmplat. */
  if (isLoggedIn() && ids.length) {
    const bun = await clearMyProgress(ids);
    if (!bun) { showToast("N-am putut șterge pe server. Reîncarcă pagina."); return; }
  }
  showToast("Sesiunea e din nou nerezolvată.");
}

// ---------- bara de sus, comună modurilor ----------

/* ÎNTOARCEREA E PE O TREAPTĂ, nu până la capăt. Din interiorul unui level,
   butonul duce la harta levelurilor, fiindcă acolo vrei să ajungi: să alegi
   altul. Abia de pe hartă se iese din Level-up. Un singur buton care sărea de la
   item drept la alegerea modului te scotea din tot ce făceai, iar drumul înapoi
   trebuia refăcut de fiecare dată. */
function topBar(label, sign, dreapta = "", backTo = "back") {
  const toMap = backTo === "map";
  return `<header class="cmp-top">
      <button type="button" class="cmp-back" data-act="${toMap ? "map" : "back"}"
        title="${toMap ? "Înapoi la harta levelurilor" : "Înapoi la alegerea modului"}">‹ ${toMap ? "map" : "modes"}</button>
      <span class="cmp-top__mode"><span aria-hidden="true">${sign}</span> ${esc(label)}</span>
      <span class="cmp-top__right">${dreapta}</span>
    </header>`;
}

// ---------- semnalarea unei erori ----------

function askReport(id) {
  const it = J.byId.get(id);
  if (!it) return;
  const dlg = document.createElement("dialog");
  dlg.className = "cmp-dlg";
  dlg.innerHTML = `
    <form method="dialog" class="cmp-dlg__in">
      <h3 class="cmp-dlg__title">Ce nu e în regulă la itemul ${it.itemNo ?? ""}?</h3>
      <p class="cmp-dlg__sub">Scrie pe scurt: enunț greșit, variantă lipsă, răspuns care nu se
        potrivește cu baremul tipărit… Profesorul primește semnalarea și-ți răspunde.</p>
      <textarea class="cmp-dlg__txt" rows="4" maxlength="500" required
        placeholder="ex.: în barem răspunsul e C, dar aplicația spune B"></textarea>
      <menu class="cmp-dlg__acts">
        <button value="nu" class="tgame-btn">Renunț</button>
        <button value="da" class="tgame-btn tgame-btn--primary">Trimit</button>
      </menu>
    </form>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", async () => {
    const text = dlg.querySelector(".cmp-dlg__txt")?.value?.trim() || "";
    dlg.remove();
    if (dlg.returnValue !== "da" || !text) return;
    const chosen = J.answers[id]?.chosen || J.currentAnswer?.chosen || null;
    const bun = await reportTestItem(id, text, chosen);
    if (!bun) { showToast("N-am putut trimite semnalarea."); return; }
    J.reported.add(id);
    showToast("Trimis. Mulțumesc — profesorul se uită.");
    /* Se schimbă DOAR butonul acelui item, nu tot ecranul: în Relaxed, un
       redesen ar arunca pagina înapoi sus, iar tu tocmai citeai itemul 47. */
    for (const b of root.querySelectorAll(`[data-act="report"][data-id="${id}"]`)) {
      b.outerHTML = `<button type="button" class="tgame-report" disabled>⚑ semnalat</button>`;
    }
  });
  dlg.showModal();
}

// ---------- 2+3. CLASIC și AVENTURA: configuratorul ----------

const CLASSIC_LIMIT = 30; // cel mult atâția itemi într-o rundă de Classic
const START_LIVES = 3;
const MAX_LIVES = 6;
/* Cam unul din șase itemi e „de viață". Nu un număr fix: pe o rundă scurtă,
   fix-ul ar fi ori prea generos, ori inexistent. */
const LIFE_RARITY = 6;

const hasTypes = () => J.items.some((it) => (it.types || []).length);

function matchingItems() {
  return J.items.filter((it) => {
    if (!J.cfg.allYears && !J.cfg.years.has(it.year)) return false;
    if (!J.cfg.allTypes) {
      const t = it.types || [];
      if (!t.some((x) => J.cfg.types.has(x))) return false;
    }
    return true;
  });
}

/* Amestecul lui Fisher–Yates, cu perechi schimbate de la coadă spre cap: e
   singurul care dă fiecărei ordini aceeași șansă. Sortarea cu `Math.random()`
   în comparator pare că face același lucru, dar nu-i adevărat. */
function shuffle(a) {
  const v = a.slice();
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [v[i], v[j]] = [v[j], v[i]];
  }
  return v;
}

function yearChip(year, pornit) {
  const cati = J.items.filter((it) => it.year === year).length;
  return `<button type="button" class="cmp-chip${pornit ? " is-on" : ""}"
      data-act="cfg-year" data-year="${year}">${year}<span class="cmp-chip__n">${cati}</span></button>`;
}

function typeCounts() {
  const n = {};
  for (const it of matchingItems()) for (const t of (it.types || [])) n[t] = (n[t] || 0) + 1;
  return n;
}

function renderConfig() {
  const matching = matchingItems();
  const isClassic = J.screen === "classic";
  const cati = isClassic ? Math.min(matching.length, CLASSIC_LIMIT) : matching.length;
  const nT = typeCounts();
  const typeBlock = hasTypes() ? `
    <div class="cmp-cfg__block">
      <p class="cmp-cfg__lab">Ce fel de itemi</p>
      <div class="cmp-chips">
        <button type="button" class="cmp-chip${J.cfg.allTypes ? " is-on" : ""}" data-act="cfg-all-types">Toate</button>
        ${TEST_ITEM_TYPES.filter((t) => nT[t.code] || J.cfg.types.has(t.code)).map((t) => `
          <button type="button" class="cmp-chip${J.cfg.types.has(t.code) ? " is-on" : ""}"
            data-act="cfg-type" data-type="${t.code}">${esc(t.label)}<span class="cmp-chip__n">${nT[t.code] || 0}</span></button>`).join("")}
      </div>
    </div>` : `
    <p class="cmp-cfg__note">Etichetele pe tipuri (sintaxa frazei, morfologie, fonetică…)
      încă se pun, item cu item. Când apar, vei putea alege și după ele.</p>`;
  const regula = isClassic
    ? `<ul class="cmp-rules">
        <li><b>${START_LIVES} lives</b> la pornire, cel mult ${MAX_LIVES}.</li>
        <li>Itemii însemnați <b>extra life</b> îți dau o inimă dacă-i nimerești și nu-ți iau niciuna dacă greșești.</li>
        <li>Runda ține până la <b>${CLASSIC_LIMIT} de itemi</b> sau până rămâi fără <b>lives</b>.</li>
      </ul>`
    : `<ul class="cmp-rules">
        <li>Toți itemii aleși, unul câte unul, <b>numerotați</b>.</li>
        <li>Itemul greșit se duce <b>la coada rândului</b> și revine până îl nimerești.</li>
        <li>Se termină când n-a mai rămas niciunul nerezolvat.</li>
      </ul>`;
  const m = MODES.find((x) => x.id === J.screen);
  root.className = "cmp cmp--cfg";
  root.innerHTML = `
    <section class="cmp-cfg">
      ${topBar(m.label, m.sign)}
      <div class="cmp-cfg__grid">
        <div class="cmp-cfg__left">
          <div class="cmp-cfg__block">
            <p class="cmp-cfg__lab">Din ce ani</p>
            <div class="cmp-chips">
              <button type="button" class="cmp-chip${J.cfg.allYears ? " is-on" : ""}" data-act="cfg-all-years">Toți anii</button>
              ${J.years.map((year) => yearChip(year, J.cfg.years.has(year))).join("")}
            </div>
          </div>
          ${typeBlock}
        </div>
        <aside class="cmp-cfg__right">
          <p class="cmp-cfg__count"><b>${cati}</b> ${cati === 1 ? "item" : "de itemi"}</p>
          ${isClassic && matching.length > CLASSIC_LIMIT
            ? `<p class="cmp-cfg__sub">aleși la întâmplare din ${matching.length}</p>` : ""}
          ${regula}
          <button type="button" class="tgame-btn tgame-btn--primary cmp-go"
            data-act="start"${cati ? "" : " disabled"}>Start ▸</button>
          ${cati ? "" : `<p class="cmp-cfg__sub">Nicio potrivire — mai lasă un an ori un tip.</p>`}
        </aside>
      </div>
    </section>`;
}

// ---------- 2+3. runda propriu-zisă ----------

function startRun() {
  const matching = matchingItems();
  if (!matching.length) return;
  const isClassic = J.screen === "classic";
  let queue = shuffle(matching.map((it) => it.id));
  if (isClassic) queue = queue.slice(0, CLASSIC_LIMIT);
  J.queue = queue;
  J.position = 0;
  J.rightCount = 0; J.wrongCount = 0; J.points = 0;
  J.currentAnswer = null;
  J.done = false;
  J.lives = isClassic ? START_LIVES : 0;
  J.sessionId = uuid();
  /* Itemii „de viață" se aleg ACUM, o dată pe rundă, nu la desenarea fiecărui
     item: altfel s-ar reașeza la orice redesen și ai vedea inima apărând și
     dispărând pe același item. */
  J.lifeItems = new Set();
  if (isClassic) {
    const cate = Math.max(1, Math.round(queue.length / LIFE_RARITY));
    shuffle(queue).slice(0, cate).forEach((id) => J.lifeItems.add(id));
  }
  J.phase = "play";
  render();
}

const currentItem = () => J.byId.get(J.queue[J.position]) || null;
const inimi = () => Array.from({ length: MAX_LIVES }, (_, i) =>
  `<i class="cmp-heart${i < J.lives ? " is-on" : ""}" aria-hidden="true">${i < J.lives ? "❤" : "♡"}</i>`).join("");

function roundHud() {
  if (J.screen === "classic") {
    return `<div class="cmp-hud">
        <span class="cmp-hud__lives" aria-label="${J.lives} lives din ${MAX_LIVES}">${inimi()}</span>
        <span class="cmp-hud__pos">${Math.min(J.position + 1, J.queue.length)} / ${J.queue.length}</span>
        <span class="cmp-hud__sc"><b class="is-ok">${J.rightCount}</b> · <b class="is-no">${J.wrongCount}</b></span>
      </div>`;
  }
  const left = J.queue.length - J.position;
  return `<div class="cmp-hud">
      <span class="cmp-hud__pos">Item ${Math.min(J.position + 1, J.queue.length)}</span>
      <span class="cmp-hud__sc"><b class="is-ok">${J.rightCount}</b> corecte · <b class="is-no">${J.wrongCount}</b> greșite</span>
      <span class="cmp-hud__left">${left} ${left === 1 ? "rămas" : "rămași"}</span>
    </div>`;
}

function renderRound() {
  if (J.phase !== "play") return renderConfig();
  if (J.done) return renderFinal();
  const it = currentItem();
  if (!it) return renderFinal();
  const r = J.currentAnswer;
  const viata = J.lifeItems.has(it.id);
  const options = optionsHtml(it, (k) => {
    let cls = "";
    if (r) {
      if (k === r.key) cls = " opt-correct";
      else if (k === r.chosen) cls = " opt-wrong";
    }
    return `<button type="button" class="tgame-opt${cls}" data-act="answer"
        data-k="${k}"${r ? " disabled" : ""}>
        <span class="tgame-opt__k">${k}</span>
        <span class="tgame-opt__t">${sanitizeRich(it.options[k])}</span>
      </button>`;
  });
  const m = MODES.find((x) => x.id === J.screen);
  root.className = "cmp cmp--play";
  root.innerHTML = `
    <section class="cmp-play">
      ${topBar(m.label, m.sign, roundHud())}
      <article class="tgame-card cmp-card${viata ? " is-life" : ""}${r ? (r.isRight ? " is-correct" : " is-wrong") : ""}" data-id="${it.id}">
        ${viata ? `<span class="cmp-lifetag" title="Extra life: nimerit, îți dă o inimă; greșit, nu-ți ia niciuna">❤ extra life</span>` : ""}
        ${itemHead(it)}
        <p class="tgame-q">${it.question ? sanitizeRich(it.question) : "<em>(enunț indisponibil)</em>"}</p>
        <div class="tgame-opts">${options}</div>
        ${r ? `<div class="cmp-item__fb">${verdictHtml(r)}
            ${r.points ? `<p class="cmp-pts">+${r.points} puncte</p>` : ""}</div>
          <div class="cmp-next"><button type="button" class="tgame-btn tgame-btn--primary" data-act="next">Continue ▸</button></div>` : ""}
      </article>
    </section>`;
}

async function answer(btnEl) {
  const it = currentItem();
  if (!it || J.currentAnswer) return;
  const k = btnEl.dataset.k;
  const card = root.querySelector(".cmp-card");
  card?.classList.add("is-checking");
  const r = await answerTestItem(it.id, k, J.sessionId);
  card?.classList.remove("is-checking");
  if (!r) { showToast("N-am putut verifica acum. Mai încearcă."); return; }
  J.currentAnswer = {
    chosen: k, isRight: r.correct, key: r.correctAnswer,
    explanation: r.observation || "", historical: r.historical || null,
    points: r.awarded ? r.points : 0,
  };
  if (r.correct) { J.rightCount++; J.points += J.currentAnswer.points; } else J.wrongCount++;
  if (J.screen === "classic") {
    if (r.correct && J.lifeItems.has(it.id) && J.lives < MAX_LIVES) J.lives++;
    else if (!r.correct && !J.lifeItems.has(it.id)) J.lives--;
  }
  render();
}

function goOn() {
  const r = J.currentAnswer;
  const it = currentItem();
  J.currentAnswer = null;
  if (J.screen === "classic") {
    if (J.lives <= 0) { J.done = true; return render(); }
    J.position++;
    if (J.position >= J.queue.length) J.done = true;
    return render();
  }
  /* AVENTURA: greșitul nu se pierde, se mută la coada rândului. Se scoate din
     locul lui ȘI se pune la capăt — altfel ar rămâne și acolo, iar rândul ar
     crește la nesfârșit. Poziția nu înaintează, fiindcă itemul de după el a
     luat exact locul pe care-l părăsește. */
  if (r && !r.isRight && it) {
    J.queue.splice(J.position, 1);
    J.queue.push(it.id);
  } else {
    J.position++;
  }
  if (J.position >= J.queue.length) J.done = true;
  render();
}

function renderFinal() {
  const isClassic = J.screen === "classic";
  const total = J.rightCount + J.wrongCount;
  const percent = total ? Math.round((J.rightCount / total) * 100) : 0;
  const noLives = isClassic && J.lives <= 0;
  const title = noLives ? "Game Over" : isClassic ? "Run complete" : "All clear";
  const m = MODES.find((x) => x.id === J.screen);
  root.className = "cmp cmp--done";
  root.innerHTML = `
    <section class="cmp-done">
      ${topBar(m.label, m.sign)}
      <div class="cmp-done__in">
        <p class="cmp-done__sign" aria-hidden="true">${noLives ? "💔" : percent >= 80 ? "🏆" : "🫡"}</p>
        <h2 class="cmp-done__title">${esc(title)}</h2>
        <p class="cmp-done__stats">
          <b class="is-ok">${J.rightCount}</b> corecte · <b class="is-no">${J.wrongCount}</b> greșite
          ${total ? ` · <b>${percent}%</b>` : ""}
          ${J.points ? ` · <b class="is-pts">+${J.points}</b> puncte` : ""}
        </p>
        ${!isLoggedIn() ? `<p class="cmp-done__hint">Punctele se strâng doar dacă ai cont. Fără el, exersezi liniștit, dar nu urci în clasament.</p>` : ""}
        <div class="cmp-done__acts">
          <button type="button" class="tgame-btn tgame-btn--primary" data-act="again">Play again</button>
          <button type="button" class="tgame-btn" data-act="back">Alt mod</button>
        </div>
      </div>
    </section>`;
}

// ---------- 4. LEVEL-UP ----------

const ITEMS_PER_LEVEL = 5;
/* CAPITOLELE vin din `campina-poveste.js`: acolo e text, aici e joc. Un capitol
   ține zece levels, iar fiecare level trecut descoperă un fragment din caz.

   De ce zece, și nu douăzeci și doi ca la început: la 22 de levels, capătul
   unui capitol venea o dată la o oră bună de joc, iar povestea se târa. La
   zece, fiecare seară de învățat mută dosarul mai departe. */

/* BADGES. Trei feluri, și niciunul nu se dă pentru simplă înaintare:
   · faptele (First Step, Hot Streak, On Fire, Comeback, Halfway) se câștigă
     făcând ceva anume, nu ajungând undeva;
   · worlds (Dawn Cleared, Forest Cleared…) se câștigă la capătul unui world.
   „Perfect" ar fi fost o insignă goală: în Level-up, un level trecut e ORICUM 5
   din 5, fiindcă o greșeală îl închide. O insignă care se dă mereu nu spune
   nimic, așa că n-am pus-o. */
const BADGE_INFO = {
  "first-step": { label: "First Step", sign: "🐣", de_ce: "primul level trecut" },
  "hot-streak": { label: "Hot Streak", sign: "✨", de_ce: "3 levels la rând, fără cădere" },
  "on-fire":    { label: "On Fire",    sign: "🔥", de_ce: "10 levels la rând, fără cădere" },
  "comeback":   { label: "Comeback",   sign: "💪", de_ce: "ai trecut un level pe care picaseși" },
  "halfway":    { label: "Halfway",    sign: "🧭", de_ce: "jumătate din drum" },
};
/* PREFIXUL SE SCRIE O SINGURĂ DATĂ, iar tăierea se măsoară din el. Prima formă
   avea prefixul într-un loc și lungimea lui scrisă cu mâna în altul: la
   redenumirea din `world-` în `cap-`, prefixul s-a schimbat, cifra 6 a rămas,
   iar `"cap-1".slice(6)` a dat gol. De acolo ieșea capitolul −1 și tot ecranul
   hărții crăpa. Nu se vedea decât după ce câștigai o insignă de capitol.
   Acum lungimea nu mai poate rămâne în urmă: se socotește din prefix. */
const CHAPTER_PREFIX = "cap-";
const chapterCode = (i) => `${CHAPTER_PREFIX}${i + 1}`;

/* Insigna unui capitol poartă numele pasului din dosar, nu „X Cleared": lipit
   după un nume românesc, cuvântul englezesc suna a traducere neterminată, iar
   „Amprente ridicate" spune și ce-ai făcut, nu doar că ai terminat ceva.

   Întoarce `null` pentru un capitol care nu există. O insignă rămasă de la o
   numerotare veche n-are voie să golească ecranul: e o podoabă, nu un stâlp. */
const chapterBadge = (i) => {
  const c = CHAPTERS[i];
  return c ? { label: c.badge, sign: c.sign, de_ce: `ai încheiat capitolul „${c.title}”` } : null;
};
const badgeInfo = (cod) => BADGE_INFO[cod]
  || (cod.startsWith(CHAPTER_PREFIX) ? chapterBadge(Number(cod.slice(CHAPTER_PREFIX.length)) - 1) : null);

/* Toți itemii, în ordinea lor firească (an, sesiune, numărul de pe hârtie),
   tăiați în felii de câte cinci. Ordinea e AȘEZATĂ, nu amestecată: un level
   trebuie să fie de fiecare dată același, altfel „am trecut de 37" n-ar
   însemna nimic. Și, fiindcă felia urmează hârtia, un level e chiar o bucată
   dintr-un subiect adevărat. */
function levelNumbers() {
  const toti = J.papers.flatMap((h) => h.items.map((it) => it.id));
  const chapterList = [];
  for (let i = 0; i < toti.length; i += ITEMS_PER_LEVEL) chapterList.push(toti.slice(i, i + ITEMS_PER_LEVEL));
  return chapterList;
}

const levelCount = () => levelNumbers().length;

/* HOTARELE UNUI CAPITOL. Ultimul capitol înghite ce prisosește peste socoteala
   rotundă, la fel ca pe hartă: dacă banca mai crește, levelurile în plus au
   unde sta. */
function chapterBounds(cap) {
  const firstLevel = cap * LEVELS_PER_CHAPTER + 1;
  const lastLevel = cap === CHAPTERS.length - 1
    ? Math.max(levelCount(), firstLevel)
    : Math.min(firstLevel + LEVELS_PER_CHAPTER - 1, levelCount());
  return { firstLevel, lastLevel };
}

/* GREȘELILE DINTR-UN CAPITOL nu se țin într-un contor aparte: se socotesc din
   ce e deja scris. Fiecare level are numărul lui de încercări, iar o încercare
   care n-a fost cea izbutită e o greșeală. Deci:

       greșeli = (toate încercările din capitol) − (levelurile trecute)

   De ce așa: un contor de sine stătător ar trebui ținut la zi în trei locuri
   (la cădere, la trecere, la resetare) și s-ar desincroniza de restul la prima
   scăpare. Așa, nu poate minți: dacă levelurile sunt adevărul, și numărul e. */
const MISTAKES_PER_CHAPTER = 3;
function mistakesIn(cap) {
  const { firstLevel, lastLevel } = chapterBounds(cap);
  let tries = 0, cleared = 0;
  for (let n = firstLevel; n <= lastLevel; n++) {
    const l = J.levelLog.get(n);
    if (!l) continue;
    tries += l.tries;
    if (l.passed) cleared++;
  }
  return Math.max(0, tries - cleared);
}
const mistakesLeft = (cap) => Math.max(0, MISTAKES_PER_CHAPTER - mistakesIn(cap));
const chapterOfLevel = (n) => Math.min(CHAPTERS.length - 1, Math.floor((n - 1) / LEVELS_PER_CHAPTER));
/* Cât de încins e levelul ÎN world-ul lui: 0 la primul, 1 la al 22-lea. Din el
   iese și tăria fundalului, ca lumina să crească pe măsură ce urci, nu doar
   când sari dintr-un world în altul. */
const heat = (n) => {
  const inner = (n - 1) % LEVELS_PER_CHAPTER;
  return LEVELS_PER_CHAPTER > 1 ? inner / (LEVELS_PER_CHAPTER - 1) : 0;
};
const isLastChapter = (i) => i === CHAPTERS.length - 1;  // Sentința: fundal viu

/* Fundalul unui level. Tăria se socotește AICI, în JavaScript, și pleacă spre
   CSS ca număr gata făcut: `color-mix` cu procent calculat merge în browserele
   noi, dar nu în toate, iar un fundal care lipsește pe unele ecrane ar fi fost
   un preț prea mare pentru o linie mai scurtă. */
function chapterSkin(n) {
  const i = chapterOfLevel(n);
  const L = CHAPTERS[i];
  const strength = (7 + Math.round(heat(n) * 15)) + "%";
  return `--cap:${L.color}; --tarie:${strength}; --zbor:${FLY_MS}ms; --pompa:${PUMP_MS}ms; --pompe:${PUMPS}`;
}

function renderLevelUp() {
  if (J.phase === "play") return renderLevel();
  if (J.phase === "done") return renderLevelEnd();
  return renderMap();
}

/* INSIGNELE, TOATE ÎNTR-UN LOC, deasupra cardului. Prima formă le punea pe o
   orbită în jurul lui, socotindu-le poziția cu sinus și cosinus. Arăta bine cu
   două, dar la opt se împrăștiau pe toată lățimea, iar ochiul le căuta una câte
   una în loc să le vadă dintr-o privire. Un rând strâns le ține împreună și le
   lasă să curgă pe al doilea rând când se înmulțesc, fără nicio socoteală. */
function badgesHtml() {
  const codes = [...J.badges];
  if (!codes.length) return "";
  const parts = codes.map((cod) => {
    const d = badgeInfo(cod);
    if (!d) return "";
    const noua = J.freshBadges.has(cod) ? " e-noua" : "";
    return `<span class="cmp-badge${noua}" title="${esc(d.label)}: ${esc(d.de_ce)}">
        <i aria-hidden="true">${d.sign}</i><b>${esc(d.label)}</b>
      </span>`;
  }).join("");
  return `<div class="cmp-badges" aria-label="Badges câștigate">${parts}</div>`;
}

function renderMap() {
  const chapterList = levelNumbers();
  const cleared = maxLevel();
  const unfolded = cleared + 1; // levelul următor celui atins e deschis
  /* CÂTE WORLDS SE VĂD. Doar cele la care ai ajuns, plus UNA închisă, fără nume.
     Nu-i o toană: un drum al cărui capăt îl vezi din prima nu mai e un drum, e o
     listă. Ținând worlds-urile acoperite, fiecare capăt de world descoperă o
     bucată din poveste, iar cazul chiar se desfășoară pe măsură ce înveți.

     Ușa închisă rămâne totuși desenată, cu numărul ei: altfel harta ar minți în
     partea cealaltă, lăsând impresia că nu mai urmează nimic. Iar dedesubt scrie
     limpede câte au mai rămas, ca să știi cât drum ai.

     Regula se sprijină pe cea a levelurilor, nu se bate cu ea: levelurile se
     deschid unul câte unul, deci ca să ajungi la primul level al unui capitol
     trebuie oricum să le fi trecut pe toate ale celui dinainte. */
  const lastOpen = CHAPTERS.findIndex((_, li) => cleared < li * LEVELS_PER_CHAPTER);
  const visibleCount = lastOpen === -1 ? CHAPTERS.length : lastOpen; // câte sunt DESCHISE
  const lumi = CHAPTERS.map((L, li) => {
    if (li > visibleCount) return "";          // dincolo de ușa închisă: nimic
    if (li === visibleCount) {                  // chiar ușa închisă
      const cerut = CHAPTERS[li - 1]?.title || "";
      return `<section class="cmp-cap cmp-cap--inchis" aria-label="Chapter ${li + 1}, încă închis">
          <header class="cmp-cap__head">
            <span class="cmp-cap__sign" aria-hidden="true">🔒</span>
            <b class="cmp-cap__name">Chapter ${li + 1}</b>
            <span class="cmp-cap__n">${cerut ? `se deschide când închei „${esc(cerut)}”` : ""}</span>
          </header>
        </section>`;
    }
    const firstLevel = li * LEVELS_PER_CHAPTER + 1;
    /* ULTIMUL CAPITOL ÎNGHITE TOT CE PRISOSEȘTE. Cele 18 capitole a câte zece
       acoperă 180 de levels, iar banca de azi are 176. Prima sesiune adăugată
       strică socoteala, iar `capitolulLevelului` retează oricum la ultimul
       capitol. Dacă harta ar tăia și ea la zece, levelurile de peste capătul
       socotelii n-ar mai apărea nicăieri: ar exista, s-ar putea juca prin
       adresa lor, dar n-ar avea buton. Ultimul capitol crește, nu ascunde. */
    const lastLevel = li === CHAPTERS.length - 1
      ? chapterList.length
      : Math.min(firstLevel + LEVELS_PER_CHAPTER - 1, chapterList.length);
    if (firstLevel > chapterList.length) return "";
    const squares = [];
    for (let n = firstLevel; n <= lastLevel; n++) {
      const l = J.levelLog.get(n);
      const done = !!(l && l.passed);
      const deschis = n <= unfolded;
      const fallen = !done && l && l.tries > 0;
      /* Ce itemi ține levelul, scris în tooltip: numerele ies din aceeași
         ordine, deci levelul n ține exact (n-1)*5+1 … n*5. */
      const firstItemNo = (n - 1) * ITEMS_PER_LEVEL + 1;
      const lastItemNo = Math.min(n * ITEMS_PER_LEVEL, J.globalNo.size);
      squares.push(`<button type="button" class="cmp-lvl${done ? " is-done" : ""}${fallen ? " is-tried" : ""}${deschis ? "" : " is-locked"}"
          data-act="level" data-n="${n}"${deschis ? "" : " disabled"}
          title="${deschis ? `Level ${n} · itemii #${firstItemNo}-${lastItemNo}${l ? ` · ${l.tries} ${l.tries === 1 ? "încercare" : "încercări"}` : ""}` : "Se deschide după levelul dinainte"}">${n}</button>`);
    }
    const clearedHere = [...J.levelLog].filter(([n, l]) => l.passed && n >= firstLevel && n <= lastLevel).length;
    /* POVESTEA STRÂNSĂ. Fragmentele levelurilor trecute din capitolul ăsta, în
       ordine. Ele nu se pierd după ce le-ai văzut o dată: harta e și locul unde
       reciteşti ce-ai aflat până acum, ca la o carte pe care o iei de pe raft. */
    const povestea = [];
    for (let n = firstLevel; n <= lastLevel; n++) {
      if (!J.levelLog.get(n)?.passed) continue;
      const f = storyFragment(n);
      if (f) povestea.push(`<li class="cmp-frag"><b>${n}</b><span>${esc(f)}</span></li>`);
    }
    return `<section class="cmp-cap${isLastChapter(li) ? " e-final" : ""}" style="--cap:${L.color}">
        <header class="cmp-cap__head">
          <span class="cmp-cap__sign" aria-hidden="true">${L.sign}</span>
          <b class="cmp-cap__name">Chapter ${li + 1} · ${esc(L.title)}</b>
          <span class="cmp-cap__n">${clearedHere} / ${lastLevel - firstLevel + 1}</span>
        </header>
        ${cleared >= firstLevel - 1 && cleared <= lastLevel ? `<p class="cmp-cap__vieti"
          title="A patra greșeală ia capitolul de la capăt">Greșeli rămase în capitol:
          <b>${mistakesLeft(li)}</b> din ${MISTAKES_PER_CHAPTER}</p>` : ""}
        <div class="cmp-lvls">${squares.join("")}</div>
        ${povestea.length ? `<ol class="cmp-frags">${povestea.join("")}</ol>` : ""}
      </section>`;
  }).join("");
  const gallery = [...J.badges].map((cod) => {
    const d = badgeInfo(cod);
    return d ? `<span class="cmp-chip is-on" title="${esc(d.de_ce)}"><i aria-hidden="true">${d.sign}</i> ${esc(d.label)}</span>` : "";
  }).join("");
  root.className = "cmp cmp--map";
  root.innerHTML = `
    <section class="cmp-map">
      ${topBar("Level-up", "🔥", `<span class="cmp-hud__pos">Level ${cleared} / ${chapterList.length}</span>`)}
      <p class="cmp-map__intro">Cinci itemi pe level. O greșeală îl închide, iar
        <b>trei greșeli îți sunt îngăduite pe capitol</b>: a patra ia capitolul de la
        început. Levelurile sunt aceleași de fiecare dată, deci a doua oară le știi,
        iar fiecare level trecut descoperă un fragment din dosar.</p>
      ${gallery ? `<div class="cmp-gallery"><span class="cmp-gallery__lab">Badges</span>${gallery}</div>` : ""}
      ${lumi}
      ${visibleCount + 1 < CHAPTERS.length
        ? `<p class="cmp-map__rest">Mai sunt <b>${CHAPTERS.length - visibleCount - 1}</b> chapters dincolo de acesta.
             Se deschid pe rând, pe măsură ce dosarul înaintează.</p>`
        : ""}
    </section>`;
}

function startLevel(n) {
  const chapterList = levelNumbers();
  if (n < 1 || n > chapterList.length || n > maxLevel() + 1) return;
  J.level = n;
  J.chapter = chapterOfLevel(n);
  J.queue = chapterList[n - 1].slice();
  J.position = 0;
  J.rightCount = 0; J.wrongCount = 0; J.points = 0;
  J.currentAnswer = null;
  J.freshBadges = new Set();
  J.sessionId = uuid();
  J.phase = "play";
  stopTimers();
  render();
}

function renderLevel() {
  const it = currentItem();
  if (!it) { J.phase = "done"; return render(); }
  const L = CHAPTERS[J.chapter];
  const r = J.currentAnswer;
  const options = optionsHtml(it, (k) => {
    let cls = "";
    if (r) {
      if (k === r.key) cls = " opt-correct";
      else if (k === r.chosen) cls = " opt-wrong";
    }
    return `<button type="button" class="tgame-opt${cls}" data-act="answer-levelup"
        data-k="${k}"${r ? " disabled" : ""}>
        <span class="tgame-opt__k">${k}</span>
        <span class="tgame-opt__t">${sanitizeRich(it.options[k])}</span>
      </button>`;
  });
  const pasi = Array.from({ length: ITEMS_PER_LEVEL }, (_, i) =>
    `<i class="cmp-step${i < J.position ? " is-done" : i === J.position ? " is-now" : ""}" aria-hidden="true"></i>`).join("");
  const numar = J.globalNo.get(it.id) || 0;
  root.className = "cmp cmp--play cmp--levelup";
  root.innerHTML = `
    <section class="cmp-play cmp-cap-scena${isLastChapter(J.chapter) ? " e-final" : ""}" style="${chapterSkin(J.level)}">
      ${topBar(`${L.title} · Level ${J.level}`, L.sign,
        `<span class="cmp-hud__lives" title="Greșeli rămase în capitol">${Array.from({ length: MISTAKES_PER_CHAPTER }, (_, i) => `<i class="cmp-heart${i < mistakesLeft(J.chapter) ? " is-on" : ""}">${i < mistakesLeft(J.chapter) ? "❤" : "♡"}</i>`).join("")}</span><span class="cmp-steps">${pasi}</span>`, "map")}
      <div class="cmp-veil" aria-hidden="true"></div>
      <p class="cmp-bignum">
        <b>#${numar}</b>
        <i>din ${J.globalNo.size}</i>
        <em class="cmp-bignum__go">Game Over${r && !r.isRight && r.key
          ? `<span class="cmp-bignum__cheie">era <b>${esc(r.key)}</b></span>` : ""}</em>
      </p>
      <div class="cmp-orbit">
        ${badgesHtml()}
        <article class="tgame-card cmp-card${r ? (r.isRight ? " is-correct" : " is-wrong") : ""}" data-id="${it.id}">
          ${itemHead(it)}
          <p class="tgame-q">${it.question ? sanitizeRich(it.question) : "<em>(enunț indisponibil)</em>"}</p>
          <div class="tgame-opts">${options}</div>
          ${r ? `<div class="cmp-item__fb">${verdictHtml(r, true)}</div>` : ""}
        </article>
      </div>
    </section>`;
  J.freshBadges = new Set(); // pâlpâie o dată, la desenul de după câștig
}

async function answerLevelUp(btnEl) {
  const it = currentItem();
  if (!it || J.currentAnswer) return;
  const card = root.querySelector(".cmp-card");
  card?.classList.add("is-checking");
  const r = await answerTestItem(it.id, btnEl.dataset.k, J.sessionId);
  card?.classList.remove("is-checking");
  if (!r) { showToast("N-am putut verifica acum. Mai încearcă."); return; }
  J.currentAnswer = {
    chosen: btnEl.dataset.k, isRight: r.correct, key: r.correctAnswer,
    explanation: r.observation || "", historical: r.historical || null,
    points: r.awarded ? r.points : 0,
  };
  if (r.correct) { J.rightCount++; J.points += J.currentAnswer.points; } else J.wrongCount++;
  render();
  autoAdvance(r.correct);
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEVEL-UP MERGE SINGUR. Nu mai există buton de „mai departe": ai răspuns, deci
   ai spus tot ce aveai de spus. Un buton între două întrebări e o întrebare în
   plus, iar modul ăsta trăiește din ritm.

   Dar ritmul nu poate mânca timpul de citit. De aceea sunt DOUĂ răgazuri, nu
   unul: la răspuns bun ajunge o clipire, fiindcă n-ai ce învăța din ce știai
   deja; la răspuns greșit rămâi mai mult cu cardul LIMPEDE în față, cu litera
   corectă și cu explicația, fiindcă acolo e tot câștigul greșelii. Abia după
   aceea se lasă ceața peste el.

   Ordinea la cădere e, deci: citești, PE URMĂ se întunecă. Invers, ceața ar
   acoperi exact lucrul pentru care merita să pierzi levelul.
   ═══════════════════════════════════════════════════════════════════════════ */
/* DURATELE, toate aici. Cele două de mișcare (`FLY_MS`, `PUMP_MS`) pleacă și
   spre CSS, ca variabile puse pe secțiune: altfel aceeași durată ar fi scrisă
   în două fișiere și s-ar despărți la prima ajustare, iar pomparea ar porni
   ori peste zbor, ori după o pauză. */
const FLY_MS = 450;          // cât ține drumul numărului spre mijloc
const PUMP_MS = 280;         // o bătaie din pompare
const PUMPS = 3;              // câte bătăi la rând, ca semn de izbândă
const READ_RIGHT_MS = 350;    // cât stai cu bifa verde înainte de zbor
/* La greșeală, numărul pleacă aproape la fel de repede ca la reușită. Litera
   corectă NU se pierde din pricina asta: ea urcă în ecranul de cădere, sub
   „Game Over", deci se citește prin ceață, nu pe sub ea. Explicația întreagă
   rămâne pe card, iar cine o vrea o are în Relaxed ori la reluarea levelului. */
const READ_WRONG_MS = 700;
const SUCCESS_MS = FLY_MS + PUMP_MS * PUMPS;
/* Trei secunde cu numărul în mijloc: destul cât să citești litera corectă și
   să iei greșeala în piept, nu atât cât să te plictisești așteptând harta. */
const HOLD_CENTER_MS = 3000;
const FALL_MS = FLY_MS + HOLD_CENTER_MS;

/* Ceasurile pornite de aici se opresc la orice plecare din level (harta,
   modurile, alt level). Fără asta, un ceas rămas în urmă ar redesena peste
   ecranul în care tocmai ai intrat. */
function stopTimers() {
  (J.timers || []).forEach(clearTimeout);
  J.timers = [];
}
function pesteo(ms, ce) {
  (J.timers ||= []).push(setTimeout(ce, ms));
}

function autoAdvance(isRight) {
  stopTimers();
  pesteo(isRight ? READ_RIGHT_MS : READ_WRONG_MS, () => flyAndGo(isRight));
}

/* ZBORUL NUMĂRULUI, despărțit de pauza de citire dinaintea lui.
   De ce despărțit: cine cere explicația a citit deja, iar dacă „Mai departe" ar
   chema tot `autoAdvance`, l-ar pune să aștepte încă o dată aceleași 350 (ori
   700) de milisecunde, după ce tocmai terminase de citit. Așa, butonul reia de
   unde s-ar fi dus singur, cu tot cu efect. */
function flyAndGo(isRight) {
  const potolit = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  stopTimers();
  const sectiune = root.querySelector(".cmp-play");
  if (!sectiune) return;
  sectiune.classList.add(isRight ? "e-reusit" : "e-cade");
  pesteo(potolit ? 400 : (isRight ? SUCCESS_MS : FALL_MS), () => void dupaItem(isRight));
}

async function dupaItem(isRight) {
  J.currentAnswer = null;
  J.explanationAsked = false;   // butonul se cere din nou, la fiecare item
  /* La greșeală se oprește pe ECRANUL DE SFÂRȘIT, nu pe hartă. Înainte mergea
     drept la hartă, și era bine cât timp singurul lucru de spus era „ai pierdut
     levelul". De când a patra greșeală ia capitolul de la capăt, tăcerea nu mai
     merge: elevul s-ar întoarce pe o hartă golită fără să afle de ce. Zborul
     numărului rămâne automat; doar capătul lui e un ecran care spune ceva. */
  if (!isRight) { await finishLevel(false); return render(); }
  J.position++;
  if (J.position >= J.queue.length) { await finishLevel(true); }
  render();
}

/* ÎNCHIDEREA UNUI LEVEL, într-un singur loc: numărul de încercări, trecerea,
   seria și badges-urile se hotărăsc împreună, fiindcă depind unele de altele. */
async function finishLevel(cleared) {
  const n = J.level;
  const cap = chapterOfLevel(n);
  const vechi = J.levelLog.get(n) || { tries: 0, passed: false };
  const wasFallen = !vechi.passed && vechi.tries > 0;   // pentru „Comeback"
  const acum = { tries: vechi.tries + 1, passed: vechi.passed || cleared };
  J.levelLog.set(n, acum);
  J.streak = cleared ? J.streak + 1 : 0;
  J.phase = "done";
  J.chapterReset = false;
  J.chapterDone = false;

  if (cleared) {
    const earned = [];
    const da = (cod) => { if (!J.badges.has(cod)) { J.badges.add(cod); J.freshBadges.add(cod); earned.push(cod); } };
    if (maxLevel() >= 1) da("first-step");
    if (J.streak >= 3) da("hot-streak");
    if (J.streak >= 10) da("on-fire");
    if (wasFallen) da("comeback");
    if (maxLevel() >= Math.ceil(levelCount() / 2)) da("halfway");
    // Capitol încheiat: toate levelurile lui sunt trecute.
    const { firstLevel, lastLevel } = chapterBounds(cap);
    let tot = true;
    for (let x = firstLevel; x <= lastLevel; x++) if (!J.levelLog.get(x)?.passed) { tot = false; break; }
    if (tot) { da(chapterCode(cap)); J.chapterDone = true; }
    if (isLoggedIn()) await Promise.all(earned.map((cod) => awardBadge(J.exam, cod)));
  }
  if (isLoggedIn()) await saveMyLevel({ exam: J.exam, level: n, tries: acum.tries, passed: acum.passed });

  /* A PATRA GREȘEALĂ ÎNCHIDE CAPITOLUL. Trei îți sunt îngăduite; a patra îl ia
     de la început, cu tot cu levelurile pe care le trecuseși în el. Numai pe
     ACELA: capitolele dinainte rămân închise și povestea lor citită.

     De ce așa și nu altfel: o greșeală care costă doar reluarea aceluiași level
     nu costă nimic, fiindcă levelul e mereu același și a doua oară îl știi.
     Prețul trebuie să fie mai mare decât itemul greșit, dar mai mic decât tot
     drumul; capitolul e chiar măsura potrivită. */
  // `>` nu `>=`: trei greșeli sunt ÎNGĂDUITE, a patra e cea care închide.
  if (!cleared && mistakesIn(cap) > MISTAKES_PER_CHAPTER) await resetChapter(cap);
}

async function resetChapter(cap) {
  const { firstLevel, lastLevel } = chapterBounds(cap);
  for (let n = firstLevel; n <= lastLevel; n++) J.levelLog.delete(n);
  J.chapterReset = true;
  J.streak = 0;
  /* Insigna capitolului, dacă o câștigase cumva, NU se ia înapoi: e a lui, a
     fost câștigată cinstit. Se ia doar drumul, nu și amintirea lui. */
  if (isLoggedIn()) await clearMyLevels({ exam: J.exam, firstLevel, lastLevel });
}

function renderLevelEnd() {
  const l = J.levelLog.get(J.level);
  const cleared = J.wrongCount === 0 && J.position >= J.queue.length;
  const L = CHAPTERS[J.chapter];
  const chapterList = levelCount();
  const nextLevel = J.level + 1;
  const { firstLevel } = chapterBounds(J.chapter);
  const noi = [...J.freshBadges].map((cod) => {
    const d = badgeInfo(cod);
    return d ? `<span class="cmp-badge e-noua"><i aria-hidden="true">${d.sign}</i><b>${esc(d.label)}</b></span>` : "";
  }).join("");

  /* PATRU SFÂRȘITURI, nu două. Levelul trecut, capitolul încheiat, levelul
     pierdut și capitolul căzut sunt lucruri deosebite, iar elevul trebuie să
     vadă din prima privire care dintre ele i s-a întâmplat. Un singur ecran
     care spune „Game Over" și la a doua greșeală, și la a patra, ar ascunde
     tocmai lucrul care contează: că de data asta a pierdut capitolul. */
  const left = mistakesLeft(J.chapter);
  let sign, title, line, buttonHtml;
  if (J.chapterReset) {
    sign = "🗂️";
    title = "Capitolul o ia de la capăt";
    line = `A patra greșeală în „${esc(L.title)}". Capitolul se închide și se
      deschide iar de la primul level. Ce ai citit rămâne citit, iar badge-urile
      rămân ale tale; se pierde doar drumul, nu și amintirea lui.`;
    buttonHtml = `<button type="button" class="tgame-btn tgame-btn--primary" data-act="level" data-n="${firstLevel}">De la început ▸</button>`;
  } else if (J.chapterDone) {
    sign = L.sign;
    title = `Chapter ${J.chapter + 1} complete`;
    line = `Ai închis „${esc(L.title)}", cu toate cele ${LEVELS_PER_CHAPTER} levels ale lui.
      ${nextLevel <= chapterList ? "Dosarul merge mai departe." : "Aici se termină dosarul."}`;
    /* Două butoane, nu unul: la capătul unui capitol vrei ori să mergi mai
       departe, ori să te uiți pe hartă la ce-ai strâns - iar cel de continuare
       spune și ÎNCOTRO, cu titlul capitolului următor, nu doar „mai departe". */
    const nextChapter = CHAPTERS[J.chapter + 1];
    buttonHtml = nextLevel <= chapterList
      ? `<button type="button" class="tgame-btn tgame-btn--primary" data-act="level" data-n="${nextLevel}">
           Chapter ${J.chapter + 2}${nextChapter ? ` · ${esc(nextChapter.title)}` : ""} ▸
         </button>`
      : "";
  } else if (cleared) {
    sign = L.sign;
    title = `Level ${J.level} complete`;
    line = `Cinci din cinci${J.points ? ` · <b class="is-pts">+${J.points}</b> puncte` : ""}${J.streak > 1 ? ` · streak ${J.streak}` : ""}`;
    buttonHtml = nextLevel <= chapterList
      ? `<button type="button" class="tgame-btn tgame-btn--primary" data-act="level" data-n="${nextLevel}">Level ${nextLevel} ▸</button>`
      : "";
  } else {
    sign = "💥";
    title = "Game Over";
    line = `Ai ținut <b>${J.rightCount}</b> ${J.rightCount === 1 ? "item" : "itemi"} din ${ITEMS_PER_LEVEL}.
      ${left === 1
        ? "<b>Mai ai o singură greșeală</b> în capitolul ăsta; a patra îl ia de la capăt."
        : `Îți mai sunt îngăduite <b>${left} greșeli</b> în capitolul ăsta.`}${l && l.tries > 1 ? ` A ${l.tries}-a încercare la levelul ăsta.` : ""}`;
    buttonHtml = `<button type="button" class="tgame-btn tgame-btn--primary" data-act="level" data-n="${J.level}">Retry</button>`;
  }

  root.className = "cmp cmp--done";
  root.innerHTML = `
    <section class="cmp-done cmp-cap-scena${isLastChapter(J.chapter) ? " e-final" : ""}" style="${chapterSkin(J.level)}">
      ${topBar("Level-up", "🔥", "", "map")}
      <div class="cmp-done__in">
        <p class="cmp-done__sign" aria-hidden="true">${sign}</p>
        <h2 class="cmp-done__title">${esc(title)}</h2>
        <p class="cmp-done__stats">${line}</p>
        ${cleared && storyFragment(J.level) ? `
          <blockquote class="cmp-descoperit">
            <span class="cmp-descoperit__lab">Din dosar</span>
            <p>${esc(storyFragment(J.level))}</p>
          </blockquote>` : ""}
        ${noi ? `<div class="cmp-newbadges"><span class="cmp-gallery__lab">Badge nou</span>${noi}</div>` : ""}
        <div class="cmp-done__acts">
          ${buttonHtml}
          <button type="button" class="tgame-btn" data-act="map">Level map</button>
        </div>
      </div>
    </section>`;
}
// ---------- desenul de sus ----------

/* O EROARE DE DESEN NU MAI LASĂ ECRANUL GOL. Dacă un desen crapă la mijloc,
   `innerHTML` rămâne cum era, iar din afară arată ca un buton care nu face
   nimic: apeși și nu se întâmplă nimic, fără niciun semn. Aici se prinde
   căderea și se scrie pe ecran ce s-a rupt, cu tot cu locul din cod.

   Nu-i o cârpeală care ascunde greșeala, ci una care o arată: fără ea, singurul
   loc unde se vedea era consola browserului, adică nicăieri pentru cine nu știe
   s-o deschidă. */
function render() {
  try {
    return renderNow();
  } catch (e) {
    console.error("Level-up / Câmpina:", e);
    root.className = "cmp";
    root.innerHTML = `<div class="cmp-crapat">
        <p><b>S-a rupt ceva la desenarea ecranului.</b></p>
        <p class="cmp-crapat__ce">${esc(e && e.message ? e.message : String(e))}</p>
        <p class="cmp-crapat__unde">${esc((e && e.stack ? e.stack : "").split("\\n").slice(1, 3).join(" · "))}</p>
        <button type="button" class="tgame-btn" data-act="back">‹ înapoi la moduri</button>
      </div>`;
  }
}

function renderNow() {
  if (!J.loaded) return renderLoading();
  if (!J.items.length) {
    root.className = "cmp";
    root.innerHTML = `<p class="cmp-wait">Banca de itemi e goală deocamdată.</p>`;
    return;
  }
  if (J.screen === "relaxed") return renderRelaxed();
  if (J.screen === "classic" || J.screen === "adventure") return renderRound();
  if (J.screen === "levelup") return renderLevelUp();
  return renderModePicker();
}

// ---------- ascultători ----------

let eventsBound = false;
function bindEvents() {
  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
}

function onClick(e) {
  if (!root || !root.isConnected || !root.contains(e.target)) return;
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  switch (act) {
    // — de peste tot —
    case "mode": return pickMode(b.dataset.mode);
    case "back": stopTimers(); J.screen = "pick"; J.phase = "config"; return render();
    case "report": return askReport(b.dataset.id);

    // — Relaxed —
    case "year":
      J.pickedYear = Number(b.dataset.year);
      J.pickedPaper = papersOfYear(J.pickedYear)[0]?.key ?? null;
      return renderRelaxed();
    case "paper": J.pickedPaper = b.dataset.key; return renderRelaxed();
    case "answer-relaxed": return void answerRelaxed(b);
    case "clear-paper": return void clearPaper();

    // — configuratorul (Clasic / Aventura) —
    case "cfg-all-years": J.cfg.allYears = true; J.cfg.years.clear(); return renderConfig();
    case "cfg-year": return toggleYear(Number(b.dataset.year));
    case "cfg-all-types": J.cfg.allTypes = true; J.cfg.types.clear(); return renderConfig();
    case "cfg-type": return toggleType(b.dataset.type);
    case "start": return startRun();

    // — runda —
    case "answer": return void answer(b);
    case "next": return goOn();
    case "again": J.phase = "config"; J.done = false; return render();

    // — Level-up —
    case "level": stopTimers(); return startLevel(Number(b.dataset.n));
    case "map": stopTimers(); J.phase = "map"; return render();
    case "answer-levelup": return void answerLevelUp(b);
    /* CERUTĂ EXPLICAȚIA: se opresc ceasurile ÎNTÂI, apoi se desenează. Invers,
       ecranul ar pleca în mijlocul citirii, iar elevul ar crede că butonul e
       stricat. */
    case "explain":
      stopTimers();
      J.explanationAsked = true;
      return render();
    /* Reluarea sare peste pauza de citire: tocmai a citit. Zborul numărului
       rămâne, fiindcă el e capătul firesc al răspunsului. */
    case "resume":
      if (!J.currentAnswer) return;
      return flyAndGo(J.currentAnswer.isRight);
    default: return;
  }
}

/* PORNIREA e o scurtătură, nu o bifă. „Toți anii" înseamnă „nu filtra deloc";
   de îndată ce alegi un an anume, scurtătura se stinge. Iar dacă scoți și
   ultimul an bifat, n-ai rămas cu nimic ales — te întorci la „toți", fiindcă o
   listă goală n-ar avea ce arăta. */
function toggleYear(year) {
  if (J.cfg.years.has(year)) J.cfg.years.delete(year); else J.cfg.years.add(year);
  J.cfg.allYears = J.cfg.years.size === 0;
  renderConfig();
}

function toggleType(cod) {
  if (!cod) return;
  if (J.cfg.types.has(cod)) J.cfg.types.delete(cod); else J.cfg.types.add(cod);
  J.cfg.allTypes = J.cfg.types.size === 0;
  renderConfig();
}

function onInput(e) {
  if (!root || !root.isConnected || !root.contains(e.target)) return;
  if (e.target.dataset?.act === "note") writeNote(e.target);
}

function pickMode(mode) {
  if (!MODES.some((m) => m.id === mode)) return;
  J.screen = mode;
  // Level-up se deschide pe hartă, celelalte pe configurator; Relaxatul n-are faze.
  J.phase = mode === "levelup" ? "map" : "config";
  J.done = false;
  J.currentAnswer = null;
  render();
}

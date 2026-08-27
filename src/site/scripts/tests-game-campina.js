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
//   • Relaxat  — „vreau să văd tot subiectul." Toată sesiunea pe o pagină, pe
//     file de ani. Apeși, se face verde ori roșu, iar tu îți scrii explicația
//     ta lângă item. Fără puncte, fără ceas: aici se citește, nu se aleargă.
//   • Clasic   — 3 vieți (până la 6), cel mult 30 de itemi, câte unul pe ecran.
//     Unii itemi sunt „de viață": nimerit, îți dă o inimă; greșit, nu-ți ia
//     niciuna. Are configurator, ca la Drept.
//   • Aventura — tot ce ai ales, item cu item, numerotat 1..N. Greșitul se duce
//     la coada rândului și revine până îl nimerești.
//   • Nebunia  — 5 itemi pe nivel, o greșeală și s-a terminat. Nivelele sunt
//     strânse în lumi, iar fiecare lume are altă înfățișare.
//
// CINSTIT PRIN CONSTRUCȚIE. Itemii pleacă de pe server fără răspuns (coloana
// `correct` are SELECT-ul revocat). Singura cale de a afla răspunsul e să-l
// dai: `check_test_item` (fără puncte) ori `answer_test_item` (cu puncte, o
// singură dată pe item și sesiune, socotite de server). Relaxatul cheamă
// dinadins varianta FĂRĂ puncte: cu tot subiectul deschis în față, ai putea
// apăsa toate cele patru variante și tot le-ai aduna.
// =========================================================
import {
  fetchTestItems, checkTestItem, answerTestItem, reportTestItem, TEST_ITEM_TYPES,
} from "../../shared/scripts/test-repo.js";
import { sanitizeRich } from "../../shared/scripts/rich-text.js";
import { showToast } from "../../shared/scripts/toast.js";
import { isLoggedIn, iaLocal, punLocal } from "../../shared/scripts/session.js";

const OPTS = ["A", "B", "C", "D"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const NUME_TIP = Object.fromEntries(TEST_ITEM_TYPES.map((t) => [t.code, t.label]));
const uuid = () => (crypto.randomUUID
  ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

/* Cheile de memorie locală. Trec prin `iaLocal`/`punLocal`, deci sunt legate de
   CONT: pe un calculator împărțit, elevul următor nu moștenește răspunsurile
   celui dinainte. Nimeni nu atinge `localStorage` de-a dreptul. */
const CHEIE_RELAX = "campina:relax"; // ce-ai bifat, pe sesiuni
const CHEIE_NOTE = "campina:note";   // explicațiile scrise de tine
const CHEIE_NEBUN = "campina:nebun"; // cel mai înalt nivel atins

let radacina = null;

const J = {
  exam: "admitere-campina",
  itemi: [], peId: new Map(),
  hartii: [], // { cheie, an, sesiune, itemi: [] } — o „hârtie" = o sesiune de admitere
  ani: [],
  incarcat: false,
  ecran: "alege", // alege | relaxat | clasic | aventura | nebun
  /* Unde ești ÎN modul ales. Relaxatul n-are faze (e o singură pagină); Clasicul
     și Aventura merg config → joc → gata; Nebunia, hartă → joc → gata. */
  faza: "config",
  // — Relaxat —
  anAles: null, hartieAleasa: null,
  raspunsuri: {}, // id → { ales, corect, cheie, obs, istoric }
  note: {},       // id → text scris de elev
  // — modurile pe un item pe ecran —
  rand: [],       // ids, în ordinea de jucat
  pozitie: 0,
  raspunsCurent: null, // verdictul itemului de acum, cât timp e pe ecran
  bune: 0, rele: 0, puncte: 0,
  vieti: 0,
  deViata: new Set(), // itemii care dau o inimă, aleși la pornire
  sesiune: null,      // id-ul rundei, pentru punctele date de server
  gata: false,
  // — Nebunia —
  lume: 0, nivel: 0, nivelMax: 0,
  // — configurator (Clasic / Aventura) —
  cfg: { ani: new Set(), tipuri: new Set(), totiAnii: true, toateTipurile: true },
  semnalate: new Set(),
};

/* Stilurile proprii și le aduce singur modulul, socotite față de EL, nu față de
   pagina care-l cheamă: așa merge oriunde, fără să numere nimeni „../". */
function aduStilurile() {
  if (document.querySelector("link[data-campina-css]")) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = new URL("../styles/tests-campina.css", import.meta.url).href;
  l.setAttribute("data-campina-css", "");
  document.head.appendChild(l);
}

// ---------- intrare ----------
export async function initTestGameCampina(mountEl, exam) {
  radacina = mountEl;
  J.exam = exam || "admitere-campina";
  aduStilurile();
  if (!ascultatorPus) { puneAscultatorii(); ascultatorPus = true; }
  J.raspunsuri = iaLocal(CHEIE_RELAX, {}) || {};
  J.note = iaLocal(CHEIE_NOTE, {}) || {};
  J.nivelMax = Number(iaLocal(CHEIE_NEBUN, 0)) || 0;
  if (!J.incarcat) {
    deseneazaAsteptarea();
    await incarcaItemii();
  }
  deseneaza();
}

async function incarcaItemii() {
  const itemi = await fetchTestItems({ exam: J.exam });
  J.itemi = itemi;
  J.peId = new Map(itemi.map((it) => [it.id, it]));
  /* HÂRTIILE. O hârtie = o sesiune de admitere, adică o pereche an+sesiune.
     Ordinea LOR e alfabetică pe nume, nu pe calendar — și e voit: aici nu
     citești o arhivă, ci alegi dintr-o listă scurtă „pe care o rezolv?", iar o
     listă de ales se așază după eticheta pe care o citești. Calendarul e treaba
     paginii de descărcări, unde subiectele chiar sunt o cronologie. */
  const pe = new Map();
  for (const it of itemi) {
    const cheie = `${it.year}|${it.session}`;
    if (!pe.has(cheie)) pe.set(cheie, { cheie, an: it.year, sesiune: it.session, itemi: [] });
    pe.get(cheie).itemi.push(it);
  }
  J.hartii = [...pe.values()].sort((a, b) => a.an - b.an || a.sesiune.localeCompare(b.sesiune, "ro"));
  J.hartii.forEach((h) => h.itemi.sort((a, b) => (a.itemNo ?? 0) - (b.itemNo ?? 0)));
  J.ani = [...new Set(J.hartii.map((h) => h.an))].sort((a, b) => a - b);
  J.anAles = J.ani[J.ani.length - 1] ?? null;
  J.hartieAleasa = hartiileAnului(J.anAles)[0]?.cheie ?? null;
  J.cfg.ani = new Set();
  J.cfg.tipuri = new Set();
  J.incarcat = true;
}

const hartiileAnului = (an) => J.hartii.filter((h) => h.an === an);
const hartia = (cheie) => J.hartii.find((h) => h.cheie === cheie) || null;
/* Numele scurt al unei hârtii: „V1 - ianuarie (Câmpina)" → „V1 · ianuarie".
   Școala e deja scrisă alături, ca etichetă; scrisă de două ori, n-ar spune
   nimic în plus și ar lungi fiecare pastilă. */
const numeScurt = (s) => String(s || "").replace(/\s*\([^()]+\)\s*$/, "").replace(/\s+-\s+/, " · ").trim();
const scoalaDin = (s) => (String(s || "").match(/\(([^()]+)\)\s*$/) || [])[1] || "";

// ---------- bucăți folosite de toate modurile ----------

function deseneazaAsteptarea() {
  radacina.className = "cmp";
  radacina.innerHTML = `<p class="cmp-wait">Se aduc itemii…</p>`;
}

/* Cele patru sloturi sunt MEREU desenate: un item cu trei variante păstrează al
   patrulea gol, ca blocul să nu-și schimbe înălțimea de la un item la altul și
   ochiul să nu sară. */
const varianteHtml = (it, cum) =>
  OPTS.map((k) => ((it.options?.[k] != null && it.options[k] !== "")
    ? cum(k)
    : `<span class="tgame-opt tgame-opt--void" aria-hidden="true"></span>`)).join("");

function etichetele(it) {
  const l = (it.types || []).map((c) => `<span class="tgame-typelab">${esc(NUME_TIP[c] || c)}</span>`).join("");
  return l ? `<span class="tgame-types">${l}</span>` : "";
}

function capulItemului(it) {
  return `<div class="tgame-cardmeta">
      ${etichetele(it)}
      <span class="tgame-cardmeta__id">${it.year ?? ""}${it.session ? ` · ${esc(numeScurt(it.session))}` : ""}${it.itemNo != null ? ` · itemul ${it.itemNo}` : ""}</span>
      <span class="tgame-cardmeta__acts">
        ${J.semnalate.has(it.id)
          ? `<button type="button" class="tgame-report" disabled>⚑ semnalat</button>`
          : `<button type="button" class="tgame-report" data-act="semnaleaza" data-id="${it.id}" title="Semnalează o eroare de conținut">⚑ eroare</button>`}
      </span>
    </div>`;
}

/* Verdictul, spus la fel peste tot. `istoric` apare doar când răspunsul de azi
   diferă de cel de pe hârtie — și atunci merită spus, fiindcă elevul are baremul
   tipărit în față și ar crede că greșim noi. */
function verdictHtml(r) {
  if (!r) return "";
  return `<div class="tgame-verdict ${r.corect ? "ok" : "no"}">${r.corect
    ? "✓ Corect"
    : `✗ Greșit — corect era <b>${esc(r.cheie)}</b>`}</div>
    ${r.istoric ? `<div class="tgame-hist">Pe gramatica veche, răspunsul era <b>${esc(r.istoric)}</b>.</div>` : ""}
    ${r.obs ? `<div class="tgame-obs"><span class="tgame-obs__lab">Observație</span>${sanitizeRich(r.obs)}</div>` : ""}`;
}

// ---------- ecranul de alegere a modului ----------

const MODURI = [
  {
    id: "relaxat", nume: "Relaxat", semn: "🫖",
    scurt: "Tot subiectul, dintr-o privire",
    lung: `Alegi un an și o sesiune, iar subiectul întreg ți se așterne în față.
           Apeși o variantă: se face verde ori roșie pe loc. Lângă fiecare item
           ai un loc unde să-ți scrii explicația TA — aceea rămâne a ta.
           Fără vieți, fără ceas, fără puncte.`,
  },
  {
    id: "clasic", nume: "Clasic", semn: "🎯",
    scurt: "3 vieți, 30 de itemi",
    lung: `Câte un item pe ecran. Pornești cu trei inimi și poți ajunge la șase:
           printre itemi sunt câțiva „de viață", însemnați, care îți dau o inimă
           dacă-i nimerești și nu-ți iau niciuna dacă greșești. Runda ține până
           la 30 de itemi sau până rămâi fără inimi.`,
  },
  {
    id: "aventura", nume: "Aventura", semn: "🧭",
    scurt: "Tot, până iese",
    lung: `Toți itemii aleși, unul câte unul, numerotați. Cel greșit nu se pierde:
           se duce la coada rândului și revine mai târziu, până îl nimerești.
           Vezi mereu câți ai bun, câți greșit și câți ți-au mai rămas.`,
  },
  {
    id: "nebun", nume: "Nebunia", semn: "🔥",
    scurt: "5 itemi, zero greșeli",
    lung: `Nivele de câte cinci itemi. O singură greșeală și nivelul se închide;
           îl iei de la capăt. Nivelele sunt strânse în lumi, iar fiecare lume
           are altă înfățișare — cu cât urci, cu atât se schimbă lumina.`,
  },
];

function deseneazaAlegerea() {
  const n = J.itemi.length;
  const carduri = MODURI.map((m) => {
    const insigna = m.id === "nebun" && J.nivelMax > 0
      ? `<span class="cmp-mode__badge">nivelul ${J.nivelMax}</span>` : "";
    return `<button type="button" class="cmp-mode" data-act="mod" data-mod="${m.id}">
        <span class="cmp-mode__sign" aria-hidden="true">${m.semn}</span>
        <span class="cmp-mode__body">
          <span class="cmp-mode__name">${esc(m.nume)}${insigna}</span>
          <span class="cmp-mode__short">${esc(m.scurt)}</span>
          <span class="cmp-mode__long">${m.lung}</span>
        </span>
      </button>`;
  }).join("");
  radacina.className = "cmp";
  radacina.innerHTML = `
    <section class="cmp-pick">
      <header class="cmp-pick__head">
        <h2 class="cmp-pick__title">Cum vrei să lucrezi azi?</h2>
        <p class="cmp-pick__sub">${n} de itemi din ${J.hartii.length} sesiuni de admitere,
          de la Câmpina, Cluj-Napoca, Fălticeni, Drăgășani și Oradea.
          Patru feluri de a-i lua în piept.</p>
      </header>
      <div class="cmp-modes">${carduri}</div>
    </section>`;
}

// ---------- 1. RELAXAT ----------

function salveazaRelax() { punLocal(CHEIE_RELAX, J.raspunsuri); }
function salveazaNote() { punLocal(CHEIE_NOTE, J.note); }

/* Cât s-a lucrat dintr-o hârtie. Se numără din răspunsurile ținute minte, nu
   dintr-un contor de sine stătător: un contor s-ar putea desincroniza, lista de
   răspunsuri nu — ea E adevărul. */
function socotealaHartiei(h) {
  let raspunse = 0, bune = 0;
  for (const it of h.itemi) {
    const r = J.raspunsuri[it.id];
    if (!r) continue;
    raspunse++;
    if (r.corect) bune++;
  }
  return { raspunse, bune, total: h.itemi.length };
}

function fileDeAni() {
  return J.ani.map((an) => {
    const hs = hartiileAnului(an);
    const total = hs.reduce((a, h) => a + h.itemi.length, 0);
    const raspunse = hs.reduce((a, h) => a + socotealaHartiei(h).raspunse, 0);
    const gata = raspunse >= total && total > 0;
    return `<button type="button" class="cmp-tab${an === J.anAles ? " is-on" : ""}${gata ? " is-done" : ""}"
        role="tab" aria-selected="${an === J.anAles}" data-act="an" data-an="${an}"
        title="${an}: ${hs.length === 1 ? "o sesiune" : hs.length + " sesiuni"}, ${total} de itemi">
        <span class="cmp-tab__nr">${an}</span>
        <span class="cmp-tab__dots">${hs.map(() => "<i></i>").join("")}</span>
      </button>`;
  }).join("");
}

function pastileleHartiilor() {
  return hartiileAnului(J.anAles).map((h) => {
    const s = socotealaHartiei(h);
    const scoala = scoalaDin(h.sesiune);
    return `<button type="button" class="cmp-paper${h.cheie === J.hartieAleasa ? " is-on" : ""}"
        data-act="hartie" data-cheie="${esc(h.cheie)}">
        <b>${esc(numeScurt(h.sesiune))}</b>
        ${scoala ? `<span class="cmp-paper__school">${esc(scoala)}</span>` : ""}
        <span class="cmp-paper__n">${s.raspunse}/${s.total}</span>
      </button>`;
  }).join("");
}

function itemRelaxat(it, i) {
  const r = J.raspunsuri[it.id];
  const nota = J.note[it.id] || "";
  const variante = varianteHtml(it, (k) => {
    let cls = "";
    if (r) {
      if (k === r.cheie) cls = " opt-correct";
      else if (k === r.ales) cls = " opt-wrong";
    }
    return `<button type="button" class="tgame-opt${cls}" data-act="raspunde-relax"
        data-id="${it.id}" data-k="${k}"${r ? " disabled" : ""}>
        <span class="tgame-opt__k">${k}</span>
        <span class="tgame-opt__t">${sanitizeRich(it.options[k])}</span>
      </button>`;
  });
  /* Locul tău de explicat apare DOAR după ce ai ales. Înainte de asta ar fi o
     cutie goală lângă fiecare item — și, mai rău, te-ar pune să-ți motivezi un
     răspuns pe care încă nu l-ai dat. */
  const alTau = r ? `
    <div class="cmp-note">
      <label class="cmp-note__lab" for="nota-${it.id}">Explicația ta</label>
      <textarea class="cmp-note__in" id="nota-${it.id}" data-act="nota" data-id="${it.id}"
        rows="2" maxlength="800"
        placeholder="De ce e corect așa? Scrie cu vorbele tale — te ajută la recitire.">${esc(nota)}</textarea>
      <span class="cmp-note__state" data-nota-stare="${it.id}">${nota ? "✓ salvat" : ""}</span>
    </div>` : "";
  return `<article class="tgame-card cmp-item${r ? (r.corect ? " is-correct" : " is-wrong") : ""}" data-id="${it.id}">
      <div class="cmp-item__nr" aria-hidden="true">${i + 1}</div>
      ${capulItemului(it)}
      <p class="tgame-q">${it.question ? sanitizeRich(it.question) : "<em>(enunț indisponibil)</em>"}</p>
      <div class="tgame-opts">${variante}</div>
      ${r ? `<div class="cmp-item__fb">${verdictHtml(r)}</div>` : ""}
      ${alTau}
    </article>`;
}

function deseneazaRelaxat() {
  const h = hartia(J.hartieAleasa) || hartiileAnului(J.anAles)[0];
  if (!h) { radacina.innerHTML = `<p class="cmp-wait">Nu sunt itemi aici.</p>`; return; }
  J.hartieAleasa = h.cheie;
  const s = socotealaHartiei(h);
  const procent = s.total ? Math.round((s.raspunse / s.total) * 100) : 0;
  radacina.className = "cmp cmp--relax";
  radacina.innerHTML = `
    <section class="cmp-relax">
      ${baraDeSus("Relaxat", "🫖")}
      <div class="cmp-tabs" role="tablist" aria-label="Anii cu subiecte">${fileDeAni()}</div>
      <div class="cmp-papers">${pastileleHartiilor()}</div>
      <div class="cmp-progress">
        <div class="cmp-progress__bar"><i style="width:${procent}%"></i></div>
        <p class="cmp-progress__txt">
          <b>${s.raspunse}</b> din ${s.total} rezolvați${s.raspunse ? ` · <b class="is-ok">${s.bune}</b> corecți` : ""}
          ${s.raspunse ? `<button type="button" class="cmp-link" data-act="sterge-hartia">șterge răspunsurile de aici</button>` : ""}
        </p>
      </div>
      <div class="cmp-list">${h.itemi.map((it, i) => itemRelaxat(it, i)).join("")}</div>
    </section>`;
}

async function raspundeRelax(buton) {
  const id = buton.dataset.id;
  const k = buton.dataset.k;
  const card = buton.closest(".cmp-item");
  if (!id || !k || J.raspunsuri[id]) return;
  card?.classList.add("is-checking");
  /* FĂRĂ PUNCTE aici, dinadins: cu tot subiectul deschis, ai putea apăsa toate
     cele patru variante și le-ai aduna oricum. Punctele stau în modurile unde
     un item îți e pus o singură dată. */
  const r = await checkTestItem(id, k);
  card?.classList.remove("is-checking");
  if (!r) { showToast("N-am putut verifica acum. Mai încearcă."); return; }
  J.raspunsuri[id] = {
    ales: k, corect: r.correct, cheie: r.correctAnswer,
    obs: r.observation || "", istoric: r.historical || null,
  };
  salveazaRelax();
  /* Se redesenează DOAR cardul acesta, nu toată lista: pe o sesiune de 60 de
     itemi, un redesen întreg ar arunca pagina înapoi sus și ai pierde locul. */
  const proaspat = document.createElement("div");
  const it = J.peId.get(id);
  const i = (hartia(J.hartieAleasa)?.itemi || []).findIndex((x) => x.id === id);
  proaspat.innerHTML = itemRelaxat(it, i < 0 ? 0 : i);
  card?.replaceWith(proaspat.firstElementChild);
  actualizeazaSocoteala();
}

/* Numai cifrele de sus, nu toată pagina — vezi motivul de mai sus. */
function actualizeazaSocoteala() {
  const h = hartia(J.hartieAleasa);
  if (!h) return;
  const s = socotealaHartiei(h);
  const procent = s.total ? Math.round((s.raspunse / s.total) * 100) : 0;
  const bara = radacina.querySelector(".cmp-progress__bar i");
  if (bara) bara.style.width = `${procent}%`;
  const txt = radacina.querySelector(".cmp-progress__txt");
  if (txt) {
    txt.innerHTML = `<b>${s.raspunse}</b> din ${s.total} rezolvați${s.raspunse ? ` · <b class="is-ok">${s.bune}</b> corecți` : ""}
      ${s.raspunse ? `<button type="button" class="cmp-link" data-act="sterge-hartia">șterge răspunsurile de aici</button>` : ""}`;
  }
  const pastile = radacina.querySelector(".cmp-papers");
  if (pastile) pastile.innerHTML = pastileleHartiilor();
  const file = radacina.querySelector(".cmp-tabs");
  if (file) file.innerHTML = fileDeAni();
}

let ceasNota = null;
function scrieNota(camp) {
  const id = camp.dataset.id;
  if (!id) return;
  J.note[id] = camp.value;
  const stare = radacina.querySelector(`[data-nota-stare="${id}"]`);
  if (stare) stare.textContent = "se scrie…";
  clearTimeout(ceasNota);
  /* Se scrie la o secundă după ce te-ai oprit din tastat, nu la fiecare literă:
     altfel am atinge memoria de zeci de ori pe rând, degeaba.
     SUPABASE: când explicațiile elevilor se mută în bază (o masă `campina_note`
     cu RLS pe propriul rând), aici se schimbă o singură chemare. */
  ceasNota = setTimeout(() => {
    salveazaNote();
    if (stare) stare.textContent = J.note[id] ? "✓ salvat" : "";
  }, 1000);
}

function stergeHartia() {
  const h = hartia(J.hartieAleasa);
  if (!h) return;
  for (const it of h.itemi) delete J.raspunsuri[it.id];
  salveazaRelax();
  deseneazaRelaxat();
  showToast("Sesiunea e din nou nerezolvată.");
}

// ---------- bara de sus, comună modurilor ----------

function baraDeSus(nume, semn, dreapta = "") {
  return `<header class="cmp-top">
      <button type="button" class="cmp-back" data-act="inapoi" title="Înapoi la alegerea modului">‹ moduri</button>
      <span class="cmp-top__mode"><span aria-hidden="true">${semn}</span> ${esc(nume)}</span>
      <span class="cmp-top__right">${dreapta}</span>
    </header>`;
}

// ---------- semnalarea unei erori ----------

function cereSemnalare(id) {
  const it = J.peId.get(id);
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
    const ales = J.raspunsuri[id]?.ales || J.raspunsCurent?.ales || null;
    const bun = await reportTestItem(id, text, ales);
    if (!bun) { showToast("N-am putut trimite semnalarea."); return; }
    J.semnalate.add(id);
    showToast("Trimis. Mulțumesc — profesorul se uită.");
    /* Se schimbă DOAR butonul acelui item, nu tot ecranul: în Relaxat, un
       redesen ar arunca pagina înapoi sus, iar tu tocmai citeai itemul 47. */
    for (const b of radacina.querySelectorAll(`[data-act="semnaleaza"][data-id="${id}"]`)) {
      b.outerHTML = `<button type="button" class="tgame-report" disabled>⚑ semnalat</button>`;
    }
  });
  dlg.showModal();
}

// ---------- 2+3. CLASIC și AVENTURA: configuratorul ----------

const LIMITA_CLASIC = 30; // cel mult atâția itemi într-o rundă de Clasic
const VIETI_START = 3;
const VIETI_MAX = 6;
/* Cam unul din șase itemi e „de viață". Nu un număr fix: pe o rundă scurtă,
   fix-ul ar fi ori prea generos, ori inexistent. */
const RARITATE_VIATA = 6;

const areTipuri = () => J.itemi.some((it) => (it.types || []).length);

function itemiPotriviti() {
  return J.itemi.filter((it) => {
    if (!J.cfg.totiAnii && !J.cfg.ani.has(it.year)) return false;
    if (!J.cfg.toateTipurile) {
      const t = it.types || [];
      if (!t.some((x) => J.cfg.tipuri.has(x))) return false;
    }
    return true;
  });
}

/* Amestecul lui Fisher–Yates, cu perechi schimbate de la coadă spre cap: e
   singurul care dă fiecărei ordini aceeași șansă. Sortarea cu `Math.random()`
   în comparator pare că face același lucru, dar nu-i adevărat. */
function amesteca(a) {
  const v = a.slice();
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [v[i], v[j]] = [v[j], v[i]];
  }
  return v;
}

function pastilaAn(an, pornit) {
  const cati = J.itemi.filter((it) => it.year === an).length;
  return `<button type="button" class="cmp-chip${pornit ? " is-on" : ""}"
      data-act="cfg-an" data-an="${an}">${an}<span class="cmp-chip__n">${cati}</span></button>`;
}

function numaratoareTipuri() {
  const n = {};
  for (const it of itemiPotriviti()) for (const t of (it.types || [])) n[t] = (n[t] || 0) + 1;
  return n;
}

function deseneazaConfig() {
  const potriviti = itemiPotriviti();
  const eClasic = J.ecran === "clasic";
  const cati = eClasic ? Math.min(potriviti.length, LIMITA_CLASIC) : potriviti.length;
  const nT = numaratoareTipuri();
  const blocTipuri = areTipuri() ? `
    <div class="cmp-cfg__block">
      <p class="cmp-cfg__lab">Ce fel de itemi</p>
      <div class="cmp-chips">
        <button type="button" class="cmp-chip${J.cfg.toateTipurile ? " is-on" : ""}" data-act="cfg-toate-tipurile">Toate</button>
        ${TEST_ITEM_TYPES.filter((t) => nT[t.code] || J.cfg.tipuri.has(t.code)).map((t) => `
          <button type="button" class="cmp-chip${J.cfg.tipuri.has(t.code) ? " is-on" : ""}"
            data-act="cfg-tip" data-tip="${t.code}">${esc(t.label)}<span class="cmp-chip__n">${nT[t.code] || 0}</span></button>`).join("")}
      </div>
    </div>` : `
    <p class="cmp-cfg__note">Etichetele pe tipuri (sintaxa frazei, morfologie, fonetică…)
      încă se pun, item cu item. Când apar, vei putea alege și după ele.</p>`;
  const regula = eClasic
    ? `<ul class="cmp-rules">
        <li><b>${VIETI_START} inimi</b> la pornire, cel mult ${VIETI_MAX}.</li>
        <li>Itemii însemnați cu <b>❤</b> îți dau o inimă dacă-i nimerești și nu-ți iau niciuna dacă greșești.</li>
        <li>Runda ține până la <b>${LIMITA_CLASIC} de itemi</b> sau până rămâi fără inimi.</li>
      </ul>`
    : `<ul class="cmp-rules">
        <li>Toți itemii aleși, unul câte unul, <b>numerotați</b>.</li>
        <li>Itemul greșit se duce <b>la coada rândului</b> și revine până îl nimerești.</li>
        <li>Se termină când n-a mai rămas niciunul nerezolvat.</li>
      </ul>`;
  const m = MODURI.find((x) => x.id === J.ecran);
  radacina.className = "cmp cmp--cfg";
  radacina.innerHTML = `
    <section class="cmp-cfg">
      ${baraDeSus(m.nume, m.semn)}
      <div class="cmp-cfg__grid">
        <div class="cmp-cfg__left">
          <div class="cmp-cfg__block">
            <p class="cmp-cfg__lab">Din ce ani</p>
            <div class="cmp-chips">
              <button type="button" class="cmp-chip${J.cfg.totiAnii ? " is-on" : ""}" data-act="cfg-toti-anii">Toți anii</button>
              ${J.ani.map((an) => pastilaAn(an, J.cfg.ani.has(an))).join("")}
            </div>
          </div>
          ${blocTipuri}
        </div>
        <aside class="cmp-cfg__right">
          <p class="cmp-cfg__count"><b>${cati}</b> ${cati === 1 ? "item" : "de itemi"}</p>
          ${eClasic && potriviti.length > LIMITA_CLASIC
            ? `<p class="cmp-cfg__sub">aleși la întâmplare din ${potriviti.length}</p>` : ""}
          ${regula}
          <button type="button" class="tgame-btn tgame-btn--primary cmp-go"
            data-act="porneste"${cati ? "" : " disabled"}>Începe ▸</button>
          ${cati ? "" : `<p class="cmp-cfg__sub">Nicio potrivire — mai lasă un an ori un tip.</p>`}
        </aside>
      </div>
    </section>`;
}

// ---------- 2+3. runda propriu-zisă ----------

function porneste() {
  const potriviti = itemiPotriviti();
  if (!potriviti.length) return;
  const eClasic = J.ecran === "clasic";
  let rand = amesteca(potriviti.map((it) => it.id));
  if (eClasic) rand = rand.slice(0, LIMITA_CLASIC);
  J.rand = rand;
  J.pozitie = 0;
  J.bune = 0; J.rele = 0; J.puncte = 0;
  J.raspunsCurent = null;
  J.gata = false;
  J.vieti = eClasic ? VIETI_START : 0;
  J.sesiune = uuid();
  /* Itemii „de viață" se aleg ACUM, o dată pe rundă, nu la desenarea fiecărui
     item: altfel s-ar reașeza la orice redesen și ai vedea inima apărând și
     dispărând pe același item. */
  J.deViata = new Set();
  if (eClasic) {
    const cate = Math.max(1, Math.round(rand.length / RARITATE_VIATA));
    amesteca(rand).slice(0, cate).forEach((id) => J.deViata.add(id));
  }
  J.faza = "joc";
  deseneaza();
}

const itemCurent = () => J.peId.get(J.rand[J.pozitie]) || null;
const inimi = () => Array.from({ length: VIETI_MAX }, (_, i) =>
  `<i class="cmp-heart${i < J.vieti ? " is-on" : ""}" aria-hidden="true">${i < J.vieti ? "❤" : "♡"}</i>`).join("");

function hudRunda() {
  if (J.ecran === "clasic") {
    return `<div class="cmp-hud">
        <span class="cmp-hud__lives" aria-label="${J.vieti} vieți din ${VIETI_MAX}">${inimi()}</span>
        <span class="cmp-hud__pos">${Math.min(J.pozitie + 1, J.rand.length)} / ${J.rand.length}</span>
        <span class="cmp-hud__sc"><b class="is-ok">${J.bune}</b> · <b class="is-no">${J.rele}</b></span>
      </div>`;
  }
  const ramase = J.rand.length - J.pozitie;
  return `<div class="cmp-hud">
      <span class="cmp-hud__pos">itemul ${Math.min(J.pozitie + 1, J.rand.length)}</span>
      <span class="cmp-hud__sc"><b class="is-ok">${J.bune}</b> corecte · <b class="is-no">${J.rele}</b> greșite</span>
      <span class="cmp-hud__left">${ramase} ${ramase === 1 ? "rămas" : "rămași"}</span>
    </div>`;
}

function deseneazaRunda() {
  if (J.faza !== "joc") return deseneazaConfig();
  if (J.gata) return deseneazaFinal();
  const it = itemCurent();
  if (!it) return deseneazaFinal();
  const r = J.raspunsCurent;
  const viata = J.deViata.has(it.id);
  const variante = varianteHtml(it, (k) => {
    let cls = "";
    if (r) {
      if (k === r.cheie) cls = " opt-correct";
      else if (k === r.ales) cls = " opt-wrong";
    }
    return `<button type="button" class="tgame-opt${cls}" data-act="raspunde"
        data-k="${k}"${r ? " disabled" : ""}>
        <span class="tgame-opt__k">${k}</span>
        <span class="tgame-opt__t">${sanitizeRich(it.options[k])}</span>
      </button>`;
  });
  const m = MODURI.find((x) => x.id === J.ecran);
  radacina.className = "cmp cmp--play";
  radacina.innerHTML = `
    <section class="cmp-play">
      ${baraDeSus(m.nume, m.semn, hudRunda())}
      <article class="tgame-card cmp-card${viata ? " is-life" : ""}${r ? (r.corect ? " is-correct" : " is-wrong") : ""}" data-id="${it.id}">
        ${viata ? `<span class="cmp-lifetag" title="Item de viață: nimerit, îți dă o inimă; greșit, nu-ți ia niciuna">❤ item de viață</span>` : ""}
        ${capulItemului(it)}
        <p class="tgame-q">${it.question ? sanitizeRich(it.question) : "<em>(enunț indisponibil)</em>"}</p>
        <div class="tgame-opts">${variante}</div>
        ${r ? `<div class="cmp-item__fb">${verdictHtml(r)}
            ${r.puncte ? `<p class="cmp-pts">+${r.puncte} puncte</p>` : ""}</div>
          <div class="cmp-next"><button type="button" class="tgame-btn tgame-btn--primary" data-act="mai-departe">Continuă ▸</button></div>` : ""}
      </article>
    </section>`;
}

async function raspunde(buton) {
  const it = itemCurent();
  if (!it || J.raspunsCurent) return;
  const k = buton.dataset.k;
  const card = radacina.querySelector(".cmp-card");
  card?.classList.add("is-checking");
  const r = await answerTestItem(it.id, k, J.sesiune);
  card?.classList.remove("is-checking");
  if (!r) { showToast("N-am putut verifica acum. Mai încearcă."); return; }
  J.raspunsCurent = {
    ales: k, corect: r.correct, cheie: r.correctAnswer,
    obs: r.observation || "", istoric: r.historical || null,
    puncte: r.awarded ? r.points : 0,
  };
  if (r.correct) { J.bune++; J.puncte += J.raspunsCurent.puncte; } else J.rele++;
  if (J.ecran === "clasic") {
    if (r.correct && J.deViata.has(it.id) && J.vieti < VIETI_MAX) J.vieti++;
    else if (!r.correct && !J.deViata.has(it.id)) J.vieti--;
  }
  deseneaza();
}

function maiDeparte() {
  const r = J.raspunsCurent;
  const it = itemCurent();
  J.raspunsCurent = null;
  if (J.ecran === "clasic") {
    if (J.vieti <= 0) { J.gata = true; return deseneaza(); }
    J.pozitie++;
    if (J.pozitie >= J.rand.length) J.gata = true;
    return deseneaza();
  }
  /* AVENTURA: greșitul nu se pierde, se mută la coada rândului. Se scoate din
     locul lui ȘI se pune la capăt — altfel ar rămâne și acolo, iar rândul ar
     crește la nesfârșit. Poziția nu înaintează, fiindcă itemul de după el a
     luat exact locul pe care-l părăsește. */
  if (r && !r.corect && it) {
    J.rand.splice(J.pozitie, 1);
    J.rand.push(it.id);
  } else {
    J.pozitie++;
  }
  if (J.pozitie >= J.rand.length) J.gata = true;
  deseneaza();
}

function deseneazaFinal() {
  const eClasic = J.ecran === "clasic";
  const total = J.bune + J.rele;
  const procent = total ? Math.round((J.bune / total) * 100) : 0;
  const faraInimi = eClasic && J.vieti <= 0;
  const titlu = faraInimi ? "Ai rămas fără inimi" : eClasic ? "Rundă încheiată" : "Gata — toți itemii rezolvați";
  const m = MODURI.find((x) => x.id === J.ecran);
  radacina.className = "cmp cmp--done";
  radacina.innerHTML = `
    <section class="cmp-done">
      ${baraDeSus(m.nume, m.semn)}
      <div class="cmp-done__in">
        <p class="cmp-done__sign" aria-hidden="true">${faraInimi ? "💔" : procent >= 80 ? "🏆" : "🫡"}</p>
        <h2 class="cmp-done__title">${esc(titlu)}</h2>
        <p class="cmp-done__stats">
          <b class="is-ok">${J.bune}</b> corecte · <b class="is-no">${J.rele}</b> greșite
          ${total ? ` · <b>${procent}%</b>` : ""}
          ${J.puncte ? ` · <b class="is-pts">+${J.puncte}</b> puncte` : ""}
        </p>
        ${!isLoggedIn() ? `<p class="cmp-done__hint">Punctele se strâng doar dacă ai cont. Fără el, exersezi liniștit, dar nu urci în clasament.</p>` : ""}
        <div class="cmp-done__acts">
          <button type="button" class="tgame-btn tgame-btn--primary" data-act="din-nou">Încă o rundă</button>
          <button type="button" class="tgame-btn" data-act="inapoi">Alt mod</button>
        </div>
      </div>
    </section>`;
}

// ---------- 4. NEBUNIA ----------

const ITEMI_PE_NIVEL = 5;
const NIVELE_PE_LUME = 22;
/* Lumile nu sunt doar culori: fiecare are un nume și un semn, ca urcușul să se
   simtă ca o trecere, nu ca o bară care crește. Numărul lor nu e ales pe
   ghicite — 880 de itemi ÷ 5 = 176 de nivele, iar 176 ÷ 8 = 22 rotund. */
const LUMI = [
  { nume: "Zorii", semn: "🌅", culoare: "#0f766e" },
  { nume: "Pădurea", semn: "🌲", culoare: "#15803d" },
  { nume: "Câmpia", semn: "🌾", culoare: "#a16207" },
  { nume: "Râul", semn: "🌊", culoare: "#0369a1" },
  { nume: "Muntele", semn: "⛰️", culoare: "#57534e" },
  { nume: "Furtuna", semn: "⚡", culoare: "#6d28d9" },
  { nume: "Noaptea", semn: "🌙", culoare: "#1e293b" },
  { nume: "Vârful", semn: "👑", culoare: "#b45309" },
];

/* Toți itemii, în ordinea lor firească (an, sesiune, numărul de pe hârtie),
   tăiați în felii de câte cinci. Ordinea e AȘEZATĂ, nu amestecată: un nivel
   trebuie să fie de fiecare dată același, altfel „am trecut de 37" n-ar
   însemna nimic. Și, fiindcă felia urmează hârtia, un nivel e chiar o bucată
   dintr-un subiect adevărat. */
function nivelele() {
  const toti = J.hartii.flatMap((h) => h.itemi.map((it) => it.id));
  const felii = [];
  for (let i = 0; i < toti.length; i += ITEMI_PE_NIVEL) felii.push(toti.slice(i, i + ITEMI_PE_NIVEL));
  return felii;
}

const cateNivele = () => nivelele().length;
const lumeaNivelului = (n) => Math.min(LUMI.length - 1, Math.floor((n - 1) / NIVELE_PE_LUME));

function deseneazaNebunia() {
  if (J.faza === "joc") return deseneazaNivel();
  if (J.faza === "gata") return deseneazaSfarsitNivel();
  return deseneazaHarta();
}

function deseneazaHarta() {
  const felii = nivelele();
  const desfacut = J.nivelMax + 1; // nivelul următor celui atins e deschis
  const lumi = LUMI.map((L, li) => {
    const de_la = li * NIVELE_PE_LUME + 1;
    const pana = Math.min(de_la + NIVELE_PE_LUME - 1, felii.length);
    if (de_la > felii.length) return "";
    const patrate = [];
    for (let n = de_la; n <= pana; n++) {
      const trecut = n <= J.nivelMax;
      const deschis = n <= desfacut;
      patrate.push(`<button type="button" class="cmp-lvl${trecut ? " is-done" : ""}${deschis ? "" : " is-locked"}"
          data-act="nivel" data-n="${n}"${deschis ? "" : " disabled"}
          title="${deschis ? `Nivelul ${n}` : "Se deschide după nivelul dinainte"}">${n}</button>`);
    }
    const trecuteAici = Math.max(0, Math.min(J.nivelMax, pana) - de_la + 1);
    return `<section class="cmp-world" style="--lume:${L.culoare}">
        <header class="cmp-world__head">
          <span class="cmp-world__sign" aria-hidden="true">${L.semn}</span>
          <b class="cmp-world__name">${esc(L.nume)}</b>
          <span class="cmp-world__n">${trecuteAici} / ${pana - de_la + 1}</span>
        </header>
        <div class="cmp-lvls">${patrate.join("")}</div>
      </section>`;
  }).join("");
  radacina.className = "cmp cmp--map";
  radacina.innerHTML = `
    <section class="cmp-map">
      ${baraDeSus("Nebunia", "🔥", `<span class="cmp-hud__pos">${J.nivelMax} / ${felii.length} nivele</span>`)}
      <p class="cmp-map__intro">Cinci itemi pe nivel. O singură greșeală și nivelul se închide —
        îl iei de la capăt. Nivelele sunt aceleași de fiecare dată, așa că
        „am trecut de ${J.nivelMax || 12}" chiar înseamnă ceva.</p>
      ${lumi}
    </section>`;
}

function incepeNivelul(n) {
  const felii = nivelele();
  if (n < 1 || n > felii.length || n > J.nivelMax + 1) return;
  J.nivel = n;
  J.lume = lumeaNivelului(n);
  J.rand = felii[n - 1].slice();
  J.pozitie = 0;
  J.bune = 0; J.rele = 0; J.puncte = 0;
  J.raspunsCurent = null;
  J.sesiune = uuid();
  J.faza = "joc";
  deseneaza();
}

function deseneazaNivel() {
  const it = itemCurent();
  if (!it) { J.faza = "gata"; return deseneaza(); }
  const L = LUMI[J.lume];
  const r = J.raspunsCurent;
  const variante = varianteHtml(it, (k) => {
    let cls = "";
    if (r) {
      if (k === r.cheie) cls = " opt-correct";
      else if (k === r.ales) cls = " opt-wrong";
    }
    return `<button type="button" class="tgame-opt${cls}" data-act="raspunde-nebun"
        data-k="${k}"${r ? " disabled" : ""}>
        <span class="tgame-opt__k">${k}</span>
        <span class="tgame-opt__t">${sanitizeRich(it.options[k])}</span>
      </button>`;
  });
  const pasi = Array.from({ length: ITEMI_PE_NIVEL }, (_, i) =>
    `<i class="cmp-step${i < J.pozitie ? " is-done" : i === J.pozitie ? " is-now" : ""}" aria-hidden="true"></i>`).join("");
  radacina.className = "cmp cmp--play cmp--nebun";
  radacina.innerHTML = `
    <section class="cmp-play cmp-lume" style="--lume:${L.culoare}">
      ${baraDeSus(`${L.nume} · nivelul ${J.nivel}`, L.semn, `<span class="cmp-steps">${pasi}</span>`)}
      <article class="tgame-card cmp-card${r ? (r.corect ? " is-correct" : " is-wrong") : ""}" data-id="${it.id}">
        ${capulItemului(it)}
        <p class="tgame-q">${it.question ? sanitizeRich(it.question) : "<em>(enunț indisponibil)</em>"}</p>
        <div class="tgame-opts">${variante}</div>
        ${r ? `<div class="cmp-item__fb">${verdictHtml(r)}</div>
          <div class="cmp-next"><button type="button" class="tgame-btn tgame-btn--primary" data-act="mai-departe-nebun">${r.corect ? "Continuă ▸" : "Vezi ce-a ieșit ▸"}</button></div>` : ""}
      </article>
    </section>`;
}

async function raspundeNebun(buton) {
  const it = itemCurent();
  if (!it || J.raspunsCurent) return;
  const card = radacina.querySelector(".cmp-card");
  card?.classList.add("is-checking");
  const r = await answerTestItem(it.id, buton.dataset.k, J.sesiune);
  card?.classList.remove("is-checking");
  if (!r) { showToast("N-am putut verifica acum. Mai încearcă."); return; }
  J.raspunsCurent = {
    ales: buton.dataset.k, corect: r.correct, cheie: r.correctAnswer,
    obs: r.observation || "", istoric: r.historical || null,
    puncte: r.awarded ? r.points : 0,
  };
  if (r.correct) { J.bune++; J.puncte += J.raspunsCurent.puncte; } else J.rele++;
  deseneaza();
}

function maiDeparteNebun() {
  const gresit = J.raspunsCurent && !J.raspunsCurent.corect;
  J.raspunsCurent = null;
  if (gresit) { J.faza = "gata"; return deseneaza(); }
  J.pozitie++;
  if (J.pozitie >= J.rand.length) {
    if (J.nivel > J.nivelMax) { J.nivelMax = J.nivel; punLocal(CHEIE_NEBUN, J.nivelMax); }
    J.faza = "gata";
  }
  deseneaza();
}

function deseneazaSfarsitNivel() {
  const trecut = J.rele === 0 && J.pozitie >= J.rand.length;
  const L = LUMI[J.lume];
  const felii = cateNivele();
  const urmator = J.nivel + 1;
  radacina.className = "cmp cmp--done";
  radacina.innerHTML = `
    <section class="cmp-done cmp-lume" style="--lume:${L.culoare}">
      ${baraDeSus("Nebunia", "🔥")}
      <div class="cmp-done__in">
        <p class="cmp-done__sign" aria-hidden="true">${trecut ? L.semn : "💥"}</p>
        <h2 class="cmp-done__title">${trecut ? `Nivelul ${J.nivel}, trecut` : `Nivelul ${J.nivel} s-a închis`}</h2>
        <p class="cmp-done__stats">${trecut
          ? `Cinci din cinci${J.puncte ? ` · <b class="is-pts">+${J.puncte}</b> puncte` : ""}`
          : `Ai ținut <b>${J.bune}</b> ${J.bune === 1 ? "item" : "itemi"} din ${ITEMI_PE_NIVEL}. Greșeala oprește nivelul — dar nivelul e mereu același, deci a doua oară îl știi.`}</p>
        <div class="cmp-done__acts">
          ${trecut && urmator <= felii
            ? `<button type="button" class="tgame-btn tgame-btn--primary" data-act="nivel" data-n="${urmator}">Nivelul ${urmator} ▸</button>`
            : `<button type="button" class="tgame-btn tgame-btn--primary" data-act="nivel" data-n="${J.nivel}">Încă o dată</button>`}
          <button type="button" class="tgame-btn" data-act="harta">Harta nivelelor</button>
        </div>
      </div>
    </section>`;
}

// ---------- desenul de sus ----------

function deseneaza() {
  if (!J.incarcat) return deseneazaAsteptarea();
  if (!J.itemi.length) {
    radacina.className = "cmp";
    radacina.innerHTML = `<p class="cmp-wait">Banca de itemi e goală deocamdată.</p>`;
    return;
  }
  if (J.ecran === "relaxat") return deseneazaRelaxat();
  if (J.ecran === "clasic" || J.ecran === "aventura") return deseneazaRunda();
  if (J.ecran === "nebun") return deseneazaNebunia();
  return deseneazaAlegerea();
}

// ---------- ascultători ----------

let ascultatorPus = false;
function puneAscultatorii() {
  document.addEventListener("click", laApasare);
  document.addEventListener("input", laScris);
}

function laApasare(e) {
  if (!radacina || !radacina.isConnected || !radacina.contains(e.target)) return;
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  switch (act) {
    // — de peste tot —
    case "mod": return alegeModul(b.dataset.mod);
    case "inapoi": J.ecran = "alege"; J.faza = "config"; return deseneaza();
    case "semnaleaza": return cereSemnalare(b.dataset.id);

    // — Relaxat —
    case "an":
      J.anAles = Number(b.dataset.an);
      J.hartieAleasa = hartiileAnului(J.anAles)[0]?.cheie ?? null;
      return deseneazaRelaxat();
    case "hartie": J.hartieAleasa = b.dataset.cheie; return deseneazaRelaxat();
    case "raspunde-relax": return void raspundeRelax(b);
    case "sterge-hartia": return stergeHartia();

    // — configuratorul (Clasic / Aventura) —
    case "cfg-toti-anii": J.cfg.totiAnii = true; J.cfg.ani.clear(); return deseneazaConfig();
    case "cfg-an": return comutaAn(Number(b.dataset.an));
    case "cfg-toate-tipurile": J.cfg.toateTipurile = true; J.cfg.tipuri.clear(); return deseneazaConfig();
    case "cfg-tip": return comutaTip(b.dataset.tip);
    case "porneste": return porneste();

    // — runda —
    case "raspunde": return void raspunde(b);
    case "mai-departe": return maiDeparte();
    case "din-nou": J.faza = "config"; J.gata = false; return deseneaza();

    // — Nebunia —
    case "nivel": return incepeNivelul(Number(b.dataset.n));
    case "harta": J.faza = "harta"; return deseneaza();
    case "raspunde-nebun": return void raspundeNebun(b);
    case "mai-departe-nebun": return maiDeparteNebun();
    default: return;
  }
}

/* PORNIREA e o scurtătură, nu o bifă. „Toți anii" înseamnă „nu filtra deloc";
   de îndată ce alegi un an anume, scurtătura se stinge. Iar dacă scoți și
   ultimul an bifat, n-ai rămas cu nimic ales — te întorci la „toți", fiindcă o
   listă goală n-ar avea ce arăta. */
function comutaAn(an) {
  if (J.cfg.ani.has(an)) J.cfg.ani.delete(an); else J.cfg.ani.add(an);
  J.cfg.totiAnii = J.cfg.ani.size === 0;
  deseneazaConfig();
}

function comutaTip(cod) {
  if (!cod) return;
  if (J.cfg.tipuri.has(cod)) J.cfg.tipuri.delete(cod); else J.cfg.tipuri.add(cod);
  J.cfg.toateTipurile = J.cfg.tipuri.size === 0;
  deseneazaConfig();
}

function laScris(e) {
  if (!radacina || !radacina.isConnected || !radacina.contains(e.target)) return;
  if (e.target.dataset?.act === "nota") scrieNota(e.target);
}

function alegeModul(mod) {
  if (!MODURI.some((m) => m.id === mod)) return;
  J.ecran = mod;
  // Nebunia se deschide pe hartă, celelalte pe configurator; Relaxatul n-are faze.
  J.faza = mod === "nebun" ? "harta" : "config";
  J.gata = false;
  J.raspunsCurent = null;
  deseneaza();
}

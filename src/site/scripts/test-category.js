// =========================================================
// One test category = one page (/teste/<slug>/).
//   • Presentation: the category's symbol, its colour, and two panels —
//     downloadable tests and the interactive practice.
//   • Only „Admitere Drept" is live; the rest simply say „va urma".
//   • #joc turns the page into the practice itself:
//       PUPIL / GUEST → the mini-game, one file per exam:
//         admitere-drept   → tests-game-drept.js
//         admitere-campina → tests-game-campina.js
//       Un fișier pe examen, nu condiții într-unul singur: așa lucrul la un
//       examen nu poate strica jocul altuia. Plumbăria împărțită de-adevărat
//       (chemările spre Supabase) stă în test-repo.js, unde îi e locul.
//       ADMIN         → the item grid (tests-admin-grid.js)
//     A ?item=<uuid> deep link (from a flagged report) goes straight there.
// Content Romanian, identifiers English.
// =========================================================
import { TEST_CAT_BY_SLUG } from "./test-categories.js";
import { initTestGame } from "./tests-game-drept.js";
import { initTestGameCampina } from "./tests-game-campina.js";
import { initTestAdminGrid } from "./tests-admin-grid.js";
import { isAdmin } from "../../shared/scripts/session.js";
import { fetchTestDownloads, fetchDriveFolderUrl } from "../../shared/scripts/test-repo.js";
import { initFloatingPlay } from "./tests-float.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let root = null;
let cat = null;
let adminMode = false;
let downloads = []; // published files for this category, newest year first
let folderUrl = ""; // the Drive folder behind them, for „descarcă tot"
let stopFloat = null; // tears down the floating button's loop + listeners

export function initTestCategory(mountEl, slug) {
  cat = TEST_CAT_BY_SLUG[slug];
  if (!mountEl || !cat) return;
  root = mountEl;
  // The whole page dresses in the category's colour, on a dark console base.
  document.documentElement.style.setProperty("--cat-color", cat.color);
  document.body.classList.add("tcat-page");
  adminMode = isAdmin();
  window.addEventListener("hashchange", route);
  // The session may settle after first paint (teacher signs in) → re-route.
  window.addEventListener("atelier:role", () => {
    const a = isAdmin();
    if (a !== adminMode) { adminMode = a; route(); }
  });
  route();
  // The files live on the teacher's Drive; the list of them lives in the DB.
  // Fetched after the first paint so the page never waits on it — and both at
  // once, so the panel doesn't redraw twice.
  Promise.all([fetchTestDownloads(cat.slug), fetchDriveFolderUrl(cat.slug)])
    .then(([rows, url]) => {
      downloads = rows;
      folderUrl = url;
      if (!wantsPractice()) renderIntro();
    });
}

// Leaving the admin grid: drop its full-screen look AND unlock the page scroll
// (the grid locks <html>/<body> overflow while it's open).
function leaveAdminMode() {
  document.body.classList.remove("tg-mode");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

const wantsPractice = () =>
  (location.hash || "").replace(/^#/, "") === "joc"
  || !!new URLSearchParams(location.search).get("item"); // report deep link

/* CINE POATE INTRA. `live` spune că jocul e deschis ELEVILOR. Profesorul intră
   și înainte de asta: el nu vine să se antreneze, ci să pregătească itemii în
   grilă — și tocmai categoria încă neangajată are nevoie de asta. Legat doar
   de `live`, o categorie nouă ar fi fost închisă chiar și celui care o
   construiește, iar itemii ar fi rămas fără nicio ușă. */
const poateIntra = () => !!cat.live || adminMode;

/* UN JOC PE EXAMEN, ales dintr-un tabel, nu dintr-un lanț de `if`-uri. Tabelul
   se citește dintr-o privire, iar un examen nou se adaugă cu un rând. Un lanț de
   condiții ar fi ținut toate jocurile pe același drum: o greșeală strecurată la
   Câmpina ar fi putut opri Dreptul înainte să apuce să pornească.
   Cine nu-i în tabel merge pe jocul de la Drept — dar acolo nu ajunge nimeni
   până nu i se pune `live: true`, iar atunci i se scrie și rândul. */
const JOCURI = {
  "admitere-campina": initTestGameCampina,
};
const joculPentru = (slug) => JOCURI[slug] || initTestGame;

function route() {
  const play = poateIntra() && wantsPractice();
  document.body.classList.toggle("tgame-active", play); // shrink the page hero while playing
  if (play) { stopFloat?.(); stopFloat = null; }        // leaving the intro → drop the loop
  if (!play) { leaveAdminMode(); return renderIntro(); }
  if (adminMode) return initTestAdminGrid(root, cat.slug); // teacher → item grid
  leaveAdminMode();
  joculPentru(cat.slug)(root, cat.slug);         // pupil / guest → mini-game
}

// Grouped by year, and every button says plainly WHAT it hands you: the
/* Numele fișierelor, citite o singură dată. Erau scrise ca funcții locale
   înăuntrul lui `downloadList`; le scot aici, ca să le folosească și banda,
   nu ca să le copiez. */
const numeSesiunii = (f, an) =>
  String(f.label || "").replace(new RegExp(`^\\s*${an}\\s*[-–·]?\\s*`), "").trim() || String(f.label || "");
const scoalaDinNume = (n) => (n.match(/\(([^()]+)\)\s*$/) || [])[1] || "";
const faraScoalaDin = (n) => n.replace(/\s*\([^()]+\)\s*$/, "").trim();
const eBaremul = (n) => /\s-\sbarem$/i.test(faraScoalaDin(n));
const subiectulBaremului = (n) => faraScoalaDin(n).replace(/\s-\sbarem$/i, "").trim();
const faraVarianta = (n) => n.replace(/^\S+\s*[-–·]?\s*/, "").trim() || n;
const variantaDin = (n) => n.trim().split(/\s+/)[0] || "";

/* Luna cu care începe sesiunea, ca rândurile unui an să stea în ordinea
   calendarului, nu alfabetic („august-septembrie" venea înaintea lui
   „ianuarie"). Prescurtările contează: „oct. 2023 - feb. 2024" trebuie să cadă
   înaintea lui „aprilie-iulie", că așa a fost și sesiunea. */
const LUNILE = [
  ["ianuarie", "ian"], ["februarie", "feb"], ["martie", "mar"], ["aprilie", "apr"],
  ["mai"], ["iunie", "iun"], ["iulie", "iul"], ["august", "aug"],
  ["septembrie", "sept", "sep"], ["octombrie", "oct"], ["noiembrie", "nov", "noi"],
  ["decembrie", "dec"],
];
const lunaDin = (nume) => {
  const cuvinte = nume.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  let cea = 99;
  LUNILE.forEach((forme, i) => { if (i < cea && forme.some((x) => cuvinte.includes(x))) cea = i; });
  return cea;
};

const CULORI_SCOALA = {
  "Câmpina": "tdl__scoala--verde",
  "Cluj-Napoca": "tdl__scoala--albastru",
  "Jandarmi Fălticeni": "tdl__scoala--chihlimbar",
  "Jandarmi Drăgășani": "tdl__scoala--caramiziu",
  "Frontieră Oradea": "tdl__scoala--mov",
};

/* SESIUNILE UNUI AN, gata de desenat. Un subiect și baremul lui poartă același
   nume, plus un cuvânt; îi împerechez după nume, nu după vreo coloană din
   bază, ca să nu fie nimic de ținut la zi cu mâna. */
function sesiunileAnului(an, fisiere) {
  const subiecte = fisiere.filter((f) => !eBaremul(numeSesiunii(f, an)));
  const bareme = new Map(fisiere.filter((f) => eBaremul(numeSesiunii(f, an)))
    .map((f) => [subiectulBaremului(numeSesiunii(f, an)), f]));
  const pe = new Map();
  for (const f of subiecte) {
    const nume = numeSesiunii(f, an);
    const curat = faraScoalaDin(nume);
    const cheie = faraVarianta(curat);
    if (!pe.has(cheie)) {
      pe.set(cheie, { nume: cheie, scoala: scoalaDinNume(nume), luna: lunaDin(cheie), hartii: [] });
    }
    pe.get(cheie).hartii.push({ f, varianta: variantaDin(curat), barem: bareme.get(curat) || null });
  }
  const iesire = [...pe.values()];
  iesire.forEach((s) => s.hartii.sort((a, b) => a.varianta.localeCompare(b.varianta, "ro")));
  iesire.sort((a, b) => a.luna - b.luna || a.nume.localeCompare(b.nume, "ro"));
  return iesire;
}

function numeVariantei(v) {
  return v === "V1" ? "Varianta 1" : v === "V2" ? "Varianta 2" : v;
}

/* Panoul unui an: câte sesiuni are și, pe rânduri, fiecare cu variantele ei. */
function panouAn(an, fisiere) {
  const ses = sesiunileAnului(an, fisiere);
  const cateHartii = ses.reduce((a, s) => a + s.hartii.length, 0);
  const spune = (n, unu, multe) => `${n} ${n === 1 ? unu : multe}`;
  const randuri = ses.map((s) => {
    const eticheta = s.scoala
      ? `<span class="tdl__scoala ${CULORI_SCOALA[s.scoala] || ""}">${esc(s.scoala)}</span>` : "";
    const hartii = s.hartii.map((h) => {
      const tip = [h.f.note, h.f.kind || "PDF"].filter(Boolean).join(" · ");
      const barem = h.barem
        ? `<a class="tdl__barem" href="${esc(h.barem.href)}" target="_blank" rel="noopener noreferrer"
              title="Baremul: răspunsurile corecte">barem</a>` : "";
      return `<span class="tb__v"><a class="tdl__file" href="${esc(h.f.href)}"
            target="_blank" rel="noopener noreferrer"
            title="Descarcă: ${esc(tip)}">${esc(numeVariantei(h.varianta))}</a>${barem}</span>`;
    }).join("");
    return `<li class="tb__ses"><span class="tb__ses-nume">${esc(s.nume)}</span>${eticheta}
      <span class="tb__hartii">${hartii}</span></li>`;
  }).join("");
  return `<p class="tb__cap"><b>${esc(an)}</b>
      <span>${esc(spune(ses.length, "sesiune", "sesiuni"))} · ${esc(spune(cateHartii, "subiect", "subiecte"))}</span></p>
    <ul class="tb__lista">${randuri}</ul>`;
}

/* BANDA ÎNTREAGĂ. Anii lipsă dintre primul și ultimul se pun și ei pe bandă,
   punctați: altfel 2021 ar dispărea, iar cititorul n-ar afla niciodată că
   lipsește. */
function bandaDeAni(byYear) {
  const ani = [...byYear.keys()].filter((a) => Number.isFinite(Number(a))).map(Number).sort((a, b) => a - b);
  if (!ani.length) return "";
  const toti = [];
  for (let a = ani[0]; a <= ani[ani.length - 1]; a++) toti.push(a);
  const ales = ani[ani.length - 1];
  const butoane = toti.map((a) => {
    const fisiere = byYear.get(a) || byYear.get(String(a)) || [];
    const cate = fisiere.length ? sesiunileAnului(a, fisiere).length : 0;
    if (!cate) {
      return `<span class="tb__an tb__an--gol" aria-hidden="true"><span class="tb__an-nr">${a}</span>
        <span class="tb__buline"></span></span>`;
    }
    const buline = Array.from({ length: cate }, () => "<i></i>").join("");
    return `<button type="button" class="tb__an" role="tab" data-an="${a}"
        aria-selected="${a === ales}" aria-controls="tb-panou"
        title="${a}: ${cate === 1 ? "o sesiune" : cate + " sesiuni"}">
        <span class="tb__an-nr">${a}</span><span class="tb__buline">${buline}</span></button>`;
  }).join("");
  const fisiereAles = byYear.get(ales) || byYear.get(String(ales)) || [];
  return `<div class="tb">
      <div class="tb__ani" role="tablist" aria-label="Anii cu subiecte">${butoane}</div>
      <div class="tb__panou" id="tb-panou" role="tabpanel">${panouAn(ales, fisiereAles)}</div>
    </div>
    <p class="tcat__hint">O bulină pe an înseamnă o sesiune de admitere. Fișierele se descarcă direct.</p>`;
}

// session, a short note, and the file kind. Nobody should have to click to
// find out what they're downloading.
function downloadList() {
  if (!downloads.length) {
    return `<p class="tcat__soon">Testele în format descărcabil vor fi disponibile în curând.</p>`;
  }
  const byYear = new Map();
  for (const d of downloads) {
    const y = d.year || "Fără an";
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(d);
  }
  /* ══════════════════════════════════════════════════════════════════════
     BANDA DE ANI (numai categoriile cu `asezare: "banda"`).

     DE CE NU MAI E TABEL AICI. Tabelul avea rândul = anul și coloana =
     varianta. Dar un an poate avea DOUĂ sesiuni (2018 are ianuarie și
     august-septembrie), iar a doua își deschidea rând nou: ieșeau trepte și
     jumătăți de rând goale, fiindcă nu orice sesiune are și V1 și V2. Ochiul
     citea goluri, nu structură. Cauza nu era stilul, ci alegerea coloanei:
     varianta e un amănunt ridicat la rangul de axă. V1 și V2 sunt același
     subiect în două tipare, nu două lucruri deosebite.

     CE SPUNE BANDA. Anii, unul lângă altul, toți la fel de înalți: înălțimea
     NU măsoară nimic (hotărât de Marius: „fără să spună cât de mulți itemi
     are fiecare an"). Ce numără sunt BULINELE: o bulină = o sesiune. Anul
     fără subiecte în folder rămâne pe bandă, punctat: o lipsă spusă pe față
     e o informație, nu o scăpare.

     Dedesubt, sesiunile anului ales, fiecare cu variantele ei alături. Așa
     dispar și treptele, și celulele goale.
     ══════════════════════════════════════════════════════════════════════ */
  if (cat.asezare === "banda") return bandaDeAni(byYear);

  // A real <table>. Year down the side, one session per cell — which is what
  // this data actually is, so the element that describes it is the honest one.
  // It also solves the alignment for free: a table sizes each column to its
  // widest cell across ALL rows. (A CSS grid can't: every row is its own grid,
  // so `max-content` measures that row alone and the columns drift apart.)
  // The lines are simply not drawn.

  // The year already labels the row — drop it from the session name so
  // „2024 - Iulie - G1" reads simply „Iulie - G1".
  const sessionName = (f, year) =>
    String(f.label || "").replace(new RegExp(`^\\s*${year}\\s*[-–·]?\\s*`), "").trim() || String(f.label || "");
  // INSTITUȚIA, dacă numele o poartă în paranteză la coadă: „V1 - ianuarie
  // (Câmpina)". Categoriile care adună subiecte de la mai multe școli o scriu
  // acolo, iar pagina o scoate și o arată ca etichetă colorată. Unde nu e
  // paranteză (Drept), nu se schimbă nimic: numele rămâne întreg.
  const scoalaDin = (nume) => (nume.match(/\(([^()]+)\)\s*$/) || [])[1] || "";
  const faraScoala = (nume) => nume.replace(/\s*\([^()]+\)\s*$/, "").trim();
  // BAREMUL nu-i un rând de sine stătător, ci perechea subiectului: același
  // nume, plus un cuvânt. Îl caut după nume, nu după vreo coloană din bază,
  // ca să nu fie nimic de ținut la zi cu mâna.
  const eBarem = (nume) => /\s-\sbarem$/i.test(faraScoala(nume));
  const numeDeSubiect = (nume) => faraScoala(nume).replace(/\s-\sbarem$/i, "").trim();
  /* Numele fără cuvântul coloanei: „V1 - ianuarie" → „ianuarie". Se taie și
     despărțitorul de după el, altfel rămâne „- ianuarie": tăiat pe cuvinte,
     cratima era un cuvânt de sine stătător și trecea mai departe. */
  const faraColoana = (nume) => nume.replace(/^\S+\s*[-–·]?\s*/, "").trim() || nume;
  // A column is a KIND OF EXAM, not a month — and in the naming scheme the
  // first word is exactly that: „Iulie" the real exam, „Septembrie" the autumn
  // one, „Simulare" the rehearsal whenever it happened to be held.
  // So „Simulare aprilie - G1" and „Simulare mai - G1" share one column,
  // instead of the calendar splitting a single kind of paper in two.
  // The label the pupil reads stays whole; only the column is shared.
  const sessionKind = (name) => name.trim().split(/\s+/)[0] || name;

  // A COLUMN IS A SESSION, not a position. 2026 has only its „Simulare mai",
  // and it belongs under the other years' „Simulare mai" — not in the first
  // free slot. Columns are the distinct sessions, in alphabetical order.
  // Baremele nu-și cer coloană: ele stau lângă subiectul lor.
  const eSubiect = (f, y) => !eBarem(sessionName(f, y));
  const kinds = [...new Set(
    [...byYear.entries()].flatMap(([y, files]) =>
      files.filter((f) => eSubiect(f, y)).map((f) => sessionKind(faraScoala(sessionName(f, y)))))
  )].sort((a, b) => a.localeCompare(b, "ro"));

  // Safety valve: past a handful of distinct sessions the table would grow
  // wider than the panel, so we fall back to filling cells left to right.
  const columnar = kinds.length <= 5;
  const cols = columnar
    ? kinds.length
    : Math.max(1, ...[...byYear.values()].map((f) => f.filter((x) => eSubiect(x, x.year)).length));

  /* CULORILE ȘCOLILOR. Câte una de instituție, ca ochiul să le deosebească
     dintr-o privire. Stau aici, într-un singur loc; o școală nouă capătă o
     culoare adăugând un rând. Cine nu-i în listă primește tonul neutru. */
  const CULORI_SCOALA = {
    "Câmpina": "tdl__scoala--verde",
    "Cluj-Napoca": "tdl__scoala--albastru",
    "Jandarmi Fălticeni": "tdl__scoala--chihlimbar",
    "Jandarmi Drăgășani": "tdl__scoala--caramiziu",
    "Frontieră Oradea": "tdl__scoala--mov",
  };

  const rows = [...byYear.entries()].flatMap(([year, files]) => {
    // Order inside a year comes from the session names, NOT from the stored
    // `sort`. That column can go stale — every row currently holds 0 — and a
    // page that renders differently depending on a field nobody maintains is
    // a page that breaks quietly. The names are the truth; use them.
    const subiecte = files.filter((f) => eSubiect(f, year));
    const barem = new Map(files.filter((f) => !eSubiect(f, year))
      .map((f) => [numeDeSubiect(sessionName(f, year)), f]));
    /* ORDINEA SESIUNILOR ÎNTR-UN AN. Alfabetic, „august-septembrie" venea
       înaintea lui „ianuarie": citit de sus în jos, anul mergea de-a-ndoaselea.
       La categoriile cu variantă, rândurile se pun după CALENDAR: se caută
       prima lună pomenită în numele sesiunii. Numai acolo: la Drept ordinea e
       dată de felul examenului, iar el n-are luni în nume. */
    const LUNI = [
      ["ianuarie", "ian"], ["februarie", "feb"], ["martie", "mar"], ["aprilie", "apr"],
      ["mai"], ["iunie", "iun"], ["iulie", "iul"], ["august", "aug"],
      ["septembrie", "sept", "sep"], ["octombrie", "oct"], ["noiembrie", "nov", "noi"],
      ["decembrie", "dec"],
    ];
    /* Se caută pe cuvinte întregi, cu prescurtări cu tot: numele scurtat
       „oct. 2023 - feb. 2024" trebuie să cadă înaintea lui „aprilie-iulie", că
       așa a fost și sesiunea. Fără prescurtări, el nu era recunoscut deloc și
       se ducea la coada anului: văzut pe machetă, nu bănuit. */
    const luna = (nume) => {
      const cuvinte = nume.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
      let cea = 99;
      LUNI.forEach((forme, i) => {
        if (i < cea && forme.some((x) => cuvinte.includes(x))) cea = i;
      });
      return cea;
    };
    const ordered = [...subiecte].sort((a, b) => {
      const na = faraScoala(sessionName(a, year)), nb = faraScoala(sessionName(b, year));
      if (cat.coloane === "varianta") {
        return luna(faraColoana(na)) - luna(faraColoana(nb))
            || kinds.indexOf(sessionKind(na)) - kinds.indexOf(sessionKind(nb))
            || na.localeCompare(nb, "ro");
      }
      return kinds.indexOf(sessionKind(na)) - kinds.indexOf(sessionKind(nb))
          || na.localeCompare(nb, "ro");
    });
    /* UN RÂND = O SESIUNE, nu un an. Coloana ține un lucru (la Câmpina,
       varianta), iar rândul ține tot restul numelui: adică sesiunea. Așa,
       2018 arată ianuarie pe un rând și august-septembrie pe altul, fiecare cu
       variantele ei alături.

       Fără regula asta, 2024 ar fi pus aprilie-iulie și octombrie-februarie
       umăr la umăr, doar fiindcă una e V1 și cealaltă V2: două sesiuni
       deosebite care ar fi arătat ca o pereche. Prinsă de `proba-descarcari.js`.

       La Drept nu se schimbă nimic: acolo coloana e chiar sesiunea („Iulie",
       „Simulare mai"), iar restul numelui e grupa, aceeași pe tot anul: deci
       tot un singur rând, ca până acum. */
    const peSesiune = new Map();
    const randuri = [];
    for (const f of ordered) {
      const nume = sessionName(f, year);
      const curat = faraScoala(nume);
      const scoala = scoalaDin(nume);
      const tip = [f.note, f.kind || "PDF"].filter(Boolean).join(" · ");
      // The teacher's mark: this paper is in the bank from end to end. It's a
      // separate link, next to the download — not wrapped around it, which
      // would be an <a> inside an <a>. Only for playable categories: promising
      // a game where there's no item bank would be a broken promise.
      const solved = f.solved && cat.live
        ? `<a class="tdl__solved" href="?an=${encodeURIComponent(year)}&ses=${encodeURIComponent(curat)}#joc"
              title="Rezolvat integral în aplicație, cu explicații. Click pentru a te antrena pe această sesiune."
              aria-label="Rezolvat integral: antrenează-te pe ${esc(curat)} ${esc(String(year))}">✓</a>`
        : "";
      const eticheta = scoala
        ? `<span class="tdl__scoala ${CULORI_SCOALA[scoala] || ""}">${esc(scoala)}</span>` : "";
      const b = barem.get(curat);
      const legatBarem = b
        ? `<a class="tdl__barem" href="${esc(b.href)}" target="_blank" rel="noopener noreferrer"
              title="Baremul: răspunsurile corecte"
              aria-label="Barem pentru ${esc(curat)} ${esc(String(year))}">barem</a>` : "";
      /* CE SCRIE ÎN CELULĂ. La categoriile cu coloane pe variantă, „V1" stă în
         capul coloanei, deci în celulă n-are ce căuta a doua oară: rămâne
         sesiunea. Sunt cinci-șase litere pe celulă, dar ele hotărăsc dacă
         tabelul încape în coloana lui ori dă peste zona bilei: arătat de
         profesor pe o poză, 16 aug. */
      const scris = cat.coloane === "varianta" ? faraColoana(curat) : curat;
      /* ORDINEA DIN CELULĂ. La categoriile cu variantă, eticheta școlii trece
         SUB nume, deci trebuie scrisă la urmă; altfel ar rupe rândul înaintea
         baremului. Măsurat cu metricile fontului: numele cel mai lung cere
         atunci 249px, iar celula are 309px: încape cu marjă. Ținută pe rândul
         numelui, cerea 371px și dădea peste zona bilei. */
      const cell = cat.coloane === "varianta"
        ? `<a class="tdl__file" href="${esc(f.href)}" target="_blank" rel="noopener noreferrer"
                 title="Descarcă: ${esc(tip)}">${esc(scris)}</a>${solved}${legatBarem}${eticheta}`
        : `<a class="tdl__file" href="${esc(f.href)}" target="_blank" rel="noopener noreferrer"
                 title="Descarcă: ${esc(tip)}">${esc(scris)}</a>${eticheta}${solved}${legatBarem}`;
      const at = columnar ? kinds.indexOf(sessionKind(curat)) : -1;
      if (at < 0) {                       // fără coloane: se umple stânga-dreapta
        let r = randuri.find((x) => x.some((c) => !c)) || null;
        if (!r) { r = new Array(cols).fill(""); randuri.push(r); }
        r[r.findIndex((c) => !c)] = cell;
        continue;
      }
      /* DOUĂ AȘEZĂRI, după cum e citit numele.

         La categoriile cu `coloane: "varianta"`, rândul e SESIUNEA (numele
         fără cuvântul coloanei), iar dacă ea și-a luat deja coloana se
         deschide un rând nou.

         La celelalte: Drept: se face întocmai ca înainte: coloana lui, iar
         dacă e luată, prima celulă liberă. Pare o scăpare, dar nu e: acolo
         coloana e chiar sesiunea, deci „Iulie - G1" și „Iulie - G2" trebuie să
         stea umăr la umăr, nu pe două rânduri. Am schimbat asta o dată pentru
         toată lumea și profesorul m-a întrebat, pe bună dreptate, dacă n-am
         atins Dreptul; îl atinsesem, în cazul acela. Acum nu. */
      if (cat.coloane !== "varianta") {
        if (!randuri.length) randuri.push(new Array(cols).fill(""));
        const r0 = randuri[0];
        let unde = r0[at] ? r0.findIndex((c) => !c) : at;
        if (unde < 0) { r0.push(cell); continue; }
        r0[unde] = cell;
        continue;
      }
      const sesiunea = faraColoana(curat);
      let r = peSesiune.get(sesiunea);
      if (!r || r[at]) {
        r = new Array(cols).fill("");
        randuri.push(r);
        peSesiune.set(sesiunea, r);
      }
      r[at] = cell;
    }
    if (!randuri.length) randuri.push(new Array(cols).fill(""));
    // Anul se scrie o dată, pe rândul dintâi; celelalte rânduri ale lui rămân
    // cu capul gol, ca ochiul să vadă că țin de același an.
    return randuri.map((cells, i) =>
      `<tr><th scope="row" class="tdl__year${i ? " tdl__year--urmare" : ""}">${
        i ? "" : esc(year)}</th>${
        cells.map((c, k) => `<td class="tdl-k${k}">${c}</td>`).join("")}</tr>`);
  }).join("");
  /* CAPUL DE TABEL, numai unde coloanele înseamnă ceva de sine stătător. La
     Drept coloana e sesiunea, iar numele ei stă deja în fiecare celulă, deci
     un cap ar fi vorbă în plus: și, mai ales, ar schimba un tabel care merge
     bine de un an. */
  const cap = cat.coloane === "varianta"
    ? `<thead><tr><td></td>${kinds.map((k) =>
        `<th scope="col" class="tdl__cap">${esc(k === "V1" ? "Varianta 1"
          : k === "V2" ? "Varianta 2" : k)}</th>`).join("")}</tr></thead>`
    : "";
  /* LĂȚIMILE, SPUSE O DATĂ. Cu `table-layout: fixed`, browserul le ia din
     PRIMUL rând: care e acum capul de tabel, iar acolo `.tdl__year` nu se
     află. Fără `<colgroup>`, coloana anului ar înghiți o treime din tabel, iar
     socoteala de mai sus (341px pe celulă) ar fi fost o închipuire. Aici se
     spune limpede: anul cât îi trebuie, restul în părți egale. */
  const stalpi = cat.coloane === "varianta"
    ? `<colgroup><col class="tdl__c-an" />${kinds.map(() => "<col />").join("")}</colgroup>`
    : "";
  return `<table class="tdl${cat.coloane === "varianta" ? " tdl--varianta" : ""}">${stalpi}${cap}<tbody>${rows}</tbody></table>
    <p class="tcat__hint">Fișierele se descarcă direct. În funcție de setările browserului, unele se pot deschide într-o filă nouă.</p>`;
}

// „Exersează" printed onto a sphere, the way it would be printed on a real
// ball: around the equator, twice, so there is always some of it facing you.
//
// THE MATH. A point on a sphere of radius R, at azimuth θ (around) and
// latitude φ (up/down):
//
//     x = R·cos φ·sin θ      y = R·sin φ      z = R·cos φ·cos θ
//
// CSS can't take that triple directly, but `rotateY(θ) rotateX(−φ)
// translateZ(R)` lands on exactly the same point — and, unlike a raw
// translate3d, it also turns the glyph to lie FLAT ON the surface, tangent to
// it, facing outward. That difference is everything: a translated letter stays
// parallel to the screen and looks stuck on with tape; a rotated one belongs to
// the curve.
//
// The word sits on the equator (φ = 0) with a gentle rise toward the middle of
// each copy, so the line of type arcs like lettering on a beach ball instead of
// running dead straight. The globe as a whole is then tilted a few degrees in
// tests-float.js, which turns that equator into an ellipse on screen — the
// single strongest cue that this is a sphere and not a ring.
function ballGlobe(word, reps = 2) {
  const chars = [];
  for (let r = 0; r < reps; r++) {
    for (const c of word) chars.push({ c, r });
    chars.push({ c: "·", r, sep: true });
  }
  const n = chars.length;
  const STEP = 360 / n; // evenly all the way round — no seam, no gap
  return chars.map((it, i) => {
    const theta = i * STEP;
    // A shallow arc: highest in the middle of each copy of the word, level at
    // the separators. ±5° of latitude is enough to read as curvature.
    const phase = ((i * STEP) % (360 / reps)) / (360 / reps); // 0…1 within a copy
    const phi = Math.sin(phase * Math.PI) * 5;
    // A word gap still needs its slot on the equator, but an ordinary space in
    // an absolutely-positioned box collapses to nothing — hence the hard space.
    const glyph = it.c === " " ? "&nbsp;" : esc(it.c);
    return `<span class="tcat__ball__l${it.sep ? " is-sep" : ""}" data-r="${it.r}"
                  style="--th:${theta.toFixed(2)}deg; --ph:${phi.toFixed(2)}deg"
                  ${it.r > 0 || it.sep ? 'aria-hidden="true"' : ""}>${glyph}</span>`;
  }).join("");
}

// The ball itself. An <a> when there is somewhere to go, a plain <span> when
// there isn't — rather than a link that's disabled, which still invites the
// click and then refuses it.
function ballHtml() {
  const intra = poateIntra();                  // profesorul intră și la categoria închisă
  const doarProf = adminMode && !cat.live;     // închisă elevilor, deschisă lui
  /* Cuvântul de pe bilă are o lungime de respectat: literele se împart în jurul
     sferei, deci un cuvânt lung le înghesuie până se ating. „Pregătește" (10) e
     vecin cu „Exersează" (9) și „În curând" (9); „Grila de itemi" (14) le-ar fi
     îndesat. Ce face profesorul acolo scrie oricum dedesubt. */
  const word = doarProf ? "Pregătește" : cat.live ? "Exersează" : "În curând";
  const tag = intra ? "a" : "span";
  const attrs = intra
    ? ` href="#joc" aria-label="${esc(word)} — ${doarProf ? "pregătește banca de itemi" : "antrenament interactiv"}"`
    : ` role="note" aria-label="${esc(word)} — banca de itemi se pregătește"`;
  const body = doarProf
    ? `<b>Deocamdată numai pentru tine.</b> Elevii încă nu văd jocul aici.
       Intri în grilă și pui cerințele, răspunsurile și etichetele; când banca
       e gata, se deschide și lor.`
    : cat.live
      ? `<b>Antrenament interactiv.</b> Rezolvi câte un item pe rând, cu
         explicație imediată. Cei greșiți revin până îi nimerești.`
      : `<b>Se pregătește.</b> Strângem itemii pentru această categorie și îi
         verificăm unul câte unul. Între timp, subiectele se pot descărca.`;
  return `<${tag} class="tcat__ball"${attrs}>
      <span class="tcat__ball__globe">${ballGlobe(word)}</span>
      <span class="tcat__ball__shade" aria-hidden="true"></span>
      <span class="tcat__ball__in">
        <span class="tcat__ball__ic" aria-hidden="true">${adminMode && intra ? "🛠️" : cat.icon}</span>
        <span class="tcat__ball__title" aria-hidden="true">${esc(word)}</span>
        <span class="tcat__ball__more">${body}</span>
      </span>
    </${tag}>`;
}

function renderIntro() {
  root.className = "tcat";
  const soon = `<p class="tcat__soon">Va urma.</p>`;
  root.innerHTML = `
    <section class="tcat__hero">
      <span class="tcat__icon" aria-hidden="true">${cat.icon}</span>
      <div>
        <h1 class="tcat__title">${esc(cat.title)}</h1>
        <p class="tcat__desc">${esc(cat.desc)}</p>
      </div>
    </section>

    <!-- Two worlds side by side, neither nested in the other: the archive on
         its own light surface, the practice on its own dark card. The archive
         comes FIRST in the markup, so on a narrow screen it also comes first. -->
    <div class="tcat__split">
      <!-- Not gated on cat.live: a category can have papers to download long
           before it has an item bank to play with. -->
      <section class="tcat__files">
        <h2 class="tcat__ph">
          <span aria-hidden="true">📄</span> Teste descărcabile
          ${folderUrl
            ? `<a class="tdl__all" href="${esc(folderUrl)}" target="_blank" rel="noopener noreferrer"
                  title="Deschide folderul cu toate testele. De acolo le poți descărca pe toate deodată.">
                 <span class="tdl__all__ic" aria-hidden="true"></span> Toate, pe Drive
               </a>`
            : ""}
        </h2>
        ${downloadList()}
      </section>

      <!-- The tank. Sticky, so it holds still while the archive scrolls past —
           which is what makes scrolling feel like shaking it. -->
      <!-- Every category gets the ball, live or not. A category still being
           built is a page a pupil will visit exactly once unless something
           there is alive; a dead panel saying „va urma" guarantees they don't
           come back. What changes is only what it says and whether it leads
           anywhere — a ball that isn't a link can't promise a game that
           doesn't exist yet. -->
      <aside class="tcat__tank${poateIntra() ? "" : " is-soon"}">
        <span class="tcat__shadow" aria-hidden="true"></span>
        ${ballHtml()}
      </aside>
    </div>`;

  // renderIntro runs again on every fetch and every role change, so the old
  // loop and its listeners have to go before a new one starts — otherwise
  // they stack up, each pushing the same button.
  stopFloat?.();
  stopFloat = initFloatingPlay(root.querySelector(".tcat__tank"));
  legBanda();
}

/* APĂSAREA PE UN AN. Ascultătorul stă pe BANDĂ, nu pe fiecare buton: panoul
   se redesenează la fiecare `renderIntro` (fetch, schimbare de rol), iar
   ascultători puși pe butoane s-ar duce odată cu ele, ori s-ar stivui.
   Nu se redesenează banda, ci doar panoul: altfel butonul apăsat ar dispărea
   de sub deget și s-ar pierde și focalizarea de la tastatură. */
function legBanda() {
  const banda = root.querySelector(".tb__ani");
  const panou = root.querySelector("#tb-panou");
  if (!banda || !panou) return;
  const arata = (an) => {
    const fisiere = fisiereleAnului(an);
    if (!fisiere.length) return;
    panou.innerHTML = panouAn(an, fisiere);
    banda.querySelectorAll("[data-an]").forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.an === String(an))));
  };
  banda.addEventListener("click", (e) => {
    const b = e.target.closest("[data-an]");
    if (b) arata(Number(b.dataset.an));
  });
  /* Săgețile stânga-dreapta plimbă prin ani, cum se cere la un rând de file.
     Fără ele, banda ar fi o listă de butoane pe care le poți doar tab-ui unul
     câte unul, ceea ce la nouă ani e obositor. */
  banda.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const toate = [...banda.querySelectorAll("[data-an]")];
    const acum = toate.findIndex((b) => b.getAttribute("aria-selected") === "true");
    const urm = toate[acum + (e.key === "ArrowRight" ? 1 : -1)];
    if (!urm) return;
    e.preventDefault();
    urm.focus();
    arata(Number(urm.dataset.an));
  });
}

/* Fișierele unui an, luate din `downloads`. Cheia poate fi număr ori șir, după
   cum a venit din bază; se caută în amândouă felurile. */
function fisiereleAnului(an) {
  return downloads.filter((d) => String(d.year) === String(an));
}

// =========================================================
// #LaTablă, fonetică: logica tablei de lucru.
//
// Se încarcă drept modul, DUPĂ ce poarta de prelansare a spus „poți intra".
// Fiind modul, nu mai varsă nimic în fereastra globală: tot ce e mai jos
// rămâne închis aici, deci nu se poate ciocni cu restul sitului.
// =========================================================

/* ==========================================================================
   Fonetică – logica aplicației
   Câmpuri de lucru = elemente .field (contenteditable, font monospace).
   Notițele sunt separate (textarea normală, fără remapări).
   ========================================================================== */

const sheet       = document.getElementById('sheet');
const rowTemplate = document.getElementById('rowTemplate');
const toolbar     = document.getElementById('toolbar');

/* Simboluri configurabile pentru tastele 1-4 (userul le poate schimba din panoul „Simboluri").
   Se salvează în localStorage, ca să rămână la reîncărcare (cu try/catch pentru siguranță). */
const DEFAULT_SYMBOLS = {
  '1': { char: 'ĉ',  bold: false },
  '2': { char: 'ĝ',  bold: false },
  '3': { char: 'Ķ',  bold: true  },
  '4': { char: 'Ģ',  bold: true  }
};
/* ================= SEMNELE SCOASE DIN UZ =================

   Semnele celor patru taste se pot schimba, iar când se schimbă rămân în urmă
   două feluri de moștenire:

   1. ALEGEREA DIN BROWSER. Setul se ține în localStorage, iar ce e salvat bate
      ce scrie în cod. Fără o versiune pe el, ai schimba semnul aici și n-ai
      vedea nicio schimbare pe ecran: browserul ar da mai departe semnul vechi.

   2. TABLELE DEJA SCRISE. Semnul vechi stă ca text în transcrieri. Nemaifiind
      în listă, și-ar pierde cutia de o celulă, iar rândul c/v/s de dedesubt
      n-ar mai cădea sub sunetul lui.

   Harta de mai jos le rezolvă pe amândouă: setul salvat se îndreaptă la
   citire, tablele se îndreaptă la deschidere. Când se mai schimbă vreun semn,
   se adaugă o pereche aici și se ridică versiunea, atât. */
const SIMBOLURI_RETRASE = { 'k̇': 'Ķ', 'ġ': 'Ģ' };
const VERSIUNEA_SIMBOLURILOR = 2;

function loadSymbols() {
  try {
    const raw = localStorage.getItem('fonetica_symbols');
    if (raw) {
      const o = JSON.parse(raw);
      if (o && o['1'] && o['2'] && o['3'] && o['4']) {
        const taste = { '1': o['1'], '2': o['2'], '3': o['3'], '4': o['4'] };
        if (Number(o.v) !== VERSIUNEA_SIMBOLURILOR) {
          // Numai semnele retrase se schimbă. Dacă ți-ai pus tu alt semn pe o
          // tastă, alegerea ta rămâne: n-am de ce s-o calc.
          for (const k of ['1', '2', '3', '4']) {
            const nou = SIMBOLURI_RETRASE[taste[k].char];
            if (nou) taste[k] = { ...taste[k], char: nou };
          }
        }
        return taste;
      }
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_SYMBOLS));
}
function saveSymbols() {
  try {
    localStorage.setItem('fonetica_symbols',
      JSON.stringify({ v: VERSIUNEA_SIMBOLURILOR, ...symbols }));
  } catch (e) {}
}
let symbols = loadSymbols();
saveSymbols();          // ridicăm versiunea pe loc, ca îndreptarea să nu se repete

/* Inserează simbolul asociat unei taste (1-4), bold sau normal, după setare.
   Simbolul intră într-o cutie de o celulă (span.sym, lat 1ch), nu ca text gol.

   DE CE: rândul c/v/s de dedesubt se aliniază numărând coloane, adică se
   bizuie pe faptul că fiecare semn ocupă exact o celulă de monospațiat. Asta e
   adevărat pentru literele obișnuite, dar nu și pentru sunetele speciale:
   „ĉ" și „ĝ" pot lipsi din fontul monospațiat al calculatorului, iar atunci
   browserul le împrumută din alt font, cu altă lățime. Iar un semn poate fi
   chiar din două puncte de cod: așa era „k̇", literă plus punct combinat, până
   să-i ia locul „Ķ". De-aici venea deplasarea mică de dedesubt.
   Cutia de 1ch le ține pe toate într-o singură celulă, oricum ar fi desenate. */
function insertSymbol(key, field) {
  const s = symbols[key];
  if (!s || !s.char) return;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  // Cutia e închisă: dacă cursorul a nimerit înăuntrul uneia, iese întâi afară.
  // Fără asta, sunetul nou s-ar scrie în celula de o literă a celui vechi.
  scoateCursorulDinCutie();
  const range = sel.getRangeAt(0);
  range.deleteContents();
  curataCutiile(campulCursorului());

  /* CÂMPUL SE IA DE LA CURSOR, NU DE LA FOCUS.
     Butonul din bară îl afla prin `document.activeElement`, iar acela poate fi
     cu totul altceva: ajunge un clic pe cerință, pe notițe sau pe fundal, și
     focusul pleacă din câmp, deși selecția rămâne acolo unde era. Simbolul se
     ducea atunci la locul lui, dar fără virgulă, fiindcă din câmpul „nul" nu
     se putea afla că e o transcriere.
     Cursorul, în schimb, e chiar locul unde scriem: el nu poate minți. */
  const camp = campulCursorului() || field;
  virgulaLipsa(camp);

  const cutie = cutieDeSimbol(s);
  /* După o virgulă pusă acum, selecția s-a mutat: luăm intervalul din nou,
     altfel am insera acolo unde era cursorul ÎNAINTE de virgulă. */
  const loc = sel.getRangeAt(0);
  loc.insertNode(cutie);

  /* CURSORUL ARE NEVOIE DE UN LOC ADEVĂRAT DUPĂ CUTIE.
     Aici era buba: după cutie lăsam cursorul „între noduri", iar poziția aia e
     ambiguă pentru browser. Lângă o cutie `inline-block` el o rezolvă cel mai
     des ÎNĂUNTRUL cutiei, mai ales când cutia e ultimul lucru din câmp și n-are
     ce urma după ea. De acolo, sunetul următor se scria în celula de o literă
     și nu se mai vedea nicăieri: părea că tabla nu te lasă să scrii.

     Un cursor așezat ÎNTR-UN TEXT n-are ce să rezolve, e limpede de la sine.
     De-aia punem după cutie un nod de text și intrăm în el. În transcriere
     textul acela e chiar virgula care desparte sunetele, deci nu costă nimic. */
  const coada = document.createTextNode(cuVirgule(camp) ? VIRGULA : '');
  cutie.after(coada);
  loc.setStart(coada, coada.length);
  loc.collapse(true);
  sel.removeAllRanges();
  sel.addRange(loc);
}

/* Cutia unui simbol, făcută într-un singur loc: o folosesc și inserarea, și
   îmbrăcarea simbolurilor dintr-o tablă salvată. Dacă se schimbă ceva la ea,
   se schimbă pentru amândouă. */
function cutieDeSimbol(s) {
  const cutie = document.createElement('span');
  cutie.className = 'sym';
  /* Cutia e un LUCRU ÎNTREG, nu un loc de scris. Așa browserul n-are voie să
     ducă cursorul înăuntrul ei, oricât ar încerca să-l „îndrepte", iar la
     ștergere sunetul special piere dintr-o singură apăsare, cum se și cuvine:
     e un sunet, nu două litere. */
  // Scris ca ATRIBUT, nu prin însușirea `contentEditable`: atributul se vede
  // și în HTML-ul salvat, deci tabla adusă înapoi din cont păstrează paza.
  cutie.setAttribute('contenteditable', 'false');
  if (s.bold) {
    const b = document.createElement('b');
    b.textContent = s.char;
    cutie.appendChild(b);
  } else {
    cutie.textContent = s.char;
  }
  return cutie;
}

/* ================= Virgula automată din transcriere =================
   În câmpul de transcriere, fiecare sunet vine cu virgula lui după el. Nu e
   o înfrumusețare: virgula e ceea ce desparte sunetele unul de altul, iar
   dacă o pune mașina, elevul nu mai are cum să uite vreuna și nu mai pierde
   timp cu ea. Câmpul c/v/s de dedesubt se aliniază oricum după separatori,
   deci virgulele îl ajută și pe el să pună literele sub sunetul potrivit.

   Virgula stă ÎN URMA cursorului, nu înaintea lui: după ce ai scris „k" pe
   tablă apare „k, " și scrii mai departe. Așa următorul sunet are deja unde
   să se așeze. Cea de la coadă se taie când pleci din câmp.
   =================================================================== */
const VIRGULA = ', ';

/* Doar transcrierea primește virgule. Cuvântul și despărțirea în silabe se
   scriu ca în caiet, iar rândul c/v/s are regulile lui. */
function eTranscriere(field) {
  return !!field && field.classList && field.classList.contains('trans');
}

/* TRANSCRIEREA UNEI PROPOZIȚII E TOT TRANSCRIERE, DAR FĂRĂ VIRGULE.

   La un cuvânt, virgula desparte sunetele: „k, a, s, ă". La o propoziție
   întreagă ar ieși un șirag de virgule în care nu se mai vede nimic, așa că
   acolo sunetele se scriu unul după altul, iar SPAȚIUL desparte cuvintele.
   Virgula rămâne pentru virgula din enunț, cratima pentru ortograme.

   Toate celelalte reguli sunt aceleași: „c" tot „k" se face, sunetele speciale
   tot în cutiile lor stau, diacriticele de pe Shift la fel. Se schimbă un
   singur lucru, deci întrebăm un singur lucru. */
const eFrazaTrans = (field) =>
  !!field && field.classList && field.classList.contains('trans-fraza');
const cuVirgule = (field) => eTranscriere(field) && !eFrazaTrans(field);

/* Toate nodurile de text dintr-un câmp, în ordinea în care se citesc. */
function noduriText(radacina) {
  const out = [];
  const w = document.createTreeWalker(radacina, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) out.push(w.currentNode);
  return out;
}

/* Câmpul în care se află cursorul acum. */
function campulCursorului() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const c = sel.getRangeAt(0).startContainer;
  const el = c.nodeType === Node.TEXT_NODE ? c.parentElement : c;
  return el && el.closest ? el.closest('.field') : null;
}

/* ================= CUTIA E ÎNCHISĂ PENTRU CURSOR =================

   Cutia unui sunet special are lățimea unei singure litere, fiindcă rândul
   c/v/s de dedesubt numără coloane. Dacă ajunge cursorul înăuntrul ei, tot ce
   scrii mai departe se îngrămădește în celula aceea și se așază pe verticală,
   una sub alta: pe ecran pare că tabla a înnebunit.

   `contenteditable="false"` oprește tastatura, dar NU oprește o selecție pusă
   din cod. Iar noi punem selecții din cod la fiecare ștergere, ca să găsim
   litera dinainte. De-acolo venea stricăciunea: ștergeai o virgulă, cursorul
   sărea în nodul de text din cutie, și acolo rămânea.

   Regula de aici e simplă și se ține într-un singur loc: ÎNAINTE de orice
   scriere sau ștergere, cursorul e scos din cutie. Cutia e un sunet, nu un loc
   de scris.
   ================================================================= */

/** Cutia de simbol în care stă nodul dat, dacă stă în vreuna. */
function cutiaLui(nod) {
  const el = nod && nod.nodeType === Node.TEXT_NODE ? nod.parentElement : nod;
  return el && el.closest ? el.closest('.sym') : null;
}

/** Scoate cursorul din cutie, dacă a nimerit înăuntru. */
function scoateCursorulDinCutie() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const r = sel.getRangeAt(0);
  const cutie = cutiaLui(r.startContainer);
  if (!cutie) return false;

  // Lipit de marginea din stânga înseamnă „înaintea cutiei"; orice altceva
  // înseamnă „după ea". Nu există un al treilea loc: cutia n-are mijloc.
  const laInceput = r.startOffset === 0 &&
    (r.startContainer === cutie || cutie.firstChild === r.startContainer);
  const vecin = laInceput ? cutie.previousSibling : cutie.nextSibling;
  let loc = vecin && vecin.nodeType === Node.TEXT_NODE ? vecin : null;
  if (!loc) {
    loc = document.createTextNode('');
    if (laInceput) cutie.before(loc); else cutie.after(loc);
  }
  const nou = document.createRange();
  nou.setStart(loc, laInceput ? 0 : loc.length);
  nou.collapse(true);
  sel.removeAllRanges();
  sel.addRange(nou);
  return true;
}

/** Cutia care stă exact înaintea cursorului, dacă acolo e una. */
function cutiaDinainteaCursorului() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  let nod;
  if (r.startContainer.nodeType === Node.TEXT_NODE) {
    if (r.startOffset > 0) return null;            // mai e text de șters înainte
    nod = r.startContainer.previousSibling;
  } else {
    nod = r.startContainer.childNodes[r.startOffset - 1] || null;
  }
  // Nodurile de text goale rămân după fiecare inserare; nu sunt nimic de șters.
  while (nod && nod.nodeType === Node.TEXT_NODE && nod.textContent === '') nod = nod.previousSibling;
  return nod && nod.nodeType === Node.ELEMENT_NODE && nod.classList &&
         nod.classList.contains('sym') ? nod : null;
}

/* SELECȚIA CARE IESE DIN CÂMP.

   Cu mouse-ul poți trage o selecție din cuvânt până în transcriere, ba chiar
   peste două rânduri. Dacă apoi scrii o literă, ștergerea selecției ar tăia și
   peste ce e ÎNTRE câmpuri: nu doar textul, ci chiar căsuțele. Un rând poate
   rămâne fără transcriere, iar tabla fără o coloană.

   Regula: se scrie în câmpul în care ai apăsat tasta, și numai în el. Selecția
   care iese afară se strânge la capătul dinăuntru, adică acolo unde ai isprăvit
   de tras cu mouse-ul. */
function strangeSelectiaLaCamp(camp) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !camp) return;
  const r = sel.getRangeAt(0);
  const inceputulE = camp.contains(r.startContainer);
  const sfarsitulE = camp.contains(r.endContainer);
  if (inceputulE && sfarsitulE) return;             // totul într-un câmp: e bine
  if (!inceputulE && !sfarsitulE) { caretLaCoada(camp); return; }

  const nou = document.createRange();
  if (sfarsitulE) nou.setStart(r.endContainer, r.endOffset);
  else nou.setStart(r.startContainer, r.startOffset);
  nou.collapse(true);
  sel.removeAllRanges();
  sel.addRange(nou);
}

/** Nodurile de text în care chiar se poate scrie: cele din cutii nu se pun. */
function noduriDeScris(radacina) {
  return noduriText(radacina).filter(
    (n) => !n.parentElement || !n.parentElement.closest('.sym'));
}

/* Semnele combinate rămase singure: punctul de deasupra lui „k̇" fără „k"-ul lui.
   Nu sunt litere, ci semne care se desenează PESTE litera dinainte; rămase
   singure, se lipesc de ce nimeresc și par murdărie pe tablă. */
const faraSemneSingure = (t) => String(t || '').replace(/[̀-ͯ]/g, '');

/* O selecție care taie PRIN mijlocul unei cutii îi poate scoate jumătate din
   sunet: rămâne o celulă cu „k" fără punct, ori numai cu punctul. Nici una,
   nici alta nu mai e un sunet, deci cutia se desface pe loc: ce a mai rămas
   iese ca text simplu, iar dacă n-a rămas nimic de citit, piere cu totul. */
function curataCutiile(camp) {
  if (!camp) return;
  const lista = Object.values(symbols).map((s) => s && s.char).filter(Boolean);
  camp.querySelectorAll('.sym').forEach((c) => {
    const tot = c.textContent;
    if (lista.includes(tot)) return;                 // sunet întreg, o lăsăm în pace
    const ramas = faraSemneSingure(tot);
    if (!ramas) { c.remove(); return; }
    c.replaceWith(document.createTextNode(ramas));
  });
}

/* Citește cele n caractere dinaintea cursorului.
   Trece peste hotarul dintre noduri dinadins: fiecare inserare taie textul în
   noduri noi, așa că după o ștergere cursorul ajunge des la începutul unui nod
   gol, iar virgula pe care o căutăm stă în nodul dinainte. Dacă ne-am uita
   numai în nodul curent, am crede că nu e nicio virgulă acolo. */
function ultimele(n) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return '';
  const r = sel.getRangeAt(0);
  const camp = campulCursorului();
  if (!camp) return '';
  /* Un range de la începutul câmpului până la cursor, și îl citim.
     Varianta dinainte umbla din nod în nod și se oprea la nodul cursorului.
     Mergea cât timp cursorul stătea într-un text, dar nu și când stătea ÎNTRE
     noduri (după o cutie de simbol, de pildă): atunci `startContainer` e un
     element, egalitatea nu se potrivea niciodată, iar noi citeam tot câmpul,
     inclusiv ce era DUPĂ cursor. Așa, ștergerea vedea o virgulă care nu era
     acolo unde credea ea. */
  try {
    const pana = document.createRange();
    pana.setStart(camp, 0);
    pana.setEnd(r.startContainer, r.startOffset);
    return pana.toString().slice(-n);
  } catch (e) {
    return '';
  }
}

/* Scoate virgula automată de dinaintea cursorului, dacă acolo e chiar ea.
   Întoarce true dacă a găsit-o și a scos-o. */
function stergeVirgula() {
  if (ultimele(VIRGULA.length) !== VIRGULA) return false;
  for (let i = 0; i < VIRGULA.length; i++) deletePrevChar();
  return true;
}

/* Virgula care ar fi trebuit să fie ÎNAINTEA sunetului nou.

   La ieșirea din câmp, virgula atârnată de la coadă se strânge, cum se cuvine.
   Dar când te întorci să scrii mai departe, ea nu mai e acolo, iar sunetul nou
   s-ar lipi de cel dinainte: „ma" în loc de „m, a". Același lucru se întâmplă
   după o transcriere lipită de altundeva.

   Regula rămâne cea de la început: virgulele le pune mașina, nu elevul. Deci,
   dacă înaintea cursorului stă un sunet fără despărțitor, îl punem noi. */
function virgulaLipsa(camp) {
  if (!cuVirgule(camp)) return;
  const inainte = ultimele(1);
  if (!inainte) return;                          // suntem la începutul câmpului
  if (/[\s,\-[(]/.test(inainte)) return;          // e deja despărțit
  insertText(VIRGULA);
}

/* Pune un sunet la cursor. În transcriere, cu virgula lui după el. */
function insertSunet(text, field) {
  virgulaLipsa(field);
  insertText(cuVirgule(field) ? text + VIRGULA : text);
}

/* Semnele care NU sunt sunete, deci nu primesc virgulă. Apostroful lipsește
   dinadins din listă: el nu e sunet nou, ci înmoaie sunetul dinainte (k'),
   așa că trebuie să rămână lipit de el, fără virgulă între ele. */
const NU_E_SUNET = new Set([' ', '\u00a0', '[', ']', '(', ')', '/', '.', ':', ';', '!', '?']);

/* Ce desparte dou\u0103 sunete, pentru r\u00e2ndul c/v/s de dedesubt: tot ce nu e sunet,
   plus semnele de desp\u0103r\u021bire. Se face din lista de mai sus, nu se scrie a doua
   oar\u0103: dac\u0103 un semn nu e sunet, atunci nici coloan\u0103 de c/v/s nu i se cuvine.
   Apostroful lipse\u0219te dinadins din am\u00e2ndou\u0103: el \u00eenmoaie sunetul dinainte \u0219i st\u0103
   pe coloana lui, nu pe una nou\u0103. */
const DESPARTITORI = new Set([...NU_E_SUNET, ',', '-', '\u2013']);

/* Taie virgula rămasă la coadă când elevul pleacă din câmp.
   Umblă doar pe ultimul nod de text cu conținut, nu pe tot câmpul: dacă am
   rescrie `textContent`, s-ar pierde simbolurile îngroșate (k̇, ġ), care sunt
   elemente <b>, nu text simplu. */
function taieVirgulaFinala(el) {
  const noduri = [];
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) noduri.push(w.currentNode);
  for (let i = noduri.length - 1; i >= 0; i--) {
    const n = noduri[i];
    const nou = n.textContent.replace(/,[\s\u00a0]*$/, '');
    if (nou !== n.textContent) { n.textContent = nou; return; }
    // nod format numai din spații și paranteza de închidere: sărim peste el
    if (n.textContent.replace(/[\s\u00a0\]]/g, '') !== '') return;
  }
}

/* ÎNDREPTAREA CUTIILOR UMFLATE.

   Cât timp cursorul lăsat după cutie cădea înapoi în ea, virgula și sunetele
   scrise mai departe intrau ÎNĂUNTRUL cutiei, care are lățimea unei singure
   litere. Pe ecran se vedea „ġo" lipit, iar virgula părea că lipsește: de fapt
   era acolo, dar ascunsă în celulă, împreună cu restul.

   Bugul e reparat, dar tablele scrise atunci au rămas strâmbe. Aici le
   desfacem: în cutie rămâne simbolul, restul iese după ea, la locul lui.
   Se cheamă la deschiderea tablei și la ieșirea din câmp, deci vechiul se
   îndreaptă de la sine, pe măsură ce lucrezi. */
function desumflaCutiile(el, lista) {
  el.querySelectorAll('.sym').forEach((c) => {
    const tot = c.textContent;
    if (lista.includes(tot)) return;              // cutia e curată, o lăsăm în pace
    // Golită de ștergere, ori rămasă doar cu un semn combinat: n-are ce citi
    // nimeni în ea.
    if (!faraSemneSingure(tot)) { c.remove(); return; }
    /* Orice altceva o desfacem CU TOTUL și lăsăm îmbrăcarea s-o ia de la capăt.
       Așa se îndreaptă și cutiile cu un singur sunet lipit de altceva, și cele
       în care au încăput șase sunete cu virgulele lor: nu ne mai trebuie o
       socoteală aparte pentru fiecare fel de stricăciune. Îngroșarea nu se
       pierde, fiindcă <b>-urile ies afară așa cum sunt, iar îmbrăcarea le
       recunoaște. */
    c.replaceWith(...Array.from(c.childNodes));
  });
}

/* ================= Îmbrăcarea simbolurilor deja scrise =================
   Cutia de o celulă se pune la inserare, dar tablele scrise ÎNAINTE de asta au
   simbolurile ca text gol, deci s-ar purta mai departe după lățimea pe care
   le-o dă fontul. Funcția de mai jos le îmbracă și pe ele, ca să nu fie
   nevoie de rescris nimic.

   Se cheamă la deschiderea unei table și la ieșirea din câmp, deci vechiul se
   îndreaptă de la sine, pe măsură ce lucrezi. */
/* Semnele vechi, prefăcute în cele noi chiar acolo unde stau scrise. Umblă și
   prin cutii, ca o cutie cu semnul vechi să rămână cutie cu semnul nou, nu să
   fie desfăcută ca una stricată. */
function inlocuiesteSemneleRetrase(el) {
  const perechi = Object.entries(SIMBOLURI_RETRASE);
  if (!perechi.length) return;
  for (const nod of noduriText(el)) {
    let t = nod.textContent;
    let schimbat = false;
    for (const [vechi, nou] of perechi) {
      if (t.includes(vechi)) { t = t.split(vechi).join(nou); schimbat = true; }
    }
    if (schimbat) nod.textContent = t;
  }
}

function imbracaSimboluri(el) {
  if (!el) return;
  const lista = Object.values(symbols).map(s => s && s.char).filter(Boolean);
  if (!lista.length) return;

  inlocuiesteSemneleRetrase(el);
  desumflaCutiile(el, lista);

  const cutieCu = (nod) => {
    const c = cutieDeSimbol({ char: '' });   // cutia goală, cu toate însușirile ei
    c.appendChild(nod);
    return c;
  };

  // 1. simbolurile îngroșate: un <b> care ține exact un simbol.
  //    Bold-ul pus de elev pe un cuvânt întreg NU se atinge: numai <b>-urile
  //    care conțin fix un simbol din tabel intră în cutie.
  el.querySelectorAll('b').forEach((b) => {
    if (b.closest('.sym')) return;
    if (!lista.includes(b.textContent)) return;
    const gol = document.createElement('span');
    b.replaceWith(gol);
    gol.replaceWith(cutieCu(b));
  });

  // 2. simbolurile rămase ca text simplu
  for (const nod of noduriText(el)) {
    if (!nod.parentElement || nod.parentElement.closest('.sym')) continue;
    const t = nod.textContent;
    let i = 0, gasit = false;
    const bucati = [];
    while (i < t.length) {
      const sim = lista.find((x) => t.startsWith(x, i));
      if (sim) { bucati.push({ sim }); i += sim.length; gasit = true; continue; }
      const ultim = bucati[bucati.length - 1];
      if (ultim && ultim.text !== undefined) ultim.text += t[i];
      else bucati.push({ text: t[i] });
      i++;
    }
    if (!gasit) continue;
    const frag = document.createDocumentFragment();
    for (const b of bucati) {
      if (b.sim) frag.appendChild(cutieCu(document.createTextNode(b.sim)));
      else frag.appendChild(document.createTextNode(b.text));
    }
    nod.replaceWith(frag);
  }

  /* Fiecare inserare rupe textul în noduri noi. Lipite la loc, ștergerea are de
     unde mușca și nu mai trebuie să sară din nod în nod. */
  el.normalize();
}

const A_VARIANTS = ['ă', 'î', 'â'];   // ciclul pentru Shift+A

/* ---------- Utilitare pentru selecție / cursor ---------- */

function activeField() {
  const el = document.activeElement;
  return (el && el.classList && el.classList.contains('field')) ? el : null;
}

/* inserează text simplu la cursor; caretBack = câte poziții mut cursorul înapoi */
function insertText(text, caretBack = 0) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  scoateCursorulDinCutie();
  const camp = campulCursorului();
  const range = sel.getRangeAt(0);
  range.deleteContents();
  curataCutiile(camp);                 // selecția putea tăia peste o cutie
  const node = document.createTextNode(text);
  range.insertNode(node);
  const pos = Math.max(0, node.length - caretBack);
  range.setStart(node, pos);
  range.setEnd(node, pos);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* șterge un caracter în stânga cursorului (pentru ciclul ă/î/â) */
/* Dacă cursorul stă la începutul unui nod de text (sau într-unul gol), îl mută
   la capătul nodului de dinainte. Fără asta, ștergerea n-ar avea de unde mușca:
   nodurile se rup la fiecare inserare, iar după o ștergere rămâne des un nod
   gol sub cursor. Întoarce true dacă a găsit unde să se așeze. */
function saiInNodulDinainte() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const r = sel.getRangeAt(0);
  if (r.startContainer.nodeType === Node.TEXT_NODE && r.startOffset > 0) return true;
  if (r.startContainer.nodeType !== Node.TEXT_NODE) return false;
  const camp = campulCursorului();
  if (!camp) return false;
  const noduri = noduriDeScris(camp);
  const i = noduri.indexOf(r.startContainer);
  for (let k = i - 1; k >= 0; k--) {
    if (noduri[k].length > 0) {
      const nou = document.createRange();
      nou.setStart(noduri[k], noduri[k].length);
      nou.collapse(true);
      sel.removeAllRanges();
      sel.addRange(nou);
      return true;
    }
  }
  return false;
}

function deletePrevChar() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  scoateCursorulDinCutie();

  /* Un sunet special piere dintr-o singură apăsare, cu cutie cu tot. Altfel
     ștergerea ar mușca o bucată din el („k̇" e literă plus semn combinat, două
     puncte de cod) și ar rămâne o cutie cu un sunet schilod înăuntru. */
  const cutie = cutiaDinainteaCursorului();
  if (cutie) {
    const loc = document.createTextNode('');
    cutie.before(loc);
    cutie.remove();
    const r = document.createRange();
    r.setStart(loc, 0);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    return;
  }

  saiInNodulDinainte();
  const range = sel.getRangeAt(0);
  if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
    range.setStart(range.startContainer, range.startOffset - 1);
    range.deleteContents();
    sel.removeAllRanges();
    sel.addRange(range);
  } else if (sel.modify) {
    /* Ultima portiță: lăsăm browserul să mute el capătul selecției. E singurul
       loc de aici care nu știe de cutii, așa că poate mușca dintr-un sunet
       special și să lase celula goală. De-aia trecem curățenia pe urma lui. */
    sel.modify('extend', 'backward', 'character');
    sel.deleteFromDocument();
  }
  curataCutiile(campulCursorului());
}

/* ---------- Ciclul Shift+A: ă → î → â → ă ... ---------- */

let aCycle = { active: false, index: 0 };
function resetACycle() { aCycle.active = false; }

/* Stare pentru substituția „c -> k" din transcriere.
   Când tastezi „c" punem „k" (implicit dur); dacă urmează i/e/h, revenim la „c". */
let ckPending = false;
function resetCK() { ckPending = false; }

/* caracterul imediat din stânga cursorului (ca să verificăm că e chiar „k"-ul pus de noi) */
function prevChar() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return '';
  const r = sel.getRangeAt(0);
  if (r.startContainer.nodeType === Node.TEXT_NODE && r.startOffset > 0) {
    return r.startContainer.textContent[r.startOffset - 1];
  }
  return '';
}

/* Shift+A ciclează ă -> î -> â peste același sunet. În transcriere, sunetul
   are virgulă după el, deci ca să-l înlocuim trebuie să ștergem întâi
   virgula, apoi litera, și să le punem pe amândouă la loc. */
function cycleA(field) {
  const coada = eTranscriere(field) ? VIRGULA : '';
  if (aCycle.active) {
    aCycle.index = (aCycle.index + 1) % A_VARIANTS.length;
    for (let i = 0; i < coada.length; i++) deletePrevChar();
    deletePrevChar();
    insertText(A_VARIANTS[aCycle.index] + coada);
  } else {
    aCycle.active = true;
    aCycle.index = 0;
    insertText(A_VARIANTS[0] + coada);
  }
}

/* ---------- Regula 7: superscript pe o selecție ----------
   caracterul selectat devine: superscript + bold + subliniat,
   cu un spațiu inserat ÎNAINTEA lui. */
function superscriptSelection() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return false;
  const text = range.toString();
  range.deleteContents();

  const frag = document.createDocumentFragment();
  frag.appendChild(document.createTextNode(' '));   // spațiu înainte
  const sup = document.createElement('sup');
  const b   = document.createElement('b');
  const u   = document.createElement('u');
  u.textContent = text;
  b.appendChild(u);
  sup.appendChild(b);
  frag.appendChild(sup);

  range.insertNode(frag);
  range.setStartAfter(sup);
  range.setEndAfter(sup);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

/* ---------- Butoane paranteze: „(  )” / „[  ]” cu cursorul la mijloc ---------- */
function insertPair(pair) {
  const sel = window.getSelection();
  if (sel && sel.rangeCount) sel.getRangeAt(0).collapse(false); // nu distrugem selecția
  const open = pair[0], close = pair[1];
  insertText(open + '  ' + close, 2); // „(  )” cu cursorul între cele două spații
}

/* ================= Rândul c/v/s: aliniere automată sub sunete =================
   „Sunet” = orice caracter din transcriere care NU e separator ( [ ] ( ) , - / spațiu ).
   Marcajele combinate (ex: punctul de la k̇) stau pe aceeași coloană cu litera de bază.
   Userul tastează doar c / v / s, iar fiecare literă cade automat sub sunetul potrivit. */

function soundColumns(transEl) {
  if (!transEl) return [];
  const s = transEl.textContent || '';
  const seps = DESPARTITORI;
  const cols = [];
  let col = 0;
  let inSound = false;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (code >= 0x0300 && code <= 0x036F) continue;   // marcaj combinat -> lipit de sunet, zero lățime
    if (seps.has(ch)) { inSound = false; col++; }      // separator -> încheie sunetul curent
    else {
      // un sunet = un grup de caractere între separatori (ex: ḱ = k + accent => UN singur sunet)
      if (!inSound) { cols.push(col); inSound = true; }
      col++;
    }
  }
  return cols;
}

function readTypeLetters(typesEl, cols) {
  const text = typesEl.textContent || '';
  return cols.map(c => { const ch = text[c]; return (ch && ch !== ' ') ? ch : undefined; });
}

function buildTypesText(cols, letters) {
  const maxCol = cols.length ? cols[cols.length - 1] : -1;
  const arr = new Array(maxCol + 1).fill(' ');
  cols.forEach((c, i) => { if (letters[i] && letters[i] !== ' ') arr[c] = letters[i]; });
  return arr.join('').replace(/\s+$/, ''); // fără spații reziduale la coadă
}

function caretColumnIn(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const r = sel.getRangeAt(0);
  if (r.startContainer === el) return 0;          // caret în element gol
  if (!el.contains(r.startContainer)) return 0;
  return r.startOffset;                            // un singur text node => offset = coloană
}

function setTypesCaret(typesEl, col) {
  typesEl.focus();
  let node = typesEl.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) { node = document.createTextNode(''); typesEl.appendChild(node); }
  if (node.length < col) node.textContent = node.textContent + ' '.repeat(col - node.length); // spații ca să ajungem la coloană
  const off = Math.min(col, node.length);
  const sel = window.getSelection();
  const range = document.createRange();
  range.setStart(node, off);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* tratează tastarea în câmpul c/v/s; returnează true dacă a preluat evenimentul */
function handleTypesKey(e, typesEl) {
  // navigare/ștergere cu taste de control -> comportament implicit
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Delete'].includes(e.key)) return false;

  const stage3 = typesEl.closest('.stage3');
  const transEl = stage3 ? stage3.querySelector('.trans') : null;
  const cols = soundColumns(transEl);
  if (!cols.length) return false; // fără sunete -> tastare normală

  if (e.key === 'Backspace') {
    e.preventDefault();
    const caretCol = caretColumnIn(typesEl);
    let idx = -1;
    for (let i = cols.length - 1; i >= 0; i--) { if (cols[i] < caretCol) { idx = i; break; } }
    if (idx === -1) return true;
    const letters = readTypeLetters(typesEl, cols);
    letters[idx] = undefined;
    typesEl.textContent = buildTypesText(cols, letters);
    setTypesCaret(typesEl, cols[idx]);
    return true;
  }

  // o singură literă -> sub sunetul curent, apoi sari la următorul
  if (e.key.length === 1 && /\p{L}/u.test(e.key)) {
    e.preventDefault();
    const caretCol = caretColumnIn(typesEl);
    let idx = cols.findIndex(c => c >= caretCol);
    if (idx === -1) return true; // dincolo de ultimul sunet
    const letters = readTypeLetters(typesEl, cols);
    letters[idx] = e.key.toLowerCase();
    typesEl.textContent = buildTypesText(cols, letters);
    const nextCol = (idx + 1 < cols.length) ? cols[idx + 1] : typesEl.textContent.length;
    setTypesCaret(typesEl, nextCol);
    return true;
  }

  if (e.key.length === 1) { e.preventDefault(); return true; } // alt caracter -> blocat (nu stricăm spațierea)
  return false;
}

/* pune cursorul sub primul sunet necompletat când intri în câmpul c/v/s */
function focusTypes(typesEl) {
  typesEl.focus();
  const stage3 = typesEl.closest('.stage3');
  const transEl = stage3 ? stage3.querySelector('.trans') : null;
  const cols = soundColumns(transEl);
  if (!cols.length) { placeCaret(typesEl, true); return; }
  const letters = readTypeLetters(typesEl, cols);
  let idx = letters.findIndex(x => !x);
  const col = (idx === -1) ? (cols[cols.length - 1] + 1) : cols[idx];
  setTypesCaret(typesEl, col);
}

/* la intrarea în transcrierea goală: pune automat „[  ]" cu cursorul între cele două spații */
function focusTrans(transEl) {
  transEl.focus();
  const bare = (transEl.textContent || '').replace(/​/g, '').trim();
  if (bare === '') {
    transEl.textContent = '[  ]';
    const node = transEl.firstChild;
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(node, 2);   // „[ | ]" – între cele două spații
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    placeCaret(transEl, true);
  }
}

/* ---------- Gestionarea tastaturii în câmpurile de lucru ---------- */
sheet.addEventListener('keydown', (e) => {
  const field = e.target.closest && e.target.closest('.field');
  if (!field) return;

  /* PRIMUL LUCRU: cursorul iese din cutie, dacă a nimerit înăuntru.
     Se face AICI, înaintea oricărei hotărâri, fiindcă tot ce urmează citește
     ce e înaintea cursorului: dacă îl mutam mai încolo, virgula s-ar fi pus de
     două ori („ĉ, , a"), iar ștergerea ar fi crezut că n-are ce șterge. */
  strangeSelectiaLaCamp(field);
  scoateCursorulDinCutie();

  // tastele modificatoare apăsate singure nu fac nimic și NU rup ciclul ă/î/â
  // (altfel, keydown-ul lui Shift ar reseta ciclul înainte de a ajunge la „A”)
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;

  // Enter -> rând nou
  if (e.key === 'Enter') {
    e.preventDefault();
    resetACycle(); resetCK();
    addRowAfter(field.closest('.row'));
    return;
  }
  // Tab -> etapa următoare / precedentă
  if (e.key === 'Tab') {
    e.preventDefault();
    resetACycle(); resetCK();
    navigate(field, e.shiftKey);
    return;
  }

  // Lăsăm combinațiile Ctrl/Alt/Meta să funcționeze normal (Ctrl+A, Ctrl+C, Ctrl+B...)
  if (e.ctrlKey || e.altKey || e.metaKey) { resetACycle(); resetCK(); return; }

  // Câmpul c/v/s: literele se plasează automat sub sunete (nu se aplică remapările generice)
  if (field.classList.contains('types')) { handleTypesKey(e, field); return; }

  // Shift + a / s / t -> diacritice
  if (e.shiftKey) {
    resetCK();
    if (e.code === 'KeyA') { e.preventDefault(); cycleA(field); return; }
    resetACycle();
    if (e.code === 'KeyS') { e.preventDefault(); insertSunet('ș', field); return; }
    if (e.code === 'KeyT') { e.preventDefault(); insertSunet('ț', field); return; }
    return; // alte litere cu Shift -> majuscule normale
  }

  resetACycle(); // orice altă tastă rupe ciclul ă/î/â

  // „c -> k" DOAR în transcriere (dar „c" rămâne „c" înainte de i / e / h)
  if (field.classList.contains('trans')) {
    // Ștergerea ia sunetul CU TOT CU virgula lui, dintr-o singură apăsare.
    // Virgula a pus-o mașina, nu elevul, deci tot mașina o strânge: altfel ar
    // trebui să apeși de două ori pentru fiecare greșeală.
    if (e.key === 'Backspace' && !e.shiftKey && cuVirgule(field) &&
        ultimele(VIRGULA.length) === VIRGULA) {
      e.preventDefault();
      resetCK();
      stergeVirgula();
      deletePrevChar();
      return;
    }

    // tocmai am pus „k" din „c", iar acum vine i/e/h -> refacem „c".
    // Virgula stă între „k" și cursor, așa că o dăm la o parte ca să ajungem
    // la literă, și o punem înapoi după grupul refăcut.
    if (ckPending && (e.key === 'i' || e.key === 'e' || e.key === 'h')) {
      const aveaVirgula = stergeVirgula();
      if (prevChar() === 'k') {
        e.preventDefault();
        resetCK();
        deletePrevChar();                 // scoatem „k"-ul
        insertSunet('c' + e.key, field);  // punem „c" + litera (ci / ce / ch)
        return;
      }
      if (aveaVirgula) insertText(VIRGULA); // nu era cazul: punem virgula la loc
    }
    resetCK();
    if (e.key === 'c') {         // „c" -> „k" (implicit dur)
      e.preventDefault();
      insertSunet('k', field);
      ckPending = true;
      return;
    }
  }

  // Cifrele 1-4 -> simbolurile configurabile
  if (e.code === 'Digit1') { e.preventDefault(); insertSymbol('1', field); return; }
  if (e.code === 'Digit2') { e.preventDefault(); insertSymbol('2', field); return; }
  if (e.code === 'Digit3') { e.preventDefault(); insertSymbol('3', field); return; }
  if (e.code === 'Digit4') { e.preventDefault(); insertSymbol('4', field); return; }

  // Virgulă -> „, ”   (virgulă + spațiu)
  if (e.key === ',') { e.preventDefault(); insertText(', '); return; }

  // Cratimă -> „ - ”  (spațiu înainte și după).
  // În transcriere, cratima nu se adaugă lângă virgulă, ci ÎN LOCUL ei: acolo
  // unde tocmai se despărțeau două sunete, acum se despart două silabe.
  /* Cratima: la cuvinte desparte silabele, deci stă cu aer în jur și ia locul
     virgulei. La propoziții e semnul unei ortograme („s-a", „într-un"), deci se
     lipește de sunetele dintre care stă. */
  if (e.key === '-') {
    e.preventDefault();
    if (eFrazaTrans(field)) { insertText('-'); return; }
    if (eTranscriere(field)) stergeVirgula();
    insertText(' - ');
    return;
  }

  // Orice alt semn tastat în transcriere e un sunet, deci îl punem noi, cu
  // virgula lui. Trebuie să fie ULTIMA regulă: dacă ar fi mai sus, ar înghiți
  // cifrele 1-4, virgula și cratima, care au treaba lor.
  if (eTranscriere(field) && e.key.length === 1 && !NU_E_SUNET.has(e.key) && e.key !== "'") {
    e.preventDefault();
    insertSunet(e.key, field);
    return;
  }
});

/* rupe ciclul ă/î/â și starea c->k dacă utilizatorul dă click aiurea */
sheet.addEventListener('mousedown', () => { resetACycle(); resetCK(); });

/* ---------- Navigare între câmpuri (Tab) ---------- */
function navigate(current, back) {
  const fields = Array.from(sheet.querySelectorAll('.field'));
  const i = fields.indexOf(current);
  let target = back ? fields[i - 1] : fields[i + 1];
  if (!target && !back) {
    const newRow = addRowAfter(current.closest('.row'));
    target = newRow.querySelector('.field');
  }
  if (target) {
    if (target.classList.contains('types')) focusTypes(target);       // sub primul sunet
    else if (target.classList.contains('trans')) focusTrans(target);  // pune „[  ]"
    else placeCaret(target, true);
  }
}

function placeCaret(el, atStart) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(atStart);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ---------- Creare / adăugare rânduri ----------
   Două șabloane, două feluri de rând: cel obișnuit (cuvânt → silabe →
   transcriere → c/v/s) și cel de propoziție (propoziția, iar sub ea
   transcrierea ei, cu parantezele montate). */
const rowTemplateFraza = document.getElementById('rowTemplateFraza');

function createRow(deFraza) {
  const sablon = deFraza && rowTemplateFraza ? rowTemplateFraza : rowTemplate;
  return sablon.content.firstElementChild.cloneNode(true);
}

/** Rândul ăsta e de propoziție? Îl întrebăm pe el, nu ținem minte pe alături. */
const eRandDeFraza = (row) => !!row && row.classList.contains('row--fraza');

/** Fața asta de zar cere propoziții? */
function fataCereFraza(fata) {
  return !!fata && fataZarului(LECTIE, Number(fata))?.kind === 'propozitie';
}

function renumber() {
  sheet.querySelectorAll('.row').forEach((row, idx) => {
    row.querySelector('.rownum').textContent = (idx + 1) + '.';
  });
}

function addRowAfter(row) {
  // Rândul nou seamănă cu cel de lângă care se naște: într-un exercițiu de
  // propoziții adaugi tot o propoziție, nu un cuvânt.
  const newRow = createRow(eRandDeFraza(row) ||
    (!row && fataCereFraza(exercitiulDeschis()?.fata)));
  if (row && row.nextSibling) sheet.insertBefore(newRow, row.nextSibling);
  else sheet.appendChild(newRow);
  renumber();
  placeCaret(newRow.querySelector('.field'), true);
  scheduleSave();
  return newRow;
}

/* ---------- Toolbar (formatări, inserări, paranteze) ---------- */

/* preventDefault pe mousedown => câmpul editabil NU pierde focus/selecția */
toolbar.addEventListener('mousedown', (e) => {
  if (e.target.closest('button')) e.preventDefault();
});

toolbar.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  // formatări de bază
  if (btn.dataset.cmd) {
    const cmd = btn.dataset.cmd;
    if (cmd === 'superscript') {
      // pe selecție -> regula 7; fără selecție -> comută superscript normal
      if (!superscriptSelection()) document.execCommand('superscript', false, null);
    } else {
      document.execCommand(cmd, false, null);
    }
    return;
  }
  // simbolurile configurabile (tastele 1-4)
  // Butonul face exact ce face tasta, virgulă cu virgulă: altfel simbolul pus
  // cu mausul rămânea fără virgulă, iar rândul c/v/s de dedesubt nu mai avea
  // după ce să se alinieze.
  if (btn.dataset.symkey)      { insertSymbol(btn.dataset.symkey, activeField()); return; }
  // perechi de paranteze
  if (btn.dataset.pair)        { insertPair(btn.dataset.pair); return; }
});

document.getElementById('addRowBtn').addEventListener('click', () => {
  const rows = sheet.querySelectorAll('.row');
  addRowAfter(rows[rows.length - 1]);
});

/* ---------- Buton „+ etapă": adaugă un câmp nou pe rândul curent ---------- */
let lastFocusedField = null;
sheet.addEventListener('focusin', (e) => {
  const f = e.target.closest && e.target.closest('.field');
  if (!f) return;
  lastFocusedField = f;
  // intri într-un câmp c/v/s gol -> du cursorul sub primul sunet (după ce se așază click-ul)
  if (f.classList.contains('types') && (f.textContent || '').trim() === '') {
    setTimeout(() => { if (document.activeElement === f) focusTypes(f); }, 0);
  }
  // intri într-o transcriere goală -> pune „[  ]" cu cursorul între spații
  if (f.classList.contains('trans') && (f.textContent || '').replace(/​/g, '').trim() === '') {
    setTimeout(() => {
      if (document.activeElement === f && (f.textContent || '').replace(/​/g, '').trim() === '') focusTrans(f);
    }, 0);
  }
});

function currentRow() {
  if (lastFocusedField && sheet.contains(lastFocusedField)) return lastFocusedField.closest('.row');
  const rows = sheet.querySelectorAll('.row');
  return rows[rows.length - 1] || null;
}

function addStageToRow(row) {
  if (!row || eRandDeFraza(row)) return null;
  const arrow = document.createElement('span');
  arrow.className = 'arrow';
  arrow.textContent = '→';
  const field = document.createElement('div');
  field.className = 'field extra';
  field.setAttribute('contenteditable', 'true');
  field.setAttribute('data-ph', 'etapă');
  row.appendChild(arrow);
  row.appendChild(field);
  placeCaret(field, true);
  scheduleSave();
  return field;
}

document.getElementById('addStageBtn').addEventListener('click', () => addStageToRow(currentRow()));

/* când se modifică transcrierea, re-aliniem rândul c/v/s (păstrând literele deja puse) */
sheet.addEventListener('input', (e) => {
  const t = e.target;
  if (!t.classList || !t.classList.contains('trans')) return;
  const stage3 = t.closest('.stage3');
  const typesEl = stage3 && stage3.querySelector('.types');
  if (typesEl && (typesEl.textContent || '').trim() !== '') {
    const cols = soundColumns(t);
    const letters = readTypeLetters(typesEl, cols);
    typesEl.textContent = buildTypesText(cols, letters);
  }
});

/* ---------- Panourile din dreapta (Notițe / Simboluri / Tablele mele) ----------
   Se deschid DOAR la click și numai unul odată: se așază toate în același colț,
   iar două deschise s-ar acoperi unul pe altul. */
const notesPanel    = document.getElementById('notesPanel');
const settingsPanel = document.getElementById('settingsPanel');
const panouri = [notesPanel, settingsPanel, document.getElementById('boardsPanel')].filter(Boolean);

function inchidePanou(p) {
  p.classList.remove('open');
  p.setAttribute('aria-hidden', 'true');
}
function togglePanel(panel) {
  const seDeschide = !panel.classList.contains('open');
  panouri.forEach((p) => {
    const on = (p === panel) && seDeschide;
    p.classList.toggle('open', on);
    p.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
}
document.getElementById('notesBtn').addEventListener('click', () => togglePanel(notesPanel));
document.getElementById('notesClose').addEventListener('click', () => inchidePanou(notesPanel));
document.getElementById('settingsBtn').addEventListener('click', () => { inchideMeniu(); togglePanel(settingsPanel); });
document.getElementById('settingsClose').addEventListener('click', () => inchidePanou(settingsPanel));
document.getElementById('boardsClose').addEventListener('click', () => inchidePanou(boardsPanel));
document.getElementById('boardsBtn').addEventListener('click', () => {
  inchideMeniu();
  togglePanel(boardsPanel);
  aratăTablele();
});

/* ---------- Scurtăturile: ascunse până le ceri ----------
   Erau șase rânduri de text mărunt, citite o dată și apoi niciodată, dar care
   luau înălțime din tablă la fiecare deschidere a paginii. */
const elLegend = document.getElementById('legend');
const elScurt  = document.getElementById('scurtBtn');
elScurt.addEventListener('click', () => {
  const seDeschide = elLegend.hidden;
  elLegend.hidden = !seDeschide;
  elScurt.setAttribute('aria-expanded', seDeschide ? 'true' : 'false');
  elScurt.classList.toggle('e-apasat', seDeschide);
});

/* ---------- Meniul „⋯" ---------- */
const elMeniu = document.getElementById('altMeniu');
const elAlt   = document.getElementById('altBtn');
function inchideMeniu() {
  elMeniu.hidden = true;
  elAlt.setAttribute('aria-expanded', 'false');
}
elAlt.addEventListener('click', (e) => {
  e.stopPropagation();
  const seDeschide = elMeniu.hidden;
  elMeniu.hidden = !seDeschide;
  elAlt.setAttribute('aria-expanded', seDeschide ? 'true' : 'false');
});
document.addEventListener('click', (e) => {
  if (!elMeniu.hidden && !e.target.closest('#altMeniu, #altBtn')) inchideMeniu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') inchideMeniu(); });

/* afișează butoanele de simboluri din bară + legenda, după setările curente */
function renderSymbolButtons() {
  document.querySelectorAll('.sym-btn').forEach(btn => {
    const s = symbols[btn.dataset.symkey];
    btn.innerHTML = '';
    const el = s.bold ? document.createElement('b') : document.createElement('span');
    el.textContent = s.char || '?';
    btn.appendChild(el);
    btn.title = (s.char || '') + ' (tasta ' + btn.dataset.symkey + ')';
  });
  const leg = document.getElementById('legendSyms');
  if (leg) {
    leg.innerHTML = '';
    ['1','2','3','4'].forEach((key, i) => {
      const s = symbols[key];
      const el = s.bold ? document.createElement('b') : document.createElement('span');
      el.textContent = s.char || '?';
      leg.appendChild(el);
      if (i < 3) leg.appendChild(document.createTextNode(' '));
    });
  }
}

/* construiește panoul de setări (input pentru simbol + bifă bold, pentru fiecare tastă) */
function renderSettings() {
  const body = document.getElementById('settingsBody');
  body.innerHTML = '';
  ['1','2','3','4'].forEach(key => {
    const row = document.createElement('div');
    row.className = 'set-row';

    const keyLbl = document.createElement('span');
    keyLbl.className = 'set-key';
    keyLbl.textContent = 'Tasta ' + key;

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'set-char';
    inp.value = symbols[key].char;
    inp.addEventListener('input', () => { symbols[key].char = inp.value; saveSymbols(); renderSymbolButtons(); });

    const boldLbl = document.createElement('label');
    boldLbl.className = 'set-bold';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!symbols[key].bold;
    chk.addEventListener('change', () => { symbols[key].bold = chk.checked; saveSymbols(); renderSymbolButtons(); });
    boldLbl.appendChild(chk);
    boldLbl.appendChild(document.createTextNode(' bold'));

    row.append(keyLbl, inp, boldLbl);
    body.appendChild(row);
  });
}

renderSymbolButtons();
renderSettings();

/* ---------- Curățăm zero-width space rămas la ieșirea din câmp ---------- */
sheet.addEventListener('blur', (e) => {
  const field = e.target.closest && e.target.closest('.field');
  if (!field) return;
  const bare = field.textContent.replace(/​/g, '');
  // Parantezele frazei rămân montate chiar și goale: ele arată unde se scrie.
  if (bare.trim() === '' && !eFrazaTrans(field)) { field.innerHTML = ''; return; }
  // transcriere cu doar „[  ]" (neatinsă) -> o golim, ca să reapară placeholder-ul
  if (field.classList.contains('trans') && !eFrazaTrans(field) &&
      /^\[\s*\]$/.test(bare.trim())) { field.innerHTML = ''; return; }
  // Virgula de la coadă și-a făcut treaba cât ai scris; acum ar rămâne
  // atârnată după ultimul sunet, așa că o strângem.
  if (field.classList.contains('trans')) {
    if (cuVirgule(field)) taieVirgulaFinala(field);   // fraza n-are virgulă de coadă
    imbracaSimboluri(field);
  }
  if (field.classList.contains('types')) {                    // c/v/s -> curăț spațiile de la coadă
    const trimmed = bare.replace(/\s+$/, '');
    if (trimmed !== field.textContent) field.textContent = trimmed;
  }
}, true);

/* ================= LIPIREA ȘI TRASUL CU MOUSE-UL =================

   Un câmp de lucru e o singură linie de text, nu o pagină. Lipit de-a dreptul,
   un text copiat din Word aduce cu el tot ce-l îmbracă acolo: tabele, <div>-uri,
   fonturi, culori. De-acolo încolo rândul c/v/s nu mai poate număra coloane,
   fiindcă textul nu mai e o linie, ci un teanc de blocuri.

   Așa că lipim NUMAI textul curat, pe o singură linie, și trecem transcrierea
   prin îmbrăcarea simbolurilor: dacă ai lipit un „ĉ", el capătă cutia lui, ca
   și cum l-ai fi tastat.

   Trasul cu mouse-ul îl oprim de tot. Browserul îl lasă să cadă oriunde,
   inclusiv în mijlocul unei cutii, și n-avem cum ști dinainte unde. Un drum pe
   care nu-l putem păzi e mai bine închis decât lăsat să strice pe tăcute.
   ================================================================= */
sheet.addEventListener('paste', (e) => {
  const field = e.target.closest && e.target.closest('.field');
  if (!field) return;
  e.preventDefault();
  scoateCursorulDinCutie();          // aceeași pază ca la tastatură
  const bruta = (e.clipboardData || window.clipboardData || { getData: () => '' })
    .getData('text/plain') || '';
  const curat = bruta.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!curat) return;
  insertText(curat);
  if (field.classList.contains('trans')) {
    // Îmbrăcarea reface nodurile, deci cursorul se pierde: îl punem la coadă,
    // adică exact unde te aștepți să scrii mai departe după o lipire.
    imbracaSimboluri(field);
    caretLaCoada(field);
  }
  murdareste(); scheduleSave();
});

sheet.addEventListener('drop', (e) => {
  if (e.target.closest && e.target.closest('.field')) e.preventDefault();
});

/* Cursorul la capătul câmpului, ÎNTR-UN NOD DE TEXT.
   `selectNodeContents` plus `collapse(false)` ar lăsa cursorul „între noduri",
   iar lângă o cutie browserul rezolvă poziția aia cel mai des înăuntrul ei. */
function caretLaCoada(camp) {
  camp.focus();
  let ultim = camp.lastChild;
  if (!ultim || ultim.nodeType !== Node.TEXT_NODE) {
    ultim = document.createTextNode('');
    camp.appendChild(ultim);
  }
  const r = document.createRange();
  r.setStart(ultim, ultim.length);
  r.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}

/* ================= Salvare / încărcare / ștergere ================= */

/* adună tot ce a scris userul (cerință, notițe, simboluri, rânduri) */
/* ============================================================
   EXERCIȚIILE UNEI TABLE

   O tablă ține mai multe exerciții. Fiecare are cerința lui și rândurile lui.

   HOTĂRÂREA CARE ȚINE TOT: în pagină stau DOAR rândurile exercițiului deschis.
   Așa tot codul de dinainte („rândurile din `sheet`") rămâne adevărat cuvânt cu
   cuvânt: adăugarea de rânduri, numerotarea, mersul cu Tab, culesul la salvare.
   Schimbarea exercițiului nu e altceva decât „pune deoparte rândurile astea,
   scoate-le pe celelalte".
   ============================================================ */
/* Cele șase cerințe, una pe față. Textul lor e al profesorului, nu al meu:
   se schimbă aici, într-un singur loc, și se schimbă peste tot. */
const CERINTE = {
  1: 'Precizează numărul de litere și de sunete din cuvintele date:',
  2: 'Extrage grupurile de sunete din cuvintele date:',
  3: 'Desparte în silabe cuvintele date:',
  4: 'Stabilește valoarea fonetică a lui [i] în cuvintele date:',
  5: 'Oferă cuvinte pentru structurile fonetice date:',
  6: 'Transcrie fonetic propozițiile de mai jos:',
};

/* CERINȚA UNUI FEL NU SE ȚINE MINTE PE EXERCIȚIU.
   O vreme am scris-o în fiecare exercițiu, la facere. Mergea, dar mințea:
   dacă schimbam textul de mai sus, tablele scrise ieri rămâneau cu cel vechi,
   deși „un singur loc" era chiar ce promitea comentariul. Acum exercițiul ține
   minte NUMĂRUL felului, iar textul se citește de fiecare dată de aici. Cine
   și-a scris singur cerința o ține pe a lui, cum se cuvine. */

/** Textul cerinței, fără cuvinte: al felului, ori al lui. */
function bazaCerintei(ex) {
  if (!ex) return '';
  if (ex.sursa !== 'mana' && ex.fata && CERINTE[ex.fata]) return CERINTE[ex.fata];
  return ex.cerinta || '';
}

/** Ce față are un text care seamănă cu unul dintre cele șase șabloane.
    Semnul de la coadă nu contează: tablele vechi se sfârșeau cu punct. */
function fataDupaText(text) {
  const curat = (t) => String(t || '').trim().replace(/[.:;]+$/, '').toLowerCase();
  const c = curat(text);
  if (!c) return null;
  for (const f of [1, 2, 3, 4, 5, 6]) if (curat(CERINTE[f]) === c) return f;
  return null;
}

let exercitii = [];
let deschis = 0;

const elTeanc = document.getElementById('teanc');

/* CERINȚA ȘI CUVINTELE STAU DESPĂRȚITE ÎN MEMORIE, LIPITE PE ECRAN.
   Pe tablă se citesc ca un singur rând: „Desparte în silabe cuvintele date:
   iarnă, piatră". În date, însă, sunt două lucruri deosebite: cerința e a
   profesorului, cuvintele le aduce generatorul și le poate schimba de zece ori.
   Lipite într-un singur șir, a doua generare n-ar mai ști unde se sfârșește
   cerința și ar scrie cuvinte peste cuvinte.

   DE UNDE VINE CERINȚA hotărăște și dacă se poate scrie în ea:
     'zar'  = ți-a picat, n-ai ce schimba;
     'tip'  = ai ales unul dintre cele șase feluri, deci textul e cel al felului;
     'mana' = ai scris-o tu, și rămâne a ta. */
function exercitiuNou({ cerinta = '', sursa = 'mana', fata = null, tema = false } = {}) {
  return { id: 'e' + Date.now() + Math.random().toString(36).slice(2, 6),
           cerinta, sursa, fata, tema, cuvinte: [], randuri: [] };
}

/** Cerința așa cum se citește pe tablă: textul, apoi cuvintele, în continuare. */
function textulCerintei(ex) {
  if (!ex) return '';
  const c = bazaCerintei(ex);
  const cuv = (ex.cuvinte || []).join(', ');
  if (!cuv) return c;
  return c ? c + ' ' + cuv : cuv;
}

/** Se poate scrie în cerința asta? Numai cele scrise de mână. */
const eDeScris = (ex) => !!ex && ex.sursa === 'mana';
const exercitiulDeschis = () => exercitii[deschis] || null;

/** Rândurile din pagină, în formă de date. */
function culegeRanduri() {
  return Array.from(sheet.querySelectorAll('.row')).map((row) => {
    if (eRandDeFraza(row)) {
      const fr = row.querySelector('.fraza');
      return {
        fraza: fr ? fr.innerHTML : '',
        trans: (row.querySelector('.trans') || {}).innerHTML || '',
        blocata: !!fr && fr.getAttribute('contenteditable') === 'false',
      };
    }
    return {
      word:  (row.querySelector('.word')  || {}).innerHTML || '',
      syll:  (row.querySelector('.syll')  || {}).innerHTML || '',
      trans: (row.querySelector('.trans') || {}).innerHTML || '',
      types: (row.querySelector('.types') || {}).textContent || '',
      extra: Array.from(row.querySelectorAll('.field.extra')).map((e) => e.innerHTML),
    };
  });
}

/** Datele înapoi în pagină. Un rând gol dacă exercițiul n-are niciunul: o
 *  tablă fără nicio căsuță de scris n-ar spune elevului ce să facă. */
function aseazaRanduri(randuri, deFraza) {
  sheet.innerHTML = '';
  const lista = (randuri && randuri.length) ? randuri : [null];
  // Un exercițiu gol de propoziții tot un rând de propoziție primește: felul îl
  // spune exercițiul, nu rândurile care încă nu există.
  const frazaImplicit = deFraza !== undefined ? deFraza
    : fataCereFraza(exercitiulDeschis()?.fata);
  lista.forEach((r) => {
    const eFraza = r ? r.fraza !== undefined : frazaImplicit;
    const row = createRow(eFraza);
    sheet.appendChild(row);
    if (!r) return;
    if (eFraza) {
      const fr = row.querySelector('.fraza');
      fr.innerHTML = r.fraza || '';
      // Propoziția venită de la generator nu se schimbă: e materialul, nu lucrul
      // elevului. Cea adăugată de mână se scrie.
      if (r.blocata) fr.setAttribute('contenteditable', 'false');
      const tr = row.querySelector('.trans');
      if (r.trans) tr.innerHTML = r.trans;
      imbracaSimboluri(tr);
      return;
    }
    row.querySelector('.word').innerHTML  = r.word  || '';
    row.querySelector('.syll').innerHTML  = r.syll  || '';
    row.querySelector('.trans').innerHTML = r.trans || '';
    imbracaSimboluri(row.querySelector('.trans'));   // tablele vechi: simbolurile intră în cutie
    row.querySelector('.types').textContent = r.types || '';
    (r.extra || []).forEach(html => {
      const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.textContent = '→';
      const f = document.createElement('div');
      f.className = 'field extra'; f.setAttribute('contenteditable', 'true'); f.setAttribute('data-ph', 'etapă');
      f.innerHTML = html;
      row.appendChild(arrow); row.appendChild(f);
    });
  });
  renumber();
}

/** Pune deoparte ce e pe ecran, în exercițiul de care ține. */
function salveazaDeschisul() {
  const ex = exercitiulDeschis();
  if (ex) ex.randuri = culegeRanduri();
}

/** Deschide alt exercițiu. */
function deschideExercitiul(i) {
  if (i === deschis || !exercitii[i]) return;
  salveazaDeschisul();
  deschis = i;
  aseazaRanduri(exercitii[deschis].randuri);
  deseneazaTeancul();
}

/* Teancul: cel deschis întreg, celelalte strânse pe un rând.
   Redesenăm tot, dar NU cât timp scrii: căsuța de text a cerinței deschise
   și-ar pierde cursorul la fiecare tastă. De-aia scrisul doar ține minte. */
function deseneazaTeancul() {
  if (!elTeanc) return;
  elTeanc.innerHTML = exercitii.map((ex, i) => {
    const nr = '<span class="cer__nr">' + (i + 1) + '</span>';
    const semne =
      (ex.sursa === 'zar' ? '<span class="cer__semn">zar ' + ex.fata + '</span>' : '') +
      (ex.tema ? '<span class="cer__semn cer__tema">temă</span>' : '');
    if (i !== deschis) {
      return '<div class="cer e-stransa" data-ex="' + i + '" role="button" tabindex="0">' +
        nr + '<span class="cer__text">' + (escapaText(textulCerintei(ex)) || 'fără cerință') + '</span>' +
        semne + '</div>';
    }
    /* Cea de la zar nu se scrie: e ce ți-a picat, nu ce vrei tu. Nici cea a unui
       fel ales din listă: textul ei e al felului, unul singur pentru toată
       tabla, și se schimbă în cod, nu ici-colo pe câte o tablă. */
    const corp = eDeScris(ex)
      ? '<textarea data-cerinta="' + i + '" placeholder="Scrie aici cerința exercițiului…">' +
        escapaText(ex.cerinta) + '</textarea>' +
        (ex.cuvinte && ex.cuvinte.length
          ? '<div class="cer__cuvinte">' + escapaText(ex.cuvinte.join(', ')) + '</div>' : '')
      : '<div class="cer__data">' + escapaText(textulCerintei(ex)) + '</div>';
    return '<div class="cer e-deschisa" data-ex="' + i + '">' +
      '<span class="cer__eticheta">Cerință</span>' + nr +
      '<div class="cer__text">' + corp + '</div>' + semne +
      '<button class="cer__x" data-sterge="' + i + '" title="Șterge exercițiul" aria-label="Șterge exercițiul"></button>' +
      '</div>';
  }).join('');
}

function escapaText(t) {
  return String(t == null ? '' : t)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

elTeanc && elTeanc.addEventListener('click', async (e) => {
  const x = e.target.closest('[data-sterge]');
  if (x) {
    const i = Number(x.dataset.sterge);
    if (exercitii.length === 1) {
      if (!await intreaba({ titlu: 'Ștergi exercițiul?',
        text: 'E singurul de pe tablă. Rămâne o cerință goală și un rând gol.',
        buton: 'Șterge' })) return;
      exercitii = [exercitiuNou()];
      deschis = 0;
    } else {
      if (!await intreaba({ titlu: 'Ștergi exercițiul?',
        text: 'Se duc și rândurile lui. Celelalte exerciții rămân.',
        buton: 'Șterge' })) return;
      exercitii.splice(i, 1);
      deschis = Math.min(deschis > i ? deschis - 1 : deschis, exercitii.length - 1);
    }
    aseazaRanduri(exercitii[deschis].randuri);
    deseneazaTeancul();
    murdareste(); scheduleSave();
    return;
  }
  const c = e.target.closest('.cer.e-stransa');
  if (c) deschideExercitiul(Number(c.dataset.ex));
});

elTeanc && elTeanc.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const c = e.target.closest('.cer.e-stransa');
  if (!c) return;
  e.preventDefault();
  deschideExercitiul(Number(c.dataset.ex));
});

/* Scrisul în cerință NU redesenează teancul: cursorul ar sări din căsuță la
   fiecare literă. Ținem minte, atât; teancul se reface când se schimbă ceva
   care chiar îl privește. */
elTeanc && elTeanc.addEventListener('input', (e) => {
  const t = e.target.closest('[data-cerinta]');
  if (!t) return;
  const ex = exercitii[Number(t.dataset.cerinta)];
  if (ex) ex.cerinta = t.value;
  murdareste(); scheduleSave();
});

/** Adaugă un exercițiu și îl deschide. */
function adaugaExercitiu(cfg) {
  salveazaDeschisul();
  exercitii.push(exercitiuNou(cfg));
  deschis = exercitii.length - 1;
  aseazaRanduri([]);
  deseneazaTeancul();
  murdareste(); scheduleSave();
  return exercitii[deschis];
}

/* „+ cerință" întreabă întâi CE FEL de exercițiu se face, fiindcă felul e al
   exercițiului, nu al generatorului: dacă îl știm de la început, generatorul nu
   mai are ce întreba, iar cerința vine scrisă și numai de îndreptat. Cine vrea
   să scrie de la zero alege „scriu eu cerința", și atunci exercițiul rămâne
   fără fel până când generatorul chiar are nevoie de el. */
const elCerintaNoua = document.getElementById('cerintaNoua');
elCerintaNoua && elCerintaNoua.addEventListener('click', () => {
  ceFel(true, (fata) => {
    adaugaExercitiu(fata ? { sursa: 'tip', fata } : {});
    const t = elTeanc.querySelector('.cer.e-deschisa textarea');
    if (t) t.focus();
  });
});

function collectState() {
  salveazaDeschisul();
  return {
    notes:  document.getElementById('notesArea').value,
    symbols: symbols,
    exercitii: exercitii,
    deschis: deschis,
  };
}

/* reconstruiește tabla din starea salvată */
function applyState(state) {
  if (!state) return;
  if (state.notes != null) document.getElementById('notesArea').value = state.notes;
  if (state.symbols && state.symbols['1']) { symbols = state.symbols; saveSymbols(); renderSymbolButtons(); renderSettings(); }

  exercitii = deslusesteExercitiile(state);
  deschis = Math.min(Math.max(0, state.deschis | 0), exercitii.length - 1);
  aseazaRanduri(exercitii[deschis].randuri);
  deseneazaTeancul();
}

/** Exercițiile unei table, oricât de veche ar fi ea.
 *
 *  Tablele scrise înainte de teanc au o singură cerință (`prompt`) și rândurile
 *  ei (`rows`). Se deschid ca tablă cu un singur exercițiu, cu cerința aceea:
 *  nu se pierde nimic și nu i se cere nimănui să mute ceva cu mâna. */
function deslusesteExercitiile(state) {
  if (Array.isArray(state.exercitii) && state.exercitii.length) {
    return state.exercitii.map((e) => {
      /* Tablele scrise înainte țineau cuvintele lipite de cerință, despărțite cu
         un rând nou. Le despărțim la citire, o dată, ca de-acolo încolo să fie
         două lucruri, ca la toate celelalte. */
      const bucati = String(e.cerinta || '').split('\n');
      const cuvinte = Array.isArray(e.cuvinte) ? e.cuvinte
        : bucati.slice(1).join(' ').split(',').map((x) => x.trim()).filter(Boolean);
      /* Un text care seamănă cu unul dintre cele șase șabloane E textul acelui
         fel, chiar dacă tabla e scrisă acum o lună și se sfârșea cu punct. Așa
         se îndreaptă singure și cerințele vechi, fără să umble nimeni prin ele. */
      const dupaSablon = fataDupaText(bucati[0]);
      const sursa = e.sursa === 'zar' ? 'zar'
                  : (dupaSablon || e.sursa === 'tip') ? 'tip' : 'mana';
      return {
        id: e.id || ('e' + Math.random().toString(36).slice(2, 8)),
        cerinta: bucati[0] || '',
        sursa,
        fata: e.fata || dupaSablon || null,
        tema: !!e.tema,
        cuvinte,
        randuri: Array.isArray(e.randuri) ? e.randuri : [],
      };
    });
  }
  const vechi = exercitiuNou({ cerinta: state.prompt || '' });
  vechi.randuri = Array.isArray(state.rows) ? state.rows : [];
  return [vechi];
}

/* ================= SALVAREA =================
   Două straturi, cu roluri diferite, ca să nu se încurce:

   1. CONTUL, la cerere. Butonul „Salvează" scrie tabla în `learn_lessons_boards`
      (migrarea 0074). Se salvează doar când ceri tu, fiindcă o temă se predă,
      nu se scurge. Poți ține mai multe table la aceeași lecție.

   2. BROWSERUL, tăcut. Tot ce scrii se pune și în localStorage, ca să nu
      pierzi nimic dacă se închide fila din greșeală. Plasa asta nu se laudă
      nicăieri și nu înseamnă „salvat": e doar ce aveai în mână.
   ============================================ */
import { listSheets, loadSheet, saveSheet, renameSheet, deleteSheet } from '../../shared/scripts/board-repo.js';

const LECTIE = 'fonetica-introducere';

/* Tabla deschisă acum: `id` null = n-a fost încă salvată în cont. */
let tabla = { id: null, titlu: 'Tablă nouă', curat: true };

const elSaveBtn   = document.getElementById('saveBtn');
const elSaveLabel = document.getElementById('saveLabel');
const elStare     = document.getElementById('saveState');
const elNume      = document.getElementById('boardName');
const elNumeText  = document.getElementById('boardNameText');

/* Arată dacă mai e ceva nesalvat. Pastila apare DOAR când chiar e ceva de
   salvat: un semn care stă mereu aprins nu mai spune nimic. */
function aratăStarea() {
  if (elStare) {
    elStare.hidden = tabla.curat;
    elStare.textContent = 'nesalvat';
    elStare.classList.remove('e-rau');
  }
  if (elNumeText) elNumeText.textContent = tabla.id ? tabla.titlu : 'Tablă nouă';
  if (elNume) {
    elNume.classList.toggle('e-nesalvata', !tabla.id);
    elNume.title = tabla.id ? 'Schimbă numele tablei' : 'Salvează tabla ca să-i dai un nume';
  }
  if (elSaveLabel) elSaveLabel.textContent = tabla.id ? 'Salvează' : 'Salvează în cont';
  if (elSaveBtn) elSaveBtn.classList.toggle('e-curat', tabla.curat);
}

function murdareste() {
  if (!tabla.curat) return;
  tabla.curat = false;
  aratăStarea();
}

/* ---------- plasa din browser (tăcută) ---------- */
var saveTimer = null;
function scheduleSave() {
  try { clearTimeout(saveTimer); } catch (e) {}
  saveTimer = setTimeout(saveStateLocal, 400);
}
function saveStateLocal() {
  try { localStorage.setItem('fonetica_state', JSON.stringify(collectState())); } catch (e) {}
}
function loadStateLocal() {
  try { const raw = localStorage.getItem('fonetica_state'); if (raw) return JSON.parse(raw); } catch (e) {}
  return null;
}

/* orice tastare -> plasa din browser + semnul „nesalvat" */
document.addEventListener('input', () => { scheduleSave(); murdareste(); });

/* ---------- salvarea în cont ---------- */

/* Un nume de pornire care spune ceva: data de azi. „Tablă nouă (3)" nu ajută
   pe nimeni să-și găsească tema de acum două săptămâni. */
/* Dacă numele propus e deja luat, îi punem un număr. Altfel elevul ar primi
   din start un nume respins, ceea ce e o primire proastă. */
function numeLiber(baza, luate) {
  const ocupate = new Set(luate.map((t) => t.title.trim().toLowerCase()));
  if (!ocupate.has(baza.trim().toLowerCase())) return baza;
  for (let i = 2; i < 99; i++) {
    const incercare = `${baza} (${i})`;
    if (!ocupate.has(incercare.toLowerCase())) return incercare;
  }
  return baza;
}

function numeImplicit() {
  const d = new Date();
  const luni = ['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','noi','dec'];
  return `${d.getDate()} ${luni[d.getMonth()]} ${d.getFullYear()}`;
}

function spune(text, reușită = true) {
  if (!elStare) return;
  elStare.hidden = false;
  elStare.textContent = text;
  elStare.classList.toggle('e-bine', reușită);
  elStare.classList.toggle('e-rau', !reușită);
  clearTimeout(spune._t);
  spune._t = setTimeout(() => { elStare.classList.remove('e-bine'); aratăStarea(); }, 1800);
}

async function salveaza(caTablaNoua = false) {
  let titlu = tabla.id && !caTablaNoua ? tabla.titlu : null;
  if (!titlu) {
    const luate = await listSheets(LECTIE);
    titlu = await intreaba({
      titlu: caTablaNoua ? 'Salvează ca tablă nouă' : 'Salvează tabla',
      camp: numeLiber(numeImplicit(), luate),
      verifica: verificatorulNumelui(luate),
    });
  }
  if (!titlu) return;                       // a apăsat „Renunță"

  elSaveBtn && elSaveBtn.classList.add('e-ocupat');
  const { row, motiv } = await saveSheet({
    id: caTablaNoua ? null : tabla.id,
    lessonSlug: LECTIE,
    title: titlu,
    data: collectState(),
  });
  elSaveBtn && elSaveBtn.classList.remove('e-ocupat');

  if (!row) { spune(motiv || 'nu s-a putut salva', false); return; }
  tabla = { id: row.id, titlu: row.title, curat: true };
  aratăStarea();
  spune('salvat', true);
}

elSaveBtn && elSaveBtn.addEventListener('click', () => salveaza(false));
document.getElementById('saveAsBtn').addEventListener('click', () => {
  inchideMeniu();
  salveaza(true);
});

document.getElementById('renameBtn').addEventListener('click', () => {
  inchideMeniu();
  redenumeste();
});
async function redenumeste() {
  if (!tabla.id) { spune('salvează întâi tabla', false); return; }
  const luate = await listSheets(LECTIE);
  const nou = await intreaba({
    titlu: 'Redenumește tabla',
    camp: tabla.titlu,
    buton: 'Schimbă',
    verifica: verificatorulNumelui(luate, tabla.id),
  });
  if (!nou || nou === tabla.titlu) return;
  if (await renameSheet(tabla.id, nou)) {
    tabla.titlu = nou;
    spune('redenumit', true);
    aratăTablele();
  } else {
    spune('mai ai o tablă cu numele ăsta', false);
  }
}

/* Numele din capul paginii: apăsat, deschide aceeași fereastră de redenumit
   ca din meniu. Dacă tabla n-a fost încă salvată, n-are ce redenumi, așa că
   apăsarea o salvează, iar numele îl dai atunci. Tot un drum, tot acolo. */
elNume && elNume.addEventListener('click', () => {
  if (tabla.id) redenumeste();
  else salveaza(false);
});

/* Ctrl+S: salvează în cont, nu deschide dialogul browserului. */
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    salveaza(false);
  }
});

/* Dacă pleci cu tabla nesalvată, browserul întreabă. Nu putem scrie noi
   mesajul (browserele îl aleg singure), dar întrebarea e ce contează. */
window.addEventListener('beforeunload', (e) => {
  if (tabla.curat) return;
  e.preventDefault();
  e.returnValue = '';
});

/* ================= Fereastra de întrebat =================
   Un <dialog> al nostru, nu `prompt`/`confirm` din browser.

   DE CE: ferestrele browserului pot fi oprite, fie de utilizator (bifa „nu mai
   lăsa pagina să deschidă ferestre", care rămâne pusă până la reîncărcare),
   fie de browser în anumite situații. Când sunt oprite, `prompt` se întoarce
   gol pe loc, fără niciun semn, iar codul crede că omul a apăsat „Renunță".
   Rezultatul: apeși „Salvează", nu se întâmplă nimic și nici măcar nu afli de
   ce. Fereastra noastră nu poate fi oprită de nimeni.
   ========================================================= */
const dlg      = document.getElementById('dlg');
const dlgTitlu = document.getElementById('dlgTitlu');
const dlgText  = document.getElementById('dlgText');
const dlgCamp  = document.getElementById('dlgCamp');
const dlgDa    = document.getElementById('dlgDa');
const dlgEroare = document.getElementById('dlgEroare');

/* Deschide fereastra și așteaptă răspunsul. Cu `camp: true` întoarce textul
   scris (sau null la renunțare); fără el, întoarce true/false. */
function intreaba({ titlu, text = '', camp = null, buton = 'Salvează', verifica = null }) {
  dlgTitlu.textContent = titlu;
  dlgText.textContent = text;
  dlgText.hidden = !text;
  dlgDa.textContent = buton;
  dlgCamp.hidden = camp === null;
  dlgCamp.value = camp || '';
  dlgEroare.hidden = true;

  const forma = dlg.querySelector('form');

  return new Promise((raspunde) => {
    // Numele greșit nu închide fereastra. Dacă am închide-o și am arăta
    // greșeala altundeva, elevul ar trebui s-o deschidă iar și să scrie tot de
    // la capăt; așa repară pe loc, cu numele lui încă în câmp.
    const laTrimitere = (e) => {
      if (!verifica || dlg.returnValue !== 'da') return;
      const greseala = verifica(dlgCamp.value.trim());
      if (!greseala) return;
      e.preventDefault();
      dlgEroare.textContent = greseala;
      dlgEroare.hidden = false;
      dlgCamp.focus();
      dlgCamp.select();
    };
    // `returnValue` se pune înainte de `submit`, la apăsarea butonului.
    const laApasare = (e) => { dlg.returnValue = e.target.value || 'nu'; };

    const gata = () => {
      dlg.removeEventListener('close', gata);
      forma.removeEventListener('submit', laTrimitere);
      dlgDa.removeEventListener('click', laApasare);
      document.getElementById('dlgNu').removeEventListener('click', laApasare);
      const da = dlg.returnValue === 'da';
      if (camp === null) { raspunde(da); return; }
      raspunde(da ? dlgCamp.value.trim() : null);
    };

    dlgDa.addEventListener('click', laApasare);
    document.getElementById('dlgNu').addEventListener('click', laApasare);
    forma.addEventListener('submit', laTrimitere);
    dlg.addEventListener('close', gata);
    dlg.returnValue = 'nu';       // Esc și clicul în afară = renunțare
    dlg.showModal();
    if (camp !== null) { dlgCamp.focus(); dlgCamp.select(); }
  });
}

/* Verifică numele unei table înainte de salvare: nu poate fi gol și nu poate
   fi al alteia. Comparăm fără majuscule și fără spațiile de la capete, la fel
   ca indexul unic din baza de date (migrarea 0075), ca răspunsul de pe ecran
   să fie același cu cel al bazei. */
function verificatorulNumelui(luate, afaraDe = null) {
  const cheie = (t) => t.trim().toLowerCase();
  const ocupate = new Set(luate.filter((t) => t.id !== afaraDe).map((t) => cheie(t.title)));
  return (nume) => {
    if (!nume) return 'Pune-i un nume.';
    if (ocupate.has(cheie(nume))) return 'Mai ai o tablă cu numele ăsta. Alege altul.';
    return null;
  };
}

/* Clic pe fundal = renunțare, ca la orice fereastră modernă. */
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close('nu'); });

/* ---------- panoul „Tablele mele" ---------- */
const boardsPanel = document.getElementById('boardsPanel');
const boardsBody  = document.getElementById('boardsBody');

function candSalvat(iso) {
  const d = new Date(iso), azi = new Date();
  const ceas = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === azi.toDateString()) return 'azi, ' + ceas;
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }) + ', ' + ceas;
}

async function aratăTablele() {
  boardsBody.innerHTML = '<p class="boards-empty">Se încarcă…</p>';
  const lista = await listSheets(LECTIE);
  if (!lista.length) {
    boardsBody.innerHTML = '<p class="boards-empty">N-ai încă nicio tablă salvată la lecția asta. Scrie ceva, apoi apasă „Salvează".</p>';
    return;
  }
  /* Rândul ÎNTREG e butonul de deschis, nu doar numele. Înainte, numele era
     un buton cât textul lui, iar data de alături și marginile rândului nu
     făceau nimic: apăsai puțin pe lângă și părea că unealta nu răspunde. */
  boardsBody.innerHTML = lista.map((f) => `
    <div class="board${f.id === tabla.id ? ' e-deschisa' : ''}" data-id="${f.id}"
         role="button" tabindex="0" title="Deschide „${f.title}"">
      <span class="board__name">${f.title}</span>
      <span class="board__when">${candSalvat(f.updated_at)}</span>
      <button class="board__del" data-act="sterge" title="Șterge tabla" aria-label="Șterge „${f.title}"">×</button>
    </div>`).join('');
}

/* Enter și Space pe rândul selectat cu tastatura fac cât un clic. */
boardsBody.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const rand = e.target.closest('.board');
  if (!rand) return;
  e.preventDefault();
  rand.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

boardsBody.addEventListener('click', async (e) => {
  const rand = e.target.closest('.board');
  if (!rand) return;
  const id = rand.dataset.id;
  const b = e.target.closest('[data-act]');

  if (b && b.dataset.act === 'sterge') {
    if (!await intreaba({ titlu: 'Ștergi tabla?', text: 'Nu se mai poate aduce înapoi.', buton: 'Șterge' })) return;
    if (await deleteSheet(id)) {
      if (tabla.id === id) tabla = { id: null, titlu: 'Tablă nouă', curat: tabla.curat };
      aratăStarea();
      aratăTablele();
    }
    return;
  }

  if (id === tabla.id) { inchidePanou(boardsPanel); return; }   // e deja deschisă

  if (!tabla.curat && !await intreaba({
        titlu: 'Tabla de acum n-a fost salvată',
        text: 'O lași așa și o deschizi pe cealaltă?',
        buton: 'Deschide',
      })) return;
  const f = await loadSheet(id);
  if (!f) { spune('tabla nu s-a putut deschide', false); return; }
  applyState(f.data);
  tabla = { id: f.id, titlu: f.title, curat: true };
  aratăStarea();
  aratăTablele();
  inchidePanou(boardsPanel);
});

/* PDF: deschide dialogul de printare (de acolo alegi „Salvează ca PDF") */
document.getElementById('pdfBtn').addEventListener('click', () => { inchideMeniu(); window.print(); });

/* Șterge tot: cerința + toate rândurile (notițele și simbolurile rămân) */
document.getElementById('clearBtn').addEventListener('click', async () => {
  if (!await intreaba({
        titlu: 'Ștergi tot?',
        text: 'Se duc toate exercițiile, cu cerințele și rândurile lor. Notițele și simbolurile rămân.',
        buton: 'Șterge tot',
      })) return;
  exercitii = [exercitiuNou()];
  deschis = 0;
  aseazaRanduri([]);
  deseneazaTeancul();
  scheduleSave();
  murdareste();
});

/* ---------- Pornire: restaurează lucrul salvat, sau o tablă goală ----------
   Recunoaștem și forma veche (o singură cerință cu rândurile ei) și pe cea nouă
   (mai multe exerciții): `applyState` le deslușește pe amândouă. */
const savedState = loadStateLocal();
const areCeva = savedState && ((savedState.rows && savedState.rows.length) ||
                              (savedState.exercitii && savedState.exercitii.length));
if (areCeva) {
  applyState(savedState);
} else {
  exercitii = [exercitiuNou()];
  deschis = 0;
  aseazaRanduri([]);
  deseneazaTeancul();
}
aratăStarea();
const firstField = sheet.querySelector('.field');
if (firstField) placeCaret(firstField, true);

/* ============================================================
   ZARUL, GENERATORUL ȘI BANCA

   Trei lucruri legate între ele: zarul spune CE fel de exercițiu, banca ține
   materialul, generatorul le pune la un loc și umple tabla.
   ============================================================ */
import { aruncare, pas, stat, fataUrmatoare, asezare, INTOARCERI } from './zar-fizica.js';
import { listItems } from '../../shared/scripts/bank-repo.js';
import { fataZarului, felulMaterialului, seCuvineEticheta, deCeCereEticheta }
  from '../../shared/scripts/board-material.js';

/* ---------- Zarul ---------- */
const elTavita  = document.getElementById('zarTavita');
const elZar     = document.getElementById('zar');
const elUmbra   = document.getElementById('zarUmbra');
const elVestire = document.getElementById('zarVestire');

let ultimaFata = null;      // ca să nu iasă de două ori la rând aceeași
let seRostogoleste = false;

/** Cine a cerut mai puțină mișcare primește numărul, nu rostogolirea. */
const faraMiscare = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ÎNCLINAREA DE REPAUS.

   Fizica hotărăște CE FAȚĂ a picat, și o întoarce exact spre tine. Numai că un
   cub privit drept în față nu se mai vede că e cub: rămâne un pătrat cu puncte,
   plat ca un buton. De-aia îl privim puțin de sus și din dreapta.

   Înclinarea se pune ÎNAINTEA rotirii feței, nu după: așa ea se socotește față
   de ecran, nu față de zar, iar unghiul din care privim rămâne același pentru
   toate cele șase fețe. Pusă după, fiecare față ar fi ieșit întoarsă altfel.

   Fizica nu se atinge deloc: ea spune ce s-a întâmplat, asta spune doar de unde
   ne uităm. */
const INCLINARE = { rx: -18, ry: 26 };

function asazaZarul(x, y, h, rx, ry) {
  if (!elZar) return;
  elZar.style.transform =
    `translate3d(${x}px, ${y}px, ${h}px)` +
    ` rotateX(${INCLINARE.rx}deg) rotateY(${INCLINARE.ry}deg)` +
    ` rotateX(${rx}deg) rotateY(${ry}deg)`;
  if (elUmbra) {
    // Umbra rămâne pe fundul tăviței și se strânge cu cât zarul e mai sus:
    // așa se citește înălțimea săriturii, care altfel nu s-ar vedea deloc.
    const s = Math.max(0.45, 1 - h / 90);
    elUmbra.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    elUmbra.style.opacity = String(Math.max(0.08, 0.3 - h / 260));
  }
}

function vesteste(fata) {
  if (!elVestire) return;
  elVestire.hidden = false;
  elVestire.innerHTML = '<b>Ți-a picat ' + fata + '</b>' + escapaText(CERINTE[fata]);
  // Un cadru de așteptare, ca trecerea să pornească de la starea ascunsă:
  // pusă în aceeași clipă cu `hidden = false`, nu s-ar vedea deloc.
  requestAnimationFrame(() => elVestire.classList.add('e-vazuta'));
  clearTimeout(vesteste._t);
  vesteste._t = setTimeout(() => {
    elVestire.classList.remove('e-vazuta');
    setTimeout(() => { elVestire.hidden = true; }, 220);
  }, 4200);
}

/* Zarul a spus CE fel de exercițiu; pasul următor e să aduci materialul pentru
   el. Arătăm butonul cu degetul o dată, scurt, și tace: un semn care pulsează
   la nesfârșit nu mai spune nimic, ajunge zgomot de fundal. */
function cheamaGeneratorul() {
  const b = document.getElementById('genBtn');
  if (!b) return;
  b.classList.remove('e-chemat');
  // Un cadru de așteptare: pusă și scoasă în aceeași clipă, clasa n-ar reporni
  // deloc mișcarea, fiindcă browserul n-ar apuca să vadă starea dintre.
  requestAnimationFrame(() => b.classList.add('e-chemat'));
  clearTimeout(cheamaGeneratorul._t);
  cheamaGeneratorul._t = setTimeout(() => b.classList.remove('e-chemat'), 3400);
}

function aruncaZarul() {
  if (seRostogoleste || !elZar || !elTavita) return;
  const fata = fataUrmatoare(ultimaFata);
  ultimaFata = fata;

  if (faraMiscare()) {
    const t = INTOARCERI[fata];
    asazaZarul(0, 0, 0, t.rx, t.ry);
    gataAruncarea(fata);
    return;
  }

  seRostogoleste = true;
  elZar.style.transition = 'none';
  const latime = elTavita.clientWidth, inaltime = elTavita.clientHeight;
  const raza = elZar.offsetWidth / 2 + 4;      // 4px de aer față de perete
  const st = aruncare({ latime, inaltime, raza });

  let trecut = 0;
  const PAS = 1 / 120;                          // pași mărunți, ca loviturile
  let ramas = 0;                                // de perete să nu fie sărite
  const porni = performance.now();
  let ultimul = porni;

  function cadru(acum) {
    const dt = Math.min(0.05, (acum - ultimul) / 1000);
    ultimul = acum;
    ramas += dt;
    while (ramas >= PAS) { pas(st, PAS); ramas -= PAS; }
    trecut = acum - porni;
    asazaZarul(st.x - latime / 2, st.y - inaltime / 2, st.h, st.rx, st.ry);

    // Se oprește singur, dar nu-l lăsăm să se legene la nesfârșit: după trei
    // secunde îl așezăm oricum, ca elevul să nu aștepte după un zar îndărătnic.
    if (!stat(st) && trecut < 3000) { requestAnimationFrame(cadru); return; }

    const fin = asezare(st, fata, 1);
    elZar.style.transition = 'transform .42s cubic-bezier(.22,.9,.3,1)';
    asazaZarul(st.x - latime / 2, st.y - inaltime / 2, 0, fin.rx, fin.ry);
    setTimeout(() => { elZar.style.transition = 'none'; seRostogoleste = false; gataAruncarea(fata); }, 430);
  }
  requestAnimationFrame(cadru);
}

/* Ce se întâmplă după ce zarul s-a oprit: se face exercițiul și se deschide
   generatorul, fiindcă zarul a spus CE fel de exercițiu, iar pasul următor e
   întotdeauna „cu ce cuvinte". Rezultatul aruncării intră în capul ferestrei.

   Vestirea plutitoare rămâne numai pentru cazul în care fereastra nu se poate
   deschide: altfel s-ar acoperi una pe alta și ar spune același lucru de două
   ori. */
function gataAruncarea(fata) {
  try {
    adaugaExercitiu({ sursa: 'zar', fata });
  } catch (e) {
    console.error('exercițiul de la zar nu s-a putut face:', e);
  }
  /* Deschiderea e păzită anume. Dacă vreodată crapă ceva înăuntru, elevul
     rămânea cu tabla mută: nici fereastră, nici vestire, nici semn. Așa,
     orice s-ar întâmpla, tot capătă numărul picat și butonul arătat cu
     degetul, iar în consolă rămâne scris de ce n-a mers. */
  let sADeschis = false;
  try {
    sADeschis = deschideGeneratorul({ dinZar: fata });
  } catch (e) {
    console.error('generatorul nu s-a deschis singur:', e);
  }
  if (sADeschis) return;
  vesteste(fata);
  cheamaGeneratorul();
}

elZar && elZar.addEventListener('click', aruncaZarul);

/* Zarul stă înclinat de la bun început, nu abia după prima aruncare: altfel
   te-ar întâmpina un pătrat, și abia pe urmă ai afla că e un zar. */
if (elZar) asazaZarul(0, 0, 0, 0, 0);

/* ============================================================
   GENERATORUL

   Fereastra răspunde la trei întrebări, ținute despărțite fiindcă sunt lucruri
   deosebite: UNDE intră cuvintele, CÂTE și CUM le vrei, și dacă exercițiul e
   temă. Tipul exercițiului nu mai e printre ele: el e al exercițiului, hotărât
   de zar ori la „+ cerință", și n-are ce căuta într-o fereastră care aduce
   material. Dacă exercițiul chiar n-are tip (cerință scrisă de mână), fereastra
   îl întreabă o singură dată și îl ține minte pe exercițiu.

   PLAFONUL. Nu se poate cere mai mult decât are banca. Numărul de sus îl
   socotim din ce e chiar acum în bancă, la felul și dificultatea alese, fără
   cele date deja azi dacă e bifat „numai cuvinte noi". Așa nu ceri zece și
   primești patru fără să înțelegi de ce.
   ============================================================ */
const dlgGen = document.getElementById('dlgGen');
const elGenTintaZar = document.getElementById('genTintaZar');
const elGenTintaK = document.getElementById('genTintaK');
const elGenTintaT = document.getElementById('genTintaT');
const elGenFel = document.getElementById('genFel');
const elGenFelLista = document.getElementById('genFelLista');
const elGenParte = document.getElementById('genParte');
const elGenJos = document.getElementById('genJos');
const elGenTema = document.getElementById('genTema');
const elGenCate = document.getElementById('genCate');
const elGenCe = document.getElementById('genCe');
const elGenDin = document.getElementById('genDin');
const elGenNivel = document.getElementById('genNivel');
const elGenNoi = document.getElementById('genNoi');
const elGenNoiT = document.getElementById('genNoiT');
const elGenNou = document.getElementById('genNou');
const elGenNota = document.getElementById('genNota');
const elGenFa = document.getElementById('genFa');

/* Ce a primit elevul CÂT E PE TABLĂ. Se golește la reîncărcare, deci „nu se
   repetă în aceeași ședere" înseamnă exact ce a cerut Marius: în ședința asta
   nu, mâine da. Ține minte materialul, nu rândurile: același cuvânt cerut la
   două exerciții deosebite tot repetare e. */
const datAzi = new Set();

/* Felul ales adineauri în fereastră, pentru o cerință scrisă de mână. Trăiește
   până se închide fereastra; de acolo încolo îl ține exercițiul. */
let felAles = null;

/* Banca, cerută o dată pe fereastră deschisă. O ținem ca să putem socoti
   plafonul din mers, când schimbi dificultatea ori bifa: altfel ar fi o cerere
   la server la fiecare apăsare. Se golește la închidere, ca fereastra
   următoare să vadă ce ai mai adăugat între timp în panoul de admin. */
const banca = new Map();

/* Numele felului, luat din registrul lecției: „cuvinte", „structuri fonetice".
   Nu-l scriem de mână aici, ca să nu ajungă tabla să spună altceva decât spune
   panoul profesorului despre același lucru. */
const numeFel = (kind) => felulMaterialului(LECTIE, kind)?.nume || kind;
const numeFelArticulat = (kind) =>
  felulMaterialului(LECTIE, kind)?.numeArticulat || numeFel(kind);

/* Deschide o fereastră și SPUNE DACĂ S-A DESCHIS CU ADEVĂRAT.
   Varianta dinainte răspundea „da" fără să se uite. Dar `showModal()` poate
   arunca (o fereastră deja deschisă, de pildă), iar atunci cel care ne-a chemat
   credea că totul e bine și nu mai încerca nimic: pe ecran nu se întâmpla
   nimic, fără o vorbă. Acum, dacă modalul nu merge, o deschidem măcar simplu,
   și dacă nici așa, o spunem cinstit. */
function deschideFereastra(d) {
  if (!d) return false;
  try {
    if (d.showModal && !d.open) d.showModal();
    else d.setAttribute('open', '');
  } catch (e) {
    console.warn('fereastra nu s-a putut deschide ca modal:', e && e.message);
    try { d.setAttribute('open', ''); } catch (e2) { return false; }
  }
  return !!d.open;
}
function inchideFereastra(d) { if (!d) return; if (d.close) d.close(); else d.removeAttribute('open'); }

/* ---------- Ce fel de exercițiu ----------
   O singură listă, folosită și de fereastra de la „+ cerință", și de întrebarea
   dinăuntrul generatorului. Se face din `CERINTE` și din registrul lecției:
   dacă se schimbă o cerință, se schimbă în amândouă locurile deodată. */
function feluriHtml(cuLiber) {
  let h = '';
  for (const fata of [1, 2, 3, 4, 5, 6]) {
    const cfg = fataZarului(LECTIE, fata);
    if (!cfg) continue;
    h += '<button class="fel" type="button" data-fata="' + fata + '">' +
           '<span class="fel__n">' + fata + '</span>' +
           '<span class="fel__t"><b>' + escapaText(cfg.nume) + '</b>' +
           '<i>' + escapaText(CERINTE[fata]) + '</i></span></button>';
  }
  if (cuLiber) {
    h += '<button class="fel fel--liber" type="button" data-fata="0">' +
           '<span class="fel__n">✎</span>' +
           '<span class="fel__t"><b>scriu eu cerința</b>' +
           '<i>Exercițiul rămâne fără fel; generatorul te întreabă la nevoie.</i>' +
           '</span></button>';
  }
  return h;
}

const dlgFel = document.getElementById('dlgFel');
const elFelLista = document.getElementById('felLista');
let raspundeLaFel = null;

/** Întreabă ce fel de exercițiu și cheamă `apoi(fata)`. `0` = scrie el cerința. */
function ceFel(cuLiber, apoi) {
  if (!dlgFel || !elFelLista) { apoi(0); return; }
  elFelLista.innerHTML = feluriHtml(cuLiber);
  raspundeLaFel = apoi;
  deschideFereastra(dlgFel);
}

elFelLista && elFelLista.addEventListener('click', (e) => {
  const b = e.target.closest('.fel');
  if (!b) return;
  const fata = Number(b.dataset.fata) || 0;
  inchideFereastra(dlgFel);
  const apoi = raspundeLaFel;
  raspundeLaFel = null;
  if (apoi) apoi(fata);
});

/* ---------- Ținta și felul în lucru ---------- */

/** Felul cu care lucrăm acum: cel ales adineauri ori cel al exercițiului. */
function fataInLucru() {
  if (felAles) return felAles;
  const ex = exercitii[deschis];
  return ex && ex.fata ? Number(ex.fata) : null;
}

const nivelAles = () => {
  const b = elGenNivel && elGenNivel.querySelector('.cip.e-aleasa');
  return b && b.dataset.nivel ? Number(b.dataset.nivel) : null;
};

/* Banca pentru o față, cerută o singură dată cât e fereastra deschisă.

   CERNEREA. Unele etichete cer ceva de la cuvânt: la „valoarea lui i" n-are ce
   căuta un cuvânt fără „i", fiindcă n-ai ce valoare să-i stabilești. Regula stă
   în registrul lecției, nu aici, iar noi o ascultăm chiar în locul ăsta: așa
   plafonul, numărul de pe ecran și cuvintele generate vorbesc toate despre
   același morman. Dacă am fi cernut abia la generare, fereastra ți-ar fi promis
   zece cuvinte și ți-ar fi dat patru. */
async function bancaPentru(fata) {
  if (!banca.has(fata)) {
    const cfg = fataZarului(LECTIE, fata);
    const tot = await listItems(LECTIE, fata, {});
    banca.set(fata, tot.filter((x) => seCuvineEticheta(LECTIE, cfg.eticheta, x.body)));
  }
  return banca.get(fata);
}

/** Ce mai e de dat: după dificultate și, dacă se cere, fără cele date azi. */
function libereDin(lista, nivel, doarNoi) {
  let l = lista || [];
  if (nivel) l = l.filter((x) => Number(x.level) === nivel);
  if (doarNoi) l = l.filter((x) => !datAzi.has(x.id));
  return l;
}

/* ---------- Fereastra ---------- */

function potrivesteFereastraGen() {
  const fata = fataInLucru();
  const areFel = !!fata;
  if (elGenFel) elGenFel.hidden = areFel;
  if (elGenParte) elGenParte.hidden = !areFel;
  if (elGenJos) elGenJos.hidden = !areFel;
  if (!areFel) {
    if (elGenFelLista && !elGenFelLista.innerHTML) elGenFelLista.innerHTML = feluriHtml(false);
    if (elGenTintaK) elGenTintaK.textContent = 'Cerința în care intră';
    if (elGenTintaT) {
      const ex = exercitii[deschis];
      elGenTintaT.textContent = (ex && bazaCerintei(ex).trim()) || 'exercițiul deschis';
    }
    return;
  }

  const cfg = fataZarului(LECTIE, fata);
  const ex = exercitii[deschis];
  const nou = elGenNou && elGenNou.checked;

  if (elGenTintaK) {
    elGenTintaK.textContent = numeFelArticulat(cfg.kind) + ' intră ' +
      (nou || !ex ? 'într-un exercițiu nou' : 'în exercițiul ' + (deschis + 1));
  }
  if (elGenTintaT) {
    // La un exercițiu care are deja cerința scrisă, arătăm chiar textul lui, nu
    // șablonul: altfel fereastra ar promite altceva decât scrie pe tablă.
    const scrisa = !nou && ex ? bazaCerintei(ex).trim() : '';
    elGenTintaT.textContent = scrisa || CERINTE[fata];
  }
  if (elGenCe) elGenCe.textContent = numeFel(cfg.kind);
  if (elGenNoiT) elGenNoiT.textContent = 'numai ' + numeFel(cfg.kind) + ' noi';
  if (elGenTema) elGenTema.checked = !nou && !!(ex && ex.tema);

  improspatatePlafonul();
}

/** Câte mai are banca și, pe loc, plafonul câmpului. */
async function improspatatePlafonul() {
  const fata = fataInLucru();
  if (!fata || !elGenCate) return;
  const cfg = fataZarului(LECTIE, fata);
  if (elGenDin) elGenDin.textContent = 'caut în bancă…';
  const tot = await bancaPentru(fata);
  // Între timp poți fi schimbat felul; atunci răspunsul ăsta e vechi.
  if (fataInLucru() !== fata) return;

  const nivel = nivelAles();
  const doarNoi = !!(elGenNoi && elGenNoi.checked);
  const plafon = libereDin(tot, nivel, doarNoi).length;
  const libere = plafon;

  elGenCate.max = String(Math.max(1, plafon));
  if (Number(elGenCate.value) > plafon) elGenCate.value = String(Math.max(1, plafon));
  if (elGenDin) {
    elGenDin.textContent = libere
      ? 'din ' + libere + ' în bancă'
      : 'banca e goală aici';
  }
  if (elGenFa) elGenFa.disabled = plafon < 1;
  if (elGenNota) {
    const cere = deCeCereEticheta(LECTIE, cfg.eticheta);
    elGenNota.textContent = plafon >= 1 ? '' :
      (tot.length
        ? 'Ai dat azi toate ' + numeFel(cfg.kind) + ' de aici' +
          (nivel ? ' la dificultatea asta' : '') + '. Scoate bifa ori schimbă dificultatea.'
        : 'Banca n-are încă ' + numeFel(cfg.kind) + ' pentru exercițiul ăsta' +
          (cere ? ' (aici fiecare cuvânt ' + cere + ')' : '') + '.');
  }
}

/** Deschide generatorul. `dinZar` = fața care tocmai a picat, dacă e cazul. */
function deschideGeneratorul({ dinZar = null } = {}) {
  if (!dlgGen) return false;
  felAles = null;
  banca.clear();
  if (elGenNota) elGenNota.textContent = '';
  if (elGenNou) elGenNou.checked = false;
  if (elGenTintaZar) {
    elGenTintaZar.hidden = !dinZar;
    if (dinZar) elGenTintaZar.textContent = '🎲 ți-a picat ' + dinZar;
  }
  potrivesteFereastraGen();
  return deschideFereastra(dlgGen);
}

document.getElementById('genBtn')?.addEventListener('click', () => deschideGeneratorul());
dlgGen && dlgGen.addEventListener('close', () => { felAles = null; banca.clear(); });

elGenNou && elGenNou.addEventListener('change', potrivesteFereastraGen);
elGenNoi && elGenNoi.addEventListener('change', improspatatePlafonul);
elGenNivel && elGenNivel.addEventListener('click', (e) => {
  const b = e.target.closest('.cip');
  if (!b) return;
  elGenNivel.querySelectorAll('.cip').forEach((x) => x.classList.toggle('e-aleasa', x === b));
  improspatatePlafonul();
});
elGenFelLista && elGenFelLista.addEventListener('click', (e) => {
  const b = e.target.closest('.fel');
  if (!b) return;
  felAles = Number(b.dataset.fata) || null;
  potrivesteFereastraGen();
});

/* Plafonul se ține și la tastare, nu doar prin atributul `max`: `max` oprește
   săgețile, dar nu oprește pe cineva care scrie 40 cu mâna. */
elGenCate && elGenCate.addEventListener('input', () => {
  const plafon = Number(elGenCate.max) || 1;
  if (Number(elGenCate.value) > plafon) elGenCate.value = String(plafon);
});

/** Alege `cate` la întâmplare din ce e liber. */
function alege(lista, cate) {
  const ales = [];
  const copie = lista.slice();
  while (ales.length < cate && copie.length) {
    ales.push(copie.splice(Math.floor(Math.random() * copie.length), 1)[0]);
  }
  ales.forEach((x) => datAzi.add(x.id));
  return ales;
}

elGenFa && elGenFa.addEventListener('click', async () => {
  const fata = fataInLucru();
  if (!fata) return;                       // fereastra e la întrebarea de fel
  const cfg = fataZarului(LECTIE, fata);

  const tot = await bancaPentru(fata);
  const libere = libereDin(tot, nivelAles(), !!(elGenNoi && elGenNoi.checked));
  if (!libere.length) { improspatatePlafonul(); return; }

  const cate = Math.max(1, Math.min(libere.length, Number(elGenCate.value) || 1));
  const texte = alege(libere, cate).map((x) => x.body);

  // UNDE INTRĂ. Un exercițiu nou capătă felul ăsta; cel deschis, dacă n-avea
  // fel (cerință scrisă de mână), îl capătă acum și nu va mai fi întrebat.
  let ex;
  if ((elGenNou && elGenNou.checked) || !exercitii[deschis]) {
    ex = adaugaExercitiu({ sursa: 'tip', fata });
  } else {
    ex = exercitii[deschis];
    if (!ex.fata) ex.fata = fata;
  }

  /* CUVINTELE stau lângă cerință, ca elevul să le vadă și când derulează, dar
     nu ÎN ea: la a doua generare le înlocuim, nu le îngrămădim. Cerința scrisă
     de mână rămâne cum a scris-o; șablonul e numai pentru cea goală. */
  /* Propozițiile NU intră în cerință: ele se văd oricum, fiecare pe rândul ei.
     Puse și acolo, s-ar citi de două ori, iar virgulele dinăuntrul lor s-ar
     amesteca cu virgulele care le despart. Cuvintele și structurile, în schimb,
     n-au unde se vedea altundeva, deci stau în cerință. */
  ex.cuvinte = cfg.kind === 'propozitie' ? [] : texte;
  ex.tema = !!(elGenTema && elGenTema.checked);

  // RÂNDURILE, după felul materialului:
  //  · cuvinte     → un rând pe cuvânt, cu cuvântul pus la locul lui;
  //  · structuri   → rânduri GOALE: structura e cerința, cuvintele le dă elevul;
  //  · propoziții  → un rând, cu propoziția în prima căsuță, de transcris.
  //  · cuvinte     → un rând pe cuvânt, cu cuvântul pus la locul lui;
  //  · structuri   → rânduri GOALE: structura e cerința, cuvintele le dă elevul;
  //  · propoziții  → rând de propoziție: enunțul sus, blocat, transcrierea jos.
  if (cfg.kind === 'propozitie') {
    ex.randuri = texte.map((t) => ({ fraza: escapaText(t), trans: '', blocata: true }));
  } else if (cfg.kind === 'structura') {
    ex.randuri = texte.map(() => ({}));
  } else {
    ex.randuri = texte.map((t) => ({ word: escapaText(t) }));
  }

  aseazaRanduri(ex.randuri, cfg.kind === 'propozitie');
  deseneazaTeancul();
  murdareste(); scheduleSave();
  inchideFereastra(dlgGen);
});

/* Banca de material NU se mai scrie de aici.
   S-a mutat în panoul de administrare, la lecția ei: „Profesor → Lecții →
   Fonetică, introducere → Tablă". Un lucru, un loc. Tabla doar CITEȘTE banca,
   prin generatorul de mai sus, iar cine n-are drept de scriere nici nu vede
   vreun buton care i-ar da speranțe. */

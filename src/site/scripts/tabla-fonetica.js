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
    const o = iaLocal('fonetica_symbols', null);
    if (o) {
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
    punLocal('fonetica_symbols', { v: VERSIUNEA_SIMBOLURILOR, ...symbols });
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

/* „I"-UL SUPRASCRIS.

   Într-o transcriere, „i"-ul final care nu se aude se scrie mic, deasupra, cu o
   linie sub el, și cu un spațiu înaintea lui. Butonul face același lucru în
   toate cele trei feluri în care poate fi cerut:

     · ai ales un „i" scris deja → el se preface în cel suprascris;
     · ai cursorul CHIAR DUPĂ un „i" → tot el se preface, nu se adaugă altul;
     · nu e niciun „i" prin preajmă → se scrie unul unde stă cursorul.

   Al doilea caz e cel care lipsea, și se vedea: scriai „casi", puneai cursorul
   după „i" și te trezeai cu doi. Or, mâna scrie întâi litera și abia pe urmă se
   gândește s-o ridice: asta e ordinea firească, nu un caz mărunt. Butonul de
   accent lucrează la fel, și e bine să lucreze la fel, că două unelte vecine
   care se poartă altfel se învață de două ori.

   SPAȚIUL DINAINTE face parte din semn, nu e o podoabă: fără el, „i"-ul mic s-ar
   lipi de litera dinainte și s-ar citi ca parte din ea. */
function superscriptSelection() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  let range = sel.getRangeAt(0);
  let text;
  if (!range.collapsed) {
    text = range.toString();
    range.deleteContents();
  } else {
    /* Cursorul chiar după un „i": acela se ridică, nu se mai adaugă altul. */
    const inainte = domeniulLiterei();
    const litera = inainte ? inainte.toString() : '';
    if (litera === 'i' || litera === 'I') {
      range = inainte;
      text = litera;
      range.deleteContents();
    } else {
      text = 'i';
    }
  }

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

/* ---------- ACCENTUL ASCUȚIT PE SUNETUL VOCALIC ----------

   Într-o transcriere fonetică se însemnează silaba accentuată, iar semnul cade
   pe sunetul vocalic al ei. Elevul alege sunetul și apasă: litera se îngroașă
   și se schimbă cu cea accentuată.

   NUMAI SUNETE VOCALICE, fiindcă numai ele pot purta accentul: a, e, i, o, u,
   ă, â, î, cu majusculele lor. Pe o consoană butonul nu face nimic, și e bine
   că nu face: o unealtă care se supune orbește ar lăsa elevul să scrie un lucru
   care nu există, iar tabla e tocmai locul unde se învață ce există.

   DE UNDE VIN LITERELE, ȘI DE CE-S DE DOUĂ CULORI.

   Toate opt capătă litera lor accentuată: á, é, í, ó, ú, iar cele trei ale
   noastre ắ, ấ și „î" cu semnul de accent pus deasupra. Pe „î" nu se putea
   altfel: nicio scriere din lume n-a avut nevoie de „i" cu căciulă ȘI cu
   accent, așa că nu i s-a făcut o literă a lui. Iese la fel la citit, doar că-s
   două semne, nu unul.

   CULOAREA nu e podoabă, e deosebire: „ă", „î" și „â" se scriu cu ROȘU, cum
   sunt însemnate și în lecție, iar celelalte cinci cu movul tablei. Tabla
   trebuie să scrie ca lecția, altfel elevul învață un lucru și scrie altul.

   CUM SE ȘTIE CĂ E ACCENTUATĂ. Nu după cum arată litera, ci după semnul pus pe
   ea: `<b class="accent">`. Trebuie așa, fiindcă la scoaterea accentului
   trebuie să știm și de unde am plecat, iar litera singură n-o mai spune.

   Și SE IA ÎNAPOI la a doua apăsare. Orice unealtă care pune ceva trebuie să
   știe și să scoată, altfel singurul drum înapoi e ștergerea, adică pierderea a
   ce era bun împreună cu ce era greșit. */
const ACCENTE = {
  a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú',
  'ă': 'ắ', 'â': 'ấ', 'î': 'î\u0301',
  A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú',
  'Ă': 'Ắ', 'Â': 'Ấ', 'Î': 'Î\u0301',
};
const FARA_ACCENT = Object.fromEntries(
  Object.entries(ACCENTE).map(([gol, cu]) => [cu, gol]));

/* Cele trei ale noastre se scriu cu roșu, cum sunt însemnate și în lecție;
   celelalte cinci, cu movul tablei. */
const ROSII = 'ăâîĂÂÎ';

/* Ce stă între sunete și nu e sunet: virgulele pe care le pune singură tabla
   după fiecare sunet, spațiile din jurul lor și spațiul de lățime zero cu care
   se ține deschisă o transcriere goală. */
const NU_E_LITERA = /[\s,\u200b]/;

/**
 * Litera dinaintea cursorului, ori cea aleasă: un domeniu peste ea.
 *
 * SARE PESTE CE NU E LITERĂ, și trebuie să sară. În câmpul de transcriere,
 * fiecare sunet scris capătă singur o virgulă și un spațiu după el, așa că
 * imediat înaintea cursorului nu stă „i", ci „, ". Uneltele care lucrează pe
 * litera dinainte (accentul, „i"-ul suprascris) găseau acolo o virgulă, ziceau
 * „asta nu-i literă" și adăugau un semn nou în loc să-l prefacă pe cel scris.
 * Se vedea limpede: „i ⁱ" în loc de „ⁱ".
 *
 * Ce sare peste rămâne pe loc: se ia numai litera, iar virgula de după ea nu se
 * atinge, fiindcă e a rândului, nu a literei.
 */
function domeniulLiterei() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!r.collapsed) return r;
  /* Fără nicio alegere, luăm litera dinaintea cursorului: e cea pe care tocmai
     ai scris-o, deci cea la care te gândești. */
  const nod = r.startContainer, unde = r.startOffset;
  if (nod.nodeType !== 3 || unde === 0) return null;
  let capat = unde;
  while (capat > 0 && NU_E_LITERA.test(nod.data[capat - 1])) capat--;
  if (capat === 0) return null;
  let de = capat - 1;
  // un semn de accent merge întotdeauna cu litera lui, niciodată singur
  if (/[\u0300-\u036f]/.test(nod.data[de]) && de > 0) de--;
  const nou = document.createRange();
  nou.setStart(nod, de);
  nou.setEnd(nod, capat);
  return nou;
}

function accentueaza() {
  const camp = activeField();
  if (!camp) return false;
  const r = domeniulLiterei();
  if (!r) return false;
  const text = r.toString();
  // O singură literă, cu semnul ei cu tot. Un cuvânt întreg n-are un singur
  // accent de pus: accentul cade pe UN sunet, iar care anume alege elevul.
  if (text.replace(/[\u0300-\u036f]/g, '').length !== 1) return false;

  /* E accentuată? Nu întrebăm litera, întrebăm semnul de pe ea: „Ă" roșu și
     „Ă" scris de elev arată la fel, iar deosebirea nu e în literă. */
  const purtat = r.commonAncestorContainer;
  const semnul = purtat && purtat.parentElement
    ? (purtat.nodeType === 3 ? purtat.parentElement : purtat).closest('b.accent')
    : null;
  const eraAccentuata = !!semnul && semnul.textContent === text;

  const scos = eraAccentuata ? (FARA_ACCENT[text] || text) : null;
  const pus = eraAccentuata ? null : ACCENTE[text];
  if (!scos && !pus) return false;

  let nod;
  if (scos) {
    nod = document.createTextNode(scos);
    semnul.replaceWith(nod);
    r.selectNode(nod);
  } else {
    r.deleteContents();
    nod = document.createElement('b');
    nod.className = ROSII.includes(text) ? 'accent accent--rosu' : 'accent';
    nod.textContent = pus;
    r.insertNode(nod);
  }
  r.setStartAfter(nod);
  r.setEndAfter(nod);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);

  /* Îngroșarea rămasă goală după scoaterea accentului n-are ce căuta: ar
     îngroșa pe furiș litera următoare pe care o scrii acolo. */
  camp.querySelectorAll('b').forEach((b) => { if (!b.textContent) b.remove(); });
  murdareste(); scheduleSave();
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

  /* ENTER MERGE MAI DEPARTE, ca Tab, și abia la capăt deschide un rând nou.

     Făcea, până acum, rând nou de fiecare dată. Era o hotărâre luată pe vremea
     când tabla avea un singur fel de rând și trei etape: mergeai cu Tab prin
     ele și cu Enter treceai la cuvântul următor. Cu șase feluri de exercițiu și
     rânduri de trei feluri, deosebirea asta nu se mai ține minte, iar mâna
     cere de la Enter chiar lucrul pe care-l cere de la Tab: „gata aici, mai
     departe". Un rând nou tot iese, dar când chiar s-a terminat rândul, adică
     atunci când și mintea îl aștepta.

     Amândouă tastele duc deci în același loc, iar `Shift` le întoarce pe
     amândouă înapoi: dacă două taste fac același lucru, trebuie să-l facă
     până la capăt, altfel deosebirea rămasă e cea mai greu de ținut minte. */
  if (e.key === 'Enter' || e.key === 'Tab') {
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
  /* Tasta 5, în urma celor patru simboluri: accentul e tot un semn pus pe un
     sunet, deci stă în același rând de taste, nu într-un colț al minții. */
  if (e.code === 'Digit5') { e.preventDefault(); accentueaza(); return; }

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

/* ÎNCĂ UN CUVÂNT PENTRU ACEEAȘI STRUCTURĂ.
   Căsuța nouă se naște CHIAR ÎNAINTEA butonului, deci intră la coada șirului;
   iar fiindcă mănunchiul se rupe singur pe rânduri, când nu mai încape trece
   dedesubt, sub cel dinainte, fără nicio socoteală de așezare din partea mea. */
sheet.addEventListener('click', (e) => {
  const plus = e.target.closest && e.target.closest('.cuv-plus');
  if (!plus) return;
  const cuvinte = plus.closest('.cuvinte');
  const model = cuvinte.querySelector('.cuv');
  const nou = model.cloneNode(false);
  nou.innerHTML = '';
  cuvinte.insertBefore(nou, plus);
  placeCaret(nou, true);
  murdareste(); scheduleSave();
});

/* rupe ciclul ă/î/â și starea c->k dacă utilizatorul dă click aiurea */
sheet.addEventListener('mousedown', () => { resetACycle(); resetCK(); });

/* ---------- Navigare între câmpuri (Tab și Enter) ----------

   SE SARE PESTE CE NU SE POATE SCRIE. Structura fonetică și propoziția venite
   de la generator sunt materialul, nu lucrul elevului, deci stau blocate. Erau
   totuși în șirul prin care umblă Tab, iar `focus()` pe un câmp blocat nu face
   nimic: apăsai Enter și rămâneai pe loc, fără nicio veste de ce. O tastă care
   uneori nu face nimic e mai rea decât una care nu există.

   Se caută deci înainte (sau înapoi) până la primul câmp în care CHIAR se poate
   scrie, iar rândul nou se naște abia când nu mai e niciunul. */
const sePoateScrie = (f) => !!f && f.getAttribute('contenteditable') !== 'false';

/* CUVINTELE UNEI STRUCTURI SUNT O SINGURĂ ETAPĂ, REPETATĂ.

   Un rând de structură are trei etape: structura, despărțirea ei, cuvântul.
   Butonul „+" nu adaugă o etapă a patra, ci încă un cuvânt la aceeași etapă,
   fiindcă unei structuri i se potrivesc oricâte cuvinte.

   Or, Tab și Enter umblă prin ETAPE. Dacă ar intra și în cuvintele adăugate, ar
   însemna că fiecare „+" apăsat lungește drumul până la structura următoare, și
   de-atunci nu mai poți merge înainte fără să treci prin niște căsuțe pe care
   poate nici nu le-ai vrut. Așa că din oricare cuvânt se trece drept la
   structura următoare, iar cuvintele dintre ele se aleg cu degetul, cum au și
   fost cerute cu degetul. */
const acelasiSirDeCuvinte = (a, b) =>
  !!a && !!b && a.classList.contains('cuv') && b.classList.contains('cuv') &&
  a.closest('.cuvinte') === b.closest('.cuvinte');

/* CIORNA E ALTĂ ÎNCĂPERE, iar Tab și Enter nu trec dintr-una într-alta.

   Le lăsasem în același șir, și ieșea o purtare greșită: de la capătul ultimului
   rând, Enter nu mai deschidea un rând nou, ci te muta în ciornă. Adică taman
   când voiai să scrii al zecelea cuvânt, te trezeai pe hârtia de pe margine.

   Ciorna nu e o urmare a exercițiului, e un loc alăturat, deci se intră în ea cu
   degetul, ca într-o încăpere alăturată. Înăuntru, tastele merg mai departe ca
   pretutindeni; numai pragul nu se trece cu ele. */
const aceeasiIncapere = (a, b) =>
  eCiorna(a && a.closest('.row')) === eCiorna(b && b.closest('.row'));

function navigate(current, back) {
  const fields = Array.from(sheet.querySelectorAll('.field'));
  const i = fields.indexOf(current);
  let target = null;
  for (let k = i + (back ? -1 : 1); k >= 0 && k < fields.length; k += (back ? -1 : 1)) {
    if (!sePoateScrie(fields[k])) continue;
    if (acelasiSirDeCuvinte(current, fields[k])) continue;
    if (!aceeasiIncapere(current, fields[k])) break;
    target = fields[k]; break;
  }
  if (!target && !back) {
    /* Ciorna e ultima și rămâne ultima: după ea nu se naște nimic, fiindcă nu
       e o cerință, e hârtia de pe margine. */
    const row = current.closest('.row');
    if (eCiorna(row)) return;
    const newRow = addRowAfter(row);
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
const rowTemplateStructura = document.getElementById('rowTemplateStructura');
const rowTemplateAccent = document.getElementById('rowTemplateAccent');

/* TREI FELURI DE RÂND, ȘI FIECARE ȘTIE SINGUR CE E.
   Felul nu se ține minte pe alături, ci se citește din chiar rândul din pagină:
   așa nu se poate întâmpla ca datele să spună una și desenul alta. */
const SABLOANE = {
  fraza: rowTemplateFraza,
  structura: rowTemplateStructura,
  accent: rowTemplateAccent,
};

function createRow(fel) {
  const sablon = SABLOANE[fel] || rowTemplate;
  return sablon.content.firstElementChild.cloneNode(true);
}

function felRand(row) {
  if (!row) return 'obisnuit';
  if (row.classList.contains('row--fraza')) return 'fraza';
  if (row.classList.contains('row--structura')) return 'structura';
  if (row.classList.contains('row--accent')) return 'accent';
  return 'obisnuit';
}
const eRandDeFraza = (row) => felRand(row) === 'fraza';

/** Ce fel de rând cere fața asta de zar? */
function felDupaFata(fata) {
  /* Accentul are rândul lui, deși materialul e tot cuvinte: drumul pe care-l
     face elevul e altul, iar rândul e drumul făcut văzut. */
  if (fata === 'accent') return 'accent';
  const kind = fata ? felulExercitiului(LECTIE, fata)?.kind : null;
  if (kind === 'propozitie') return 'fraza';
  if (kind === 'structura') return 'structura';
  return 'obisnuit';
}
const fataCereFraza = (fata) => felDupaFata(fata) === 'fraza';

/* CIORNA NU E UN RÂND CA CELELALTE, deci nu intră la socoteală nicăieri:
   nu se numără, nu se salvează printre ele, nu se naște una nouă lângă ea.
   Ca să nu trebuiască ținută minte pe alături, poartă un semn al ei, iar toate
   locurile care umblă cu rândurile întreabă `randurile()`, nu foaia. */
const randurile = () => Array.from(sheet.querySelectorAll('.row:not(.row--ciorna)'));
const eCiorna = (row) => !!row && row.classList.contains('row--ciorna');

function renumber() {
  randurile().forEach((row, idx) => {
    row.querySelector('.rownum').textContent = (idx + 1) + '.';
  });
}

function addRowAfter(row) {
  // Rândul nou seamănă cu cel de lângă care se naște: într-un exercițiu de
  // propoziții adaugi tot o propoziție, nu un cuvânt.
  if (eCiorna(row)) return row;               // în ciornă nu se adaugă rânduri
  const newRow = createRow(row ? felRand(row)
                               : felDupaFata(exercitiulDeschis()?.fata));
  const ciorna = sheet.querySelector('.ciorna');
  if (row && row.nextSibling) sheet.insertBefore(newRow, row.nextSibling);
  else if (ciorna) sheet.insertBefore(newRow, ciorna);
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
      /* Un singur lucru, în amândouă felurile: cu literă aleasă o preface, fără
         literă aleasă scrie un „i". Fără asta, butonul pornea o STARE a
         browserului, iar o unealtă care uneori pune un semn și alteori pornește
         o stare nu se poate ține minte. */
      superscriptSelection();
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
  // accentul ascuțit pe sunetul vocalic ales
  if (btn.dataset.actiune === 'accent') { accentueaza(); return; }
});

document.getElementById('addRowBtn').addEventListener('click', () => {
  const rows = randurile();
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
  const rows = randurile();
  return rows[rows.length - 1] || null;
}

function addStageToRow(row) {
  /* Rândurile cu formă proprie n-au etape de adăugat: propoziția are două
     câmpuri hotărâte, iar structura are un „+" al ei, care adaugă un cuvânt,
     nu o etapă. */
  if (!row || felRand(row) !== 'obisnuit') return null;
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

/* ---------- Panourile din dreapta (Notițe / Simboluri) ----------
   Se deschid DOAR la click și numai unul odată: se așază amândouă în același
   colț, iar două deschise s-ar acoperi unul pe altul.

   „Tablele mele" NU MAI E AICI. S-a mutat într-un sertar pe marginea din
   stânga, deci nu se mai bate cu astea pe colț și n-are de ce se închide când
   se deschid ele. */
const notesPanel    = document.getElementById('notesPanel');
const settingsPanel = document.getElementById('settingsPanel');
const panouri = [notesPanel, settingsPanel].filter(Boolean);

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
  // Nu pică la zar: îl dă profesorul când socotește el.
  accent: 'Stabilește pronunția corectă a cuvintelor prin marcarea accentului:',
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

/**
 * Cerința scrisă pe ecran, cu cele două straturi ale ei deosebite la vedere.
 *
 * În date sunt deja două lucruri deosebite: CE SE CERE, care e al profesorului
 * și e același pe toată tabla, și CU CE, adică materialul adus de generator,
 * care se schimbă la fiecare generare. Până acum se citeau ca un singur șir
 * cenușiu, deși ochiul are nevoie de ele despărțite: porunca se caută o dată,
 * materialul se caută la fiecare cuvânt rezolvat.
 *
 * Deci: porunca îngroșată, materialul cursiv. Nu e o podoabă, e chiar deosebirea
 * din date, arătată. Iar dacă vreodată se schimbă felul în care sunt ținute,
 * desenul se schimbă odată cu ele, fiindcă se ia din aceleași două locuri.
 *
 * Textul intră prin `escapaText` ÎNAINTE de a fi îmbrăcat în etichete: un cuvânt
 * generat n-are voie să aducă alte etichete cu el.
 */
function cerintaInHtml(ex) {
  if (!ex) return '';
  const cere = escapaText(bazaCerintei(ex));
  const cu = escapaText((ex.cuvinte || []).join(', '));
  const a = cere ? '<b class="cer__cere">' + cere + '</b>' : '';
  const b = cu ? '<i class="cer__material">' + cu + '</i>' : '';
  return a && b ? a + ' ' + b : a + b;
}

/** Se poate scrie în cerința asta? Numai cele scrise de mână. */
const eDeScris = (ex) => !!ex && ex.sursa === 'mana';
const exercitiulDeschis = () => exercitii[deschis] || null;

/** Rândurile din pagină, în formă de date. */
function culegeRanduri() {
  return randurile().map((row) => {
    if (felRand(row) === 'accent') {
      return {
        itemId: row.dataset.item || null,
        word: (row.querySelector('.word') || {}).innerHTML || '',
        accentuat: (row.querySelector('.accentuat') || {}).innerHTML || '',
        sens: (row.querySelector('.sens') || {}).innerHTML || '',
        exemplu: (row.querySelector('.exemplu') || {}).innerHTML || '',
      };
    }
    if (felRand(row) === 'structura') {
      const st = row.querySelector('.structura');
      return {
        itemId: row.dataset.item || null,
        structura: st ? st.innerHTML : '',
        syll: (row.querySelector('.syll') || {}).innerHTML || '',
        /* Cuvintele goale nu se salvează: sunt căsuțe deschise din greșeală cu
           „+", nu răspunsuri. Se pierd la salvare și nu se mai întorc. */
        raspuns: Array.from(row.querySelectorAll('.cuv'))
          .map((c) => c.innerHTML)
          .filter((t) => String(t).replace(/<br\s*\/?>|&nbsp;|\s/g, '') !== ''),
        blocata: !!st && st.getAttribute('contenteditable') === 'false',
      };
    }
    if (eRandDeFraza(row)) {
      const fr = row.querySelector('.fraza');
      return {
        itemId: row.dataset.item || null,
        fraza: fr ? fr.innerHTML : '',
        trans: (row.querySelector('.trans') || {}).innerHTML || '',
        blocata: !!fr && fr.getAttribute('contenteditable') === 'false',
      };
    }
    return {
      itemId: row.dataset.item || null,
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
function aseazaRanduri(randuri, felCerut) {
  sheet.innerHTML = '';
  const lista = (randuri && randuri.length) ? randuri : [null];
  // Un exercițiu gol tot rândul felului lui îl primește: felul îl spune
  // exercițiul, nu rândurile care încă nu există.
  const felImplicit = felCerut !== undefined ? felCerut
    : felDupaFata(exercitiulDeschis()?.fata);
  lista.forEach((r) => {
    /* Felul unui rând se citește din chiar datele lui: are `fraza`, e de
       propoziție; are `structura`, e de structură. Nu-l ținem minte pe alături,
       ca să nu se poată ca datele să spună una și desenul alta. */
    const fel = r ? (r.fraza !== undefined ? 'fraza'
                   : r.structura !== undefined ? 'structura'
                   : r.accentuat !== undefined ? 'accent' : 'obisnuit')
                  : felImplicit;
    const row = createRow(fel);
    /* Numele cuvântului în bancă, purtat de rândul din pagină. Nu se ține pe
       alături, într-o listă paralelă: o listă paralelă ar trebui ținută în pas
       cu rândurile la fiecare ștergere și adăugare, iar la prima uitare ar
       eticheta alt cuvânt decât cel de pe ecran. */
    if (r && r.itemId) row.dataset.item = r.itemId;
    sheet.appendChild(row);
    if (!r) return;
    if (fel === 'accent') {
      row.querySelector('.word').innerHTML = r.word || '';
      row.querySelector('.accentuat').innerHTML = r.accentuat || '';
      row.querySelector('.sens').innerHTML = r.sens || '';
      row.querySelector('.exemplu').innerHTML = r.exemplu || '';
      return;
    }
    if (fel === 'structura') {
      const st = row.querySelector('.structura');
      st.innerHTML = r.structura || '';
      // Structura venită de la generator nu se schimbă: e materialul, nu lucrul
      // elevului. Cea adăugată de mână se scrie.
      if (r.blocata) st.setAttribute('contenteditable', 'false');
      row.querySelector('.syll').innerHTML = r.syll || '';
      const cuvinte = row.querySelector('.cuvinte');
      const plus = cuvinte.querySelector('.cuv-plus');
      const lista2 = (r.raspuns && r.raspuns.length) ? r.raspuns : [''];
      cuvinte.querySelectorAll('.cuv').forEach((c, i) => { if (i) c.remove(); });
      const dintai = cuvinte.querySelector('.cuv');
      dintai.innerHTML = lista2[0] || '';
      for (let i = 1; i < lista2.length; i++) {
        const c = dintai.cloneNode(false);
        c.innerHTML = lista2[i];
        cuvinte.insertBefore(c, plus);
      }
      return;
    }
    if (fel === 'fraza') {
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
  aseazaCiorna();
  renumber();
  /* Rândurile s-au schimbat, deci semnele trebuie puse din nou: ele stau pe
     rânduri, nu pe pagină. Iar dacă s-au schimbat și CUVINTELE, nu doar
     așezarea lor, întrebăm din nou care sunt lucrate: altfel bifele verzi ar
     rămâne cele ale cuvintelor de dinainte. `afluCeSAEtichetat` întreabă numai
     când chiar s-a schimbat lista, și desenează oricum. */
  if (typeof afluCeSAEtichetat === 'function') afluCeSAEtichetat();
  else if (typeof aratăSemneleDeEtichetat === 'function') aratăSemneleDeEtichetat();
}

/* ============================================================
   ETICHETAREA CUVINTELOR, DE CĂTRE ELEV

   Banca de material se etichetează cuvânt cu cuvânt, iar treaba e lungă pentru
   un singur om. Numai că, privind mai atent, nici nu e o corvoadă de dat
   altcuiva: a hotărî că „ceapă" e bun pentru grupuri de sunete E chiar
   exercițiul. Deci lucrul nu se pasează, se mută acolo unde se și învață.

   CE SE VEDE AICI E DOAR CURTOAZIE. Cine are voie, când are voie și dacă nu
   cumva cuvântul a fost etichetat deja se hotărăsc în bază, într-o singură
   funcție (migrarea 0082). Aici se face numai atât cât elevul să nu vadă un
   buton care oricum n-ar merge. O regulă ținută în browser se ocolește cu
   unealta de dezvoltare; una ținută în bază, nu.

   SEMNUL APARE NUMAI PE RÂNDURILE VENITE DIN BANCĂ. Un cuvânt scris de mână de
   elev nu e în bancă, deci n-are ce eticheta: mărginirea asta nu e o hotărâre,
   e chiar firea lucrurilor.

   DOUĂ SEMNE, NU UNUL. Arătau la fel fiindcă erau același lucru, și era greșit:

     · BIFA VERDE spune „cuvântul ăsta a fost lucrat la meditație". E o veste,
       nu o unealtă, deci se vede la TOȚI: vizitator, elev oarecare, elev la
       meditații, profesor. Nu ține de comutator: ce s-a lucrat s-a lucrat.
       Numai la profesor e și buton, iar apăsată deschide schimbarea etichetelor.
     · SEMNUL PUNCTAT e unealta de etichetat, și rămâne strâmt: numai elevii de
       la meditații, numai cu comutatorul deschis, numai pe cuvintele
       neetichetate încă.

   O ETICHETĂ NU SE MAI POATE SCOATE DECÂT DE PROFESOR. Elevul, prin ușa lui,
   doar adaugă (0083). Aici se vede aceeași regulă: fereastra lui n-are bifele
   dinainte puse, fiindcă n-are ce dezbifa.
   ============================================================ */
let potEticheta = false;          // sunt elev la meditații (ori profesor)?
let potSchimbaEtichete = false;   // sunt profesor?
let etichetareaEDeschisa = false;
let etichetateDeja = new Set();

/** Ce etichete se pot pune pe felul de material al exercițiului deschis. */
function eticheteDePus() {
  const ex = exercitiulDeschis();
  const cfg = ex && ex.fata ? felulExercitiului(LECTIE, ex.fata) : null;
  return cfg ? eticheteleFelului(LECTIE, cfg.kind) : [];
}

/** Pune ori scoate semnele de etichetat de pe rândurile din pagină. */
function aratăSemneleDeEtichetat() {
  if (!sheet) return;
  sheet.querySelectorAll('.et-semn').forEach((b) => b.remove());
  /* Unealta de etichetat, strâmtă: numai la meditații, numai cu comutatorul
     deschis, numai unde lecția are ce etichete să dea. Bifa verde nu ține de
     niciuna dintre astea, de-aia se socotește pe rând mai jos, nu aici. */
  const potPune = potEticheta && etichetareaEDeschisa && eticheteDePus().length > 0;
  randurile().forEach((row) => {
    const id = row.dataset.item;
    if (!id) return;
    const gata = etichetateDeja.has(id);
    if (!gata && !potPune) return;

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'et-semn' + (gata ? ' e-gata' : '');
    b.dataset.etichetare = id;
    b.textContent = gata ? '✓' : '🏷';
    if (gata) {
      /* Bifa e buton numai la profesor. La ceilalți rămâne un însemn, și e
         scris pe ea de ce: altfel ar părea un buton stricat. */
      b.disabled = !potSchimbaEtichete;
      b.title = potSchimbaEtichete
        ? 'Lucrat la meditație. Apasă ca să schimbi etichetele.'
        : 'Cuvântul ăsta a fost lucrat la meditație.';
    } else {
      b.title = 'Pune etichetele care i se potrivesc.';
    }
    /* Semnul stă lângă capul rândului, adică lângă lucrul pe care-l etichetezi:
       cuvântul, structura ori propoziția. */
    const cap = row.querySelector('.structura, .fraza, .word');
    if (cap && cap.parentElement) cap.parentElement.insertBefore(b, cap.nextSibling);
  });
}

/**
 * Fereastra de bifat, deschisă lângă semnul apăsat.
 *
 * Aceeași fereastră slujește la două lucruri, fiindcă e aceeași întrebare pusă
 * de doi oameni: „ce i se potrivește cuvântului ăstuia?". Se deosebesc doar prin
 * ce se poate face cu răspunsul.
 *
 *   · ELEVUL o deschide de pe semnul punctat, cu bifele goale, și poate doar
 *     ADĂUGA. N-are ce dezbifa, fiindcă n-are dreptul să scoată.
 *   · PROFESORUL o deschide de pe bifa verde, cu etichetele de acum deja puse,
 *     și poate și scoate.
 */
async function deschideEtichetele(semn) {
  document.querySelectorAll('.et-panou').forEach((p) => p.remove());
  const id = semn.dataset.etichetare;
  if (!id) return;

  const eSchimbare = semn.classList.contains('e-gata');
  if (eSchimbare && !potSchimbaEtichete) return;   // la ceilalți bifa e însemn, nu buton

  const lista = eticheteDePus();
  /* La schimbare cerem etichetele PROASPETE, nu ce avea pagina: o tablă lăsată
     deschisă de ieri arată etichetele de ieri, iar între timp poate să fi
     etichetat un elev. Cine se apucă să schimbe trebuie să vadă ce e. */
  const puse = eSchimbare ? await etichetelePuse(id) : [];

  /* Iar în listă intră ȘI etichetele venite de la alte feluri de exercițiu.
     Altfel profesorul le-ar șterge fără să le fi văzut vreodată: ar bifa ce
     vede, ar apăsa, și s-ar duce ce nu vedea. Ce nu are nume frumos în lecție se
     arată cu numele lui scurt: mai bine urât și văzut decât frumos și pierdut. */
  const toate = lista.slice();
  puse.forEach((slug) => {
    if (!toate.some((e) => e.slug === slug)) toate.push({ slug, nume: slug });
  });
  if (!toate.length) return;

  const panou = document.createElement('div');
  panou.className = 'et-panou';
  panou.innerHTML =
    '<p class="et-panou__cap">' + (eSchimbare ? 'Etichetele cuvântului' : 'Ce i se potrivește') + '</p>' +
    toate.map((e) =>
      '<label><input type="checkbox" value="' + escapaText(e.slug) + '"' +
      (puse.includes(e.slug) ? ' checked' : '') + '>' +
      '<span>' + escapaText(e.nume) + '</span></label>').join('') +
    '<div class="et-panou__jos">' +
      '<button type="button" class="et-panou__nu">Lasă</button>' +
      '<button type="button" class="et-panou__da"' + (eSchimbare ? '' : ' disabled') + '>' +
        (eSchimbare ? 'Schimbă etichetele' : 'Pune etichetele') +
      '</button>' +
    '</div>';
  document.body.appendChild(panou);

  const c = semn.getBoundingClientRect();
  panou.style.left = Math.max(8, Math.min(window.innerWidth - panou.offsetWidth - 8, c.left)) + 'px';
  panou.style.top = (window.scrollY + c.bottom + 6) + 'px';

  const da = panou.querySelector('.et-panou__da');
  const bifele = () => Array.from(panou.querySelectorAll('input:checked')).map((i) => i.value);

  /* Un cuvânt fără nicio etichetă nu mai apare în niciun exercițiu, deci ar pieri
     din bancă fără să fie șters. Profesorul are dreptul s-o facă, dar nu pe
     nevăzute: i se spune ce urmează, acolo unde apasă. */
  const vestea = document.createElement('p');
  vestea.className = 'et-panou__rau';
  function cantareste() {
    const câte = bifele().length;
    if (!eSchimbare) { da.disabled = câte === 0; return; }
    if (câte === 0) {
      vestea.textContent = 'Fără nicio etichetă, cuvântul nu mai apare în niciun exercițiu.';
      if (!vestea.parentElement) panou.appendChild(vestea);
    } else if (vestea.parentElement) {
      vestea.remove();
    }
  }
  panou.addEventListener('change', cantareste);
  cantareste();
  panou.querySelector('.et-panou__nu').addEventListener('click', () => panou.remove());

  da.addEventListener('click', async () => {
    const scria = da.textContent;
    da.disabled = true;
    da.textContent = eSchimbare ? 'Se schimbă…' : 'Se pun…';

    const raspuns = eSchimbare
      ? await schimbaEtichetele(id, bifele())
      : await eticheteaza(id, bifele());

    if (raspuns.bine) {
      if (!eSchimbare) etichetateDeja.add(id);
      panou.remove();
      aratăSemneleDeEtichetat();
      return;
    }
    da.textContent = scria;
    da.disabled = false;
    let rau = panou.querySelector('.et-panou__rau');
    if (!rau) {
      rau = document.createElement('p');
      rau.className = 'et-panou__rau';
      panou.appendChild(rau);
    }
    rau.textContent = raspuns.motiv;
  });
}

document.addEventListener('click', (e) => {
  const semn = e.target.closest && e.target.closest('.et-semn');
  if (semn) { deschideEtichetele(semn); return; }
  if (!(e.target.closest && e.target.closest('.et-panou'))) {
    document.querySelectorAll('.et-panou').forEach((p) => p.remove());
  }
});

/* Ce cuvinte de pe tabla asta au fost etichetate de cineva.
   Ținem minte ce am întrebat ultima dată: rândurile se reașază la fiecare
   apăsare de tastă, iar o întrebare la server pentru fiecare literă scrisă ar fi
   o risipă și, mai rău, ar face bifele să pâlpâie. */
let ultimeleCerute = '';
async function afluCeSAEtichetat({ dinNou = false } = {}) {
  const ids = randurile().map((r) => r.dataset.item).filter(Boolean);
  const cheia = ids.slice().sort().join(',');
  /* Desenatul se face de fiecare dată, întrebatul numai când s-a schimbat ceva:
     rândurile se reașază des, dar cuvintele de pe ele, rar. */
  if (ids.length && (dinNou || cheia !== ultimeleCerute)) {
    ultimeleCerute = cheia;
    etichetateDeja = await celeEtichetate(ids);
  }
  if (!ids.length) ultimeleCerute = '';
  aratăSemneleDeEtichetat();
}

(async function porneșteEtichetarea() {
  /* BIFA VERDE SE VEDE LA TOȚI, deci lista cuvintelor lucrate se cere ÎNTOTDEAUNA,
     chiar și pentru un vizitator nelogat. Aici era mai devreme o ieșire devreme,
     din vremea când semnul era unul singur și numai al elevului de la meditații. */
  potSchimbaEtichete = isAdmin();
  await afluCeSAEtichetat();

  potEticheta = await hasPlannerAccess();
  if (!potEticheta) return;
  etichetareaEDeschisa = await eDeschis();
  aratăSemneleDeEtichetat();
  /* Profesorul închide comutatorul TOCMAI ca elevul să se oprească acum, nu la
     următoarea reîncărcare. De-aia semnele pier pe loc, iar fereastra deschisă
     se închide odată cu ele. Bifele verzi rămân: ele nu ascultă de comutator. */
  ascultaComutatorul((val) => {
    etichetareaEDeschisa = val;
    if (!val) document.querySelectorAll('.et-panou').forEach((p) => p.remove());
    aratăSemneleDeEtichetat();
  });
})();

/* ---------- CIORNA ----------

   La exercițiul cu structuri fonetice, elevul dă cuvinte care se potrivesc unei
   structuri. Ca să fie sigur că un cuvânt chiar se potrivește, are nevoie să-l
   analizeze fonetic, adică taman lucrul pe care-l face rândul obișnuit. De-aia
   jos de tot stă un rând clasic, unul singur: e hârtia de pe margine, nu o
   cerință. Nu se numără, nu se poate adăuga altul, iar când vrea să încerce alt
   cuvânt, elevul șterge ce a scris.

   Se salvează totuși odată cu exercițiul. O ciornă care se pierde la închiderea
   filei ar fi o pedeapsă pentru cine s-a oprit din lucru, iar ce a scris acolo
   e tot al lui. */
function aseazaCiorna(date) {
  const ex = exercitiulDeschis();
  /* Ciorna e pentru cine are ce verifica prin analiză fonetică: și structurile,
     și accentul. La celelalte n-ar avea ce căuta. */
  const fel = felDupaFata(ex?.fata);
  const trebuie = fel === 'structura' || fel === 'accent';
  const veche = sheet.querySelector('.ciorna');
  if (veche) veche.remove();
  /* Butonul de șters ciorna se vede numai unde CHIAR e o ciornă: un buton care
     stă mereu pe ecran și uneori n-are ce șterge se învață ca zgomot. */
  const btnCiorna = document.getElementById('clearCiornaBtn');
  if (btnCiorna) btnCiorna.hidden = !trebuie;
  if (!trebuie) return;

  const cutie = document.createElement('div');
  cutie.className = 'ciorna';
  const et = document.createElement('span');
  et.className = 'ciorna__et';
  et.textContent = 'ciornă';
  cutie.appendChild(et);

  const row = createRow('obisnuit');
  row.classList.add('row--ciorna');
  const c = date !== undefined ? date : (ex && ex.ciorna) || null;
  if (c) {
    row.querySelector('.word').innerHTML = c.word || '';
    row.querySelector('.syll').innerHTML = c.syll || '';
    row.querySelector('.trans').innerHTML = c.trans || '';
    imbracaSimboluri(row.querySelector('.trans'));
    row.querySelector('.types').textContent = c.types || '';
  }
  cutie.appendChild(row);
  sheet.appendChild(cutie);
}

/** Ce s-a scris în ciornă. `null` dacă n-are ciornă sau dacă e goală. */
function culegeCiorna() {
  const row = sheet.querySelector('.row--ciorna');
  if (!row) return null;
  const c = {
    word:  (row.querySelector('.word')  || {}).innerHTML || '',
    syll:  (row.querySelector('.syll')  || {}).innerHTML || '',
    trans: (row.querySelector('.trans') || {}).innerHTML || '',
    types: (row.querySelector('.types') || {}).textContent || '',
  };
  const gol = (t) => String(t).replace(/<br\s*\/?>|&nbsp;|\u200b|\s|\[|\]/g, '') === '';
  return (gol(c.word) && gol(c.syll) && gol(c.trans) && gol(c.types)) ? null : c;
}

/** Pune deoparte ce e pe ecran, în exercițiul de care ține. */
function salveazaDeschisul() {
  const ex = exercitiulDeschis();
  if (!ex) return;
  ex.randuri = culegeRanduri();
  const c = culegeCiorna();
  if (c) ex.ciorna = c; else delete ex.ciorna;
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
        nr + '<span class="cer__text">' + (cerintaInHtml(ex) || 'fără cerință') + '</span>' +
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
      : '<div class="cer__data">' + cerintaInHtml(ex) + '</div>';
    return '<div class="cer e-deschisa" data-ex="' + i + '">' +
      '<span class="cer__eticheta">Cerință</span>' + nr +
      '<div class="cer__text">' + corp + '</div>' + semne +
      '<button class="cer__x" data-sterge="' + i + '" title="Șterge exercițiul" aria-label="Șterge exercițiul"></button>' +
      '</div>';
  }).join('');
  potrivesteTeancul();
}

/* ---------- CÂT SE VEDE DIN TEANC, ȘI UNDE E DUS ----------

   Se văd patru cerințe strânse, plus cea deschisă. Mai multe ar mânca locul de
   scris, care e treaba tablei; mai puține și n-ai mai ști ce-ai făcut adineauri.

   Mărginirea era în procente din ecran, 42%, ceea ce însemna cu totul altceva pe
   un ecran lat decât pe unul de laptop: patru rânduri într-un loc, unsprezece în
   altul. Se socotește acum din înălțimea MĂSURATĂ a unui rând strâns, deci peste
   tot se văd tot patru, oricare ar fi ecranul, mărimea literei sau lungimea
   cerinței. Plafonul din foaia de stil rămâne pentru ecranele scunde, unde nici
   patru n-ar încăpea: acolo câștigă cel mai mic dintre cele două.

   Iar teancul se duce singur la cerința deschisă. La douăzeci de exerciții, cea
   la care lucrezi e tocmai jos, iar dacă teancul rămâne unde a fost, te uiți la
   ce ai făcut acum o oră. */
const CATE_STRANSE_SE_VAD = 4;

function potrivesteTeancul() {
  if (!elTeanc) return;
  const strans = elTeanc.querySelector('.cer.e-stransa');
  const desch = elTeanc.querySelector('.cer.e-deschisa');
  if (!strans) { elTeanc.style.maxHeight = ''; return; }

  const gol = parseFloat(getComputedStyle(elTeanc).rowGap) || 0;
  const inalt = strans.getBoundingClientRect().height;
  const inaltD = desch ? desch.getBoundingClientRect().height : 0;
  const cate = CATE_STRANSE_SE_VAD;
  elTeanc.style.maxHeight =
    Math.round(inaltD + (desch ? gol : 0) + cate * inalt + (cate - 1) * gol) + 'px';

  if (!desch) return;
  /* Măsurat din dreptunghiurile de pe ecran, nu din `offsetTop`: acela se ia
     după primul strămoș așezat, iar dacă vreodată se schimbă așezarea teancului,
     socoteala ar ieși greșită fără să se vadă de ce. */
  const t = elTeanc.getBoundingClientRect(), d = desch.getBoundingClientRect();
  const sus = d.top - t.top + elTeanc.scrollTop;
  const jos = sus + d.height;
  if (jos > elTeanc.scrollTop + elTeanc.clientHeight) {
    elTeanc.scrollTop = jos - elTeanc.clientHeight;
  } else if (sus < elTeanc.scrollTop) {
    elTeanc.scrollTop = sus;
  }
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
      /* CE SE IA DE LA TABLA SALVATĂ, se ia TOT.
         Aici se scrie un exercițiu nou din unul citit, câmp cu câmp, iar asta
         are o capcană care nu se vede: un câmp adăugat mai târziu în altă parte
         a codului se salvează cuminte, dar nu se mai întoarce, fiindcă nimeni nu
         l-a trecut și pe lista de mai jos. Așa s-a pierdut o vreme ciorna: era
         scrisă în bază, dar nu ajungea înapoi pe tablă.

         De-aia ce e la fel se copiază cu totul, iar mai jos se îndreaptă numai
         ce chiar trebuie îndreptat pentru tablele vechi. */
      const ex = {
        ...e,
        id: e.id || ('e' + Math.random().toString(36).slice(2, 8)),
        cerinta: bucati[0] || '',
        sursa,
        fata: e.fata || dupaSablon || null,
        tema: !!e.tema,
        cuvinte,
        randuri: Array.isArray(e.randuri) ? e.randuri : [],
      };
      if (!ex.ciorna) delete ex.ciorna;      // o ciornă goală n-are ce căuta
      return ex;
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
/* Plasa din browser e a CONTULUI, nu a calculatorului: vezi `session.js`. */
import { iaLocal, punLocal, isAdmin } from '../../shared/scripts/session.js';

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
/* PLASA E A CONTULUI, NU A CALCULATORULUI.

   Aici a fost o scurgere adevărată: lucrul ținut în browser e al BROWSERULUI,
   nu al omului. Profesorul lucra pe tablă din contul lui, se deconecta, intra un
   elev pe același calculator, și găsea tabla profesorului cu tot ce scrisese el.
   Nimeni nu spărsese nimic: baza își făcuse treaba fără cusur, fiindcă acolo
   fiecare tablă poartă `user_id` și e păzită de politici. Scurgerea era în plasa
   de siguranță, care nu întrebase niciodată AL CUI e ce ține.

   `punLocal` și `iaLocal` pun numele contului la coada cheii, deci două conturi
   de pe același calculator nici măcar nu se uită în același sertar. */
function saveStateLocal() {
  punLocal('fonetica_state', collectState());
}
function loadStateLocal() {
  return iaLocal('fonetica_state', null);
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
  /* Sertarul din stânga poartă numărul tablelor salvate. Dacă tocmai s-a făcut
     una nouă, numărul trebuie să se schimbe pe loc: altfel fila ar minți până
     la următoarea deschidere a paginii, iar o cifră care minte e mai rea decât
     niciuna. */
  aratăTablele();
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
function intreaba({ titlu, text = '', camp = null, buton = 'Salvează', verifica = null,
                    primejdie = false }) {
  /* Numai ștergerea tablei tresare. O întrebare care se deschide lin se citește
     ca o formalitate, iar mâna apasă „da" înainte s-o citească. */
  dlg.classList.toggle('e-primejdie', !!primejdie);
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

/* Clic pe fundal = renunțare. Îl face `inchideLaClicInAfara`, pus mai jos pe
   toate ferestrele tablei deodată. Aici era o pereche de-a lui care se uita la
   `e.target`: acela însă spune „fereastra" și pentru clicul din afară, și
   pentru cel de pe marginea dinăuntru, deci închidea uneori și când n-ar fi
   trebuit. Renunțarea rămâne: `returnValue` e pus pe „nu" înainte de fiecare
   deschidere, așa că orice închidere fără apăsare pe „Da" e o renunțare. */

/* ---------- sertarul „Tablele mele" ----------

   Stă pe marginea din stânga, la jumătatea înălțimii, și se vede MEREU: din el
   iese o filă îngustă cu o săgeată. Era mai devreme o casetă chemată din meniul
   „⋯", iar acolo era greșeala. Un lucru ascuns într-un meniu e un lucru pe care
   jumătate dintre elevi nu-l află niciodată; o filă care iese din marginea
   ecranului nu-ți spune ce e, dar îți spune CĂ E, iar de-aici încolo se
   descurcă singură curiozitatea.

   Se deschide la CLIC, nu la trecerea mouse-ului. La hover s-ar fi deschis
   singură ori de câte ori mâna trecea spre stânga, adică taman când elevul
   scrie, iar un panou care apare nechemat peste tablă e mai supărător decât
   unul care se lasă apăsat. */
const boardsPanel = document.getElementById('boardsPanel');
const boardsBody  = document.getElementById('boardsBody');
const boardsFila  = document.getElementById('boardsFila');
const boardsCat   = document.getElementById('boardsCat');
const boardsForma = document.getElementById('boardsForma');
const boardsSticla = document.getElementById('boardsSticla');

/* ---------- PICĂTURA DE STICLĂ ----------

   Stă lipită de marginea din stânga și SIMTE CURSORUL: cu cât te apropii, cu
   atât se întinde spre el, cu un gât subțire și o bobiță în vârf, ca două
   picături de mercur care se caută. Apăsată, se rupe și iese panoul.

   GÂTUL NU E FĂCUT CU FILTRU. Trucul obișnuit (o neclaritate peste un contrast
   mare) lipește două forme una de alta, dar topește și sticla din spate, iar din
   picătură ar fi ieșit o pată tulbure. Aici gâtul se SOCOTEȘTE: două arce
   tangente la amândouă cercurile, adică chiar felul în care se leagă două
   picături adevărate. Iese curat, e ieftin, și merge la fel oriunde.

   Socoteala e cea știută pentru „metaballs": din unghiul dintre centre și din
   raze ies patru puncte de plecare pe cele două cercuri, iar între ele se trag
   două curbe care le racordează. Când bobița e încă înghițită de trup, unghiurile
   se strâng singure și forma redevine o picătură simplă: nu e nevoie de niciun
   `if` care să spună „acum sunt lipite".
*/
const TRUP_X = -4, TRUP_Y = 80, TRUP_R = 24;   // trupul, pe jumătate dincolo de margine
const GAT = 4;                                  // cât stă bobița lipită de trup în repaus
const BOB_R = 6, BOB_CREȘTE = 3;                // bobița: cât e și cât se umflă

const punct = (p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1);
const spre = (cx, cy, a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

function cercul(cx, cy, r) {
  return `M ${punct([cx - r, cy])} A ${r} ${r} 0 1 0 ${punct([cx + r, cy])}` +
         ` A ${r} ${r} 0 1 0 ${punct([cx - r, cy])} Z`;
}

/** Conturul a două picături legate printr-un gât. */
function douaPicaturi(ax, ay, r1, bx, by, r2) {
  const dx = bx - ax, dy = by - ay;
  const d = Math.hypot(dx, dy);
  /* Una înghițită cu totul de cealaltă: n-are ce racorda, rămâne un cerc. */
  if (d === 0 || d <= Math.abs(r1 - r2)) return cercul(ax, ay, Math.max(r1, r2));

  let u1 = 0, u2 = 0;
  if (d < r1 + r2) {                      // cercurile se ating: unghiul de intrare
    u1 = Math.acos((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d));
    u2 = Math.acos((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d));
  }
  const intre = Math.atan2(dy, dx);
  const maxim = Math.acos((r1 - r2) / d);
  const v = 0.5, marime = 2.4;            // cât de „moale" e racordarea
  const a1 = intre + u1 + (maxim - u1) * v;
  const a2 = intre - u1 - (maxim - u1) * v;
  const a3 = intre + Math.PI - u2 - (Math.PI - u2 - maxim) * v;
  const a4 = intre - Math.PI + u2 + (Math.PI - u2 - maxim) * v;
  const p1 = spre(ax, ay, a1, r1), p2 = spre(ax, ay, a2, r1);
  const p3 = spre(bx, by, a3, r2), p4 = spre(bx, by, a4, r2);
  const tot = r1 + r2;
  const cat = Math.min(v * marime, Math.hypot(p1[0] - p3[0], p1[1] - p3[1]) / tot) *
              Math.min(1, d * 2 / tot);
  const h1 = spre(p1[0], p1[1], a1 - Math.PI / 2, r1 * cat);
  const h2 = spre(p2[0], p2[1], a2 + Math.PI / 2, r1 * cat);
  const h3 = spre(p3[0], p3[1], a3 + Math.PI / 2, r2 * cat);
  const h4 = spre(p4[0], p4[1], a4 - Math.PI / 2, r2 * cat);
  const ocol = d > r1 ? 1 : 0;
  return `M ${punct(p1)} C ${punct(h1)} ${punct(h3)} ${punct(p3)}` +
         ` A ${r2} ${r2} 0 ${ocol} 0 ${punct(p4)}` +
         ` C ${punct(h4)} ${punct(h2)} ${punct(p2)}` +
         ` A ${r1} ${r1} 0 ${ocol} 0 ${punct(p1)} Z`;
}

/** Conturul picăturii, întinsă cu `catAtrasa` (0…1) în direcția `unghi`. */
function conturulPicaturii(catAtrasa, unghi) {
  const d = TRUP_R + GAT + INTINDERE * catAtrasa;
  const r2 = BOB_R + BOB_CREȘTE * catAtrasa;
  return douaPicaturi(TRUP_X, TRUP_Y, TRUP_R,
                      TRUP_X + d * Math.cos(unghi), TRUP_Y + d * Math.sin(unghi), r2);
}

/* Cât de departe simte cursorul și cât se poate întinde: scrise în foaia de
   stil, ca să se poată încerca alte valori fără să umbli prin socoteli. */
function dinStil(nume, altfel) {
  if (!boardsPanel || !window.getComputedStyle) return altfel;
  const v = parseFloat(getComputedStyle(boardsPanel).getPropertyValue(nume));
  return Number.isFinite(v) ? v : altfel;
}
const RAZA = dinStil('--raza', 130);
const INTINDERE = dinStil('--intindere', 30);

/* ȘTIE BROWSERUL SĂ TAIE PE O FORMĂ? Sticla se taie cu `clip-path: path()`.
   Dacă n-o știe, stratul de sticlă ar fi rămas un dreptunghi tulbure peste
   tablă, adică o pată. Atunci îl ascundem cu totul: rămâne conturul desenat,
   care se poartă la fel, doar că fără ciob. Pierdem sticla, nu unealta. */
const STIE_FORMA = !!(window.CSS && CSS.supports &&
                      CSS.supports('clip-path', 'path("M 0 0 L 1 1 Z")'));
if (boardsPanel && STIE_FORMA) boardsPanel.classList.add('stie-forma');

let atrasaAcum = 0, unghiulAcum = 0;
let firulPicaturii = 0;

function deseneazaPicatura() {
  if (!boardsForma) return;
  const d = conturulPicaturii(atrasaAcum, unghiulAcum);
  boardsForma.setAttribute('d', d);
  if (boardsSticla && STIE_FORMA) boardsSticla.style.clipPath = `path('${d}')`;
}

/* Unde stă trupul picăturii pe ecran, ca să știm de unde se măsoară cursorul.
   Se cere de la browser, nu se socotește din cifre: sertarul se dă la o parte
   când e deschis, iar o socoteală paralelă ar fi rămas în urmă. */
function undeStaTrupul() {
  if (!boardsPanel) return { x: 0, y: 0 };
  const c = boardsPanel.getBoundingClientRect();
  return { x: c.left + TRUP_X + (sertarulEDeschis() ? latimeaPanoului() : 0), y: c.top + TRUP_Y };
}
function latimeaPanoului() {
  const corp = boardsPanel && boardsPanel.querySelector('.sertar__corp');
  return corp ? corp.getBoundingClientRect().width : 0;
}

const PUTIN_MISCA = () => window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let cursorul = null;
function socotestePicatura() {
  firulPicaturii = 0;
  const trup = undeStaTrupul();
  let tinta = 0;
  if (cursorul) {
    const dx = cursorul.x - trup.x, dy = cursorul.y - trup.y;
    const departe = Math.hypot(dx, dy);
    if (departe < RAZA) {
      /* Descreștere lină, nu liniară: aproape de picătură atracția e mare și
         scade repede, iar la marginea razei se stinge de tot, fără prag. */
      const t = 1 - departe / RAZA;
      tinta = t * t;
      unghiulAcum = Math.atan2(dy, dx);
    }
  }
  /* Se merge spre țintă, nu se sare pe ea: altfel picătura ar tresări la
     fiecare mișcare mai iute a mâinii. */
  atrasaAcum += (tinta - atrasaAcum) * 0.22;
  if (Math.abs(tinta - atrasaAcum) < 0.002) atrasaAcum = tinta;
  deseneazaPicatura();
  if (atrasaAcum !== 0 || tinta !== 0) firulPicaturii = requestAnimationFrame(socotestePicatura);
}

function porneșteFirul() {
  if (!firulPicaturii && !PUTIN_MISCA()) firulPicaturii = requestAnimationFrame(socotestePicatura);
}

if (boardsForma) {
  deseneazaPicatura();
  window.addEventListener('pointermove', (e) => {
    cursorul = { x: e.clientX, y: e.clientY };
    porneșteFirul();
  }, { passive: true });
  /* Mâna plecată de pe ecran e tot o depărtare: picătura se strânge la loc. */
  window.addEventListener('pointerleave', () => { cursorul = null; porneșteFirul(); });
}

function sertarulEDeschis() { return !!(boardsPanel && boardsPanel.classList.contains('open')); }

function inchideSertarul() {
  if (!boardsPanel) return;
  boardsPanel.classList.remove('open');
  boardsPanel.setAttribute('aria-hidden', 'true');
  if (boardsFila) boardsFila.setAttribute('aria-expanded', 'false');
}

function deschideSertarul() {
  if (!boardsPanel) return;
  boardsPanel.classList.add('open');
  boardsPanel.setAttribute('aria-hidden', 'false');
  if (boardsFila) boardsFila.setAttribute('aria-expanded', 'true');
  aratăTablele();
}

boardsFila && boardsFila.addEventListener('click', (e) => {
  e.stopPropagation();
  if (sertarulEDeschis()) inchideSertarul(); else deschideSertarul();
});

/* Trei feluri de a-l închide, fiindcă un sertar deschis peste tablă trebuie să
   plece ușor: butonul lui, Escape, ori un clic oriunde în afară. Clicul pe filă
   nu se numără „în afară", altfel s-ar închide și s-ar redeschide într-o
   singură apăsare. */
document.addEventListener('click', (e) => {
  if (!sertarulEDeschis()) return;
  if (e.target.closest && e.target.closest('#boardsPanel')) return;
  inchideSertarul();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') inchideSertarul(); });

/* Câte table sunt salvate, scris mărunt pe filă. Nu e o veste importantă, e doar
   un semn că înăuntru chiar e ceva: fără el, fila ar fi o ușă despre care nu se
   știe dacă dă în vreo cameră. Lipsește când nu e nimic, fiindcă un zero nu
   spune decât „gol", iar asta o spune mai bine tăcerea. */
function scrieCateTable(cate) {
  if (!boardsCat) return;
  boardsCat.textContent = cate > 0 ? String(cate) : '';
}

function candSalvat(iso) {
  const d = new Date(iso), azi = new Date();
  const ceas = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === azi.toDateString()) return 'azi, ' + ceas;
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }) + ', ' + ceas;
}

async function aratăTablele() {
  boardsBody.innerHTML = '<p class="boards-empty">Se încarcă…</p>';
  const lista = await listSheets(LECTIE);
  /* Numărul de pe filă se scrie ORICUM se ajunge aici: la deschidere, după o
     salvare, după o ștergere. Ținut într-un singur loc, nu se poate întâmpla ca
     un drum nou să-l uite. */
  scrieCateTable(lista.length);
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

  if (id === tabla.id) { inchideSertarul(); return; }   // e deja deschisă

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
  inchideSertarul();
});

/* PDF: deschide dialogul de printare (de acolo alegi „Salvează ca PDF") */
document.getElementById('pdfBtn').addEventListener('click', () => { inchideMeniu(); window.print(); });

/* Șterge tot: cerința + toate rândurile (notițele și simbolurile rămân) */
/* ============================================================
   TREI ȘTERGERI, DUPĂ CÂT DOR

   Sunt trei lucruri deosebite, iar dacă ar avea un singur buton, elevul ar
   trebui să aleagă de fiecare dată cu grijă ce n-ar trebui să-l coste nicio
   grijă. Așa că fiecare are butonul lui, iar paza e pe măsura pagubei:

     · CIORNA e o hârtie de pe margine. Se șterge fără nicio vorbă, cu putință
       de întors, fiindcă tocmai de-aia o șterge: ca să încerce alt cuvânt.
     · REZOLVĂRILE sunt munca lui de acum. Nici aici nu întrebăm, dar are cinci
       secunde să se răzgândească: o întrebare pusă înaintea fiecărei ștergeri
       ajunge să fie apăsată fără să fie citită, pe când o cale de întors e
       citită abia atunci când chiar e nevoie de ea.
     · TABLA ÎNTREAGĂ e altceva: acolo se duce și ce a adus profesorul, și tot
       ce a lucrat el, la toate exercițiile. Aceea întreabă, iar fereastra
       tresare.

   CE ÎNSEAMNĂ „REZOLVARE". Fiecare rând are un cap și o urmare: capul e ce se
   cere (cuvântul de analizat, structura, propoziția), urmarea e ce răspunde
   elevul. Ștergerea rezolvărilor golește urmarea și lasă capul, la toate cele
   trei feluri de rând, fie că a venit de la generator, fie că l-a scris el.
   ============================================================ */

/** Rândul, curățat de tot ce a răspuns elevul; capul lui rămâne. */
function faraRezolvare(r) {
  /* `itemId` trece mai departe de la sine, prin `...r`: e legătura cu banca, nu
     o rezolvare, deci n-are ce căuta printre lucrurile care se șterg. */
  if (!r) return r;
  if (r.accentuat !== undefined) return { ...r, accentuat: '', sens: '', exemplu: '' };
  if (r.structura !== undefined) return { ...r, syll: '', raspuns: [] };
  if (r.fraza !== undefined) return { ...r, trans: '' };
  return { ...r, syll: '', trans: '', types: '', extra: (r.extra || []).map(() => '') };
}

/* ---------- Calea de întors ----------
   Cinci secunde. Nu e o politețe, e ce ține locul întrebării pe care n-o mai
   punem: o întrebare pusă înaintea fiecărei ștergeri ajunge apăsată fără să fie
   citită, pe când o cale de întors e citită abia atunci când chiar e nevoie. */
const SECUNDE_DE_INTORS = 5;
let elIntors = null;

function potIntoarce(text, inapoi) {
  if (!elIntors) {
    elIntors = document.createElement('div');
    elIntors.className = 'intors';
    elIntors.setAttribute('role', 'status');
    document.body.appendChild(elIntors);
  }
  elIntors.innerHTML = '';
  const spus = document.createElement('span');
  spus.textContent = text;
  const buton = document.createElement('button');
  buton.type = 'button';
  buton.className = 'intors__buton';
  buton.textContent = 'Adu înapoi';
  elIntors.appendChild(spus);
  elIntors.appendChild(buton);
  elIntors.hidden = false;
  requestAnimationFrame(() => elIntors.classList.add('e-vazut'));

  const stinge = () => {
    clearTimeout(potIntoarce._t);
    elIntors.classList.remove('e-vazut');
    setTimeout(() => { if (elIntors) elIntors.hidden = true; }, 220);
  };
  buton.addEventListener('click', () => { inapoi(); stinge(); }, { once: true });
  clearTimeout(potIntoarce._t);
  potIntoarce._t = setTimeout(stinge, SECUNDE_DE_INTORS * 1000);
}

/* ---------- 1. Ciorna ---------- */
document.getElementById('clearCiornaBtn').addEventListener('click', () => {
  const ex = exercitiulDeschis();
  const vechi = culegeCiorna();
  if (!ex || !vechi) return;
  delete ex.ciorna;
  aseazaCiorna(null);
  murdareste(); scheduleSave();
  potIntoarce('Ciorna a fost ștearsă.', () => {
    const acum = exercitiulDeschis();
    if (!acum) return;
    acum.ciorna = vechi;
    aseazaCiorna(vechi);
    murdareste(); scheduleSave();
  });
});

/* ---------- 2. Rezolvările exercițiului deschis ---------- */
document.getElementById('clearSolvedBtn').addEventListener('click', () => {
  const ex = exercitiulDeschis();
  if (!ex) return;
  salveazaDeschisul();
  const vechi = { randuri: JSON.parse(JSON.stringify(ex.randuri || [])),
                  ciorna: ex.ciorna ? { ...ex.ciorna } : null };
  ex.randuri = (ex.randuri || []).map(faraRezolvare);
  aseazaRanduri(ex.randuri);
  deseneazaTeancul();
  murdareste(); scheduleSave();
  potIntoarce('Rezolvările au fost șterse.', () => {
    const acum = exercitiulDeschis();
    if (!acum) return;
    acum.randuri = vechi.randuri;
    if (vechi.ciorna) acum.ciorna = vechi.ciorna; else delete acum.ciorna;
    aseazaRanduri(acum.randuri);
    deseneazaTeancul();
    murdareste(); scheduleSave();
  });
});

/* ---------- 3. Toată tabla ---------- */
document.getElementById('clearBtn').addEventListener('click', async () => {
  if (!await intreaba({
        titlu: 'Ștergi toată tabla?',
        text: 'Se duc TOATE exercițiile, cu cerințele și cu tot ce ai rezolvat la ele. ' +
              'Notițele și simbolurile rămân. Ștergerea asta nu se mai poate întoarce.',
        buton: 'Șterge tabla',
        primejdie: true,
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
/* Numărul de pe fila sertarului se află de la bun început, nu abia când îl
   deschizi: o filă fără cifră ar arăta ca o ușă despre care nu se știe dacă dă
   în vreo cameră, iar elevul n-are de ce s-o deschidă ca să afle. */
aratăTablele();
const firstField = sheet.querySelector('.field');
if (firstField) placeCaret(firstField, true);

/* ============================================================
   ZARUL, GENERATORUL ȘI BANCA

   Trei lucruri legate între ele: zarul spune CE fel de exercițiu, banca ține
   materialul, generatorul le pune la un loc și umple tabla.
   ============================================================ */
import { fataUrmatoare, INTOARCERI, aruncaSpre, laClipa, unghiuriDinQ,
         pornire, pas, inclina }
  from './zar-fizica.js';
import { listItems, etichetelePuse, schimbaEtichetele } from '../../shared/scripts/bank-repo.js';
import { hasPlannerAccess } from '../../shared/scripts/planner-repo.js';
import { eDeschis, ascultaComutatorul, eticheteaza, celeEtichetate }
  from '../../shared/scripts/tagging-repo.js';
import { felulExercitiului, altele, felulMaterialului, seCuvineEticheta, deCeCereEticheta,
         eticheteleFelului }
  from '../../shared/scripts/board-material.js';

/* ---------- Zarul ---------- */
const elTavita  = document.getElementById('zarTavita');
const elZar     = document.getElementById('zar');
const elUmbra   = document.getElementById('zarUmbra');
const elVestire = document.getElementById('zarVestire');

let ultimaFata = null;      // ca să nu iasă de două ori la rând aceeași
let seRostogoleste = false;

/* ZARUL DE STICLĂ, DACĂ SE POATE.
   Se aduce târziu și pe tăcute: pagina se deschide cu zarul din CSS, gata de
   apăsat, iar dacă biblioteca ajunge, ea îi ia locul fără să se vadă vreo
   clipire. Dacă nu ajunge (fără rețea, fără WebGL, calculator vechi), rămâne
   cel din CSS și nimeni nu vede vreo eroare. */
let zar3d = null;

(async () => {
  if (!elTavita || !elZar) return;

  /* Până se știe ce se desenează, tăvița stă în așteptare: nici lemn din foaia
     de stil, nici scenă. Altfel s-ar vedea desenul vechi pentru o clipă, la
     fiecare deschidere de pagină.

     Ceasul de mai jos e plasa: dacă biblioteca nu vine într-un timp omenesc
     (rețea proastă, CDN căzut), pornim zarul simplu. Mai bine unul care merge
     decât o casetă goală la nesfârșit. */
  let raspuns = false;
  const ceas = setTimeout(() => {
    if (!raspuns) elTavita.classList.add('e-css');
  }, 6000);

  try {
    const { pornesteZar3D } = await import('./zar-3d.js');
    zar3d = await pornesteZar3D(elTavita, { marime: 38, latura: 150 });
  } catch (e) {
    zar3d = null;
  }
  raspuns = true;
  clearTimeout(ceas);

  if (!zar3d) { elTavita.classList.add('e-css'); return; }

  // Din clipa asta tăvița e desenată de scenă, nu de foaia de stil, iar toată
  // suprafața ei devine buton: e mai ușor de nimerit decât un cub de 46 de px.
  elTavita.classList.remove('e-css');
  elTavita.classList.add('e-3d');
  zar3d.potriveste(elTavita.clientWidth || 150);
  asazaZarul(0, 0, 0, 0, 0);
})();

/* Tăvița se micșorează pe telefon: pânza o urmează. */
window.addEventListener('resize', () => {
  if (!zar3d || !elTavita) return;
  clearTimeout(window.__zarPotrivire);
  window.__zarPotrivire = setTimeout(() => zar3d.potriveste(elTavita.clientWidth || 150), 120);
});

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

  /* Când desenează scena, locul se dă ADUS LA UNU, nu în pixeli: scena are
     mărimea ei, tăvița pe a ei, iar între ele nu vreau nicio socoteală de
     pixeli care să se strice la alt ecran. */
  if (zar3d) {
    const L = elTavita ? (elTavita.clientWidth || 150) : 150;
    zar3d.aseaza(x / margineaDrumului(L), y / margineaDrumului(L), h / L, rx, ry);
    return;
  }

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

/* CÂT DE MARE E ZARUL ȘI PÂNĂ UNDE POATE MERGE.

   Două socoteli de care se leagă și fizica, și desenul, deci se fac o singură
   dată, aici. Cu zarul din CSS le știm din pagină: butonul CHIAR e zarul. Cu
   scena, butonul e cât toată caseta, iar caseta e mai mare decât lemnul (are
   marginea dinăuntru), așa că mărimea zarului n-o mai putem citi din pagină:
   ne-o spune scena, prin `razaInCaseta`.

   Erau, până adineauri, două numere scrise de mână care trebuiau să se
   potrivească între două fișiere. Aveam să le uit pe amândouă. */
const razaZarului = (latime) =>
  (zar3d ? latime * zar3d.razaInCaseta : elZar.offsetWidth / 2) + 4;

/* ÎNCETINIREA e o hotărâre de PRIVIRE, nu de fizică.
   Un zar de mărimea asta într-o tăviță de mărimea asta chiar se oprește în
   jumătate de secundă; așa e drept, fiindcă zarul e mare față de cutie. Dar pe
   ecran o jumătate de secundă trece prea repede ca să se vadă ce s-a întâmplat.
   Îl privim deci ca la reluarea unui meci, cu aceeași mișcare adevărată, doar
   desfășurată mai încet. Nicio lege nu e atinsă.

   E aici, la vedere, fiindcă o folosesc trei locuri: aruncarea, lunecarea pe
   pantă și întoarcerea din praștie. Dacă ar avea fiecare ceasul lui, s-ar
   vedea numaidecât că nu-i același zar. */
const INCETINIRE = 1.8;

/** Cutia în care socotește fizica, în chiar unitățile scenei. */
function cutiaZarului() {
  const L = elTavita ? (elTavita.clientWidth || 150) : 150;
  return zar3d
    ? { latura: zar3d.interior, zar: zar3d.marimeaZarului }
    : { latura: L * 0.85, zar: L * 0.31 };
}

/** Până unde poate ajunge MIJLOCUL zarului, în pixeli de casetă. */
const margineaDrumului = (latime) => Math.max(1, latime / 2 - razaZarului(latime));

/* ZARUL LUAT CU DEGETUL.

   Îl apeși, îl plimbi pe tăviță, îi dai drumul, iar el pleacă încotro l-ai
   împins și cu ce putere l-ai împins. Cât îl ții, se rostogolește sub deget, în
   jurul mersului tău: asta e ce face un zar plimbat pe masă.

   Cheia e că nu inventăm nimic la sfârșit: la ridicarea degetului socotim
   avântul din ultimele clipe de mișcare și îl dăm fizicii ca pornire. Dacă
   n-ai mișcat deloc, e o simplă apăsare, iar zarul pleacă cum pleca și înainte.

   `aruncatCuMana` e locul unde așteaptă pornirea până o ia aruncarea. */
let aruncatCuMana = null;

/* AMESTECUL A FOST SCOS, ȘI E BINE CĂ A FOST SCOS.

   Aveam aici o „frământare în palmă": la fiecare aruncare, zarul se zbătea pe
   loc o jumătate de secundă, învârtindu-se de vreo patru ori pe secundă. Era
   invenția mea, nu mișcarea nimănui. De-aia se vedea fals: îl luai blând, îl
   lăsai blând, iar el pornea ca un titirez, fiindcă rotirea nu venea de la
   degetul tău, ci de la mine.

   Acum rotirea vine de unde vine și în lume: din mâna care merge în clipa
   lăsării. Îl lași din loc, abia se clatină; îl azvârli, se rostogolește de
   câteva ori. Nimic între tine și zar. */

async function aruncaZarul() {
  if (seRostogoleste || !elZar || !elTavita) return;
  const fata = fataUrmatoare(ultimaFata);
  ultimaFata = fata;

  if (faraMiscare()) {
    const t = INTOARCERI[fata];
    asazaZarul(0, 0, 0, t.rx, t.ry);
    if (zar3d) { zar3d.stramt(); zar3d.asazaFata(fata, 1); }
    zarulOprit = null;                    // s-a mutat altcineva: o luăm din scenă
    gataAruncarea(fata);
    return;
  }

  seRostogoleste = true;

  /* LOC PENTRU SĂRITURI.
     Zarul care ricoșează urcă peste marginea casetei, și acolo se tăia. Îi dau
     un pătrat de două ori și ceva cât caseta, cât ține rostogolirea: e
     destul pentru orice săritură, și e destul de mic cât desimea desenului să
     deci nu se clatină nimic. */
  if (zar3d) zar3d.larg(3.8);

  /* CUTIA ÎN CARE SE PETRECE TOTUL.
     Când desenează scena, fizica lucrează chiar în unitățile ei: pereții sunt
     acolo unde se văd, zarul are mărimea pe care o vezi. Nu mai e nicio
     socoteală de trecut între model și desen, deci nici loc de nepotriviri.
     Fără scenă, tăvița din CSS are aceleași proporții, doar în pixeli de-ai ei. */
  const L = elTavita.clientWidth || 150;
  const cutie = cutiaZarului();

  /* Fața o alegem noi (ca să nu iasă de două ori la rând aceeași), dar NU
     îndreptăm nimic pe drum: `aruncaSpre` aruncă cinstit și alege doar CUM a
     fost ținut zarul în palmă înainte de aruncare. */
  const drumul = aruncaSpre(cutie, fata, { deLa: aruncatCuMana });
  aruncatCuMana = null;

  const porni = performance.now();
  const jumatateaScenei = zar3d ? 0 : L / 2;

  function cadru(acum) {
    const secunde = ((acum - porni) / 1000) / INCETINIRE;
    const unde = laClipa(drumul, secunde);

    if (zar3d) {
      zar3d.aseazaBrut(unde.r, unde.q);
    } else {
      const u = unghiuriDinQ(unde.q);
      asazaZarul(unde.r.x, unde.r.z, Math.max(0, unde.r.y - cutie.zar / 2), u.rx, u.ry);
    }

    if (!unde.gata) { requestAnimationFrame(cadru); return; }

    if (!zar3d) {
      const fin = INTOARCERI[fata];
      elZar.style.transition = 'transform .42s cubic-bezier(.22,.9,.3,1)';
      asazaZarul(unde.r.x, unde.r.z, 0, fin.rx, fin.ry);
      setTimeout(() => {
        elZar.style.transition = 'none'; seRostogoleste = false; gataAruncarea(fata);
      }, 430);
      return;
    }
    seRostogoleste = false;
    /* Abia acum se strânge pânza la loc, nu la plecare: cât se rostogolește,
       zarul sare peste marginea casetei, iar o pânză strânsă i-ar tăia
       sărituta într-un chenar. */
    zar3d.stramt();
    /* Zarul oprit rămâne un CORP, nu o poză: de-aici încolo poate să lunece
       dacă tăvița se lasă sub el. */
    zarulOprit = drumul.sfarsit;
    gataAruncarea(fata);
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
  aPicatOData = true;
  trezesteTavita();

  /* EXERCIȚIUL NU SE MAI FACE AICI, ȘI ĂSTA E MIEZUL.

     Se făcea, iar dacă omul apăsa „Renunță" ori dădea clic în afară, pe tablă
     rămânea un exercițiu gol, cu cerință și fără nimic în el. Greșeala nu era în
     fereastră, ci în ordine: aruncarea zarului nu e o HOTĂRÂRE, e o ÎNTREBARE.
     „Ți-a picat 3, faci exercițiul ăsta?" Iar dintr-o întrebare nu se naște
     nimic până nu i se răspunde.

     Deci fața trăiește deocamdată doar aici, într-o singură variabilă, iar
     exercițiul se naște abia la „Generează". Renunțarea nu mai are ce curăța,
     fiindcă nu s-a făcut nimic de curățat: e mai bine decât o curățenie, care
     s-ar fi putut și uita. */
  fataDinZar = fata;

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

  /* Aici, în plasă, exercițiul CHIAR se face: fereastra n-a putut întreba, deci
     n-are cine răspunde, iar fața s-ar pierde cu totul. E singurul loc în care
     zarul mai hotărăște singur, și numai fiindcă altfel aruncarea ar fi fost
     degeaba. */
  try {
    adaugaExercitiu({ sursa: 'zar', fata });
    fataDinZar = null;
  } catch (e) {
    console.error('exercițiul de la zar nu s-a putut face:', e);
  }
  vesteste(fata);
  cheamaGeneratorul();
}

/* ============================================================
   ZARUL LUNECĂ PE PANTĂ

   Tăvița se lasă sub deget cu 18 grade, adică mai mult decât unghiul de la care
   un corp pornește la vale (16,7 grade, `arctg(0,30)`). Ar fi fost o minciună
   mare să se încline atât și zarul să stea neclintit, ca lipit. Așa că nu mai e
   o poză: zarul rămâne un CORP și după ce s-a oprit, iar cât tăvița e strâmbă
   fizica merge mai departe, în timp adevărat.

   Nu i-am spus nicăieri „lunecă". I-am spus doar încotro trage greutatea, prin
   `inclina`, iar restul iese din același rezolvitor de atingeri ca la aruncare:
   sub prag frecarea îl ține, peste prag conul lui Coulomb n-o mai poate face și
   zarul pleacă. De-aia pragul se și SIMTE cu degetul: pe la mijlocul tăviței
   zarul se ține, spre colț se urnește.

   Bucla se stinge singură în clipa în care zarul a adormit, ca să nu desenăm
   degeaba; o repornește orice mișcare de deget, fiindcă orice mișcare de deget
   schimbă panta.
   ============================================================ */

/* ---------- TĂVIȚA CARE ADOARME ----------

   După ce zarul a picat o dată, tăvița și-a spus ce avea de spus. De-aici
   încolo elevul se uită la exercițiul lui, nu la ea, iar un lucru care rămâne
   aprins după ce și-a făcut treaba nu mai e o unealtă, e o distragere. Se
   retrage deci la o zecime, și se trezește la orice atingere.

   Rămâne trează câteva secunde DUPĂ ce degetul a plecat, nu se stinge pe loc:
   altfel s-ar întuneca exact sub mâna care se întoarce spre ea, iar asta se
   citește ca o unealtă care fuge, nu ca una care se odihnește. */
const SOMNUL_TAVITEI = 3500;      // milisecunde de veghe după ultima atingere
let aPicatOData = false;          // până atunci tăvița stă trează, că n-a lucrat

function seCulcaTavita(da) {
  if (!elTavita) return;
  /* Semnul se pune ori pe pânză, ori pe tăviță, niciodată pe amândouă: cât e
     scenă, pânza pleacă din tăviță în `body`, iar două opacități una într-alta
     s-ar înmulți. */
  const unde = zar3d ? zar3d.panza : elTavita;
  unde.classList.toggle('e-somn', da);
  if (zar3d) elTavita.classList.remove('e-somn');
}

function trezesteTavita() {
  if (!aPicatOData) return;
  seCulcaTavita(false);
  clearTimeout(trezesteTavita._t);
  trezesteTavita._t = setTimeout(() => seCulcaTavita(true), SOMNUL_TAVITEI);
}

/** Starea fizică a zarului care stă în tăviță. `null` = trebuie luată din scenă. */
let zarulOprit = null;
/** E ținut de deget chiar acum? Atunci nu lunecă nicăieri: îl ții. */
let zarInMana = false;

/** Zarul oprit, luat din scenă: unde stă și cum e întors chiar acum. */
function zarulDinScena() {
  const cutie = cutiaZarului();
  const st = pornire(cutie, {
    deLa: { x: 0, z: 0, h: 0, vx: 0, vz: 0, vy: 0, wx: 0, wy: 0, wz: 0 },
  });
  const o = zar3d.locul();
  st.r = { x: o.r.x, y: cutie.zar / 2, z: o.r.z };
  st.q = { ...o.q };
  st.v = { x: 0, y: 0, z: 0 };
  st.w = { x: 0, y: 0, z: 0 };
  st.liniste = 0;
  st.doarme = true;                 // doarme până îl trezește o pantă adevărată
  return st;
}

/* CÂT LOC ÎI TREBUIE TĂVIȚEI CÂND SE LEAGĂNĂ.
   La 38 de grade și 30 de unități de urnit, colțul ei ajunge la vreo 140 de
   unități de mijloc, iar caseta ține numai 90: s-ar tăia. Pânza se face deci
   ceva mai lată cât ține legănatul, și se strânge la loc când tăvița s-a
   îndreptat și zarul a adormit. La mărimea asta desimea rămâne întreagă. */
const LARG_LEGANAT = 1.9;

function leagana() {
  if (!zar3d || leagana._merge) return;
  leagana._merge = true;
  let ultima = performance.now();
  /* CÂND ZARUL A AJUNS ÎN COLȚ ȘI SE PROPTEȘTE ÎN PERETE, panta îl trezește la
     fiecare cadru (pe drept: chiar e pe pantă), el nu se poate duce nicăieri, și
     adoarme iar. S-ar învârti așa cât ții degetul acolo, desenând degeaba. De-aia
     număr cadrele în care n-a mai mișcat nimic și mă opresc: e o oprire de
     socoteală, nu de fizică, iar orice mișcare de deget o pornește la loc. */
  let nemiscat = 0;
  (function cadru(acum) {
    const real = Math.min(0.05, (acum - ultima) / 1000);
    ultima = acum;
    if (!zar3d || seRostogoleste || zarInMana) { leagana._merge = false; return; }

    if (!zarulOprit) zarulOprit = zarulDinScena();
    const u = zar3d.inclinarea();
    const strambata = Math.abs(u.x) > 0.003 || Math.abs(u.z) > 0.003;
    if (strambata) zar3d.larg(LARG_LEGANAT);
    const unde = { x: zarulOprit.r.x, z: zarulOprit.r.z };
    inclina(zarulOprit, u.x, u.z);
    /* CUM SE MIȘCĂ TĂVIȚA îi spun zarului la fiecare cadru: din asta ies
       forțele sistemului legănat, adică smucitura care-l poate răsturna.
       RĂSTURNAREA ASTA NU E O ARUNCARE: nu se alege nicio față, nu se face
       niciun exercițiu. E doar un zar zgâlțâit pe masă. */
    zarulOprit.cadru = zar3d.miscarea();
    if (zarulOprit.doarme) {
      if (!strambata) { zar3d.stramt(); leagana._merge = false; return; }
      requestAnimationFrame(cadru);
      return;
    }

    /* Pași mărunți, ca la aruncare: la 240 de pași pe secundă nicio atingere de
       perete nu e sărită. Aceeași încetinire ca la aruncare, altfel s-ar vedea
       că nu-i același zar. */
    let ramas = real / INCETINIRE;
    while (ramas > 1e-5) {
      const dt = Math.min(1 / 240, ramas);
      pas(zarulOprit, dt);
      ramas -= dt;
    }
    zar3d.aseazaBrut(zarulOprit.r, zarulOprit.q);
    nemiscat = Math.hypot(zarulOprit.r.x - unde.x, zarulOprit.r.z - unde.z) < 0.02
      ? nemiscat + 1 : 0;
    if (nemiscat > 24 && !strambata) { zar3d.stramt(); leagana._merge = false; return; }
    requestAnimationFrame(cadru);
  })(performance.now());
}

/* Plimbatul cu degetul. Numai când desenează scena: zarul din CSS n-are cum să
   se rostogolească după mers, iar o jumătate de unealtă e mai rea decât niciuna. */
(function plimbatulZarului() {
  if (!elTavita || !elZar) return;

  const APASARE = 6;        // sub atâția pixeli, e apăsare, nu plimbare
  const INALT = 0.14;       // cât de sus îl ții, din latura tăviței

  /* ELASTICUL CARE NU SE VEDE, DAR SE SIMTE.

     Nu se desenează nicio bandă. Un elastic nu se cunoaște oricum după cum
     arată, ci după trei lucruri pe care le face, și pe toate trei le facem:

       1. REȚINE. Cu cât tragi mai departe, cu atât aduce zarul mai puțin.
          `tanh` are exact purtarea unei benzi de cauciuc: la început dă cât
          ceri, spre capăt aproape deloc, și nicăieri o oprire bruscă în care
          să se vadă un zid. De-aia nici n-a mai trebuit o limită scrisă de
          mână: limita e chiar purtarea benzii.
       2. TRAGE DE AMÂNDOUĂ CAPETELE. Legea a treia. Dacă banda trage de zar
          spre tăviță, trage și de tăviță spre zar, cu aceeași putere: tăvița
          se apleacă după zar cu cât e întinsă banda. Ăsta e semnul cel mai
          tare, fiindcă vezi celălalt capăt al unui lucru nevăzut.
       3. DĂ ÎNAPOI CE A PRIMIT. La eliberare, întoarcerea nu e o alunecare, ci
          jumătatea de oscilație a unui arc: `s(t) = A·cos(ωt)`. Pornește moale,
          fiindcă la capăt viteza unui arc e zero, și intră în tăviță cu
          `ω·√(A²−R²)`, adică plătește exact cât a fost întins. De asta contează
          de unde dai drumul, fără să fi scris nicăieri „de departe, mai tare". */
  const ELASTIC = 190;      // pixeli de întindere după care banda e simțită din plin
  /* CÂTĂ PUTERE DĂ BANDA, DUPĂ CÂT AI TRAS.

     Aveam aici o lege care se sătura: la un sfert din drum zarul pleca deja
     tare, iar de la jumătate încolo, dublând drumul, mai câștigai 29%. Adică
     tocmai tragerea de departe, cea care cere osteneală, nu se plătea.

     Acum e o curbă măsurată cu ochiul, ca și ceața, pe aceiași zece pași și pe
     aceeași măsură: părți din cât se poate, de la peretele tăviței până în
     colțul cel mai depărtat al ferestrei. E molcomă la început și se repede în
     ultimii doi pași, ca truda să se vadă:

         un pas    3%       șase pași   36%
         doi       7%       șapte       48%
         trei     12%       opt         64%
         patru    18%       nouă        82%
         cinci    26%       zece       100%

     Capetele nu-s alese din gust, ci măsurate în fizică, pe 60 de aruncări de
     fiecare treaptă: la 500 zarul se lasă blând, se răstoarnă o dată și se
     oprește într-o secundă; la 9000 se rostogolește trei secunde, se răstoarnă
     de nouăsprezece ori și umblă unsprezece lățimi de-ale lui. Mai sus n-are
     rost: la 12000 se învârte de șaptezeci de ori și nu se mai vede decât o
     pată care nu spune nimic. */
  const PUTERE_CURBA = [0, .03, .07, .12, .18, .26, .36, .48, .64, .82, 1];
  const PUTERE_MIN = 900;    // cât dă lăsat din marginea tăviței
  const PUTERE_MAX = 9000;   // cât dă tras din colțul cel mai depărtat

  /* CÂT DUCE TĂVIȚA, ȘI DE CE NU E TOT CE DĂ BANDA.

     Zborul înapoi și rostogolirea din tăviță sunt două lucruri deosebite, și
     abia acum am înțeles cât de deosebite. În zbor nu e nimic de lovit, deci
     zarul poate veni oricât de iute: acolo stă tot avântul praștiei, și acolo
     se și vede. În tăviță însă e altă socoteală: tăvița are 128 de unități, iar
     zarul 38, adică o tăviță cât trei zaruri. Măsurat pe 1200 de aruncări de
     fiecare treaptă, un zar intrat cu 9000 e zvârlit de prima izbitură până la
     o mie de unități înălțime: de șase ori cât tot desenul, pe lângă cameră,
     adică nicăieri. De-aia „se trunchia": nu se tăia desenul, zbura zarul din
     el. Peste 3200 nu mai încape în chip: la 3600 ajunge deja lipit de marginea
     ferestrei, iar tăvița stă la 18 pixeli de ea.

     Ce se întâmplă cu prisosul e ce se întâmplă și pe masă: îl mănâncă rama de
     lemn a tăviței, în care zarul intră izbind. Un lucru azvârlit tare într-o
     ramă de lemn nu ricoșează cu tot avântul, se oprește în ea și cade
     înăuntru. Așa că praștia rămâne întreagă la vedere, iar tăvița primește cât
     poate ține fără să scape zarul din tablou.

     Prisosul NU se retează, se așază pe scara tăviței: aceeași curbă, aceiași
     zece pași, doar între alte capete. Retezat, sfertul de sus al drumului
     ajungea tot la plafon și rostogolirea nu mai creștea deloc după jumătate,
     adică boala de care tocmai scăpasem, mutată în tăviță. Așa, și zborul, și
     rostogolirea cresc tot drumul; doar că una se măsoară în ce vede ochiul,
     cealaltă în ce încape în tablou. */
  const CAT_DUCE_TAVA = 5200;

  /* DOUĂ MĂSURI, FIINDCĂ SUNT DOUĂ LUCRURI DEOSEBITE.

     `intins` spune cât e de întinsă BANDA, și se satură repede: o bandă se
     întinde puțin, apoi stă. De el ține tot ce e mecanic, adică aplecarea și
     urnirea tăviței.

     `departe` spune cât de departe ai DUS zarul, și NU se măsoară în pixeli, ci
     în părți din cât se poate: 0 la peretele tăviței, 1 în colțul ecranului cel
     mai depărtat de ea. De el ține tot ce e de adâncime: cât de sus ții zarul
     și cât de tare se topește pagina din spate.

     De ce în părți, și nu în pixeli. „Cinci sute de pixeli" nu înseamnă nimic
     în sine: pe un ecran lat e un pas, pe un telefon e tot drumul. Ce înseamnă
     ceva e „l-am dus până la jumătatea a cât se poate". Numărul scris de mână
     nu poate ști cât e ecranul; partea din întreg știe întotdeauna, fiindcă se
     socotește din chiar ecranul de sub deget.

     Iar `intins` rămâne în pixeli, și e drept să rămână: o bandă are o lungime
     a ei, aceeași pe orice masă. Depărtarea n-are: e a odăii. */
  const SUS_INTINS = 0.40;  // cât se mai ridică zarul când l-ai dus cât se poate
  /* CÂT DE TARE SE TOPEȘTE PAGINA, LA CAPĂT.
     Cinci pixeli, nu zece. La zece, pagina se face o pâclă albă în care nu mai
     e nimic: ai pierdut și zarul, fiindcă un lucru se vede „în față" numai dacă
     mai e ceva în spatele lui față de care să fie în față. La cinci, literele
     se topesc, dar rândurile rămân rânduri și tabla rămâne tablă: vezi că e o
     pagină acolo, doar că nu mai e a ta acum. */
  const CEATA_MAX = 5;      // cât se topește pagina din spate, în pixeli de blur

  /* CUM CREȘTE CEAȚA: DUPĂ CE SE VEDE, NU DUPĂ CE IESE DINTR-O FORMULĂ.

     Am încercat rând pe rând o creștere dreaptă, una la pătrat, și un prag sub
     care nu se întâmplă nimic. Fiecare avea temeiul ei, și fiecare a fost
     greșită: una pornea prea tare, alta se sătura la jumătate, a treia nu
     pornea deloc. Toate erau formule frumoase potrivite pe ochiul meu, care
     n-are ochi.

     Așa că am cerut curba de la cine se uită la ea, măsurată pe zece pași, de
     la peretele tăviței până în colțul cel mai depărtat al ferestrei. Asta e:

         un pas   5%        șase pași   48%
         doi     15%        șapte       60%
         trei    20%        opt         80%
         patru   30%        nouă        95%
         cinci   40%        zece       100%

     Se citește dintr-o privire: pornește molcom, ține aproape drept prin
     mijloc, și se repede în ultimii doi pași. Trec liniar printre puncte, că
     pașii sunt destul de deși cât să nu se simtă niciun colț.

     Dacă vreodată nu mai place cum arată, se schimbă un număr din șirul de mai
     jos și gata. De-aia stă ca un șir, și nu ascuns într-un exponent. */
  const CEATA_CURBA = [0, .05, .15, .20, .30, .40, .48, .60, .80, .95, 1];

  /**
   * Citește o curbă măsurată cu ochiul, la o parte oarecare din drum.
   *
   * Curbele astea sunt șiruri de zece pași, scrise cum se văd. Trec liniar
   * printre puncte: pașii sunt destul de deși cât să nu se simtă niciun colț,
   * iar între două puncte n-are ce se ascunde.
   */
  function pePasi(curba, cat) {
    const t = Math.max(0, Math.min(1, cat)) * (curba.length - 1);
    const i = Math.min(curba.length - 2, Math.floor(t));
    return curba[i] + (curba[i + 1] - curba[i]) * (t - i);
  }
  /* CÂT SE DĂ PESTE CAP ÎN ZBOR, față de cât s-ar da rostogolindu-se pe masă.
     Un lucru care se rostogolește pe o suprafață se învârte cu `v/r`, fiindcă
     nu alunecă. Unul zvârlit prin aer nu e ținut de nimic, deci se dă peste cap
     cu cât l-a lăsat mâna, mult mai puțin. La viteza maximă a praștiei, `v/r`
     ar însemna șaisprezece ture pe secundă, adică o pată. */
  const TUMBA = 0.35;

  let prins = null;         // {id, x, y, cx, cy, urme, intins}
  let inaltimea = 0;        // unde e acum, între fund și palmă

  /* CEAȚA DIN SPATE.

     Cât duci zarul mai departe, pagina din spate se împăienjenește. Nu e o
     podoabă: e felul cel mai vechi prin care ochiul citește ADÂNCIMEA. Un
     aparat de fotografiat nu poate ține clar și ce e la un lat de palmă, și ce
     e la trei metri; ce iese din adâncimea de câmp se topește. Așa că, dacă
     pagina se topește, ochiul înțelege singur că zarul a ieșit din ea și a
     venit înainte, spre tine. Fără asta, zarul mare de deasupra putea fi citit
     și ca un zar uriaș lipit de pagină.

     Merge din `departe`, nu din `intins`, și merge împreună cu ridicarea
     zarului: pe amândouă le crește aceeași mână care se depărtează, deci nu pot
     spune lucruri deosebite. Cine a cerut mai puțină mișcare n-o vede deloc. */
  let ceata = null;
  function pacleste(cat, lin = false) {
    if (faraMiscare()) return;
    if (!ceata) {
      if (cat <= 0.001) return;
      ceata = document.createElement('div');
      ceata.className = 'zar-ceata';
      document.body.appendChild(ceata);
    }
    const gros = pePasi(CEATA_CURBA, cat);
    ceata.style.transition = lin ? 'backdrop-filter .42s ease, background-color .42s ease' : 'none';
    ceata.style.backdropFilter =
      gros <= 0.001 ? 'none' : 'blur(' + (gros * CEATA_MAX).toFixed(2) + 'px)';
    ceata.style.backgroundColor = 'rgba(247, 248, 252, ' + (gros * 0.10).toFixed(3) + ')';
  }

  const inTavita = (e) => {
    const c = elTavita.getBoundingClientRect();
    return { x: e.clientX - c.left - c.width / 2, y: e.clientY - c.top - c.height / 2, L: c.width };
  };

  /**
   * CÂT DE ÎNTINSĂ E BANDA, de la 0 la 1, după cât de departe de tăviță e degetul.
   *
   * Un singur număr, din care ies toate semnele benzii: aplecarea tăviței,
   * urnirea ei din loc, ridicarea zarului și puterea praștiei. Dacă ar fi mai
   * multe, s-ar putea contrazice între ele.
   *
   * Banda NU ține zarul într-un cerc. Îl țineam așa la început, „ca să se simtă
   * banda", și era o socoteală greșită: o bandă nu-ți ține MÂNA pe loc, îți ține
   * mâna sub putere, iar putere n-are un cursor. Un lucru pe care-l apuci merge
   * unde-l duci; ce se schimbă e cât te costă și cât îți dă înapoi.
   */
  /** Cât de departe POATE fi dus zarul: până în colțul cel mai depărtat de tăviță. */
  function catSePoate(c) {
    const mx = c.left + c.width / 2, my = c.top + c.height / 2;
    const W = window.innerWidth, H = window.innerHeight;
    return Math.max(Math.hypot(mx, my), Math.hypot(W - mx, my),
                    Math.hypot(mx, H - my), Math.hypot(W - mx, H - my));
  }

  function catDeIntinsa(px, py, c) {
    /* Hotarul e chiar acolo unde zarul ar da de peretele tăviței, nu unde ar
       ieși din casetă. Le încurcasem: banda se simțea abia după ce zarul
       trecuse demult peste perete, iar la eliberare trebuia adus înapoi cu
       treizeci de unități dintr-odată, adică o săritură. */
    const L = c.width;
    const m = zar3d ? zar3d.razaDrumului * (L / zar3d.latimeaScenei) : margineaDrumului(L);
    const d = Math.hypot(px, py);
    if (d <= m) return { intins: 0, departe: 0 };
    return {
      intins: Math.tanh((d - m) / ELASTIC),
      departe: Math.min(1, (d - m) / Math.max(1, catSePoate(c) - m)),
    };
  }

  /** Îl desenează acolo unde-l ține degetul acum, în planul de deasupra. */
  function aseazaInMana(dx = 0, dy = 0) {
    const gol = { intins: 0, departe: 0 };
    if (!prins) { zar3d.plimba(0, 0, inaltimea, dx, dy); return gol; }
    const c = elTavita.getBoundingClientRect();
    const cat = catDeIntinsa(prins.x, prins.y, c);
    zar3d.laDeget(prins.cx, prins.cy, inaltimea + cat.departe * SUS_INTINS, dx, dy);
    return cat;
  }

  /* RIDICATUL DIN TĂVIȚĂ.
     Când pui degetul pe zar, el se ridică: nu se apucă nimeni de un lucru fără
     să-l urnească. Ridicarea nu e liniară, ci frânează la capăt, ca o mână care
     ia ceva și se oprește; umbra se strânge singură, fiindcă e umbră adevărată
     și zarul chiar s-a depărtat de fund. */
  function urca(catre, ms = 150) {
    const dela = inaltimea;
    const pornit = performance.now();
    (function pas(acum) {
      if (!prins && catre > 0) return;                 // a dat drumul între timp
      const t = Math.min(1, (acum - pornit) / ms);
      inaltimea = dela + (catre - dela) * (1 - Math.pow(1 - t, 3));
      aseazaInMana();
      if (t < 1) requestAnimationFrame(pas);
    })(pornit);
  }

  elZar.addEventListener('pointerdown', (e) => {
    if (!zar3d || seRostogoleste) return;
    const p = inTavita(e);
    /* `x, y` = față de mijlocul tăviței, pentru cât de întinsă e banda.
       `cx, cy` = locul din fereastră, pentru raza care taie planul de sus. */
    prins = { id: e.pointerId, x: p.x, y: p.y, cx: e.clientX, cy: e.clientY,
              plecat: false, intins: 0, departe: 0,
              urme: [{ t: performance.now(), x: p.x, y: p.y }] };
    zarInMana = true;
    trezesteTavita();
    zarulOprit = null;                  // îl mută mâna: starea veche nu mai e bună
    elZar.setPointerCapture(e.pointerId);
    elTavita.classList.add('e-prins');
    /* PÂNZA SE LĂRGEȘTE DE CUM PUI DEGETUL, nu abia când zarul trece de perete.
       O aveam legată de un hotar, cu prag dublu ca să nu clipească, dar hotarul
       acela nu păzea nimic: zarul ridicat în mână iese peste marginea casetei
       cu mult înainte să treacă de peretele tăviței, iar acolo se tăia. O
       apăsare simplă tot strânge pânza la loc înainte de aruncare, deci
       rostogolirea obișnuită rămâne la desimea ei deplină. */
    zar3d.larg();
    urca(INALT);
  });

  /* PRIVIREA URMEAZĂ DEGETUL, ȘI DE MULT MAI DEPARTE DECÂT ÎNAINTE.

     Ascultam degetul numai cât stătea CHIAR pe tăviță, fiindcă ascultam butonul.
     Ieșeai un pixel din ea și tăvița îngheța, iar drumul de la mijloc până la
     înclinarea deplină avea vreo sută de pixeli: prea strâmt ca să se simtă că
     tăvița te urmărește. Ascult acum toată fereastra și socotesc depărtarea de
     mijlocul tăviței, iar înclinarea deplină vine abia la aproape două lățimi
     de casetă. Așa se poate legăna și de departe, iar mișcarea are unde să se
     desfășoare.

     Fiindcă tăvița se lasă cu mai mult decât unghiul de la care lucrurile
     pornesc la vale, zarul chiar lunecă spre colțul coborât: de-aia se cheamă
     `leagana` imediat după, ca fizica să afle că i s-a schimbat panta. */
  /* CELE DOUĂ RAZE, ȘI DE CE-S DOUĂ.

     Cu una singură, tăvița se lăsa deplin la marginea ei și rămânea așa până
     ieșeai dintr-un cerc, iar acolo se îndrepta dintr-odată. Se vedea limpede
     hotarul, adică tocmai lucrul care n-ar trebui să se vadă niciodată.

     Acum sunt trei, și fac trei lucruri deosebite:

       · până la cea dintâi, tăvița se lasă tot mai mult, cum te apropii;
       · între cea dintâi și a doua ȚINE ÎNCLINAREA DEPLINĂ, oriunde ai fi în
         inelul ăla lat. Aici era greșeala: aveam o singură rază, deci
         înclinarea deplină se atingea într-un singur punct și de-acolo încolo
         numai scădea. Se lăsa deplin doar la marginea tăviței, iar la două
         degete pe lângă ea era deja pe jumătate îndreptată;
       · de la a doua până la a treia se stinge lin, pe un drum lung.

     Așa, tot ocolul tăviței, până la vreo două lățimi și jumătate de casetă în
     jurul ei, e loc unde tăvița se lasă cu totul spre tine; și abia mult mai
     departe se așază la loc, atât de încet încât nu se vede de unde începe. */
  const RAZA_DEPLINA = 1.25;        // în jumătăți de casetă: unde se lasă cu totul
  const RAZA_TINE = 2.7;            // până unde ține înclinarea deplină
  const RAZA_STINSA = 5.5;          // și unde nu mai simte deloc degetul

  /* Trecere netedă între două praguri: pornește din zero, ajunge la unu, și la
     amândouă capetele are panta zero, deci nu se simte nicio smucitură. */
  const lin = (v, a, b) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  window.addEventListener('pointermove', (e) => {
    if (!zar3d || prins || seRostogoleste || faraMiscare()) return;
    const p = inTavita(e);
    const jum = p.L / 2;
    const departe = Math.hypot(p.x, p.y) || 1;
    /* Creșterea e un sfert de sinusoidă, nu o dreaptă. Aproape de mijloc
       pornește mai iute decât ar porni o dreaptă, deci se simte îndată; iar la
       capăt ajunge cu panta zero, deci se împreunează neted cu stingerea și
       nicăieri, nici măcar chiar în vârf, nu se simte vreun colț. */
    const catre = Math.sin(Math.min(1, departe / (jum * RAZA_DEPLINA)) * (Math.PI / 2));
    const stins = 1 - lin(departe, jum * RAZA_TINE, jum * RAZA_STINSA);
    const putere = catre * stins;
    zar3d.priveste((p.x / departe) * putere, (p.y / departe) * putere);
    /* Trezită numai când degetul e CHIAR pe ea. Înclinarea se simte de departe,
       dar aprinsul e altceva: dacă s-ar trezi de la un metru, n-ar mai adormi
       niciodată. */
    if (departe < jum * 1.4) trezesteTavita();
    leagana();
  }, { passive: true });

  elZar.addEventListener('pointermove', (e) => {
    if (!prins || e.pointerId !== prins.id) return;
    const p = inTavita(e);
    const dx = p.x - prins.x, dy = p.y - prins.y;
    if (!prins.plecat && Math.hypot(dx, dy) < APASARE) return;
    prins.plecat = true;
    prins.x = p.x; prins.y = p.y;
    prins.cx = e.clientX; prins.cy = e.clientY;
    // Ținem numai ultima șesime de secundă: avântul se ia din cât ai mișcat
    // ACUM, nu din tot drumul degetului.
    const acum = performance.now();
    prins.urme.push({ t: acum, x: p.x, y: p.y });
    while (prins.urme.length > 2 && acum - prins.urme[0].t > 160) prins.urme.shift();

    const cat = aseazaInMana(dx, dy);
    prins.intins = cat.intins;
    prins.departe = cat.departe;

    // Legea a treia: banda trage și de tăviță, nu doar de zar.
    const l = Math.hypot(p.x, p.y) || 1;
    zar3d.priveste((p.x / l) * prins.intins, (p.y / l) * prins.intins);
    pacleste(prins.departe);
  });

  /* PRAȘTIA: jumătatea de oscilație a unui arc întins.

     Zarul se întoarce din mână în tăviță, de unde încolo nu mai e nimic de la
     mine: aceiași pereți, aceeași frecare, aceeași aruncare ca oricare alta.
     Drumul îl face după `s(t) = L·cos(ωt)`, chiar mișcarea unei mase legate de
     un arc, lăsată din repaus de la depărtarea L. Pornește moale, fiindcă la
     capătul întins viteza unui arc chiar e zero, și ajunge la tăviță cu `ω·L`:
     plătește exact cât a fost întins. De asta contează de unde dai drumul, fără
     să fi scris nicăieri „de departe, mai tare".

     Sfertul de perioadă nu ține de cât de tare ai tras: un arc întins puțin și
     unul întins mult se descarcă în același timp. E izocronismul, aceeași lege
     care ține ceasurile cu pendul. Aici iese de la sine, fiindcă ω se ia din
     viteză, iar viteza crește odată cu drumul.

     Drumul se face în PIXELI DE ECRAN, fiindcă acolo a fost ținut zarul: în
     mână, nu pe masă. Abia la marginea tăviței trece în unitățile fizicii. */
  function prastia(luat, avant) {
    const c = elTavita.getBoundingClientRect();
    const mx = c.left + c.width / 2, my = c.top + c.height / 2;
    const R = zar3d.razaDrumului;
    const catreScena = zar3d.latimeaScenei / c.width;
    const hotar = R / catreScena;                 // peretele tăviței, în pixeli
    const dx = luat.cx - mx, dy = luat.cy - my;
    const d = Math.max(hotar + 1, Math.hypot(dx, dy));
    const ux = dx / d, uy = dy / d;

    const drum = d - hotar;                       // cât are de mers, în pixeli
    const drumSc = Math.max(1, drum * catreScena);  // același drum, în unități

    /* Puterea vine din CÂT AI TRAS, măsurat în părți din cât se poate. Un
       singur număr, `parte`, din care ies amândouă vitezele: cea a zborului,
       care se vede, și cea cu care intră în tăviță, care încape. */
    const parte = pePasi(PUTERE_CURBA, luat.departe);
    const vIntrare = PUTERE_MIN + (PUTERE_MAX - PUTERE_MIN) * parte;

    /* CAUCIUCUL NU E ARC, ȘI DE-AIA SE ÎNTORCEA MEREU LA FEL.

       Un arc adevărat e izocron: întins puțin sau mult, se descarcă în același
       timp. Frumoasă lege, și chiar ea era boala: oricât ai fi tras, întoarcerea
       ținea cam o jumătate de secundă, iar ochiul citește întâi CÂT ȚINE, nu cât
       de iute merge. De-aia „viteza părea la fel", deși nu era.

       Numai că o bandă de cauciuc nu e un arc. Puterea ei nu crește drept cu
       întinderea, ci se îndârjește spre capăt: întinsă la maximum e de câteva
       ori mai tare decât la început. Un cauciuc întins tare nu împinge, ci
       pocnește, iar restul drumului lucrul zboară singur.

       Asta se scrie într-un singur număr, `indarjirea`: cât de repede se
       îngrămădește mișcarea la început. Doi înseamnă împins egal tot drumul,
       ca un arc molcom; unu și un pic înseamnă o smucitură scurtă și apoi zbor.
       Cauciucul abia întins se poartă ca un arc, cel întins de tot pocnește.

       Din el ies amândouă deodată, fără nicio altă socoteală: și cât ține
       întoarcerea, `t = indarjire · drum / viteză`, și felul mișcării.
       Iar la capăt viteza iese chiar `viteză`, cum a fost aleasă: nu se rupe
       nimic la predarea către fizică. */
    const indarjire = 2 - 0.9 * luat.departe;
    const pana = (indarjire * drumSc) / vIntrare;

    const h0 = inaltimea + luat.departe * SUS_INTINS;
    const jos = zar3d.marimeaZarului * 0.62;      // pe unde intră înapoi în tăviță
    const hJos = (jos - zar3d.marimeaZarului / 2) / zar3d.latimeaLemnului;

    seRostogoleste = true;                        // nimeni nu aruncă peste praștie
    const pornit = performance.now();
    let facutAnt = 0;
    (function cadru(acum) {
      const t = ((acum - pornit) / 1000) / INCETINIRE;
      const gata = t >= pana;
      const facut = gata ? drum : drum * Math.pow(t / pana, indarjire);
      const ramas = d - facut;
      const parte = facut / drum;
      zar3d.laDeget(mx + ux * ramas, my + uy * ramas, h0 + (hJos - h0) * parte,
                    (facut - facutAnt) * ux * TUMBA, (facut - facutAnt) * uy * TUMBA);
      facutAnt = facut;
      if (!gata) { requestAnimationFrame(cadru); return; }

      /* Predarea către fizică. Rotirea i-o dăm noi, altfel și-ar socoti-o din
         viteză, ca la un zar rostogolit pe masă; ăsta însă vine prin aer. Axa e
         `sus × mers`, aceeași ca la orice aruncare. Pânza rămâne largă: zarul
         intrat cu putere sare peste marginea casetei, iar dacă am strânge-o
         acum, s-ar vedea cum i se taie săritura într-un chenar. */
      const vTava = PUTERE_MIN + (CAT_DUCE_TAVA - PUTERE_MIN) * parte;
      const rotire = (TUMBA * vTava) / (zar3d.marimeaZarului / 2);
      aruncatCuMana = {
        x: ux * R, z: uy * R, h: jos,
        vx: -ux * vTava + avant.x,
        vz: -uy * vTava + avant.y,
        vy: -140,
        wx: -uy * rotire, wy: 0, wz: ux * rotire,
      };
      inaltimea = 0;
      seRostogoleste = false;
      aruncaZarul();
    })(pornit);
  }

  const dat = (e) => {
    if (!prins || e.pointerId !== prins.id) return;
    const luat = prins;
    prins = null;
    zarInMana = false;
    elTavita.classList.remove('e-prins');
    if (elZar.hasPointerCapture(e.pointerId)) elZar.releasePointerCapture(e.pointerId);
    zar3d.priveste(0, 0);               // tăvița se îndreaptă la loc, odată cu banda
    pacleste(0, true);                  // ceața se ridică odată cu banda

    if (!luat.plecat) {
      // N-a plimbat: e o apăsare. Zarul e deja ridicat în palmă, deci aruncarea
      // pornește de sus, nu de pe fund.
      zar3d.stramt();
      aruncatCuMana = { x: 0, z: 0, h: Math.max(30, inaltimea * zar3d.latimeaScenei), vy: 0 };
      inaltimea = 0;
      aruncaZarul();
      return;
    }

    /* AVÂNTUL MÂINII, din ultimele urme, adunat peste cel al benzii. Sunt două
       lucruri deosebite și amândouă adevărate: banda îl trage spre tăviță, mâna
       îl zvârle încotro mergea ea. Un zar aruncat cu praștia în fugă chiar
       pleacă altfel decât unul lăsat din loc. */
    const a = luat.urme[0], b = luat.urme[luat.urme.length - 1];
    const dt = Math.max(0.016, (b.t - a.t) / 1000);
    const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    const catreScena = zar3d.latimeaScenei / (elTavita.clientWidth || 150);
    const avant = { x: Math.max(-900, Math.min(900, vx)) * catreScena,
                    y: Math.max(-900, Math.min(900, vy)) * catreScena };
    prastia(luat, avant);
  };
  elZar.addEventListener('pointerup', dat);
  /* Degetul a ieșit cu totul din fereastră: tăvița se îndreaptă lin la loc.
     Cât e în fereastră, de asta are grijă ascultătorul de mai sus, care o
     îndreaptă singur pe măsură ce te depărtezi. */
  window.addEventListener('pointerout', (e) => {
    if (zar3d && !prins && !e.relatedTarget) { zar3d.priveste(0, 0); leagana(); }
  });

  elZar.addEventListener('pointercancel', () => {
    if (!prins) return;
    prins = null;
    zarInMana = false;
    elTavita.classList.remove('e-prins');
    zar3d.stramt();
    zar3d.priveste(0, 0);
    pacleste(0, true);
    urca(0);                       // s-a răzgândit: zarul se lasă la loc
  });
})();

/* Apăsarea simplă. Cu scena, apăsarea vine din `pointerup` de mai sus, ca să nu
   pornească aruncarea de două ori; fără ea, clicul e singurul drum. */
elZar && elZar.addEventListener('click', (e) => {
  if (zar3d) return;
  aruncaZarul();
});

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

/* Fața pe care a scos-o zarul și care ÎNCĂ N-A DEVENIT EXERCIȚIU.

   Aruncarea e o întrebare, nu o hotărâre, deci între „a picat 3" și „Generează"
   nu există niciun exercițiu pe tablă: fața stă aici. Dacă omul renunță, se
   golește și nu rămâne nimic în urmă. Dacă generează, atunci se face exercițiul,
   cu fața asta pe el. */
let fataDinZar = null;

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

/* CLICUL ÎN AFARĂ ÎNCHIDE FEREASTRA, ȘI ÎNSEAMNĂ „RENUNȚĂ".

   Nu e o scurtătură în plus, e aceeași ieșire pe care o are deja tasta Escape,
   pusă și acolo unde o caută mâna. Iar „renunță" iese de la sine: nimic nu se
   face la închidere, ci numai la apăsarea butonului dinăuntru. Închizi, nu se
   întâmplă nimic.

   DE CE NU MĂ UIT LA `e.target`. Un <dialog> deschis ca modal își desenează
   singur fundalul, iar clicul pe fundal ajunge tot la el, deci `e.target` ar
   spune „fereastra" și pentru afară, și pentru marginea dinăuntru. Mă uit la
   locul clicului față de dreptunghiul ferestrei: e singurul răspuns care nu se
   poate încurca.

   Și mă uit unde a ÎNCEPUT apăsarea, nu unde s-a sfârșit: cine trage cu mouse-ul
   ca să aleagă un text și scapă butonul afară nu a cerut să închidă nimic. */
function inchideLaClicInAfara(d) {
  if (!d) return;
  let pornitInauntru = false;
  const inauntru = (e) => {
    const r = d.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right &&
           e.clientY >= r.top && e.clientY <= r.bottom;
  };
  d.addEventListener('pointerdown', (e) => { pornitInauntru = inauntru(e); });
  d.addEventListener('click', (e) => {
    if (pornitInauntru || inauntru(e)) return;
    inchideFereastra(d);
  });
}

/* ---------- Ce fel de exercițiu ----------
   O singură listă, folosită și de fereastra de la „+ cerință", și de întrebarea
   dinăuntrul generatorului. Se face din `CERINTE` și din registrul lecției:
   dacă se schimbă o cerință, se schimbă în amândouă locurile deodată.

   Întâi cele șase ale zarului, cu numărul lor; apoi cele pe care le dă
   profesorul când socotește el, cu un semn în locul numărului, fiindcă n-au
   număr și n-ar avea ce să însemne acolo. */
function feluriHtml(cuLiber) {
  let h = '';
  const unul = (cheie, semn, cfg) =>
    '<button class="fel" type="button" data-fata="' + escapaText(cheie) + '">' +
      '<span class="fel__n">' + semn + '</span>' +
      '<span class="fel__t"><b>' + escapaText(cfg.nume) + '</b>' +
      '<i>' + escapaText(CERINTE[cheie] || '') + '</i></span></button>';
  for (const fata of [1, 2, 3, 4, 5, 6]) {
    const cfg = felulExercitiului(LECTIE, fata);
    if (!cfg) continue;
    h += unul(String(fata), String(fata), cfg);
  }
  for (const alt of altele(LECTIE)) h += unul(alt.cheie, '✦', alt);
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
  /* Cheia rămâne cum e scrisă: numerele fețelor de zar tot numere, numele
     celorlalte tot nume. Trecută prin `Number`, „accent" ar fi ieșit `NaN`. */
  const fata = cheiaFelului(b.dataset.fata);
  inchideFereastra(dlgFel);
  const apoi = raspundeLaFel;
  raspundeLaFel = null;
  if (apoi) apoi(fata);
});

/** Cheia scrisă pe un buton de fel: număr dacă e față de zar, nume altfel. */
function cheiaFelului(brut) {
  const t = String(brut || '');
  return /^\d+$/.test(t) ? (Number(t) || 0) : t;
}

/* ---------- Ținta și felul în lucru ---------- */

/** Felul cu care lucrăm acum: cel ales adineauri ori cel al exercițiului. */
function fataInLucru() {
  if (felAles) return felAles;
  /* Zarul a spus felul, dar exercițiul nu s-a făcut încă: se face abia la
     „Generează". Până atunci fața trăiește în `fataDinZar`, nu pe tablă. */
  if (fataDinZar) return fataDinZar;
  const ex = exercitii[deschis];
  /* Cheia unui exercițiu e ori numărul feței de zar, ori numele unuia dat de
     profesor. NU se mai trece prin `Number`: „accent" ar fi ieșit `NaN`, iar
     de-acolo încolo tabla ar fi crezut că exercițiul n-are fel. */
  return ex && ex.fata ? ex.fata : null;
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
    const cfg = felulExercitiului(LECTIE, fata);
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

  const cfg = felulExercitiului(LECTIE, fata);
  const ex = exercitii[deschis];
  /* Când fața vine de la zar, exercițiul e ÎNTOTDEAUNA nou, deci bifa „într-un
     exercițiu nou" n-ar mai avea ce alege. Se ascunde: o bifă care nu schimbă
     nimic e mai rea decât una care lipsește, fiindcă te lasă să crezi că ai
     hotărât ceva. */
  const dinZar = !!fataDinZar;
  const nou = dinZar || !!(elGenNou && elGenNou.checked);
  if (elGenNou && elGenNou.parentElement) elGenNou.parentElement.hidden = dinZar;

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
  const cfg = felulExercitiului(LECTIE, fata);
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

/* ÎNCHIDEREA CURĂȚĂ TOT, ORICUM S-AR FACE: de pe „Renunță", cu Escape, cu un
   clic în afară, ori după o generare izbutită. Toate trec pe aici, fiindcă toate
   sfârșesc cu `close`, iar asta e chiar ce voiam: o singură curățenie, nu una
   pentru fiecare fel de a pleca. Așa fața zarului nu poate rămâne agățată. */
dlgGen && dlgGen.addEventListener('close', () => {
  felAles = null;
  fataDinZar = null;
  banca.clear();
});

/* Toate ferestrele tablei se închid și la un clic în afară, nu doar din Escape
   sau de pe buton. Se pune într-un singur loc, pe toate deodată, ca să nu ajungă
   una să se poarte altfel decât surorile ei. */
document.querySelectorAll('dialog.dlg').forEach(inchideLaClicInAfara);

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
  felAles = cheiaFelului(b.dataset.fata) || null;
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
  const cfg = felulExercitiului(LECTIE, fata);

  const tot = await bancaPentru(fata);
  const libere = libereDin(tot, nivelAles(), !!(elGenNoi && elGenNoi.checked));
  if (!libere.length) { improspatatePlafonul(); return; }

  const cate = Math.max(1, Math.min(libere.length, Number(elGenCate.value) || 1));
  /* Se țin ITEMII, nu doar textele. Până acum se lua numai `body`, iar numele
     cuvântului în bancă se pierdea chiar în clipa în care ajungea pe tablă. Or,
     ca elevul să-i poată pune etichete, rândul trebuie să știe DESPRE CE cuvânt
     din bancă e vorba: două cuvinte scrise la fel nu-s același cuvânt. */
  const alesii = alege(libere, cate);
  const texte = alesii.map((x) => x.body);
  const legatura = (i) => (alesii[i] && alesii[i].id) || null;

  // UNDE INTRĂ. Un exercițiu nou capătă felul ăsta; cel deschis, dacă n-avea
  // fel (cerință scrisă de mână), îl capătă acum și nu va mai fi întrebat.
  let ex;
  if (fataDinZar) {
    /* AICI SE NAȘTE exercițiul venit de la zar, nu la aruncare. Aruncarea doar
       întreabă; abia răspunsul face ceva. Iar el e întotdeauna NOU: „mi-a picat
       altceva" înseamnă altă cerință, nu alte cuvinte la cea de față. */
    ex = adaugaExercitiu({ sursa: 'zar', fata });
  } else if ((elGenNou && elGenNou.checked) || !exercitii[deschis]) {
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

  /* RÂNDURILE, după felul materialului. Fiecare fel are alt drum de străbătut,
     deci alt rând:
       · cuvinte    → un rând pe cuvânt, cu cuvântul pus la locul lui, iar
                      elevul merge înainte: silabe, transcriere, tipul sunetelor;
       · structuri  → un rând pe structură, cu ea pusă în capul lui și blocată;
                      elevul merge ÎNAPOI, de la structură spre cuvinte, oricâte;
       · propoziții → rând de propoziție: enunțul sus, blocat, transcrierea jos. */
  if (cfg.kind === 'propozitie') {
    ex.randuri = texte.map((t, i) => ({ fraza: escapaText(t), trans: '', blocata: true, itemId: legatura(i) }));
  } else if (cfg.kind === 'structura') {
    ex.randuri = texte.map((t, i) => ({ structura: escapaText(t), syll: '', raspuns: [], blocata: true, itemId: legatura(i) }));
  } else if (felDupaFata(fata) === 'accent') {
    ex.randuri = texte.map((t, i) => ({ word: escapaText(t), accentuat: '', sens: '', exemplu: '', itemId: legatura(i) }));
  } else {
    ex.randuri = texte.map((t, i) => ({ word: escapaText(t), itemId: legatura(i) }));
  }

  aseazaRanduri(ex.randuri, felDupaFata(fata));
  deseneazaTeancul();
  murdareste(); scheduleSave();
  inchideFereastra(dlgGen);
});

/* Banca de material NU se mai scrie de aici.
   S-a mutat în panoul de administrare, la lecția ei: „Profesor → Lecții →
   Fonetică, introducere → Tablă". Un lucru, un loc. Tabla doar CITEȘTE banca,
   prin generatorul de mai sus, iar cine n-are drept de scriere nici nu vede
   vreun buton care i-ar da speranțe. */

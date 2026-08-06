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
  '3': { char: 'k̇', bold: true  },
  '4': { char: 'ġ',  bold: true  }
};
function loadSymbols() {
  try {
    const raw = localStorage.getItem('fonetica_symbols');
    if (raw) { const o = JSON.parse(raw); if (o && o['1'] && o['2'] && o['3'] && o['4']) return o; }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_SYMBOLS));
}
function saveSymbols() { try { localStorage.setItem('fonetica_symbols', JSON.stringify(symbols)); } catch (e) {} }
let symbols = loadSymbols();

/* Inserează simbolul asociat unei taste (1-4), bold sau normal, după setare.
   Simbolul intră într-o cutie de o celulă (span.sym, lat 1ch), nu ca text gol.

   DE CE: rândul c/v/s de dedesubt se aliniază numărând coloane, adică se
   bizuie pe faptul că fiecare semn ocupă exact o celulă de monospațiat. Asta e
   adevărat pentru literele obișnuite, dar nu și pentru sunetele speciale:
   „k̇" e literă plus semn combinat, două puncte de cod; „ĉ" și „ĝ" pot lipsi
   din fontul monospațiat al calculatorului, iar atunci browserul le împrumută
   din alt font, cu altă lățime. De-aici venea deplasarea mică de dedesubt.
   Cutia de 1ch le ține pe toate într-o singură celulă, oricum ar fi desenate. */
function insertSymbol(key, field) {
  const s = symbols[key];
  if (!s || !s.char) return;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();

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
  const coada = document.createTextNode(eTranscriere(camp) ? VIRGULA : '');
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
  if (!eTranscriere(camp)) return;
  const inainte = ultimele(1);
  if (!inainte) return;                          // suntem la începutul câmpului
  if (/[\s,\-[(]/.test(inainte)) return;          // e deja despărțit
  insertText(VIRGULA);
}

/* Pune un sunet la cursor. În transcriere, cu virgula lui după el. */
function insertSunet(text, field) {
  virgulaLipsa(field);
  insertText(eTranscriere(field) ? text + VIRGULA : text);
}

/* Semnele care NU sunt sunete, deci nu primesc virgulă. Apostroful lipsește
   dinadins din listă: el nu e sunet nou, ci înmoaie sunetul dinainte (k'),
   așa că trebuie să rămână lipit de el, fără virgulă între ele. */
const NU_E_SUNET = new Set([' ', '\u00a0', '[', ']', '(', ')', '/', '.', ':', ';', '!', '?']);

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
    const sim = lista.find((x) => tot.startsWith(x));
    if (!sim || tot === sim) return;              // cutia e curată
    const rest = tot.slice(sim.length);
    const eIngrosat = !!c.querySelector('b');
    c.textContent = '';
    if (eIngrosat) {
      const b = document.createElement('b');
      b.textContent = sim;
      c.appendChild(b);
    } else {
      c.textContent = sim;
    }
    c.after(document.createTextNode(rest));
  });
}

/* ================= Îmbrăcarea simbolurilor deja scrise =================
   Cutia de o celulă se pune la inserare, dar tablele scrise ÎNAINTE de asta au
   simbolurile ca text gol, deci s-ar purta mai departe după lățimea pe care
   le-o dă fontul. Funcția de mai jos le îmbracă și pe ele, ca să nu fie
   nevoie de rescris nimic.

   Se cheamă la deschiderea unei table și la ieșirea din câmp, deci vechiul se
   îndreaptă de la sine, pe măsură ce lucrezi. */
function imbracaSimboluri(el) {
  if (!el) return;
  const lista = Object.values(symbols).map(s => s && s.char).filter(Boolean);
  if (!lista.length) return;

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
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  const pos = Math.max(0, node.length - caretBack);
  range.setStart(node, pos);
  range.setEnd(node, pos);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* inserează un caracter îngroșat (bold), cu cursorul plasat în afara elementului bold */
function insertBold(text) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const b = document.createElement('b');
  b.textContent = text;
  range.insertNode(b);
  // un text node gol după <b>, ca tastarea următoare să NU fie bold
  const after = document.createTextNode('​'); // zero-width, îl curățăm dacă rămâne singur
  if (b.nextSibling) b.parentNode.insertBefore(after, b.nextSibling);
  else b.parentNode.appendChild(after);
  range.setStart(after, after.length);
  range.setEnd(after, after.length);
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
  const noduri = noduriText(camp);
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
  saiInNodulDinainte();
  const range = sel.getRangeAt(0);
  if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
    range.setStart(range.startContainer, range.startOffset - 1);
    range.deleteContents();
    sel.removeAllRanges();
    sel.addRange(range);
  } else if (sel.modify) {
    sel.modify('extend', 'backward', 'character');
    sel.deleteFromDocument();
  }
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
  const seps = new Set(['[', ']', '(', ')', ',', '-', '–', '–', ' ', ' ', '/']);
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
    if (e.key === 'Backspace' && !e.shiftKey && ultimele(VIRGULA.length) === VIRGULA) {
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
  if (e.key === '-') {
    e.preventDefault();
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

/* ---------- Creare / adăugare rânduri ---------- */
function createRow() {
  return rowTemplate.content.firstElementChild.cloneNode(true);
}

function renumber() {
  sheet.querySelectorAll('.row').forEach((row, idx) => {
    row.querySelector('.rownum').textContent = (idx + 1) + '.';
  });
}

function addRowAfter(row) {
  const newRow = createRow();
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
  if (!row) return null;
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
  if (bare.trim() === '') { field.innerHTML = ''; return; }   // gol -> redă placeholder-ul
  // transcriere cu doar „[  ]" (neatinsă) -> o golim, ca să reapară placeholder-ul
  if (field.classList.contains('trans') && /^\[\s*\]$/.test(bare.trim())) { field.innerHTML = ''; return; }
  // Virgula de la coadă și-a făcut treaba cât ai scris; acum ar rămâne
  // atârnată după ultimul sunet, așa că o strângem.
  if (field.classList.contains('trans')) { taieVirgulaFinala(field); imbracaSimboluri(field); }
  if (field.classList.contains('types')) {                    // c/v/s -> curăț spațiile de la coadă
    const trimmed = bare.replace(/\s+$/, '');
    if (trimmed !== field.textContent) field.textContent = trimmed;
  }
}, true);

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
let exercitii = [];
let deschis = 0;

const elTeanc = document.getElementById('teanc');

function exercitiuNou({ cerinta = '', sursa = 'mana', fata = null, tema = false } = {}) {
  return { id: 'e' + Date.now() + Math.random().toString(36).slice(2, 6),
           cerinta, sursa, fata, tema, randuri: [] };
}
const exercitiulDeschis = () => exercitii[deschis] || null;

/** Rândurile din pagină, în formă de date. */
function culegeRanduri() {
  return Array.from(sheet.querySelectorAll('.row')).map(row => ({
    word:  (row.querySelector('.word')  || {}).innerHTML || '',
    syll:  (row.querySelector('.syll')  || {}).innerHTML || '',
    trans: (row.querySelector('.trans') || {}).innerHTML || '',
    types: (row.querySelector('.types') || {}).textContent || '',
    extra: Array.from(row.querySelectorAll('.field.extra')).map(e => e.innerHTML)
  }));
}

/** Datele înapoi în pagină. Un rând gol dacă exercițiul n-are niciunul: o
 *  tablă fără nicio căsuță de scris n-ar spune elevului ce să facă. */
function aseazaRanduri(randuri) {
  sheet.innerHTML = '';
  const lista = (randuri && randuri.length) ? randuri : [null];
  lista.forEach(r => {
    const row = createRow();
    sheet.appendChild(row);
    if (!r) return;
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
        nr + '<span class="cer__text">' + (escapaText(ex.cerinta) || 'fără cerință') + '</span>' +
        semne + '</div>';
    }
    // Cea de la zar nu se scrie: e ce ți-a picat, nu ce vrei tu.
    const corp = ex.sursa === 'zar'
      ? '<div class="cer__data">' + escapaText(ex.cerinta) + '</div>'
      : '<textarea data-cerinta="' + i + '" placeholder="Scrie aici cerința exercițiului…">' +
        escapaText(ex.cerinta) + '</textarea>';
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

const elCerintaNoua = document.getElementById('cerintaNoua');
elCerintaNoua && elCerintaNoua.addEventListener('click', () => {
  adaugaExercitiu({});
  const t = elTeanc.querySelector('.cer.e-deschisa textarea');
  if (t) t.focus();
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
    return state.exercitii.map((e) => ({
      id: e.id || ('e' + Math.random().toString(36).slice(2, 8)),
      cerinta: e.cerinta || '',
      sursa: e.sursa === 'zar' ? 'zar' : 'mana',
      fata: e.fata || null,
      tema: !!e.tema,
      randuri: Array.isArray(e.randuri) ? e.randuri : [],
    }));
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
import { ETICHETE, TOATE_ETICHETELE, listItems, listAll, addRows, deleteItem, cheia }
  from '../../shared/scripts/bank-repo.js';
import { isAdmin } from '../../shared/scripts/session.js';

/* Cele șase cerințe, una pe față. Textul lor e al profesorului, nu al meu:
   se schimbă aici, într-un singur loc, și se schimbă peste tot. */
const CERINTE = {
  1: 'Precizează numărul de litere și de sunete din cuvintele date.',
  2: 'Extrage grupurile de sunete din cuvintele date.',
  3: 'Desparte în silabe cuvintele date.',
  4: 'Stabilește valoarea fonetică a lui [i] în cuvintele date.',
  5: 'Oferă cuvinte pentru structurile fonetice date.',
  6: 'Transcrie fonetic propoziția dată.',
};

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

function asazaZarul(x, y, h, rx, ry) {
  if (!elZar) return;
  elZar.style.transform =
    `translate3d(${x}px, ${y}px, ${h}px) rotateX(${rx}deg) rotateY(${ry}deg)`;
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

/** Ce se întâmplă după ce zarul s-a oprit: se vestește și se face exercițiul. */
function gataAruncarea(fata) {
  vesteste(fata);
  adaugaExercitiu({ cerinta: CERINTE[fata], sursa: 'zar', fata });
}

elZar && elZar.addEventListener('click', aruncaZarul);

/* ---------- Generatorul ---------- */
const dlgGen = document.getElementById('dlgGen');
const elGenTip = document.getElementById('genTip');
const elGenZar = document.getElementById('genZar');
const elGenTema = document.getElementById('genTema');
const elGenCate = document.getElementById('genCate');
const elGenCe = document.getElementById('genCe');
const elGenNivel = document.getElementById('genNivel');
const elGenRepeta = document.getElementById('genRepeta');
const elGenNota = document.getElementById('genNota');
const elGenPentru = document.getElementById('genPentru');

/* Ce a primit elevul CÂT E PE TABLĂ. Se golește la reîncărcare, deci „nu se
   repetă în aceeași ședere" înseamnă exact ce a cerut Marius: în ședința asta
   nu, mâine da. Ține minte materialul, nu rândurile: același cuvânt cerut la
   două exerciții deosebite tot repetare e. */
const datAzi = new Set();

const NUME_FEL = { cuvant: 'cuvinte', structura: 'structuri fonetice', propozitie: 'propoziții' };

function deschideFereastra(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }

/** Ultimul exercițiu venit de la zar, dacă există. */
function ultimulDeLaZar() {
  for (let i = exercitii.length - 1; i >= 0; i--) if (exercitii[i].sursa === 'zar') return i;
  return -1;
}

function potrivesteFereastraGen() {
  const iZar = ultimulDeLaZar();
  if (elGenZar) elGenZar.disabled = iZar < 0;
  const spreZar = elGenZar && elGenZar.checked && iZar >= 0;
  const tinta = spreZar ? iZar : deschis;
  const ex = exercitii[tinta];
  // Tipul se ia de la exercițiu când exercițiul îl știe (a venit de la zar), și
  // atunci nu se poate schimba: altfel ai cere cuvinte pentru o cerință care
  // vorbește despre propoziții.
  if (ex && ex.sursa === 'zar') {
    elGenTip.value = String(ex.fata);
    elGenTip.disabled = true;
  } else {
    elGenTip.disabled = false;
  }
  if (elGenTema) elGenTema.checked = !!(ex && ex.tema);
  const cfg = ETICHETE[Number(elGenTip.value)] || ETICHETE[1];
  if (elGenCe) elGenCe.textContent = NUME_FEL[cfg.kind];
  if (elGenPentru) {
    elGenPentru.textContent = ex
      ? 'Materialul intră în exercițiul ' + (tinta + 1) + (ex.sursa === 'zar' ? ' (de la zar).' : '.')
      : 'Nu văd niciun exercițiu.';
  }
  if (elGenCate) elGenCate.value = cfg.kind === 'propozitie' ? '1' : elGenCate.value;
}

document.getElementById('genBtn')?.addEventListener('click', () => {
  if (elGenNota) elGenNota.textContent = '';
  potrivesteFereastraGen();
  deschideFereastra(dlgGen);
});
elGenZar && elGenZar.addEventListener('change', potrivesteFereastraGen);
elGenTip && elGenTip.addEventListener('change', potrivesteFereastraGen);

/** Alege la întâmplare, ocolind ce s-a mai dat, dacă elevul n-a cerut altfel. */
function alege(lista, cate, cuRepetare) {
  const libere = cuRepetare ? lista.slice() : lista.filter((x) => !datAzi.has(x.id));
  // Dacă s-au terminat cele nemaivăzute, luăm de la capăt din tot ce e: mai
  // bine repetare decât „n-am ce să-ți dau".
  const din = libere.length ? libere : lista.slice();
  const ales = [];
  const copie = din.slice();
  while (ales.length < cate && copie.length) {
    ales.push(copie.splice(Math.floor(Math.random() * copie.length), 1)[0]);
  }
  ales.forEach((x) => datAzi.add(x.id));
  return ales;
}

document.getElementById('genFa')?.addEventListener('click', async () => {
  const iZar = ultimulDeLaZar();
  const spreZar = elGenZar && elGenZar.checked && iZar >= 0;
  const tinta = spreZar ? iZar : deschis;
  const ex = exercitii[tinta];
  if (!ex) return;

  const fata = Number(elGenTip.value) || 1;
  const cfg = ETICHETE[fata];
  const cate = Math.max(1, Math.min(30, Number(elGenCate.value) || 1));
  const nivel = elGenNivel.value ? Number(elGenNivel.value) : null;

  elGenNota.textContent = 'Caut în bancă…';
  const tot = await listItems(LECTIE, fata, { level: nivel });
  if (!tot.length) {
    elGenNota.textContent = 'Banca n-are încă ' + NUME_FEL[cfg.kind] +
      ' pentru exercițiul ăsta' + (nivel ? ' la dificultatea aleasă' : '') + '.';
    return;
  }
  const alese = alege(tot, cate, elGenRepeta && elGenRepeta.checked);
  const texte = alese.map((x) => x.body);

  // CERINȚA primește materialul, ca elevul să-l vadă și când derulează.
  ex.cerinta = CERINTE[fata] + '\n' + texte.join(', ');
  ex.tema = !!(elGenTema && elGenTema.checked);
  if (ex.sursa !== 'zar') ex.fata = fata;

  // RÂNDURILE, după felul materialului:
  //  · cuvinte     → un rând pe cuvânt, cu cuvântul pus la locul lui;
  //  · structuri   → rânduri GOALE: structura e cerința, cuvintele le dă elevul;
  //  · propoziții  → un rând, cu propoziția în prima căsuță, de transcris.
  let randuri;
  if (cfg.kind === 'cuvant')      randuri = texte.map((t) => ({ word: escapaText(t) }));
  else if (cfg.kind === 'structura') randuri = texte.map(() => ({}));
  else                            randuri = texte.map((t) => ({ word: escapaText(t) }));
  ex.randuri = randuri;

  if (tinta !== deschis) { salveazaDeschisul(); deschis = tinta; }
  aseazaRanduri(ex.randuri);
  deseneazaTeancul();
  murdareste(); scheduleSave();
  elGenNota.textContent = '';
  dlgGen.close ? dlgGen.close() : dlgGen.removeAttribute('open');
});

/* ---------- Banca de material (numai profesorul o scrie) ----------

   Materialul se pune în două mișcări, nu într-una. Întâi lipești lista și ea
   se așază într-un TABEL nesalvat, ca o foaie de calcul; abia pe urmă, după ce
   ai bifat pe fiecare rând la ce exerciții se potrivește, apeși „Importă".

   De ce așa. Un cuvânt bun la „litere și sunete" nu e neapărat bun și la
   „valoarea lui i", iar dacă bifele s-ar pune o dată pentru toată lista, ar
   trebui lipită lista de patru ori, o dată pentru fiecare potriveală. În tabel
   pui bifa unde trebuie: pe cap de coloană când merge la toate, pe rând când
   merge doar la unul. */
const dlgBank = document.getElementById('dlgBank');
const elBankBtn = document.getElementById('bankBtn');
const elBankText = document.getElementById('bankText');
const elBankKind = document.getElementById('bankKind');
const elBankMasa = document.getElementById('bankMasa');
const elBankTabel = document.getElementById('bankTabel');
const elBankSocoteala = document.getElementById('bankSocoteala');
const elBankImporta = document.getElementById('bankImporta');
const elBankLista = document.getElementById('bankLista');
const elBankNota = document.getElementById('bankNota');

/** Rândurile din tabel, încă nesalvate: `{ body, kind, tags:Set, level, gata }`. */
let masa = [];
/** Ce e deja în bancă, după cheia de potrivire. Ca să nu trimitem duplicate. */
let dejaInBanca = new Set();

const NUMELE_NIVELULUI = { 1: 'ușor', 2: 'mijlociu', 3: 'greu' };

/* Butonul se arată abia după ce știm cine e: rolul vine din sesiune, iar
   sesiunea se așază după ce pagina a pornit. */
function potrivesteBanca() {
  if (elBankBtn) elBankBtn.hidden = !isAdmin();
}
potrivesteBanca();
setTimeout(potrivesteBanca, 1200);

/** Felul pe care îl ține tabelul. Cât are rânduri, el hotărăște, nu selectorul:
 *  coloanele sunt ale unui singur fel deodată. */
const felulMesei = () => (masa.length ? masa[0].kind : elBankKind.value);

/** Coloanele de bifat, adică etichetele care au înțeles pentru felul de față.
 *  N-are rost să bifezi „propoziții" în dreptul unui cuvânt. */
const coloaneleMesei = () => TOATE_ETICHETELE.filter((e) => e.kind === felulMesei());

/** „3 cuvinte", „20 de cuvinte": regula lui „de" de la 20 în sus. */
function cuDe(n, unul, mai) {
  const rest = n % 100;
  const are = n >= 20 && !(rest >= 1 && rest <= 19);
  return n + (are ? ' de ' : ' ') + (n === 1 ? unul : mai);
}

function optiuniDeNivel(ales, gol) {
  const capul = gol ? '<option value="">' + gol + '</option>' : '';
  return capul + [1, 2, 3].map((n) =>
    '<option value="' + n + '"' + (Number(ales) === n ? ' selected' : '') + '>' +
    NUMELE_NIVELULUI[n] + '</option>').join('');
}

/* ---- Tabelul ---- */

function deseneazaMasa() {
  if (!elBankTabel) return;
  elBankMasa.hidden = !masa.length;
  if (!masa.length) { elBankTabel.innerHTML = ''; potrivesteImportul(); return; }

  const cols = coloaneleMesei();
  /* O coloană e „plină" când toate rândurile care se pot trimite o au bifată.
     Cele deja în bancă nu se socotesc: ele nu pleacă nicăieri. */
  const deTrimis = masa.filter((r) => !r.gata);
  const plina = (et) => deTrimis.length > 0 && deTrimis.every((r) => r.tags.has(et));

  const cap = '<tr>' +
    '<th class="bank-t__nr"></th>' +
    '<th class="bank-t__corp">Material</th>' +
    cols.map((c) => '<th><button type="button" class="bank-cap' +
      (plina(c.eticheta) ? ' e-plina' : '') + '" data-col="' + c.eticheta + '">' +
      escapaText(c.nume) + '</button></th>').join('') +
    '<th><select class="bank-t__niv" data-tot="1" aria-label="Dificultatea tuturor">' +
      optiuniDeNivel('', 'dificultate') + '</select></th>' +
    '<th class="bank-t__sterge"></th>' +
    '</tr>';

  const trup = masa.map((r, i) => '<tr class="bank-r' + (r.gata ? ' e-gata' : '') + '">' +
    '<td class="bank-t__nr">' + (i + 1) + '.</td>' +
    '<td class="bank-t__corp">' + escapaText(r.body) +
      (r.gata ? '<span class="bank-r__gata">e în bancă</span>' : '') + '</td>' +
    cols.map((c) => '<td><input type="checkbox" data-i="' + i + '" data-et="' + c.eticheta + '"' +
      (r.tags.has(c.eticheta) ? ' checked' : '') + (r.gata ? ' disabled' : '') +
      ' aria-label="' + escapaText(c.nume + ': ' + r.body) + '"></td>').join('') +
    '<td><select class="bank-t__niv" data-i="' + i + '" aria-label="Dificultatea pentru ' +
      escapaText(r.body) + '"' + (r.gata ? ' disabled' : '') + '>' +
      optiuniDeNivel(r.level, '') + '</select></td>' +
    '<td class="bank-t__sterge"><button class="bank-r__x" data-scoate="' + i +
      '" title="Scoate rândul" aria-label="Scoate rândul">×</button></td>' +
    '</tr>').join('');

  elBankTabel.innerHTML = '<thead>' + cap + '</thead><tbody>' + trup + '</tbody>';
  potrivesteImportul();
}

/** Câte pleacă, câte nu, și de ce. Butonul de import se trezește numai dacă are
 *  ce trimite. */
function potrivesteImportul() {
  const gata = masa.filter((r) => r.gata).length;
  const fara = masa.filter((r) => !r.gata && !r.tags.size).length;
  const pleaca = masa.length - gata - fara;
  if (elBankImporta) elBankImporta.disabled = pleaca === 0;
  if (!elBankSocoteala) return;
  if (!masa.length) { elBankSocoteala.textContent = ''; return; }
  const vorbe = [cuDe(pleaca, 'de trimis', 'de trimis')];
  if (gata) vorbe.push(gata + ' deja în bancă');
  if (fara) vorbe.push(cuDe(fara, 'fără bifă', 'fără bifă'));
  elBankSocoteala.textContent = vorbe.join(' · ');
}

elBankTabel && elBankTabel.addEventListener('click', (e) => {
  const capul = e.target.closest('[data-col]');
  if (capul) {
    const et = capul.dataset.col;
    const deTrimis = masa.filter((r) => !r.gata);
    const scoatem = deTrimis.length > 0 && deTrimis.every((r) => r.tags.has(et));
    deTrimis.forEach((r) => { if (scoatem) r.tags.delete(et); else r.tags.add(et); });
    deseneazaMasa();
    return;
  }
  const x = e.target.closest('[data-scoate]');
  if (x) { masa.splice(Number(x.dataset.scoate), 1); deseneazaMasa(); }
});

elBankTabel && elBankTabel.addEventListener('change', (e) => {
  const c = e.target;
  if (c.type === 'checkbox') {
    const r = masa[Number(c.dataset.i)];
    if (!r) return;
    if (c.checked) r.tags.add(c.dataset.et); else r.tags.delete(c.dataset.et);
    /* Aici NU redesenăm tot tabelul: ar sări bifa de sub deget la fiecare click.
       Umblăm doar la ce s-a schimbat cu adevărat. */
    const et = c.dataset.et;
    const deTrimis = masa.filter((x) => !x.gata);
    const capul = elBankTabel.querySelector('[data-col="' + et + '"]');
    if (capul) capul.classList.toggle('e-plina', deTrimis.length > 0 && deTrimis.every((x) => x.tags.has(et)));
    potrivesteImportul();
    return;
  }
  if (c.classList.contains('bank-t__niv')) {
    if (c.dataset.tot) {
      const n = Number(c.value);
      if (!n) return;
      masa.forEach((r) => { if (!r.gata) r.level = n; });
      c.value = '';
      deseneazaMasa();
    } else {
      const r = masa[Number(c.dataset.i)];
      if (r) r.level = Number(c.value) || 2;
    }
  }
});

/* Schimbarea felului rescrie coloanele, deci nu poate lucra peste rânduri de
   alt fel. Spunem de ce, în loc să pierdem în tăcere ce e în tabel. */
elBankKind && elBankKind.addEventListener('change', () => {
  if (masa.length && masa[0].kind !== elBankKind.value) {
    elBankKind.value = masa[0].kind;
    elBankNota.textContent = 'Tabelul ține un singur fel deodată. Importă-l ori golește-l întâi.';
  }
});

document.getElementById('bankGoleste')?.addEventListener('click', () => {
  masa = [];
  elBankNota.textContent = '';
  deseneazaMasa();
});

/* ---- Adăugarea în tabel ---- */

document.getElementById('bankAdauga')?.addEventListener('click', () => {
  /* Despărțitorul e „;", dar primim și rândul nou: așa vine lista când o copiezi
     dintr-un document, iar a-l refuza ar fi o pedeapsă fără rost. Virgula NU e
     despărțitor: propozițiile au virgule în ele. */
  const bucati = String(elBankText.value || '')
    .split(/[;\n\r]+/).map((x) => x.trim()).filter(Boolean);
  if (!bucati.length) { elBankNota.textContent = 'Scrie măcar un cuvânt.'; return; }

  const fel = felulMesei();
  const inMasa = new Set(masa.map((r) => cheia(r.body)));
  let sarite = 0;
  for (const body of bucati) {
    const k = cheia(body);
    if (inMasa.has(k)) { sarite++; continue; }   // același cuvânt de două ori în listă
    inMasa.add(k);
    masa.push({ body, kind: fel, tags: new Set(), level: 2, gata: dejaInBanca.has(k) });
  }
  elBankText.value = '';
  elBankNota.textContent = sarite
    ? 'Am lăsat deoparte ' + cuDe(sarite, 'rând scris de două ori', 'rânduri scrise de două ori') + '.'
    : '';
  deseneazaMasa();
});

/* ---- Importul ---- */

elBankImporta?.addEventListener('click', async () => {
  const deTrimis = masa.filter((r) => !r.gata && r.tags.size);
  if (!deTrimis.length) { elBankNota.textContent = 'Bifează întâi la ce exerciții se potrivesc.'; return; }
  elBankImporta.disabled = true;
  elBankNota.textContent = 'Se salvează…';
  const { puse, sarite, motiv } = await addRows(LECTIE, deTrimis.map((r) => ({
    body: r.body, kind: r.kind, tags: [...r.tags], level: r.level,
  })));
  if (motiv) { elBankNota.textContent = motiv; potrivesteImportul(); return; }

  /* Ce a intrat iese din tabel; ce n-avea bifă rămâne, ca să nu se piardă din
     vedere. Așa tabelul arată chiar ce a mai rămas de făcut. */
  const intrate = new Set(puse.map((p) => cheia(p.body)));
  puse.forEach((p) => dejaInBanca.add(cheia(p.body)));
  masa = masa.filter((r) => !intrate.has(cheia(r.body)));

  /* Întâi cerem banca din nou, pe urmă scriem vorba de sfârșit: rândurile rămase
     află abia acum dacă sunt ori nu deja acolo, iar socoteala trebuie făcută pe
     adevărul de după salvare, nu pe cel de dinainte. */
  await deseneazaBanca();
  const faraBifa = masa.filter((r) => !r.gata && !r.tags.size).length;
  const vorbe = ['Am pus în bancă ' + cuDe(puse.length, 'intrare', 'intrări') + '.'];
  if (sarite) vorbe.push(cuDe(sarite, 'era deja acolo', 'erau deja acolo') + '.');
  if (faraBifa) vorbe.push('În tabel au rămas ' + cuDe(faraBifa, 'rând fără bifă', 'rânduri fără bifă') + '.');
  elBankNota.textContent = vorbe.join(' ');
  deseneazaMasa();
});

/* ---- Ce e deja în bancă ---- */

async function deseneazaBanca() {
  if (!elBankLista) return;
  elBankLista.textContent = 'Se încarcă…';
  const tot = await listAll(LECTIE);
  dejaInBanca = new Set(tot.map((it) => cheia(it.body)));
  /* Rândurile din tabel află și ele: dacă tocmai am pus un cuvânt, el nu mai
     are ce căuta a doua oară. */
  masa.forEach((r) => { r.gata = dejaInBanca.has(cheia(r.body)); });
  if (!tot.length) { elBankLista.textContent = 'Banca e goală încă.'; return; }
  elBankLista.innerHTML = tot.map((it) =>
    '<span class="bank-it">' + escapaText(it.body) +
    '<span class="bank-it__n">' + escapaText((it.tags || []).join(' · ')) + ' · ' + it.level + '</span>' +
    '<button class="bank-it__x" data-sterg="' + it.id + '" title="Scoate din bancă" aria-label="Scoate din bancă">×</button>' +
    '</span>').join('');
}

elBankLista && elBankLista.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-sterg]');
  if (!b) return;
  if (await deleteItem(b.dataset.sterg)) { await deseneazaBanca(); deseneazaMasa(); }
});

elBankBtn && elBankBtn.addEventListener('click', async () => {
  if (elBankNota) elBankNota.textContent = '';
  deseneazaMasa();
  deschideFereastra(dlgBank);
  await deseneazaBanca();
  deseneazaMasa();
});

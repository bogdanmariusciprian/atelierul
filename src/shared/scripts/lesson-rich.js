// =========================================================
// TEXTUL UNEI LECȚII: curățare și unelte de scriere.
//
// DE CE NU FOLOSEȘTE `rich-text.js`. Acela curăță textul itemilor de test și
// ține o listă albă ÎNGUSTĂ dinadins: îngroșat, înclinat, subliniat, atât.
// Nicio etichetă de bloc, niciun atribut. E folosit de testele de la Admitere
// Drept, iar lărgirea lui ar fi însemnat să ating ce merge acolo, printr-un
// fișier împărțit. Lecțiile au nevoie de paragrafe, titluri, liste și aliniere,
// deci capătă curățătorul lor. Cele două nu se amestecă.
//
// CE ÎNGĂDUIM, ȘI DE CE ATÂT. Elevul scrie, iar lecția se vede apoi de oricine,
// inclusiv de un vizitator nelogat: textul lui NU e de încredere niciodată,
// oricât drept i-ar fi dat profesorul. Deci se păstrează numai etichetele din
// listă și numai clasele din listă; orice altceva (stil, `href`, `onclick`,
// `style`, etichete necunoscute) se aruncă, iar textul dinăuntru rămâne.
//
// ALINIEREA E JUSTIFIED DIN OFICIU (cerută de Marius, 12 septembrie 2026): nu
// se scrie nicăieri, vine din foaia de stil. În text se însemnează doar
// ABATERILE de la ea, cu o clasă.
// Cuprins în română, nume în engleză.
// =========================================================

/* Etichetele îngăduite. `p` și `li` sunt vasele textului; restul le dau chip. */
const BLOCURI = new Set(["p", "h2", "h3", "ul", "ol", "li", "blockquote"]);
const INLINE = new Set(["b", "i", "u", "s", "sup", "sub", "mark", "br"]);

/* Clasele îngăduite, tot ca listă albă: fără ea, `class` ar fi o ușă deschisă
   spre orice regulă de stil din sit. */
const CLASE = new Set(["mic", "al-stanga", "al-centru", "al-dreapta"]);

/* Numele vechi ale aceleiași formatări, ca un text scris cu altă unealtă (ori
   lipit din Word) să nu-și piardă chipul: se aduc la cele de mai sus. */
const ALTFEL = {
  strong: "b", em: "i", ins: "u", strike: "s", del: "s",
  h1: "h2", h4: "h3", h5: "h3", h6: "h3", // o lecție n-are nevoie de șase trepte
  div: "p", section: "p", article: "p",
};

const escapeText = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/** Eticheta cu care rămâne un element, ori `null` dacă se aruncă (păstrându-i
 *  textul). Se uită și la STIL, nu doar la nume: browserele de pe telefon scriu
 *  uneori îngroșarea ca `<span style="font-weight:700">`, iar dacă ne-am lua
 *  numai după nume, formatarea ar pieri la salvare fără ca nimeni să priceapă
 *  de ce. (Lecția e scrisă în `rich-text.js`, pățită acolo.) */
function eticheta(el) {
  const nume = el.tagName.toLowerCase();
  if (BLOCURI.has(nume) || INLINE.has(nume)) return nume;
  if (ALTFEL[nume]) return ALTFEL[nume];

  const s = el.style || {};
  const fw = String(s.fontWeight || "").toLowerCase();
  if (fw === "bold" || fw === "bolder" || (/^\d+$/.test(fw) && Number(fw) >= 600)) return "b";
  const fst = String(s.fontStyle || "").toLowerCase();
  if (fst === "italic" || fst === "oblique") return "i";
  const dec = String(s.textDecoration || s.textDecorationLine || "").toLowerCase();
  if (dec.includes("underline")) return "u";
  if (dec.includes("line-through")) return "s";
  return null;
}

/** Clasa care rămâne pe un element: cea albă, ori cea care iese din alinierea
 *  scrisă în stil (browserele scriu alinierea ca `style="text-align:center"`). */
function clasa(el, numeEticheta) {
  const ale = [...(el.classList || [])].filter((c) => CLASE.has(c));
  if (ale.length) return ale[0];
  /* Doar blocurile poartă aliniere; pe un `<b>` n-ar avea niciun înțeles. */
  if (!BLOCURI.has(numeEticheta)) return "";
  const a = String((el.style && el.style.textAlign) || "").toLowerCase();
  if (a === "center") return "al-centru";
  if (a === "right") return "al-dreapta";
  if (a === "left" || a === "start") return "al-stanga";
  return "";
}

function serialize(node) {
  let out = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) { out += escapeText(n.nodeValue); return; }   // text
    if (n.nodeType !== 1) return;                                       // comentarii etc.
    const t = eticheta(n);
    if (t === "br") { out += "<br>"; return; }
    const inner = serialize(n);
    if (!t) { out += inner; return; }           // eticheta se aruncă, textul rămâne
    /* Un bloc gol n-are ce spune și n-ar face decât un gol pe ecran. */
    if (BLOCURI.has(t) && !inner.trim()) return;
    const c = clasa(n, t);
    out += `<${t}${c ? ` class="${c}"` : ""}>${inner}</${t}>`;
  });
  return out;
}

/** Text curat dintr-un text oarecare: semnele scăpate, numai etichetele și
 *  clasele din listele albe. */
export function sanitizeLesson(html) {
  if (html == null || html === "") return "";
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html);
  return serialize(tpl.content);
}

/** Textul gol-goluț, pentru căutare și pentru o privire scurtă. */
export function stripLesson(html) {
  if (html == null) return "";
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html);
  return (tpl.content.textContent || "").replace(/\s+/g, " ").trim();
}

/** Adevărat dacă n-a rămas nimic de citit (numai etichete goale). */
export function isLessonEmpty(html) {
  return stripLesson(html) === "";
}

// ---- uneltele de scriere, pentru un câmp editabil cu focus ----------------

/* Cerem etichete, nu stiluri: `<b>` trece prin curățare, iar `<span style>` ar
   fi aruncat. Se cere înaintea FIECĂREI porunci, fiindcă unele browsere uită
   steagul între două apăsări. */
function ensureTagMode() {
  try { document.execCommand("styleWithCSS", false, false); } catch { /* nu toate îl au */ }
  /* Enter să nască un PARAGRAF, nu un `<div>` (Chrome) ori un `<br>` (Firefox).
     Fără el, două browsere ar scoate din aceeași apăsare două forme deosebite,
     iar curățarea ar trebui să le împace pe amândouă la fiecare salvare. */
  try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* idem */ }
}

const porunca = (nume, val = null) => { ensureTagMode(); try { document.execCommand(nume, false, val); } catch { /* ignoră */ } };

/** Se cheamă la deschiderea unui câmp de scris: steagurile de mai sus sunt ale
 *  DOCUMENTULUI, nu ale câmpului, și trebuie puse înainte de prima tastă, nu
 *  abia la prima apăsare pe un buton din bară. */
export const prepareLessonField = () => ensureTagMode();

export const execBold = () => porunca("bold");
export const execItalic = () => porunca("italic");
export const execUnderline = () => porunca("underline");
export const execStrike = () => porunca("strikeThrough");

/** Treapta de text: titlu mare, titlu mic, text obișnuit, text mărunt.
 *  Marius a ales trepte, nu mărimi libere în puncte: așa lecțiile seamănă
 *  între ele și cu restul sitului, iar pe telefon se așază singure. */
export function execTreapta(treapta) {
  const bloc = treapta === "titlu-mare" ? "h2" : treapta === "titlu-mic" ? "h3" : "p";
  porunca("formatBlock", `<${bloc}>`);
  /* „Mărunt" e tot un paragraf, doar cu o clasă: o treaptă de mărime în plus,
     nu o treaptă de titlu. Clasa se pune de mână, fiindcă `execCommand` n-are
     poruncă pentru clase. */
  const b = blocCurent();
  if (b) b.classList.toggle("mic", treapta === "marunt");
}

/** Alinierea. Cea din oficiu (justified) nu se scrie: se șterg clasele de
 *  abatere și paragraful se întoarce la ce spune foaia de stil. */
export function execAliniere(unde) {
  const b = blocCurent();
  if (!b) return;
  b.classList.remove("al-stanga", "al-centru", "al-dreapta");
  if (unde === "stanga") b.classList.add("al-stanga");
  else if (unde === "centru") b.classList.add("al-centru");
  else if (unde === "dreapta") b.classList.add("al-dreapta");
}

export const execListaBuline = () => porunca("insertUnorderedList");
export const execListaNumere = () => porunca("insertOrderedList");

/** Intrarea și ieșirea dintr-un nivel de listă, adică legătura părinte-copil
 *  pe care a cerut-o Marius. Browserul face imbricarea (`<ul>` într-`<li>`),
 *  iar retragerea din pagină vine din foaia de stil, pe nivel. */
export const execIndent = () => porunca("indent");
export const execOutdent = () => porunca("outdent");

/** Blocul (paragraf, titlu, element de listă) în care stă cursorul. */
export function blocCurent() {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let n = sel.getRangeAt(0).startContainer;
  if (n.nodeType === 3) n = n.parentNode;
  while (n && n.nodeType === 1) {
    const t = n.tagName.toLowerCase();
    if (BLOCURI.has(t)) return n;
    if (n.isContentEditable && n.getAttribute("contenteditable") === "true") return null;
    n = n.parentNode;
  }
  return null;
}

/** Ce formatare e pornită acolo unde stă cursorul, ca butoanele din bară să se
 *  aprindă la fel. Păzit: `queryCommandState` aruncă fără o selecție vie. */
export function lessonFormatState() {
  const q = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
  const b = blocCurent();
  const t = b ? b.tagName.toLowerCase() : "";
  return {
    bold: q("bold"), italic: q("italic"), underline: q("underline"), strike: q("strikeThrough"),
    listaBuline: q("insertUnorderedList"), listaNumere: q("insertOrderedList"),
    treapta: t === "h2" ? "titlu-mare" : t === "h3" ? "titlu-mic"
      : (b && b.classList.contains("mic")) ? "marunt" : "obisnuit",
    aliniere: !b ? "justify"
      : b.classList.contains("al-centru") ? "centru"
      : b.classList.contains("al-dreapta") ? "dreapta"
      : b.classList.contains("al-stanga") ? "stanga" : "justify",
  };
}

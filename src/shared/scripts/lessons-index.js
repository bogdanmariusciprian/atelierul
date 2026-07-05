// =========================================================
// Lessons catalogue — single source of truth (DRY).
// `ready: true` + `href` + `slug` = lesson has a real page.
// `href` is the CLEAN root-relative URL (folder with index.html —
// no .html in the address). `slug` is the STABLE internal id used by
// exercises, progress, notebook links etc. — never rename it, even if
// the URL changes.
// Entries without `ready` are just planned titles (shown as
// "în curând", not clickable) so we can preview the structure.
// `domain` matches a slug in domains.js.
// =========================================================
export const LESSONS = [
  // ---------- Morfologie ----------
  {
    domain: "morfologie",
    slug: "morfologie-substantiv",
    title: "Substantivul: cazuri și funcții sintactice",
    href: "lectii/morfologie/substantivul/",
    summary: "Cele cinci cazuri și rolul substantivului în propoziție.",
    ready: true,
  },
  {
    domain: "morfologie",
    slug: "morfologie-verbul",
    title: "Verbul: moduri, timpuri și conjugare",
    href: "lectii/morfologie/verbul/",
    summary: "Moduri personale și nepersonale, timpuri și persoana/numărul.",
    ready: true,
  },
  {
    domain: "morfologie",
    slug: "morfologie-adjectivul",
    title: "Adjectivul: acord și grade de comparație",
    href: "lectii/morfologie/adjectivul/",
    summary: "Acordul cu substantivul și cele patru grade de comparație.",
    ready: true,
  },
  { domain: "morfologie", title: "Pronumele: tipuri și forme" },
  { domain: "morfologie", title: "Numeralul: cardinal, ordinal și celelalte" },
  { domain: "morfologie", title: "Articolul: hotărât, nehotărât, posesiv, demonstrativ" },
  { domain: "morfologie", title: "Adverbul și gradele lui de comparație" },
  { domain: "morfologie", title: "Prepoziția și regimul cazual" },
  { domain: "morfologie", title: "Conjuncția: coordonatoare și subordonatoare" },
  { domain: "morfologie", title: "Interjecția" },

  // ---------- Vocabular ----------
  {
    domain: "vocabular",
    slug: "vocabular-imbogatire",
    title: "Mijloacele de îmbogățire a vocabularului",
    href: "lectii/vocabular/imbogatirea-vocabularului/",
    summary: "Derivarea, compunerea, conversiunea și împrumuturile.",
    ready: true,
  },
  { domain: "vocabular", title: "Sinonimele" },
  { domain: "vocabular", title: "Antonimele" },
  { domain: "vocabular", title: "Omonimele" },
  { domain: "vocabular", title: "Paronimele" },
  { domain: "vocabular", title: "Cuvântul polisemantic. Sensurile cuvântului" },
  { domain: "vocabular", title: "Sensul propriu și sensul figurat" },
  { domain: "vocabular", title: "Familia lexicală și câmpul lexical" },
  { domain: "vocabular", title: "Arhaisme, regionalisme și neologisme" },

  // ---------- Fonetică ----------
  {
    domain: "fonetica",
    slug: "fonetica-grupuri-vocalice",
    title: "Grupurile de sunete vocalice: diftong, triftong, hiat",
    href: "lectii/fonetica/grupurile-vocalice/",
    summary: "Cum recunoști și desparți grupurile vocalice.",
    ready: true,
  },
  { domain: "fonetica", title: "Sunetul și litera. Alfabetul limbii române" },
  { domain: "fonetica", title: "Vocale, consoane și semivocale" },
  { domain: "fonetica", title: "Silaba" },
  { domain: "fonetica", title: "Despărțirea cuvintelor în silabe" },
  { domain: "fonetica", title: "Accentul" },
  { domain: "fonetica", title: "Grupurile de litere: ce, ci, ge, gi, che, chi, ghe, ghi" },
  { domain: "fonetica", title: "Corespondența sunet – literă" },

  // ---------- Sintaxa frazei ----------
  { domain: "sintaxa-frazei", title: "Propoziția și fraza" },
  { domain: "sintaxa-frazei", title: "Propoziția principală și propoziția secundară" },
  { domain: "sintaxa-frazei", title: "Coordonarea (copulativă, adversativă…)" },
  { domain: "sintaxa-frazei", title: "Subordonarea în frază" },
  { domain: "sintaxa-frazei", title: "Propoziția subordonată subiectivă" },
  { domain: "sintaxa-frazei", title: "Propoziția subordonată predicativă" },
  { domain: "sintaxa-frazei", title: "Propoziția subordonată atributivă" },
  { domain: "sintaxa-frazei", title: "Propoziția subordonată completivă directă" },
  { domain: "sintaxa-frazei", title: "Propozițiile circumstanțiale" },

  // ---------- Redactare ----------
  {
    domain: "redactare",
    slug: "redactare-text-argumentativ",
    title: "Textul argumentativ",
    href: "lectii/redactare/textul-argumentativ/",
    summary: "Structura unei argumentări clare și convingătoare.",
    ready: true,
  },
  { domain: "redactare", title: "Textul descriptiv" },
  { domain: "redactare", title: "Textul narativ (redactare)" },
  { domain: "redactare", title: "Rezumatul" },
  { domain: "redactare", title: "Caracterizarea unui personaj" },
  { domain: "redactare", title: "Scrisoarea și cererea" },
  { domain: "redactare", title: "Eseul structurat" },
  { domain: "redactare", title: "Comentariul literar" },
  { domain: "redactare", title: "Compunerea liberă" },

  // ---------- Lectură ----------
  {
    domain: "lectura",
    slug: "lectura-text-narativ",
    title: "Textul narativ: lectură și înțelegere",
    href: "lectii/lectura/textul-narativ/",
    summary: "Un text narativ cu întrebări de înțelegere.",
    ready: true,
  },
  { domain: "lectura", title: "Textul liric" },
  { domain: "lectura", title: "Textul dramatic" },
  { domain: "lectura", title: "Textul nonliterar" },
  { domain: "lectura", title: "Figurile de stil" },
  { domain: "lectura", title: "Moduri de expunere: narațiune, descriere, dialog" },
  { domain: "lectura", title: "Genurile literare: epic, liric, dramatic" },
  { domain: "lectura", title: "Ideea principală și ideea secundară" },
  { domain: "lectura", title: "Planul simplu și planul dezvoltat de idei" },
];

/** The lesson entry for a STABLE slug (or null). Use this instead of
 *  building URLs from the slug — the URL lives only in `href`. */
export function lessonBySlug(slug) {
  return LESSONS.find((l) => l.slug === slug) || null;
}

/** Clean root-relative URL for a slug ("" if the lesson has no page). */
export function lessonHrefBySlug(slug) {
  return lessonBySlug(slug)?.href || "";
}

/** The STABLE slug of the lesson page we're ON (reads data-lesson-slug,
 *  with a legacy fallback to the old filename convention). */
export function currentLessonSlug() {
  const el = document.querySelector("[data-lesson-slug]");
  if (el) return el.dataset.lessonSlug;
  const file = location.pathname.split("/").pop().replace(".html", "");
  return file === "index" || file === "" ? null : file;
}

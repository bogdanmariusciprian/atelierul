// =========================================================
// "Noutăți" content — hand-curated, local (no external API).
// Each rotating card picks one entry per day (or per week) so the
// homepage feels alive without any backend. Just add entries below;
// the rotation adapts to the list length automatically.
//
// Content is in Romanian (site language); code identifiers stay English.
// dexonline.ro is used only as a useful outbound link, never as an API.
// =========================================================

// --- Cuvântul zilei (rotates daily) -----------------------
// `href` points to the word's dexonline page (plain link, no API).
export const WORDS_OF_DAY = [
  {
    word: "a dezmierda",
    pos: "verb",
    def: "A mângâia cu duioșie; a alinta.",
    example: "Își dezmierda copilul adormit.",
    href: "https://dexonline.ro/definitie/dezmierda",
  },
  {
    word: "efemer",
    pos: "adjectiv",
    def: "Care ține foarte puțin timp; trecător.",
    example: "O bucurie efemeră.",
    href: "https://dexonline.ro/definitie/efemer",
  },
  {
    word: "a cutreiera",
    pos: "verb",
    def: "A umbla în toate părțile; a colinda.",
    example: "A cutreierat toată țara pe jos.",
    href: "https://dexonline.ro/definitie/cutreiera",
  },
  {
    word: "dor",
    pos: "substantiv",
    def: "Dorință puternică de a revedea pe cineva sau ceva drag.",
    example: "Îl cuprinse dorul de casă.",
    href: "https://dexonline.ro/definitie/dor",
  },
  {
    word: "a tăinui",
    pos: "verb",
    def: "A ține ascuns; a nu dezvălui.",
    example: "Și-a tăinuit multă vreme gândurile.",
    href: "https://dexonline.ro/definitie/tainui",
  },
  {
    word: "mărinimos",
    pos: "adjectiv",
    def: "Generos, darnic, iertător.",
    example: "Un gest mărinimos, făcut din inimă.",
    href: "https://dexonline.ro/definitie/marinimos",
  },
];

// --- Știați că… (rotates daily) ---------------------------
export const DID_YOU_KNOW = [
  {
    title: "Cel mai neregulat verb",
    text: "Verbul „a fi” își ia formele din rădăcini latine diferite: sunt, ești, este — de aceea nu seamănă între ele.",
  },
  {
    title: "„î” la margini, „â” la mijloc",
    text: "Se scrie „î” la începutul și la sfârșitul cuvântului (a începe, a coborî) și „â” în interior (român, a cânta).",
  },
  {
    title: "Substantive fără plural",
    text: "Unele substantive n-au plural (curaj, miere), altele n-au singular (zori, câlți). Se numesc defective de număr.",
  },
  {
    title: "Grupurile „ch” și „gh”",
    text: "Redau sunetele /k/ și /g/ înaintea lui e și i: chip, chin, ghem, ghid.",
  },
  {
    title: "Un vocativ moștenit",
    text: "Terminația de vocativ „-le” (băiete, omule) e o formă pe care puține limbi romanice o mai păstrează.",
  },
];

// --- Greșeala săptămânii (rotates weekly) -----------------
export const WEEKLY_MISTAKES = [
  {
    title: "„decât” vs. „doar”",
    wrong: "Decât tu poți face asta.",
    right: "Doar tu poți face asta.",
    note: "„decât” se folosește cu negație: „Nu am decât un leu.”",
  },
  {
    title: "„care” vs. „pe care”",
    wrong: "Cartea care am citit-o…",
    right: "Cartea pe care am citit-o…",
    note: "Când e complement direct, se folosește „pe care”.",
  },
  {
    title: "Virgula înainte de „și”",
    wrong: "A venit Ion, și Maria.",
    right: "A venit Ion și Maria.",
    note: "De regulă nu se pune virgulă înaintea lui „și” copulativ.",
  },
  {
    title: "„ca și” de prisos",
    wrong: "E bun ca și profesor.",
    right: "E bun ca profesor.",
    note: "„ca și” se justifică doar pentru a evita o cacofonie (ca și când).",
  },
  {
    title: "„i-a” vs. „ia”",
    wrong: "Ia dat cartea înapoi.",
    right: "I-a dat cartea înapoi.",
    note: "„i-a” = pronume + auxiliar; „ia” = forma verbului a lua.",
  },
];

// --- Paronime (rotates daily) -----------------------------
export const PARONYMS = [
  { a: "a evalua", aDef: "a aprecia valoarea", b: "a evolua", bDef: "a se dezvolta în timp" },
  { a: "oral", aDef: "rostit, referitor la gură", b: "orar", bDef: "program al orelor" },
  { a: "a enerva", aDef: "a irita pe cineva", b: "a inerva", bDef: "(despre nervi) a alimenta un organ" },
  { a: "familiar", aDef: "cunoscut, apropiat", b: "familial", bDef: "referitor la familie" },
  { a: "temporal", aDef: "referitor la timp", b: "temporar", bDef: "provizoriu, de scurtă durată" },
];

// --- Citatul zilei (rotates daily) ------------------------
export const QUOTES = [
  { text: "Limba este întâiul mare poem al unui popor.", author: "Lucian Blaga" },
  { text: "Nu credeam să-nvăț a muri vreodată.", author: "Mihai Eminescu" },
  { text: "E ușor a scrie versuri când nimic nu ai a spune.", author: "Mihai Eminescu" },
  { text: "Sunt suflet în sufletul neamului meu.", author: "George Coșbuc" },
];

// --- Din DOOM (rotates weekly) ----------------------------
export const DOOM_NOTES = [
  { title: "niciun / nicio", text: "Se scriu legat: niciun elev, nicio problemă — nu „nici un”." },
  { title: "„odată” / „o dată”", text: "„odată” = cândva; „o dată” = o singură ocazie. „A fost odată…”, „Am fost o dată acolo.”" },
  { title: "cu cratimă", text: "Se scriu cu cratimă: într-un an, dintr-o carte, de-a lungul." },
  { title: "„copiii” cu trei i", text: "copil → copii (plural) + articolul -i = copiii." },
  { title: "„ce-i” / „cei”", text: "„ce-i” = ce + îi/este; „cei” = articol demonstrativ: cei buni." },
];

// --- Provocarea zilei (rotates daily) ---------------------
// The answer is hidden until the reader clicks "Vezi răspunsul".
export const CHALLENGES = [
  {
    question: "În „Aleargă repede”, ce parte de vorbire e „repede”?",
    answer: "Adverb de mod — arată cum se desfășoară acțiunea.",
  },
  {
    question: "Care e forma corectă: „vroiam” sau „voiam”?",
    answer: "„voiam” — de la verbul „a voi”. „vroiam” e greșit (contaminare cu „a vrea”).",
  },
  {
    question: "Ce caz cere prepoziția „datorită”?",
    answer: "Dativul: „datorită prietenilor”, „datorită efortului”.",
  },
  {
    question: "„mi-ai” sau „miai”?",
    answer: "„mi-ai” — pronume + auxiliar, se scrie cu cratimă.",
  },
  {
    question: "Ce funcție are „o” în „O carte nouă”?",
    answer: "Articol nehotărât — însoțește substantivul „carte”.",
  },
];

// --- Ce-i nou pe Atelier (fixed changelog, newest first) --
export const WHATS_NEW = [
  { text: "Panoul de lecții are acum extindere pe verticală." },
  { text: "Lecție nouă: Adjectivul." },
  { text: "Exerciții adăugate la Verbul." },
];

// --- Linkuri utile (fixed, left column) -------------------
export const USEFUL_LINKS = [
  { label: "dexonline.ro", note: "Dicționar explicativ", href: "https://dexonline.ro" },
  { label: "DOOM 3", note: "Norme ortografice", href: "https://dexonline.ro" },
  { label: "Sinonime & antonime", note: "Caută pe dexonline", href: "https://dexonline.ro" },
];

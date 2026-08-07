// =========================================================
// Ce fel de material are tabla fiecărei lecții.
//
// DE CE UN REGISTRU. Până acum, felurile de material („cuvinte", „structuri",
// „propoziții") și etichetele lor stăteau în `bank-repo.js`, adică lângă
// cererile către baza de date. Mergea cât timp exista o singură tablă, cea de
// fonetică. Dar tabla de la textul argumentativ nu va ține cuvinte, ci corpusuri
// de texte; cea de la sintaxă, altceva. Dacă lăsam felurile lângă cereri, ar fi
// trebuit ca fiecare tablă nouă să umble în codul care vorbește cu serverul.
//
// Aici e altfel: o lecție își descrie materialul, iar restul codului doar
// citește descrierea. Tabla o citește ca să știe ce să ceară generatorului;
// panoul profesorului o citește ca să știe ce coloane să pună în tabel. O tablă
// nouă înseamnă o intrare nouă în registrul de mai jos și nimic altceva.
//
// CE ÎNSEAMNĂ CUVINTELE:
//   fel      = ce fel de lucru e materialul. Ajunge în coloana `kind`.
//   eticheta = la ce exercițiu se potrivește. Ajunge în lista `tags`.
//   fața     = numărul de pe zar, pentru tablele care au zar.
//
// Un material are UN fel și POATE AVEA MAI MULTE etichete: „iarnă" e bun și la
// litere și sunete, și la despărțirea în silabe. De-aia felul e coloană, iar
// eticheta e listă.
// =========================================================

/** Registrul. Cheia e slugul stabil al lecției, cel din `lessons-index.js`. */
export const MATERIAL_PE_LECTIE = {
  "fonetica-introducere": {
    nume: "Banca de material",
    lamurire: "Din ea scoate generatorul cuvintele cu care se umple tabla.",
    feluri: [
      {
        kind: "cuvant",
        nume: "cuvinte",
        unul: "cuvânt",
        pilda: "iarnă; piatră; împărăteasă",
        etichete: [
          { slug: "litere-sunete", nume: "Litere și sunete" },
          { slug: "grupuri", nume: "Grupuri de sunete" },
          { slug: "pseudogrup", nume: "Pseudogrup" },
          { slug: "consoane-speciale", nume: "Consoane speciale" },
          { slug: "silabe", nume: "Despărțire în silabe" },
          { slug: "valoarea-i", nume: "Valoarea lui i" },
        ],
      },
      {
        kind: "structura",
        nume: "structuri fonetice",
        unul: "structură",
        pilda: "cvcv; ccvc; cvcvc",
        etichete: [{ slug: "structuri", nume: "Structuri fonetice" }],
      },
      {
        kind: "propozitie",
        nume: "propoziții",
        unul: "propoziție",
        pilda: "Ana are mere.",
        etichete: [{ slug: "propozitii", nume: "Transcrierea unei propoziții" }],
      },
    ],
    // Fețele zarului de pe tabla de fonetică. Numărul care pică hotărăște ce
    // material cere generatorul. Tablele fără zar n-au câmpul ăsta.
    fete: {
      1: { kind: "cuvant", eticheta: "litere-sunete", nume: "Litere și sunete" },
      2: { kind: "cuvant", eticheta: "grupuri", nume: "Grupuri de sunete" },
      3: { kind: "cuvant", eticheta: "silabe", nume: "Despărțire în silabe" },
      4: { kind: "cuvant", eticheta: "valoarea-i", nume: "Valoarea lui i" },
      5: { kind: "structura", eticheta: "structuri", nume: "Structuri fonetice" },
      6: { kind: "propozitie", eticheta: "propozitii", nume: "Transcrierea unei propoziții" },
    },
  },
};

/**
 * Lecțiile care au o pagină de tablă (#LaTablă).
 *
 * E o listă aparte de registrul de mai sus, și nu din lene: sunt două lucruri
 * deosebite. Registrul spune CE MATERIAL ține tabla; lista de față spune că
 * EXISTĂ o pagină de tablă. Sintaxa frazei are tablă, dar nu ține încă material
 * în bancă; o lecție viitoare ar putea ține material fără să aibă tablă.
 *
 * Adresa paginii se face din adresa lecției plus „tabla/", fiindcă așa sunt
 * așezate în folder. Dacă vreodată nu va mai fi așa, aici se schimbă.
 */
export const LECTII_CU_TABLA = ["fonetica-introducere", "sintaxa-frazei-introducere"];

/** Are lecția asta o tablă de deschis? */
export function areTabla(lessonSlug) {
  return LECTII_CU_TABLA.includes(lessonSlug);
}

/** Descrierea materialului unei lecții, ori `null` dacă lecția n-are încă tablă. */
export function materialulLectiei(lessonSlug) {
  return MATERIAL_PE_LECTIE[lessonSlug] || null;
}

/** Slugurile lecțiilor care au material. Pentru numărători și pentru bară. */
export function lectiiCuMaterial() {
  return Object.keys(MATERIAL_PE_LECTIE);
}

/** Un fel anume din descrierea unei lecții („cuvant" la fonetică). */
export function felulMaterialului(lessonSlug, kind) {
  const m = materialulLectiei(lessonSlug);
  if (!m) return null;
  return m.feluri.find((f) => f.kind === kind) || null;
}

/** Toate etichetele unui fel. Astea sunt coloanele din tabelul profesorului. */
export function eticheteleFelului(lessonSlug, kind) {
  return felulMaterialului(lessonSlug, kind)?.etichete || [];
}

/** Ce cere zarul când pică fața asta. `null` dacă lecția n-are zar. */
export function fataZarului(lessonSlug, fata) {
  return materialulLectiei(lessonSlug)?.fete?.[fata] || null;
}

/** Numele etichetei, pentru afișare („litere-sunete" → „Litere și sunete"). */
export function numeleEtichetei(lessonSlug, eticheta) {
  const m = materialulLectiei(lessonSlug);
  if (!m) return eticheta;
  for (const fel of m.feluri) {
    const e = fel.etichete.find((x) => x.slug === eticheta);
    if (e) return e.nume;
  }
  return eticheta;
}

/**
 * Cheia după care două intrări sunt „același lucru".
 *
 * Trebuie să dea exact ce dă indexul unic din 0078, adică `lower(btrim(body))`:
 * altfel panoul ar spune „e nou" despre un cuvânt pe care baza îl respinge.
 * Diacriticele NU se scot: „casa" și „casă" sunt două cuvinte deosebite, iar la
 * o lecție de fonetică deosebirea e chiar lucrul care se învață.
 *
 * Stă aici, nu lângă cererile către server, fiindcă e o regulă curată, fără
 * rețea: așa o pot folosi și panourile, fără să tragă după ele tot clientul.
 */
export function cheia(text) {
  return String(text || "").trim().toLowerCase();
}

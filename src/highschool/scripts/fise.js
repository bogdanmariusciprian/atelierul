// =========================================================
// FIȘELE DE LECȚIE, lista lor.
//
// Fișele sunt fișiere HTML de sine stătătoare, scrise de Marius: își poartă
// singure stilurile și scripturile, fără nicio legătură spre altceva. De aceea
// se arată NEATINSE, într-un cadru al lor (`<iframe>`), nu desfăcute și puse la
// loc de mine. Așa arată la clasă exact ca pe disc, iar stilurile lor nu se
// amestecă cu ale modulului, în niciun sens.
//
// DE CE O LISTĂ SCRISĂ DE MÂNĂ. Un sit fără server nu poate întreba ce fișiere
// sunt într-un folder; cineva trebuie să le numere. Iar o fișă nouă cere oricum
// un commit (fișierul intră în depozit), deci un rând în plus aici nu adaugă
// nicio bătaie de cap.
//
// CA SĂ ADAUGI O FIȘĂ:
//   1. pui fișierul în `liceu/fise/`, cu numele lui cu tot;
//   2. adaugi un rând mai jos, cu același nume, literă cu literă.
// Numele se scrie o singură dată aici și e chiar numele fișierului: dacă nu se
// potrivesc, fișa nu se deschide, și se vede pe loc.
//
// TREI ÎNSUȘIRI CARE POT SĂ LIPSEASCĂ:
//   · `cale`  – o fișă care nu stă în `liceu/fise/`, ci în altă parte a sitului.
//               Se scrie calea întreagă, de la rădăcină. Luceafărul e o lecție
//               a sitului, la `lectii/lectura/`, și se arată de-acolo: copiată
//               și aici, ar fi fost al doilea exemplar de 280 KB, care se
//               depărtează de primul la întâia corectură.
//   · `fel`   – litera A/B/C. Clasele a 12-a merg pe planificarea de bacalaureat
//               și au altă socoteală, pe care Marius mi-o spune; până atunci
//               fișele lor n-au literă, în loc să poarte una ghicită.
//   · `ora`   – poate fi un număr ori mai multe. O lecție care ține trei ore are
//               aceeași fișă la toate trei, și toate trei se deschid.
// Cuprins în română, nume în engleză.
// =========================================================

/** Ce e fiecare literă, după înțelesul dat de Marius fișelor. */
export const FELUL_FISEI = {
  A: { nume: "Fișa A", ce: "teorie extinsă, de printat pentru elevi" },
  B: { nume: "Fișa B", ce: "pentru tabla interactivă, în timpul orei" },
  C: { nume: "Fișa C", ce: "schița planului de lecție" },
};

export const FISE = [
  {
    clasa: "9B", ora: 4, fel: "B",
    titlu: "Oralitate și scris. Literatura ca reprezentare, instituție și creație",
    fisier: "9B. Ora 4. B. Oralitate și scris. Literatura ca reprezentare, instituție și creație.html",
  },
  {
    clasa: "9B", ora: 5, fel: "B",
    titlu: "Literatura în timp. Epoci, școli literare și schimbarea temelor",
    fisier: "9B. Ora 5. B. Literatura în timp. Epoci, școli literare și schimbarea temelor.html",
  },
  {
    clasa: "10D", ora: 5, fel: "B",
    titlu: "De la basmul popular la basmul cult",
    fisier: "10D. Ora 5. B. De la basmul popular la basmul cult.html",
  },
  {
    clasa: "11D", ora: 4, fel: "B",
    titlu: "Originile și evoluția limbii române. Substrat, strat, adstrat",
    fisier: "11D. Ora 4. B. Originile și evoluția limbii române. Substrat, strat, adstrat.html",
  },
  /* Luceafărul ține orele 7, 8 și 9 la amândouă clasele a 12-a (migrarea 0093),
     deci se deschide de pe oricare dintre ele. */
  {
    clasa: "12C", ora: [7, 8, 9],
    titlu: "Mihai Eminescu, „Luceafărul” – poemul întreg, cu adnotări",
    cale: "lectii/lectura/luceafarul/index.html",
  },
  {
    clasa: "12D", ora: [7, 8, 9],
    titlu: "Mihai Eminescu, „Luceafărul” – poemul întreg, cu adnotări",
    cale: "lectii/lectura/luceafarul/index.html",
  },
].map((f) => {
  const ore = Array.isArray(f.ora) ? [...f.ora].sort((a, b) => a - b) : [f.ora];
  return {
    ...f,
    /* `ore` e lista întreagă; `ora` rămâne prima, fiindcă de ea atârnă numele
       scurt și rânduirea, iar amândouă vor un singur număr. */
    ore,
    ora: ore[0],
    /* Un nume scurt pentru adresă, fără diacritice și fără spații: „9b-4-b".
       Fără literă iese „12c-7". Litera se lipește scris, nu prin `filter`:
       o listă curățată cu `Boolean` ar fi înghițit și un zero, iar numele ar fi
       ieșit altul decât se citește de aici. */
    id: `${f.clasa}-${ore[0]}${f.fel ? `-${f.fel}` : ""}`.toLowerCase(),
  };
});

/** Fișele unei clase, în ordinea orelor. */
export const fiseleClasei = (clasa) =>
  FISE.filter((f) => f.clasa === clasa)
    .sort((a, b) => a.ora - b.ora || String(a.fel || "").localeCompare(String(b.fel || "")));

export const fisaDupaId = (id) =>
  FISE.find((f) => f.id === String(id || "").toLowerCase()) || null;

/**
 * Adresa fișierului.
 *
 * Numele au spații, puncte și diacritice, deci se trec prin
 * `encodeURIComponent`; altfel prima cratimă din ele ar rupe adresa. La o cale
 * întreagă, codarea se face pe bucăți: `encodeURIComponent` pe toată calea ar fi
 * prefăcut și liniuțele de despărțire în `%2F`, iar adresa n-ar mai fi arătat
 * spre niciun folder.
 */
export const adresaFisei = (f, basePath = "") => (
  f.cale
    ? `${basePath}${f.cale.split("/").map(encodeURIComponent).join("/")}`
    : `${basePath}liceu/fise/${encodeURIComponent(f.fisier)}`
);

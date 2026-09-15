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
].map((f) => ({
  ...f,
  /* Un nume scurt pentru adresă, fără diacritice și fără spații: „9b-4-b". */
  id: `${f.clasa}-${f.ora}-${f.fel}`.toLowerCase(),
}));

/** Fișele unei clase, în ordinea orelor. */
export const fiseleClasei = (clasa) =>
  FISE.filter((f) => f.clasa === clasa)
    .sort((a, b) => a.ora - b.ora || a.fel.localeCompare(b.fel));

export const fisaDupaId = (id) =>
  FISE.find((f) => f.id === String(id || "").toLowerCase()) || null;

/** Adresa fișierului. Numele are spații, puncte și diacritice, deci se trece
 *  prin `encodeURIComponent`; altfel prima cratimă din el ar rupe adresa. */
export const adresaFisei = (f, basePath = "") =>
  `${basePath}liceu/fise/${encodeURIComponent(f.fisier)}`;

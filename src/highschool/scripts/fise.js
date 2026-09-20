// =========================================================
// FIȘELE DE LECȚIE: lista lor, ținută în bază (migrarea 0096).
//
// Fișele sunt pagini HTML de sine stătătoare, scrise de Marius: își poartă
// singure stilurile și scripturile, fără nicio legătură spre altceva. De aceea
// se arată NEATINSE, într-un cadru al lor (`<iframe>`), nu desfăcute și puse la
// loc de mine. Așa arată la clasă exact cum arată pe disc.
//
// UNDE STAU FIȘIERELE. În găleata privată `liceu-fise` din Supabase (migrarea
// 0095), nu în depozit. Găleata se uită la cine cere și la semnul „Liceu
// deschis": cu semnul stins, fișierul nu se dă nimănui afară de profesor. Cât au
// stat în depozit, GitHub le dădea oricui le știa adresa.
// Fac excepție fișele cu `cale`: acelea sunt lecții publice ale sitului și
// acolo le e locul (deocamdată Luceafărul, la `lectii/lectura/`).
//
// DE CE NU MAI E O LISTĂ SCRISĂ DE MÂNĂ. A fost, până acum: o fișă nouă cerea
// fișierul urcat, un rând scris aici și un commit – trei pași, doi dintre ei pe
// umerii altcuiva decât ai lui Marius. Acum rândul se scrie singur, din modul,
// când urcă fișa.
//
// LISTA SE AJUNGE O DATĂ, la deschiderea modulului, și rămâne în memorie. Sunt
// vreo zece rânduri; o cerere la fiecare ecran ar fi fost risipă, iar ecranele
// care le caută (lista clasei, ruta unei fișe) se desenează din secundă în
// secundă.
// Cuprins în română, nume în engleză.
// =========================================================
import { fetchFise } from "./liceu-repo.js";

/** Ce e fiecare literă, după înțelesul dat de Marius fișelor. */
export const FELUL_FISEI = {
  A: { nume: "Fișa A", ce: "teorie extinsă, de printat pentru elevi" },
  B: { nume: "Fișa B", ce: "pentru tabla interactivă, în timpul orei" },
  C: { nume: "Fișa C", ce: "schița planului de lecție" },
};

/* Lista, cât ține pagina. Începe goală: până sosește, ecranele arată orele fără
   fișe, nu o listă veche și mincinoasă. */
let FISE = [];

/** Un rând din bază, adus la forma cu care lucrează modulul. */
function dinBaza(r) {
  const ore = (Array.isArray(r.ore) ? r.ore : [r.ore]).map(Number).sort((a, b) => a - b);
  return {
    clasa: r.clasa,
    ore,
    /* `ora` e prima dintre ele: de ea atârnă rânduirea, iar aceea vrea un singur
       număr. `ore` rămâne lista întreagă, fiindcă o lecție de o săptămână are
       aceeași fișă la toate orele ei. */
    ora: ore[0],
    fel: r.fel || "",
    titlu: r.titlu || "",
    /* Numele scurt al materialului, cel de pe rândul lui („Particularități").
       `titlu` e titlul LECȚIEI, același pentru toate materialele unei ore, deci
       nu le poate deosebi între ele. Gol înseamnă „arată titlul". */
    nume: r.nume || "",
    format: r.format === "pdf" ? "pdf" : "html",
    ordine: Number(r.ordine) || 1,
    /* `id` e numele scurt din adresă („11d-5-b"), nu `id`-ul din bază: un `uuid`
       în bara browserului n-ar spune nimănui nimic. */
    id: r.slug,
    fisier: r.fisier || "",
    cale: r.cale || "",
  };
}

/** Ce scrie pe rândul unui material. */
export const numeleMaterialului = (f) =>
  f?.nume || FELUL_FISEI[f?.fel]?.nume || f?.titlu || "Material";

/** Aduce lista. Se cheamă o dată, la pornirea modulului. */
export async function aduFisele() {
  FISE = (await fetchFise()).map(dinBaza);
  return FISE;
}

/** Fișele unei clase, în ordinea orelor. */
export const fiseleClasei = (clasa) =>
  FISE.filter((f) => f.clasa === clasa).sort(randuieste);

/** Ordinea a două materiale: întâi ora, apoi ce-ai cerut tu, apoi litera. */
function randuieste(a, b) {
  return a.ora - b.ora
    || a.ordine - b.ordine
    || String(a.fel).localeCompare(String(b.fel))
    || String(a.id).localeCompare(String(b.id));
}

/**
 * Materialele fiecărei ore, grupate.
 *
 * O ORĂ POATE ȚINE ORICÂTE. Până la migrarea 0101 era cel mult unul, și de-aia
 * codul de deasupra lucra cu o hartă „ora → materialul". Acum harta duce la o
 * LISTĂ, iar rândul orei se desface dedesubt dacă are mai mult de unul.
 *
 * Un material atârnat de mai multe ore (Luceafărul, pe 7, 8 și 9) intră în
 * lista fiecăreia dintre ele: e același lucru, arătat de unde ajungi la el.
 */
export function materialelePeOra(fise) {
  const peOra = new Map();
  fise.forEach((f) => f.ore.forEach((o) => {
    if (!peOra.has(o)) peOra.set(o, []);
    peOra.get(o).push(f);
  }));
  peOra.forEach((lista) => lista.sort(randuieste));
  return peOra;
}

export const fisaDupaId = (id) =>
  FISE.find((f) => f.id === String(id || "").toLowerCase()) || null;

/**
 * Numele fișei în găleată.
 *
 * SCURT ȘI FĂRĂ DIACRITICE, fiindcă Supabase nu le primește în chei: filtrul lui
 * lasă doar litere latine, cifre și câteva semne, iar un „ț" oprește urcarea cu
 * „File name is invalid". E chiar `id`-ul fișei, deci nu se poate nepotrivi cu
 * lista.
 */
export const cheiaFisei = (f) => f.fisier || `${f.id}.${f.format === "pdf" ? "pdf" : "html"}`;

/**
 * Numele scurt al unui material NOU, și cheia lui din găleată.
 *
 * ERA „clasa-ora-fel", și ținea cât timp o oră avea un singur material. Din
 * clipa în care poate ține trei, numele acela se repetă, iar baza îl refuză
 * (`unique (an_scolar, slug)`) ori, mai rău, fișierul din găleată s-ar fi scris
 * peste altul. Așa că, de la al doilea încolo, se pune o coadă: „12c-7",
 * „12c-7-2", „12c-7-3". Primul rămâne fără coadă, ca adresele de până azi să nu
 * se schimbe.
 *
 * `luate` sunt numele deja folosite; se caută primul liber, nu se numără câte
 * sunt: după o ștergere, numărătoarea ar fi dat peste un nume care există încă.
 */
export function numeNouDeMaterial(clasa, ora, fel, luate = []) {
  const stiute = new Set(luate.map((x) => String(x).toLowerCase()));
  const temei = [clasa, ora, fel]
    .filter((x) => x !== "" && x != null).join("-").toLowerCase();
  if (!stiute.has(temei)) return temei;
  for (let i = 2; i < 1000; i++) {
    if (!stiute.has(`${temei}-${i}`)) return `${temei}-${i}`;
  }
  /* O mie de materiale la aceeași oră nu se va întâmpla, dar un nume care se
     repetă ar strica fișa altcuiva, deci mai bine ceva ce sigur nu se repetă. */
  return `${temei}-${Date.now().toString(36)}`;
}

/** Cheia din găleată a unui material nou: numele lui, plus coada fișierului. */
export const cheiaNoua = (nume, format) =>
  `${nume}.${format === "pdf" ? "pdf" : "html"}`.toLowerCase();

/** Ce fel de fișier e, după coada numelui de pe disc. */
export const formatulFisierului = (numeDePeDisc) =>
  /\.pdf$/i.test(String(numeDePeDisc || "")) ? "pdf" : "html";

/** Numele fișierului fără coada lui, ca nume scurt propus la urcare. */
export const numeDinFisier = (numeDePeDisc) =>
  String(numeDePeDisc || "").replace(/\.[^.]+$/, "").trim();

/**
 * Adresa unei fișe care stă ÎN SIT, nu în găleată (deocamdată Luceafărul).
 *
 * Codarea se face pe bucăți: `encodeURIComponent` pe toată calea ar fi prefăcut
 * și liniuțele de despărțire în `%2F`, iar adresa n-ar mai fi arătat spre niciun
 * folder.
 */
export const adresaFisei = (f, basePath = "") =>
  `${basePath}${String(f.cale || "").split("/").map(encodeURIComponent).join("/")}`;

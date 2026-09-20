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
    /* `id` e numele scurt din adresă („11d-5-b"), nu `id`-ul din bază: un `uuid`
       în bara browserului n-ar spune nimănui nimic. */
    id: r.slug,
    fisier: r.fisier || "",
    cale: r.cale || "",
  };
}

/** Aduce lista. Se cheamă o dată, la pornirea modulului. */
export async function aduFisele() {
  FISE = (await fetchFise()).map(dinBaza);
  return FISE;
}

/** Fișele unei clase, în ordinea orelor. */
export const fiseleClasei = (clasa) =>
  FISE.filter((f) => f.clasa === clasa)
    .sort((a, b) => a.ora - b.ora || String(a.fel).localeCompare(String(b.fel)));

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
export const cheiaFisei = (f) => f.fisier || `${f.id}.html`;

/** Numele pe care-l va purta în găleată o fișă nouă: „11d-5-b.html". */
export const cheiaNoua = (clasa, ora, fel) =>
  `${[clasa, ora, fel].filter((x) => x !== "" && x != null).join("-")}.html`.toLowerCase();

/**
 * Adresa unei fișe care stă ÎN SIT, nu în găleată (deocamdată Luceafărul).
 *
 * Codarea se face pe bucăți: `encodeURIComponent` pe toată calea ar fi prefăcut
 * și liniuțele de despărțire în `%2F`, iar adresa n-ar mai fi arătat spre niciun
 * folder.
 */
export const adresaFisei = (f, basePath = "") =>
  `${basePath}${String(f.cale || "").split("/").map(encodeURIComponent).join("/")}`;

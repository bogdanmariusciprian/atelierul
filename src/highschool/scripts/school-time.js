// =========================================================
// ÎN CE STARE E CEASUL ȘCOLII, fără niciun ecran.
//
// Fișierul nu atinge pagina. Ia orele zilei și momentul, și spune în care din
// cinci stări ești. Stările sunt cele din aplicația de pe disc, fiindcă sunt
// bine alese:
//
//   ora      – ești într-o oră; se numără cât a mai rămas din ea
//   pauza    – între două ore; se numără până la următoarea
//   inainte  – înainte de prima oră a zilei („prima oră")
//   gata     – s-au terminat orele de azi
//   liber    – azi n-ai ore (zi fără ore în orar, zi liberă ori vacanță);
//              se arată prima oră din următoarea zi de școală
//
// SOCOTELILE SUNT ÎN MINUTE DE LA MIEZUL NOPȚII, numere întregi. Cu obiecte
// `Date` s-ar fi strecurat fusul orar și ora de vară acolo unde n-au ce căuta:
// aici nu se compară momente, se compară poziții în ziua de școală.
//
// Ținut deoparte de desen ca să se poată încerca la rece, cu un ceas mincinos.
// Cuprins în română, nume în engleză.
// =========================================================

const ZILE = ["luni", "marti", "miercuri", "joi", "vineri", "sambata", "duminica"];
export const LUCRATOARE = ["luni", "marti", "miercuri", "joi", "vineri"];

/** Numele zilei, ca în orar. */
export const numeZi = (d = new Date()) => ZILE[(d.getDay() + 6) % 7];

/** „15:40" → 940. Ce nu se poate citi dă `null`, nu zero: zero e miezul nopții,
 *  o valoare adevărată, iar confuzia ar fi scos ora de la 8:00 din zi. */
export function minute(hhmm) {
  const m = String(hhmm ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

/** „8:00" → „08:00", ca cifrele să stea una sub alta. */
export const ora2 = (t) => String(t ?? "").padStart(5, "0");

/** 197 → „3 h 17 min". Scurt, cum îl scria și aplicația de pe disc. */
export const scurt = (min) => {
  const m = Math.max(0, Math.round(min));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

/**
 * În ce stare ești.
 *
 * @param {object} cfg
 * @param {Date}   cfg.acum         momentul (se dă din afară ca să poată fi mințit la probe)
 * @param {Array}  cfg.oreleZilei   orele de azi, de la `fetchZiua`
 * @param {Array}  [cfg.saptamana]  orarul întreg, pentru zilele fără ore
 * @param {Array}  [cfg.intervale]  ceasurile intervalelor, pentru aceleași zile
 * @param {(d: Date) => {fel, eticheta}} [cfg.felZi]  felul unei zile, din structura
 *        anului: „curs", „liber", „vacanta" ori „special" (Școala altfel, Săptămâna verde)
 * @param {(d: Date) => Array} [cfg.saptamanaLa]  orarul în vigoare la o zi; anul are
 *        mai multe orare, iar următoarea zi de școală poate cădea în altul
 * @returns {{fel, ora?, ramas?, trecut?, durata?, pana?, secPana?, urmZi?, urmData?,
 *            urmPeste?, ultima?, motiv?, eticheta?, special?}}
 */
export function stareaDeAcum({ acum = new Date(), oreleZilei = [],
                               saptamana = [], intervale = [],
                               felZi = CURS, saptamanaLa = null } = {}) {
  const oreLa = saptamanaLa || (() => saptamana);
  const fz = felZi(acum) || { fel: "curs" };

  /* ZI LIBERĂ ORI VACANȚĂ. Orarul nu știe de ele: pe 5 octombrie, zi liberă, el
     tot spune că luni ai 12D la 8:50. Felul zilei se întreabă înaintea orelor. */
  if (FARA_ORE.has(fz.fel)) {
    return { fel: "liber", zi: numeZi(acum), motiv: fz.fel, eticheta: fz.eticheta || "",
             ...primaDinUrmatoareaZi(acum, oreLa, intervale, felZi) };
  }

  /* Săptămânile speciale sunt zile de curs: orele rămân, cardul doar le pune
     eticheta. */
  const stare = stareaZileiDeCurs(acum, oreleZilei, oreLa, intervale, felZi);
  if (fz.fel === "special" && fz.eticheta) stare.special = fz.eticheta;
  return stare;
}

/** Zilele în care nu se țin ore, oricât ar spune orarul. */
const FARA_ORE = new Set(["liber", "vacanta"]);
const CURS = () => ({ fel: "curs", eticheta: "" });

function stareaZileiDeCurs(acum, oreleZilei, oreLa, intervale, felZi) {
  const ore = [...oreleZilei]
    .map((o) => ({ ...o, de: minute(o.start), pana: minute(o.sfarsit) }))
    .filter((o) => o.de !== null && o.pana !== null)
    .sort((a, b) => a.de - b.de);

  /* ZI FĂRĂ ORE. Se caută înainte, zi cu zi, prima oră din următoarea zi de
     școală, ca să se poată spune „urmează luni, la 8:00 cu 11B" în loc de un
     sec „nimic azi". */
  if (!ore.length) return { fel: "liber", zi: numeZi(acum), ...primaDinUrmatoareaZi(acum, oreLa, intervale, felZi) };

  const m = acum.getHours() * 60 + acum.getMinutes();
  const sec = m * 60 + acum.getSeconds();

  /* ÎNTR-O ORĂ. Marginea de sus e deschisă (`m < pana`): în minutul în care
     sună, ora s-a încheiat, nu mai are „un minut rămas". */
  const curenta = ore.find((o) => m >= o.de && m < o.pana);
  if (curenta) {
    return {
      fel: "ora", ora: curenta,
      ramas: curenta.pana - m,
      trecut: m - curenta.de,
      durata: curenta.pana - curenta.de,
    };
  }

  const urmatoarea = ore.find((o) => o.de > m);
  if (!urmatoarea) return { fel: "gata", ultima: ore[ore.length - 1] };

  /* Cât ține pauza: de la sfârșitul orei dinainte până la începutul celei care
     vine. Înainte de prima oră a zilei nu există „ora dinainte", deci bara se
     umple pe ultima jumătate de oră. */
  const inainte = [...ore].reverse().find((o) => m >= o.pana);
  return {
    fel: inainte ? "pauza" : "inainte",
    ora: urmatoarea,
    pana: urmatoarea.de - m,
    secPana: urmatoarea.de * 60 - sec,
    durata: inainte ? urmatoarea.de - inainte.pana : 30,
  };
}

/* Cât de departe se caută următoarea zi de școală: cât să treacă de cea mai
   lungă vacanță (iarna, cu zilele libere lipite de ea), nu doar o săptămână. */
const CAUT_ZILE = 60;

/** Prima oră din următoarea zi de școală, căutată înainte, zi cu zi. Sare peste
 *  zilele libere și peste vacanțe, și ia orarul în vigoare în ziua găsită. */
function primaDinUrmatoareaZi(acum, oreLa, intervale, felZi) {
  const pe = Object.fromEntries(intervale.map((i) => [String(i.id), i]));
  for (let k = 1; k <= CAUT_ZILE; k++) {
    const d = new Date(acum);
    d.setDate(d.getDate() + k);
    if (FARA_ORE.has((felZi(d) || {}).fel)) continue;
    const z = numeZi(d);
    const ale = (oreLa(d) || [])
      .filter((o) => o.zi === z)
      .map((o) => ({ ...o, start: pe[String(o.period)]?.start, sfarsit: pe[String(o.period)]?.end }))
      .filter((o) => minute(o.start) !== null)
      .sort((a, b) => minute(a.start) - minute(b.start));
    if (ale.length) return { urmZi: z, urmData: d, urmPeste: k, ora: ale[0] };
  }
  return {};
}

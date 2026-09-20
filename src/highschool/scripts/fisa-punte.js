// =========================================================
// PUNTEA DINTRE MODUL ȘI FIȘĂ.
//
// Modulul are nevoie de trei lucruri de la o fișă deschisă în cadru: la ce
// slide e, câte are, și du-te la al n-lea. Atât — restul lecției e treaba ei.
//
// TREI TREPTE, ÎN ORDINEA ASTA:
//
//   1. ÎNȚELEGEREA (`window.fisaLiceu`). Fișa își spune singură starea, prin
//      patru rânduri lipite la sfârșitul scriptului ei. E treapta bună: fișa
//      hotărăște ce înseamnă „unde sunt", iar modulul n-are nevoie să știe
//      nimic despre cum e făcută pe dinăuntru.
//
//   2. NUMELE VECHI (`goTo`, `current`, `slides`). Fișele făcute înainte de
//      înțelegere le au la vedere, fiindcă așa le-a scris generatorul. Modulul
//      le folosește ca să meargă și cu ele — dar e o portiță, nu o ușă: prima
//      fișă generată altfel nu le va mai avea.
//
//   3. NIMIC. Atunci se spune pe față că fișa nu se lasă condusă, în loc să
//      tacă și să pară stricată.
//
// DE CE NU CITIM DOM-UL FIȘEI. S-ar fi putut ghici slide-ul după clasa `active`
// de pe secțiuni. Merge azi, fiindcă toate fișele au fost scrise cam la fel, și
// se rupe în ziua în care una e scrisă altfel — fără să spună nimic. O punte
// care se rupe zgomotos e mai bună decât una care minte.
//
// DE CE E CU PUTINȚĂ. Fișele vin din găleată ca adresă `blob:`, făcută chiar de
// modul, iar Luceafărul stă în sit: amândouă sunt pe aceeași origine cu pagina,
// deci se poate vorbi cu ele. Dacă vreodată o fișă ar veni de pe alt domeniu,
// `contentWindow` ar arunca, iar aici se întoarce treapta a treia.
// Cuprins în română, nume în engleză.
// =========================================================

/** Fereastra fișei, ori `null` dacă încă nu s-a încărcat ori nu se poate atinge. */
function fereastraFisei(cadru) {
  try {
    const w = cadru?.contentWindow;
    /* `document` se atinge dinadins: la un cadru de pe altă origine, chiar
       citirea asta aruncă, și atunci știm că nu se poate vorbi cu el. */
    return w && w.document ? w : null;
  } catch { return null; }
}

/**
 * Face puntea spre fișa dintr-un cadru.
 *
 * @param {HTMLIFrameElement} cadru
 * @returns {{fel: "intelegere"|"vechi"|"fara", slide: ()=>number,
 *            cate: ()=>number, laSlide: (n:number)=>void, versiune: number}}
 */
export function puntea(cadru) {
  const fara = {
    fel: "fara", versiune: 0,
    slide: () => 0, cate: () => 0, laSlide: () => {},
  };

  const w = fereastraFisei(cadru);
  if (!w) return fara;

  /* Treapta 1: înțelegerea. */
  const f = w.fisaLiceu;
  if (f && typeof f.laSlide === "function" && typeof f.slide === "function") {
    return {
      fel: "intelegere",
      versiune: Number(f.versiune) || 1,
      slide: () => Number(f.slide()) || 0,
      cate: () => Number(f.cateSlideuri?.()) || 0,
      laSlide: (n) => f.laSlide(n),
    };
  }

  /* Treapta 2: numele vechi. `current` și `slides` sunt `let`/`const` la
     nivelul de sus al scriptului fișei, deci NU stau pe `window` — se citesc
     prin `eval` în fereastra ei, singura cale de a ajunge la cuprinsul acela.
     E scris o dată aici, ca urâțenia să nu se împrăștie prin modul. */
  const vechi = (cod) => {
    try { return w.eval(cod); } catch { return undefined; }
  };
  if (typeof vechi("typeof goTo") === "string" && vechi("typeof goTo") === "function") {
    return {
      fel: "vechi",
      versiune: 0,
      slide: () => Number(vechi("current")) || 0,
      cate: () => Number(vechi("slides.length")) || 0,
      laSlide: (n) => vechi(`goTo(${Number(n) || 0})`),
    };
  }

  return fara;
}

/** Ce scrie pe ecran despre puntea găsită. */
export const vorbaPuntii = {
  intelegere: "",
  vechi: "fișa asta e dinaintea înțelegerii: se derulează, dar fără interacțiuni",
  fara: "fișa asta nu se lasă condusă de la distanță",
};

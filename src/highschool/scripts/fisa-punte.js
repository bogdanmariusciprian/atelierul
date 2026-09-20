// =========================================================
// PUNTEA DINTRE MODUL ȘI FIȘĂ.
//
// Modulul are nevoie de două lucruri de la o fișă deschisă în cadru:
//   1. LA CE SLIDE E și du-te la al n-lea. Asta cere ca fișa să vorbească
//      (vezi cele trei trepte de mai jos).
//   2. CE S-A APĂSAT ȘI UNDE. Asta NU cere nimic de la fișă: apăsările se
//      ascultă din afară, iar pe celălalt ecran se apasă din nou în același
//      loc. Merge și pe o fișă care nu vorbește deloc.
//
// DE CE APĂSAREA, NU URMA EI. S-ar fi putut copia urma: ce clase s-au pus pe
// elemente, ce s-a ascuns, ce s-a aprins. Dar jumătate din ce face o lecție nu
// lasă urmă de copiat: panoul de explicații de sub zapis își scrie textul la
// fața locului, cronometrul își numără secundele lui. Dacă, în schimb, tabla
// APASĂ, atunci codul lecției rulează și acolo, și face singur tot ce ar fi
// făcut la tine. Nu trebuie să știu dinainte ce face fiecare buton – și nici
// nu voi ști, fiindcă fișele de mâine vor avea butoane la care azi nu mă
// gândesc.
//
// PREȚUL: cele două ecrane trebuie să pornească IDENTIC. De-aia modulul pune
// pe amândouă același zar (vezi `cuAcelasiZar` în highschool.js): o fișă care
// amestecă ceva la întâmplare ar fi așezat cuvintele altfel pe tablă, iar
// „apasă al treilea" ar fi nimerit alt cuvânt.
//
// TREI TREPTE PENTRU SLIDE, ÎN ORDINEA ASTA:
//
//   1. ÎNȚELEGEREA (`window.fisaLiceu`). Fișa își spune singură starea, prin
//      patru rânduri lipite la sfârșitul scriptului ei. E treapta bună: fișa
//      hotărăște ce înseamnă „unde sunt", iar modulul n-are nevoie să știe
//      nimic despre cum e făcută pe dinăuntru.
//
//   2. NUMELE VECHI (`goTo`, `current`, `slides`). Fișele făcute înainte de
//      înțelegere le au la vedere, fiindcă așa le-a scris generatorul. Modulul
//      le folosește ca să meargă și cu ele – dar e o portiță, nu o ușă: prima
//      fișă generată altfel nu le va mai avea.
//
//   3. NIMIC. Atunci se spune pe față că fișa nu se lasă dusă de la un slide la
//      altul, în loc să tacă și să pară stricată. APĂSĂRILE MERG ȘI AȘA.
//
// DE CE E CU PUTINȚĂ. Fișele vin din găleată ca adresă `blob:`, făcută chiar de
// modul, iar Luceafărul stă în sit: amândouă sunt pe aceeași origine cu pagina,
// deci se poate vorbi cu ele. Dacă vreodată o fișă ar veni de pe alt domeniu,
// `contentWindow` ar arunca, iar aici se întoarce puntea goală.
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
 * Drumul până la un element, ca șir de numere: „1.3.0.2" înseamnă al doilea
 * copil al lui `<html>`, al patrulea copil al aceluia, și așa mai departe.
 *
 * DE CE NUMERE ȘI NU UN SELECTOR CSS. Un selector ar fi cerut ca elementul să
 * aibă ceva de care să-l prinzi – un `id`, o clasă anume – iar într-o lecție
 * cele mai multe lucruri apăsate n-au nimic: sunt al șaptelea `<li>` dintr-o
 * listă. Numărătoarea merge pe orice, fără să cer nimic de la fișă.
 *
 * Se numără DOAR elementele (`children`), nu și textele dintre ele: spațiile
 * dintr-un HTML scris frumos ar fi mutat numerele.
 *
 * @returns {string|null} drumul, „" pentru `<html>`, ori `null` dacă elementul
 *   nu mai e în pagină.
 */
export function caleaCatre(el) {
  const sus = el?.ownerDocument?.documentElement;
  if (!el || !sus) return null;
  if (el === sus) return "";
  const pasi = [];
  let n = el;
  while (n && n !== sus) {
    const parinte = n.parentElement;
    if (!parinte) return null;          // scos din pagină între timp
    pasi.push(Array.prototype.indexOf.call(parinte.children, n));
    n = parinte;
  }
  return pasi.reverse().join(".");
}

/** Elementul de la capătul unui drum. `null` dacă drumul nu duce nicăieri. */
export function elementulDe(doc, cale) {
  const sus = doc?.documentElement;
  if (!sus || typeof cale !== "string") return null;
  if (cale === "") return sus;
  let n = sus;
  for (const bucata of cale.split(".")) {
    const i = Number(bucata);
    if (!Number.isInteger(i) || i < 0) return null;
    n = n.children?.[i];
    if (!n) return null;
  }
  return n;
}

/** Partea de slide-uri a punții: care din cele trei trepte se potrivește. */
function comandaSlideurilor(w) {
  const fara = { fel: "fara", versiune: 0, slide: () => 0, cate: () => 0, laSlide: () => {} };
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
     nivelul de sus al scriptului fișei, deci NU stau pe `window` – se citesc
     prin `eval` în fereastra ei, singura cale de a ajunge la cuprinsul acela.
     E scris o dată aici, ca urâțenia să nu se împrăștie prin modul. */
  const vechi = (cod) => {
    try { return w.eval(cod); } catch { return undefined; }
  };
  if (vechi("typeof goTo") === "function") {
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

/**
 * Face puntea spre fișa dintr-un cadru.
 *
 * @param {HTMLIFrameElement} cadru
 */
export function puntea(cadru) {
  const w = fereastraFisei(cadru);
  const comanda = comandaSlideurilor(w);
  let ascultator = null;

  return {
    ...comanda,

    /** Spune-mi, de fiecare dată când se apasă ceva, pe ce s-a apăsat. */
    pePunere(spune) {
      this.uita();
      if (!w) return;
      /* ÎN FAZA DE CAPTARE, adică înainte să apuce fișa să-și facă treaba. Așa
         prindem apăsarea chiar dacă lecția oprește drumul evenimentului în sus
         (`stopPropagation`), ceea ce fac multe butoane. */
      ascultator = (ev) => {
        const cale = caleaCatre(ev.target);
        if (cale !== null) spune(cale);
      };
      try { w.document.addEventListener("click", ascultator, true); }
      catch { ascultator = null; }
    },

    /** Apasă din nou, în același loc. Întoarce `false` dacă n-a găsit locul. */
    apasa(cale) {
      const el = elementulDe(w?.document, cale);
      if (!el) return false;
      try {
        /* Se ridică un semn cât ține apăsarea, ca fișa să poată deosebi o
           comandă venită de pe laptop de un deget adevărat. Vezi mai jos, la
           ecranul plin: e singurul loc unde deosebirea contează. Apăsarea se
           face în întregime în rândul următor, deci semnul se stinge la timp. */
        w.__licDeLaDistanta = true;
        /* NU `el.click()`: acela e doar pe elementele HTML, iar în lecții se
           apasă des pe un `<use>` dintr-o iconiță SVG, care n-are metoda. Un
           eveniment făcut de mână merge pe orice și urcă la fel ca unul
           adevărat, deci ascultătorii fișei îl prind unde l-ar fi prins. */
        el.dispatchEvent(new w.MouseEvent("click", {
          bubbles: true, cancelable: true, composed: true, view: w,
        }));
        return true;
      } catch { return false; }
      finally { w.__licDeLaDistanta = false; }
    },

    /**
     * ECRANUL PLIN AL TABLEI RĂMÂNE AL CELUI CARE STĂ LÂNGĂ EA.
     *
     * Se pune pe aparatul care URMEAZĂ, și face O SINGURĂ deosebire: butonul
     * de ecran plin apăsat cu degetul, pe tablă, merge ca oricând; aceeași
     * apăsare venită de pe laptop se lasă baltă.
     *
     * DE CE. Fără nimic, apăsarea ta pe butonul de ecran plin al laptopului
     * ajungea și la tablă și o SCOTEA din ecranul plin pe care tocmai îl
     * pusesei cu mâna – fix pe dos decât vrei. Am oprit-o întâi cu totul, și a
     * ieșit mai rău: nu mai mergea nici butonul tablei. Acum se oprește doar ce
     * vine de departe.
     *
     * (Browserul nu lasă oricum o filă să intre pe tot ecranul fără ca omul să
     * apese chiar acolo; ieșirea, în schimb, n-are nevoie de nicio apăsare, și
     * tocmai ea făcea stricăciunea.)
     */
    ecranulPlinRamaneAlTau() {
      if (!w || w.__licEcranPazit) return;
      const imbraca = (unde, nume) => {
        try {
          const vechi = unde[nume];
          if (typeof vechi !== "function") return;
          Object.defineProperty(unde, nume, {
            configurable: true, writable: true,
            value: function (...ce) {
              if (w.__licDeLaDistanta) return Promise.resolve();
              return vechi.apply(this, ce);
            },
          });
        } catch { /* filă care nu se lasă: las-o */ }
      };
      imbraca(w.Element.prototype, "requestFullscreen");
      imbraca(w.Element.prototype, "webkitRequestFullscreen");
      imbraca(w.document, "exitFullscreen");
      imbraca(w.document, "webkitExitFullscreen");
      w.__licEcranPazit = true;
    },

    /** Lasă fișa în pace: se cheamă înainte de a face altă punte. */
    uita() {
      if (!ascultator) return;
      try { w?.document.removeEventListener("click", ascultator, true); } catch { /* dusă */ }
      ascultator = null;
    },
  };
}

/** Ce scrie pe ecran despre puntea găsită. Numai despre SLIDE-uri: apăsările
 *  merg pe toate trei treptele, deci n-au ce să anunțe. */
export const vorbaPuntii = {
  intelegere: "",
  vechi: "fișa asta e dinaintea înțelegerii: apăsările merg, slide-urile se duc pe portița veche",
  fara: "fișa asta nu se lasă dusă de la un slide la altul; apăsările merg",
};

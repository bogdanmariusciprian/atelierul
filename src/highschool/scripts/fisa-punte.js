// =========================================================
// PUNTEA DINTRE MODUL ȘI FIȘĂ.
//
// Modulul are nevoie de două lucruri de la o fișă deschisă în cadru:
//   1. LA CE SLIDE E și du-te la al n-lea. Asta cere ca fișa să vorbească
//      (vezi cele trei trepte de mai jos).
//   2. CE S-A APĂSAT ȘI UNDE. Asta NU cere nimic de la fișă: apăsările se
//      ascultă din afară, iar pe celălalt ecran se apasă din nou în același
//      loc. Merge și pe o fișă care nu vorbește deloc.
//   3. CÂT S-A DERULAT. Tot din afară, ca apăsările: orice casetă care se
//      derulează (textul unei lecturi, pagina întreagă) se ține minte după
//      drumul ei, cu locul ca procent din cât se poate derula. Pe tablă se
//      derulează la același procent, chiar dacă ecranul ei e altfel.
//   4. CE S-A TRAS CU DEGETUL. Markerul care colorează cuvintele, creionul
//      care desenează peste slide: nu sunt apăsări, ci mișcări (`pointerdown`,
//      `pointermove`, `pointerup`). Se ascultă tot din afară, iar la ridicarea
//      degetului gestul întreg intră în jurnal, ca o apăsare. Pe tablă se
//      reface mișcare cu mișcare, deci codul lecției colorează și desenează
//      singur, ca la tine.
//
//      UNDE, PE UN ALT ECRAN. Lecția se scalează cât ecranul, deci punctele nu
//      pot pleca în pixeli. Pleacă față de un element din slide aflat sub
//      deget la începutul gestului (un cuvânt, un alineat): pe tablă, același
//      element e în același loc al slide-ului, doar mai mare ori mai mic, iar
//      punctul se pune la fel față de el.
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

/** Cât se poate derula un element: `null` dacă nu se derulează deloc. */
function cursa(el) {
  const max = el.scrollHeight - el.clientHeight;
  return max > 1 ? max : null;
}

/* ---------- gesturile ---------- */

/** Un gest intră în jurnal ca șir care începe cu „g", ca să nu se încurce cu un
 *  drum de apăsare (acelea sunt doar cifre și puncte). */
const SEMN_GEST = "g";
/* Cât de des se păstrează un punct: unul la câțiva pixeli e destul pentru o
   linie lină, iar jurnalul nu se umple cu sute de puncte pe gest. */
const PAS_PUNCT = 3;
const MAX_PUNCTE = 400;

/** Un element „din slide", bun de luat ca reper: nu cât tot ecranul (stratul de
 *  desen, scena întreagă), ci ceva mai mic, care se mută odată cu slide-ul. */
function reperSub(w, x, y, tinta) {
  const doc = w.document;
  const L = w.innerWidth * 0.9, H = w.innerHeight * 0.9;
  const bun = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.width < L || r.height < H);
  };
  if (tinta && tinta.nodeType === 1 && bun(tinta)) return tinta;
  for (const el of doc.elementsFromPoint?.(x, y) || []) {
    if (el !== tinta && el !== doc.documentElement && el !== doc.body && bun(el)) return el;
  }
  return null;
}

const rotund = (n) => Math.round(n * 10000) / 10000;

/**
 * Face puntea spre fișa dintr-un cadru.
 *
 * @param {HTMLIFrameElement} cadru
 */
export function puntea(cadru) {
  const w = fereastraFisei(cadru);
  const comanda = comandaSlideurilor(w);
  let ascultator = null;
  let ascultatorDerulare = null;
  let ascultatoriGest = null;

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

    /**
     * Spune-mi, de fiecare dată când se derulează ceva, ce și cât:
     * `spune(cale, procent)`, cu procentul între 0 și 1.
     *
     * Derularea nu urcă prin pagină ca o apăsare, dar trece totuși prin faza de
     * captare, deci un singur ascultător pe document le prinde pe toate. Pagina
     * întreagă se derulează pe `document`; i se dă drumul lui `<html>` („").
     */
    pePunereDerulare(spune) {
      this.uitaDerularea();
      if (!w) return;
      ascultatorDerulare = (ev) => {
        const doc = w.document;
        const el = ev.target === doc ? (doc.scrollingElement || doc.documentElement) : ev.target;
        if (!el || el.nodeType !== 1) return;
        const max = cursa(el);
        if (max === null) return;
        const cale = ev.target === doc ? "" : caleaCatre(el);
        if (cale === null) return;
        spune(cale, Math.min(1, Math.max(0, el.scrollTop / max)));
      };
      try { w.document.addEventListener("scroll", ascultatorDerulare, { capture: true, passive: true }); }
      catch { ascultatorDerulare = null; }
    },

    /** Derulează caseta de la capătul drumului la procentul dat (0–1).
     *  Nu face nimic dacă e deja acolo, ca să nu tremure la fiecare mesaj. */
    deruleaza(cale, procent) {
      const doc = w?.document;
      if (!doc) return;
      const el = cale === "" ? (doc.scrollingElement || doc.documentElement) : elementulDe(doc, cale);
      if (!el) return;
      const max = cursa(el);
      if (max === null) return;
      const tinta = Math.round(Math.min(1, Math.max(0, Number(procent) || 0)) * max);
      if (Math.abs(el.scrollTop - tinta) > 2) el.scrollTop = tinta;
    },

    /**
     * Spune-mi, la ridicarea degetului, ce gest s-a făcut, ca șir de pus în
     * jurnal. Doar ce se întâmplă între apăsare și ridicare; mouse-ul plimbat
     * fără buton nu e gest.
     */
    pePunereGest(spune) {
      this.uitaGesturile();
      if (!w) return;
      let gest = null;            // { r, t: [drumuri], p: [[fel, ți, x, y]], ultim: {x,y}, ref }
      const loc = (ev) => {
        const r = gest.ref?.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) {
          return [rotund((ev.clientX - r.left) / r.width), rotund((ev.clientY - r.top) / r.height)];
        }
        return [rotund(ev.clientX / w.innerWidth), rotund(ev.clientY / w.innerHeight)];
      };
      const tinta = (el) => {
        const cale = caleaCatre(el);
        if (cale === null) return -1;
        let i = gest.t.indexOf(cale);
        if (i < 0) { gest.t.push(cale); i = gest.t.length - 1; }
        return i;
      };
      const adauga = (fel, ev) => {
        if (gest.p.length >= MAX_PUNCTE && fel === "m") return;
        const i = tinta(ev.target);
        if (i < 0) return;
        gest.p.push([fel, i, ...loc(ev)]);
        gest.ultim = { x: ev.clientX, y: ev.clientY };
      };
      const jos = (ev) => {
        if (w.__licDeLaDistanta) return;
        const ref = reperSub(w, ev.clientX, ev.clientY, ev.target);
        gest = { r: ref ? caleaCatre(ref) : null, ref, t: [], p: [], ultim: null,
                 peComanda: !!ev.target?.closest?.("button, a, input, select, textarea, label, summary") };
        adauga("d", ev);
      };
      const misca = (ev) => {
        if (!gest || w.__licDeLaDistanta) return;
        const u = gest.ultim;
        const lista = ev.getCoalescedEvents?.();
        const evs = lista && lista.length ? lista : [ev];
        for (const e of evs) {
          if (u && Math.hypot(e.clientX - gest.ultim.x, e.clientY - gest.ultim.y) < PAS_PUNCT) continue;
          adauga("m", { target: ev.target, clientX: e.clientX, clientY: e.clientY });
        }
      };
      const sus = (ev) => {
        if (!gest || w.__licDeLaDistanta) return;
        adauga(ev.type === "pointercancel" ? "c" : "u", ev);
        const { r, t, p, peComanda } = gest;
        gest = null;
        /* O apăsare simplă pe un buton, un link, un câmp: click-ul ei intră
           oricum în jurnal și spune tot. Ca gest ar fi doar un rând în plus. */
        if (peComanda && !p.some(([fel]) => fel === "m")) return;
        if (p.length) spune(SEMN_GEST + JSON.stringify({ r, t, p }));
      };
      ascultatoriGest = { pointerdown: jos, pointermove: misca, pointerup: sus, pointercancel: sus };
      try {
        for (const [tip, f] of Object.entries(ascultatoriGest)) w.document.addEventListener(tip, f, true);
      } catch { ascultatoriGest = null; }
    },

    /** Reface un gest din jurnal, mișcare cu mișcare. */
    refaGestul(sir) {
      const doc = w?.document;
      if (!doc) return false;
      let g;
      try { g = JSON.parse(sir.slice(SEMN_GEST.length)); } catch { return false; }
      if (!g || !Array.isArray(g.t) || !Array.isArray(g.p)) return false;
      const ref = typeof g.r === "string" ? elementulDe(doc, g.r) : null;
      const r = ref?.getBoundingClientRect();
      const bun = r && r.width > 0 && r.height > 0;
      const tipuri = { d: "pointerdown", m: "pointermove", u: "pointerup", c: "pointercancel" };
      this.lasaCapturile();
      try {
        w.__licDeLaDistanta = true;
        for (const [fel, i, x, y] of g.p) {
          const tip = tipuri[fel];
          const el = typeof g.t[i] === "string" ? elementulDe(doc, g.t[i]) : null;
          if (!tip || !el || !Number.isFinite(x) || !Number.isFinite(y)) continue;
          const clientX = bun ? r.left + x * r.width : x * w.innerWidth;
          const clientY = bun ? r.top + y * r.height : y * w.innerHeight;
          const e = new w.PointerEvent(tip, {
            bubbles: true, cancelable: true, composed: true, view: w,
            clientX, clientY, pointerId: 1, pointerType: "mouse", isPrimary: true,
            button: fel === "m" ? -1 : 0, buttons: fel === "u" || fel === "c" ? 0 : 1,
          });
          /* Un eveniment făcut de mână întoarce o listă GOALĂ de puncte
             intermediare, iar lecțiile care desenează lin citesc tocmai lista
             asta: n-ar fi tras nicio linie. Îi dăm punctul lui, ca unul adevărat. */
          Object.defineProperty(e, "getCoalescedEvents", { value: () => [e] });
          el.dispatchEvent(e);
        }
        return true;
      } catch { return false; }
      finally { w.__licDeLaDistanta = false; }
    },

    /**
     * Pe tablă, un gest refăcut n-are un deget adevărat în spate, iar lecția
     * cere des „ține pointerul" (`setPointerCapture`) chiar la începutul
     * gestului. Browserul ar fi aruncat o greșeală acolo, iar codul lecției s-ar
     * fi oprit înainte să coloreze ori să deseneze. Cât ține refacerea, cererea
     * asta se lasă să treacă fără greșeală.
     */
    lasaCapturile() {
      if (!w || w.__licCapturiLasate) return;
      for (const nume of ["setPointerCapture", "releasePointerCapture"]) {
        try {
          const vechi = w.Element.prototype[nume];
          if (typeof vechi !== "function") continue;
          Object.defineProperty(w.Element.prototype, nume, {
            configurable: true, writable: true,
            value: function (...ce) {
              try { return vechi.apply(this, ce); }
              catch (e) { if (w.__licDeLaDistanta) return undefined; throw e; }
            },
          });
        } catch { /* filă care nu se lasă: las-o */ }
      }
      w.__licCapturiLasate = true;
    },

    /** Apasă din nou, în același loc. Întoarce `false` dacă n-a găsit locul.
     *  Un rând de jurnal care e gest (vezi `pePunereGest`) se reface ca gest. */
    apasa(cale) {
      if (typeof cale === "string" && cale.startsWith(SEMN_GEST)) return this.refaGestul(cale);
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
      this.uitaDerularea();
      this.uitaGesturile();
      if (!ascultator) return;
      try { w?.document.removeEventListener("click", ascultator, true); } catch { /* dusă */ }
      ascultator = null;
    },

    uitaGesturile() {
      if (!ascultatoriGest) return;
      try {
        for (const [tip, f] of Object.entries(ascultatoriGest)) w?.document.removeEventListener(tip, f, true);
      } catch { /* dusă */ }
      ascultatoriGest = null;
    },

    uitaDerularea() {
      if (!ascultatorDerulare) return;
      try { w?.document.removeEventListener("scroll", ascultatorDerulare, { capture: true }); } catch { /* dusă */ }
      ascultatorDerulare = null;
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

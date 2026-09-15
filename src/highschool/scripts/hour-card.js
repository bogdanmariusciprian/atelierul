// =========================================================
// CARDUL PLUTITOR CU ORA: ce urmează și peste cât.
//
// Stă mereu în dreapta jos, peste orice ecran al modulului. Arată, de sus în
// jos: clasa și sala, a câta oră din an, intervalul ei, ceasul de acum, o vorbă
// despre ea („prima oră"), o bară care se umple și minutele rămase.
//
// CEASUL BATE DIN SECUNDĂ ÎN SECUNDĂ, restul o dată pe minut. Deosebirea nu e
// un moft: ceasul e singurul lucru care se schimbă la secundă, iar redesenarea
// întregului card de șaizeci de ori pe minut ar fi ținut placa video trează
// degeaba. Se schimbă numai textul ceasului, în chiar nodul lui.
//
// DATELE VIN DIN AFARĂ, printr-o funcție. Azi n-avem încă orarul în bază, deci
// cardul arată numai ceasul și spune cinstit că nu știe orele. Când vine
// orarul, se schimbă o singură linie: funcția care i-l dă.
// Cuprins în română, nume în engleză.
// =========================================================

const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** „15:40" → 940 minute de la miezul nopții. Ce nu se poate citi dă `null`. */
export function minute(hhmm) {
  const m = String(hhmm ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

const doua = (n) => String(n).padStart(2, "0");
const ceasAcum = (d) => `${d.getHours()}:${doua(d.getMinutes())}`;

/** Câte bucăți are bara de jos. Destule ca să se vadă mișcarea, nu atâtea încât
 *  să pară un grafic. */
const BUCATI = 34;

const CEAS_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  ><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;

const X_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

/**
 * @param {HTMLElement} gazda
 * @param {() => (null | {
 *   clasa: string, sala?: string,
 *   nr?: number, dinCate?: number,
 *   start: string, sfarsit: string,
 *   vorba?: string,
 *   acum?: boolean          // adevărat dacă ora e ÎN desfășurare
 * })} date  ce oră se arată; `null` = n-avem orarul
 */
export function hourCard(gazda, date = () => null) {
  if (!gazda) return { improspateaza() {}, opreste() {} };

  let batereMinut = null, batereSecunda = null, potrivire = null;
  let inchis = false;

  function bara(cat) {
    const pline = Math.round(Math.min(1, Math.max(0, cat)) * BUCATI);
    return Array.from({ length: BUCATI },
      (_, i) => `<i class="${i < pline ? "on" : ""}"></i>`).join("");
  }

  function deseneaza() {
    if (inchis) { gazda.innerHTML = ""; return; }
    const acum = new Date();
    const o = date();

    /* FĂRĂ ORAR: numai ceasul. Cardul nu inventează ore și nu tace de tot —
       spune ce știe și ce nu. */
    if (!o) {
      gazda.innerHTML = `
        <div class="hc" role="status">
          <button type="button" class="hc__x" data-act="hc-inchide" aria-label="Închide">${X_SVG}</button>
          <p class="hc__gol">Orarul n-a fost încă adus.</p>
          <p class="hc__ceas"><span class="hc__pastila">${CEAS_SVG}<b data-rol="ceas">${ceasAcum(acum)}</b></span></p>
        </div>`;
      return;
    }

    const de = minute(o.start), pana = minute(o.sfarsit);
    const m = acum.getHours() * 60 + acum.getMinutes();
    /* În timpul orei numărăm cât a mai rămas din ea; în afara ei, cât mai e
       până începe. Același număr mare, două înțelesuri, deosebite de vorba de
       deasupra lui. */
    const raman = o.acum ? Math.max(0, pana - m) : Math.max(0, de - m);
    const cat = o.acum && pana > de
      ? (m - de) / (pana - de)
      : 1 - Math.min(1, raman / 240);        // umple pe ultimele patru ore

    gazda.innerHTML = `
      <div class="hc${o.acum ? " hc--acum" : ""}" role="status">
        <button type="button" class="hc__x" data-act="hc-inchide" aria-label="Închide">${X_SVG}</button>

        <p class="hc__cap">
          <b class="hc__clasa">${esc(o.clasa)}</b>
          ${o.sala ? `<span class="hc__sala">(${esc(o.sala)})</span>` : ""}
          ${o.nr && o.dinCate ? `<span class="hc__nr">${o.nr}/${o.dinCate}</span>` : ""}
        </p>

        <p class="hc__rand">
          <b class="hc__interval">${esc(o.start)} – ${esc(o.sfarsit)}</b>
          <span class="hc__pastila">${CEAS_SVG}<b data-rol="ceas">${ceasAcum(acum)}</b></span>
        </p>

        ${o.vorba ? `<p class="hc__vorba">${esc(o.vorba)}</p>` : ""}

        <div class="hc__jos">
          <span class="hc__bara" aria-hidden="true">${bara(cat)}</span>
          <b class="hc__min">${raman} <small>min</small></b>
        </div>
      </div>`;
  }

  /* Numai textul ceasului, o dată pe secundă. Restul cardului nu se atinge. */
  function bateSecunda() {
    const el = gazda.querySelector("[data-rol='ceas']");
    if (!el) return;
    const t = ceasAcum(new Date());
    if (el.textContent !== t) el.textContent = t;
    /* Pulsul: clasa se scoate și se pune la loc, ca animația s-o ia de la
       capăt la fiecare secundă. Citirea lui `offsetWidth` între ele silește
       browserul să recunoască scoaterea; fără ea, punerea la loc în aceeași
       clipă n-ar fi însemnat nicio schimbare, iar animația n-ar fi repornit. */
    const p = el.closest(".hc__pastila");
    if (p) { p.classList.remove("bate"); void p.offsetWidth; p.classList.add("bate"); }
  }

  function apasa(e) {
    if (!e.target.closest("[data-act='hc-inchide']")) return;
    inchis = true;
    deseneaza();
  }
  gazda.addEventListener("click", apasa);

  deseneaza();
  batereSecunda = setInterval(bateSecunda, 1000);
  /* Cardul întreg se reface pe minutul rotund, ca minutele rămase să se
     schimbe atunci când se schimbă și ora adevărată. */
  potrivire = setTimeout(() => {
    deseneaza();
    batereMinut = setInterval(deseneaza, 60000);
  }, (60 - new Date().getSeconds()) * 1000 + 100);

  return {
    improspateaza: deseneaza,
    /** Îl aduce înapoi după ce a fost închis. */
    redeschide() { inchis = false; deseneaza(); },
    opreste() {
      clearInterval(batereSecunda); clearInterval(batereMinut); clearTimeout(potrivire);
      gazda.removeEventListener("click", apasa);
      gazda.innerHTML = "";
    },
  };
}

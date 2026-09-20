// =========================================================
// CARDUL CU ORA, dreapta jos, plutitor.
//
// Ține modelul din aplicația de pe disc, fiindcă e bine gândit: cinci stări,
// bara din pătrate de câte cinci minute, iar în pauză cardul arată altă față.
//
//   ora      – „11B (S19) 4/97 · 12:15–13:00 · mai sunt 22 min"
//   pauza    – „PAUZĂ", numărătoare inversă, și ce urmează
//   inainte  – prima oră a zilei, peste cât începe
//   gata     – s-au terminat orele
//   liber    – azi n-ai ore; se arată prima din ziua următoare de școală
//
// DOUĂ CEASURI, NU UNUL. Ora din pastila roșie și numărătoarea din pauză se
// schimbă din secundă în secundă, dar numai ELE, în chiar nodul lor. Cardul
// întreg se reface o dată pe minut, potrivit pe minutul rotund, ori când se
// schimbă starea. Un card refăcut de șaizeci de ori pe minut ar fi ținut placa
// video trează degeaba și ar fi rupt animația pastilei la fiecare bătaie.
//
// ASCUNDEREA NU E ÎNCHIDERE. Rămâne un buton mic, ca să-l poți chema înapoi;
// alegerea se ține pe cont, nu pe browser.
//
// TREI FELURI, după unde ești (i le spune pagina, cardul nu se uită singur):
//   plin       – ecranele modulului: cardul întreg, cu tot ce scrie mai sus
//   prezentare – o fișă deschisă în modul: numai ceasul și minutele până la pauză
//   fantoma    – fișa pe tot ecranul: la fel, dar stins și fără să prindă
//                apăsările, ca să ajungi la ce e pe slide sub el
// Cuprins în română, nume în engleză.
// =========================================================
/* Cardul doar DESENEAZĂ starea; socoteala e în `school-time.js` și i se dă din
   afară. De aceea de acolo îi trebuie un singur ajutor: scrierea ceasului cu
   două cifre. */
import { ora2 } from "./school-time.js";
import { iaLocal, punLocal } from "../../shared/scripts/session.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const CHEIE_ASCUNS = "liceu:cardul-ascuns";

const ZI_LUNG = {
  luni: "luni", marti: "marți", miercuri: "miercuri",
  joi: "joi", vineri: "vineri", sambata: "sâmbătă", duminica: "duminică",
};

const doua = (n) => String(n).padStart(2, "0");
const ceasAcum = (d) => `${d.getHours()}:${doua(d.getMinutes())}`;

const CEAS_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  ><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;

const X_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

const CAL_SVG = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
  stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  ><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>`;

/* BARA DIN PĂTRATE, câte unul la cinci minute. Se aprind pe măsură ce trece ora.
   În ultimele cinci minute, pătratul din capăt trece din verde în roșu, minut cu
   minut: se vede cu coada ochiului că se termină, fără să citești cifra. */
const culoareFinal = (ramas) => {
  const t = Math.min(1, Math.max(0, (5 - ramas) / 4));
  return `oklch(58% 0.17 ${Math.round(150 - 125 * t)})`;
};

function patrate(ramas, durata) {
  if (!durata) return "";
  const total = Math.max(1, Math.ceil(durata / 5));
  const trecut = Math.max(0, durata - ramas);
  const pline = Math.max(0, Math.min(total, Math.round(trecut / 5)));
  const final = ramas > 0 && ramas <= 5;
  const celule = Array.from({ length: total }, (_, i) =>
    (final && i === total - 1)
      ? `<i class="on final" style="--c:${culoareFinal(ramas)}"></i>`
      : `<i class="${i < pline ? "on" : ""}"></i>`).join("");
  return `<div class="hc-cells" role="img"
    aria-label="${trecut} din ${durata} minute au trecut">${celule}</div>`;
}

/** Clasa, sala și „a câta din câte" — scrise la fel peste tot. */
function capul(o) {
  if (!o) return "";
  return `<span class="hc-clasa">${esc(o.clasa)}${
    o.sala ? ` <small>(${esc(String(o.sala).toUpperCase())})</small>` : ""}${
    o.nr && o.dinCate
      ? ` <span class="hc-nr" title="A ${o.nr}-a oră din cele ${o.dinCate} la ${esc(o.clasa)}">${o.nr}/${o.dinCate}</span>`
      : ""}</span>`;
}

/** Un rând de panglică: capul, intervalul, ceasul, o vorbă, cifra mare, bara. */
function panglica({ o, titluStang, interval, sub, cifra, unitate, ramas, durata, acum }) {
  return `
    <div class="hc-sus">
      <span class="hc-when">
        ${o ? capul(o) : `<span class="hc-clasa">${esc(titluStang)}</span>`}
        ${interval ? `<b class="hc-iv">${esc(interval)}</b>` : ""}
      </span>
      <span class="hc-pastila">${CEAS_SVG}<b data-rol="ceas">${ceasAcum(acum)}</b></span>
    </div>
    ${sub ? `<div class="hc-sub">${sub}</div>` : ""}
    ${cifra === "" ? "" : `<div class="hc-ramas"><b>${esc(String(cifra))}</b>${esc(unitate)}</div>`}
    ${patrate(ramas, durata)}`;
}

function fataHtml(s, acum) {
  if (s.fel === "ora") {
    return panglica({
      o: s.ora, interval: `${ora2(s.ora.start)} – ${ora2(s.ora.sfarsit)}`,
      sub: s.ora.titlu
        ? `<span class="hc-lectie">${s.ora.unitatea ? `${esc(s.ora.unitatea)} · ` : ""}${esc(s.ora.titlu)}</span>`
        : "",
      cifra: s.ramas, unitate: " min", ramas: s.ramas, durata: s.durata, acum,
    });
  }
  if (s.fel === "pauza" || s.fel === "inainte") {
    return panglica({
      o: s.ora, interval: `${ora2(s.ora.start)} – ${ora2(s.ora.sfarsit)}`,
      sub: s.fel === "pauza" ? "după pauză" : "prima oră",
      cifra: s.pana, unitate: " min", ramas: s.pana,
      durata: Math.max(s.durata || 0, s.pana), acum,
    });
  }
  if (s.fel === "gata") {
    return panglica({
      titluStang: "Gata", interval: "pe azi",
      /* Intervalul întreg, nu doar ceasul de sfârșit: „la 19:00" se citește ca
         ora la care a ÎNCEPUT, adică pe dos. */
      sub: s.ultima
        ? `ultima a fost <b>${esc(s.ultima.clasa)}</b>, la ${esc(ora2(s.ultima.start))} – ${esc(ora2(s.ultima.sfarsit))}`
        : "",
      cifra: "", unitate: "", ramas: 0, durata: 0, acum,
    });
  }
  /* zi liberă */
  return panglica({
    titluStang: "Zi liberă", interval: ZI_LUNG[s.zi] || "",
    sub: s.ora
      ? `urmează <b>${esc(ZI_LUNG[s.urmZi] || s.urmZi)}</b>, ${esc(ora2(s.ora.start))} · ${esc(s.ora.clasa)}${
          s.ora.sala ? ` (${esc(String(s.ora.sala).toUpperCase())})` : ""}`
      : "nicio oră în orar",
    cifra: "", unitate: "", ramas: 0, durata: 0, acum,
  });
}

/* SPATELE, cât ține pauza. Cifra mare de pe față spune „peste cât", dar în
   pauză vrei celălalt lucru: cât mai ai. În ultimul minut se numără secundele. */
function spateHtml(s) {
  return `
    <div class="hc-pauza">
      <b class="hc-pauza__t">PAUZĂ</b>
      <span class="hc-timer" data-rol="timer" role="timer" aria-live="off"></span>
    </div>
    <div class="hc-urmeaza">urmează ${capul(s.ora)}, la <b>${esc(ora2(s.ora.start))}</b></div>`;
}

const timerHtml = (sec) => {
  const ultimul = sec <= 60;
  const val = ultimul ? Math.max(0, sec) : Math.ceil(sec / 60);
  return `<b>${val}</b> ${ultimul ? "s" : "min"}`;
};

/* CÂND CARDUL SE SCURTEAZĂ. Peste o prezentare deschisă la clasă, cardul întreg
   e prea mult: acoperă slide-ul și spune lucruri pe care le știi deja (ești la
   ora aceea, doar ce-ai deschis fișa ei). Rămân cele două care chiar se cer cu
   coada ochiului: cât e ceasul și cât mai e până la pauză.
   DOUĂ PASTILE, nu una: ceasul roșu rămâne cum e, iar minutele vin alături, în
   pastila lor. Cât mai ai e altceva decât cât e ceasul, deci se citesc separat.

   TOATE CELE CINCI STĂRI ÎȘI AU VORBA LOR. Până acum, „azi n-ai ore" nu scria
   nimic, iar cardul arăta ca și cum s-ar fi stricat: doar ceasul, singur. Un
   ecran care tace nu spune „n-am ce spune", spune „nu merg". */
function vorbaScurta(s) {
  if (!s) return null;
  if (s.fel === "ora") return { fel: "min", text: `${s.ramas} min` };
  if (s.fel === "pauza") return { fel: "pauza", text: `pauză · ${s.pana} min` };
  /* Stările fără oră n-au pastilă: `fel` gol înseamnă text simplu, șters. Nu
     pun o clasă care nu face nimic — o clasă fără stil în foaie e chiar felul
     de scăpare care se vede abia peste o lună. */
  if (s.fel === "inainte") return { fel: "", text: `prima oră peste ${s.pana} min` };
  if (s.fel === "gata") return { fel: "", text: "gata pe azi" };
  if (s.fel === "liber") {
    return {
      fel: "",
      text: s.ora
        ? `azi n-ai ore · ${ZI_LUNG[s.urmZi] || s.urmZi}, ${ora2(s.ora.start)} cu ${s.ora.clasa}`
        : "azi n-ai ore",
    };
  }
  return null;
}

function scurtHtml(s, acum, cuX) {
  const v = vorbaScurta(s);
  return `
    <div class="hc hc--scurt" role="status">
      ${cuX ? `<button type="button" class="hc__x" data-act="hc-ascunde" aria-label="Ascunde">${X_SVG}</button>` : ""}
      <span class="hc-pastila">${CEAS_SVG}<b data-rol="ceas">${ceasAcum(acum)}</b></span>
      ${v ? `<span class="hc-scurt__vorba${v.fel ? ` hc-scurt__vorba--${v.fel}` : ""}">${esc(v.text)}</span>` : ""}
    </div>`;
}

/**
 * @param {HTMLElement} gazda
 * @param {() => (null | object)} stareaDeDat  ce arată cardul; `null` = n-avem orar
 * @param {() => ("plin"|"prezentare"|"fantoma")} felulCardului
 *        plin       – ecranele obișnuite ale modulului
 *        prezentare – o fișă deschisă în modul: numai ceasul și minutele
 *        fantoma    – fișa pe tot ecranul: la fel, dar stins și fără să prindă
 *                     apăsările, ca să poți atinge slide-ul de dedesubt
 */
export function hourCard(gazda, stareaDeDat = () => null, felulCardului = () => "plin") {
  if (!gazda) return { improspateaza() {}, opreste() {} };

  let peMinut = null, peSecunda = null, potrivire = null;
  let ultimFel = "", ultimulMod = "";
  let ascuns = iaLocal(CHEIE_ASCUNS, false) === true;

  /* PE TOT ECRANUL, CARDUL TREBUIE SĂ URCE ÎN „TOP LAYER".
     Un element trecut pe tot ecranul prin Fullscreen API se desenează într-un
     strat de deasupra întregii pagini; acolo nu ajunge niciun `z-index`, oricât
     de mare. Cardul ar fi fost ascuns cu totul, nu estompat. `popover` e
     singura ușă către stratul acela.
     Atributul se pune și se scoate din mers: un element cu `popover` e ascuns
     până e arătat, deci lăsat pe el mereu ar fi făcut cardul să dispară pe
     ecranele obișnuite. */
  function potrivesteStratul(sus) {
    const are = gazda.hasAttribute("popover");
    if (sus === are) return;
    if (sus) {
      gazda.setAttribute("popover", "manual");
      /* Dacă arătarea nu reușește (browser vechi, element scos din pagină),
         atributul TREBUIE scos înapoi: un element cu `popover` nearătat e
         `display: none`, adică s-ar fi ales cu un card dispărut cu totul în
         locul unuia doar acoperit. */
      try { gazda.showPopover(); }
      catch { gazda.removeAttribute("popover"); }
      return;
    }
    try { gazda.hidePopover(); } catch { /* nearătat: n-are ce ascunde */ }
    gazda.removeAttribute("popover");
  }

  function deseneaza() {
    const acum = new Date();
    const mod = felulCardului();
    ultimulMod = mod;
    gazda.dataset.mod = mod;
    potrivesteStratul(mod === "fantoma");

    if (ascuns) {
      gazda.innerHTML = `<button type="button" class="hc-mic" data-act="hc-arata"
        title="Arată ceasul orelor" aria-label="Arată ceasul orelor">${CAL_SVG}</button>`;
      return;
    }

    const s = stareaDeDat();

    /* Peste o prezentare: numai ceasul și minutele. La fel și pe tot ecranul,
       unde în plus se stinge și nu mai prinde apăsările (din CSS) — de aceea
       acolo nu se mai pune nici butonul de ascuns: n-ar putea fi apăsat. */
    if (mod !== "plin") {
      gazda.innerHTML = scurtHtml(s, acum, mod === "prezentare");
      ultimFel = s ? s.fel : "";
      return;
    }
    if (!s) {
      gazda.innerHTML = `
        <div class="hc" role="status">
          <button type="button" class="hc__x" data-act="hc-ascunde" aria-label="Ascunde">${X_SVG}</button>
          <p class="hc-gol">Orarul n-a fost adus.</p>
          <p class="hc-doarceas"><span class="hc-pastila">${CEAS_SVG}<b data-rol="ceas">${ceasAcum(acum)}</b></span></p>
        </div>`;
      return;
    }

    ultimFel = s.fel;
    const pauza = s.fel === "pauza";
    gazda.innerHTML = `
      <div class="hc hc--${esc(s.fel)}" role="status">
        <button type="button" class="hc__x" data-act="hc-ascunde" aria-label="Ascunde">${X_SVG}</button>
        ${pauza ? spateHtml(s) : fataHtml(s, acum)}
      </div>`;
    if (pauza) bateTimerul(s);
  }

  /* Numai ceasul din pastilă, o dată pe secundă. Restul cardului nu se atinge. */
  function bateCeasul() {
    const el = gazda.querySelector("[data-rol='ceas']");
    if (!el) return;
    const t = ceasAcum(new Date());
    if (el.textContent !== t) el.textContent = t;
    /* Pulsul: clasa se scoate și se pune la loc, iar citirea lui `offsetWidth`
       dintre ele silește browserul să recunoască scoaterea. Fără ea, punerea în
       aceeași clipă n-ar fi însemnat nicio schimbare, iar animația n-ar reporni. */
    const p = el.closest(".hc-pastila");
    if (p) { p.classList.remove("bate"); void p.offsetWidth; p.classList.add("bate"); }
  }

  function bateTimerul(s) {
    const t = gazda.querySelector("[data-rol='timer']");
    if (!t) return;
    const sec = Math.max(0, s.secPana ?? 0);
    t.dataset.final = sec <= 60 ? "1" : "0";
    const h = timerHtml(sec);
    if (t.innerHTML !== h) t.innerHTML = h;
  }

  function apasa(e) {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "hc-ascunde") ascuns = true;
    else if (b.dataset.act === "hc-arata") ascuns = false;
    else return;
    punLocal(CHEIE_ASCUNS, ascuns);
    deseneaza();
  }
  gazda.addEventListener("click", apasa);

  deseneaza();

  /* Din secundă în secundă: ceasul, numărătoarea din pauză, și trecerea dintr-o
     stare în alta (care nu poate aștepta minutul rotund — la 12:15:00 ești deja
     în oră). */
  peSecunda = setInterval(() => {
    /* Modul se verifică și aici, nu numai la `fullscreenchange`. Ecranul plin
       cerut din interiorul cadrului nu ajunge la fel de sigur până în pagina
       gazdă, iar o citire de proprietate pe secundă e mai ieftină decât un card
       rămas larg peste un slide. */
    if (felulCardului() !== ultimulMod) { deseneaza(); return; }
    if (ascuns) return;
    const s = stareaDeDat();
    if (s && s.fel !== ultimFel) { deseneaza(); return; }
    bateCeasul();
    if (s && s.fel === "pauza" && ultimulMod === "plin") bateTimerul(s);
  }, 1000);

  /* Cardul întreg, pe minutul rotund: atunci se schimbă cifra mare și bara. */
  potrivire = setTimeout(() => {
    deseneaza();
    peMinut = setInterval(deseneaza, 60000);
  }, (60 - new Date().getSeconds()) * 1000 + 100);

  return {
    improspateaza: deseneaza,
    opreste() {
      clearInterval(peSecunda); clearInterval(peMinut); clearTimeout(potrivire);
      gazda.removeEventListener("click", apasa);
      potrivesteStratul(false);
      gazda.innerHTML = "";
    },
  };
}

// =========================================================
// Introducere în fonetică – partea vie a lecției.
//
// Trei bucăți, toate pornind de la aceeași idee: fonetica nu se învață
// privind cuvântul, ci rostindu-l. Ecranul nu poate rosti în locul elevului,
// dar poate să-i CEARĂ s-o facă și să-i arate ce ar fi trebuit să audă.
//
//   1. Clasificarea – trei rânduri care se deschid, unul pe rând.
//   2. Capcana pronumelor – atingi cuvântul, vezi ce se aude cu adevărat.
//   3. Proba prelungirii – tragi de sunet și afli dacă el chiar există.
//
// Nimic aici nu are nevoie de sunet înregistrat: proba prelungirii se face cu
// gura elevului, iar scrisul de pe ecran o oglindește. De-aia „ceapă" se
// întinde în „čaaaapă", nu în „čeeeeeapă" – vede negru pe alb că vocala pe
// care o prelungește nu e cea din scriere.
// =========================================================

/** Trei rânduri, o singură deschidere: două panouri deschise în același timp
 *  ar cere compararea, iar aici ordinea contează – vocală, apoi semivocală,
 *  apoi consoană, fiecare sprijinindu-se pe cea dinainte. */
function initClasificare(root) {
  const gazda = root.querySelector('[data-role="fo-class"]');
  if (!gazda) return;

  const inchideTot = () => {
    gazda.querySelectorAll("[data-fo-body]").forEach((b) => { b.hidden = true; });
    gazda.querySelectorAll("[data-fo-open]").forEach((r) => r.classList.remove("is-open"));
  };

  gazda.querySelectorAll("[data-fo-open]").forEach((rand) => {
    rand.setAttribute("role", "button");
    rand.setAttribute("tabindex", "0");
    rand.setAttribute("aria-expanded", "false");

    const comuta = () => {
      const cheie = rand.dataset.foOpen;
      const corp = gazda.querySelector(`[data-fo-body="${cheie}"]`);
      if (!corp) return;
      const eraDeschis = !corp.hidden;
      inchideTot();
      if (!eraDeschis) {
        corp.hidden = false;
        rand.classList.add("is-open");
        rand.setAttribute("aria-expanded", "true");
      }
    };

    rand.addEventListener("click", comuta);
    rand.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); comuta(); }
    });
  });
}

/* =========================================================
   PROPOZIȚIA CU TOATE SUNETELE

   „Zâmbind fericit, hoțul jucăuș cheamă cinci vulpi ghidușe, iar seara ziua
   se stinge peste ogoare."

   Are, măcar o dată, fiecare dintre cele 34 de sunete ale limbii române:
   7 vocale, 4 semivocale, i-ul șoptit, 18 consoane și cele 4 fără literă
   proprie. E cusută anume, nu găsită.

   Mai jos, fiecare literă care ține PRIMA apariție a unui sunet e însemnată cu
   codul lui. O singură apariție per sunet: dacă ar zbura toate, ar pleca vreo
   nouăzeci de bucăți deodată și n-ai mai vedea nimic. Așa, propoziția se
   scutură exact de câte un exemplar din fiecare, iar clasificarea se umple.

   Segment: [litere] sau [litere, cod-sunet]. Codurile se potrivesc cu
   `data-s` din clasificare; „_" la coadă înseamnă semivocală, „is" e i-ul
   șoptit, „c2…" sunt consoanele fără literă proprie. */
const PROPOZITIE = [
  [["Z", "z"], ["â", "î"], ["m", "m"], ["b", "b"], ["i", "i"], ["n", "n"], ["d", "d"]],
  [["f", "f"], ["e", "e"], ["r", "r"], ["i"], ["c", "c2č"], ["i"], ["t", "t"], [","]],
  [["h", "h"], ["o", "o"], ["ț", "ț"], ["u", "u"], ["l", "l"]],
  [["j", "j"], ["u"], ["c", "k"], ["ă", "ă"], ["u", "u_"], ["ș", "ș"]],
  [["ch", "c2k"], ["e", "e_"], ["a", "a"], ["m"], ["ă"]],
  [["cinci"]],
  [["v", "v"], ["u"], ["l"], ["p", "p"], ["i", "is"]],
  [["gh", "c2g"], ["idușe"], [","]],
  [["i", "i_"], ["ar"]],
  [["s", "s"], ["eara"]],
  [["ziua"]],
  [["se"]],
  [["stin"], ["ge", "c2ǧ"]],
  [["peste"]],
  [["o"], ["g", "g"], ["oa", "o_"], ["re."]],
];

/** Cât zboară o literă și cât se așteaptă între plecări. Plecările decalate
 *  sunt esențiale: pornite deodată, treizeci și patru de litere fac o pată. */
const ZBOR_MS = 620;
const PAS_MS = 45;

/** Propoziția care se scutură de sunete.
 *
 *  La atingere, fiecare literă însemnată își lasă o copie care zboară la
 *  căsuța ei din clasificare. Copia se mișcă între două poziții MĂSURATE pe
 *  ecran (nu calculate), deci nimeriște oriunde ar cădea rândurile: pe telefon,
 *  pe laptop, după derulare, oricum. */
function initPropozitie(root) {
  const gazda = root.querySelector('[data-role="fo-pang"]');
  const text = root.querySelector('[data-role="fo-pang-text"]');
  const iesire = root.querySelector('[data-role="fo-pang-out"]');
  if (!gazda || !text) return;

  // Scriem propoziția din date, ca segmentarea să trăiască într-un singur loc.
  text.innerHTML = PROPOZITIE.map((cuvant) => cuvant.map(([lit, cod]) =>
    cod ? `<span class="fo-lit" data-s="${cod}">${lit}</span>` : `<span>${lit}</span>`
  ).join("")).join(" ");

  let pornit = false;
  gazda.addEventListener("click", () => {
    if (pornit) return;
    pornit = true;
    gazda.classList.add("is-shaken");

    const litere = [...text.querySelectorAll(".fo-lit")];
    // O singură citire a poziţiilor, înainte de orice scriere: altfel fiecare
    // copie adăugată ar muta-o pe următoarea şi zborurile ar porni strâmb.
    const plecari = litere.map((el) => ({ el, r: el.getBoundingClientRect() }));
    const tinte = new Map();
    for (const t of root.querySelectorAll(".fo-snd[data-s]")) {
      tinte.set(t.dataset.s, { el: t, r: t.getBoundingClientRect() });
    }

    plecari.forEach(({ el, r }, i) => {
      const tinta = tinte.get(el.dataset.s);
      if (!tinta) return;
      const copie = document.createElement("span");
      copie.className = "fo-fly";
      copie.textContent = el.textContent;
      copie.style.left = `${r.left}px`;
      copie.style.top = `${r.top}px`;
      document.body.appendChild(copie);

      const dx = tinta.r.left + tinta.r.width / 2 - (r.left + r.width / 2);
      const dy = tinta.r.top + tinta.r.height / 2 - (r.top + r.height / 2);

      setTimeout(() => {
        el.classList.add("is-gone");
        copie.style.transform = `translate(${dx}px, ${dy}px) scale(0.85)`;
        copie.style.opacity = "0.15";
      }, i * PAS_MS + 20);

      setTimeout(() => {
        copie.remove();
        tinta.el.classList.add("is-hit");
      }, i * PAS_MS + ZBOR_MS);
    });

    if (iesire) {
      setTimeout(() => {
        iesire.textContent =
          "Fiecare sunet și-a găsit locul. Propoziția a rămas fără ele, "
          + "fiindcă literele erau doar hainele pe care le poartă sunetele.";
      }, plecari.length * PAS_MS + ZBOR_MS);
    }
  });
}

/** Capcana 1: cuvântul scris, lângă cuvântul auzit. */
function initPronume(root) {
  const zona = root.querySelector('[data-role="fo-trap-1"]');
  const iesire = root.querySelector('[data-role="fo-out-1"]');
  if (!zona || !iesire) return;

  zona.querySelectorAll(".fo-tcard").forEach((btn) => {
    btn.addEventListener("click", () => {
      zona.querySelectorAll(".fo-tcard").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      iesire.innerHTML =
        `<span class="fo-scris">${btn.dataset.scris}</span>` +
        `<span class="fo-sageata" aria-hidden="true">se rostește</span>` +
        `<span class="fo-zis">${btn.dataset.zis}</span>` +
        `<span class="fo-nota">${btn.dataset.nota}</span>`;
    });
  });
}

/** Câte litere se repetă când „tragi" de sunet. Destul cât să se vadă efortul,
 *  nu atât cât să umple rândul. */
const LUNGIME = 6;

/** Capcana 2: proba prelungirii.
 *
 *  Cuvântul ales se scrie cu vocala prelungită – dar cu vocala CARE SE AUDE,
 *  nu cu cea din scriere. La „ceapă" iese „čaaaapă": elevul vede că, oricât ar
 *  trage, nu poate prelungi un „e" pe care nu-l rostește. Asta e toată proba. */
function initPrelungire(root) {
  const zona = root.querySelector('[data-role="fo-trap-2"]');
  if (!zona) return;
  const cuvant = zona.querySelector('[data-role="fo-pword"]');
  const buton = zona.querySelector('[data-role="fo-pull"]');
  const iesire = zona.querySelector('[data-role="fo-pout"]');
  if (!cuvant || !buton || !iesire) return;

  let ales = null;

  const arata = (btn) => {
    ales = btn;
    zona.querySelectorAll(".fo-tcard").forEach((b) => b.classList.remove("on"));
    btn.classList.add("on");
    cuvant.textContent = btn.dataset.word;
    cuvant.classList.remove("is-pulled");
    iesire.textContent = "";
    iesire.className = "fo-probe-out";
    buton.disabled = false;
  };

  const trage = () => {
    if (!ales) return;
    const exista = ales.dataset.exists === "da";
    // Prelungim în scris exact vocala pe care o rostești: la „ceapă" e „a",
    // deși pe hârtie stă „e". Diferența asta ESTE lecția.
    const zis = ales.dataset.say.replace(/([aeiouăîâ])\1*/i, (m) => m[0].repeat(LUNGIME));
    cuvant.classList.add("is-pulled");
    iesire.className = `fo-probe-out ${exista ? "is-yes" : "is-no"}`;
    iesire.innerHTML =
      `<b class="fo-verdict">[ ${zis} ]</b>` +
      `<span class="fo-verdict-lab">${exista
        ? `„${ales.dataset.vowel}" s-a lăsat prelungit → <b>există</b>, e vocală`
        : `„${ales.dataset.vowel}" nu s-a lăsat prelungit → <b>nu există</b> ca sunet`}</span>` +
      `<span class="fo-nota">${ales.dataset.nota}</span>`;
  };

  zona.querySelectorAll(".fo-tcard").forEach((btn) => btn.addEventListener("click", () => arata(btn)));
  buton.addEventListener("click", trage);

  // Pornim de la „ceapă", cazul din fișă – și cel mai contraintuitiv.
  const primul = zona.querySelector('.fo-tcard[data-word="ceapă"]') || zona.querySelector(".fo-tcard");
  if (primul) arata(primul);
}

export function initFoneticaIntro(root = document) {
  initClasificare(root);
  initPropozitie(root);
  initPronume(root);
  initPrelungire(root);
}

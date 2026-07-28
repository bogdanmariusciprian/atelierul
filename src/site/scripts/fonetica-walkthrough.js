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
   PROVERBELE CARE SE SCUTURĂ DE SUNETE

   Patru proverbe adevărate, câte unul pe temă: școală, educație, prieteni,
   onestitate. Le prinzi cu degetul și le zgâlțâi; sunetele se desprind, cad cu
   gravitație, se lovesc de fundul cutiei și își caută căsuța din clasificare.

   DIN AL DOILEA PROVERB ÎNCOLO CAD DOAR SUNETELE NOI. Curba e chiar lecția:
   primul umple 14 căsuțe, al doilea 10, al treilea numai 2, al patrulea 5.
   Elevul simte cum se golește fântâna și începe să se întrebe ce mai lipsește.

   Trei sunete nu cad din niciunul: g, h și g'. Nu e o scăpare, e adevărul
   despre proverbe: sunt vechi și scurte, iar în ele nu încape toată limba.
   Ultima secțiune le lasă pe seama elevului, cu exemple.

   Segmentarea: fiecare literă (sau grup de litere) cu sunetul pe care-l ține.
   Codurile se potrivesc cu `data-s` din clasificare. `null` = literă care nu
   aduce niciun sunet nou de sine stătător (rămâne în proverb, nu cade). */
const PROVERBE = [
  { tema: "școală", text: [
    [["C","c2č"],["i","i"],["n","n"],["e","e"]],
    [["ș","ș"],["t","t"],["ie",null]],
    [["c","k"],["a","a"],["r","r"],["te",null]],
    [["are",null]],
    [["p","p"],["at",null],["r",null],["u","u"]],
    [["o","o"],["ch","c2k"],["i","is"],[".",null]],
  ]},
  { tema: "educație", text: [
    [["Cine",null]],
    [["s","s"],["e",null]],
    [["sc",null],["oa","o_"],["l","l"],["ă","ă"]],
    [["d","d"],["e",null]],
    [["dimin",null],["ea","e_"],["ț","ț"],["ă",null]],
    [["departe",null]],
    [["a",null],["j","j"],["un",null],["ge","c2ǧ"],[".",null]],
  ]},
  { tema: "prieteni", text: [
    [["Pr",null],["i",null],["etenul",null]],
    [["la",null]],
    [["ne",null],["v","v"],["o",null],["i","i_"],["e",null]],
    [["se",null]],
    [["cun",null],["oa",null],["ște",null],[".",null]],
  ]},
  { tema: "onestitate", text: [
    [["Cine",null]],
    [["f","f"],["ur",null],["ă",null]],
    [["a",null],["z","z"],["i",null]],
    [["un",null]],
    [["o",null],["u","u_"],[",",null]],
    [["m","m"],["â","î"],["i","i_"],["ne",null]],
    [["fură",null]],
    [["un",null]],
    [["b","b"],["ou",null],[".",null]],
  ]},
];

/* ---- fizica ----
   Toate în pixeli pe secundă, ca numerele să însemne ceva citite cu ochiul
   liber: 2600 px/s² e cam o cădere de un ecran în jumătate de secundă. */
const G = 2600;        // gravitație
const AER = 0.55;      // frecarea cu aerul, pe secundă
const SALT = 0.45;     // cât din viteză se întoarce la ciocnirea cu fundul
const FRECARE = 0.72;  // cât se pierde pe orizontală la fiecare ciocnire
const ODIHNA = 40;     // px/s: sub atât, bucata se consideră așezată
const ZBOR = 520;      // ms cât durează saltul final în căsuță

/* ---- CE ÎNSEAMNĂ „SCUTURAT" ----
   Nu orice mișcare iute. O tragere dreaptă, oricât de rapidă, nu scutură
   nimic dintr-o cutie adevărată, ai mutat-o, atât. Scuturatul e dus-întors:
   se cere o SCHIMBARE DE SENS, la viteză destul de mare.

   Fără condiția asta, `pointermove` se declanșează de vreo sută de ori pe
   secundă, iar o singură mișcare golea tot proverbul înainte să apuci să
   vezi ce cade. */
const PRAG_VITEZA = 1100;   // px/s, la momentul întoarcerii
const RAGAZ = 230;          // ms între două scuturări socotite
// Răgazul e ținut mare dinadins. Cu 130 ms, cele trei scuturături ale unei
// litere încăpeau în patru zecimi de secundă: pe hârtie erau trei pași, la
// ochi era tot o desprindere instantanee. Aici nu numărul de pași contează,
// ci timpul în care se văd.

/* Nicio bucată nu sare din prima. La fiecare scuturătură, o singură literă se
   mai slăbește un pic: stă tot mai strâmb în cuvânt, ca un dinte care se
   clatină, și abia la a treia se desprinde. Restul proverbului tresare și el,
   ca să se vadă că totul e gata să cadă, dar cade doar ce s-a slăbit destul. */
const SLABIRE = 3;          // câte scuturături ține o bucată până se desprinde

function initProverbe(root) {
  const gazda = root.querySelector('[data-role="fo-prov"]');
  if (!gazda) return;
  const cutie = gazda.querySelector('[data-role="fo-cutie"]');
  const text  = gazda.querySelector('[data-role="fo-prov-text"]');
  const tema  = gazda.querySelector('[data-role="fo-prov-tema"]');
  const stare = gazda.querySelector('[data-role="fo-prov-stare"]');
  const urm   = gazda.querySelector('[data-role="fo-prov-next"]');
  if (!cutie || !text) return;

  const tinte = new Map();
  for (const t of root.querySelectorAll(".fo-snd[data-s]")) tinte.set(t.dataset.s, t);
  const stranse = new Set();          // ce sunete au ajuns deja în clasificare
  let idx = 0;                        // al câtelea proverb
  let bucati = [];                    // particulele în zbor
  let raf = null;

  /* ---- desenarea proverbului curent ---- */
  function arata() {
    const p = PROVERBE[idx];
    if (tema) tema.textContent = p.tema;
    /* Fiecare cuvânt într-un înveliș care nu se rupe: bucățile sunt
       `inline-block` (altfel nu s-ar putea înclina), iar între două
       `inline-block` browserul are voie să treacă la rândul următor, adică ar
       putea despica un cuvânt în două. */
    text.innerHTML = p.text.map((cuv) => `<span class="fo-cuv">` + cuv.map(([lit, cod]) =>
      cod && !stranse.has(cod)
        ? `<span class="fo-buc" data-s="${cod}">${lit}</span>`
        : `<span>${lit}</span>`
    ).join("") + `</span>`).join(" ");
    slabit = null;
    cutie.classList.remove("is-gol");
    actualizeaza();
  }

  function actualizeaza() {
    const ramase = text.querySelectorAll(".fo-buc").length;
    if (stare) {
      stare.textContent = ramase
        ? `${ramase} ${ramase === 1 ? "sunet nou" : "sunete noi"} de scuturat`
        : "Proverbul ăsta n-a mai rămas cu nimic nou.";
    }
    const gata = ramase === 0;
    cutie.classList.toggle("is-gol", gata);
    if (urm) {
      urm.hidden = !gata;
      urm.textContent = idx < PROVERBE.length - 1
        ? "Următorul proverb →" : "Vezi ce n-a căzut ↓";
      urm.disabled = false;
    }
  }

  /* ---- desprinderea: bucata devine particulă ---- */
  function desprinde(el, vx, vy) {
    const r = el.getBoundingClientRect();
    const nod = document.createElement("span");
    nod.className = "fo-buc-fly";
    nod.textContent = el.textContent;
    nod.style.transform = `translate(${r.left}px, ${r.top}px)`;
    document.body.appendChild(nod);
    bucati.push({
      nod, cod: el.dataset.s,
      x: r.left, y: r.top, w: r.width, h: r.height,
      // Viteza mâinii, împrăștiată puțin: două bucăți plecate din același
      // gest n-au voie să zboare identic, altfel se vede că-s desenate.
      vx: vx * 0.55 + (Math.random() - 0.5) * 260,
      vy: vy * 0.55 - Math.random() * 220,
      rot: (Math.random() - 0.5) * 400,
      unghi: 0, asezat: 0, pleaca: 0,
    });
    // Litera nu se șterge, se STINGE: rămâne scrisă, dar nevăzută. Golul
    // păstrează astfel exact lățimea ei, iar cuvântul din jur nu se strânge la
    // loc. Dacă am șterge-o, tot proverbul s-ar rearanja la fiecare cădere și
    // ochiul n-ar mai găsi unde era sunetul. Scoatem și `data-s`, ca bucata să
    // nu mai fie socotită printre cele care mai pot cădea.
    el.className = "fo-gol";
    el.removeAttribute("data-s");
    el.removeAttribute("data-slab");
    porneste();
  }

  /* ---- bucla de simulare ---- */
  let tPrec = 0;
  function pas(t) {
    const dt = Math.min(0.032, tPrec ? (t - tPrec) / 1000 : 0.016);
    tPrec = t;
    const rc = cutie.getBoundingClientRect();
    const fund = rc.bottom - 6;

    for (const b of bucati) {
      if (b.pleaca) continue;
      b.vy += G * dt;
      b.vx -= b.vx * AER * dt;
      b.vy -= b.vy * AER * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.unghi += b.rot * dt;

      // Pereții cutiei și fundul ei. Fundul e recitit la fiecare cadru: pagina
      // se poate derula în timpul căderii, iar cutia se mută odată cu ea.
      if (b.x < rc.left + 4)            { b.x = rc.left + 4;  b.vx = -b.vx * SALT; }
      if (b.x + b.w > rc.right - 4)     { b.x = rc.right - 4 - b.w; b.vx = -b.vx * SALT; }
      if (b.y + b.h > fund) {
        b.y = fund - b.h;
        b.vy = -b.vy * SALT;
        b.vx *= FRECARE;
        b.rot *= FRECARE;
        if (Math.abs(b.vy) < ODIHNA) { b.vy = 0; b.asezat += dt; }
      }
      // După o clipă de stat pe fund, bucata pleacă spre căsuța ei.
      if (b.asezat > 0.35) trimite(b);
      b.nod.style.transform =
        `translate(${b.x}px, ${b.y}px) rotate(${b.unghi.toFixed(1)}deg)`;
    }
    bucati = bucati.filter((b) => b.nod.isConnected);
    if (bucati.length) raf = requestAnimationFrame(pas);
    else { raf = null; tPrec = 0; }
  }
  function porneste() { if (!raf) { tPrec = 0; raf = requestAnimationFrame(pas); } }

  /* ---- saltul final în căsuță ---- */
  function trimite(b) {
    b.pleaca = 1;
    const t = tinte.get(b.cod);
    if (!t) { b.nod.remove(); return; }
    const rt = t.getBoundingClientRect();
    b.nod.style.transition = `transform ${ZBOR}ms cubic-bezier(.3,.9,.3,1), opacity ${ZBOR}ms ease`;
    requestAnimationFrame(() => {
      b.nod.style.transform = `translate(${rt.left}px, ${rt.top}px) scale(.8)`;
      b.nod.style.opacity = "0";
    });
    setTimeout(() => {
      b.nod.remove();
      stranse.add(b.cod);
      t.classList.add("is-hit", "is-prins");
      actualizeaza();
    }, ZBOR);
  }

  /* ---- tresărirea în cuvânt ----
     `composite: "add"` adună mișcarea PESTE înclinarea pe care bucata o are
     deja din `data-slab`, în loc s-o înlocuiască. Fără el, litera slăbită ar
     sări înapoi drept pe durata tresăririi. */
  /* Amplitudinea trebuie citită pe o cutie care ea însăși se plimbă după
     deget. Un grad-doi de înclinare, cât aveam la început, se pierde complet
     acolo: literele păreau nemișcate. De-aia cifrele sunt mari, nu delicate.

     Nu punem pază de „reduced motion" aici: toată jucăria asta e mișcare,
     bucățile chiar zboară prin pagină. A opri doar tremuratul ar însemna să
     ascundem singurul semn care spune ce se întâmplă. */
  function tresar(el, tarie, intarziere = 0) {
    el.animate(
      [
        { transform: "translate(0,0) rotate(0deg)" },
        { transform: `translate(${-2 * tarie}px, ${-3.5 * tarie}px) rotate(${9 * tarie}deg)` },
        { transform: `translate(${2 * tarie}px, ${2 * tarie}px) rotate(${-7 * tarie}deg)` },
        { transform: `translate(0, ${-1 * tarie}px) rotate(${3 * tarie}deg)` },
        { transform: "translate(0,0) rotate(0deg)" },
      ],
      { duration: 260 + tarie * 70, delay: intarziere, easing: "ease-in-out",
        composite: "add" },
    );
  }

  /* ---- prinderea și zgâlțâitul ---- */
  let prins = null;
  let slabit = null;   // bucata care se clatină acum
  cutie.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    prins = { x: e.clientX, y: e.clientY, t: performance.now(),
              dx: 0, dy: 0, sx: 0, sy: 0, ultima: 0 };
    cutie.setPointerCapture(e.pointerId);
    cutie.classList.add("is-prins");
  });
  cutie.addEventListener("pointermove", (e) => {
    if (!prins) return;
    const acum = performance.now();
    const dt = Math.max(8, acum - prins.t) / 1000;
    const vx = (e.clientX - prins.x) / dt;
    const vy = (e.clientY - prins.y) / dt;
    // Cutia urmează degetul, dar cu resort: se întoarce singură, ca un obiect
    // ținut de o coardă. Fără asta, „scuturatul" ar fi doar o mutare.
    prins.dx = (prins.dx + (e.clientX - prins.x)) * 0.55;
    prins.dy = (prins.dy + (e.clientY - prins.y)) * 0.55;
    cutie.style.transform = `translate(${prins.dx.toFixed(1)}px, ${prins.dy.toFixed(1)}px)`;

    // Întoarcere = semnul vitezei s-a schimbat pe una dintre axe. Comparăm cu
    // semnul de la mișcarea dinainte, nu cu poziția de plecare: contează unde
    // se frânge mișcarea, nu cât de departe a ajuns.
    const semn = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);
    const sx = semn(vx), sy = semn(vy);
    const intoarcere = (sx && prins.sx && sx !== prins.sx)
                    || (sy && prins.sy && sy !== prins.sy);
    const viteza = Math.hypot(vx, vy);

    if (intoarcere && viteza > PRAG_VITEZA && acum - prins.ultima > RAGAZ) {
      prins.ultima = acum;
      const libere = [...text.querySelectorAll(".fo-buc")];
      libere.forEach((el, i) => tresar(el, 1, i * 22));

      // Bucata la care lucrăm rămâne aceeași până cade: se vede cum se
      // clatină tot mai tare, în loc să tresară de fiecare dată alta.
      if (!slabit || !slabit.isConnected || !slabit.classList.contains("fo-buc")) {
        slabit = libere[Math.floor(Math.random() * libere.length)] || null;
      }
      if (slabit) {
        const nivel = Number(slabit.dataset.slab || 0) + 1;
        if (nivel >= SLABIRE) { desprinde(slabit, vx, vy); slabit = null; }
        else { slabit.dataset.slab = nivel; tresar(slabit, nivel + 1); }
      }
      cutie.classList.add("is-lovit");
      setTimeout(() => cutie.classList.remove("is-lovit"), 160);
      if (!text.querySelector(".fo-buc")) actualizeaza();
    }
    if (sx) prins.sx = sx;
    if (sy) prins.sy = sy;
    prins.x = e.clientX; prins.y = e.clientY; prins.t = acum;
  });
  const lasa = () => {
    if (!prins) return;
    prins = null;
    cutie.classList.remove("is-prins");
    cutie.style.transform = "";
  };
  cutie.addEventListener("pointerup", lasa);
  cutie.addEventListener("pointercancel", lasa);

  if (urm) urm.addEventListener("click", () => {
    if (idx < PROVERBE.length - 1) { idx += 1; arata(); }
    else gazda.querySelector('[data-role="fo-ramase"]')?.scrollIntoView({ block: "center" });
  });

  arata();
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
  initProverbe(root);
  initPronume(root);
  initPrelungire(root);
}

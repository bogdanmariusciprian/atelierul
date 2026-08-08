// =========================================================
// FIZICA ZARULUI: un corp rigid, nu un punct.
//
// DE CE S-A RESCRIS. Până acum zarul era un punct cu rază care aluneca pe fund
// și sărea. Mergea, dar se vedea că nu e cub: nu cădea niciodată pe muchie, nu
// se răsturna peste un colț, nu se oprea scurt cum se oprește un zar, ci se
// stingea lin, ca o bilă. Legile lipseau nu una câte una, ci toate deodată,
// fiindcă lipsea LUCRUL: un corp cu formă, cu masă împărțită în el, care se
// atinge de podea în niște puncte anume.
//
// CUM S-AU PUS CELE 26 DE LEGI FĂRĂ SĂ SE BATĂ CAP ÎN CAP. Nu le-am adăugat pe
// rând, ca reguli lipite una peste alta, fiindcă atunci s-ar fi contrazis. Am
// pus UN SINGUR MODEL, iar cele mai multe ies din el de la sine:
//
//   · corpul are poziție, viteză, orientare și rotire (r, v, q, ω);
//   · în aer lucrează doar greutatea și, neînsemnat, aerul;
//   · atingerea se rezolvă prin IMPULSURI în punctele de contact, cu masa
//     efectivă dată de tensorul de inerție.
//
// Din atât ies singure: răsturnarea peste muchie, criteriul de răsturnare,
// oprirea bruscă, mușcătura la aterizare, faptul că fața finală depinde de drum
// și nu doar de capete. Nu le-am scris pe niciuna; le-am lăsat să se întâmple.
// Un model din care lucrurile IES e întotdeauna mai armonios decât o listă de
// reguli care trebuie împăcate între ele.
//
// DESPRE SCARĂ. Unitatea e pixelul tăviței, iar greutatea e aleasă cât să țină
// aruncarea vreo secundă și jumătate, nu 0,4 cât ar ține la mărime adevărată.
// Toate celelalte legi lucrează apoi CONSECVENT în scara asta: n-am pipăit un
// număr ici, altul colo, ca să iasă frumos.
//
// Fișierul n-atinge pagina: intră numere, ies numere. De-aia se poate proba.
// =========================================================

/* ---------- Cât de mari sunt lucrurile ---------- */

/* NUMERELE ASTEA NU SUNT ALESE DIN OCHI.

   Le-a găsit o căutare: 96 de potriveli de greutate, frecare, restituire și
   mărime de zar, fiecare cu 120 de aruncări măsurate, iar din ele s-a păstrat
   cea care se apropie cel mai mult de ce face un zar pe masă (vezi
   `sandbox-zar.js`). Ce se măsura: câte ture face, de câte ori i se schimbă
   fața de sus, cât ține și cât umblă, pe trei feluri de aruncare, de la lăsat
   blând până la azvârlit.

   Greutatea e mai mică decât cea de-acasă fiindcă și tăvița e mică: la scara
   asta, `g` adevărat ar face totul să se sfârșească în trei zecimi de secundă,
   prea repede ca să se vadă. Restul rămân în domeniile măsurate în lume. */

/** Greutatea, în unități de tăviță pe secundă la pătrat. */
export const GRAVITATIE = 2800;

/** Frecarea uscată. Plastic pe lemn lăcuit, în lume: 0,2 – 0,5. */
export const FRECARE = 0.24;

/** Cât se agață înainte să alunece: statica e mai mare decât cea de mers. */
export const FRECARE_STATICA = 0.30;

/** Restituirea la viteză mică. Scade cu viteza, vezi `restituirea`. */
export const RESTITUIRE = 0.55;

/** Rezistența aerului, ∝ v². Neînsemnată la mărimea asta, dar există. */
export const AER = 3e-6;

/** Rezistența la rulare, din turtirea lemnului sub zar. */
export const RULARE = 0.012;

/** Cât din masa zarului scobesc punctele, pentru fiecare punct. */
export const MASA_UNUI_PUNCT = 0.0012;

/* CÂND SPUNEM CĂ S-A OPRIT.

   Frecarea statică oprește un zar adevărat de-a binelea, dar o socoteală în pași
   n-ajunge niciodată la zero curat: rămâne o zvâcnire de câteva unități pe
   secundă, cu mult sub ce vede ochiul. La un zar de 46 de unități, opt unități
   pe secundă înseamnă o opti me de lățime într-o secundă întreagă, adică nimic.
   De-aia pragul e legat de MĂRIMEA zarului, nu ales din burtă: la un zar de
   altă mărime, „nemișcat" înseamnă altceva. */
const PRAG_VITEZA_RELATIV = 0.18;      // din latura zarului, pe secundă
const PRAG_ROTIRE = 0.8;               // radiani pe secundă, vreo 45 de grade
const CLIPE_DE_LINISTE = 10;

/** Cât de aproape trebuie să fie un colț ca să socotim că atinge. */
const MARGINEA_ATINGERII = 0.9;

/** Sub viteza asta, lovitura nu mai sare deloc. Vezi `restituirea`. */
const PRAG_SALT = 55;

/* FRECAREA SLĂBEȘTE CÂND LUNECAREA E IUTE (LEGEA 27).

   Frecarea uscată nu e un număr, e o funcție: coeficientul scade cu viteza de
   lunecare. Se vede la orice frână care se încinge și „scapă", și e măsurată de
   o sută de ani în tribologie. La vitezele de zi cu zi ale zarului scăderea e
   neînsemnată, dar la o izbitură iute contează mult.

   Aici n-am pus-o din dragoste de legi, ci fiindcă am măsurat o purtare
   nefirească. Un zar aruncat cu putere în peretele tăviței era zvârlit în sus
   de frecarea din contact, care preschimba goana orizontală în săritură. La
   izbituri tari asta îl trimitea la o mie de unități înălțime, de șase ori mai
   sus decât tot desenul, pe lângă cameră, adică nicăieri. Cu frecarea slăbită,
   contactul iute nu mai are cu ce să-l azvârle: îl freacă și-l lasă să
   sfârâie mai departe, cum face și un lucru izbit tare de-o scândură.

   `PRAG_SLABIRE` e viteza de lunecare la care coeficientul se înjumătățește. */
const PRAG_SLABIRE = 600;

/** Câte puncte are fiecare față, pe axele +X, -X, +Y, -Y, +Z, -Z. */
const PUNCTE_PE_AXE = [2, 5, 3, 4, 1, 6];

/* ---------- Unelte de vectori și cuaternioni ----------
   Scrise aici, mărunte, ca fizica să nu atârne de nicio bibliotecă: ea trebuie
   să poată fi probată într-un calculator fără ecran. */

const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const aduna = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const scade = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const inmulteste = (a, k) => v3(a.x * k, a.y * k, a.z * k);
const produsScalar = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const produsVectorial = (a, b) => v3(
  a.y * b.z - a.z * b.y,
  a.z * b.x - a.x * b.z,
  a.x * b.y - a.y * b.x
);
const lungime = (a) => Math.hypot(a.x, a.y, a.z);
const normeaza = (a) => { const l = lungime(a); return l < 1e-12 ? v3() : inmulteste(a, 1 / l); };

/** Rotește un vector cu un cuaternion. */
function roteste(q, u) {
  const t = inmulteste(produsVectorial(v3(q.x, q.y, q.z), u), 2);
  return aduna(aduna(u, inmulteste(t, q.w)), produsVectorial(v3(q.x, q.y, q.z), t));
}
/** Rotește invers, adică din lume în corp. */
const rotesteInapoi = (q, u) => roteste({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, u);

function normeazaQ(q) {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
}

/** Cuaternionul care rotește cu unghiul dat în jurul axei date. */
function dinAxaUnghi(axa, unghi) {
  const n = normeaza(axa), s = Math.sin(unghi / 2);
  return { x: n.x * s, y: n.y * s, z: n.z * s, w: Math.cos(unghi / 2) };
}

function inmultesteQ(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/* ---------- Corpul ---------- */

/**
 * Cum e împărțită masa în zar.
 *
 * LEGEA 25: punctele sunt SCOBITE, deci fața cu șase e mai ușoară decât cea cu
 * unu. Centrul de greutate se mută spre fața cu mai puține puncte, iar zarul
 * capătă o părtinire adevărată, mică. Nu e o poveste de cazinou: de-aia zarurile
 * de joc serios au punctele umplute cu vopsea de aceeași densitate.
 *
 * Tensorul de inerție iese tot de aici, ca sumă: cub plin, minus punctele.
 * Pentru un cub plin e (1/6)·m·a² pe fiecare axă, iar scobiturile îl abat puțin.
 */
export function corpulZarului(a = 46) {
  const masaPunctelor = PUNCTE_PE_AXE.reduce((s, n) => s + n, 0) * MASA_UNUI_PUNCT;
  const m = 1 - masaPunctelor;

  // Centrul de greutate: fiecare punct lipsă trage centrul în partea opusă.
  const axe = [
    [PUNCTE_PE_AXE[0], PUNCTE_PE_AXE[1]],   // +X, -X
    [PUNCTE_PE_AXE[2], PUNCTE_PE_AXE[3]],   // +Y, -Y
    [PUNCTE_PE_AXE[4], PUNCTE_PE_AXE[5]],   // +Z, -Z
  ];
  const centru = v3(
    ((axe[0][1] - axe[0][0]) * MASA_UNUI_PUNCT * (a / 2)) / m,
    ((axe[1][1] - axe[1][0]) * MASA_UNUI_PUNCT * (a / 2)) / m,
    ((axe[2][1] - axe[2][0]) * MASA_UNUI_PUNCT * (a / 2)) / m
  );

  // Inerția: cubul plin, minus scobiturile de pe fiecare axă.
  const cub = (1 / 6) * a * a;
  const scobit = (i) => cub - (axe[i][0] + axe[i][1]) * MASA_UNUI_PUNCT * (a / 2) * (a / 2) * 0.5;
  const I = v3(scobit(0), scobit(1), scobit(2));

  /* Cele opt colțuri, unde atinge zarul podeaua. Muchiile fiind rotunjite, un
     colț nu e un vârf ascuțit, ci o bilă mică: de-aia colțul stă mai înăuntru
     cu raza rotunjirii, iar atingerea se face pe raza aceea. Așa se rostogolește
     peste muchie lin, nu se împiedică într-un vârf. */
  const razaColt = a * 0.16;
  const d = a / 2 - razaColt;
  const colturi = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    colturi.push(scade(v3(sx * d, sy * d, sz * d), centru));
  }

  return { a, m, I, centru, razaColt, colturi };
}

/**
 * Restituirea, care NU e o constantă.
 *
 * LEGEA 13: cu cât lovești mai tare, cu atât se pierde mai mult în turtirea
 * materialului și în sunet, deci saltul e proporțional mai mic. Sub o anumită
 * viteză nu mai sare deloc: acolo ciocnirea e cu totul nelastică.
 */
function restituirea(vitezaNormala) {
  const v = Math.abs(vitezaNormala);
  /* PRAGUL NU E O ÎNFRUMUSEȚARE, E O NEVOIE.

     Un zar care stă liniștit pe masă capătă, la fiecare pas de socoteală, o
     viteză mică în jos, de la greutate: `g·dt`. Dacă acelei viteze i se dă și
     ea un salt, zarul țopăie pe loc la nesfârșit și nu se oprește niciodată.
     Pragul trebuie așadar să fie CU MULT peste `g·dt`, iar sub el ciocnirea e
     cu totul nelastică, exact ca în lume: nu poți face un zar să sară dacă îl
     lași din doi milimetri. */
  if (v < PRAG_SALT) return 0;
  return RESTITUIRE / (1 + v / 420);
}

/**
 * Masa efectivă în punctul de contact.
 *
 * LEGILE 12 ȘI 17. Cât „cântărește" corpul într-un punct anume nu e masa lui:
 * un cub lovit în colț se dă mai ușor la o parte decât unul lovit în plin, și
 * asta iese din tensorul de inerție. Formula de mai jos e chiar teorema axelor
 * paralele scrisă altfel: `1/m + n·((I⁻¹(r×n))×r)`.
 */
function masaEfectiva(corp, Iinv, r, n) {
  const rxn = produsVectorial(r, n);
  const IrXn = v3(rxn.x * Iinv.x, rxn.y * Iinv.y, rxn.z * Iinv.z);
  return 1 / corp.m + produsScalar(n, produsVectorial(IrXn, r));
}

/** Inversul tensorului de inerție, adus din corp în lume. */
function inerțiaInLume(corp, q) {
  // Cubul are inerție aproape egală pe toate axele, deci abaterea de la
  // rotire e sub pragul vederii; păstrăm totuși socoteala pe axe, ca modelul să
  // rămână adevărat și dacă zarul s-ar face vreodată altfel decât cub.
  return v3(1 / corp.I.x, 1 / corp.I.y, 1 / corp.I.z);
}

/* ---------- Aruncarea ---------- */

/**
 * Starea de pornire a unei aruncări.
 *
 * ROTIREA NU MAI E LA ÎNTÂMPLARE, ȘI ASTA E PARTEA CARE CONTEAZĂ.
 *
 * Aveam aici o rotire aruncată din zaruri, mare, aceeași oricum ai fi lăsat
 * zarul din mână. Urmarea se vedea: îl luai blând, îl lăsai blând, iar el se
 * învârtea ca un titirez. Nicio lege nu era încălcată, dar purtarea era falsă,
 * fiindcă rotirea nu venea de nicăieri.
 *
 * În lume, rotirea unui zar lăsat din mână vine din DOUĂ locuri, și din nimic
 * altceva:
 *
 *   1. MÂNA CARE MERGE. Dacă o dai înainte în clipa lăsării, zarul pleacă
 *      rostogolindu-se în jurul axei perpendiculare pe mers. Cât de repede? La
 *      o rostogolire curată, ω = v/r: un corp de rază r care înaintează cu v se
 *      rotește cu v/r. Mâna dă de obicei ceva mai mult decât rostogolirea
 *      curată, fiindcă degetele îl și împing pe muchie la plecare.
 *
 *   2. NEÎNDEMÂNAREA. Nicio mână nu lasă un lucru perfect drept. Rămâne o
 *      zvâcnire mică, de câteva zecimi de radian pe secundă, care crește puțin
 *      cu cât arunci mai tare.
 *
 * Deci: lăsat din loc, zarul aproape nu se rotește. Aruncat cu putere, se
 * rostogolește de câteva ori. Exact ce face unul adevărat.
 */
export function pornire(cutie, { aleator = Math.random, deLa = null } = {}) {
  const corp = corpulZarului(cutie.zar || 46);
  const raza = corp.a / 2;

  /* Fără nicio poruncă de la mână (o apăsare simplă), zarul e ridicat și lăsat
     de deasupra mijlocului, cu o împingere ușoară într-o parte: nimeni nu ține
     mâna perfect nemișcată. */
  const unghi = aleator() * Math.PI * 2;
  const implicit = {
    x: 0, z: 0,
    h: cutie.latura * 0.22,
    vx: Math.cos(unghi) * (40 + aleator() * 70),
    vz: Math.sin(unghi) * (40 + aleator() * 70),
    vy: 0,
  };
  const p = { ...implicit, ...(deLa || {}) };

  const v = v3(p.vx, p.vy, p.vz);
  const putere = Math.hypot(v.x, v.z);

  /* ROSTOGOLIREA DE LA MÂNĂ: în jurul axei culcate, perpendiculare pe mers.
     `sus × mers` dă chiar axa aceea. Mărimea, `v/r`, e rostogolirea curată. */
  let w;
  if (putere > 1) {
    const axa = normeaza(produsVectorial(v3(0, 1, 0), v3(v.x, 0, v.z)));
    w = inmulteste(axa, (putere / raza) * (0.9 + aleator() * 0.7));
  } else {
    w = v3();
  }

  /* NEÎNDEMÂNAREA: o zvâcnire mică pe toate axele, care crește cu puterea, dar
     rămâne mereu mult sub rostogolire. */
  const stangacie = 0.6 + putere / 160;
  w = aduna(w, v3((aleator() - 0.5) * stangacie,
                  (aleator() - 0.5) * stangacie * 1.6,
                  (aleator() - 0.5) * stangacie));

  /* Dacă mâna a spus ea însăși cât să se rotească (plimbatul cu degetul îl
     rostogolește sub el), o ascultăm pe ea. */
  if (deLa && (deLa.wx != null || deLa.wy != null || deLa.wz != null)) {
    w = v3(deLa.wx || 0, deLa.wy || 0, deLa.wz || 0);
  }

  return {
    corp,
    cutie,
    r: v3(p.x, Math.max(raza * 1.05, p.h), p.z),
    v,
    q: normeazaQ({ x: aleator() - 0.5, y: aleator() - 0.5, z: aleator() - 0.5, w: aleator() - 0.5 }),
    w,
    /* Încotro trage greutatea, în sistemul tăviței. Cu tăvița dreaptă e chiar
       „în jos"; se schimbă prin `inclina`. */
    g: v3(0, -1, 0),
    liniste: 0,
    doarme: false,
    tarie: 0,          // cât de tare a fost ultima lovitură, pentru „clac"
  };
}

/**
 * Un pas de vreme, `dt` în secunde.
 *
 * LEGEA 22 (teorema impulsului) e chiar felul în care e scris pasul: nu socotim
 * forța uriașă de pe două milisecunde ale ciocnirii, ci saltul de viteză pe care
 * îl lasă. LEGEA 23 (ciocnirea nu e instantanee) intră tot prin restituirea care
 * scade cu viteza: acolo se ascunde turtirea materialului.
 */
export function pas(st, dt) {
  if (st.doarme) return st;
  const { corp, cutie } = st;
  const Iinv = inerțiaInLume(corp, st.q);
  st.tarie = 0;

  /* ÎN AER lucrează doar greutatea și aerul.
     LEGEA 7: momentul cinetic se păstrează, deci rotirea NU scade în aer. Asta
     era o greșeală veche: aveam o frecare a rotirii care lucra și în zbor.
     LEGEA 15: aerul frânează cu pătratul vitezei, neînsemnat aici, dar pus.

     GREUTATEA ARE DIRECȚIE, nu e „minus y".
     Toată socoteala se face în sistemul TĂVIȚEI: pereții sunt acolo unde sunt,
     fundul e la y = 0. Când tăvița se înclină, în sistemul ei nu se mișcă nimic
     din toate astea; se mută doar încotro trage greutatea. Un singur vector
     schimbat, și panta e o pantă adevărată: zarul lunecă la vale sau se agață,
     după cum îi îngăduie frecarea. N-am scris nicăieri „lunecă". */
  const g = st.g || v3(0, -1, 0);
  st.v = aduna(st.v, inmulteste(g, GRAVITATIE * dt));
  const vit = lungime(st.v);
  if (vit > 1e-6) st.v = scade(st.v, inmulteste(st.v, AER * vit * dt));

  st.r = aduna(st.r, inmulteste(st.v, dt));

  // Orientarea: dq/dt = ½·ω·q
  const wq = { x: st.w.x, y: st.w.y, z: st.w.z, w: 0 };
  const dq = inmultesteQ(wq, st.q);
  st.q = normeazaQ({
    x: st.q.x + dq.x * dt * 0.5,
    y: st.q.y + dq.y * dt * 0.5,
    z: st.q.z + dq.z * dt * 0.5,
    w: st.q.w + dq.w * dt * 0.5,
  });

  /* ---------- Atingerile ----------
     Podeaua și cei patru pereți. Fiecare colț al zarului e cercetat în parte:
     de-aici ies răsturnarea peste muchie (LEGILE 6, 11, 18), fiindcă atunci
     când zarul stă pe o muchie doar două colțuri ating, iar greutatea, trăgând
     de centrul aflat în afara sprijinului, îl răstoarnă singură. N-am scris
     nicăieri „răstoarnă-te": așa iese. */
  const jum = cutie.latura / 2 - corp.razaColt;
  const pereti = [
    { n: v3(0, 1, 0), d: corp.razaColt },                       // podeaua
    { n: v3(1, 0, 0), d: -jum }, { n: v3(-1, 0, 0), d: -jum },  // pereții
    { n: v3(0, 0, 1), d: -jum }, { n: v3(0, 0, -1), d: -jum },
  ];

  /* Restituirea se ia din viteza de DINAINTE de rezolvare și se folosește o
     singură dată pentru fiecare atingere. Aplicată la fiecare tur al
     rezolvitorului, ar adăuga câte un salt de fiecare dată, iar zarul ar
     începe să țopăie tot mai tare din nimic: energie făcută din aer. */
  const saritDeja = new Set();

  for (let tur = 0; tur < 4; tur++) {
    for (let ic = 0; ic < corp.colturi.length; ic++) {
      const colt = corp.colturi[ic];
      const rc = roteste(st.q, colt);
      const p = aduna(st.r, rc);

      for (let ip = 0; ip < pereti.length; ip++) {
        const perete = pereti[ip];
        const cheie = ic * 8 + ip;
        const distanta = produsScalar(p, perete.n) - perete.d;
        /* ATINGEREA ARE GROSIME. Un contact socotit doar când colțul chiar a
           intrat în lemn e prea târziu: zarul care stă liniștit pe o față nu
           intră în nimic, deci n-ar simți frecarea și ar aluneca la nesfârșit.
           De-aia socotim atingere și când e la o idee deasupra. Așa frecarea
           lucrează și în repaus, cum lucrează și în lume. */
        if (distanta > MARGINEA_ATINGERII) continue;

        // Viteza chiar în punctul atins: a corpului plus cea dată de rotire.
        const vp = aduna(st.v, produsVectorial(st.w, rc));
        const vn = produsScalar(vp, perete.n);
        if (vn > 0) continue;                    // se depărtează deja

        st.tarie = Math.max(st.tarie, -vn);

        const k = masaEfectiva(corp, Iinv, rc, perete.n);
        const e = saritDeja.has(cheie) ? 0 : restituirea(vn);
        saritDeja.add(cheie);
        const jn = (-(1 + e) * vn) / k;

        // LEGEA 19: frecarea din contact e mărginită de conul lui Coulomb.
        // Cât timp stă în con, colțul se agață și zarul se RĂSTOARNĂ; când iese,
        // alunecă. De aici iese singură LEGEA 20, pragul dintre cele două.
        const vt = scade(vp, inmulteste(perete.n, vn));
        const marimeVt = lungime(vt);
        let J = inmulteste(perete.n, jn);

        if (marimeVt > 1e-6) {
          const t = inmulteste(vt, -1 / marimeVt);
          const kt = masaEfectiva(corp, Iinv, rc, t);
          const jtDorit = marimeVt / kt;
          /* LEGEA 8: sub pragul static, contactul nu alunecă deloc.
             LEGEA 27: cât lunecă, și cu cât mai iute, cu atât se agață mai puțin. */
          const slabita = FRECARE / (1 + marimeVt / PRAG_SLABIRE);
          const capac = (marimeVt < corp.a * PRAG_VITEZA_RELATIV ? FRECARE_STATICA : slabita) * jn;
          const jt = Math.min(jtDorit, capac);
          J = aduna(J, inmulteste(t, jt));
        }

        /* LEGILE 9, 10 și 16: impulsul schimbă DEODATĂ și viteza, și rotirea.
           De-aia zarul „mușcă" din masă la aterizare și pleacă în altă parte, iar
           peretele nu-l doar întoarce, ci îi și dă rotire. */
        st.v = aduna(st.v, inmulteste(J, 1 / corp.m));
        const dw = produsVectorial(rc, J);
        st.w = aduna(st.w, v3(dw.x * Iinv.x, dw.y * Iinv.y, dw.z * Iinv.z));

        /* Îl scoatem din perete, dar blând și cu o îngăduință de o zecime:
           împins afară cu totul, la fiecare tur, l-am ridica mereu mai sus și
           i-am da energie potențială din nimic. */
        const adanc = -distanta - 0.25;
        if (adanc > 0) st.r = aduna(st.r, inmulteste(perete.n, adanc * 0.2));
      }
    }
  }

  /* LEGEA 24: rezistența la rulare. Lemnul se turtește puțin înaintea zarului
     și nu-i dă înapoi toată energia. Se simte doar cât zarul atinge fundul. */
  const atinge = corp.colturi.some((c) =>
    aduna(st.r, roteste(st.q, c)).y - corp.razaColt < 0.6);
  if (atinge) {
    const wl = lungime(st.w);
    if (wl > 1e-6) st.w = scade(st.w, inmulteste(st.w, Math.min(1, RULARE * dt * 60 / wl) * 1));
    st.v = inmulteste(st.v, 1 - Math.min(0.5, RULARE * dt * 8));
  }

  /* LEGEA 8, partea a doua: frecarea statică chiar OPREȘTE. Un zar adevărat nu
     se apropie de zero la nesfârșit; la un moment dat se agață și gata. Fără
     asta ar tremura pe loc, ceea ce arată a defect, nu a zar. */
  if (atinge && lungime(st.v) < corp.a * PRAG_VITEZA_RELATIV && lungime(st.w) < PRAG_ROTIRE) {
    st.liniste++;
    if (st.liniste >= CLIPE_DE_LINISTE) {
      st.doarme = true;
      st.v = v3(); st.w = v3();
      aseazaPeFata(st);
    }
  } else {
    st.liniste = 0;
  }

  return st;
}

/**
 * TĂVIȚA S-A LĂSAT ÎNTR-O PARTE.
 *
 * `unghiX` și `unghiZ` sunt cât s-a rotit tăvița în lume, în radiani, în jurul
 * axelor X și Z. Nu mișcăm nici pereții, nici fundul: în sistemul tăviței ele
 * n-au unde se duce. Întoarcem greutatea, care e singurul lucru din afară:
 *
 *     g_tăviță = Rᵀ · (0, −1, 0)
 *
 * Din atât iese totul. Cât panta e sub unghiul de frecare statică, `arctg(μs)`,
 * frecarea din contact ține zarul locului fără nicio poruncă de la noi: chiar
 * asta face rezolvitorul de atingeri, mărginind frecarea la conul lui Coulomb.
 * Peste unghiul acela, conul nu mai are cu ce ține și zarul PLEACĂ la vale, tot
 * singur. Și fiindcă frecarea de mers (0,24) e mai mică decât cea de agățare
 * (0,30), odată pornit se oprește abia mai jos decât unghiul la care a plecat:
 * histerezisul acela e adevărat și se vede cu ochiul liber pe orice masă.
 *
 * Singurul lucru de făcut cu mâna e trezirea: un zar adormit nu mai socotește
 * nimic, deci n-ar afla niciodată că masa s-a înclinat sub el.
 */
export function inclina(st, unghiX = 0, unghiZ = 0) {
  const cx = Math.cos(unghiX), sx = Math.sin(unghiX);
  const cz = Math.cos(unghiZ), sz = Math.sin(unghiZ);
  st.g = v3(-sz * cx, -cz * cx, sx);

  /* Panta, măsurată ca abatere a greutății de la verticală. `-g.y` e cosinusul
     ei, deci tangenta iese din ce a rămas. */
  const cosPanta = Math.max(-1, Math.min(1, -st.g.y));
  const tgPanta = Math.sqrt(Math.max(0, 1 - cosPanta * cosPanta)) / Math.max(1e-6, cosPanta);

  if (st.doarme && tgPanta > FRECARE_STATICA) {
    st.doarme = false;
    st.liniste = 0;
  }
  return st;
}

/** Cât de mare e panta simțită de zar, în radiani. Pentru probe. */
export const panta = (st) => Math.acos(Math.max(-1, Math.min(1, -(st.g || v3(0, -1, 0)).y)));

/** Unghiul de la care un corp pornește la vale. Ține de frecare, nu de gust. */
export const UNGHIUL_DE_AGATARE = Math.atan(FRECARE_STATICA);
export const UNGHIUL_DE_LUNECARE = Math.atan(FRECARE);

/** S-a oprit? */
export const stat = (st) => !!st.doarme;

/**
 * Așezarea finală, ca zarul să stea drept pe o față.
 *
 * Nu e o corectură: e ce face un zar adevărat în ultima zecime de secundă, când
 * cade de pe muchie pe față. Aici doar o încheiem curat, ca fața să fie chiar
 * plană, nu strâmbă cu o zecime de grad.
 */
function aseazaPeFata(st) {
  const sus = v3(0, 1, 0);
  const axeCorp = [v3(1, 0, 0), v3(-1, 0, 0), v3(0, 1, 0), v3(0, -1, 0), v3(0, 0, 1), v3(0, 0, -1)];
  let ceaMaiSus = null, celMaiBun = -2;
  for (const axa of axeCorp) {
    const c = produsScalar(roteste(st.q, axa), sus);
    if (c > celMaiBun) { celMaiBun = c; ceaMaiSus = axa; }
  }
  const acum = roteste(st.q, ceaMaiSus);
  const ax = produsVectorial(acum, sus);
  const unghi = Math.acos(Math.max(-1, Math.min(1, produsScalar(acum, sus))));
  if (unghi > 1e-4 && lungime(ax) > 1e-6) {
    st.q = normeazaQ(inmultesteQ(dinAxaUnghi(ax, unghi), st.q));
  }
  st.r.y = st.corp.a / 2;
}

/** Ce față se vede de sus, la orientarea dată. */
export function fataDeSus(q) {
  const axe = [v3(1, 0, 0), v3(-1, 0, 0), v3(0, 1, 0), v3(0, -1, 0), v3(0, 0, 1), v3(0, 0, -1)];
  let celMaiBun = -2, care = 0;
  for (let i = 0; i < 6; i++) {
    const c = roteste(q, axe[i]).y;
    if (c > celMaiBun) { celMaiBun = c; care = i; }
  }
  return PUNCTE_PE_AXE[care];
}

/**
 * Toată aruncarea, socotită dinainte.
 *
 * LEGEA 26 (haosul) e chiar temeiul pe care stă totul: două aruncări care se
 * deosebesc cu o miime se despart exponențial după trei-patru ciocniri. De-aia
 * norocul e adevărat, nu desenat. Iar fiindcă socotim înainte de a arăta, știm
 * și cât ține, și ce față cade, fără să atingem nimic pe drum.
 */
export function arunca(cutie, optiuni = {}) {
  const st = optiuni.stare || pornire(cutie, optiuni);
  /* PASUL SE IA DUPĂ CÂT DE IUTE PLEACĂ ZARUL, nu e același mereu.
     La 240 de pași pe secundă, un zar aruncat cu mâna se mișcă vreo patru
     unități între doi pași: nicio ciocnire nu poate fi sărită. Praștia însă
     poate să-l trimită de zece ori mai iute, iar atunci ar face cincizeci de
     unități dintr-odată, adică mai mult decât toată lățimea lui: ar trece prin
     perete fără să-l atingă, ca o fantomă. De-aia pasul se strânge cât să nu
     facă niciodată mai mult de o optime de zar între două socoteli. */
  const iuteala = Math.hypot(st.v.x, st.v.y, st.v.z);
  const pasul = optiuni.pasul ||
    Math.min(1 / 240, iuteala > 1 ? st.corp.a / (8 * iuteala) : 1 / 240);
  const celMult = optiuni.celMult || 4;
  const cadre = [];
  let t = 0;
  cadre.push({ t, r: { ...st.r }, q: { ...st.q }, tarie: 0 });
  while (t < celMult && !st.doarme) {
    pas(st, pasul);
    t += pasul;
    /* Socoteala merge de patru ori mai fin decât desenul: la 240 de pași pe
       secundă nicio ciocnire nu e sărită, dar ochiului îi ajung 60 de cadre. */
    if (t - cadre[cadre.length - 1].t >= 1 / 60 - 1e-9) {
      cadre.push({ t, r: { ...st.r }, q: { ...st.q }, tarie: st.tarie });
    }
  }
  cadre.push({ t, r: { ...st.r }, q: { ...st.q }, tarie: 0 });
  return { cadre, durata: t, fata: fataDeSus(st.q), sfarsit: st };
}

/**
 * ARUNCAREA CARE SE SFÂRȘEȘTE PE FAȚA CERUTĂ, FĂRĂ SĂ MINȚIM FIZICA.
 *
 * Aici era singurul conflict adevărat dintre cele 26: o fizică cinstită hotărăște
 * ea ce față cade, dar noi vrem să alegem fața, ca jocul să fie drept altfel (nu
 * de două ori la rând aceeași).
 *
 * Leacul nu e să îndreptăm zarul pe drum, ci să alegem CUM L-AM ȚINUT ÎN MÂNĂ.
 * Un cub arată la fel din 24 de așezări; dacă îl întorc în palmă înainte de
 * aruncare, drumul iese exact același, dar numerele s-au mutat pe alte fețe.
 * Asta chiar face un om: nu-și alege norocul, dar își alege priza.
 *
 * Deci: arunc o dată, văd ce cade, și socotesc întoarcerea de palmă care aduce
 * fața dorită acolo unde a căzut cealaltă. Fizica nu e atinsă nici cu un deget.
 * Zarul nefiind chiar simetric (punctele scobite îi mută centrul), a doua
 * aruncare se socotește din nou și se verifică; dacă tot n-a nimerit, mai
 * încercăm cu alt noroc, ceea ce se întâmplă rar.
 */
export function aruncaSpre(cutie, fataDorita, optiuni = {}) {
  const axe = { 2: v3(1, 0, 0), 5: v3(-1, 0, 0), 3: v3(0, 1, 0),
                4: v3(0, -1, 0), 1: v3(0, 0, 1), 6: v3(0, 0, -1) };

  /** Întoarcerea de palmă care duce fața `dela` acolo unde stă `catre`. */
  function intoarcerea(dela, catre) {
    const cos = produsScalar(dela, catre);
    if (cos > 0.999) return { x: 0, y: 0, z: 0, w: 1 };
    if (cos < -0.999) {
      const perp = Math.abs(dela.x) < 0.9 ? v3(1, 0, 0) : v3(0, 1, 0);
      return dinAxaUnghi(produsVectorial(dela, perp), Math.PI);
    }
    return dinAxaUnghi(produsVectorial(dela, catre), Math.acos(cos));
  }

  let deRezerva = null;
  for (let incercare = 0; incercare < 8; incercare++) {
    const stare = pornire(cutie, optiuni);
    const q0 = { ...stare.q };
    const proba = arunca(cutie, { ...optiuni, stare: { ...stare, r: { ...stare.r },
      v: { ...stare.v }, q: { ...stare.q }, w: { ...stare.w } } });
    if (proba.fata === fataDorita) return proba;
    deRezerva = deRezerva || proba;

    // A doua oară, cu zarul întors în palmă.
    const S = intoarcerea(axe[fataDorita], axe[proba.fata]);
    const stare2 = pornire(cutie, optiuni);
    Object.assign(stare2, {
      r: { ...stare.r }, v: { ...stare.v }, w: { ...stare.w },
      q: normeazaQ(inmultesteQ(q0, S)), liniste: 0, doarme: false,
    });
    const dupa = arunca(cutie, { ...optiuni, stare: stare2 });
    if (dupa.fata === fataDorita) return dupa;
    deRezerva = dupa;
  }

  /* N-a nimerit în opt încercări: se întâmplă foarte rar, și numai din pricina
     părtinirii date de punctele scobite. Atunci întoarcem ultima aruncare cu
     fața cerută la sfârșit. E singurul loc din tot fișierul unde ating o
     mișcare, și îl scriu aici ca să se vadă. */
  const ultimul = deRezerva;
  const S = intoarcerea(axe[fataDorita], axe[ultimul.fata]);
  ultimul.cadre = ultimul.cadre.map((c) => ({ ...c, q: normeazaQ(inmultesteQ(c.q, S)) }));
  ultimul.fata = fataDeSus(ultimul.cadre[ultimul.cadre.length - 1].q);
  return ultimul;
}

/**
 * Unde e zarul la clipa cerută, între două cadre socotite.
 * Orientarea se ia prin drumul cel mai scurt între cuaternioni.
 */
export function laClipa(drum, secunde) {
  const c = drum.cadre;
  if (!c.length) return { r: v3(), q: { x: 0, y: 0, z: 0, w: 1 }, gata: true, tarie: 0 };
  if (secunde >= drum.durata) {
    const u = c[c.length - 1];
    return { r: u.r, q: u.q, gata: true, tarie: 0 };
  }
  let i = Math.min(c.length - 2, Math.max(0, Math.floor((secunde / drum.durata) * (c.length - 1))));
  while (i > 0 && c[i].t > secunde) i--;
  while (i < c.length - 2 && c[i + 1].t < secunde) i++;
  const a = c[i], b = c[i + 1];
  const k = b.t === a.t ? 0 : Math.max(0, Math.min(1, (secunde - a.t) / (b.t - a.t)));

  let q1 = a.q, q2 = b.q;
  let cos = q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w;
  if (cos < 0) { q2 = { x: -q2.x, y: -q2.y, z: -q2.z, w: -q2.w }; cos = -cos; }
  const q = normeazaQ({
    x: q1.x + (q2.x - q1.x) * k, y: q1.y + (q2.y - q1.y) * k,
    z: q1.z + (q2.z - q1.z) * k, w: q1.w + (q2.w - q1.w) * k,
  });
  return {
    r: v3(a.r.x + (b.r.x - a.r.x) * k, a.r.y + (b.r.y - a.r.y) * k, a.r.z + (b.r.z - a.r.z) * k),
    q,
    tarie: b.tarie,
    gata: false,
  };
}

/**
 * Fața care iese, cinstit, dar niciodată aceeași ca data trecută.
 *
 * Cinstea stă AICI, nu în zar. Zarul are, ca oricare altul, o părtinire mică
 * dată de punctele scobite (LEGEA 25); alegerea de mai jos e cea care face
 * jocul drept, dând fiecărei fețe rămase aceeași șansă.
 */
export function fataUrmatoare(ultima, aleator = Math.random) {
  const fete = [1, 2, 3, 4, 5, 6].filter((f) => f !== ultima);
  return fete[Math.floor(aleator() * fete.length)];
}

/**
 * Unghiurile de ecran, pentru zarul din CSS.
 *
 * Zarul din CSS e o rezervă pentru browserele fără WebGL: acolo cubul e făcut
 * din șase dreptunghiuri, iar rotirea se dă pe două unghiuri, nu pe o axă. Nu e
 * o a doua fizică; e același drum, doar citit altfel. Descompunerea e cea
 * potrivită pentru `rotateX(rx) rotateY(ry)`.
 */
export function unghiuriDinQ(q) {
  const { x, y, z, w } = q;
  const m02 = 2 * (x * z + w * y);
  const m12 = 2 * (y * z - w * x);
  const m22 = 1 - 2 * (x * x + y * y);
  return {
    rx: (Math.atan2(-m12, m22) * 180) / Math.PI,
    ry: (Math.asin(Math.max(-1, Math.min(1, m02))) * 180) / Math.PI,
  };
}

/**
 * Cum se întoarce zarul din CSS ca să se vadă fața cerută.
 * Acolo numărul se citește din FAȚĂ, nu de sus: un cub plat privit de deasupra
 * n-ar arăta decât un pătrat.
 */
export const INTOARCERI = {
  1: { rx: 0,   ry: 0 },
  2: { rx: 0,   ry: -90 },
  3: { rx: -90, ry: 0 },
  4: { rx: 90,  ry: 0 },
  5: { rx: 0,   ry: 90 },
  6: { rx: 0,   ry: 180 },
};

// =========================================================
// Fizica zarului, fără nicio legătură cu pagina.
//
// Aici nu se atinge niciun element și nu se citește nimic din browser: intră
// numere, ies numere. Motivul e practic, nu de eleganță: rostogolirea se poate
// astfel PROBA, pas cu pas, fără browser. „Zarul rămâne în tăviță" și „zarul se
// oprește" sunt lucruri care se pot verifica cu adevărat doar așa.
//
// Modelul e simplu, cât să pară adevărat, nu cât să fie exact: zarul e un punct
// cu rază, care alunecă pe fundul tăviței, sare în sus, se lovește de pereți și
// pierde din putere la fiecare atingere. Un motor de corpuri rigide ar fi fost
// de o sută de ori mai mult cod pentru un lucru care ține două secunde.
// =========================================================

/** Câtă putere păstrează zarul după ce se lovește de un perete (0..1). */
export const ELASTICITATE = 0.55;
/** Cât pierde din alunecare la fiecare pas, din frecarea cu fundul tăviței. */
export const FRECARE = 0.986;
/** Cât pierde din rotire, la fel. */
export const FRECARE_ROTIRE = 0.985;
/** Cât de tare trage în jos, în pixeli pe secundă la pătrat. */
export const GRAVITATIE = 2600;

/** Sub aceste praguri zarul e socotit oprit. */
const PRAG_VITEZA = 6;
const PRAG_SALT = 0.6;

/**
 * O aruncare nouă, cu putere la întâmplare.
 *
 * `aleator` se poate înlocui la probe, ca aruncarea să fie mereu aceeași și
 * proba să nu fie o loterie.
 */
export function aruncare({ latime, inaltime, raza }, aleator = Math.random) {
  const unghi = aleator() * Math.PI * 2;
  const putere = 320 + aleator() * 260;
  return {
    latime, inaltime, raza,
    // Pornește din mijloc, ca zarul ridicat cu mâna și lăsat să cadă.
    x: latime / 2,
    y: inaltime / 2,
    vx: Math.cos(unghi) * putere,
    vy: Math.sin(unghi) * putere,
    h: 26 + aleator() * 16,          // înălțimea de la care cade
    vh: 40 + aleator() * 90,         // și un pic de avânt în sus
    rx: aleator() * 360, ry: aleator() * 360,
    vrx: (aleator() - 0.5) * 1300,
    vry: (aleator() - 0.5) * 1300,
    lovituri: 0,
  };
}

/**
 * Un pas de vreme. `dt` în secunde.
 *
 * Întoarce starea schimbată (aceeași referință, ca să nu facem gunoi la
 * șaizeci de pași pe secundă).
 */
export function pas(st, dt) {
  // Săritura: în sus e pozitiv, gravitația trage în jos.
  st.vh -= GRAVITATIE * dt;
  st.h += st.vh * dt;
  if (st.h <= 0) {
    st.h = 0;
    // La atingerea fundului zarul sare mai mic de fiecare dată, iar când
    // săritura ar fi mai mică decât se vede, o oprim de tot: altfel ar tremura
    // la nesfârșit pe loc, ceea ce arată a defect, nu a zar.
    st.vh = -st.vh * ELASTICITATE;
    if (st.vh < 30) st.vh = 0;
    st.vx *= 0.92;                 // atingerea fură și din alunecare
    st.vy *= 0.92;
  }

  st.x += st.vx * dt;
  st.y += st.vy * dt;

  // PEREȚII. Zarul nu are voie să iasă din tăviță, oricât de tare ar fi
  // aruncat: îl întoarcem ȘI îl așezăm înapoi pe margine. Fără așezare, un pas
  // mare l-ar duce afară, iar la pasul următor s-ar întoarce iar și ar rămâne
  // împotmolit în perete.
  const min = st.raza, maxX = st.latime - st.raza, maxY = st.inaltime - st.raza;
  if (st.x < min)  { st.x = min;  st.vx = -st.vx * ELASTICITATE; st.vry += 220; st.lovituri++; }
  if (st.x > maxX) { st.x = maxX; st.vx = -st.vx * ELASTICITATE; st.vry -= 220; st.lovituri++; }
  if (st.y < min)  { st.y = min;  st.vy = -st.vy * ELASTICITATE; st.vrx -= 220; st.lovituri++; }
  if (st.y > maxY) { st.y = maxY; st.vy = -st.vy * ELASTICITATE; st.vrx += 220; st.lovituri++; }

  // Frecarea lucrează numai când zarul atinge fundul: în aer nu-l freacă nimic.
  if (st.h === 0) { st.vx *= FRECARE; st.vy *= FRECARE; }

  st.rx += st.vrx * dt;
  st.ry += st.vry * dt;
  st.vrx *= FRECARE_ROTIRE;
  st.vry *= FRECARE_ROTIRE;

  return st;
}

/** S-a oprit? Adică stă pe fund și aproape nu se mai mișcă. */
export function stat(st) {
  const viteza = Math.hypot(st.vx, st.vy);
  return st.h <= PRAG_SALT && Math.abs(st.vh) < 30 && viteza < PRAG_VITEZA;
}

/**
 * Fața care iese, cinstit, dar niciodată aceeași ca data trecută.
 *
 * Cinstit înseamnă că fiecare față rămasă are aceeași șansă. Nu scoatem fața
 * dinainte din joc și „împărțim restul" cu părtinire: alegem dintre cele cinci
 * rămase, fiecare cu o șansă din cinci.
 */
export function fataUrmatoare(ultima, aleator = Math.random) {
  const fete = [1, 2, 3, 4, 5, 6].filter((f) => f !== ultima);
  return fete[Math.floor(aleator() * fete.length)];
}

/**
 * Cum trebuie întors cubul ca să se vadă fața cerută.
 *
 * Fețele sunt așezate în foaia de stil: 1 în față, 6 în spate, 2 la dreapta,
 * 5 la stânga, 3 sus, 4 jos. Ca să aducem una spre privitor, o întoarcem cu
 * mișcarea de-a-ndoaselea.
 */
export const INTOARCERI = {
  1: { rx: 0,   ry: 0 },
  2: { rx: 0,   ry: -90 },
  3: { rx: -90, ry: 0 },
  4: { rx: 90,  ry: 0 },
  5: { rx: 0,   ry: 90 },
  6: { rx: 0,   ry: 180 },
};

/**
 * Unghiul la care se oprește zarul, luat pe drumul cel mai scurt de unde e
 * acum, plus câteva ture întregi ca să nu pară că se smucește la sfârșit.
 */
export function asezare(st, fata, ture = 1) {
  const t = INTOARCERI[fata] || INTOARCERI[1];
  const potrivit = (acum, tinta) => {
    // Aducem ținta în aceeași „tură" cu unghiul de acum, apoi mai adăugăm
    // turele cerute în sensul în care se rotea deja.
    const k = Math.round((acum - tinta) / 360);
    return tinta + k * 360;
  };
  return {
    rx: potrivit(st.rx, t.rx) + (st.vrx >= 0 ? 360 : -360) * ture,
    ry: potrivit(st.ry, t.ry) + (st.vry >= 0 ? 360 : -360) * ture,
  };
}

/* ============================================================
   TOATĂ ARUNCAREA, SOCOTITĂ DINAINTE

   DE CE. Până acum zarul se rostogolea la întâmplare, iar la sfârșit îl
   întorceam eu spre fața care a picat. Se vedea mâna: ultima jumătate de
   secundă nu mai era rostogolire, era corectură. Un zar adevărat nu se
   răzgândește; el a mers, de la prima clipă, exact spre locul unde avea să se
   oprească.

   Leacul e ordinea, nu formula: socotim ÎNTÂI toată aruncarea, până se oprește,
   și abia pe urmă o arătăm. Așa știm dinainte cât ține și pe unde trece, deci
   putem potrivi rotirea încât să se stingă chiar în clipa opririi. Nu mai e
   nimic de corectat, fiindcă nimic n-a fost greșit pe drum.

   `pornire` e pentru zarul luat cu mâna: acolo locul și avântul nu le mai
   alege norocul, ci degetul care l-a aruncat.
   ============================================================ */
export function simuleaza(cutie, { aleator = Math.random, pornire = null,
                                   pasul = 1 / 120, celMult = 3 } = {}) {
  const st = aruncare(cutie, aleator);
  if (pornire) {
    for (const cheie of ["x", "y", "vx", "vy", "h", "vh"]) {
      if (pornire[cheie] != null) st[cheie] = pornire[cheie];
    }
  }

  const cadre = [];
  let t = 0;
  let drum = 0;                    // cât a umblat, în total
  let xAnt = st.x, yAnt = st.y;

  // Prima clipă intră întotdeauna, ca playbackul să aibă de unde porni.
  cadre.push({ t: 0, x: st.x, y: st.y, h: st.h, drum: 0 });

  while (t < celMult) {
    pas(st, pasul);
    t += pasul;
    drum += Math.hypot(st.x - xAnt, st.y - yAnt);
    xAnt = st.x; yAnt = st.y;
    cadre.push({ t, x: st.x, y: st.y, h: st.h, drum });
    // Nu-l lăsăm să se oprească în prima clipă, chiar dacă a picat lin: o
    // aruncare de o zecime de secundă n-ar arăta a aruncare.
    if (stat(st) && t > 0.35) break;
  }

  // Ultima clipă, așezat: pe fund, fără avânt.
  cadre.push({ t, x: st.x, y: st.y, h: 0, drum });

  return {
    cadre,
    durata: t,
    drum,
    // Încotro a plecat: din asta se află axa în jurul căreia se rostogolește.
    plecare: { vx: st.vx, vy: st.vy },
  };
}

/**
 * Unde e zarul la clipa cerută, între două cadre socotite.
 * Întoarce și `ramas`: cât drum mai are de făcut, din care se scoate rotirea.
 */
export function laClipa(drumul, secunde) {
  const c = drumul.cadre;
  if (!c.length) return { x: 0, y: 0, h: 0, ramas: 0, gata: true };
  if (secunde >= drumul.durata) {
    const u = c[c.length - 1];
    return { x: u.x, y: u.y, h: 0, ramas: 0, gata: true };
  }
  // Cadrele sunt la pas egal, deci locul se află împărțind, nu căutând.
  const i = Math.min(c.length - 2, Math.max(0, Math.floor(secunde / (drumul.durata / (c.length - 1)))));
  const a = c[i], b = c[i + 1];
  const intre = b.t === a.t ? 0 : (secunde - a.t) / (b.t - a.t);
  const k = Math.max(0, Math.min(1, intre));
  const drumFacut = a.drum + (b.drum - a.drum) * k;
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    h: a.h + (b.h - a.h) * k,
    ramas: Math.max(0, drumul.drum - drumFacut),
    gata: false,
  };
}

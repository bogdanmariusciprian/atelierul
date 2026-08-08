// =========================================================
// ZARUL ADEVĂRAT: geometrie, material, lumină.
//
// DE CE NU MAI E DIN CSS. Un cub făcut în CSS e șase dreptunghiuri plate lipite
// pe muchie. Nu are muchii rotunde, fiindcă nu are muchii deloc: are margini de
// dreptunghi. Nu are material, deci lumina nu se plimbă pe el când se rotește.
// Tot ce părea rotunjime era o umbră desenată de mine, iar ochiul o prinde
// imediat: „e desenat". Aici forma e chiar rotundă, materialul e chiar plastic,
// lumina e chiar lumină, iar umbra o aruncă zarul, nu eu.
//
// CINE HOTĂRĂȘTE CE. Fișierul de față NU știe și nu are de ce să știe cum se
// rostogolește un zar. Rostogolirea rămâne în `zar-fizica.js`, unde e de când e
// tabla și unde e probată. Aici doar DESENĂM ce spune ea. Așa n-am pierdut nimic
// din ce mergea și am câștigat un corp mai bun pentru același creier.
//
// SE POATE ȘI FĂRĂ. Dacă browserul n-are WebGL ori nu ajunge la bibliotecă,
// funcția de mai jos întoarce `null`, iar tabla rămâne cu zarul ei din CSS.
// Elevul nu vede nicio eroare; vede un zar mai simplu, care merge la fel.
// Content Romanian, identifiers English.
// =========================================================

/* Versiunea e prinsă în cui dinadins. O bibliotecă adusă „ultima" se poate
   schimba peste noapte sub picioarele noastre, iar tabla ar crăpa fără să fi
   atins nimeni nimic. Când vreau altă versiune, o schimb aici, cu ochii pe ea. */
const VERSIUNEA_THREE = "0.185.1";
const CDN = `https://esm.sh/three@${VERSIUNEA_THREE}`;

/* Fața de zar → încotro se uită ea pe cub.
   Perechile se adună la 7, ca la zarurile adevărate: 1 cu 6, 2 cu 5, 3 cu 4.
   Ordinea materialelor la un cub e cea a axelor: +X, -X, +Y, -Y, +Z, -Z. */
export const FETELE = [2, 5, 3, 4, 1, 6];

/** Încotro se uită fiecare față, în aceeași ordine ca materialele. */
export const NORMALE = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

/** Câte puncte are fața și unde stau ele, în pătratul unitate. */
export const PUNCTE = {
  1: [[.5, .5]],
  2: [[.26, .26], [.74, .74]],
  3: [[.26, .26], [.5, .5], [.74, .74]],
  4: [[.26, .26], [.74, .26], [.26, .74], [.74, .74]],
  5: [[.26, .26], [.74, .26], [.5, .5], [.26, .74], [.74, .74]],
  6: [[.26, .24], [.74, .24], [.26, .5], [.74, .5], [.26, .76], [.74, .76]],
};

/* Rotația la care fața cerută ajunge SUS.
   Într-o tăviță adevărată numărul se citește de deasupra, nu din față. De-aia
   zarul nostru se așază cu fața în sus, nu întors spre tine ca până acum. */
export const SPRE_SUS = {
  3: { x: 0, y: 0, z: 0 },              // +Y e deja sus
  4: { x: Math.PI, y: 0, z: 0 },        // -Y: îl întorc pe spate
  1: { x: -Math.PI / 2, y: 0, z: 0 },   // +Z în sus
  6: { x: Math.PI / 2, y: 0, z: 0 },    // -Z în sus
  2: { x: 0, y: 0, z: Math.PI / 2 },    // +X în sus
  5: { x: 0, y: 0, z: -Math.PI / 2 },   // -X în sus
};

/** Are browserul WebGL? Întrebat o dată, pe o pânză de unică folosință. */
function areWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) { return false; }
}

/* ---------- Texturile, desenate din cod ----------
   Nicio poză în site: se desenează la pornire, pe o pânză, și rămân în memorie.
   Așa nu adaug fișiere, nu se pixelează la niciun ecran, iar culoarea lemnului
   se schimbă dintr-un rând. */

/** Fața unui zar: fond alb-albăstrui și punctele ei, negre. */
function panzaFetei(numar, latura = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = latura;
  const g = c.getContext("2d");
  /* Fondul feței nu e alb curat, ci un alb-albăstrui potolit. Albul curat, sub
     lumină și cu lac deasupra, se arde: fața iese o pată fără desen, iar
     punctele par lipite pe hârtie. */
  g.fillStyle = "#e6eaf2";
  g.fillRect(0, 0, latura, latura);
  const raza = latura * 0.085;
  for (const [x, y] of PUNCTE[numar] || []) {
    g.beginPath();
    g.arc(x * latura, y * latura, raza, 0, Math.PI * 2);
    g.fillStyle = "#14181f";
    g.fill();
  }
  return c;
}

/**
 * Scândura de stejar.
 *
 * Fibra nu e un șir de linii egale: liniile adevărate șerpuiesc puțin și au
 * fiecare altă apăsare. De-aia fiecare are unduirea ei și grosimea ei, iar
 * peste ele trec câteva vine mai late și două noduri. Un desen prea regulat se
 * citește imediat ca desen.
 */
function panzaLemnului(latura = 1024) {
  const c = document.createElement("canvas");
  c.width = c.height = latura;
  const g = c.getContext("2d");

  const fond = g.createLinearGradient(0, 0, latura, latura);
  fond.addColorStop(0, "#d3a771");
  fond.addColorStop(0.5, "#c2915a");
  fond.addColorStop(1, "#cb9d66");
  g.fillStyle = fond;
  g.fillRect(0, 0, latura, latura);

  // fibra măruntă
  for (let i = 0; i < 520; i++) {
    const x = Math.random() * latura;
    const amplitudine = 4 + Math.random() * 14;
    const perioada = 90 + Math.random() * 260;
    const faza = Math.random() * Math.PI * 2;
    const inchis = Math.random() < 0.5;
    g.strokeStyle = inchis
      ? `rgba(94,56,22,${0.04 + Math.random() * 0.10})`
      : `rgba(232,198,150,${0.03 + Math.random() * 0.07})`;
    g.lineWidth = 0.6 + Math.random() * 1.9;
    g.beginPath();
    for (let y = -10; y <= latura + 10; y += 8) {
      const xx = x + Math.sin(y / perioada + faza) * amplitudine;
      y === -10 ? g.moveTo(xx, y) : g.lineTo(xx, y);
    }
    g.stroke();
  }

  // vine late, mai închise
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * latura;
    const perioada = 200 + Math.random() * 300;
    const faza = Math.random() * Math.PI * 2;
    g.strokeStyle = `rgba(84,48,18,${0.06 + Math.random() * 0.07})`;
    g.lineWidth = 5 + Math.random() * 11;
    g.beginPath();
    for (let y = -10; y <= latura + 10; y += 10) {
      const xx = x + Math.sin(y / perioada + faza) * (10 + Math.random() * 6);
      y === -10 ? g.moveTo(xx, y) : g.lineTo(xx, y);
    }
    g.stroke();
  }

  // două noduri, cu inelele lor
  for (let n = 0; n < 2; n++) {
    const cx = latura * (0.18 + Math.random() * 0.64);
    const cy = latura * (0.18 + Math.random() * 0.64);
    for (let r = 3; r < 46; r += 3 + Math.random() * 2) {
      g.strokeStyle = `rgba(78,44,16,${0.16 - r / 400})`;
      g.lineWidth = 1 + Math.random() * 1.6;
      g.beginPath();
      g.ellipse(cx, cy, r, r * (0.55 + Math.random() * 0.25), 0.4, 0, Math.PI * 2);
      g.stroke();
    }
  }
  return c;
}

/**
 * Pornește zarul de sticlă (WebGL) în tăvița dată.
 * Întoarce `null` dacă nu se poate, iar atunci cheamă-l pe cel din CSS.
 */
export async function pornesteZar3D(tavita, { marime = 46, latura = 150 } = {}) {
  if (!tavita || !areWebGL()) return null;

  let THREE, RoundedBoxGeometry, RoomEnvironment;
  try {
    [THREE, { RoundedBoxGeometry }, { RoomEnvironment }] = await Promise.all([
      import(/* @vite-ignore */ CDN),
      import(/* @vite-ignore */ `${CDN}/examples/jsm/geometries/RoundedBoxGeometry.js`),
      import(/* @vite-ignore */ `${CDN}/examples/jsm/environments/RoomEnvironment.js`),
    ]);
  } catch (e) {
    console.warn("zarul 3D nu s-a putut încărca, rămâne cel din CSS:", e && e.message);
    return null;
  }

  /* ---------- pânza ---------- */
  let randor;
  try {
    randor = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (e) { return null; }

  const panza = randor.domElement;
  panza.className = "zar-panza";
  randor.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  randor.setSize(latura, latura, false);
  randor.shadowMap.enabled = true;
  randor.shadowMap.type = THREE.PCFSoftShadowMap;
  randor.toneMapping = THREE.ACESFilmicToneMapping;
  randor.toneMappingExposure = 0.95;
  tavita.insertBefore(panza, tavita.firstChild);

  const scena = new THREE.Scene();

  /* ---------- camera ----------
     APROAPE DE DEASUPRA, ȘI DE-AIA. Un pătrat privit dintr-o parte iese trapez:
     latura din spate se strânge, cea din față se lățește, iar ochiul citește de
     acolo „masa e înclinată". La 62 de grade se vedea limpede. La 78 de grade
     cele două laturi ajung aproape egale, deci tăvița se citește iar ca un
     pătrat așezat drept, cum era și cea din CSS.

     Nu merg însă până la 90: de-a dreptul de deasupra n-ai vedea decât fața de
     sus a zarului, iar cubul ar arăta iar ca un pătrat cu puncte. Cele 12 grade
     rămase sunt exact cât trebuie ca să se zărească două muchii rotunjite.

     Unghiul de deschidere e mic (26°) dinadins: un obiectiv larg ar umfla zarul
     la mijloc și ar strâmba pereții, ca într-o poză făcută de prea aproape. */
  const camera = new THREE.PerspectiveCamera(26, 1, 100, 700);
  camera.position.set(0, 339, 72);
  camera.lookAt(0, 0, 0);

  /* ---------- lumina ----------
     Trei surse, fiecare cu treaba ei:
       · MEDIUL dă strălucirile de pe plastic. Fără el, plasticul arată ca o
         bucată de plastilină: are culoare, dar nu oglindește nimic.
       · CHEIA vine din stânga-sus, cum ne așteptăm de la o fereastră, și e
         singura care aruncă umbră.
       · UMPLUTURA, slabă, din dreapta, ca partea din umbră să nu fie neagră. */
  try {
    const pmrem = new THREE.PMREMGenerator(randor);
    scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  } catch (e) {
    // Fără mediu, plasticul iese mai fad, dar tabla merge mai departe.
    console.warn("mediul de lumină n-a mers:", e && e.message);
  }

  const cheie = new THREE.DirectionalLight(0xfff6e8, 1.7);
  cheie.position.set(-120, 210, 95);
  cheie.castShadow = true;
  cheie.shadow.mapSize.set(1024, 1024);
  cheie.shadow.radius = 3;
  cheie.shadow.bias = -0.0012;
  const uc = cheie.shadow.camera;
  uc.left = -110; uc.right = 110; uc.top = 110; uc.bottom = -110; uc.near = 40; uc.far = 460;
  scena.add(cheie);

  const umplutura = new THREE.DirectionalLight(0xdfe8ff, 0.22);
  umplutura.position.set(140, 90, 60);
  scena.add(umplutura);
  scena.add(new THREE.HemisphereLight(0xffffff, 0x6b4a26, 0.20));

  /* ---------- lemnul ---------- */
  const texturaLemn = new THREE.CanvasTexture(panzaLemnului());
  texturaLemn.wrapS = texturaLemn.wrapT = THREE.RepeatWrapping;
  texturaLemn.anisotropy = randor.capabilities.getMaxAnisotropy();
  texturaLemn.colorSpace = THREE.SRGBColorSpace;

  const lemn = new THREE.MeshStandardMaterial({
    map: texturaLemn,
    // Lemnul lăcuit nu e nici oglindă, nici cretă: oglindește puțin și difuz.
    roughness: 0.58,
    metalness: 0,
    envMapIntensity: 0.55,
  });
  const lemnPerete = lemn.clone();
  lemnPerete.roughness = 0.5;

  const GROSIME = 11;          // grosimea peretelui
  const INALTIME = 16;         // cât de sus urcă peretele
  const INTERIOR = latura - 2 * GROSIME;

  const fund = new THREE.Mesh(
    new THREE.BoxGeometry(latura, 6, latura),
    lemn
  );
  fund.position.y = -3;
  fund.receiveShadow = true;
  scena.add(fund);

  /* Pereții: patru, ridicați pe margine. Nu-s de podoabă. Zarul se oprește la
     ei, umbra lui urcă pe ei, iar cel din față îi acoperă marginea de jos când
     ajunge acolo, exact ca într-o tăviță adevărată. */
  const peretii = new THREE.Group();
  for (const [sx, sz, latimeP, adancimeP] of [
    [0, -(latura - GROSIME) / 2, latura, GROSIME],
    [0, (latura - GROSIME) / 2, latura, GROSIME],
    [-(latura - GROSIME) / 2, 0, GROSIME, INTERIOR],
    [(latura - GROSIME) / 2, 0, GROSIME, INTERIOR],
  ]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(latimeP, INALTIME, adancimeP), lemnPerete);
    p.position.set(sx, INALTIME / 2, sz);
    p.castShadow = true;
    p.receiveShadow = true;
    peretii.add(p);
  }
  scena.add(peretii);

  /* ---------- zarul ---------- */
  const RAZA_MUCHIEI = marime * 0.16;   // cât de tocite sunt muchiile
  const geometrie = new RoundedBoxGeometry(marime, marime, marime, 5, RAZA_MUCHIEI);

  const materiale = FETELE.map((numar) => {
    const t = new THREE.CanvasTexture(panzaFetei(numar));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = randor.capabilities.getMaxAnisotropy();
    return new THREE.MeshPhysicalMaterial({
      map: t,
      /* Aceeași pânză slujește și de hartă a adânciturilor: unde e negru, e jos.
         Punctele sunt negre, deci ele se scobesc. Așa nu-s buline lipite, ci
         găuri săpate, care prind umbră sus și lumină pe peretele din fund. */
      bumpMap: t,
      bumpScale: 3.2,
      color: 0xffffff,
      /* Mai aspru decât părea: un zar de joc nu e oglindă, e plastic frecat.
         Cu rugozitate mică prindea toată camera în el și strălucea ca sticla. */
      roughness: 0.38,
      metalness: 0,
      // Lacul de deasupra: plasticul dur are un strat lucios peste culoare, iar
      // el e cel care dă sclipirea de pe muchii. Potolit, ca să fie sclipire,
      // nu bec.
      clearcoat: 0.55,
      clearcoatRoughness: 0.20,
      envMapIntensity: 0.50,
    });
  });

  const zar = new THREE.Mesh(geometrie, materiale);
  zar.castShadow = true;
  zar.receiveShadow = false;
  scena.add(zar);

  /* ---------- legătura cu fizica ----------
     Fizica ne trimite locul zarului ADUS LA UNU: `nx` și `ny` între -1 și 1,
     `nh` ca parte din latura tăviței. Nu în pixeli, dinadins. Tăvița are altă
     mărime pe telefon decât pe calculator, dar scena de aici rămâne aceeași,
     iar pânza se întinde cât trebuie. Un singur fel de a socoti, la orice ecran.

     Marginea până la care poate ajunge MIJLOCUL zarului nu e peretele minus
     jumătate de zar, ci peretele minus JUMĂTATE DE DIAGONALĂ. Un zar care se
     rostogolește trece prin poziții în care spre perete nu se uită o față, ci
     un colț, iar colțul e mai departe de mijloc decât fața: de √3/2 ori latura,
     adică 0.87, nu 0.5. Cu 0.5 ar fi intrat cu colțul în lemn de fiecare dată
     când se răsucea lângă perete.

     Fizica își ține zarul cam în două treimi din tăviță, nu până la margine, așa
     că întindem puțin drumul ca mișcarea să se vadă; și tot îl strângem la
     capăt, ca nicio socoteală de dincolo să nu-l poată împinge în perete. */
  const RAZA_DRUMULUI = INTERIOR / 2 - marime * 0.87;
  const INTINDERE = 1 / 0.64;
  const strange = (v) => Math.max(-RAZA_DRUMULUI, Math.min(RAZA_DRUMULUI, v * INTINDERE));

  const q = new THREE.Quaternion();
  const qTinta = new THREE.Quaternion();
  const euler = new THREE.Euler();
  let inAsezare = 0;                    // 0 = nu, altfel clipa de pornire

  function deseneaza() { randor.render(scena, camera); }

  function aseaza(nx, ny, nh, rx, ry) {
    zar.position.set(
      strange(nx * RAZA_DRUMULUI),
      marime / 2 + Math.max(0, nh) * latura,
      strange(ny * RAZA_DRUMULUI)
    );
    if (!inAsezare) {
      // Unghiurile fizicii sunt în grade și gândite pentru ecran; aici le
      // folosim ca rostogolire, ceea ce și sunt.
      euler.set(THREE.MathUtils.degToRad(rx), THREE.MathUtils.degToRad(ry), 0, "XYZ");
      zar.quaternion.setFromEuler(euler);
    }
    deseneaza();
  }

  /* Așezarea pe fața care a picat. Nu sărim la ea, ne ducem lin: un zar care
     se oprește sare ultima dată puțin și se lasă pe față, nu se teleportează. */
  function asazaFata(fata, ms = 420) {
    const r = SPRE_SUS[fata] || SPRE_SUS[1];
    qTinta.setFromEuler(new THREE.Euler(r.x, r.y, r.z, "XYZ"));
    q.copy(zar.quaternion);
    inAsezare = performance.now();
    const pornit = inAsezare;
    (function pas(acum) {
      if (inAsezare !== pornit) return;              // a început altă aruncare
      const t = Math.min(1, (acum - pornit) / ms);
      const lin = 1 - Math.pow(1 - t, 3);            // frânează spre sfârșit
      zar.quaternion.slerpQuaternions(q, qTinta, lin);
      zar.position.y = marime / 2 + Math.sin(Math.PI * t) * 2.5 * (1 - t);
      deseneaza();
      if (t < 1) requestAnimationFrame(pas); else inAsezare = 0;
    })(performance.now());
  }

  function ridicaPentruAmestec(inaltime) {
    inAsezare = 0;
    zar.position.y = marime / 2 + inaltime;
  }

  // O primă așezare, ca tăvița să nu apară goală până la prima aruncare.
  zar.position.set(0, marime / 2, 0);
  asazaFata(1, 1);
  deseneaza();

  return {
    panza,
    aseaza,
    asazaFata,
    ridicaPentruAmestec,
    deseneaza,
    /** Tăvița își schimbă mărimea pe telefon: pânza o urmează. */
    potriveste(nouaLatura) {
      randor.setSize(nouaLatura, nouaLatura, false);
      deseneaza();
    },
  };
}

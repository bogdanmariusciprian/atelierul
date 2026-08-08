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
  g.fillStyle = "#dcdfe8";
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

  /* DESENĂM MAI MARE DECÂT SE VEDE.

     Tăvița are 150 de pixeli pe ecran. Desenată în 150 de pixeli, o muchie
     rotundă are la dispoziție trei-patru pixeli ca să se curbeze, iar din atâta
     nu iese o curbă, iese o scară. De-aia desenăm de două ori și jumătate mai
     mare și lăsăm browserul să strângă imaginea la loc: fiecare pixel de pe
     ecran se face atunci din vreo șase desenate, iar marginile ies netede.
     La un pătrat de 150 de pixeli asta nu costă nimic. */
  const DESIME = 2.5;
  randor.setPixelRatio(Math.min((window.devicePixelRatio || 1) * DESIME, 4));

  /* MARGINEA SE IA PE DINĂUNTRU, NU PE DINAFARĂ.

     Prima oară am mărit PÂNZA, ca să încapă umbra și înclinarea. A fost o
     greșeală de așezare în pagină, nu de scenă: tăvița stă într-un colț fixat,
     cu butonul „generator" chiar deasupra ei și cu marginea ferestrei la 18
     pixeli în dreapta. O pânză mai lată decât caseta ei se suie peste buton și
     iese din fereastră. Un lucru care crește în afara casetei lui calcă
     întotdeauna pe altcineva.

     Acum pânza umple exact caseta, nici un pixel mai mult, iar marginea o las
     ÎN SCENĂ: camera cuprinde mai mult decât lemnul, așa că în jurul tăviței
     rămâne loc gol, chiar în pânză. Umbra are unde cădea, înclinarea are unde
     se lăți, iar pagina nu simte nimic. */
  const MARGINE = 1.2;
  const panzaPx = Math.round(tavita.clientWidth || latura * MARGINE);
  randor.setSize(panzaPx, panzaPx, false);
  randor.shadowMap.enabled = true;
  randor.shadowMap.type = THREE.PCFSoftShadowMap;
  randor.toneMapping = THREE.ACESFilmicToneMapping;
  /* Expunerea. Ca la un aparat de fotografiat: cu cât e mai mare, cu atât intră
     mai multă lumină și cu atât se ard alburile. Un zar alb sub lumină puternică
     își pierde desenul și rămâne o pată. */
  randor.toneMappingExposure = 0.72;
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
  /* Camera cuprinde 180 de unități, deși lemnul are 150: cele 30 rămase sunt
     marginea dinăuntru, în care încap umbra și înclinarea. Fiindcă pânza umple
     caseta, iar caseta e cu aceeași măsură mai mare, lemnul iese pe ecran exact
     cât era înainte, 150 de pixeli. Nimic nu s-a micșorat și nimic n-a ieșit
     din chenar.

     La 68 de grade tăvița se vede a tăviță, cu pereții ei, dar rămâne destul de
     dreaptă cât să nu pară masa strâmbă. */
  const CUPRINS = latura * MARGINE;                 // 180 de unități
  const DEPARTARE = CUPRINS / (2 * Math.tan(THREE.MathUtils.degToRad(13)));
  const INCLINARE = THREE.MathUtils.degToRad(68);
  const camera = new THREE.PerspectiveCamera(26, 1, DEPARTARE * 0.4, DEPARTARE * 2.2);
  camera.position.set(0, DEPARTARE * Math.sin(INCLINARE), DEPARTARE * Math.cos(INCLINARE));
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

  const cheie = new THREE.DirectionalLight(0xfff6e8, 1.15);
  cheie.position.set(-120, 210, 95);
  cheie.castShadow = true;
  cheie.shadow.mapSize.set(2048, 2048);   // pe măsura desenului mai des
  cheie.shadow.radius = 3;
  cheie.shadow.bias = -0.0012;
  const uc = cheie.shadow.camera;
  uc.left = -170; uc.right = 170; uc.top = 170; uc.bottom = -170; uc.near = 40; uc.far = 620;
  scena.add(cheie);

  const umplutura = new THREE.DirectionalLight(0xdfe8ff, 0.16);
  umplutura.position.set(140, 90, 60);
  scena.add(umplutura);
  scena.add(new THREE.HemisphereLight(0xffffff, 0x6b4a26, 0.16));

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
    envMapIntensity: 0.35,
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
  fund.castShadow = true;
  scena.add(fund);

  /* MASA DE DEDESUBT, care nu se vede.
     Fără ea, tăvița ar pluti: n-ar avea pe ce să-și lase umbra, iar un lucru
     fără umbră nu stă nicăieri. E o suprafață care primește doar umbre și
     altceva nimic, așa că în jurul tăviței rămâne pagina, cu umbra peste ea. */
  const masa = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.ShadowMaterial({ opacity: 0.26 })
  );
  masa.rotation.x = -Math.PI / 2;
  masa.position.y = -6.05;
  masa.receiveShadow = true;
  scena.add(masa);

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
      clearcoat: 0.40,
      clearcoatRoughness: 0.20,
      envMapIntensity: 0.28,
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

     `nx` și `ny` vin ca „cât de departe de mijloc, din tot ce se poate": -1 e
     peretele din stânga, 1 cel din dreapta. Cine ne cheamă socotește asta din
     `razaInCaseta`, pe care i-o dăm mai jos: așa nu mai există două numere
     magice care trebuie să se potrivească între două fișiere. Strângerea de la
     capăt rămâne totuși, ca nicio greșeală de dincolo să nu împingă zarul în
     lemn. */
  const RAZA_DRUMULUI = INTERIOR / 2 - marime * 0.87;
  const strange = (v) => Math.max(-RAZA_DRUMULUI, Math.min(RAZA_DRUMULUI, v));

  const q = new THREE.Quaternion();
  const qTinta = new THREE.Quaternion();
  const qRoata = new THREE.Quaternion();
  const axa = new THREE.Vector3(0, 0, -1);
  const euler = new THREE.Euler();
  let inAsezare = 0;                    // 0 = nu, altfel clipa de pornire

  function deseneaza() { randor.render(scena, camera); }

  /** Rotația la care fața cerută stă sus. */
  function catreFata(fata) {
    const r = SPRE_SUS[fata] || SPRE_SUS[1];
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(r.x, r.y, r.z, "XYZ"));
  }

  /**
   * Axa în jurul căreia se rostogolește un zar care merge într-o direcție.
   *
   * Un zar care se duce spre dreapta se dă peste cap în jurul unei axe culcate,
   * PERPENDICULARĂ pe mersul lui. Nu e o alegere de frumusețe: dacă axa n-ar fi
   * perpendiculară, zarul ar aluneca răsucindu-se, nu s-ar rostogoli, iar ochiul
   * prinde deosebirea imediat.
   */
  function axaRostogolirii(dx, dz) {
    const lung = Math.hypot(dx, dz);
    if (lung < 1e-6) return axa.set(0, 0, -1);
    // sus × mers, adică (0,1,0) × (dx,0,dz)
    return axa.set(dz / lung, 0, -dx / lung);
  }

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

  /* ROSTOGOLIREA PLANIFICATĂ.
     `ramas` e cât drum mai are zarul de făcut. Rotirea se scoate din el, nu din
     ceas: un zar care mai are de mers se mai dă peste cap, iar când n-a mai
     rămas nimic de mers, s-a oprit. Unghiul se stinge singur la zero exact
     odată cu drumul, deci fața cerută iese sus fără nicio corectură.

     `unghiul = ramas / raza` e chiar rostogolirea adevărată: un cerc de rază r
     care se duce cu r înainte s-a rotit cu un radian. Turele în plus se sting
     și ele odată cu drumul, ca la început să pară aruncat cu putere. */
  function aseazaRostogolit(nx, ny, nh, fata, ramas, tot) {
    inAsezare = 0;
    zar.position.set(
      strange(nx * RAZA_DRUMULUI),
      marime / 2 + Math.max(0, nh) * latura,
      strange(ny * RAZA_DRUMULUI)
    );
    const parte = tot > 0 ? ramas / tot : 0;
    const unghi = ramas / (marime / 2) + parte * Math.PI * 4;
    qRoata.setFromAxisAngle(axa, unghi);
    zar.quaternion.copy(qRoata).multiply(catreFata(fata));
    deseneaza();
  }

  /** Plimbatul cu degetul: se rostogolește cât îl duci, în jurul mersului. */
  function plimba(nx, ny, nh, dx, dz) {
    inAsezare = 0;
    zar.position.set(
      strange(nx * RAZA_DRUMULUI),
      marime / 2 + Math.max(0, nh) * latura,
      strange(ny * RAZA_DRUMULUI)
    );
    const lung = Math.hypot(dx, dz);
    if (lung > 1e-4) {
      qRoata.setFromAxisAngle(axaRostogolirii(dx, dz), lung / (marime / 2));
      zar.quaternion.premultiply(qRoata);
    }
    deseneaza();
  }

  /* Așezarea pe fața care a picat. Nu sărim la ea, ne ducem lin: un zar care
     se oprește sare ultima dată puțin și se lasă pe față, nu se teleportează.
     A rămas pentru drumurile care NU sunt planificate (zarul din CSS, ori
     aruncarea celui care a cerut mai puțină mișcare). */
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
    /** Se pregătește pentru o aruncare: axa se ia din direcția de plecare. */
    pregateste(vx, vy) { axaRostogolirii(vx, vy); },
    aseazaRostogolit,
    plimba,
    /* Cât ține jumătate de zar din caseta întreagă. Caseta e mai mare decât
       lemnul, cu marginea dinăuntru, iar cine socotește drumul zarului trebuie
       să afle asta de la noi, nu s-o ghicească. */
    razaInCaseta: marime / 2 / (latura * MARGINE),
    aseaza,
    asazaFata,
    ridicaPentruAmestec,
    deseneaza,
    /** Tăvița își schimbă mărimea pe telefon: pânza o urmează. */
    /* Caseta se schimbă pe telefon; pânza o urmează întocmai, fără să crească
       peste ea. Scena rămâne aceeași: se schimbă doar câți pixeli o desenează. */
    potriveste(pxCaseta) {
      const p = Math.round(pxCaseta || panzaPx);
      randor.setSize(p, p, false);
      deseneaza();
    },
  };
}

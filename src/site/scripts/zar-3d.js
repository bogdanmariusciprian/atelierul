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

  /* ---------- TĂVIȚA SE ÎNCLINĂ DUPĂ DEGET ----------

     Întâi am mișcat camera, adică am făcut ca și cum te-ai apleca tu deasupra
     mesei. Era o alegere curată, dar nu se vedea: pe un pătrat de 150 de pixeli,
     nouă grade de cameră înseamnă doi-trei pixeli. Se mișcă acum chiar tăvița,
     ca și cum ai ține-o în palme și ai lăsa-o puțin într-o parte.

     ÎNCLINAREA TRECE ACUM PESTE UNGHIUL DE FRECARE, ȘI E BINE CĂ TRECE.
     Ținusem 10 grade tocmai ca să rămân sub `arctg(μs) = 16,7°`, adică sub
     unghiul de la care un corp pornește la vale. Era o alegere fricoasă: ca să
     nu mint, nu spuneam nimic. Acum înclin 18 grade și las zarul SĂ LUNECE de-a
     binelea, ceea ce e și mai adevărat, și mult mai de văzut.

     Pragul se simte cu degetul, fiindcă e adevărat: aproape de mijloc zarul
     încă se ține, iar mai încolo se urnește și se duce în colț. Iar fiindcă
     frecarea de mers e mai mică decât cea de agățare, odată pornit nu se mai
     oprește decât mai jos decât unghiul la care a plecat. Nimic din toate astea
     nu e scris nicăieri: iese din `inclina` + `pas`.

     28 DE GRADE, ȘI CÂT MAI ÎNCAPE. Plafonul de sus nu-l dă gustul, ci chenarul:
     colțul cel mai depărtat al tăviței, ridicat și umflat de apropierea de
     cameră, ajunge la 84 de unități din 90 cu tăvița dreaptă, la 99 la
     optsprezece grade și la 103 la douăzeci și opt. Trecerea peste 90 se
     petrece deci demult, și n-a supărat pe nimeni: colțul e o muchie rotunjită
     de lemn, iar cele câteva unități se pierd. Peste vreo patruzeci de grade
     însă tăvița nu mai pare legănată, ci răsturnată.

     Lumina NU se înclină odată cu tăvița, fiindcă lumina e a odăii, nu a mesei.
     De-aia, cât o legeni, lucirea se plimbă pe lemn și pe zar. Ăsta e semnul
     că lucrul are volum, și tocmai el lipsea. */
  const INCLINARE_MAX = THREE.MathUtils.degToRad(28);
  const TRAGERE = 14;       // cât se urnește tăvița din loc, trasă de bandă
  const tinta = { x: 0, z: 0 };
  const acum = { x: 0, z: 0 };
  let aluneca = false;

  /* Tot ce ține de masă intră într-un singur grup, ca înclinarea să fie una
     singură, nu patru potrivite între ele. Zarul intră și el: o tăviță care se
     lasă într-o parte fără zarul din ea ar fi o nălucă. */
  const masa = new THREE.Group();
  scena.add(masa);

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

  /* CÂT DE DEPARTE VEDE LUMINA.

     O lumină îndreptată nu-și face umbra peste toată lumea, ci numai într-o
     cutie. Cutia asta e de ±170 în jurul tăviței și e întoarsă după lumină, nu
     după lume, fiindcă e privită DIN lumină. De-aia, când zarul iese din ea,
     umbra lui nu se stinge lin, ci se taie pe muchia unui pătrat strâmb care nu
     se vede nicăieri în scenă. E chiar „panelul invizibil, pătrățos dar rotit
     cumva". Nu era un panou: era hotarul de unde lumina nu mai știe să facă
     umbră.

     Rețin aici cum arată acasă, ca s-o pot lărgi cât ține zarul afară din
     tăviță și s-o aduc înapoi întocmai pe urmă. Direcția o rețin ca direcție,
     nu ca punct: mutând lumina mai departe pe aceeași rază, LUMINA rămâne
     aceeași (una îndreptată n-are loc, are doar direcție), dar cutia umbrei
     apucă să cuprindă tot ecranul. */
  /* CUTIA UMBREI RĂMÂNE CEA DE ACASĂ, ±170, și n-are nevoie să crească: în
     amândouă trecerile de desen totul se petrece lângă mijloc. Tăvița e la
     mijloc prin firea ei, iar zarul din mână e mutat CHIAR pe axă și desenat
     într-un pătrat purtat după deget. Așa umbra rămâne deasă și nu mai are pe
     ce hotar să se taie. */

  /* PAGINA CA MASĂ.
     Cât zarul e afară din tăviță, umbra lui trebuie să cadă pe ceva, altfel
     zarul plutește peste pagină ca un desen lipit. Suprafața asta e a PAGINII,
     nu a tăviței: stă dreaptă și nu se înclină cu ea. Se aprinde numai atunci,
     iar `masaUmbrei` se stinge, ca umbrele să nu se adune de două ori. */
  const pagina = new THREE.Mesh(
    new THREE.PlaneGeometry(8000, 8000),
    new THREE.ShadowMaterial({ opacity: 0.22 })
  );
  pagina.rotation.x = -Math.PI / 2;
  pagina.position.y = -6.05;
  pagina.receiveShadow = true;
  pagina.visible = false;
  scena.add(pagina);

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
  masa.add(fund);

  /* MASA DE DEDESUBT, care nu se vede.
     Fără ea, tăvița ar pluti: n-ar avea pe ce să-și lase umbra, iar un lucru
     fără umbră nu stă nicăieri. E o suprafață care primește doar umbre și
     altceva nimic, așa că în jurul tăviței rămâne pagina, cu umbra peste ea. */
  const masaUmbrei = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.ShadowMaterial({ opacity: 0.26 })
  );
  masaUmbrei.rotation.x = -Math.PI / 2;
  masaUmbrei.position.y = -6.05;
  masaUmbrei.receiveShadow = true;
  /* MASA CARE PRINDE UMBRA MERGE CU TĂVIȚA, ȘI IATĂ DE CE.
     Curat ar fi s-o las pe loc: legeni tăvița, masa de sub ea stă. Am ținut-o
     așa cât înclinarea era de 10 grade. La 18 însă, colțul de jos al tăviței
     coboară cu 75·sin18 = 23 de unități, adică se afundă în masă; ca să nu se
     afunde, ar trebui ridicat tot grupul cu tot atât, iar 23 de unități ridicate
     într-un chenar de 180 scot tăvița din desen. Din două minciuni am ales-o pe
     cea mică: pânza pe care cade umbra se lasă odată cu tăvița, ceea ce se vede
     doar pe franjurul de 15 unități rămas pe dinafară, și acela pe jumătate
     topit. Cealaltă s-ar fi văzut din prima clipă. */
  masa.add(masaUmbrei);

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
  masa.add(peretii);

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
  masa.add(zar);

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

  /* ---------- ZARUL DIN MÂNĂ SE DESENEAZĂ APARTE, ȘI IATĂ DE CE ----------

     Ca pânza să acopere fereastra, trunchiul de piramidă al camerei se lățește
     de zece ori: din 26 de grade ajunge la vreo 130. Atât înseamnă un fișeu, iar
     un fișeu întinde tot ce nu e la mijloc. De-aia zarul dus în colțul paginii
     se lungea ca o placă: nu se strica zarul, se strica privirea.

     Nu se poate face un singur desen și pentru tăviță, și pentru zarul din
     mână: tăvița vrea camera ei, așezată pe ea, iar zarul vrea să fie privit
     drept, oriunde ar fi. Sunt două priviri deosebite, deci sunt două treceri:

       1. TĂVIȚA, cu camera de acasă, decupată ca să cadă pe aceiași pixeli.
       2. ZARUL, așezat CHIAR PE AXA privirii, adică deasupra mijlocului
          tăviței, unde nimic nu se strâmbă, și desenat într-un pătrat mutat
          acolo unde e degetul. Nu e o păcăleală: e chiar zarul, chiar la
          mărimea lui, doar că privit cum se cade.

     Trecerea a doua se așază PESTE cea dintâi, fără s-o șteargă, ca cele două
     să se poată suprapune când degetul se apropie de tăviță. */
  let zarLaDeget = null;         // {cx, cy} cât e ținut afară; altfel null
  let decupaj = null;            // ce i-am cerut camerei, ca să pot pune la loc

  const inPixeliDePanza = () => {
    const r = randor.getPixelRatio();
    return { W: randor.domElement.width / r, H: randor.domElement.height / r };
  };

  const locLumii = new THREE.Vector3();

  /* S-A ÎNTORS ÎN TĂVIȚĂ: pătratul din mână se stinge.
     Aici era buba de după prima ricoșare. Praștia îl desena pe zar în pătratul
     ei, apoi îl preda fizicii, dar nu spunea nimănui că zarul nu mai e în mână.
     Pătratul rămânea agățat unde fusese degetul, iar zarul, care se rostogolea
     acum în tăviță, era desenat tot acolo: din el nu se mai vedea decât fâșia
     care nimerea din întâmplare înăuntru. De-aia se pune aici, în TOATE
     așezările din tăviță, nu într-una anume: cine îl pune pe zar la locul lui
     spune prin chiar asta că nu-l mai ține nimeni de el. */
  function inTavita() { zarLaDeget = null; }

  function deseneaza() {
    const { W, H } = inPixeliDePanza();

    /* PÂNZA ÎNTREAGĂ, DE FIECARE DATĂ. `setViewport` rămâne pus până îl schimbi
       tu, iar `setSize` e singurul care-l pune singur la loc. Fără rândul ăsta,
       primul desen de după o trecere în două ar fi înghesuit în pătratul în care
       fusese desenat zarul, adică toată scena trunchiată într-un chenar mic. */
    if (!zarLaDeget) {
      randor.setScissorTest(false);
      randor.setViewport(0, 0, W, H);
      randor.render(scena, camera);
      return;
    }
    randor.autoClear = false;
    randor.setScissorTest(false);
    randor.clear();

    // 1) tăvița, fără zarul care nu mai e în ea
    randor.setScissorTest(true);
    zar.visible = false;
    randor.setViewport(0, 0, W, H);
    randor.setScissor(0, 0, W, H);
    randor.render(scena, camera);

    // 2) zarul, pe axă, în pătratul lui, peste ce s-a desenat deja
    zar.visible = true;
    fund.visible = false; peretii.visible = false; masaUmbrei.visible = false;
    pagina.visible = true;                  // ca umbra lui să cadă pe pagină
    /* PĂTRATUL E MAI LARG DECÂT CASETA, DAR LA ACEEAȘI SCARĂ.
       Zarul ridicat sus și umbra lui căzută jos-dreapta nu mai încap într-un
       pătrat cât caseta: unul dintre ele iese afară și se taie. Un pătrat mai
       mare l-ar mări însă și pe zar, fiindcă trunchiul camerei se întinde pe
       tot ce i se dă. De-aia îi cer camerei, prin `setViewOffset`, un chenar
       de aceeași mărime ca înainte, desenat pe o bucată mai lată: fiecare
       unitate de lume rămâne tot atâția pixeli, doar că în jur e mai mult loc
       gol. Zarul stă la mijloc, unde nimic nu se strâmbă. */
    const L = tavita.clientWidth || panzaPx;
    const L2 = Math.round(L * 2.2);
    camera.setViewOffset(L, L, -(L2 - L) / 2, -(L2 - L) / 2, L2, L2);

    /* UNDE SE AȘAZĂ PĂTRATUL. Nu-l pun cu mijlocul pe deget, fiindcă zarul nu e
       la mijlocul lui: fiind ridicat deasupra tăviței, se desenează mai sus, cu
       atât cât e de înalt. Îl întreb deci pe el unde cade în pătrat, și mut
       pătratul cât trebuie ca ZARUL să ajungă fix pe deget. */
    zar.updateWorldMatrix(true, false);
    locLumii.setFromMatrixPosition(zar.matrixWorld).project(camera);
    const stanga = zarLaDeget.cx - (locLumii.x * 0.5 + 0.5) * L2;
    const sus = zarLaDeget.cy - (1 - (locLumii.y * 0.5 + 0.5)) * L2;

    randor.clearDepth();                    // zarul nu se ascunde după tăviță
    randor.setViewport(stanga, H - sus - L2, L2, L2);
    randor.setScissor(stanga, H - sus - L2, L2, L2);
    randor.render(scena, camera);

    fund.visible = true; peretii.visible = true; masaUmbrei.visible = true;
    pagina.visible = false;
    if (decupaj) camera.setViewOffset(...decupaj); else camera.clearViewOffset();
    randor.setScissorTest(false);
    randor.autoClear = true;
  }

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
    inTavita();
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
  /* AȘEZAREA DUPĂ FIZICĂ, FĂRĂ NICIO PRELUCRARE.
     Fizica lucrează chiar în unitățile scenei: tăvița are `interior`, zarul are
     `marime`. Deci nu mai e nimic de socotit între ele, doar de copiat. Asta e
     și dovada că modelul și desenul vorbesc aceeași limbă. */
  function aseazaBrut(r, q) {
    inAsezare = 0;
    inTavita();
    zar.position.set(r.x, Math.max(marime * 0.4, r.y), r.z);
    zar.quaternion.set(q.x, q.y, q.z, q.w);
    deseneaza();
  }

  function aseazaRostogolit(nx, ny, nh, fata, ramas, tot) {
    inAsezare = 0;
    inTavita();
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

  /**
   * Plimbatul cu degetul: se rostogolește cât îl duci, în jurul mersului.
   *
   * `peste` îi ridică zăgazul: cât ține degetul zarul AFARĂ din tăviță, nu mai
   * are rost să-l ținem între pereți, fiindcă tocmai asta se vede, că a ieșit.
   */
  function plimba(nx, ny, nh, dx, dz, peste = false) {
    inAsezare = 0;
    inTavita();
    const tine = peste ? ((v) => v) : strange;
    zar.position.set(
      tine(nx * RAZA_DRUMULUI),
      marime / 2 + Math.max(0, nh) * latura,
      tine(ny * RAZA_DRUMULUI)
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
    inTavita();
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
    inTavita();
    zar.position.y = marime / 2 + inaltime;
  }

  // O primă așezare, ca tăvița să nu apară goală până la prima aruncare.
  zar.position.set(0, marime / 2, 0);
  asazaFata(1, 1);
  deseneaza();

  /* Privirea nu sare la deget, ci alunecă spre el. O cameră care se mută
     dintr-odată la fiecare zvâcnire de maus dă amețeală; una care se duce lin
     se simte ca o greutate adevărată. Alunecarea se oprește singură când a
     ajuns, ca să nu desenăm de pomană. */
  function inclinaMasa() {
    /* Tăvița se lasă SUB deget, nu se ferește de el: degetul la dreapta coboară
       latura dreaptă, degetul în jos coboară latura dinspre tine. Așa se simte
       ca o apăsare, nu ca o fugă. */
    masa.rotation.z = -acum.x * INCLINARE_MAX;
    masa.rotation.x = acum.z * INCLINARE_MAX;
    /* Și e TRASĂ puțin într-acolo, nu doar aplecată. Când banda trage de zar
       spre tăviță, trage și de tăviță spre zar: tăvița e ușoară și se lasă
       urnită. Nouă unități din o sută optzeci: cât să se vadă că cedează, nu
       cât să pară că se plimbă. */
    masa.position.x = acum.x * TRAGERE;
    masa.position.z = acum.z * TRAGERE;
  }

  function porneșteAlunecarea() {
    if (aluneca) return;
    aluneca = true;
    (function pas() {
      const dx = tinta.x - acum.x, dz = tinta.z - acum.z;
      acum.x += dx * 0.14;
      acum.z += dz * 0.14;
      inclinaMasa();
      deseneaza();
      if (Math.abs(dx) > 0.002 || Math.abs(dz) > 0.002) requestAnimationFrame(pas);
      else { acum.x = tinta.x; acum.z = tinta.z; inclinaMasa(); deseneaza(); aluneca = false; }
    })();
  }

  const strangeUnu = (v) => Math.max(-1, Math.min(1, v));

  /* ---------- ZARUL RIDICAT NU MAI E PE MASĂ ----------

     Îl plimbam pe zar în planul TĂVIȚEI, adică pe masă. Numai că masa e privită
     dintr-o parte, de la 68 de grade, așa că orice drum pe ea se duce spre
     fundal: zarul se micșora, se apropia de linia orizontului și, pe la
     jumătatea paginii, nu mai avea unde să meargă. Nu era o mărginire pusă de
     mine, era perspectiva, care face din orice masă un lucru ce se sfârșește în
     zare.

     Dar un lucru pe care-l APUCI nu mai e pe masă, e în mână, deasupra ei. Așa
     că zarul ținut de deget nu se mai mută nicăieri în lume: rămâne acolo unde
     nimic nu se strâmbă, pe axa privirii, deasupra mijlocului tăviței. Ce se
     mută e PĂTRATUL în care e desenat (vezi `deseneaza`). De-aia își ține și
     mărimea, și forma, oriunde pe pagină. */
  const acolo = new THREE.Vector3();

  const inaltimeaDinMana = (nh) => marime / 2 + Math.max(0, nh) * latura;

  function laDeget(clientX, clientY, nh, dx = 0, dz = 0) {
    /* Zarul stă pe axa privirii, deasupra mijlocului tăviței, unde nimic nu se
       strâmbă. Unde se VEDE e treaba pătratului în care-l desenăm, nu a locului
       lui din lume. Așa își ține mărimea și forma oriunde pe pagină, fiindcă
       priveala e mereu aceeași: drept. */
    acolo.set(0, inaltimeaDinMana(nh), 0);
    masa.worldToLocal(acolo);
    zarLaDeget = { cx: clientX, cy: clientY };
    puneLa(acolo, dx, dz, true);
    return { x: acolo.x, y: acolo.y, z: acolo.z };
  }

  /** Îl pune la un loc anume din tăviță și îl rostogolește cât a mers. */
  function puneLa(p, dx = 0, dz = 0, dinMana = false) {
    inAsezare = 0;
    if (!dinMana) zarLaDeget = null;        // s-a întors în tăviță, se vede acolo
    zar.position.set(p.x, p.y, p.z);
    const lung = Math.hypot(dx, dz);
    if (lung > 1e-4) {
      qRoata.setFromAxisAngle(axaRostogolirii(dx, dz), lung / (marime / 2));
      zar.quaternion.premultiply(qRoata);
    }
    deseneaza();
  }

  /* ---------- PÂNZA CÂT FEREASTRA, FĂRĂ CA TĂVIȚA SĂ TRESARĂ ----------

     Ca zarul să se vadă tras AFARĂ din tăviță, pânza trebuie să fie mai mare
     decât caseta. Numai că tot ce s-a desenat până acum e potrivit pe o pânză
     cât caseta, iar dacă schimb camera, tăvița sare în clipa trecerii.

     `setViewOffset` e făcut fix pentru asta: îi spui camerei „chenarul tău
     întreg are atâta, iar tu desenează BUCATA asta din el". Îi dau ca chenar
     întreg caseta, și-i cer să deseneze o bucată cât toată fereastra, care
     începe cu colțul casetei mutat la locul lui. Trunchiul de piramidă se
     lățește în jurul aceluiași mijloc, deci fiecare punct al tăviței cade exact
     pe pixelul pe care cădea și înainte. Nu e o potrivire din ochi: e aceeași
     proiecție, doar tăiată mai larg.

     Desimea scade cât e larg, și trebuie să scadă: 2,5 ori pe o pânză cât
     ecranul ar însemna douăzeci de milioane de pixeli de desenat la fiecare
     cadru, adică o smucitură exact când degetul cere lin. */
  /**
   * Pânza se face mai mare decât caseta ei.
   *
   * `cat` spune de câte ori cât caseta. Zero înseamnă „cât toată fereastra",
   * și e pentru zarul purtat cu degetul, care poate ajunge oriunde. Un număr
   * mic, ca 2,4, e pentru ROSTOGOLIRE: acolo zarul nu pleacă nicăieri, doar
   * sare peste marginea casetei, și-i ajunge un pic de loc în jur. Deosebirea
   * nu e de lene, e de desime: o pânză cât fereastra la desimea deplină ar
   * însemna zece milioane de puncte la fiecare cadru, așa că acolo desimea
   * scade; într-un pătrat de două ori și ceva cât caseta, ea rămâne întreagă,
   * iar zarul care se rostogolește se vede tot atât de limpede ca înainte.
   *
   * Oricare ar fi mărimea, tăvița cade pe aceiași pixeli: de asta are grijă
   * `setViewOffset`, căruia îi spun ce chenar are caseta și pe ce bucată să-l
   * deseneze. */
  let elarg = 0;                 // 0 = strâmtă; altfel, de câte ori cât caseta
  function larg(cat = 0) {
    if (elarg === (cat || -1)) return;
    elarg = cat || -1;
    const c = tavita.getBoundingClientRect();
    let X, Y, W, H, desime;
    if (cat > 0) {
      W = H = Math.round(c.width * cat);
      X = Math.round(c.left + c.width / 2 - W / 2);
      Y = Math.round(c.top + c.height / 2 - H / 2);
      desime = Math.min((window.devicePixelRatio || 1) * DESIME, 4);
    } else {
      X = 0; Y = 0;
      W = Math.round(window.innerWidth); H = Math.round(window.innerHeight);
      desime = Math.min(window.devicePixelRatio || 1, 1.5);
    }
    decupaj = [c.width, c.width, X - c.left, Y - c.top, W, H];
    camera.setViewOffset(...decupaj);
    randor.setPixelRatio(desime);
    randor.setSize(W, H, false);
    panza.classList.add("e-larg");
    panza.style.left = X + "px";
    panza.style.top = Y + "px";
    panza.style.width = W + "px";
    panza.style.height = H + "px";
    document.body.appendChild(panza);          // scos de sub orice `transform`

    deseneaza();
  }
  function stramt() {
    if (!elarg) return;
    elarg = 0;
    panza.style.left = panza.style.top = panza.style.width = panza.style.height = "";
    camera.clearViewOffset();
    decupaj = null;
    zarLaDeget = null;
    randor.setPixelRatio(Math.min((window.devicePixelRatio || 1) * DESIME, 4));
    const p = Math.round(tavita.clientWidth || panzaPx);
    randor.setSize(p, p, false);
    panza.classList.remove("e-larg");
    tavita.insertBefore(panza, tavita.firstChild);

    deseneaza();
  }

  return {
    panza,
    larg,
    stramt,
    /** Cât s-a lăsat tăvița chiar acum, în radiani. Fizica are nevoie de asta. */
    inclinarea: () => ({ x: masa.rotation.x, z: masa.rotation.z }),
    /** Unde stă zarul chiar acum. De aici se face starea de repaus a fizicii. */
    locul: () => ({
      r: { x: zar.position.x, y: zar.position.y, z: zar.position.z },
      q: { x: zar.quaternion.x, y: zar.quaternion.y, z: zar.quaternion.z, w: zar.quaternion.w },
    }),
    laDeget,
    puneLa,
    /** La ce înălțime stă zarul ținut în mână, în unități de scenă. */
    inaltimeaDinMana,
    /** Cât de departe de mijloc poate ajunge zarul plimbat, în unități de scenă. */
    razaDrumului: RAZA_DRUMULUI,
    /** Cât cuprinde camera, în unități de scenă. Cu ea se trec pixelii în scenă. */
    latimeaScenei: latura * MARGINE,
    /** Cât ține lemnul, în unități de scenă. Înălțimile din mână se măsoară în el. */
    latimeaLemnului: latura,
    /**
     * Întoarce privirea spre deget. `nx` și `ny` sunt între -1 și 1, măsurate
     * din mijlocul tăviței. Cheamă-l cu (0, 0) când degetul pleacă.
     */
    priveste(nx, ny) {
      tinta.x = strangeUnu(nx);
      tinta.z = strangeUnu(ny);
      porneșteAlunecarea();
    },
    /** Cât loc are zarul între pereți, în unitățile scenei. Fizica lucrează în ele. */
    interior: INTERIOR,
    marimeaZarului: marime,
    aseazaBrut,
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
      /* Cât e pânza lată cât fereastra, mărimea ei n-o mai dă caseta, ci
         fereastra, iar decupajul camerei trebuie luat de la capăt: caseta s-a
         mutat. O potrivire făcută atunci după casetă ar strânge pânza înapoi
         chiar cu zarul afară din ea. */
      if (elarg) { const cat = elarg; elarg = 0; larg(cat > 0 ? cat : 0); return; }
      const p = Math.round(pxCaseta || panzaPx);
      randor.setSize(p, p, false);
      deseneaza();
    },
  };
}

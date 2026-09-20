// =========================================================
// PAGINA UNUI PDF ARĂTAT LA CLASĂ.
//
// Aici se face, din niște poze de pagini, o fișă adevărată: o pagină HTML de
// sine stătătoare, cu slide-uri, săgeți, și cu înțelegerea `window.fisaLiceu`
// pe care o are orice fișă scrisă de Marius. De-aia telecomanda, ecoul
// apăsărilor și butonul de ecran plin merg pe ea din prima, fără nimic în plus.
//
// DE CE POZE, ȘI NU PDF-UL PUS ÎNTR-UN CADRU. Un PDF deschis în cadru cade pe
// vizualizatorul browserului, care nu se lasă nici derulat din afară, nici
// întrebat unde a ajuns. Adică exact cele două lucruri de care are nevoie
// telecomanda. Desenat de noi, PDF-ul devine o pagină ca oricare alta.
//
// DE CE SE DESENEAZĂ O DATĂ, MARE, ȘI SE MUTĂ DUPĂ ACEEA. Fiecare pagină se
// desenează o singură dată, la o lățime mare, iar fâșiile se fac mutând poza în
// sus și în jos într-o fereastră 16:9. Dacă aș fi tăiat fiecare fâșie în poza ei,
// ar fi ieșit de trei ori mai multe poze, fiecare cât un ecran, și pagina s-ar fi
// îngreunat degeaba.
// Cuprins în română, nume în engleză.
// =========================================================
import { fasiile } from "./pdf-fasii.js";

/** Ferește textul pus în pagină de ghilimele și paranteze ascuțite. */
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

/**
 * Face pagina.
 *
 * @param {object} cfg
 * @param {string[]} cfg.pagini     pozele paginilor, ca adrese (data: ori blob:)
 * @param {{latime:number,inaltime:number}[]} cfg.masuri  măsurile lor
 * @param {string} cfg.titlu
 * @param {string} cfg.descarca     adresa de unde se ia documentul propriu-zis
 * @param {string} cfg.numeFisier   cum să se cheme la descărcare
 * @returns {string} HTML-ul întreg
 */
export function paginaDePdf({ pagini, masuri, titlu, descarca, numeFisier }) {
  const benzi = fasiile(masuri);
  const slides = benzi.map((b) => ({
    p: b.pagina,
    /* În procente, ca pagina să nu poarte nicio măsură în pixeli: așa se așază
       la fel pe tabla din clasă și pe telefon. */
    sus: +(b.sus * 100).toFixed(4),
    inalt: +(b.inalt * 100).toFixed(4),
  }));

  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titlu)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: #f4f3ee; }
  body { font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #2c2c2a; }

  .cadru { height: 100%; display: grid; grid-template-rows: auto 1fr; }

  .bara {
    display: flex; align-items: center; gap: .5rem;
    padding: .4rem .6rem; background: #fff; border-bottom: 1px solid #dcd9d0;
  }
  .titlu { flex: 1; min-width: 0; font-size: .85rem; font-weight: 600;
           overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .unde { font-size: .78rem; color: #6b6a64; font-variant-numeric: tabular-nums; }

  button, .btn {
    min-height: 40px; min-width: 40px;
    display: inline-flex; align-items: center; justify-content: center; gap: .35rem;
    font: inherit; font-size: .82rem; padding: 0 .6rem;
    border: 1px solid #dcd9d0; border-radius: 9px;
    background: #fff; color: #44443f; cursor: pointer; text-decoration: none;
  }
  button:hover, .btn:hover { border-color: #1d9e75; color: #0f6e56; }
  button:disabled { opacity: .35; cursor: default; }
  button:disabled:hover { border-color: #dcd9d0; color: #44443f; }

  /* FEREASTRA 16:9. Poza paginii stă înăuntru, mai înaltă decât ea, și se mută
     în sus la fiecare fâșie. Fereastra își ia lățimea de la ecran, iar
     înălțimea din raport, ca să nu fie niciodată nici mai lată, nici mai înaltă
     decât încape. */
  .scena { display: grid; place-items: center; min-height: 0; padding: .5rem; }
  .geam {
    position: relative; overflow: hidden;
    background: #fff; border: 1px solid #dcd9d0; border-radius: 10px;
    width: min(100%, calc((100cqh - 1rem) * 16 / 9));
  }
  .geam::before { content: ""; display: block; padding-top: 56.25%; }
  .geam img {
    position: absolute; left: 0; width: 100%;
    display: block; image-rendering: auto;
  }

  /* Pagina întreagă: fereastra se face cât pagina, iar poza intră toată. */
  .cadru.intreg .geam { width: auto; height: min(100%, 100cqh); max-width: 100%; }
  .cadru.intreg .geam::before { display: none; }
  .cadru.intreg .geam img { position: static; width: auto; height: 100%; max-width: 100%; }

  .scena { container-type: size; }
</style>
</head>
<body>
<div class="cadru" id="cadru">
  <div class="bara">
    <span class="titlu">${esc(titlu)}</span>
    <button type="button" data-prev aria-label="Fâșia dinainte">‹</button>
    <span class="unde" data-unde></span>
    <button type="button" data-next aria-label="Fâșia următoare">›</button>
    <button type="button" data-intreg>Pagina întreagă</button>
    <a class="btn" href="${esc(descarca)}" download="${esc(numeFisier)}"
       title="Descarcă documentul, în picioare, așa cum e">Descarcă</a>
  </div>
  <div class="scena"><div class="geam"><img alt="${esc(titlu)}" data-poza></div></div>
</div>

<script>
const POZE = ${JSON.stringify(pagini)};
const slides = ${JSON.stringify(slides)};
let current = 0;
let intreg = false;

const cadru = document.getElementById("cadru");
const poza = document.querySelector("[data-poza]");
const unde = document.querySelector("[data-unde]");
const inapoi = document.querySelector("[data-prev]");
const inainte = document.querySelector("[data-next]");

function goTo(n) {
  current = Math.max(0, Math.min(slides.length - 1, Number(n) || 0));
  const s = slides[current];
  poza.src = POZE[s.p];
  if (intreg) {
    poza.style.height = "";
    poza.style.top = "";
  } else {
    /* Poza se umflă cât să-i intre fix fâșia în fereastră, apoi se trage în sus
       cu cât începe fâșia. Amândouă în procente din fereastră, deci fără pixeli
       de socotit la fiecare redimensionare. */
    poza.style.height = (100 / s.inalt * 100) + "%";
    poza.style.top = (-s.sus / s.inalt * 100) + "%";
  }
  unde.textContent = (current + 1) + " / " + slides.length;
  inapoi.disabled = current === 0;
  inainte.disabled = current === slides.length - 1;
}

inapoi.addEventListener("click", () => goTo(current - 1));
inainte.addEventListener("click", () => goTo(current + 1));
document.querySelector("[data-intreg]").addEventListener("click", (e) => {
  intreg = !intreg;
  cadru.classList.toggle("intreg", intreg);
  e.currentTarget.textContent = intreg ? "Pe fâșii" : "Pagina întreagă";
  goTo(current);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { goTo(current + 1); e.preventDefault(); }
  if (e.key === "ArrowLeft" || e.key === "PageUp") { goTo(current - 1); e.preventDefault(); }
});

goTo(0);

/* ÎNȚELEGEREA CU MODULUL LICEU, versiunea 1 – aceeași pe care o au fișele
   scrise de mână. Prin ea, PDF-ul se derulează de pe laptop, iar tabla îl
   urmează, fără să știe nimeni că e un PDF și nu o lecție. */
window.fisaLiceu = {
  versiune: 1,
  slide: () => current,
  cateSlideuri: () => slides.length,
  laSlide: (n) => goTo(n),
};
</script>
</body>
</html>`;
}

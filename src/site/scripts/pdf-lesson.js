// =========================================================
// PAGINA-ȘABLON A LECȚIILOR PDF (0105), la `lectii/pdf/#adresa`.
//
// O SINGURĂ PAGINĂ pentru toate PDF-urile, ca la lecțiile scrise de elevi: un
// PDF urcat din panou n-are cum să nască un fișier în depozit (situl stă pe
// GitHub Pages, iar fișierele se nasc numai la un commit).
//
// PAGINILE SE DESENEAZĂ CU PDF.JS, nu cu vizualizatorul browserului: pe Android
// acela nu arată PDF-ul în pagină, ci îl descarcă, iar pe iPhone arată uneori
// doar prima pagină. Fiecare pagină se desenează abia când ajunge pe ecran
// (ori aproape), la lățimea ecranului; un PDF de 30 de pagini nu îngheață fila.
//
// DACĂ DESENUL NU IESE, pagina spune asta pe față și lasă la vedere
// „Descarcă" și „Deschide în filă nouă". Lecția nu rămâne un dreptunghi alb.
// Cuprins în română, nume în engleză.
// =========================================================
import { LESSON_DOMAINS } from "../../shared/scripts/domains.js";
import { aduPdfjs } from "../../shared/scripts/pdfjs.js";
import { adresaDescarcare, adresaPdf, lectiePdf } from "../../shared/scripts/lesson-pdf-repo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Mărirea: de la lățimea paginii până la de două ori. */
const TREPTE = [1, 1.25, 1.5, 1.75, 2];
/* Mai mult de atâtea pagini nu se desenează; un PDF-carte se descarcă. */
const MAX_PAGINI = 200;

/** Aduce fișierul în octeți, spunând din când în când cât la sută a venit. */
async function aduCuProcent(url, laProcent) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`PDF-ul n-a venit (${r.status})`);
  const tot = Number(r.headers.get("content-length")) || 0;
  if (!tot || !r.body) return new Uint8Array(await r.arrayBuffer());
  const cititor = r.body.getReader();
  const bucati = [];
  let venit = 0;
  for (;;) {
    const { done, value } = await cititor.read();
    if (done) break;
    bucati.push(value);
    venit += value.length;
    laProcent(Math.min(99, Math.round((venit / tot) * 100)));
  }
  const octeti = new Uint8Array(venit);
  let i = 0;
  for (const b of bucati) { octeti.set(b, i); i += b.length; }
  return octeti;
}

const marimea = (o) => (o ? `${(o / 1024 / 1024).toFixed(o < 1024 * 1024 ? 2 : 1).replace(".", ",")} MB` : "");

export async function renderPdfLesson(basePath = "") {
  const mount = document.getElementById("lectie-pdf");
  if (!mount) return;
  const slug = decodeURIComponent(location.hash.slice(1)).trim().toLowerCase();
  const inapoi = `${basePath}lectii/#literatura-liceu`;

  mount.innerHTML = `<p class="pdfl-stare">Se încarcă lecția…</p>`;
  const l = await lectiePdf(slug);
  if (!l) {
    mount.innerHTML = `
      <div class="pdfl-gol">
        <h1>Lecția nu se găsește</h1>
        <p>Poate a fost ștearsă ori adresa e greșită.</p>
        <p><a class="btn btn--ghost" href="${inapoi}">Înapoi la lecții</a></p>
      </div>`;
    return;
  }

  const d = LESSON_DOMAINS.find((x) => x.slug === l.domeniu);
  const url = adresaPdf(l.fisier);
  const descarca = adresaDescarcare(l.fisier, l.titlu);
  document.title = `${l.titlu} — Atelierul-LRO`;
  if (d) mount.style.setProperty("--lesson-color", d.color);

  mount.innerHTML = `
    <article class="pdfl">
      <header class="pdfl__cap">
        <a class="pdfl__inapoi" href="${inapoi}">← ${esc(d ? d.label : "Lecții")}</a>
        <h1 class="pdfl__titlu">${esc(l.titlu)}</h1>
        ${l.rezumat ? `<p class="pdfl__rezumat">${esc(l.rezumat)}</p>` : ""}
      </header>
      <div class="pdfl__bara" role="toolbar" aria-label="Unelte PDF">
        <span class="pdfl__pagina" aria-live="polite"></span>
        <span class="pdfl__marire">
          <button type="button" class="pdfl__btn" data-zoom="-1" aria-label="Micșorează">−</button>
          <span class="pdfl__procent">100%</span>
          <button type="button" class="pdfl__btn" data-zoom="1" aria-label="Mărește">+</button>
        </span>
        <span class="pdfl__actiuni">
          <a class="pdfl__btn pdfl__btn--text" href="${url}" target="_blank" rel="noopener">Deschide în filă nouă</a>
          <a class="pdfl__btn pdfl__btn--plin" href="${descarca}">Descarcă${l.marime ? ` · ${marimea(l.marime)}` : ""}</a>
        </span>
      </div>
      <div class="pdfl__foi"><p class="pdfl-stare">Se deschide PDF-ul…</p></div>
    </article>`;

  const foi = mount.querySelector(".pdfl__foi");
  const eticheta = mount.querySelector(".pdfl__pagina");
  const procent = mount.querySelector(".pdfl__procent");

  /* Fișierul îl aduce pagina, nu pdf.js: așa se vede cât a venit, iar o
     greșeală de rețea se prinde aici, cu mesajul ei. */
  let doc;
  try {
    const [pdfjs, octeti] = await Promise.all([aduPdfjs(), aduCuProcent(url, (p) => {
      const s = foi.querySelector(".pdfl-stare");
      if (s) s.textContent = `Se descarcă PDF-ul… ${p}%`;
    })]);
    doc = await pdfjs.getDocument({ data: octeti }).promise;
  } catch (e) {
    console.warn("pdf-lesson:", e);
    foi.innerHTML = `
      <div class="pdfl-gol">
        <p>PDF-ul n-a putut fi desenat aici.</p>
        <p>Îl poți <a href="${url}" target="_blank" rel="noopener">deschide într-o filă nouă</a>
           ori <a href="${descarca}">descărca</a>.</p>
      </div>`;
    return;
  }

  const cate = Math.min(doc.numPages, MAX_PAGINI);
  /* Mărimea fiecărei pagini, ca locurile să fie rezervate dinainte: altfel
     pagina ar sări în sus și-n jos pe măsură ce se desenează foile. */
  const masuri = [];
  for (let i = 1; i <= cate; i++) {
    const v = (await doc.getPage(i)).getViewport({ scale: 1 });
    masuri.push(v.width / v.height);
  }
  foi.innerHTML = masuri.map((r, i) => `
    <div class="pdfl__foaie" data-i="${i + 1}" style="aspect-ratio:${r}">
      <canvas aria-label="Pagina ${i + 1}"></canvas>
    </div>`).join("") + (doc.numPages > cate
      ? `<p class="pdfl-stare">Restul de ${doc.numPages - cate} pagini sunt în PDF-ul descărcat.</p>` : "");

  let treapta = 0;
  const desenate = new Map();          // pagină → lățimea la care s-a desenat

  async function deseneaza(foaie) {
    const i = Number(foaie.dataset.i);
    const latime = Math.round(foaie.clientWidth * Math.min(window.devicePixelRatio || 1, 2));
    if (!latime || desenate.get(i) === latime) return;
    desenate.set(i, latime);
    const pagina = await doc.getPage(i);
    const v1 = pagina.getViewport({ scale: 1 });
    const vedere = pagina.getViewport({ scale: latime / v1.width });
    const panza = foaie.querySelector("canvas");
    panza.width = Math.round(vedere.width);
    panza.height = Math.round(vedere.height);
    const ctx = panza.getContext("2d", { alpha: false });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, panza.width, panza.height);
    try { await pagina.render({ canvasContext: ctx, viewport: vedere }).promise; }
    catch { desenate.delete(i); }
  }

  /* Se desenează ce ajunge pe ecran, plus o pagină de rezervă dedesubt. */
  const pePagina = new IntersectionObserver((intrari) => {
    for (const x of intrari) if (x.isIntersecting) deseneaza(x.target);
  }, { rootMargin: "100% 0px" });
  /* „pagina 3 / 12": cea care ocupă mijlocul ecranului. */
  const laMijloc = new IntersectionObserver((intrari) => {
    for (const x of intrari) if (x.isIntersecting) eticheta.textContent = `pagina ${x.target.dataset.i} / ${doc.numPages}`;
  }, { rootMargin: "-50% 0px -50% 0px" });
  foi.querySelectorAll(".pdfl__foaie").forEach((f) => { pePagina.observe(f); laMijloc.observe(f); });
  eticheta.textContent = `pagina 1 / ${doc.numPages}`;

  /* La mărire ori la schimbarea ferestrei, foile vizibile se desenează din nou. */
  const redeseneaza = () => foi.querySelectorAll(".pdfl__foaie").forEach((f) => {
    const r = f.getBoundingClientRect();
    if (r.bottom > -innerHeight && r.top < 2 * innerHeight) deseneaza(f);
  });
  mount.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
    treapta = Math.max(0, Math.min(TREPTE.length - 1, treapta + Number(b.dataset.zoom)));
    foi.style.setProperty("--marire", TREPTE[treapta]);
    procent.textContent = `${Math.round(TREPTE[treapta] * 100)}%`;
    setTimeout(redeseneaza, 60);   // după ce s-a lățit foaia
  }));
  let pas;
  addEventListener("resize", () => { clearTimeout(pas); pas = setTimeout(redeseneaza, 200); });
}

// =========================================================
// Panoul „Tablă" al unei lecții: materialul din care se hrănește tabla.
//
// A VENIT DE PE TABLĂ. Fereastra asta a stat o vreme în tabla de fonetică, într-un
// `<dialog>` deschis din meniul „⋯". A fost o greșeală de așezare: materialul se
// scrie o dată la câteva luni, cu lista pregătită dinainte, iar tabla e un loc de
// lucru zilnic al ELEVULUI. Uneltele profesorului n-au ce căuta acolo.
//
// DE CE ÎN DOUĂ MIȘCĂRI. Lipești lista și ea se așază într-un TABEL nesalvat, ca
// într-o foaie de calcul; abia „Importă" o trimite. Motivul e practic: un cuvânt
// bun la „litere și sunete" nu e neapărat bun și la „valoarea lui i". Dacă bifele
// s-ar pune o dată pentru toată lista, ar trebui lipită lista de patru ori.
//
// NU ȘTIE CE E MATERIALUL. Felurile și etichetele vin din `board-material.js`,
// unde fiecare lecție își descrie tabla. Panoul de față desenează tabelul după
// descriere: la fonetică ies patru coloane de bifat, la o tablă viitoare vor ieși
// altele, fără să se schimbe un rând aici.
//
// PANOUL SE REDESENEAZĂ ÎNTREG la orice schimbare de stare, ca tot restul hubului.
// De-aia rândurile din tabel stau în `state`, nu în pagină: dacă textul lipit ar
// sta într-un `<textarea>`, ar pieri la prima bifă.
// Content Romanian, identifiers English.
// =========================================================
import { materialulLectiei, felulMaterialului, cheia } from "../../shared/scripts/board-material.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const NIVELE = { 1: "ușor", 2: "mijlociu", 3: "greu" };

/** „3 cuvinte", „20 de cuvinte": regula lui „de" de la 20 în sus. */
export function cuDe(n, unul, mai) {
  const rest = n % 100;
  const are = n >= 20 && !(rest >= 1 && rest <= 19);
  return n + (are ? " de " : " ") + (n === 1 ? unul : mai);
}

/**
 * Desparte lista lipită.
 *
 * Despărțitorul e „;", dar primim și rândul nou: așa vine lista când o copiezi
 * dintr-un document, iar a o refuza ar fi o pedeapsă fără rost. Virgula NU e
 * despărțitor: propozițiile au virgule în ele.
 */
export function desparte(text) {
  return String(text || "").split(/[;\n\r]+/).map((x) => x.trim()).filter(Boolean);
}

/**
 * Ia lista lipită și o preface în rânduri de tabel.
 * Întoarce `{ randuri, sarite }`: sărite sunt cele scrise de două ori.
 */
export function randuriDinLista(text, { kind, inTabel = [], inBanca = new Set() }) {
  const vazute = new Set(inTabel.map((r) => cheia(r.body)));
  const randuri = [];
  let sarite = 0;
  for (const body of desparte(text)) {
    const k = cheia(body);
    if (vazute.has(k)) { sarite++; continue; }
    vazute.add(k);
    randuri.push({ body, kind, tags: [], level: 2, gata: inBanca.has(k) });
  }
  return { randuri, sarite };
}

/** Câte pleacă, câte nu, și de ce. */
export function socoteala(masa) {
  const gata = masa.filter((r) => r.gata).length;
  const fara = masa.filter((r) => !r.gata && !r.tags.length).length;
  return { pleaca: masa.length - gata - fara, gata, fara };
}

/** Panoul întreg. `st` e felia de stare a tablei din panoul de admin. */
export function boardPanelHtml(lectie, st) {
  const desc = materialulLectiei(lectie.slug);
  if (!desc) return faraTabla(lectie);

  const kind = st.kind || desc.feluri[0].kind;
  const fel = felulMaterialului(lectie.slug, kind) || desc.feluri[0];
  const masa = st.masa || [];
  const s = socoteala(masa);

  return `
    <div class="cx-box">
      <div class="cx-admin__head"><h3>${esc(desc.nume)} · ${esc(lectie.title)}</h3></div>
      <p class="cx-muted">${esc(desc.lamurire)} Lipește lista despărțită cu „;", apoi bifează
        în tabel la ce exerciții se potrivește fiecare: pe cap de coloană bifezi toată coloana,
        pe rând bifezi numai cuvântul acela.</p>

      <div class="cxbk__sus">
        <label class="cx-label" for="bkFel">Fel</label>
        <select class="cx-input cxbk__fel" id="bkFel" data-action="bk-fel">
          ${desc.feluri.map((f) => `<option value="${f.kind}"${f.kind === kind ? " selected" : ""}
            ${masa.length && masa[0].kind !== f.kind ? " disabled" : ""}>${esc(f.nume)}</option>`).join("")}
        </select>
        ${masa.length ? `<span class="cx-muted cxbk__blocat">tabelul ține un singur fel deodată</span>` : ""}
      </div>

      <div class="cxbk__intrare">
        <textarea class="cx-input" id="bkText" rows="2"
          placeholder="${esc(fel.pilda)}">${esc(st.text || "")}</textarea>
        <button type="button" class="btn btn--sm" data-action="bk-adauga">Adaugă în tabel</button>
      </div>
      ${st.nota ? `<p class="cx-warn${st.notaBuna ? " cx-warn--bine" : ""}" role="status">${esc(st.nota)}</p>` : ""}

      ${masa.length ? tabelul(masa, fel, s) : ""}
    </div>

    ${bancaDeAcum(lectie, st)}`;
}

function tabelul(masa, fel, s) {
  const deTrimis = masa.filter((r) => !r.gata);
  const plina = (et) => deTrimis.length > 0 && deTrimis.every((r) => r.tags.includes(et));
  const cols = fel.etichete;

  const cap = `<tr>
    <th class="cxbk__nr"></th>
    <th class="cxbk__corp">Material</th>
    ${cols.map((c) => `<th><button type="button" class="cxbk__cap${plina(c.slug) ? " e-plina" : ""}"
      data-action="bk-coloana" data-et="${c.slug}" title="Bifează sau dezbifează toată coloana">${esc(c.nume)}</button></th>`).join("")}
    <th><select class="cx-input cxbk__niv" data-action="bk-nivel-tot" aria-label="Dificultatea tuturor">
      <option value="">dificultate</option>
      ${[1, 2, 3].map((n) => `<option value="${n}">${NIVELE[n]}</option>`).join("")}
    </select></th>
    <th class="cxbk__x"></th></tr>`;

  const trup = masa.map((r, i) => `<tr class="cxbk__r${r.gata ? " e-gata" : ""}">
    <td class="cxbk__nr">${i + 1}.</td>
    <td class="cxbk__corp">${esc(r.body)}${r.gata ? `<span class="cxbk__gata">e în bancă</span>` : ""}</td>
    ${cols.map((c) => `<td><input type="checkbox" data-action="bk-bifa" data-i="${i}" data-et="${c.slug}"
      ${r.tags.includes(c.slug) ? "checked" : ""}${r.gata ? " disabled" : ""}
      aria-label="${esc(c.nume + ": " + r.body)}"></td>`).join("")}
    <td><select class="cx-input cxbk__niv" data-action="bk-nivel" data-i="${i}"${r.gata ? " disabled" : ""}
      aria-label="Dificultatea pentru ${esc(r.body)}">
      ${[1, 2, 3].map((n) => `<option value="${n}"${r.level === n ? " selected" : ""}>${NIVELE[n]}</option>`).join("")}
    </select></td>
    <td class="cxbk__x"><button type="button" class="cxbk__scoate" data-action="bk-scoate" data-i="${i}"
      title="Scoate rândul" aria-label="Scoate rândul">×</button></td></tr>`).join("");

  const vorbe = [cuDe(s.pleaca, "de trimis", "de trimis")];
  if (s.gata) vorbe.push(`${s.gata} deja în bancă`);
  if (s.fara) vorbe.push(cuDe(s.fara, "fără bifă", "fără bifă"));

  /* BIFEAZĂ TOT. Uneori e mai scurt drumul invers: pui bifa peste tot și pe
     urmă scoți de la cele câteva cuvinte care nu se potrivesc. La o listă de
     o sută de cuvinte și patru etichete, asta înseamnă un click în loc de
     patru, iar restul lucrului e oricum de făcut cu ochiul pe fiecare rând.
     Butonul spune ce URMEAZĂ să facă, nu în ce stare e: „Bifează tot" când mai
     e ceva de bifat, „Scoate toate bifele" când e plin. */
  const totBifat = deTrimis.length > 0
    && deTrimis.every((r) => cols.every((c) => r.tags.includes(c.slug)));

  return `<div class="cxbk__masa">
      <div class="cxbk__sul"><table class="cxbk__t">
        <thead>${cap}</thead><tbody>${trup}</tbody></table></div>
      <div class="cxbk__jos">
        <span class="cx-muted">${esc(vorbe.join(" · "))}</span>
        <button type="button" class="btn-mini" data-action="bk-tot"
          title="Toate etichetele, la toate rândurile care încă n-au intrat în bancă">
          ${totBifat ? "Scoate toate bifele" : "Bifează tot"}</button>
        <button type="button" class="btn-mini" data-action="bk-goleste">Golește tabelul</button>
        <button type="button" class="btn btn--primary btn--sm" data-action="bk-importa"
          ${s.pleaca ? "" : "disabled"}>Importă în bancă</button>
      </div>
    </div>`;
}

function bancaDeAcum(lectie, st) {
  const tot = st.banca || [];
  if (st.incarc) return `<div class="cx-box"><p class="cx-muted">Se încarcă banca…</p></div>`;
  return `<div class="cx-box">
      <div class="cx-admin__head"><h3>Ce e în bancă · ${tot.length}</h3></div>
      ${tot.length ? `<div class="cxbk__lista">${tot.map((it) => `
        <span class="cxbk__it">${esc(it.body)}
          <span class="cxbk__itn">${esc((it.tags || []).join(" · ") || "fără etichetă")} · ${NIVELE[it.level] || it.level}</span>
          <button type="button" class="cxbk__itx" data-action="bk-sterge" data-id="${esc(it.id)}"
            title="Scoate din bancă" aria-label="Scoate din bancă">×</button>
        </span>`).join("")}</div>`
        : `<p class="cx-muted">Banca e goală încă. Lipește prima listă sus.</p>`}
    </div>`;
}

/** Lecția n-are încă tablă cu material. Nu e o eroare, e o etapă. */
function faraTabla(lectie) {
  return `<div class="cx-box">
      <div class="cx-admin__head"><h3>Tablă · ${esc(lectie.title)}</h3></div>
      <p class="cx-muted">Lecția asta n-are încă tablă cu material. Când hotărăști ce fel de
        material îi trebuie (cuvinte, corpus de texte, altceva), se adaugă în
        <code>board-material.js</code>, iar panoul de aici se face singur după descriere.</p>
    </div>`;
}

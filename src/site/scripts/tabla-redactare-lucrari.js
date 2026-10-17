// =========================================================
// LUCRĂRILE DE PE TABLA DE REDACTARE: grila „operă × tip de eseu".
//
// Cerut de Marius pe 17 octombrie 2026, după previzualizarea din
// `Diverse/lucrarile-mele-preview.html` (modelul 3, „Grilă"): elevul pornit își
// păstrează în cont eseurile lucrate pe tablă și le revede oricând, pe etichete:
// opera și tipul eseului.
//
// O LUCRARE = O OPERĂ + UN TIP DE ESEU, ÎNTR-O ZI. Treptele (5, 8, 14, 18)
// cresc în aceeași lucrare. Stă în `learn_lessons_boards` (0074), sub lecția
// „lectura-redactare-enunturi": elevul își vede doar lucrările lui, profesorul
// le citește pe ale tuturor, fără să le poată schimba. Forma din `data`:
//   { versiune: 1, opera: {nume, autor}, tip, zi: "AAAA-LL-ZZ", treapta,
//     trepte: { "5": [...], "8": [...], ... } }   (doar treptele cu ceva scris)
//
// Aici stau grila și cititorul unei lucrări. Ce se întâmplă la creion o
// hotărăște tabla (`laPunePeTabla`, `laLucreazaSingur`): profesorul aduce
// lucrarea pe tabla live, elevul o deschide doar pentru el.
// =========================================================
import { listLessonSheets } from "../../shared/scripts/board-repo.js";
import { tutoringPupils } from "../../shared/scripts/pupils-repo.js";
import { CURRENT_USER } from "../../shared/scripts/session.js";

export const LECTIE = "lectura-redactare-enunturi";

const LUNI = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august",
  "septembrie", "octombrie", "noiembrie", "decembrie"];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Ziua de azi, după ceasul elevului: „2026-10-17". */
export function ziDeAzi() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function ziFrumoasa(zi, scurt = false) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(zi || ""));
  if (!m) return "";
  const luna = LUNI[Number(m[2]) - 1] || "";
  return scurt ? `${Number(m[3])} ${luna.slice(0, 3)}.` : `${Number(m[3])} ${luna} ${m[1]}`;
}

/**
 * Opera, din numele fișei Word: „L. 08. b) Realism - Moromeții (Marin Preda).docx"
 * dă { nume: "Moromeții", autor: "Marin Preda" }. Se ia ce e după ultimul „ - ",
 * iar autorul e cel din paranteza de la capăt. `null` dacă nu iese nimic.
 */
export function operaDinFisa(numeFisa) {
  let s = String(numeFisa || "").replace(/\.docx$/i, "").trim();
  if (!s) return null;
  const bucati = s.split(/\s[-–]\s/);
  s = bucati[bucati.length - 1].trim();
  return operaDinText(s);
}
/** „Moromeții (Marin Preda)" → { nume, autor }; fără paranteză, doar numele. */
export function operaDinText(text) {
  const s = String(text || "").trim().slice(0, 160);
  if (!s) return null;
  const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(s);
  /* „(de Ioan Slavici)": „de" din fața autorului nu e din nume. */
  return m && m[1].trim() ? { nume: m[1].trim(), autor: m[2].trim().replace(/^de\s+/i, "") } : { nume: s, autor: "" };
}
export const textOpera = (o) => (o?.nume ? (o.autor ? `${o.nume} (${o.autor})` : o.nume) : "");
export const numeOpera = (o) => o?.nume || "Operă nenumită";

/**
 * Deschide fereastra cu grila.
 * @param {object} c
 * @param {boolean} c.admin              profesorul (vede lucrările tuturor)
 * @param {Array} c.tipuri               tipurile de eseu ale tablei: {cheie, etichete, trepte:[{n, parti}]}
 * @param {(cheie:string)=>string} c.numeTip
 * @param {(row)=>void} c.laPunePeTabla      creionul profesorului
 * @param {(row)=>void} c.laLucreazaSingur   creionul elevului
 */
export function deschideLucrarile(c) {
  document.querySelector(".tl-voal")?.remove();
  const voal = document.createElement("div");
  voal.className = "tl-voal";
  voal.innerHTML = `<div class="tl-fereastra" role="dialog" aria-modal="true" aria-label="Lucrările">
      <div class="tl-cap"><h2>${c.admin ? "📁 Lucrările elevilor" : "📁 Lucrările mele"}</h2>
        <span class="tl-numar"></span><span class="tl-g"></span>
        <button type="button" class="tl-x" data-tl="inchide" aria-label="Închide">×</button></div>
      <div class="tl-elevi" hidden></div>
      <div class="tl-corp"><p class="tl-gol">Se aduc lucrările…</p></div>
    </div>`;
  document.body.append(voal);
  const corp = voal.querySelector(".tl-corp");
  const elevi = voal.querySelector(".tl-elevi");

  let randuri = [];          // { id, user_id, title, data, updated_at }
  const nume = new Map();    // user_id → numele elevului
  let elevAles = "toti";
  let deschis = null, treapta = 0, mod = "una";

  const tipul = (k) => c.tipuri.find((t) => t.cheie === k) || c.tipuri[0];
  const treptele = (k) => tipul(k).trepte.map((t) => t.n);
  const atinse = (r) => treptele(r.data.tip).filter((n) => Array.isArray(r.data.trepte?.[n]));
  const ultima = (r) => Math.max(...atinse(r), 0);
  const numeElev = (id) => nume.get(id) || "elev";
  const initiale = (id) => numeElev(id).split(/\s+/).map((x) => x[0] || "").join("").slice(0, 2).toUpperCase();
  const cheieOpera = (r) => `${(r.data.opera?.nume || "").toLowerCase()}|${(r.data.opera?.autor || "").toLowerCase()}`;
  const vazute = () => (c.admin && elevAles !== "toti" ? randuri.filter((r) => r.user_id === elevAles) : randuri);
  const cuNume = () => c.admin && elevAles === "toti";
  const trepteMici = (r) => `<span class="tl-trepte tl-${esc(r.data.tip)}">${treptele(r.data.tip)
    .map((n) => `<i class="${r.data.trepte?.[n] ? "on" : ""}">${n}</i>`).join("")}</span>`;
  const av = (id) => `<span class="tl-av">${esc(initiale(id))}</span>`;

  function inchide() { voal.remove(); document.removeEventListener("keydown", tasta); }
  function tasta(e) {
    if (e.key !== "Escape") return;
    if (deschis) { deschis = null; deseneaza(); } else inchide();
  }
  document.addEventListener("keydown", tasta);

  function deseneazaElevii() {
    if (!c.admin) return;
    const cu = [...new Set(randuri.map((r) => r.user_id))];
    elevi.hidden = !cu.length;
    elevi.innerHTML = `<span class="tl-nota">Elevul:</span>`
      + [["toti", "Toți elevii", randuri.length], ...cu.map((id) => [id, numeElev(id), randuri.filter((r) => r.user_id === id).length])]
        .sort((a, b) => (a[0] === "toti" ? -1 : b[0] === "toti" ? 1 : a[1].localeCompare(b[1], "ro")))
        .map(([k, n, cate]) => `<button type="button" data-tl-elev="${esc(k)}" class="${elevAles === k ? "is-on" : ""}">${esc(n)}<small>${cate}</small></button>`).join("")
      + `<span class="tl-nota tl-dreapta">doar de citit · ✎ le aduce pe tablă</span>`;
  }

  function grila() {
    const v = vazute();
    voal.querySelector(".tl-numar").textContent = `${v.length} ${v.length === 1 ? "lucrare" : "lucrări"}`;
    if (!v.length) {
      return `<p class="tl-gol">${c.admin ? "Niciun elev n-are încă lucrări salvate aici." :
        "N-ai încă lucrări salvate. Când profesorul te pornește pe tablă, ce lucrați se salvează aici singur."}</p>`;
    }
    const opere = new Map();
    for (const r of v) if (!opere.has(cheieOpera(r))) opere.set(cheieOpera(r), r.data.opera || {});
    const sir = [...opere.entries()].sort((a, b) => numeOpera(a[1]).localeCompare(numeOpera(b[1]), "ro"));
    return `<table class="tl-grila"><thead><tr><th>Opera</th>${c.tipuri.map((t) => `<th>${esc(c.numeTip(t.cheie))}</th>`).join("")}</tr></thead><tbody>
      ${sir.map(([k, o]) => `<tr><td>📖 ${esc(numeOpera(o))}${o.autor ? `<small>${esc(o.autor)}</small>` : ""}</td>
        ${c.tipuri.map((t) => {
          const ale = v.filter((r) => cheieOpera(r) === k && r.data.tip === t.cheie)
            .sort((a, b) => `${b.data.zi}${b.data.ora || ""}`.localeCompare(`${a.data.zi}${a.data.ora || ""}`) || String(b.updated_at).localeCompare(String(a.updated_at)));
          if (!ale.length) return `<td><span class="tl-celula tl-celula--goala">nelucrat încă</span></td>`;
          if (cuNume()) {
            const pe = [...new Set(ale.map((r) => r.user_id))].map((id) => ale.find((r) => r.user_id === id));
            return `<td><div class="tl-celula">${pe.map((r) => `<button type="button" class="tl-elev-rand" data-tl-deschide="${esc(r.id)}">${av(r.user_id)}<span>${esc(numeElev(r.user_id).split(" ")[0])}</span>${trepteMici(r)}</button>`).join("")}</div></td>`;
          }
          return `<td><button type="button" class="tl-celula" data-tl-deschide="${esc(ale[0].id)}">${trepteMici(ale[0])}
            <span class="tl-nota">${esc(ziFrumoasa(ale[0].data.zi, true))}${ale[0].data.ora ? `, ${esc(ale[0].data.ora)}` : ""}${ale.length > 1 ? ` · ${ale.length} încercări` : ""}</span></button></td>`;
        }).join("")}</tr>`).join("")}
    </tbody></table>
    <p class="tl-nota">O căsuță deschide lucrarea cea mai nouă; încercările mai vechi le alegi din ea.</p>`;
  }

  function cititor() {
    const r = deschis, d = r.data, t = tipul(d.tip);
    const parti = (n) => {
      const pe = t.trepte.find((x) => x.n === n)?.parti || [];
      const sus = treptele(d.tip)[treptele(d.tip).indexOf(n) - 1];
      const peSus = sus ? t.trepte.find((x) => x.n === sus).parti : null;
      let nr = 0;
      return t.etichete.map((et, p) => {
        const cati = pe[p] || 0, start = nr;
        nr += cati;
        const nou = peSus && cati > peSus[p];
        const enunturi = (d.trepte[n] || []).slice(start, start + cati);
        return `<div class="tl-parte${p > 0 && p < t.etichete.length - 1 ? " tl-parte--r" : ""}"><span class="tl-parte__et">${esc(et)}</span>
          ${enunturi.map((e, j) => `<div class="tl-enunt${nou ? " tl-enunt--nou" : ""}"><b>${start + j + 1}.</b><span>${e ? esc(e) : "<em>gol</em>"}</span></div>`).join("")}</div>`;
      }).join("");
    };
    const incercari = randuri.filter((x) => x.user_id === r.user_id && cheieOpera(x) === cheieOpera(r) && x.data.tip === d.tip)
      .sort((a, b) => `${b.data.zi}${b.data.ora || ""}`.localeCompare(`${a.data.zi}${a.data.ora || ""}`));
    const alCui = r.user_id === CURRENT_USER.authId;
    const creion = c.admin
      ? `<button type="button" class="tl-creion" data-tl="pune" title="Aduce lucrarea pe tabla live, ca s-o continuați">✎ Pune pe tablă</button>`
      : alCui ? `<button type="button" class="tl-creion" data-tl="singur" title="O deschide doar pentru tine, ca s-o lucrezi mai departe">✎ Lucrează pe ea</button>` : "";
    const corpul = mod === "una"
      ? parti(treapta) + `<p class="tl-nota"><i class="tl-mostra"></i>enunțurile rescrise pe treapta asta; celelalte vin de pe treapta dinainte</p>`
      : `<div class="tl-alaturi">${treptele(d.tip).map((n) => `<div class="tl-coloana"><h4>${n} enunțuri</h4>${
        d.trepte[n] ? parti(n) : `<div class="tl-gol">Lucrarea s-a oprit la ${ultima(r)} enunțuri.</div>`}</div>`).join("")}</div>`;
    return `<div class="tl-cititor-cap">
        <button type="button" class="tl-inapoi" data-tl="grila">‹ Grila</button>
        <div><h3>${esc(numeOpera(d.opera))} · ${esc(c.numeTip(d.tip))}</h3>
          <div class="tl-etichete">${c.admin ? `<span class="tl-et tl-et--elev">${esc(numeElev(r.user_id))}</span>` : ""}
            ${d.opera?.autor ? `<span class="tl-et">📖 ${esc(d.opera.autor)}</span>` : ""}
            <span class="tl-et tl-et--zi">${esc(ziFrumoasa(d.zi))}${d.ora ? `, ${esc(d.ora)}` : ""}</span>
            ${incercari.length > 1 ? `<span class="tl-nota">încercări:</span>${incercari.map((x) => `<button type="button" class="tl-et tl-incercare${x.id === r.id ? " is-on" : ""}" data-tl-deschide="${esc(x.id)}">${esc(ziFrumoasa(x.data.zi, true))}${x.data.ora ? `, ${esc(x.data.ora)}` : ""}</button>`).join("")}` : ""}
          </div></div>
        <span class="tl-g"></span>
        <div class="tl-comut">${treptele(d.tip).map((n) => `<button type="button" data-tl-treapta="${n}" class="${mod === "una" && n === treapta ? "is-on" : ""}"${d.trepte[n] ? "" : " disabled"}>${n}</button>`).join("")}</div>
        <div class="tl-comut"><button type="button" data-tl-mod="una" class="${mod === "una" ? "is-on" : ""}">O treaptă</button><button type="button" data-tl-mod="toate" class="${mod === "toate" ? "is-on" : ""}">Toate alături</button></div>
        ${creion}
      </div>
      <div class="tl-cititor-corp tl-${esc(d.tip)}">${corpul}</div>`;
  }

  function deseneaza() {
    deseneazaElevii();
    corp.innerHTML = deschis ? cititor() : grila();
  }

  voal.addEventListener("click", (e) => {
    if (e.target === voal || e.target.closest('[data-tl="inchide"]')) { inchide(); return; }
    const el = e.target.closest("[data-tl-elev]");
    if (el) { elevAles = el.dataset.tlElev; deschis = null; deseneaza(); return; }
    const d = e.target.closest("[data-tl-deschide]");
    if (d) {
      deschis = randuri.find((r) => r.id === d.dataset.tlDeschide) || null;
      if (deschis) { treapta = ultima(deschis); mod = "una"; }
      deseneaza(); return;
    }
    if (e.target.closest('[data-tl="grila"]')) { deschis = null; deseneaza(); return; }
    const t = e.target.closest("[data-tl-treapta]");
    if (t && !t.disabled) { treapta = Number(t.dataset.tlTreapta); mod = "una"; deseneaza(); return; }
    const m = e.target.closest("[data-tl-mod]");
    if (m) { mod = m.dataset.tlMod; deseneaza(); return; }
    if (e.target.closest('[data-tl="pune"]') && deschis) { const r = deschis; inchide(); c.laPunePeTabla(r, numeElev(r.user_id)); return; }
    if (e.target.closest('[data-tl="singur"]') && deschis) { const r = deschis; inchide(); c.laLucreazaSingur(r); }
  });

  (async () => {
    try {
      const [toate, lista] = await Promise.all([
        listLessonSheets(LECTIE, { aleTuturor: c.admin }),
        c.admin ? tutoringPupils().catch(() => []) : Promise.resolve([]),
      ]);
      for (const p of lista) nume.set(p.userId, p.name);
      randuri = toate.filter((r) => r.data && r.data.versiune === 1 && c.tipuri.some((t) => t.cheie === r.data.tip) && r.data.trepte);
    } catch (e) {
      corp.innerHTML = `<p class="tl-gol">N-am putut aduce lucrările.<br><code>${esc(e?.message || e)}</code></p>`;
      return;
    }
    deseneaza();
  })();
}

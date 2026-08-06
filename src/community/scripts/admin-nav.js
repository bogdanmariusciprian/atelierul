// =========================================================
// Bara laterală a panoului de administrare, și rutele ei.
//
// DE CE O BARĂ, NU FILE. Rândul de file de dinainte ținea șapte unelte și era
// deja plin. Panoul creștea în două direcții deodată: unelte noi (banca de
// material) și lucruri care se înmulțesc singure (lecțiile). Un rând orizontal
// nu poate purta nici una, nici alta: la a zecea filă rândul se rupe în două și
// nimeni nu mai găsește nimic. O bară verticală poartă cincisprezece intrări
// fără să clipească, are loc de titluri de grup și de numere în dreapta.
//
// CELE TREI GRUPURI sunt ale lui Marius, și sunt bune fiindcă fiecare are un
// SUBIECT, nu o însușire:
//   USERI    – tot ce e despre elevi: cifrele lor, conturile, ce scriu.
//   PROFESOR – tot ce pregătești tu: lecțiile cu uneltele lor, testele.
//   WEBSITE  – mașinăria care merge singură: puncte, insigne, clasament.
//
// DOUĂ INTRĂRI CRESC SINGURE. „Lecții" se desface pe domenii și apoi pe lecții,
// fiecare lecție cu cele trei părți ale ei; „Teste" se desface pe examene, dar
// fără alt nivel dedesubt: un examen se gospodărește dintr-un singur panou.
// Deosebirea nu e o scăpare, e o alegere: la lecție ai de umblat în trei locuri
// deosebite (textul, exercițiile, tabla), la examen ai un singur teanc de fișe.
//
// RUTELE. Fiecare intrare are o adresă `#admin/...`, ca să meargă legăturile din
// afară și butonul „înapoi". Adresele vechi (`#admin/moderare`,
// `#admin/utilizatori`, `#admin/prezentare`) rămân în picioare: sunt scrise în
// bara sitului și în cardurile de pe dashboard, iar o adresă moartă e o pagubă
// tăcută. Content Romanian, identifiers English.
// =========================================================
import { LESSONS } from "../../shared/scripts/lessons-index.js";
import { LESSON_DOMAINS } from "../../shared/scripts/domains.js";
import { TEST_CATEGORIES } from "../../site/scripts/test-categories.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Părțile unei lecții. Aceleași trei, la orice lecție, ca să nu trebuiască
 *  învățate de fiecare dată de la capăt. */
export const PARTI_LECTIE = [
  { slug: "lectie", nume: "Lecție", icon: "📄" },
  { slug: "exercitii", nume: "Exerciții", icon: "✎" },
  { slug: "tabla", nume: "Tablă", icon: "🔤" },
];

/** Intrările simple, cele care nu se desfac. Cheia e id-ul de filă din stare. */
export const INTRARI = [
  { id: "overview", grup: "useri", slug: "statistici", nume: "Statistici", icon: "📊" },
  { id: "users", grup: "useri", slug: "utilizatori", nume: "Conturi", icon: "👥" },
  { id: "moderation", grup: "useri", slug: "moderare", nume: "Moderare", icon: "⚖️" },
  { id: "lessons", grup: "profesor", slug: "lectii", nume: "Lecții", icon: "📚", creste: true },
  { id: "tests", grup: "profesor", slug: "teste", nume: "Teste", icon: "🎓", creste: true },
  { id: "bonus", grup: "profesor", slug: "bonus", nume: "Întrebări bonus", icon: "❓" },
  { id: "challenges", grup: "website", slug: "provocari", nume: "Provocarea zilei", icon: "🔥" },
  { id: "gamification", grup: "website", slug: "gamificare", nume: "Puncte și insigne", icon: "🏆" },
];

const GRUPURI = [
  { slug: "useri", nume: "USERI" },
  { slug: "profesor", nume: "PROFESOR" },
  { slug: "website", nume: "WEBSITE" },
];

/** Adresele vechi, care trebuie să ducă tot undeva. Se citesc, nu se scriu:
 *  legăturile pe care le facem noi de acum înainte folosesc numele noi. */
const ALIAS = { prezentare: "statistici", dashboard: "statistici", descarcabile: "teste" };

const PE_SLUG = Object.fromEntries(INTRARI.map((i) => [i.slug, i]));
const PE_ID = Object.fromEntries(INTRARI.map((i) => [i.id, i]));

/**
 * Citește `#admin/...` și întoarce ce panou trebuie deschis.
 *
 * Formele:
 *   #admin                                   → statistici
 *   #admin/moderare                          → o intrare simplă
 *   #admin/lectii                            → lista lecțiilor
 *   #admin/lectii/<lectie>/<parte>           → o parte a unei lecții
 *   #admin/teste/<examen>                    → un examen
 */
export function citesteRuta(hash) {
  const h = String(hash || "").replace(/^#/, "");
  if (h !== "admin" && !h.startsWith("admin/")) return null;
  const buc = h.split("/").filter(Boolean).slice(1);
  const cerut = ALIAS[buc[0]] || buc[0];
  const intrare = PE_SLUG[cerut];
  if (!intrare) return { tab: "overview", lectie: null, parte: null, examen: null };

  if (intrare.id === "lessons") {
    const lectie = buc[1] && LESSONS.some((l) => l.slug === buc[1]) ? buc[1] : null;
    const parte = lectie && PARTI_LECTIE.some((p) => p.slug === buc[2]) ? buc[2] : (lectie ? "lectie" : null);
    return { tab: "lessons", lectie, parte, examen: null };
  }
  if (intrare.id === "tests") {
    const examen = buc[1] && TEST_CATEGORIES.some((c) => c.slug === buc[1]) ? buc[1] : null;
    return { tab: "tests", lectie: null, parte: null, examen };
  }
  return { tab: intrare.id, lectie: null, parte: null, examen: null };
}

/** Adresa pentru starea de acum. Perechea lui `citesteRuta`. */
export function scrieRuta({ tab, lectie, parte, examen }) {
  const intrare = PE_ID[tab];
  if (!intrare) return "#admin/statistici";
  if (intrare.id === "lessons" && lectie) return `#admin/lectii/${lectie}/${parte || "lectie"}`;
  if (intrare.id === "tests" && examen) return `#admin/teste/${examen}`;
  return `#admin/${intrare.slug}`;
}

/** Lecțiile cu pagină, așezate pe domenii. Domeniile fără lecții nu apar. */
export function lectiiPeDomenii() {
  const cuPagina = LESSONS.filter((l) => l.ready);
  return LESSON_DOMAINS
    .map((d) => ({ ...d, lectii: cuPagina.filter((l) => l.domain === d.slug) }))
    .filter((d) => d.lectii.length);
}

/**
 * Bara întreagă, ca text HTML.
 *
 * `numere` ține ce se arată în dreapta fiecărei intrări:
 *   { moderare, utilizatori, propuneriPeLectie:{slug:n}, materialPeLectie:{slug:n},
 *     fisePeExamen:{slug:n}, itemiPeExamen:{slug:n} }
 * Se dau din afară, nu se socotesc aici: bara e desen, nu depozit.
 */
export function adminNavHtml(stare, numere = {}) {
  const { tab, lectie, parte, examen, deschise = {} } = stare;
  const n = (x) => (x ? `<b class="cxnav__n">${x}</b>` : "");
  const fierbinte = (x) => (x ? `<b class="cxnav__n cxnav__n--hot">${x}</b>` : "");

  const intrareSimpla = (it) => {
    const nr = it.id === "moderation" ? fierbinte(numere.moderare)
      : it.id === "users" ? n(numere.utilizatori) : "";
    return `<button type="button" class="cxnav__it${tab === it.id ? " on" : ""}"
      data-action="admin-go" data-tab="${it.id}">
      <span class="cxnav__ic" aria-hidden="true">${it.icon}</span>
      <span class="cxnav__lb">${esc(it.nume)}</span>${nr}</button>`;
  };

  const nodLectii = () => {
    const desfacut = deschise.lessons !== false && (tab === "lessons" || deschise.lessons === true);
    const totalLectii = LESSONS.filter((l) => l.ready).length;
    let dedesubt = "";
    if (desfacut) {
      dedesubt = `<div class="cxnav__sub">${lectiiPeDomenii().map((d) => {
        const domDesfacut = deschise[`dom:${d.slug}`] === true ||
          d.lectii.some((l) => l.slug === lectie);
        const lectiile = !domDesfacut ? "" : d.lectii.map((l) => {
          const eDeschisa = l.slug === lectie;
          const parti = !eDeschisa ? "" : PARTI_LECTIE.map((p) => {
            const nr = p.slug === "exercitii" ? fierbinte((numere.propuneriPeLectie || {})[l.slug])
              : p.slug === "tabla" ? n((numere.materialPeLectie || {})[l.slug]) : "";
            return `<button type="button" class="cxnav__it cxnav__it--3${parte === p.slug ? " on" : ""}"
              data-action="admin-go" data-tab="lessons" data-lectie="${l.slug}" data-parte="${p.slug}">
              <span class="cxnav__ic" aria-hidden="true">${p.icon}</span>
              <span class="cxnav__lb">${esc(p.nume)}</span>${nr}</button>`;
          }).join("");
          return `<button type="button" class="cxnav__it cxnav__it--2${eDeschisa ? " e-desfacut" : ""}"
              data-action="admin-go" data-tab="lessons" data-lectie="${l.slug}" data-parte="${eDeschisa ? "" : "lectie"}">
              <span class="cxnav__ch" aria-hidden="true">${eDeschisa ? "▾" : "▸"}</span>
              <span class="cxnav__lb">${esc(l.title)}</span></button>${parti}`;
        }).join("");
        return `<button type="button" class="cxnav__it cxnav__it--2"
            data-action="admin-fold" data-fold="dom:${d.slug}">
            <span class="cxnav__ch" aria-hidden="true">${domDesfacut ? "▾" : "▸"}</span>
            <span class="cxnav__lb">${esc(d.label)}</span>${n(d.lectii.length)}</button>${lectiile}`;
      }).join("")}</div>`;
    }
    return `<button type="button" class="cxnav__it${tab === "lessons" && !lectie ? " on" : ""}"
        data-action="admin-go" data-tab="lessons">
        <span class="cxnav__ch" aria-hidden="true">${desfacut ? "▾" : "▸"}</span>
        <span class="cxnav__ic" aria-hidden="true">📚</span>
        <span class="cxnav__lb">Lecții</span>${n(totalLectii)}</button>${dedesubt}`;
  };

  const nodTeste = () => {
    const desfacut = deschise.tests !== false && (tab === "tests" || deschise.tests === true);
    const dedesubt = !desfacut ? "" : `<div class="cxnav__sub">${TEST_CATEGORIES.map((c) =>
      `<button type="button" class="cxnav__it cxnav__it--2${examen === c.slug ? " on" : ""}"
        data-action="admin-go" data-tab="tests" data-examen="${c.slug}">
        <span class="cxnav__ic" aria-hidden="true">${c.icon}</span>
        <span class="cxnav__lb">${esc(c.title)}</span>${n((numere.fisePeExamen || {})[c.slug])}</button>`
    ).join("")}</div>`;
    return `<button type="button" class="cxnav__it${tab === "tests" && !examen ? " on" : ""}"
        data-action="admin-go" data-tab="tests">
        <span class="cxnav__ch" aria-hidden="true">${desfacut ? "▾" : "▸"}</span>
        <span class="cxnav__ic" aria-hidden="true">🎓</span>
        <span class="cxnav__lb">Teste</span>${n(TEST_CATEGORIES.length)}</button>${dedesubt}`;
  };

  return `<nav class="cxnav" aria-label="Secțiunile panoului">${GRUPURI.map((g) => `
    <div class="cxnav__grup">
      <div class="cxnav__titlu">${g.nume}</div>
      ${INTRARI.filter((i) => i.grup === g.slug).map((i) =>
        i.id === "lessons" ? nodLectii() : i.id === "tests" ? nodTeste() : intrareSimpla(i)
      ).join("")}
    </div>`).join("")}</nav>`;
}

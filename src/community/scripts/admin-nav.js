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

  /* ADÂNCIMEA SE VEDE DIN CUIBĂRIRE, NU DIN RETRAGERI PUSE DE MÂNĂ.
     Prima dată dădusem fiecărei trepte o clasă cu retragerea ei scrisă în CSS
     („--2", „--3"). Greșeala se vede de la o poștă în urmă: domeniul și lecția
     purtau amândouă „--2", deci stăteau la aceeași distanță de margine, iar
     arborele arăta ca o listă turtită.

     Acum fiecare treaptă are cutia ei, `.cxnav__sub`, iar retragerea și linia
     de ghidaj vin din cuibărire. Nu se mai poate greși: dacă lecția stă în
     cutia domeniului, ea E mai adâncă, n-are cum să nu fie. */
  const nodul = ({ tip, deschis, marca, eticheta, numar, atribute, dedesubt }) =>
    `<button type="button" class="cxnav__it${tip ? " " + tip : ""}"${atribute}>
      <span class="cxnav__ch${deschis === null ? " cxnav__ch--gol" : ""}" aria-hidden="true"
        >${deschis === null ? "" : deschis ? "▾" : "▸"}</span>
      ${marca ? `<span class="cxnav__ic" aria-hidden="true">${marca}</span>` : ""}
      <span class="cxnav__lb">${esc(eticheta)}</span>${numar || ""}</button>${dedesubt || ""}`;

  const intrareSimpla = (it) => {
    const nr = it.id === "moderation" ? fierbinte(numere.moderare)
      : it.id === "users" ? n(numere.utilizatori) : "";
    return nodul({
      tip: tab === it.id ? "on" : "", deschis: null, marca: it.icon,
      eticheta: it.nume, numar: nr,
      atribute: ` data-action="admin-go" data-tab="${it.id}"`,
    });
  };

  const nodLectii = () => {
    const desfacut = deschise.lessons !== false && (tab === "lessons" || deschise.lessons === true);
    const totalLectii = LESSONS.filter((l) => l.ready).length;

    const cutiaDomeniilor = !desfacut ? "" : `<div class="cxnav__sub">${lectiiPeDomenii().map((d) => {
      const domDesfacut = deschise[`dom:${d.slug}`] === true ||
        d.lectii.some((l) => l.slug === lectie);

      const cutiaLectiilor = !domDesfacut ? "" : `<div class="cxnav__sub">${d.lectii.map((l) => {
        const eDeschisa = l.slug === lectie;

        const cutiaPartilor = !eDeschisa ? "" : `<div class="cxnav__sub">${PARTI_LECTIE.map((p) => {
          const nr = p.slug === "exercitii" ? fierbinte((numere.propuneriPeLectie || {})[l.slug])
            : p.slug === "tabla" ? n((numere.materialPeLectie || {})[l.slug]) : "";
          return nodul({
            tip: parte === p.slug ? "on" : "", deschis: null, marca: p.icon,
            eticheta: p.nume, numar: nr,
            atribute: ` data-action="admin-go" data-tab="lessons" data-lectie="${l.slug}" data-parte="${p.slug}"`,
          });
        }).join("")}</div>`;

        return nodul({
          tip: eDeschisa ? "e-desfacut" : "", deschis: eDeschisa, marca: "",
          eticheta: l.title,
          atribute: ` data-action="admin-go" data-tab="lessons" data-lectie="${l.slug}" data-parte="${eDeschisa ? "" : "lectie"}"`,
          dedesubt: cutiaPartilor,
        });
      }).join("")}</div>`;

      return nodul({
        tip: "", deschis: domDesfacut, marca: "", eticheta: d.label, numar: n(d.lectii.length),
        atribute: ` data-action="admin-fold" data-fold="dom:${d.slug}"`,
        dedesubt: cutiaLectiilor,
      });
    }).join("")}</div>`;

    return nodul({
      tip: tab === "lessons" && !lectie ? "on" : "", deschis: desfacut, marca: "📚",
      eticheta: "Lecții", numar: n(totalLectii),
      atribute: ` data-action="admin-go" data-tab="lessons"`,
      dedesubt: cutiaDomeniilor,
    });
  };

  const nodTeste = () => {
    const desfacut = deschise.tests !== false && (tab === "tests" || deschise.tests === true);
    const cutia = !desfacut ? "" : `<div class="cxnav__sub">${TEST_CATEGORIES.map((c) => nodul({
      tip: examen === c.slug ? "on" : "", deschis: null, marca: c.icon,
      eticheta: c.title, numar: n((numere.fisePeExamen || {})[c.slug]),
      atribute: ` data-action="admin-go" data-tab="tests" data-examen="${c.slug}"`,
    })).join("")}</div>`;
    return nodul({
      tip: tab === "tests" && !examen ? "on" : "", deschis: desfacut, marca: "🎓",
      eticheta: "Teste", numar: n(TEST_CATEGORIES.length),
      atribute: ` data-action="admin-go" data-tab="tests"`,
      dedesubt: cutia,
    });
  };

  return `<nav class="cxnav" aria-label="Secțiunile panoului">${GRUPURI.map((g) => `
    <div class="cxnav__grup">
      <div class="cxnav__titlu">${g.nume}</div>
      ${INTRARI.filter((i) => i.grup === g.slug).map((i) =>
        i.id === "lessons" ? nodLectii() : i.id === "tests" ? nodTeste() : intrareSimpla(i)
      ).join("")}
    </div>`).join("")}</nav>`;
}

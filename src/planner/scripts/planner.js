// =========================================================
// The tutoring planner — a week of seven days, hours down the side, blocks
// dragged out of a tray with a mouse or a finger.
//
// THE DAY IS THE POINT. A pupil who cancels Tuesday and wants Saturday must
// never have to work out which column is which: the day is written large above
// every column, today's column is lit, and while anything is being dragged its
// day and hour ride on the preview and in a banner pinned to the bottom.
//
// DRAGGING uses POINTER events, not the HTML5 drag-and-drop API — one code
// path for mouse, pen and finger; HTML5 DnD simply never fires on touch.
// Three gestures share it: placing (from a tray chip), moving (grab a block),
// resizing (grab a block's bottom edge). They differ only in what onUp saves.
//
// CONFLICTS are prevented in three layers, and it takes all three:
//   1. the preview turns red and refuses to drop on an overlap or in the past;
//   2. other people's bookings appear live through the realtime subscription;
//   3. the database refuses overlaps outright (exclusion constraint), so the
//      race nobody can see still resolves correctly. Only this one is a
//      guarantee; the first two are courtesy.
//
// RECURRENCE is materialised: „every Tuesday at 18" becomes twelve real rows
// sharing a recurrence_id. Each can be moved or cancelled alone — which is what
// actually happens to a weekly lesson — and occurrences falling in a vacation
// are skipped and REPORTED, never silently dropped.
// Content Romanian, identifiers English.
// =========================================================
import {
  DAY_START_H, DAY_END_H, SNAP_MIN, DURATIONS, DEFAULT_DURATION,
  weekStart, fetchWeek, bookSlot, moveSlot, cancelSlot, renameSlot, watchSlots,
  hasPlannerAccess, fetchMarkedPupils, savePupilPrefs, fetchMyPlannerPrefs,
  fetchVacations, saveVacation, deleteVacation, bookRecurring, makeRecurring, stopSeriesHere, cancelSeries,
  fetchAvailability, saveAvailabilityWindow, deleteAvailabilityWindow, resizeAvailabilityWindow,
} from "../../shared/scripts/planner-repo.js";
import { CURRENT_USER, isAdmin, isLoggedIn } from "../../shared/scripts/session.js";
import { showToast } from "../../shared/scripts/toast.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const DAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];
const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

const HOURS = DAY_END_H - DAY_START_H;
const SLOTS_PER_H = 60 / SNAP_MIN;
const ROWS = HOURS * SLOTS_PER_H;   // half-hour rows
const ROW_PX = 26;                   // one half hour on screen
const REC_WEEKS = 12;                // how far a weekly series reaches

// The palette the teacher picks pupil colours from. Ten, distinct, all dark
// enough to carry white text — free typing a hex invites unreadable blocks.
const SWATCHES = ["#7c3aed", "#0891b2", "#16a34a", "#ea580c", "#be185d",
  "#1d4ed8", "#b45309", "#0f766e", "#dc2626", "#475569"];

/** The auto-colour scheme, in two steps, because one wasn't enough.
 *
 *  Step 1 — a hue HASHED from the pupil's id. Stable: it never changes when
 *  the roster grows, so the teacher's mental map („Ana e mov") survives.
 *
 *  Step 2 — a SPREAD pass. Hashing alone fails the birthday paradox: sixteen
 *  pupils on a 360° wheel make a near-identical pair TYPICAL, not rare — the
 *  numbers say the expected closest pair sits under 2° apart. So the hues are
 *  sorted and pushed apart to at least MIN_HUE_GAP, deterministically; only
 *  members of a crowded pair move, and only while the crowd exists.
 *
 *  A colour the teacher picked by hand skips all of this and always wins. */
const MIN_HUE_GAP = 18;
function hashHue(id) {
  let h = 0;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0;
  return h % 360;
}
function spreadHues(items) {
  if (items.length < 2) return;
  items.sort((a, b) => a.h - b.h || String(a.id).localeCompare(String(b.id)));
  for (let i = 1; i < items.length; i++) {
    if (items[i].h - items[i - 1].h < MIN_HUE_GAP) items[i].h = items[i - 1].h + MIN_HUE_GAP;
  }
  // The wheel wraps: last and first are neighbours too. If the forward pass
  // overflowed past one full turn minus a gap, fall back to even spacing
  // anchored at the first hue — still deterministic for this roster.
  const span = items[items.length - 1].h - items[0].h;
  if (span > 360 - MIN_HUE_GAP) {
    const step = 360 / items.length;
    items.forEach((it, i) => { it.h = (items[0].h + i * step) % 360; });
  } else {
    items.forEach((it) => { it.h %= 360; });
  }
}

const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const durLabel = (m) => (m === 60 ? "1 oră" : m === 90 ? "1h 30" : m === 120 ? "2 ore"
  : m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} ore` : `${Math.floor(m / 60)}h ${m % 60}`);

const S = {
  root: null,
  week: weekStart(),
  slots: [],
  pupils: [],          // admin: marked pupils with custom name/colour/minutes
  vacations: [],
  avail: [],           // the teacher's weekly windows — the source of pupil slots
  paint: false,        // admin: the pencil — editing his own layer of the board
  paintWhat: "avail",  // pencil regime: availability windows or personal blocks
  paintOnce: false,    // rhythm of drawn WINDOWS: weekly template vs one day
  paintOnceP: true,    // rhythm of drawn PERSONAL blocks: one-off by default
  pick: null,          // pupil: { dayIdx, startMs, minutes } being confirmed
  minutes: DEFAULT_DURATION,
  myColor: null,       // pupil: colour the teacher picked for them
  source: null,        // tray chip in hand: { kind, userId, title }
  personalTitle: "",
  editPupil: null,     // admin: pupil being customised (opened by CLICKING a dot)
  renameId: null,      // admin: personal block whose inline rename is open
  moveAsk: null,       // series member just moved/resized: „O dată / Permanent?"
  visH: 10,            // visible hour-rows: 8..17 by default, grows dimmed below
  vacOpen: false,      // admin: vacation form unfolded
  confirmId: null,     // block whose × was pressed — inline confirm shown
  drag: null,
  unwatch: null,
  loading: true,
};

// ---------- geometry ----------

const dayAt = (i) => {
  const d = new Date(S.week);
  d.setDate(d.getDate() + i);
  d.setHours(0, 0, 0, 0);
  return d;
};

function rowToMs(i, row) {
  const d = dayAt(i);
  d.setHours(DAY_START_H, 0, 0, 0);
  return d.getTime() + row * SNAP_MIN * 60000;
}

function msToRow(ms) {
  const d = new Date(ms);
  const base = new Date(d); base.setHours(DAY_START_H, 0, 0, 0);
  return Math.round((d - base) / (SNAP_MIN * 60000));
}

// ROUND, not floor: the DST week has a 23- or 25-hour day, so Sunday sits at
// 5.96 or 6.04 „days" from Monday — floor would file it under Saturday.
const dayIndexOf = (ms) => Math.round((new Date(ms).setHours(0, 0, 0, 0) - S.week.getTime()) / 86400000);

function collides(startMs, minutes, ignoreId = null) {
  const end = startMs + minutes * 60000;
  return S.slots.some((s) => s.id !== ignoreId && startMs < s.end && end > s.start);
}

const inHours = (startMs, minutes) => {
  const row = msToRow(startMs);
  return row >= 0 && row + minutes / SNAP_MIN <= ROWS;
};

// Booking backwards in time is refused by the server for pupils; the client
// mirrors it for everyone's preview so the red shows up while dragging, not
// after dropping. The teacher stays exempt — he may log a lesson already held.
const inPast = (startMs) => !isAdmin() && startMs < Date.now() - 5 * 60000;

const isoDay = (i) => {
  const d = dayAt(i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const vacationFor = (i) => {
  const iso = isoDay(i);
  return S.vacations.find((v) => iso >= v.from && iso <= v.to) || null;
};

// The windows governing THIS concrete day: the weekly template for its
// weekday, plus any one-off exceptions pinned to its exact date. The pupil's
// pills and the teacher's overlays both read the same answer.
const winsFor = (dayIdx) =>
  S.avail
    .filter((w) => (w.onDate ? w.onDate === isoDay(dayIdx) : w.weekday === dayIdx))
    // Weekly first, one-offs after → the amber exception always paints ON TOP
    // of the green template, never drowned under it.
    .sort((a, b) => (a.onDate ? 1 : 0) - (b.onDate ? 1 : 0));
// Wall-clock minutes via setMinutes: adding raw milliseconds to midnight
// drifts one hour on the DST Sunday — the pill would say 09:00 and the server
// guard would judge 09:00, for a window the teacher drew at 10:00.
const minToMs = (dayIdx, min) => { const d = dayAt(dayIdx); d.setMinutes(min); return d.getTime(); };
const minOf = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };

/** Inside ONE window — same rule as the server guard, mirrored so the pupil
 *  never sees an option the database would refuse. */
const inAvailability = (dayIdx, startMs, minutes) => {
  const a = minOf(startMs), b = a + minutes;
  return winsFor(dayIdx).some((w) => w.startMin <= a && w.endMin >= b);
};

/** Every start a pupil could actually book on this day, for this duration:
 *  windows, stepped by half hours, minus clashes, minus the past. */
function freeStartsFor(dayIdx, minutes) {
  const out = [];
  for (const w of winsFor(dayIdx)) {
    for (let m = w.startMin; m + minutes <= w.endMin; m += SNAP_MIN) {
      const at = minToMs(dayIdx, m);
      if (!collides(at, minutes) && !inPast(at)) out.push(at);
    }
  }
  // Template and one-off exception can OVERLAP; the same start must not
  // become two identical pills. Deduplicated, in clock order.
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Which durations fit at this start — drives the enabled/disabled state of
 *  the 1h / 1h30 / 2h buttons in the confirm step and on own bookings. */
const fitDurations = (dayIdx, startMs, ignoreId = null) =>
  DURATIONS.filter((m) => inAvailability(dayIdx, startMs, m) && !collides(startMs, m, ignoreId));

const pupilEmoji = (uid) => S.pupils.find((p) => p.id === uid)?.emoji || "";

/** How many hour-rows the timetable shows. 8:00–18:00 (ten rows, the last one
 *  labelled 17) by default — Marius's rule — and it GROWS, dimmed, when a
 *  block reaches the bottom, so late lessons are reachable without the empty
 *  evening hours taxing every other day. */
function neededVisH() {
  let need = 10;
  const stretch = (endMin) => {
    const endH = Math.ceil(endMin / 60) - DAY_START_H;
    if (endH >= need) need = Math.min(HOURS, endH + 1);
  };
  for (const x of S.slots) stretch(minOf(x.end) || 24 * 60);
  // Windows count too. Without this, a window ending at 19 had its bottom
  // handle BELOW the visible rows — the „can't edit today" bug: the edge was
  // there, just unreachable.
  for (const w of S.avail) stretch(w.endMin);
  return need;
}

/** The teacher's nickname for a pupil beats the profile name on his screen. */
function slotName(s) {
  if (isAdmin() && s.kind === "lesson") {
    return S.pupils.find((p) => p.id === s.userId)?.name || s.name;
  }
  return s.name;
}
function slotColor(s) {
  if (isAdmin() && s.kind === "lesson") {
    return S.pupils.find((p) => p.id === s.userId)?.color || s.color;
  }
  if (s.mine && S.myColor) return S.myColor;
  return s.color;
}

// ---------- header: navigation that says where you are ----------

function headerHtml() {
  const from = dayAt(0), to = dayAt(6);
  const span = from.getMonth() === to.getMonth()
    ? `${from.getDate()}–${to.getDate()} ${MONTHS[to.getMonth()]}`
    : `${from.getDate()} ${MONTHS[from.getMonth()]} – ${to.getDate()} ${MONTHS[to.getMonth()]}`;
  const isCurrent = S.week.getTime() === weekStart().getTime();
  return `
    <div class="pl-bar">
      <div class="pl-nav">
        <button type="button" class="pl-navbtn" data-act="prev">‹ <span>săpt. trecută</span></button>
        <span class="pl-span">
          <b>${esc(span)}</b>
          ${isCurrent
            ? `<i class="pl-span__now">săptămâna curentă</i>`
            : `<button type="button" class="pl-back" data-act="today">↩ Revino la azi</button>`}
        </span>
        <button type="button" class="pl-navbtn" data-act="next"><span>săpt. viitoare</span> ›</button>
      </div>
    </div>
`;
}

/** The controls Marius asked to live BELOW the timetable: duration, the
 *  availability brush, vacations, the legend and the how-to line. The board
 *  itself stays clean — palette, week, grid — and everything that CONFIGURES
 *  the board sits underneath it, out of the way until needed. */
function toolsHtml() {
  const durs = DURATIONS.map((m) => `
    <button type="button" class="pl-dur${S.minutes === m ? " on" : ""}" data-act="dur" data-m="${m}">
      ${esc(durLabel(m))}
    </button>`).join("");
  // DESIGN RULE: everything that flows from the pencil lives INSIDE one
  // capsule with it. Two labelled switches — WHAT you draw and its RHYTHM —
  // and, for personal time, the title field. Outside the capsule, nothing
  // belongs to the pencil; inside it, everything does.
  const once = S.paintWhat === "personal" ? S.paintOnceP : S.paintOnce;
  const segT = S.paintWhat === "personal"
    ? { week: `Activitatea se repetă săptămânal — plantează ${REC_WEEKS} apariții (sare vacanțele).`,
        once: "Activitatea există doar în ziua în care o desenezi." }
    : { week: "Fereastra pictată se repetă în fiecare săptămână.",
        once: "Fereastra pictată există doar în ziua aleasă — șablonul săptămânal rămâne neatins." };
  const pen = !S.paint
    ? `<button type="button" class="pl-paint" data-act="paint"
              title="Editează stratul tău de pe orar: ferestrele pentru elevi și activitățile tale.">🖌 creion</button>`
    : `<div class="pl-pen" role="group" aria-label="Uneltele creionului">
        <button type="button" class="pl-paint on" data-act="paint" title="Închide creionul.">🖌 creion</button>
        <span class="pl-pen__lab">desenezi</span>
        <span class="pl-seg" role="group" aria-label="Ce desenezi">
          <button type="button" class="pl-seg__b${S.paintWhat === "avail" ? " on" : ""}" data-act="paint-what" data-v="avail"
                  title="Pictează ferestrele în care elevii își pot alege ore.">disponibilitate</button>
          <button type="button" class="pl-seg__b${S.paintWhat === "personal" ? " on" : ""}" data-act="paint-what" data-v="personal"
                  title="Desenează direct în orar timpul tău: ședințe, pregătire, orice te face indisponibil.">activitate personală</button>
        </span>
        <span class="pl-pen__lab">ritm</span>
        <span class="pl-seg" role="group" aria-label="Ritmul">
          <button type="button" class="pl-seg__b${once ? "" : " on"}" data-act="paint-scope" data-v="week"
                  title="${esc(segT.week)}">în fiecare săptămână</button>
          <button type="button" class="pl-seg__b${once ? " on" : ""}" data-act="paint-scope" data-v="once"
                  title="${esc(segT.once)}">doar ziua aleasă</button>
        </span>
        ${S.paintWhat === "personal" ? `
          <input class="pl-ptitle" data-act="ptitle" maxlength="40" value="${esc(S.personalTitle)}"
                 placeholder="denumirea activității (ex. pregătire)" aria-label="Denumirea activității personale" />` : ""}
      </div>`;
  // Two rows, deliberately: the pencil's capsule gets its OWN line above the
  // duration chips, so it can never wrap into them and shuffle the layout.
  return `<div class="pl-tools pl-tools--pen">${pen}</div>
    <p class="pl-legend">
      <i class="pl-legend__k pl-legend__k--avail"></i> deschis săptămânal
      <i class="pl-legend__k pl-legend__k--once"></i> deschis doar în ziua aceea
      <i class="pl-legend__k pl-legend__k--vac"></i> vacanță (seriile o sar)
      <i class="pl-legend__k pl-legend__k--lesson"></i> ora unui elev (culoarea bulinei lui)
      <i class="pl-legend__k pl-legend__k--personal"></i> timpul tău
      <i class="pl-legend__k pl-legend__k--past"></i> trecut, înghețat
      <i class="pl-legend__k pl-legend__k--today"></i> azi
      <i class="pl-legend__k pl-legend__k--now"></i> acum
      <b class="pl-legend__rec">🔁</b> serie săptămânală
      <b class="pl-legend__rec is-off">🔁</b> o singură dată
      <i class="pl-legend__dot"></i> elev fără oră săptămâna asta
    </p>
    <div class="pl-tools">
      <span class="pl-dur__lab">Durata</span>${durs}
    </div>`;
}

// ---------- the tray ----------

/** THE PALETTE — Marius's own drawing, implemented as drawn: a row of round
 *  colour dots along the top. The dot IS the pupil; the name lives in a hover
 *  tooltip, and an optional emoji sits inside the circle as a second mark of
 *  identity. One object, two gestures: DRAG a dot into the timetable to place
 *  a lesson, CLICK it (press without moving) to open its little editor —
 *  distinguished by the same `moved` flag the drag machinery already keeps.
 *  The teacher's own time is NOT here any more — it lives under the 🖌
 *  pencil, next to the availability windows: one place for his whole layer. */
function paletteHtml() {
  const stat = new Map();
  for (const x of S.slots) {
    if (x.kind !== "lesson") continue;
    const cur = stat.get(x.userId) || { min: 0, first: null };
    cur.min += Math.round((x.end - x.start) / 60000);
    if (!cur.first || x.start < cur.first.start) cur.first = x;
    stat.set(x.userId, cur);
  }
  const dots = S.pupils.map((p) => {
    const st = stat.get(p.id);
    const tip = st
      ? `${p.name} — ${DAYS[dayIndexOf(st.first.start)]} ${hhmm(st.first.start)}, ${durLabel(st.min)}${st.min > 120 ? "+" : ""}`
      : `${p.name} — fără oră săptămâna asta`;
    return `<button type="button" class="pl-dot${st ? "" : " is-todo"}" data-act="pick" data-kind="lesson"
        data-uid="${esc(p.id)}" data-hover-uid="${esc(p.id)}" data-name="${esc(tip)}"
        style="--c:${esc(p.color)}" aria-label="${esc(tip)}">${esc(p.emoji || "")}</button>`;
  }).join("");
  return `<div class="pl-palette">
      ${dots}
      ${S.editPupil ? pupilEditorHtml() : ""}
    </div>`;
}

/** The chip editor: nickname, colour, default duration — the teacher's own
 *  labels for HIS planner. Nothing here touches the pupil's real profile. */
function pupilEditorHtml() {
  const p = S.pupils.find((x) => x.id === S.editPupil);
  if (!p) return "";
  const sw = SWATCHES.map((c) => `
    <button type="button" class="pl-sw${p.color === c ? " on" : ""}" data-act="cfg-color"
            data-c="${c}" style="--c:${c}" aria-label="Culoarea ${c}"></button>`).join("");
  const durs = DURATIONS.map((m) => `
    <button type="button" class="pl-dur${p.minutes === m ? " on" : ""}" data-act="cfg-min" data-m="${m}">
      ${esc(durLabel(m))}
    </button>`).join("");
  return `<div class="pl-cfg">
      <label class="pl-cfg__f">Nume pe bloc
        <input class="pl-cfg__name" data-act="cfg-name" maxlength="30"
               value="${esc(p.name)}" placeholder="${esc(p.profileName)}" />
      </label>
      <label class="pl-cfg__f">Simbol
        <input class="pl-cfg__emoji" data-act="cfg-emoji" maxlength="8"
               value="${esc(p.emoji || "")}" placeholder="ex. ⚽" />
      </label>
      <div class="pl-cfg__f"><span>Culoare</span><div class="pl-cfg__sw">${sw}</div></div>
      <div class="pl-cfg__f"><span>Durata lui implicită</span><div>${durs}</div></div>
      <div class="pl-cfg__acts">
        <button type="button" class="btn-mini btn-mini--ok" data-act="cfg-save">Salvează</button>
        <button type="button" class="btn-mini" data-act="cfg-close">Închide</button>
      </div>
      <p class="pl-cfg__hint">Doar tu vezi numele și culoarea astea. Elevul își poate scurta blocul, dar durata pornește de aici.</p>
    </div>`;
}

// ---------- vacations ----------

function vacationsHtml() {
  const items = S.vacations.map((v) => `
    <span class="pl-vac">
      🏖 <b>${esc(v.label)}</b> ${esc(v.from)} → ${esc(v.to)}
      <button type="button" class="pl-vac__x" data-act="vac-del" data-id="${esc(v.id)}" aria-label="Șterge vacanța">×</button>
    </span>`).join("");
  return `<div class="pl-vacbar">
      <span class="pl-vacbar__t">Vacanțe</span>
      ${items || `<span class="cx-muted">niciuna definită</span>`}
      ${S.vacOpen ? `
        <span class="pl-vacform">
          <input type="date" data-f="vac-from" /> →
          <input type="date" data-f="vac-to" />
          <input type="text" data-f="vac-label" placeholder="ex. vacanța de iarnă" maxlength="40" />
          <button type="button" class="btn-mini btn-mini--ok" data-act="vac-save">Adaugă</button>
          <button type="button" class="btn-mini" data-act="vac-close">Renunță</button>
        </span>`
      : `<button type="button" class="btn-mini" data-act="vac-open">+ adaugă</button>`}
      <span class="pl-vacbar__hint">Seriile săptămânale sar peste vacanțe. Cine vrea să lucrați în vacanță își trage ora normal.</span>
    </div>`;
}

// ---------- the grid ----------

/** THE PUPIL'S VIEW — no calendar, no dragging. Days as cards; under each,
 *  pills. Green pills are starts born from the teacher's windows minus what's
 *  taken; grey pills are taken hours, shown WITHOUT names — a pupil sees that
 *  18:00 is gone, never whose it is. Tapping a green pill unfolds the one
 *  decision left: the duration (preset to theirs), then „Rezervă". Two taps.
 *  Their own booking sits highlighted, with duration switches and a cancel
 *  that confirms in place. */
function pupilViewHtml() {
  if (!S.avail.length) {
    return `<div class="pl-locked">
        <b>Profesorul încă nu a deschis orele.</b>
        <p class="cx-muted">Când își va seta disponibilitatea, aici vor apărea orele libere pe care le poți alege cu o apăsare.</p>
      </div>`;
  }
  const today = new Date().setHours(0, 0, 0, 0);

  const cards = DAYS.map((label, i) => {
    const d = dayAt(i);
    const isToday = d.getTime() === today;
    const isPast = d.getTime() < today;
    const vac = vacationFor(i);
    const wins = winsFor(i);
    const daySlots = S.slots.filter((x) => dayIndexOf(x.start) === i).sort((a, b) => a.start - b.start);

    const mine = daySlots.filter((x) => x.mine).map((x) => {
      const over = x.end < Date.now();
      if (over) {
        // A held lesson is history — no duration switches, no cancel. The
        // server refuses those edits anyway (0061); the UI simply agrees.
        return `<div class="pl-mypill is-past" style="--c:${esc(S.myColor || "#7c3aed")}">
            <b>Ora ta · ${hhmm(x.start)}–${hhmm(x.end)}</b><i class="pl-mypill__past">încheiată</i>
          </div>`;
      }
      const confirming = S.confirmId === x.id;
      const durs = DURATIONS.map((m) => {
        const cur = Math.round((x.end - x.start) / 60000) === m;
        const can = cur || fitDurations(i, x.start, x.id).includes(m);
        return `<button type="button" class="pl-pill__d${cur ? " on" : ""}" data-act="my-dur"
                 data-id="${esc(x.id)}" data-m="${m}" ${can ? "" : "disabled"}>${esc(durLabel(m))}</button>`;
      }).join("");
      return `<div class="pl-mypill" style="--c:${esc(S.myColor || "#7c3aed")}">
          <b>Ora ta · ${hhmm(x.start)}–${hhmm(x.end)}</b>
          ${confirming
            ? `<span class="pl-block__confirm">Anulezi?
                 <button type="button" class="pl-mini pl-mini--no" data-act="conf-yes" data-id="${esc(x.id)}">Da</button>
                 <button type="button" class="pl-mini" data-act="conf-no">Nu</button></span>`
            : `<span class="pl-mypill__acts">${durs}
                 <button type="button" class="pl-pill__x" data-act="cancel" data-id="${esc(x.id)}" aria-label="Anulează ora">×</button></span>`}
        </div>`;
    }).join("");

    const taken = daySlots.filter((x) => !x.mine).map((x) =>
      `<span class="pl-pill is-taken">${hhmm(x.start)}–${hhmm(x.end)} · Ocupat</span>`).join("");

    // Free starts, computed for the SHORTEST duration: a start that fits one
    // hour is worth showing even if two don't fit — the duration step will
    // grey out what doesn't. Skipped entirely for past days.
    const free = isPast ? [] : freeStartsFor(i, DURATIONS[0]);
    const pills = free.map((at) => {
      const picked = S.pick && S.pick.startMs === at;
      if (!picked) {
        return `<button type="button" class="pl-pill" data-act="pick-slot" data-day="${i}" data-at="${at}">${hhmm(at)}</button>`;
      }
      const durs = DURATIONS.map((m) => {
        const can = fitDurations(i, at).includes(m);
        return `<button type="button" class="pl-pill__d${S.pick.minutes === m ? " on" : ""}" data-act="pick-dur"
                 data-m="${m}" ${can ? "" : "disabled"}>${esc(durLabel(m))}</button>`;
      }).join("");
      return `<span class="pl-pickbox">
          <b>${esc(label)} · ${hhmm(at)}–${hhmm(at + S.pick.minutes * 60000)}</b>
          ${durs}
          <button type="button" class="pl-mini pl-mini--go" data-act="pick-book">Rezervă</button>
          <button type="button" class="pl-mini" data-act="pick-x">Renunță</button>
        </span>`;
    }).join("");

    const empty = !wins.length
      ? `<span class="pl-day__none">zi fără ore deschise</span>`
      : !mine && !taken && !free.length && !isPast
        ? `<span class="pl-day__none">toate orele sunt ocupate</span>`
        : "";

    return `<section class="pl-day${isToday ? " is-today" : ""}${isPast ? " is-past" : ""}">
        <header class="pl-day__h">
          <b>${esc(label)}</b>
          <span>${d.getDate()} ${esc(MONTHS[d.getMonth()].slice(0, 3))}</span>
          ${isToday ? `<i class="pl-colhead__today">AZI</i>` : ""}
          ${vac ? `<i class="pl-colhead__vac">🏖 ${esc(vac.label)}</i>` : ""}
        </header>
        <div class="pl-day__b">${mine}${taken ? `<div class="pl-day__row">${taken}</div>` : ""}
          ${pills ? `<div class="pl-day__row">${pills}</div>` : ""}${empty}</div>
      </section>`;
  }).join("");

  return `<div class="pl-days">${cards}</div>`;
}

function gridHtml() {
  const today = new Date().setHours(0, 0, 0, 0);
  const now = Date.now();
  S.visH = Math.max(S.visH, neededVisH());
  const visPx = S.visH * SLOTS_PER_H * ROW_PX;

  // Hour labels sit centred IN their row, like a school timetable, not on the
  // boundary lines. Rows past the base ten render dimmed.
  const rail = Array.from({ length: HOURS }, (_, h) =>
    `<span class="pl-hour${h >= 10 ? " is-dim" : ""}" style="top:${(h + 0.5) * SLOTS_PER_H * ROW_PX}px">${DAY_START_H + h}</span>`
  ).join("");

  const cols = DAYS.map((label, i) => {
    const d = dayAt(i);
    const isToday = d.getTime() === today;
    const isPast = d.getTime() < today;
    const vac = vacationFor(i);
    const blocks = S.slots.filter((s) => dayIndexOf(s.start) === i).map((s) => {
      const row = msToRow(s.start);
      const rows = Math.round((s.end - s.start) / (SNAP_MIN * 60000));
      const over = s.end < now;
      // The past is frozen for EVERYONE, personal blocks included — what
      // happened, happened: no handles, no ×, no 🔁, no rename. Only the
      // passive badge below still tells which blocks belonged to a series.
      const alive = s.canEdit && !over;
      const confirming = S.confirmId === s.id;
      const renaming = S.renameId === s.id;
      const asking = S.moveAsk?.id === s.id;
      const body = confirming
        ? `<b class="pl-block__who">Anulezi?</b>
           <span class="pl-block__confirm">
             <button type="button" class="pl-mini pl-mini--no" data-act="conf-yes" data-id="${esc(s.id)}">Da</button>
             ${s.recurrenceId && s.canEdit && isAdmin()
               ? `<button type="button" class="pl-mini pl-mini--no" data-act="conf-series" data-id="${esc(s.id)}">Toată seria</button>` : ""}
             <button type="button" class="pl-mini" data-act="conf-no">Nu</button>
           </span>`
        : asking
        ? `<b class="pl-block__who">${S.moveAsk.gesture === "move" ? "Mut:" : "Durata:"} ${esc(DAYS[S.moveAsk.dayIdx])} ${hhmm(S.moveAsk.startMs)}–${hhmm(S.moveAsk.startMs + S.moveAsk.minutes * 60000)}</b>
           <span class="pl-block__confirm">
             <button type="button" class="pl-mini" data-act="ask-once"
                     title="Doar săptămâna asta — blocul iese din serie, restul săptămânilor rămân neatinse.">O dată</button>
             <button type="button" class="pl-mini" data-act="ask-forever"
                     title="Seria veche se oprește aici și continuă în noul interval, săptămână de săptămână.">Permanent</button>
             <button type="button" class="pl-mini" data-act="ask-no" aria-label="Renunț">✕</button>
           </span>`
        : renaming
        ? `<span class="pl-block__ren">
             <input data-role="rename" maxlength="40" value="${esc(s.name)}" aria-label="Denumirea activității" />
             <button type="button" class="pl-mini" data-act="rename-ok" data-id="${esc(s.id)}">✓</button>
             <button type="button" class="pl-mini" data-act="rename-no">×</button>
           </span>`
        : `<b class="pl-cb__nm">${s.kind === "lesson" && pupilEmoji(s.userId) ? `${esc(pupilEmoji(s.userId))} ` : ""}${esc(slotName(s))}</b>
           ${alive ? `<button type="button" class="pl-block__rec${s.recurrenceId ? " on" : ""}" data-act="rec-toggle" data-id="${esc(s.id)}"
               title="${s.recurrenceId
                 ? "Se repetă săptămânal. Apasă ca să oprești repetarea de aici înainte — blocul ăsta rămâne, singur."
                 : `Apasă ca să se repete săptămânal de aici înainte (${REC_WEEKS} săptămâni).`}"
               aria-pressed="${s.recurrenceId ? "true" : "false"}" aria-label="Repetare săptămânală">🔁</button>`
             : s.recurrenceId ? `<i class="pl-cb__rec" title="Făcea parte dintr-o serie săptămânală">🔁</i>` : ""}
           ${alive ? `<button type="button" class="pl-block__x" data-act="cancel" data-id="${esc(s.id)}" aria-label="Anulează">×</button>` : ""}
           ${alive && s.kind === "personal" ? `<span class="pl-block__rsz pl-block__rsz--top" data-act="rsz-top" data-id="${esc(s.id)}" title="Trage ca să muți începutul" aria-hidden="true"></span>` : ""}
           ${alive ? `<span class="pl-block__rsz" data-act="rsz" data-id="${esc(s.id)}" title="Trage ca să ${s.kind === "personal" ? "muți sfârșitul" : "schimbi durata"}" aria-hidden="true"></span>` : ""}`;
      // A full-colour CELL, straight from Marius's drawing: no text inside — the
      // colour is the identity, and the name arrives on hover, as a tooltip
      // fed by data-name. Screen readers get the same words via aria-label.
      const tip = `${slotName(s)} · ${DAYS[i]} ${hhmm(s.start)}–${hhmm(s.end)}`;
      return `<div class="pl-block pl-block--cell${s.mine ? " is-mine" : ""}${alive ? " can-edit" : ""}${over ? " is-past" : ""}${s.kind === "personal" ? " is-personal" : ""}${confirming || asking ? " is-confirm" : ""}${renaming ? " is-renaming" : ""}"
        style="--c:${esc(slotColor(s))}; top:${row * ROW_PX}px; height:${rows * ROW_PX - 3}px"
        data-id="${esc(s.id)}" data-day="${i}" data-uid="${esc(s.userId)}" data-name="${esc(tip)}"
        aria-label="${esc(tip)}" ${alive && !confirming && !renaming && !asking ? 'data-act="grab"' : ""}>
        ${body}
      </div>`;
    }).join("");

    return `<div class="pl-col${isToday ? " is-today" : ""}${isPast ? " is-past" : ""}${vac ? " is-vac" : ""}" data-day="${i}">
      <div class="pl-colhead">
        <b class="pl-colhead__d">${esc(label)}</b>
        <span class="pl-colhead__n">${d.getDate()} ${esc(MONTHS[d.getMonth()].slice(0, 3))}</span>
        ${isToday ? `<i class="pl-colhead__today">AZI</i>` : ""}
        ${vac ? `<i class="pl-colhead__vac" title="${esc(vac.label)}">🏖 vacanță</i>` : ""}
      </div>
      <div class="pl-lane" data-day="${i}" style="height:${visPx}px">
        ${Array.from({ length: HOURS }, (_, h) => `<span class="pl-line${h >= 10 ? " is-dim" : ""}" style="top:${h * SLOTS_PER_H * ROW_PX}px"></span>`).join("")}
        ${winsFor(i).map((w) => {
          const mm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
          return `<span class="pl-avail${w.onDate ? " is-once" : ""}" style="top:${((w.startMin - DAY_START_H * 60) / SNAP_MIN) * ROW_PX}px; height:${((w.endMin - w.startMin) / SNAP_MIN) * ROW_PX}px"
              title="Fereastră deschisă elevilor, ${esc(DAYS[i])} ${mm(w.startMin)}–${mm(w.endMin)}, ${w.onDate ? "doar în această zi" : "în fiecare săptămână"}">
            <i class="pl-avail__tag">${w.onDate ? `doar ${d.getDate()} ${esc(MONTHS[d.getMonth()].slice(0, 3))}` : "deschis"} ${mm(w.startMin)}–${mm(w.endMin)}</i>
            ${S.paint && S.paintWhat === "avail" ? `
              <span class="pl-avail__h pl-avail__h--top" data-act="avail-rsz" data-id="${esc(w.id)}" data-edge="top" title="Trage ca să muți începutul"></span>
              <span class="pl-avail__h pl-avail__h--bot" data-act="avail-rsz" data-id="${esc(w.id)}" data-edge="bot" title="Trage ca să muți sfârșitul"></span>
              <button type="button" class="pl-avail__x" data-act="avail-del" data-id="${esc(w.id)}" aria-label="Șterge fereastra">×</button>` : ""}
          </span>`;
        }).join("")}
        ${isToday ? nowLineHtml() : ""}
        ${blocks}
      </div>
    </div>`;
  }).join("");

  return `<div class="pl-grid">
      <div class="pl-rail" style="height:${visPx}px">${rail}</div>
      <div class="pl-cols">${cols}</div>
    </div>`;
}

/** The red thread of „now", so today's column reads as alive, not just tinted. */
function nowLineHtml() {
  const row = msToRow(Date.now());
  if (row < 0 || row > ROWS) return "";
  const y = ((Date.now() - rowToMs(dayIndexOf(Date.now()), 0)) / (SNAP_MIN * 60000)) * ROW_PX;
  return `<span class="pl-now" style="top:${Math.max(0, Math.min(ROWS * ROW_PX, y)).toFixed(0)}px"></span>`;
}

function render() {
  if (!S.root) return;
  const mineCount = S.slots.filter((s) => s.mine).length;
  const body = S.loading
    ? `<p class="cx-muted">Se încarcă…</p>`
    : isAdmin()
      ? `<div class="pl-body${S.paint ? ` is-paint is-paint-${S.paintWhat}` : ""}">${gridHtml()}</div>`
      : pupilViewHtml();
  if (isAdmin()) {
    S.root.innerHTML = `
      ${!S.loading ? paletteHtml() : ""}
      ${headerHtml()}
      ${body}
      ${!S.loading ? `<div class="pl-below">
        ${toolsHtml()}
        ${vacationsHtml()}
        <p class="pl-hint">${S.paint
          ? (S.paintWhat === "personal"
            ? "Mod activitate personală: desenează în orar intervalul tău — cât tragi, atât durează, iar ritmul decide dacă se repetă săptămânal. Blocurile gri rămân vii: le muți, le întinzi de ambele capete, un click le redenumește."
            : "Mod disponibilitate: trage pe o coloană ca să deschizi o fereastră. Trage de marginile uneia existente ca să o ajustezi; × o închide.")
          : "Trage o bulină în orar ca să pui ora — o faci săptămânală din 🔁 de pe bloc. Click pe bulină îi deschide setările; scoaterea unui elev se face din Comunitate → membri."}</p>
      </div>` : ""}
      <div class="pl-live" data-role="live" hidden></div>`;
    return;
  }
  S.root.innerHTML = `
    ${headerHtml()}
    <p class="pl-hint">Apasă o oră liberă, alege durata, gata.${
      mineCount ? ` Ai ${mineCount} ${mineCount === 1 ? "rezervare" : "rezervări"} săptămâna asta.` : ""}</p>
    ${body}
    <div class="pl-live" data-role="live" hidden></div>`;
}

// ---------- dragging: place, move, resize ----------

function sourceLabel() {
  const s = S.source;
  if (!s) return "";
  if (!isAdmin()) return "Ora mea";
  return S.pupils.find((p) => p.id === s.userId)?.name || "Elev";
}

function placeGhost(lane) {
  const g = document.createElement("div");
  g.className = "pl-ghost";
  lane.appendChild(g);
  return g;
}

function updateGhost() {
  const g = S.drag?.ghost;
  if (!g) return;
  const { dayIdx, startMs, minutes, bad, badWhy, resize } = S.drag;
  g.style.transform = `translateY(${msToRow(startMs) * ROW_PX}px)`;
  g.style.height = `${(minutes / SNAP_MIN) * ROW_PX - 3}px`;
  g.classList.toggle("is-bad", !!bad);
  const rsz = resize || S.drag.resizeTop;
  const who = S.drag.id && !rsz ? "" : rsz ? durLabel(minutes) : sourceLabel();
  const vac = vacationFor(dayIdx);
  g.innerHTML = `<b>${esc(DAYS[dayIdx])}</b><span>${hhmm(startMs)}–${hhmm(startMs + minutes * 60000)}</span>
    ${who ? `<em>${esc(who)}</em>` : ""}
    ${bad ? `<i>${esc(badWhy || "ocupat")}</i>` : vac ? `<i class="is-vac">🏖 ${esc(vac.label)}</i>` : ""}`;
  const live = S.root.querySelector('[data-role="live"]');
  if (live) {
    live.hidden = false;
    live.textContent = bad
      ? `${DAYS[dayIdx]} ${hhmm(startMs)} — ${badWhy || "ocupat"}`
      : `${DAYS[dayIdx]}, ${hhmm(startMs)}–${hhmm(startMs + minutes * 60000)}${vac ? ` · ${vac.label}` : ""}`;
  }
}

function pointToSlot(clientX, clientY) {
  const cols = [...S.root.querySelectorAll(".pl-lane")];
  let lane = null, dayIdx = 0;
  for (const c of cols) {
    const r = c.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right) { lane = c; dayIdx = +c.dataset.day; break; }
  }
  if (!lane) {
    const r0 = cols[0].getBoundingClientRect();
    lane = clientX < r0.left ? cols[0] : cols[cols.length - 1];
    dayIdx = +lane.dataset.day;
  }
  const r = lane.getBoundingClientRect();
  const row = Math.max(0, Math.round((clientY - r.top) / ROW_PX));
  return { lane, dayIdx, row };
}

function markBad(d) {
  if (collides(d.startMs, d.minutes, d.id)) { d.bad = true; d.badWhy = "ocupat"; return; }
  if (!inHours(d.startMs, d.minutes)) { d.bad = true; d.badWhy = "în afara programului"; return; }
  if (inPast(d.startMs)) { d.bad = true; d.badWhy = "în trecut"; return; }
  d.bad = false; d.badWhy = "";
}

function onDown(e) {
  if (!isLoggedIn()) return;
  // The pupil's world is taps now — nothing there is draggable, and a stray
  // press must never start a ghost.
  if (!isAdmin()) return;

  // THE PENCIL. Two regimes share one gesture — a drag on a lane sketches
  // something for that day: an availability window, or a personal block.
  if (S.paint) {
    // Buttons and fields on the board stay CLICKS even in pencil mode.
    if (e.target.closest('[data-act="avail-del"], [data-act="cancel"], [data-act="rec-toggle"], [data-act="rename-ok"], [data-act="rename-no"], [data-role="rename"], .pl-block__confirm, .pl-mini')) return;

    // Regime „activitate personală": personal blocks stay ALIVE — the handle
    // resizes, a drag moves, a motionless press renames (see onUp). A press on
    // anything else either sketches a NEW personal block or does nothing.
    if (S.paintWhat === "personal") {
      const t = e.target.closest('[data-act="rsz-top"], [data-act="rsz"], [data-act="grab"]');
      const ts = t ? S.slots.find((x) => x.id === t.dataset.id) : null;
      if (!(ts?.kind === "personal" && ts.canEdit)) {
        if (e.target.closest(".pl-block--cell")) return; // lessons are scenery here
        const lane = e.target.closest(".pl-lane");
        if (!lane) return;
        const { dayIdx, row } = pointToSlot(e.clientX, e.clientY);
        S.drag = { paintP: true, dayIdx, row0: Math.min(row, ROWS - 1), ghost: placeGhost(lane) };
        S.root.classList.add("is-dragging");
        e.preventDefault();
        paintDrag(e.clientX, e.clientY);
        // The sketch drawn AT press is a preview. Without real movement it
        // must not book anything — a stray click planted invisible 30-minute
        // blocks that later „collided" with the drawing you actually meant.
        S.drag.moved = false;
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp, { once: true });
        window.addEventListener("pointercancel", onUp, { once: true });
        return;
      }
      // Falls THROUGH to the ordinary move/resize machinery below — it already
      // knows this block; the pencil only decided it is allowed to.
    } else {

    const lane = e.target.closest(".pl-lane");
    // Grabbing a window's edge ADJUSTS it instead of painting a new one — the
    // other edge stays anchored, exactly like resizing a block.
    const rszA = e.target.closest('[data-act="avail-rsz"]');
    if (rszA) {
      const w = S.avail.find((x) => x.id === rszA.dataset.id);
      if (!w) return;
      S.drag = {
        availResize: true, id: w.id, dayIdx: w.weekday, edge: rszA.dataset.edge,
        onDate: w.onDate || null,
        startMin: w.startMin, endMin: w.endMin,
        ghost: placeGhost(rszA.closest(".pl-lane")), moved: false,
      };
      S.root.classList.add("is-dragging");
      e.preventDefault();
      availResizeDrag(e.clientX, e.clientY);
      S.drag.moved = false; // grabbing the edge is not yet an adjustment
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
      window.addEventListener("pointercancel", onUp, { once: true });
      return;
    }
    if (!lane) return;
    const { dayIdx, row } = pointToSlot(e.clientX, e.clientY);
    S.drag = { paint: true, dayIdx, row0: Math.min(row, ROWS - 1), ghost: placeGhost(lane), minutes: 60 };
    S.root.classList.add("is-dragging");
    e.preventDefault();
    paintDrag(e.clientX, e.clientY);
    S.drag.moved = false; // preview at press — same rule as the personal sketch
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
    return;
    }
  }

  // Top handle (personal blocks only): the END stays anchored, the START
  // follows the pointer — the mirror image of the bottom handle.
  const rszT = e.target.closest('[data-act="rsz-top"]');
  if (rszT) {
    const s = S.slots.find((x) => x.id === rszT.dataset.id);
    if (!s?.canEdit) return;
    const host = rszT.closest(".pl-lane");
    S.drag = {
      id: s.id, resizeTop: true, free: true,
      dayIdx: +host.dataset.day,
      anchorEndMs: s.end,
      startMs: s.start,
      minutes: Math.round((s.end - s.start) / 60000),
      ghost: placeGhost(host),
      moved: false,
    };
    rszT.closest(".pl-block")?.classList.add("is-dragging");
    S.root.classList.add("is-dragging");
    e.preventDefault();
    updateGhost();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
    return;
  }

  const rsz = e.target.closest('[data-act="rsz"]');
  const chip = e.target.closest('[data-act="pick"]');
  const grab = rsz ? null : e.target.closest('[data-act="grab"]');
  const lane = e.target.closest(".pl-lane");
  if (!rsz && !chip && !lane && !grab) return;
  if (e.target.closest('[data-act="cancel"], [data-act="rec-toggle"], .pl-block__confirm, .pl-mini')) return;

  // RESIZE: the start stays put; only the length follows the pointer,
  // snapping to the three legal durations.
  if (rsz) {
    const s = S.slots.find((x) => x.id === rsz.dataset.id);
    if (!s?.canEdit) return;
    const host = rsz.closest(".pl-lane");
    S.drag = {
      id: s.id, resize: true,
      free: s.kind === "personal", // personal time snaps to ANY half hour
      dayIdx: +host.dataset.day,
      anchorMs: s.start,
      startMs: s.start,
      minutes: Math.round((s.end - s.start) / 60000),
      ghost: placeGhost(host),
      moved: false,
    };
    rsz.closest(".pl-block")?.classList.add("is-dragging");
    S.root.classList.add("is-dragging");
    e.preventDefault();
    updateGhost();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
    return;
  }

  const existing = grab ? S.slots.find((s) => s.id === grab.dataset.id) : null;
  if (grab && !existing?.canEdit) return;

  if (chip) {
    S.source = { kind: "lesson", userId: chip.dataset.uid || null, title: "" };

    // Picking a pupil's chip adopts THEIR default duration — the teacher set it
    // per pupil for a reason, and this is where it pays off.
    if (isAdmin() && S.source.kind === "lesson") {
      const p = S.pupils.find((x) => x.id === S.source.userId);
      if (p) S.minutes = p.minutes;
    }
    chip.classList.add("is-held");
  } else if (!existing) {
    S.source = S.source || {
      kind: "lesson",
      userId: isAdmin() ? S.pupils[0]?.id || null : null,
      title: "",
    };
  }

  const minutes = existing ? Math.round((existing.end - existing.start) / 60000) : S.minutes;
  const host = grab ? grab.closest(".pl-lane") : lane;
  const { dayIdx, row } = chip ? { dayIdx: 0, row: 0 } : pointToSlot(e.clientX, e.clientY);
  const offsetRows = existing ? msToRow(existing.start) - pointToSlot(e.clientX, e.clientY).row : 0;

  S.drag = {
    id: existing?.id || null,
    fromTray: !!chip,
    minutes,
    dayIdx,
    offsetRows,
    startMs: rowToMs(dayIdx, Math.max(0, row + offsetRows)),
    ghost: host ? placeGhost(host) : null,
    moved: false,
  };
  if (existing) grab.classList.add("is-dragging");
  S.root.classList.add("is-dragging");
  e.preventDefault();
  if (host) moveDrag(e.clientX, e.clientY);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
  window.addEventListener("pointercancel", onUp, { once: true });
}

function moveDrag(x, y) {
  const d = S.drag;
  if (!d) return;

  if (d.resizeTop) {
    const { row } = pointToSlot(x, y);
    const endRow = msToRow(d.anchorEndMs);
    // The start may crawl up to the day's first row, and down to half an hour
    // before the anchored end — a block can't be shorter than one snap.
    const r = Math.max(0, Math.min(endRow - 1, row));
    d.startMs = rowToMs(d.dayIdx, r);
    d.minutes = Math.round((d.anchorEndMs - d.startMs) / 60000);
    d.moved = true;
    markBad(d);
    updateGhost();
    return;
  }

  if (d.resize) {
    // Pointer row below the anchor → a candidate length, snapped to the
    // nearest legal duration. Never less than the shortest one.
    const { row } = pointToSlot(x, y);
    const anchorRow = msToRow(d.anchorMs);
    const rawMin = Math.max(SNAP_MIN, (row - anchorRow) * SNAP_MIN);
    // A lesson snaps to the three legal durations; the teacher's own time is
    // free — any half-hour multiple (the DB check in 0060 says the same).
    d.minutes = d.free
      ? rawMin
      : DURATIONS.reduce((best, m) =>
          Math.abs(m - rawMin) < Math.abs(best - rawMin) ? m : best, DURATIONS[0]);
    d.startMs = d.anchorMs;
    d.moved = true;
    markBad(d);
    updateGhost();
    return;
  }

  const { dayIdx, lane, row } = pointToSlot(x, y);
  if (!d.ghost) { d.ghost = placeGhost(lane); d.dayIdx = dayIdx; }
  growIfAtBottom(row + d.minutes / SNAP_MIN - 1);
  const maxRow = ROWS - d.minutes / SNAP_MIN;
  const r = Math.max(0, Math.min(maxRow, row + d.offsetRows));
  const startMs = rowToMs(dayIdx, r);
  if (dayIdx !== d.dayIdx) { lane.appendChild(d.ghost); d.dayIdx = dayIdx; }
  d.startMs = startMs;
  d.moved = true;
  markBad(d);
  updateGhost();
}

/** Nearing the bottom edge grows the timetable one dimmed hour-row, live —
 *  heights are poked directly because a re-render mid-drag would destroy the
 *  ghost under the pointer. */
function growIfAtBottom(row) {
  if (row < S.visH * SLOTS_PER_H - 1 || S.visH >= HOURS) return;
  S.visH++;
  const px = `${S.visH * SLOTS_PER_H * ROW_PX}px`;
  for (const el of S.root.querySelectorAll(".pl-lane")) el.style.height = px;
  const rail = S.root.querySelector(".pl-rail");
  if (rail) rail.style.height = px;
}

function availResizeDrag(x, y) {
  const d = S.drag;
  const { row } = pointToSlot(x, y);
  growIfAtBottom(row);
  const m = DAY_START_H * 60 + Math.max(0, Math.min(ROWS, row)) * SNAP_MIN;
  // The window can never shrink below one hour — the shortest lesson — and
  // never leave the working day. The anchored edge enforces both.
  if (d.edge === "top") d.startMin = Math.min(Math.max(DAY_START_H * 60, m), d.endMin - 60);
  else d.endMin = Math.max(Math.min(DAY_END_H * 60, m), d.startMin + 60);
  d.moved = true;
  const g = d.ghost;
  const rowA = (d.startMin - DAY_START_H * 60) / SNAP_MIN;
  const rowB = (d.endMin - DAY_START_H * 60) / SNAP_MIN;
  const mm = (v) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  g.classList.add("is-paint");
  g.style.transform = `translateY(${rowA * ROW_PX}px)`;
  g.style.height = `${(rowB - rowA) * ROW_PX - 3}px`;
  g.innerHTML = `<b>${esc(DAYS[d.dayIdx])}${d.onDate ? ", doar ziua asta" : ", săptămânal"}</b><span>${mm(d.startMin)}–${mm(d.endMin)}</span>`;
}

function paintDrag(x, y) {
  const d = S.drag;
  const { row } = pointToSlot(x, y);
  growIfAtBottom(row);
  const r = Math.max(0, Math.min(ROWS, row));
  d.rowA = Math.min(d.row0, r);
  d.rowB = Math.max(d.row0 + 1, r);
  // A window shorter than the shortest lesson would be a slot nobody can use.
  // Personal time has no such floor: half an hour of pregătire is real.
  if (!d.paintP && d.rowB - d.rowA < 2) d.rowB = Math.min(ROWS, d.rowA + 2);
  d.startMin = DAY_START_H * 60 + d.rowA * SNAP_MIN;
  d.endMin = DAY_START_H * 60 + d.rowB * SNAP_MIN;
  d.moved = true;
  const g = d.ghost;
  g.classList.add("is-paint");
  g.style.transform = `translateY(${d.rowA * ROW_PX}px)`;
  g.style.height = `${(d.rowB - d.rowA) * ROW_PX - 3}px`;
  const mm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  if (d.paintP) {
    // Sketching MY time: clashes must show while the pointer is still down —
    // the exclusion constraint would refuse them at drop anyway.
    d.bad = collides(rowToMs(d.dayIdx, d.rowA), d.endMin - d.startMin);
    const vac = vacationFor(d.dayIdx);
    g.classList.add("is-personal");
    g.classList.toggle("is-bad", d.bad);
    g.innerHTML = `<b>✎ ${esc(S.personalTitle || "Activitate personală")}${S.paintOnceP ? "" : " · 🔁 săptămânal"}</b><span>${mm(d.startMin)}–${mm(d.endMin)}</span>${d.bad ? "<i>ocupat</i>" : vac ? `<i class="is-vac">🏖 ${esc(vac.label)}</i>` : ""}`;
    return;
  }
  g.innerHTML = `<b>${esc(DAYS[d.dayIdx])}${S.paintOnce ? `, doar ${dayAt(d.dayIdx).getDate()} ${esc(MONTHS[dayAt(d.dayIdx).getMonth()].slice(0, 3))}` : ", săptămânal"}</b><span>${mm(d.startMin)}–${mm(d.endMin)}</span>`;
}

/** The dot that RIDES THE POINTER while a palette drag is live. A fixed clone
 *  on <body>, so no transformed ancestor can hijack its coordinates (the
 *  configurator taught us that one). Born on the FIRST real movement, not on
 *  pointerdown — otherwise a plain click (which opens the dot's settings)
 *  would flash it for a frame. The lane ghost answers WHERE you'd land; this
 *  answers WHAT you're holding. */
function makeFloater(x, y) {
  const p = S.pupils.find((q) => q.id === S.source?.userId);
  const fl = document.createElement("div");
  fl.className = "pl-floater";
  fl.innerHTML = `<i class="pl-floater__dot" style="--c:${esc(p?.color || "#7c3aed")}">${esc(p?.emoji || "")}</i>
    <b class="pl-floater__nm">${esc(p?.name || "Elev")}</b>`;
  fl.style.transform = `translate(${x}px, ${y}px)`;
  document.body.appendChild(fl);
  S.floater = fl;
}

const onMove = (e) => {
  if (!S.drag) return;
  if (S.drag.fromTray && !S.floater) makeFloater(e.clientX, e.clientY);
  if (S.floater) S.floater.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  if (S.drag.availResize) availResizeDrag(e.clientX, e.clientY);
  // BOTH sketches — window and personal block — belong to the paint engine.
  // Routing paintP to moveDrag once sent it into NaN-land: no minutes on the
  // drag, broken clock, and a „collision" toast that was lying about why.
  else if (S.drag.paint || S.drag.paintP) paintDrag(e.clientX, e.clientY);
  else moveDrag(e.clientX, e.clientY);
  e.preventDefault();
};

async function onUp() {
  window.removeEventListener("pointermove", onMove);
  const d = S.drag;
  S.drag = null;
  S.root.classList.remove("is-dragging");
  S.root.querySelector(".pl-block.is-dragging")?.classList.remove("is-dragging");
  S.root.querySelector(".pl-chip.is-held")?.classList.remove("is-held");
  S.floater?.remove();
  S.floater = null;
  d?.ghost?.remove();
  const live = S.root.querySelector('[data-role="live"]');
  if (live) live.hidden = true;
  if (!d) return;

  // A press on a dot that never moved is a CLICK — and a click opens the dot's
  // settings. One object, two gestures, told apart by the flag the drag
  // machinery already keeps for free.
  if (d.fromTray && !d.moved) {
    if (S.source?.userId) S.editPupil = S.editPupil === S.source.userId ? null : S.source.userId;
    render();
    return;
  }
  if (!d.moved) {
    // Third use of the same click-vs-drag flag: in the pencil's personal
    // regime, a motionless press on a grey block opens its inline rename.
    if (d.id && S.paint && S.paintWhat === "personal") {
      const x = S.slots.find((q) => q.id === d.id);
      if (x?.kind === "personal") {
        S.renameId = S.renameId === d.id ? null : d.id;
        render();
        const inp = S.root.querySelector('[data-role="rename"]');
        inp?.focus(); inp?.select();
      }
    } else if (d.paintP || d.paint) {
      showToast("Ca să desenezi, ține apăsat și trage pe verticală.");
    }
    return;
  }

  if (d.availResize) {
    const r = await resizeAvailabilityWindow(d.id, { weekday: d.dayIdx, startMin: d.startMin, endMin: d.endMin, onDate: d.onDate });
    if (!r.ok) { showToast(r.message); return; }
    S.avail = await fetchAvailability();
    showToast("Fereastră ajustată.", { kind: "success" });
    render();
    return;
  }

  // Dropping a personal sketch books it directly — the teacher's own time,
  // any half-hour length, no availability window required.
  if (d.paintP) {
    if (d.bad) { showToast("Nu se poate: intervalul se suprapune cu o rezervare."); return; }
    const startMs = rowToMs(d.dayIdx, d.rowA);
    const minutes = d.endMin - d.startMin;
    const title = S.personalTitle || "";
    const what = title || "Activitate personală";
    // Weekly rhythm plants a real series — the same materialised recurrence
    // as pupils' lessons: N rows, one recurrence_id, vacations skipped, and
    // cancelling one week never touches the others.
    if (!S.paintOnceP) {
      const r = await bookRecurring({ startMs, minutes, kind: "personal", title, weeks: REC_WEEKS, vacations: S.vacations });
      if (!r.ok) showToast(`${r.message || "N-am putut crea seria."}${r.created ? ` (${r.created} deja create)` : ""}`);
      else {
        const parts = [`${r.created} din ${REC_WEEKS} create`];
        if (r.inVacation) parts.push(`${r.inVacation} în vacanță`);
        if (r.clashed) parts.push(`${r.clashed} ocupate`);
        showToast(`Serie săptămânală „${what}": ${parts.join(" · ")}.`, { kind: "success" });
      }
      await refresh();
      return;
    }
    const res = await bookSlot({ startMs, minutes, kind: "personal", title });
    if (!res.ok) { showToast(res.message); await refresh(); return; }
    showToast(`Notat: ${what} — ${DAYS[d.dayIdx]}, ${hhmm(startMs)}–${hhmm(startMs + minutes * 60000)}.`, { kind: "success" });
    await refresh();
    return;
  }

  if (d.paint) {
    const onDate = S.paintOnce ? isoDay(d.dayIdx) : null;
    // Painting inside an interval the SAME scope already covers would merge
    // into… exactly what's there. Silent no-ops teach people the button is
    // broken — say what happened instead.
    const covered = winsFor(d.dayIdx).some((w) =>
      (onDate ? w.onDate === onDate : !w.onDate)
      && w.startMin <= d.startMin && w.endMin >= d.endMin);
    if (covered) {
      showToast("Intervalul era deja deschis — fereastra existentă îl cuprinde. Trage-i de margini ca să o ajustezi.");
      return;
    }
    const r = await saveAvailabilityWindow({ weekday: d.dayIdx, startMin: d.startMin, endMin: d.endMin, onDate });
    if (!r.ok) { showToast(r.message); return; }
    S.avail = await fetchAvailability();
    showToast(onDate
      ? `Fereastră deschisă DOAR pe ${DAYS[d.dayIdx]}, ${dayAt(d.dayIdx).getDate()} ${MONTHS[dayAt(d.dayIdx).getMonth()]}.`
      : `Fereastră deschisă: ${DAYS[d.dayIdx]}, săptămânal.`, { kind: "success" });
    render();
    return;
  }

  if (d.bad) { showToast(`Nu se poate: ${d.badWhy}.`); return; }

  const label = `${DAYS[d.dayIdx]}, ${hhmm(d.startMs)}–${hhmm(d.startMs + d.minutes * 60000)}`;

  if (d.resize || d.resizeTop) {
    const s0 = S.slots.find((x) => x.id === d.id);
    const changed = s0 && (s0.start !== d.startMs || Math.round((s0.end - s0.start) / 60000) !== d.minutes);
    if (!changed) return;
    if (s0.recurrenceId) { openMoveAsk(s0, d, "resize"); return; }
    const res = await moveSlot(d.id, { startMs: d.startMs, minutes: d.minutes });
    showToast(res.ok ? `Durata e acum ${durLabel(d.minutes)} (${label}).` : res.message,
      res.ok ? { kind: "success" } : undefined);
    await refresh();
    return;
  }

  if (d.id) {
    const s0 = S.slots.find((x) => x.id === d.id);
    if (s0 && s0.start === d.startMs && Math.round((s0.end - s0.start) / 60000) === d.minutes) return;
    if (s0?.recurrenceId) { openMoveAsk(s0, d, "move"); return; }
    const res = await moveSlot(d.id, { startMs: d.startMs, minutes: d.minutes });
    showToast(res.ok ? `Mutat: ${label}` : res.message, res.ok ? { kind: "success" } : undefined);
    await refresh();
    return;
  }

  // A dot ALWAYS places ONE lesson — recurrence has a single owner, the 🔁
  // toggle on the block. (The old per-pupil rhythm planted series straight
  // from the drag: two mechanisms, and the drop surprised people.)
  const res = await bookSlot({
    startMs: d.startMs, minutes: d.minutes,
    userId: isAdmin() ? S.source?.userId : null,
  });
  if (!res.ok) { showToast(res.message); await refresh(); return; }
  showToast(`Rezervat: ${label}`, { kind: "success" });
  await refresh();
}

/** A modified SERIES MEMBER asks on the block: one week, or from here on?
 *  Everything the answer needs is snapshotted NOW — a realtime refresh between
 *  the drop and the click must not change what the buttons will do. */
function openMoveAsk(s0, d, gesture) {
  S.moveAsk = {
    id: s0.id, gesture,
    dayIdx: d.dayIdx, startMs: d.startMs, minutes: d.minutes,
    oldStartMs: s0.start, recurrenceId: s0.recurrenceId,
    userId: s0.userId, slotKind: s0.kind,
    title: s0.kind === "personal" ? (s0.name === "Activitate personală" ? "" : s0.name) : "",
  };
  render();
}

// ---------- clicks ----------

async function onClick(e) {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;

  if (act === "prev" || act === "next") {
    const d = new Date(S.week);
    d.setDate(d.getDate() + (act === "next" ? 7 : -7));
    S.week = d; S.loading = true; render(); refresh(); return;
  }
  if (act === "today") { S.week = weekStart(); S.loading = true; render(); refresh(); return; }
  if (act === "dur") { S.minutes = +b.dataset.m; render(); return; }
  if (act === "paint") { S.paint = !S.paint; if (!S.paint) S.renameId = null; render(); return; }
  if (act === "paint-what") { S.paintWhat = b.dataset.v; S.renameId = null; render(); return; }
  if (act === "paint-scope") {
    const once = b.dataset.v === "once";
    if (S.paintWhat === "personal") S.paintOnceP = once; else S.paintOnce = once;
    render(); return;
  }
  if (act === "avail-del") {
    const r = await deleteAvailabilityWindow(b.dataset.id);
    if (!r.ok) { showToast(r.message); return; }
    S.avail = await fetchAvailability();
    showToast("Fereastră închisă.");
    render(); return;
  }

  if (act === "rename-ok") {
    const v = (S.root.querySelector('[data-role="rename"]')?.value || "").trim();
    S.renameId = null;
    const r = await renameSlot(b.dataset.id, v);
    showToast(r.ok ? "Activitate redenumită." : r.message, r.ok ? { kind: "success" } : undefined);
    await refresh(); return;
  }
  if (act === "rename-no") { S.renameId = null; render(); return; }

  // ---- the pupil's two taps ----
  if (act === "pick-slot") {
    const dayIdx = +b.dataset.day, startMs = +b.dataset.at;
    const fits = fitDurations(dayIdx, startMs);
    if (!fits.length) { showToast("Ora tocmai s-a ocupat."); refresh(); return; }
    // Their default duration if it still fits; otherwise the longest that does.
    const minutes = fits.includes(S.minutes) ? S.minutes : fits[fits.length - 1];
    S.pick = { dayIdx, startMs, minutes };
    render(); return;
  }
  if (act === "pick-dur") { if (S.pick) { S.pick.minutes = +b.dataset.m; render(); } return; }
  if (act === "pick-x") { S.pick = null; render(); return; }
  if (act === "pick-book") {
    if (!S.pick) return;
    const { startMs, minutes, dayIdx } = S.pick;
    S.pick = null;
    const r = await bookSlot({ startMs, minutes });
    if (!r.ok) { showToast(r.message); await refresh(); return; }
    showToast(`Rezervat: ${DAYS[dayIdx]}, ${hhmm(startMs)}–${hhmm(startMs + minutes * 60000)}.`, { kind: "success" });
    await refresh(); return;
  }
  if (act === "my-dur") {
    const x = S.slots.find((q) => q.id === b.dataset.id);
    if (!x) return;
    if (Math.round((x.end - x.start) / 60000) === +b.dataset.m) return; // e deja
    // A pupil's tweak makes THIS week an exception; the teacher's series
    // stays intact for the other weeks. Silent — series are teacher tooling.
    const r = await moveSlot(x.id, { startMs: x.start, minutes: +b.dataset.m, detach: !!x.recurrenceId });
    showToast(r.ok ? `Durata e acum ${durLabel(+b.dataset.m)}.` : r.message, r.ok ? { kind: "success" } : undefined);
    await refresh(); return;
  }

  if (act === "ask-no") { S.moveAsk = null; render(); return; }
  if (act === "ask-once") {
    const a = S.moveAsk; S.moveAsk = null;
    if (!a) return;
    const r = await moveSlot(a.id, { startMs: a.startMs, minutes: a.minutes, detach: true });
    showToast(r.ok
      ? "Schimbat doar pentru săptămâna asta — scos din serie; celelalte săptămâni rămân."
      : r.message, r.ok ? { kind: "success" } : undefined);
    await refresh(); return;
  }
  if (act === "ask-forever") {
    const a = S.moveAsk; S.moveAsk = null;
    if (!a) return;
    // Three honest steps: the old series stops at this block, the block moves,
    // the block becomes the head of the continuation. Each failure says
    // exactly where it stopped and what to do next.
    const s1 = await stopSeriesHere({ id: a.id, recurrenceId: a.recurrenceId, startMs: a.oldStartMs });
    if (!s1.ok) { showToast(s1.message); await refresh(); return; }
    const mv = await moveSlot(a.id, { startMs: a.startMs, minutes: a.minutes });
    if (!mv.ok) { showToast(`${mv.message} Seria veche s-a oprit; blocul a rămas pe vechiul interval — trage-l din nou.`); await refresh(); return; }
    const r = await makeRecurring({
      id: a.id, startMs: a.startMs, minutes: a.minutes,
      userId: a.userId, kind: a.slotKind, title: a.title,
      weeks: REC_WEEKS, vacations: S.vacations,
    });
    if (!r.ok) { showToast(`${r.message || "Mutat, dar seria nouă n-a pornit."} Aprinde 🔁 pe bloc ca să reîncerci.`); await refresh(); return; }
    const parts = [`${r.created} din ${REC_WEEKS}`];
    if (r.inVacation) parts.push(`${r.inVacation} în vacanță`);
    if (r.clashed) parts.push(`${r.clashed} ocupate`);
    showToast(`Permanent: seria continuă ${DAYS[a.dayIdx]} la ${hhmm(a.startMs)} — ${parts.join(" · ")}.`, { kind: "success" });
    await refresh(); return;
  }

  // THE 🔁 TOGGLE — one rule, both directions. OFF→ON: this block becomes the
  // head of a weekly series. ON→OFF: recurrence stops HERE — the pressed block
  // stays (alone), everything after it is cancelled, earlier weeks untouched.
  // Pressed by mistake? Press again: the series replants from the same block.
  if (act === "rec-toggle") {
    const s = S.slots.find((x) => x.id === b.dataset.id);
    if (!s) return;
    if (s.recurrenceId) {
      const r = await stopSeriesHere({ id: s.id, recurrenceId: s.recurrenceId, startMs: s.start });
      showToast(r.ok
        ? (r.stopped
          ? `Repetarea s-a oprit aici — blocul rămâne singur, ${r.stopped} de după el anulate.`
          : `Blocul e acum singur — nu era nimic de anulat după el. Aprinde 🔁 din nou ca să pornești alte ${REC_WEEKS} săptămâni de aici.`)
        : r.message, r.ok ? { kind: "success" } : undefined);
      await refresh(); return;
    }
    const r = await makeRecurring({
      id: s.id, startMs: s.start, minutes: Math.round((s.end - s.start) / 60000),
      userId: s.userId, kind: s.kind,
      title: s.kind === "personal" ? (s.name === "Activitate personală" ? "" : s.name) : "",
      weeks: REC_WEEKS, vacations: S.vacations,
    });
    if (!r.ok) { showToast(`${r.message || "N-am putut crea seria."}${r.created > 1 ? ` (${r.created} deja create)` : ""}`); await refresh(); return; }
    const parts = [`${r.created} din ${REC_WEEKS}`];
    if (r.inVacation) parts.push(`${r.inVacation} în vacanță`);
    if (r.clashed) parts.push(`${r.clashed} ocupate`);
    showToast(`De acum se repetă săptămânal: ${parts.join(" · ")}.`, { kind: "success" });
    await refresh(); return;
  }

  // cancel: two taps, in place. The first turns the block into its own confirm
  // dialog — no modal to dismiss, nothing to hunt for, and a recurring block
  // asks the one question that matters: just this one, or the whole series?
  if (act === "cancel") { S.confirmId = b.dataset.id; render(); return; }
  if (act === "conf-no") { S.confirmId = null; render(); return; }
  if (act === "conf-yes") {
    const id = b.dataset.id; S.confirmId = null;
    const r = await cancelSlot(id);
    showToast(r.ok ? "Rezervare anulată." : r.message, r.ok ? { kind: "success" } : undefined);
    refresh(); return;
  }
  if (act === "conf-series") {
    const s = S.slots.find((x) => x.id === b.dataset.id);
    S.confirmId = null;
    if (!s?.recurrenceId) return;
    const r = await cancelSeries(s.recurrenceId);
    showToast(r.ok ? "Toată seria viitoare a fost anulată." : r.message, r.ok ? { kind: "success" } : undefined);
    refresh(); return;
  }

  // pupil chip editor
  if (act === "cfg") { S.editPupil = S.editPupil === b.dataset.uid ? null : b.dataset.uid; render(); return; }
  if (act === "cfg-close") { S.editPupil = null; render(); return; }
  if (act === "cfg-color" || act === "cfg-min") {
    const p = S.pupils.find((x) => x.id === S.editPupil);
    if (!p) return;
    // The name field holds uncommitted text; a re-render would rebuild it from
    // p.name and eat what was typed. Pull it into p.name first.
    const typed = S.root.querySelector('[data-act="cfg-name"]')?.value;
    if (typed !== undefined) p.name = typed.trim() || p.profileName;
    const typedEmoji = S.root.querySelector('[data-act="cfg-emoji"]')?.value;
    if (typedEmoji !== undefined) p.emoji = typedEmoji.trim();
    if (act === "cfg-color") p.color = b.dataset.c;
    else p.minutes = +b.dataset.m;
    render();
    return;
  }
  if (act === "cfg-save") {
    const p = S.pupils.find((x) => x.id === S.editPupil);
    if (!p) return;
    const nameInput = S.root.querySelector('[data-act="cfg-name"]');
    p.name = (nameInput?.value || "").trim() || p.profileName;
    p.emoji = (S.root.querySelector('[data-act="cfg-emoji"]')?.value || "").trim();
    const r = await savePupilPrefs(p.id, { name: p.name === p.profileName ? null : p.name, color: p.color, minutes: p.minutes, emoji: p.emoji, recurring: p.recurring });
    showToast(r.ok ? `Salvat pentru ${p.name}.` : r.message, r.ok ? { kind: "success" } : undefined);
    S.editPupil = null;
    await loadPupils();
    render(); return;
  }

  // vacations
  if (act === "vac-open") { S.vacOpen = true; render(); return; }
  if (act === "vac-close") { S.vacOpen = false; render(); return; }
  if (act === "vac-save") {
    const f = (n) => S.root.querySelector(`[data-f="${n}"]`)?.value || "";
    const from = f("vac-from"), to = f("vac-to");
    if (!from || !to) { showToast("Alege ambele date."); return; }
    if (to < from) { showToast("Sfârșitul e înaintea începutului."); return; }
    const r = await saveVacation({ from, to, label: f("vac-label") });
    if (!r.ok) { showToast(r.message); return; }
    S.vacOpen = false;
    S.vacations = await fetchVacations();
    showToast("Vacanță adăugată.", { kind: "success" });
    render(); return;
  }
  if (act === "vac-del") {
    const r = await deleteVacation(b.dataset.id);
    if (!r.ok) { showToast(r.message); return; }
    S.vacations = await fetchVacations();
    showToast("Vacanță ștearsă.");
    render(); return;
  }
}

function onTypeTitle(e) {
  if (e.target.matches('[data-act="ptitle"]')) {
    // Remembered, not re-rendered — a render here would eat the focus.
    S.personalTitle = e.target.value.trim();
  }
}

/** Hovering a pupil in the dock lights their blocks in the grid and dims the
 *  rest — sixteen pupils, one glance, „aha, Ana e joi". */
function onDockHover(e) {
  const card = e.target.closest("[data-hover-uid]");
  if (!card || S.drag) return;
  const uid = card.dataset.hoverUid;
  for (const b of S.root.querySelectorAll(".pl-block[data-uid]")) {
    b.classList.toggle("is-hilite", b.dataset.uid === uid);
    b.classList.toggle("is-dim", b.dataset.uid !== uid);
  }
}
function onDockLeave(e) {
  if (e.target.closest && !e.target.closest("[data-hover-uid]")) return;
  for (const b of S.root.querySelectorAll(".pl-block")) {
    b.classList.remove("is-hilite", "is-dim");
  }
}

// ---------- wiring ----------

async function refresh() {
  S.slots = await fetchWeek(S.week);
  S.loading = false;
  render();
}

/** One place computes the display colour, so the dock, the blocks and the
 *  editor can never disagree about what colour a pupil is. */
async function loadPupils() {
  const raw = await fetchMarkedPupils();
  const auto = raw.filter((p) => !p.customColor).map((p) => ({ id: p.id, h: hashHue(p.id) }));
  spreadHues(auto);
  const hueById = new Map(auto.map((a) => [a.id, a.h]));
  S.pupils = raw.map((p) => ({
    ...p,
    color: p.customColor || `hsl(${Math.round(hueById.get(p.id))} 62% 40%)`,
  }));
}

/** Mount the planner into `mount`. Returns a teardown.
 *
 *  BOOT RUNS TWICE, and that is the fix for a real bug: the Supabase session
 *  settles AFTER first paint, so at mount time isAdmin() still says false and
 *  the teacher was served the pupil view — no pupil chips, no vacation bar,
 *  or the „pe invitație" lock outright. The rest of the site re-renders on the
 *  `atelier:role` event; the planner now does too. `bootId` discards a slow
 *  first boot that finishes after a newer one started. */
export async function initPlanner(mount) {
  if (!mount) return () => {};
  S.root = mount;
  let disposed = false;
  let bootId = 0;

  // Listeners attach once, up front. They are inert without a grid, and
  // attaching them per-boot would stack duplicates on every role change.
  mount.addEventListener("pointerdown", onDown);
  mount.addEventListener("click", onClick);
  mount.addEventListener("input", onTypeTitle);
  mount.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches('[data-role="rename"]')) {
      e.preventDefault();
      mount.querySelector('[data-act="rename-ok"]')?.click();
    }
  });
  mount.addEventListener("mouseover", onDockHover);
  mount.addEventListener("mouseout", onDockLeave);

  async function boot() {
    const my = ++bootId;
    const stale = () => disposed || my !== bootId;

    if (!isLoggedIn()) {
      mount.innerHTML = `<p class="cx-muted">Intră în cont ca să vezi planificatorul.</p>`;
      return;
    }
    if (!(await hasPlannerAccess())) {
      if (stale()) return;
      mount.innerHTML = `<div class="pl-locked">
          <b>Planificatorul e pe invitație.</b>
          <p class="cx-muted">Profesorul îl deschide elevilor cu care lucrează. Dacă ar trebui să ai acces, scrie-i un mesaj.</p>
        </div>`;
      return;
    }

    if (isAdmin()) {
      await loadPupils();
    } else {
      const prefs = await fetchMyPlannerPrefs();
      S.minutes = prefs.minutes;
      S.myColor = prefs.color;
    }
    S.vacations = await fetchVacations();
    S.avail = await fetchAvailability();
    if (stale()) return;
    S.loading = true;
    render();
    await refresh();
    if (stale()) return;

    S.unwatch?.();
    S.unwatch = watchSlots(() => { if (!S.drag) refresh(); });
  }

  await boot();
  const onRole = () => { if (!disposed) boot(); };
  window.addEventListener("atelier:role", onRole);

  return () => {
    disposed = true;
    S.unwatch?.();
    window.removeEventListener("atelier:role", onRole);
    mount.removeEventListener("pointerdown", onDown);
    mount.removeEventListener("click", onClick);
    mount.removeEventListener("input", onTypeTitle);
    mount.removeEventListener("mouseover", onDockHover);
    mount.removeEventListener("mouseout", onDockLeave);
    window.removeEventListener("pointermove", onMove);
  };
}

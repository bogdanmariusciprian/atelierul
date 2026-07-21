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
  weekStart, fetchWeek, bookSlot, moveSlot, cancelSlot, watchSlots,
  hasPlannerAccess, fetchMarkedPupils, savePupilPrefs, fetchMyPlannerPrefs,
  fetchVacations, saveVacation, deleteVacation, bookRecurring, cancelSeries,
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
const durLabel = (m) => (m === 60 ? "1 oră" : m === 90 ? "1h 30" : "2 ore");

const S = {
  root: null,
  week: weekStart(),
  slots: [],
  pupils: [],          // admin: marked pupils with custom name/colour/minutes
  vacations: [],
  avail: [],           // the teacher's weekly windows — the source of pupil slots
  paint: false,        // admin: painting availability instead of placing blocks
  paintOnce: false,    // admin: the next window is for ONE calendar day only
  pick: null,          // pupil: { dayIdx, startMs, minutes } being confirmed
  minutes: DEFAULT_DURATION,
  myColor: null,       // pupil: colour the teacher picked for them
  source: null,        // tray chip in hand: { kind, userId, title }
  personalTitle: "",
  editPupil: null,     // admin: pupil being customised (opened by CLICKING a dot)
  editPersonal: false, // admin: naming the personal-time dot
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

const dayIndexOf = (ms) => Math.floor((new Date(ms).setHours(0, 0, 0, 0) - S.week.getTime()) / 86400000);

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
  S.avail.filter((w) => (w.onDate ? w.onDate === isoDay(dayIdx) : w.weekday === dayIdx));
const minToMs = (dayIdx, min) => dayAt(dayIdx).getTime() + min * 60000;
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
  return out;
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
  for (const x of S.slots) {
    const endH = Math.ceil((minOf(x.end) || 24 * 60) / 60) - DAY_START_H;
    // A block touching the last visible row reveals the next one, dimmed.
    if (endH >= need) need = Math.min(HOURS, endH + 1);
  }
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
  return `<div class="pl-tools">
      <span class="pl-dur__lab">Durata</span>${durs}
      <button type="button" class="pl-paint${S.paint ? " on" : ""}" data-act="paint"
              title="Pictează ferestrele în care elevii își pot alege ore.">
        🖌 disponibilitate
      </button>
      ${S.paint ? `
        <button type="button" class="pl-dur${S.paintOnce ? "" : " on"}" data-act="paint-scope" data-v="week"
                title="Fereastra pictată se repetă în fiecare săptămână.">în fiecare săptămână</button>
        <button type="button" class="pl-dur${S.paintOnce ? " on" : ""}" data-act="paint-scope" data-v="once"
                title="Fereastra pictată există doar în ziua aleasă — șablonul săptămânal rămâne neatins.">doar ziua aleasă</button>` : ""}
    </div>`;
}

// ---------- the tray ----------

/** THE PALETTE — Marius's own drawing, implemented as drawn: a row of round
 *  colour dots along the top. The dot IS the pupil; the name lives in a hover
 *  tooltip, and an optional emoji sits inside the circle as a second mark of
 *  identity. One object, two gestures: DRAG a dot into the timetable to place
 *  a lesson, CLICK it (press without moving) to open its little editor —
 *  distinguished by the same `moved` flag the drag machinery already keeps.
 *  The grey dashed dot at the end is the teacher's own time. */
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
        data-uid="${esc(p.id)}" data-hover-uid="${esc(p.id)}" data-name="${esc(tip)}${p.recurring ? " · săptămânal" : ""}"
        style="--c:${esc(p.color)}" aria-label="${esc(tip)}">${esc(p.emoji || "")}${
          p.recurring ? `<i class="pl-dot__rec" aria-hidden="true">🔁</i>` : ""}</button>`;
  }).join("");
  return `<div class="pl-palette">
      ${dots}
      <span class="pl-palette__sep" aria-hidden="true"></span>
      <button type="button" class="pl-dot pl-dot--personal" data-act="pick" data-kind="personal"
        data-name="${esc(S.personalTitle || "Activitate personală")} — timpul tău"
        style="--c:#475569" aria-label="Activitate personală">✎</button>
      ${S.editPupil ? pupilEditorHtml() : ""}
      ${S.editPersonal ? `<div class="pl-cfg">
          <label class="pl-cfg__f">Denumirea activității tale
            <input class="pl-cfg__name" data-act="ptitle" maxlength="40"
                   value="${esc(S.personalTitle)}" placeholder="ex. pregătire, consultații" />
          </label>
          <div class="pl-cfg__acts">
            <button type="button" class="btn-mini" data-act="cfg-close">Închide</button>
          </div>
        </div>` : ""}
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
      <div class="pl-cfg__f"><span>Ritm</span>
        <button type="button" class="pl-dur${p.recurring ? " on" : ""}" data-act="cfg-rec">
          ${p.recurring ? "🔁 săptămânal, " + REC_WEEKS + " săpt." : "doar când îl așez"}
        </button>
      </div>
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
      const confirming = S.confirmId === s.id;
      const body = confirming
        ? `<b class="pl-block__who">Anulezi?</b>
           <span class="pl-block__confirm">
             <button type="button" class="pl-mini pl-mini--no" data-act="conf-yes" data-id="${esc(s.id)}">Da</button>
             ${s.recurrenceId && s.canEdit && isAdmin()
               ? `<button type="button" class="pl-mini pl-mini--no" data-act="conf-series" data-id="${esc(s.id)}">Toată seria</button>` : ""}
             <button type="button" class="pl-mini" data-act="conf-no">Nu</button>
           </span>`
        : `<b class="pl-cb__nm">${s.kind === "lesson" && pupilEmoji(s.userId) ? `${esc(pupilEmoji(s.userId))} ` : ""}${esc(slotName(s))}</b>
           ${s.recurrenceId ? `<i class="pl-cb__rec" title="Se repetă săptămânal">🔁</i>` : ""}
           ${s.canEdit && !over ? `<button type="button" class="pl-block__x" data-act="cancel" data-id="${esc(s.id)}" aria-label="Anulează">×</button>` : ""}
           ${s.canEdit && !over ? `<span class="pl-block__rsz" data-act="rsz" data-id="${esc(s.id)}" title="Trage ca să schimbi durata" aria-hidden="true"></span>` : ""}`;
      // A full-colour CELL, straight from Marius's drawing: no text inside — the
      // colour is the identity, and the name arrives on hover, as a tooltip
      // fed by data-name. Screen readers get the same words via aria-label.
      const tip = `${slotName(s)} · ${DAYS[i]} ${hhmm(s.start)}–${hhmm(s.end)}`;
      return `<div class="pl-block pl-block--cell${s.mine ? " is-mine" : ""}${s.canEdit && !over ? " can-edit" : ""}${over ? " is-past" : ""}${s.kind === "personal" ? " is-personal" : ""}${confirming ? " is-confirm" : ""}"
        style="--c:${esc(slotColor(s))}; top:${row * ROW_PX}px; height:${rows * ROW_PX - 3}px"
        data-id="${esc(s.id)}" data-day="${i}" data-uid="${esc(s.userId)}" data-name="${esc(tip)}"
        aria-label="${esc(tip)}" ${s.canEdit && !over && !confirming ? 'data-act="grab"' : ""}>
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
            <i class="pl-avail__tag">${w.onDate ? "doar azi" : "deschis"} ${mm(w.startMin)}–${mm(w.endMin)}</i>
            ${S.paint ? `
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
      ? `<div class="pl-body${S.paint ? " is-paint" : ""}">${gridHtml()}</div>`
      : pupilViewHtml();
  if (isAdmin()) {
    S.root.innerHTML = `
      ${!S.loading ? paletteHtml() : ""}
      ${headerHtml()}
      ${body}
      ${!S.loading ? `<div class="pl-below">
        ${toolsHtml()}
        ${vacationsHtml()}
        <p class="pl-legend">
          <i class="pl-legend__k pl-legend__k--avail"></i> ore deschise elevilor (pictate cu 🖌)
          <i class="pl-legend__k pl-legend__k--personal"></i> timpul tău
          <i class="pl-legend__k pl-legend__k--today"></i> azi
        </p>
        <p class="pl-hint">${S.paint
          ? "Mod disponibilitate: trage pe o coloană ca să deschizi o fereastră săptămânală. Trage de marginile uneia existente ca să o ajustezi; × o închide."
          : "Trage o bulină în orar ca să pui ora. Click pe bulină îi deschide setările. Ține cursorul pe un bloc ca să vezi al cui e."}</p>
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
  if (s.kind === "personal") return s.title || "Activitate personală";
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
  const who = S.drag.id && !resize ? "" : resize ? durLabel(minutes) : sourceLabel();
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

  // Painting availability: a drag on a lane sketches a window for that WEEKDAY.
  if (S.paint) {
    const lane = e.target.closest(".pl-lane");
    if (e.target.closest('[data-act="avail-del"]')) return; // the × is a click

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
  if (e.target.closest('[data-act="cancel"], .pl-block__confirm, .pl-mini')) return;

  // RESIZE: the start stays put; only the length follows the pointer,
  // snapping to the three legal durations.
  if (rsz) {
    const s = S.slots.find((x) => x.id === rsz.dataset.id);
    if (!s?.canEdit) return;
    const host = rsz.closest(".pl-lane");
    S.drag = {
      id: s.id, resize: true,
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
    S.source = {
      kind: chip.dataset.kind || "lesson",
      userId: chip.dataset.uid || null,
      title: chip.dataset.kind === "personal" ? (S.personalTitle || "Activitate personală") : "",
    };

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

  if (d.resize) {
    // Pointer row below the anchor → a candidate length, snapped to the
    // nearest legal duration. Never less than the shortest one.
    const { row } = pointToSlot(x, y);
    const anchorRow = msToRow(d.anchorMs);
    const rawMin = Math.max(SNAP_MIN, (row - anchorRow) * SNAP_MIN);
    const nearest = DURATIONS.reduce((best, m) =>
      Math.abs(m - rawMin) < Math.abs(best - rawMin) ? m : best, DURATIONS[0]);
    d.minutes = nearest;
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
  if (d.rowB - d.rowA < 2) d.rowB = Math.min(ROWS, d.rowA + 2);
  d.startMin = DAY_START_H * 60 + d.rowA * SNAP_MIN;
  d.endMin = DAY_START_H * 60 + d.rowB * SNAP_MIN;
  d.moved = true;
  const g = d.ghost;
  g.classList.add("is-paint");
  g.style.transform = `translateY(${d.rowA * ROW_PX}px)`;
  g.style.height = `${(d.rowB - d.rowA) * ROW_PX - 3}px`;
  const mm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
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
  const personal = S.source?.kind === "personal";
  const fl = document.createElement("div");
  fl.className = "pl-floater";
  fl.innerHTML = `<i class="pl-floater__dot" style="--c:${esc(personal ? "#475569" : p?.color || "#7c3aed")}">${esc(personal ? "✎" : p?.emoji || "")}</i>
    <b class="pl-floater__nm">${esc(personal ? (S.personalTitle || "Activitate personală") : p?.name || "Elev")}</b>`;
  fl.style.transform = `translate(${x}px, ${y}px)`;
  document.body.appendChild(fl);
  S.floater = fl;
}

const onMove = (e) => {
  if (!S.drag) return;
  if (S.drag.fromTray && !S.floater) makeFloater(e.clientX, e.clientY);
  if (S.floater) S.floater.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  if (S.drag.availResize) availResizeDrag(e.clientX, e.clientY);
  else if (S.drag.paint) paintDrag(e.clientX, e.clientY);
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
    if (S.source?.kind === "personal") {
      S.editPersonal = !S.editPersonal; S.editPupil = null;
    } else if (S.source?.userId) {
      S.editPupil = S.editPupil === S.source.userId ? null : S.source.userId;
      S.editPersonal = false;
    }
    render();
    return;
  }
  if (!d.moved) return;

  if (d.availResize) {
    const r = await resizeAvailabilityWindow(d.id, { weekday: d.dayIdx, startMin: d.startMin, endMin: d.endMin, onDate: d.onDate });
    if (!r.ok) { showToast(r.message); return; }
    S.avail = await fetchAvailability();
    showToast("Fereastră ajustată.", { kind: "success" });
    render();
    return;
  }

  if (d.paint) {
    const onDate = S.paintOnce ? isoDay(d.dayIdx) : null;
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

  if (d.resize) {
    const res = await moveSlot(d.id, { startMs: d.startMs, minutes: d.minutes });
    showToast(res.ok ? `Durata e acum ${durLabel(d.minutes)} (${label}).` : res.message,
      res.ok ? { kind: "success" } : undefined);
    await refresh();
    return;
  }

  if (d.id) {
    const res = await moveSlot(d.id, { startMs: d.startMs, minutes: d.minutes });
    showToast(res.ok ? `Mutat: ${label}` : res.message, res.ok ? { kind: "success" } : undefined);
    await refresh();
    return;
  }

  // New block. The rhythm belongs to the PUPIL: if their dot is set to
  // weekly, dropping it plants the whole series; otherwise one lesson.
  const srcPupil = S.pupils.find((x) => x.id === S.source?.userId);
  if (isAdmin() && S.source?.kind === "lesson" && srcPupil?.recurring) {
    const r = await bookRecurring({
      startMs: d.startMs, minutes: d.minutes,
      userId: S.source.userId, weeks: REC_WEEKS, vacations: S.vacations,
    });
    if (!r.ok) showToast(r.message || "N-am putut crea seria.");
    else {
      const parts = [`${r.created} din ${REC_WEEKS} create`];
      if (r.inVacation) parts.push(`${r.inVacation} în vacanță`);
      if (r.clashed) parts.push(`${r.clashed} ocupate`);
      showToast(`Serie săptămânală: ${parts.join(" · ")}.`, { kind: "success" });
    }
    await refresh();
    return;
  }

  const res = await bookSlot({
    startMs: d.startMs, minutes: d.minutes,
    userId: isAdmin() ? S.source?.userId : null,
    kind: S.source?.kind || "lesson",
    title: S.source?.title || "",
  });
  if (!res.ok) { showToast(res.message); await refresh(); return; }
  showToast(`Rezervat: ${label}`, { kind: "success" });
  await refresh();
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
  if (act === "paint") { S.paint = !S.paint; render(); return; }
  if (act === "paint-scope") { S.paintOnce = b.dataset.v === "once"; render(); return; }
  if (act === "avail-del") {
    const r = await deleteAvailabilityWindow(b.dataset.id);
    if (!r.ok) { showToast(r.message); return; }
    S.avail = await fetchAvailability();
    showToast("Fereastră închisă.");
    render(); return;
  }

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
    const r = await moveSlot(x.id, { startMs: x.start, minutes: +b.dataset.m });
    showToast(r.ok ? `Durata e acum ${durLabel(+b.dataset.m)}.` : r.message, r.ok ? { kind: "success" } : undefined);
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
  if (act === "cfg-close") { S.editPupil = null; S.editPersonal = false; render(); return; }
  if (act === "cfg-color" || act === "cfg-min" || act === "cfg-rec") {
    const p = S.pupils.find((x) => x.id === S.editPupil);
    if (!p) return;
    // The name field holds uncommitted text; a re-render would rebuild it from
    // p.name and eat what was typed. Pull it into p.name first.
    const typed = S.root.querySelector('[data-act="cfg-name"]')?.value;
    if (typed !== undefined) p.name = typed.trim() || p.profileName;
    const typedEmoji = S.root.querySelector('[data-act="cfg-emoji"]')?.value;
    if (typedEmoji !== undefined) p.emoji = typedEmoji.trim();
    if (act === "cfg-color") p.color = b.dataset.c;
    else if (act === "cfg-min") p.minutes = +b.dataset.m;
    else p.recurring = !p.recurring;
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
    S.personalTitle = e.target.value.trim();
    // Update the dot's tooltip in place — a re-render would eat the focus.
    const dot = S.root.querySelector(".pl-dot--personal");
    if (dot) dot.dataset.name = `${S.personalTitle || "Activitate personală"} — timpul tău`;
    return;
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

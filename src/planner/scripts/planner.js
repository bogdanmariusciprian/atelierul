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
  minutes: DEFAULT_DURATION,
  myColor: null,       // pupil: colour the teacher picked for them
  source: null,        // tray chip in hand: { kind, userId, title }
  personalTitle: "",
  recurring: false,    // admin: place as a weekly series
  editPupil: null,     // admin: chip being customised (userId)
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

const vacationFor = (i) => {
  const iso = `${dayAt(i).getFullYear()}-${String(dayAt(i).getMonth() + 1).padStart(2, "0")}-${String(dayAt(i).getDate()).padStart(2, "0")}`;
  return S.vacations.find((v) => iso >= v.from && iso <= v.to) || null;
};

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
  const durs = DURATIONS.map((m) => `
    <button type="button" class="pl-dur${S.minutes === m ? " on" : ""}" data-act="dur" data-m="${m}">
      ${esc(durLabel(m))}
    </button>`).join("");
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
      <div class="pl-tools">
        <span class="pl-dur__lab">Durata</span>${durs}
        ${isAdmin() ? `
          <button type="button" class="pl-rec${S.recurring ? " on" : ""}" data-act="rec"
                  title="Blocul așezat se repetă săptămânal, ${REC_WEEKS} săptămâni. Sare peste vacanțe.">
            🔁 săptămânal
          </button>` : ""}
      </div>
    </div>
    ${trayHtml()}
    ${isAdmin() ? vacationsHtml() : ""}`;
}

// ---------- the tray ----------

function trayHtml() {
  const chips = isAdmin()
    ? S.pupils.map((p) => `
        <span class="pl-chipwrap">
          <button type="button" class="pl-chip" data-act="pick" data-kind="lesson"
                  data-uid="${esc(p.id)}" style="--c:${esc(p.color)}">
            <i class="pl-chip__dot"></i>${esc(p.name)}
            <em class="pl-chip__dur">${esc(durLabel(p.minutes))}</em>
          </button>
          <button type="button" class="pl-chip__cfg" data-act="cfg" data-uid="${esc(p.id)}"
                  title="Personalizează: nume, culoare, durată" aria-label="Personalizează ${esc(p.name)}">✎</button>
        </span>`).join("")
      + `<span class="pl-tray__sep" aria-hidden="true"></span>
         <button type="button" class="pl-chip pl-chip--personal" data-act="pick" data-kind="personal" style="--c:#475569">
           <i class="pl-chip__dot"></i>${esc(S.personalTitle || "Activitate personală")}
         </button>
         <input class="pl-tray__name" data-act="ptitle" maxlength="40"
                placeholder="denumește activitatea" value="${esc(S.personalTitle)}" />`
    : `<button type="button" class="pl-chip" data-act="pick" data-kind="lesson"
               data-uid="${esc(CURRENT_USER.authId || "")}" style="--c:${esc(S.myColor || CURRENT_USER.color || "#7c3aed")}">
         <i class="pl-chip__dot"></i>Ora mea
         <em class="pl-chip__dur">${esc(durLabel(S.minutes))}</em>
       </button>`;
  return `<div class="pl-tray">
      <b class="pl-tray__t">${isAdmin() ? "Trage un bloc în calendar" : "Trage-ți ora în ziua care îți convine"}</b>
      <div class="pl-tray__row">${chips}</div>
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

function gridHtml() {
  const today = new Date().setHours(0, 0, 0, 0);
  const now = Date.now();

  const rail = Array.from({ length: HOURS + 1 }, (_, h) =>
    `<span class="pl-hour" style="top:${h * SLOTS_PER_H * ROW_PX}px">${String(DAY_START_H + h).padStart(2, "0")}:00</span>`
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
        : `<b class="pl-block__who">${esc(slotName(s))}${s.recurrenceId ? ` <i class="pl-block__rec" title="Se repetă săptămânal">🔁</i>` : ""}</b>
           <span class="pl-block__when">${esc(DAYS[i])} · ${hhmm(s.start)}–${hhmm(s.end)}</span>
           ${s.canEdit && !over ? `<button type="button" class="pl-block__x" data-act="cancel" data-id="${esc(s.id)}" aria-label="Anulează">×</button>` : ""}
           ${s.canEdit && !over ? `<span class="pl-block__rsz" data-act="rsz" data-id="${esc(s.id)}" title="Trage ca să schimbi durata" aria-hidden="true"></span>` : ""}`;
      return `<div class="pl-block${s.mine ? " is-mine" : ""}${s.canEdit && !over ? " can-edit" : ""}${over ? " is-past" : ""}${s.kind === "personal" ? " is-personal" : ""}${confirming ? " is-confirm" : ""}"
        style="--c:${esc(slotColor(s))}; top:${row * ROW_PX}px; height:${rows * ROW_PX - 3}px"
        data-id="${esc(s.id)}" data-day="${i}" ${s.canEdit && !over && !confirming ? 'data-act="grab"' : ""}>
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
      <div class="pl-lane" data-day="${i}" style="height:${ROWS * ROW_PX}px">
        ${Array.from({ length: HOURS }, (_, h) => `<span class="pl-line" style="top:${h * SLOTS_PER_H * ROW_PX}px"></span>`).join("")}
        ${isToday ? nowLineHtml() : ""}
        ${blocks}
      </div>
    </div>`;
  }).join("");

  return `<div class="pl-grid">
      <div class="pl-rail" style="height:${ROWS * ROW_PX}px">${rail}</div>
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
  S.root.innerHTML = `
    ${headerHtml()}
    <p class="pl-hint">
      ${isAdmin()
        ? "Trage un jeton în coloana zilei. Prinde un bloc ca să-l muți; trage-i marginea de jos ca să-i schimbi durata."
        : `Trage-ți jetonul în ziua care îți convine. Îți poți muta blocul oricând, iar de marginea lui de jos îl scurtezi sau îl lungești.${
            mineCount ? ` Ai ${mineCount} ${mineCount === 1 ? "rezervare" : "rezervări"} săptămâna asta.` : ""}`}
    </p>
    ${S.loading ? `<p class="cx-muted">Se încarcă…</p>` : gridHtml()}
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
  const maxRow = ROWS - d.minutes / SNAP_MIN;
  const r = Math.max(0, Math.min(maxRow, row + d.offsetRows));
  const startMs = rowToMs(dayIdx, r);
  if (dayIdx !== d.dayIdx) { lane.appendChild(d.ghost); d.dayIdx = dayIdx; }
  d.startMs = startMs;
  d.moved = true;
  markBad(d);
  updateGhost();
}

const onMove = (e) => { if (S.drag) { moveDrag(e.clientX, e.clientY); e.preventDefault(); } };

async function onUp() {
  window.removeEventListener("pointermove", onMove);
  const d = S.drag;
  S.drag = null;
  S.root.classList.remove("is-dragging");
  S.root.querySelector(".pl-block.is-dragging")?.classList.remove("is-dragging");
  S.root.querySelector(".pl-chip.is-held")?.classList.remove("is-held");
  d?.ghost?.remove();
  const live = S.root.querySelector('[data-role="live"]');
  if (live) live.hidden = true;
  if (!d || !d.moved) return;

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

  // New block. A weekly series only makes sense for a pupil's lesson.
  if (isAdmin() && S.recurring && S.source?.kind === "lesson") {
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
  if (act === "rec") { S.recurring = !S.recurring; render(); return; }

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
  if (act === "cfg-color") {
    const p = S.pupils.find((x) => x.id === S.editPupil);
    if (p) { p.color = b.dataset.c; render(); }
    return;
  }
  if (act === "cfg-min") {
    const p = S.pupils.find((x) => x.id === S.editPupil);
    if (p) { p.minutes = +b.dataset.m; render(); }
    return;
  }
  if (act === "cfg-save") {
    const p = S.pupils.find((x) => x.id === S.editPupil);
    if (!p) return;
    const nameInput = S.root.querySelector('[data-act="cfg-name"]');
    p.name = (nameInput?.value || "").trim() || p.profileName;
    const r = await savePupilPrefs(p.id, { name: p.name === p.profileName ? null : p.name, color: p.color, minutes: p.minutes });
    showToast(r.ok ? `Salvat pentru ${p.name}.` : r.message, r.ok ? { kind: "success" } : undefined);
    S.editPupil = null;
    S.pupils = await fetchMarkedPupils();
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
  if (!e.target.matches('[data-act="ptitle"]')) return;
  S.personalTitle = e.target.value.trim();
  const chip = S.root.querySelector(".pl-chip--personal");
  if (chip) chip.lastChild.textContent = S.personalTitle || "Activitate personală";
}

// ---------- wiring ----------

async function refresh() {
  S.slots = await fetchWeek(S.week);
  S.loading = false;
  render();
}

/** Mount the planner into `mount`. Returns a teardown. */
export async function initPlanner(mount) {
  if (!mount) return () => {};
  S.root = mount;

  if (!isLoggedIn()) {
    mount.innerHTML = `<p class="cx-muted">Intră în cont ca să vezi planificatorul.</p>`;
    return () => {};
  }
  if (!(await hasPlannerAccess())) {
    mount.innerHTML = `<div class="pl-locked">
        <b>Planificatorul e pe invitație.</b>
        <p class="cx-muted">Profesorul îl deschide elevilor cu care lucrează. Dacă ar trebui să ai acces, scrie-i un mesaj.</p>
      </div>`;
    return () => {};
  }

  if (isAdmin()) {
    S.pupils = await fetchMarkedPupils();
  } else {
    const prefs = await fetchMyPlannerPrefs();
    S.minutes = prefs.minutes;
    S.myColor = prefs.color;
  }
  S.vacations = await fetchVacations();
  render();
  await refresh();

  mount.addEventListener("pointerdown", onDown);
  mount.addEventListener("click", onClick);
  mount.addEventListener("input", onTypeTitle);
  S.unwatch = watchSlots(() => { if (!S.drag) refresh(); });

  return () => {
    S.unwatch?.();
    mount.removeEventListener("pointerdown", onDown);
    mount.removeEventListener("click", onClick);
    mount.removeEventListener("input", onTypeTitle);
    window.removeEventListener("pointermove", onMove);
  };
}

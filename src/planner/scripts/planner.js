// =========================================================
// The tutoring planner — a week of seven days, hours down the side, blocks you
// drag with a mouse or a finger.
//
// THE DAY IS THE POINT. A pupil who cancels Tuesday and wants Saturday must
// never have to work out which column is which: the day is written large above
// every column, today's column is marked, and while a block is being dragged
// its day and hour are shown on the block itself and in a banner. Everything
// else on screen is quieter than that.
//
// DRAGGING uses POINTER events, not the HTML5 drag-and-drop API. Pointer events
// are one code path for mouse, pen and finger; HTML5 drag-and-drop simply does
// not fire on touch, which would have meant no planner on a phone.
//
// CONFLICTS are prevented in three layers, and it takes all three:
//   1. while dragging, a block that would overlap turns red and refuses to drop;
//   2. someone else's booking appears live, through the realtime subscription,
//      so you usually see the clash coming;
//   3. the database refuses overlaps outright, so the race nobody can see —
//      two people pressing in the same millisecond — resolves correctly anyway.
// The first two are courtesy. Only the third is a guarantee.
// Content Romanian, identifiers English.
// =========================================================
import {
  DAY_START_H, DAY_END_H, SNAP_MIN, DURATIONS, DEFAULT_DURATION,
  weekStart, fetchWeek, bookSlot, moveSlot, cancelSlot, watchSlots,
  hasPlannerAccess, fetchMarkedPupils,
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
const ROWS = HOURS * SLOTS_PER_H;         // half-hour rows
const ROW_PX = 26;                         // one half hour on screen

const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const durLabel = (m) => (m === 60 ? "1 oră" : m === 90 ? "1 oră 30" : "2 ore");

const S = {
  root: null,
  week: weekStart(),
  slots: [],
  pupils: [],
  minutes: DEFAULT_DURATION,
  source: null,       // the tray chip picked up: { kind, userId, name, color }
  personalTitle: "",  // what a personal block is called, typed in the tray
  drag: null,         // { id?, dayIdx, startMs, minutes, ghost }
  unwatch: null,
  loading: true,
};

// ---------- geometry ----------

/** The midnight of day `i` of the shown week. */
const dayAt = (i) => {
  const d = new Date(S.week);
  d.setDate(d.getDate() + i);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Row index (0…ROWS) → the exact moment it stands for on day `i`. */
function rowToMs(i, row) {
  const d = dayAt(i);
  d.setHours(DAY_START_H, 0, 0, 0);
  return d.getTime() + row * SNAP_MIN * 60000;
}

/** A moment → which row it sits on, on its own day. */
function msToRow(ms) {
  const d = new Date(ms);
  const base = new Date(d); base.setHours(DAY_START_H, 0, 0, 0);
  return Math.round((d - base) / (SNAP_MIN * 60000));
}

const dayIndexOf = (ms) => Math.floor((new Date(ms).setHours(0, 0, 0, 0) - S.week.getTime()) / 86400000);

/** Would this range collide with an existing booking? `ignoreId` lets a block
 *  be dragged around without colliding with the hole it just left. */
function collides(startMs, minutes, ignoreId = null) {
  const end = startMs + minutes * 60000;
  return S.slots.some((s) => s.id !== ignoreId && startMs < s.end && end > s.start);
}

/** Inside the working day, and not spilling past its end. */
const inHours = (startMs, minutes) => {
  const row = msToRow(startMs);
  return row >= 0 && row + minutes / SNAP_MIN <= ROWS;
};

// ---------- rendering ----------

function headerHtml() {
  const from = dayAt(0), to = dayAt(6);
  const span = from.getMonth() === to.getMonth()
    ? `${from.getDate()}–${to.getDate()} ${MONTHS[to.getMonth()]}`
    : `${from.getDate()} ${MONTHS[from.getMonth()]} – ${to.getDate()} ${MONTHS[to.getMonth()]}`;
  const durs = DURATIONS.map((m) => `
    <button type="button" class="pl-dur${S.minutes === m ? " on" : ""}" data-act="dur" data-m="${m}">
      ${esc(durLabel(m))}
    </button>`).join("");
  return `
    <div class="pl-bar">
      <div class="pl-nav">
        <button type="button" class="pl-navbtn" data-act="prev" aria-label="Săptămâna trecută">‹</button>
        <b class="pl-span">${esc(span)}</b>
        <button type="button" class="pl-navbtn" data-act="next" aria-label="Săptămâna viitoare">›</button>
        <button type="button" class="pl-today" data-act="today">Săptămâna asta</button>
      </div>
      <div class="pl-tools">
        <span class="pl-dur__lab">Durata</span>${durs}
      </div>
    </div>
    ${trayHtml()}`;
}

/** THE TRAY — where blocks come from.
 *  A block is either a lesson with one pupil, or the teacher's own time. Two
 *  different things, so two different things to pick up: the tray makes that
 *  visible instead of hiding it behind a dropdown you have to remember to set.
 *  A pupil sees a single chip — their own — which also makes the gesture
 *  self-explanatory: this is the thing you drag. */
function trayHtml() {
  const chips = isAdmin()
    ? S.pupils.map((p) => `
        <button type="button" class="pl-chip" data-act="pick" data-kind="lesson"
                data-uid="${esc(p.id)}" style="--c:${esc(p.color)}">
          <i class="pl-chip__dot"></i>${esc(p.name)}
        </button>`).join("")
      + `<span class="pl-tray__sep" aria-hidden="true"></span>
         <button type="button" class="pl-chip pl-chip--personal" data-act="pick" data-kind="personal" style="--c:#475569">
           <i class="pl-chip__dot"></i>${esc(S.personalTitle || "Activitate personală")}
         </button>
         <input class="pl-tray__name" data-act="ptitle" maxlength="40"
                placeholder="denumește activitatea" value="${esc(S.personalTitle)}" />`
    : `<button type="button" class="pl-chip" data-act="pick" data-kind="lesson"
               data-uid="${esc(CURRENT_USER.authId || "")}" style="--c:${esc(CURRENT_USER.color || "#7c3aed")}">
         <i class="pl-chip__dot"></i>Ora mea
       </button>`;
  return `<div class="pl-tray">
      <b class="pl-tray__t">${isAdmin() ? "Trage un bloc în calendar" : "Trage-ți ora în ziua care îți convine"}</b>
      <div class="pl-tray__row">${chips}</div>
    </div>`;
}

function gridHtml() {
  const today = new Date().setHours(0, 0, 0, 0);
  const now = Date.now();

  // Hour rail
  const rail = Array.from({ length: HOURS + 1 }, (_, h) =>
    `<span class="pl-hour" style="top:${h * SLOTS_PER_H * ROW_PX}px">${String(DAY_START_H + h).padStart(2, "0")}:00</span>`
  ).join("");

  const cols = DAYS.map((label, i) => {
    const d = dayAt(i);
    const isToday = d.getTime() === today;
    const isPast = d.getTime() < today;
    const blocks = S.slots.filter((s) => dayIndexOf(s.start) === i).map((s) => {
      const row = msToRow(s.start);
      const rows = Math.round((s.end - s.start) / (SNAP_MIN * 60000));
      const over = s.end < now;
      return `<div class="pl-block${s.mine ? " is-mine" : ""}${s.canEdit ? " can-edit" : ""}${over ? " is-past" : ""}${s.kind === "personal" ? " is-personal" : ""}"
        style="--c:${esc(s.color)}; top:${row * ROW_PX}px; height:${rows * ROW_PX - 3}px"
        data-id="${esc(s.id)}" data-day="${i}" ${s.canEdit ? 'data-act="grab"' : ""}>
        <b class="pl-block__who">${esc(s.name)}</b>
        <span class="pl-block__when">${esc(DAYS[i])} · ${hhmm(s.start)}–${hhmm(s.end)}</span>
        ${s.canEdit ? `<button type="button" class="pl-block__x" data-act="cancel" data-id="${esc(s.id)}" aria-label="Anulează">×</button>` : ""}
      </div>`;
    }).join("");

    return `<div class="pl-col${isToday ? " is-today" : ""}${isPast ? " is-past" : ""}" data-day="${i}">
      <div class="pl-colhead">
        <b class="pl-colhead__d">${esc(label)}</b>
        <span class="pl-colhead__n">${d.getDate()} ${esc(MONTHS[d.getMonth()].slice(0, 3))}</span>
        ${isToday ? `<i class="pl-colhead__today">azi</i>` : ""}
      </div>
      <div class="pl-lane" data-day="${i}" style="height:${ROWS * ROW_PX}px">
        ${Array.from({ length: HOURS }, (_, h) => `<span class="pl-line" style="top:${h * SLOTS_PER_H * ROW_PX}px"></span>`).join("")}
        ${blocks}
      </div>
    </div>`;
  }).join("");

  return `<div class="pl-grid">
      <div class="pl-rail" style="height:${ROWS * ROW_PX}px">${rail}</div>
      <div class="pl-cols">${cols}</div>
    </div>`;
}

function render() {
  if (!S.root) return;
  const mineCount = S.slots.filter((s) => s.mine).length;
  S.root.innerHTML = `
    ${headerHtml()}
    <p class="pl-hint">
      ${isAdmin()
        ? "Trage în coloana zilei ca să rezervi pentru elevul ales. Prinde un bloc ca să-l muți."
        : `Trage în coloana zilei ca să-ți rezervi ora. Prinde-ți blocul ca să-l muți în altă zi.${
            mineCount ? ` Ai ${mineCount} ${mineCount === 1 ? "rezervare" : "rezervări"} săptămâna asta.` : ""}`}
    </p>
    ${S.loading ? `<p class="cx-muted">Se încarcă…</p>` : gridHtml()}
    <div class="pl-live" data-role="live" hidden></div>`;
}

// ---------- dragging ----------

/** The floating preview: where the block would land, and — the whole point of
 *  the exercise — WHICH DAY that is, spelled out. */
function updateGhost() {
  const g = S.drag?.ghost;
  if (!g) return;
  const { dayIdx, startMs, minutes, bad } = S.drag;
  g.style.transform = `translateY(${msToRow(startMs) * ROW_PX}px)`;
  g.style.height = `${(minutes / SNAP_MIN) * ROW_PX - 3}px`;
  g.classList.toggle("is-bad", !!bad);
  const who = S.drag.id ? "" : sourceLabel();
  g.innerHTML = `<b>${esc(DAYS[dayIdx])}</b><span>${hhmm(startMs)}–${hhmm(startMs + minutes * 60000)}</span>
    ${who ? `<em>${esc(who)}</em>` : ""}${bad ? `<i>ocupat</i>` : ""}`;
  const live = S.root.querySelector('[data-role="live"]');
  if (live) {
    live.hidden = false;
    live.textContent = bad
      ? `${DAYS[dayIdx]} ${hhmm(startMs)} — ocupat`
      : `${DAYS[dayIdx]}, ${hhmm(startMs)}–${hhmm(startMs + minutes * 60000)}`;
  }
}

/** Whose block is being placed — shown on the ghost, so you never drop the
 *  wrong person's hour into the wrong day and find out afterwards. */
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

/** Turn a pointer position into a day + a snapped start time. */
function pointToSlot(clientX, clientY) {
  const cols = [...S.root.querySelectorAll(".pl-lane")];
  let lane = null, dayIdx = 0;
  for (const c of cols) {
    const r = c.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right) { lane = c; dayIdx = +c.dataset.day; break; }
  }
  if (!lane) { // outside any column — keep the nearest one, don't lose the drag
    const r0 = cols[0].getBoundingClientRect();
    lane = clientX < r0.left ? cols[0] : cols[cols.length - 1];
    dayIdx = +lane.dataset.day;
  }
  const r = lane.getBoundingClientRect();
  const row = Math.max(0, Math.round((clientY - r.top) / ROW_PX));
  return { lane, dayIdx, row };
}

function onDown(e) {
  if (!isLoggedIn()) return;
  const chip = e.target.closest('[data-act="pick"]');
  const grab = e.target.closest('[data-act="grab"]');
  const lane = e.target.closest(".pl-lane");
  if (!chip && !lane && !grab) return;
  if (e.target.closest('[data-act="cancel"]')) return;   // the × is not a handle

  const existing = grab ? S.slots.find((s) => s.id === grab.dataset.id) : null;
  if (grab && !existing?.canEdit) return;

  // Picked up from the tray: remember WHAT is being placed. Everything after
  // this point is the same drag, whether it started on a chip or in the grid.
  if (chip) {
    S.source = {
      kind: chip.dataset.kind || "lesson",
      userId: chip.dataset.uid || null,
      title: chip.dataset.kind === "personal" ? (S.personalTitle || "Activitate personală") : "",
    };
    chip.classList.add("is-held");
  } else if (!existing) {
    // Dragging in empty space still works, using whatever the tray last held —
    // or, for a pupil, simply their own hour.
    S.source = S.source || { kind: "lesson", userId: isAdmin() ? S.pupils[0]?.id || null : null, title: "" };
  }

  const minutes = existing ? Math.round((existing.end - existing.start) / 60000) : S.minutes;
  // A drag that begins on a chip has no lane under it yet; the ghost is born on
  // the first move that reaches the grid.
  const host = grab ? grab.closest(".pl-lane") : lane;
  const { dayIdx, row } = chip ? { dayIdx: 0, row: 0 } : pointToSlot(e.clientX, e.clientY);
  // Grabbing an existing block keeps the offset under the finger, so it doesn't
  // jump so its top edge snaps to the cursor.
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
  const { dayIdx, lane, row } = pointToSlot(x, y);
  const d = S.drag;
  if (!d.ghost) { d.ghost = placeGhost(lane); d.dayIdx = dayIdx; } // came from the tray
  const maxRow = ROWS - d.minutes / SNAP_MIN;
  const r = Math.max(0, Math.min(maxRow, row + d.offsetRows));
  const startMs = rowToMs(dayIdx, r);
  // Moving to another column means the ghost moves house.
  if (dayIdx !== d.dayIdx) { lane.appendChild(d.ghost); d.dayIdx = dayIdx; }
  d.startMs = startMs;
  d.bad = collides(startMs, d.minutes, d.id) || !inHours(startMs, d.minutes);
  d.moved = true;
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

  if (d.bad) { showToast("Intervalul e ocupat sau în afara programului."); return; }

  const label = `${DAYS[d.dayIdx]}, ${hhmm(d.startMs)}–${hhmm(d.startMs + d.minutes * 60000)}`;
  const res = d.id
    ? await moveSlot(d.id, { startMs: d.startMs, minutes: d.minutes })
    : await bookSlot({
        startMs: d.startMs, minutes: d.minutes,
        userId: isAdmin() ? S.source?.userId : null,
        kind: S.source?.kind || "lesson",
        title: S.source?.title || "",
      });

  if (!res.ok) { showToast(res.message); await refresh(); return; }
  showToast(d.id ? `Mutat: ${label}` : `Rezervat: ${label}`, { kind: "success" });
  await refresh();
}

// ---------- wiring ----------

async function refresh() {
  S.slots = await fetchWeek(S.week);
  S.loading = false;
  render();
}

function onClick(e) {
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
  if (act === "cancel") {
    const s = S.slots.find((x) => x.id === b.dataset.id);
    if (!s) return;
    cancelSlot(s.id).then((r) => {
      showToast(r.ok ? "Rezervare anulată." : r.message, r.ok ? { kind: "success" } : undefined);
      refresh();
    });
  }
}

function onTypeTitle(e) {
  if (!e.target.matches('[data-act="ptitle"]')) return;
  S.personalTitle = e.target.value.trim();
  // Only the chip's label needs to follow along; re-rendering the whole panel
  // would take the focus out of the field mid-word.
  const chip = S.root.querySelector(".pl-chip--personal");
  if (chip) chip.lastChild.textContent = S.personalTitle || "Activitate personală";
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

  if (isAdmin()) S.pupils = await fetchMarkedPupils();
  render();
  await refresh();

  mount.addEventListener("pointerdown", onDown);
  mount.addEventListener("click", onClick);
  mount.addEventListener("input", onTypeTitle);
  // Someone else's booking lands on screen without a reload — which is how most
  // collisions are avoided rather than merely handled.
  S.unwatch = watchSlots(() => { if (!S.drag) refresh(); });

  return () => {
    S.unwatch?.();
    mount.removeEventListener("pointerdown", onDown);
    mount.removeEventListener("click", onClick);
    mount.removeEventListener("input", onTypeTitle);
    window.removeEventListener("pointermove", onMove);
  };
}

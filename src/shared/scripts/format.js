// =========================================================
// Small shared formatting helpers: LOCAL calendar days + Romanian plurals.
// Kept dependency-free so anything can import it.
// =========================================================
const pad = (n) => String(n).padStart(2, "0");

/** Local calendar day "YYYY-MM-DD" (NOT UTC). So streaks / "of the day" content
 *  / "finished today" flip at the user's LOCAL midnight — not at 02:00–03:00
 *  (RO summer/winter), which is what `toISOString()` produced. */
export function localDayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole LOCAL days since the epoch — for "content of the day" rotations that
 *  should change at local midnight. */
export function localDayNumber(d = new Date()) {
  const localMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((localMidnight.getTime() - localMidnight.getTimezoneOffset() * 60000) / 86_400_000);
}

/** Romanian plural of a noun for a count:
 *   1 → `one` (membru), 2..19 → `few` (membri), 0/20..99 → "de " + few (de membri).
 *  plural(1,"membru","membri")="membru"; plural(20,…)="de membri". */
export function plural(n, one, few) {
  const t = Math.abs(Math.trunc(n)) % 100;
  if (t === 1) return one;
  if (t >= 2 && t <= 19) return few;
  return `de ${few}`;
}

/** Number + correctly-inflected noun: countNoun(1,"membru","membri")="1 membru",
 *  countNoun(5,…)="5 membri", countNoun(20,…)="20 de membri". */
export function countNoun(n, one, few) {
  return `${n} ${plural(n, one, few)}`;
}

const MONTHS_SHORT = ["ian.", "feb.", "mar.", "apr.", "mai", "iun.", "iul.", "aug.", "sept.", "oct.", "nov.", "dec."];

/** ONE time policy across the site (messages, comments, proposals, approvals…):
 *   • today     → relative ("acum", "acum N min", "acum N ore")
 *   • yesterday → "ieri"
 *   • older     → "D lună, HH:MM"  (ex. "15 iul., 14:30")
 *  Accepts a ms timestamp, a Date, or an ISO string. */
export function timeAgo(ts) {
  const then = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(then.getTime())) return "";
  const now = new Date();
  const min = Math.floor((now - then) / 60000);
  if (min < 1) return "acum";
  if (min < 60) return `acum ${min} min`;
  if (then.toDateString() === now.toDateString()) {
    const h = Math.floor(min / 60);
    return `acum ${h} ${h === 1 ? "oră" : "ore"}`;
  }
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (then.toDateString() === y.toDateString()) return "ieri";
  return `${then.getDate()} ${MONTHS_SHORT[then.getMonth()]}, ${pad(then.getHours())}:${pad(then.getMinutes())}`;
}

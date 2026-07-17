// =========================================================
// Moderation (single source of truth, DRY):
//   1. A profanity filter for everything users type (posts, comments,
//      replies, edits, group names, exercise proposals, profile fields).
//   2. A moderation QUEUE the admin reviews in the dashboard:
//        - "held-post"       → a post kept out of the feed until approved
//        - "blocked-comment" → a comment attempt that was stopped inline
//        - "report"          → content flagged by a member ("Raportează")
//
// IMPORTANT (security): this is a CLIENT-side, UX-level filter. It keeps
// the community friendly but is trivially bypassable via DevTools. Real
// enforcement must be repeated server-side (Supabase) when wired.
// =========================================================
import { relTime } from "./forum-data.js";

// ---------------------------------------------------------
// Normalization — lowercase, strip diacritics, undo common "leet"
// substitutions and collapse repeated letters, so "PuUul@a" → "pula".
// ---------------------------------------------------------
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "€": "e" };

export function normalizeWord(word) {
  return String(word)
    .toLowerCase()
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .replace(/[0134578@$€]/g, (c) => LEET[c] || c)
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1{2,}/g, "$1"); // "puuula" → "pula" (3+ repeats → 1)
}

// ---------------------------------------------------------
// Word list — normalized stems. `exact` avoids false positives on real
// Romanian words (e.g. "muiere", "a muia" are legitimate).
// Matching is per-word: a stem hits only at the START of a word, never
// mid-word (so "scapula", "manipula", "pulover" stay clean).
// ---------------------------------------------------------
const STEMS = [
  // Romanian
  { s: "pula" }, { s: "pule" }, { s: "puli" },
  { s: "pizd" },
  { s: "muie", exact: true }, { s: "muist" },
  { s: "fut", exact: true }, { s: "futu" }, { s: "fute" }, { s: "futa" },
  { s: "fmm", exact: true },
  { s: "coai" },
  { s: "cacat" }, { s: "cacan" },
  { s: "curv" },
  { s: "tarf" },
  { s: "laba", exact: true }, { s: "labagi" },
  { s: "bulangi" },
  { s: "poponar" },
  { s: "gaoz" },
  { s: "handicapat" }, { s: "retardat" }, { s: "dobitoc" }, { s: "tampit" }, { s: "idiot" },
  // English (common online)
  { s: "fuck" }, { s: "shit" }, { s: "bitch" }, { s: "cunt" },
  { s: "dick", exact: true }, { s: "dickhead" },
  { s: "asshole" }, { s: "whore" }, { s: "slut" }, { s: "nigg" },
  { s: "faggot" }, { s: "wtf", exact: true }, { s: "stfu", exact: true },
];

// Custom terms the teacher adds (loaded from Supabase via setCustomProfanity).
// Stored NORMALIZED, matched as word-prefixes like the non-exact stems.
const CUSTOM = new Set();
export function setCustomProfanity(terms) {
  CUSTOM.clear();
  for (const t of terms || []) {
    const n = normalizeWord(typeof t === "string" ? t : t.term || "");
    if (n) CUSTOM.add(n);
  }
}

function stemHits(norm) {
  if (!norm) return false;
  if (STEMS.some(({ s, exact }) => (exact ? norm === s : norm.startsWith(s)))) return true;
  for (const c of CUSTOM) if (norm.startsWith(c)) return true;
  return false;
}

/** Split text into words, merging runs of single letters so spaced-out
 *  evasion ("p u l a") is caught without scanning across real words. */
function tokens(text) {
  const raw = String(text).split(/[^\p{L}\p{N}@$€]+/u).filter(Boolean);
  const out = [];
  let run = "";
  for (const w of raw) {
    if (w.length === 1) {
      run += w;
      continue;
    }
    if (run.length > 1) out.push(run);
    run = "";
    out.push(w);
  }
  if (run.length > 1) out.push(run);
  return out;
}

/** All offending words found in `text` (original spelling, unique). */
export function findProfanity(text) {
  const found = new Set();
  for (const w of tokens(text)) {
    if (stemHits(normalizeWord(w))) found.add(w);
  }
  return [...found];
}

/** True if the text contains vulgar language. */
export function containsProfanity(text) {
  return findProfanity(text).length > 0;
}

/** Mask offending words: "cuvânt" → "c•••••" (defensive display). */
export function censor(text) {
  const bad = findProfanity(text);
  let out = String(text);
  for (const w of bad) {
    const masked = w[0] + "•".repeat(Math.max(1, w.length - 1));
    out = out.split(w).join(masked);
  }
  return out;
}

/** The friendly message shown when something is stopped by the filter. */
export const FILTER_MESSAGE =
  "Textul conține limbaj nepotrivit pentru comunitate. Reformulează, te rog — profesorul a fost anunțat.";

// ---------------------------------------------------------
// Moderation queue (mock, in-memory). The admin dashboard lists open
// items; resolving them removes/keeps content accordingly.
// ---------------------------------------------------------
export const MODERATION_QUEUE = [];

let mseq = 8000;
const mid = () => ++mseq;

function baseItem(kind, fields) {
  return {
    id: mid(),
    kind, // "held-post" | "blocked-comment" | "report"
    createdAt: Date.now(),
    time: relTime(0),
    status: "open", // "open" | "resolved"
    resolution: null, // "approved" | "rejected" | "deleted" | "dismissed"
    ...fields,
  };
}

/** A post kept OUT of the feed until the admin approves it. Stores the
 *  ready-to-publish post object so approval can just insert it. */
export function queueHeldPost(post, matches) {
  const item = baseItem("held-post", {
    authorId: post.authorId,
    name: post.name,
    text: post.text,
    matches,
    post,
    context: "Postare nouă (reținută de filtru)",
  });
  MODERATION_QUEUE.unshift(item);
  return item;
}

/** A comment/reply attempt stopped inline (nothing was published). */
export function queueBlockedComment({ authorId, name, text, context, matches }) {
  const item = baseItem("blocked-comment", { authorId, name, text, matches, context });
  MODERATION_QUEUE.unshift(item);
  return item;
}

/** A member flagged existing content ("Raportează"). */
export function queueReport({ targetType, targetId, authorId, name, snippet, reporterId, reporterName }) {
  // One open report per target is enough — bump the existing one instead.
  const dup = MODERATION_QUEUE.find(
    (i) => i.kind === "report" && i.status === "open" && i.targetType === targetType && i.targetId === targetId
  );
  if (dup) {
    dup.reportCount = (dup.reportCount || 1) + 1;
    return dup;
  }
  const item = baseItem("report", {
    targetType, // "post" | "comment"
    targetId,
    authorId,
    name,
    text: snippet,
    reporterId,
    reporterName,
    reportCount: 1,
    context: targetType === "post" ? "Postare raportată" : "Comentariu raportat",
  });
  MODERATION_QUEUE.unshift(item);
  return item;
}

/** Items still awaiting the admin. */
export function openModerationItems() {
  return MODERATION_QUEUE.filter((i) => i.status === "open");
}

/** Close an item ("approved" | "rejected" | "deleted" | "dismissed"). */
export function resolveModerationItem(id, resolution) {
  const item = MODERATION_QUEUE.find((i) => i.id === id);
  if (!item) return null;
  item.status = "resolved";
  item.resolution = resolution;
  return item;
}

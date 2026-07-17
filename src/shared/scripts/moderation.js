// =========================================================
// Moderation (single source of truth, DRY):
//   1. A profanity filter for everything users type (posts, comments,
//      replies, edits, group names, exercise proposals, profile fields).
//
// The admin-facing moderation QUEUE is now fully server-side: reports live
// in Supabase (`reports`) and profane content is held by the
// `hold_if_profane` trigger — both surfaced in the community dashboard.
//
// IMPORTANT (security): this profanity filter is a CLIENT-side, UX-level
// convenience. It keeps the community friendly but is trivially bypassable
// via DevTools — real enforcement lives server-side (Supabase).
// =========================================================

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

// =========================================================
// Mock "proposed exercises" (no backend yet). Logged-in users can suggest
// an exercise tied to a lesson; the community up-votes them and a teacher
// later approves. Shown both in the community hub ("Exerciții propuse")
// and, per lesson, on each lesson page. Content is Romanian.
// =========================================================
import { userById, initials, avatarColor } from "./community-data.js";
import { relTime, nextId } from "./forum-data.js";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Exercise kinds mirror the lesson engine (data-type): choice, fill, match.
export const EXERCISE_KINDS = [
  { key: "choice", label: "Grilă", hint: "O întrebare cu variante de răspuns" },
  { key: "fill", label: "Completare", hint: "Un enunț cu spații de completat" },
  { key: "match", label: "Potrivire", hint: "Perechi de asociat" },
];

export function exerciseKind(key) {
  return EXERCISE_KINDS.find((k) => k.key === key) || EXERCISE_KINDS[0];
}

function author(id) {
  const u = userById(id) || { name: "Membru" };
  return { authorId: id, name: u.name, initials: initials(u.name), color: avatarColor(id) };
}

function makeExercise({ lessonSlug, lessonTitle, authorId, agoMs, kind, prompt, data = null, status = "pending", votes = 0, decidedAgoMs = null }) {
  const decided = status !== "pending";
  return {
    id: nextId(),
    lessonSlug,
    lessonTitle,
    ...author(authorId),
    createdAt: Date.now() - agoMs,
    time: relTime(agoMs),
    kind,
    prompt,
    // Structured payload that makes the exercise SOLVABLE once approved:
    // choice → {options, correct}; fill → {answer}; match → {pairs}.
    data,
    // "pending" (în așteptare) | "approved" (aprobat, publicat la lecție)
    // | "rejected" (respins). Cele decise pleacă din coadă → istoric admin.
    status,
    votes,
    votedByMe: false,
    // When the admin decided (for the history list); null while pending.
    decidedAt: decided ? Date.now() - (decidedAgoMs ?? 0) : null,
    decidedTime: decided ? relTime(decidedAgoMs ?? 0) : null,
  };
}

// Seed proposals across a few lessons.
export const PROPOSED_EXERCISES = [
  makeExercise({
    lessonSlug: "morfologie-verbul",
    lessonTitle: "Verbul: moduri, timpuri și conjugare",
    authorId: 3,
    agoMs: 2 * HOUR,
    kind: "choice",
    prompt: "„Aș fi mers” este la modul…",
    data: { options: ["indicativ", "conjunctiv", "condițional-optativ", "imperativ"], correct: 2 },
    status: "approved",
    votes: 17,
    decidedAgoMs: 1 * HOUR,
  }),
  makeExercise({
    lessonSlug: "morfologie-verbul",
    lessonTitle: "Verbul: moduri, timpuri și conjugare",
    authorId: 6,
    agoMs: 1 * DAY,
    kind: "fill",
    prompt: "Completează cu forma corectă: „Ei ______ (a veni, conjunctiv prezent) mâine.”",
    data: { answer: "să vină|sa vina" },
    status: "pending",
    votes: 9,
  }),
  makeExercise({
    lessonSlug: "morfologie-substantiv",
    lessonTitle: "Substantivul: cazuri și funcții sintactice",
    authorId: 2,
    agoMs: 6 * HOUR,
    kind: "match",
    prompt: "Potrivește cazul cu întrebarea lui.",
    data: { pairs: [["Nominativ", "cine?"], ["Genitiv", "al cui?"], ["Dativ", "cui?"], ["Acuzativ", "pe cine?"]] },
    status: "pending",
    votes: 12,
  }),
  makeExercise({
    lessonSlug: "vocabular-imbogatire",
    lessonTitle: "Îmbogățirea vocabularului",
    authorId: 20,
    agoMs: 3 * DAY,
    kind: "choice",
    prompt: "Sinonimul potrivit pentru „efemer” este…",
    data: { options: ["trecător", "veșnic", "masiv", "rapid"], correct: 0 },
    status: "approved",
    votes: 21,
    decidedAgoMs: 2 * DAY,
  }),
  makeExercise({
    lessonSlug: "redactare-text-argumentativ",
    lessonTitle: "Textul argumentativ",
    authorId: 13,
    agoMs: 4 * DAY,
    kind: "fill",
    prompt: "Adaugă un conector potrivit: „______, consider că lectura ne dezvoltă empatia.”",
    data: { answer: "în primul rând|așadar|prin urmare|de aceea|în opinia mea" },
    status: "pending",
    votes: 6,
  }),
  makeExercise({
    lessonSlug: "morfologie-adjectivul",
    lessonTitle: "Adjectivul: grade de comparație",
    authorId: 9,
    agoMs: 5 * DAY,
    kind: "choice",
    prompt: "Care e forma greșită? (mai bun / cel mai bun / mai optim / foarte bun)",
    status: "rejected",
    votes: 3,
    decidedAgoMs: 3 * DAY,
  }),
];

/** Still awaiting a teacher's decision (shown to everyone, votable). */
export function pendingExercises() {
  return PROPOSED_EXERCISES.filter((e) => e.status === "pending");
}

/** Already decided (approved or rejected) — the admin's proposal history,
 *  most recently decided first. */
export function resolvedExercises() {
  return PROPOSED_EXERCISES
    .filter((e) => e.status === "approved" || e.status === "rejected")
    .sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0));
}

/** Approved (= published) exercises for one lesson — shown to students. */
export function approvedForLesson(slug) {
  return PROPOSED_EXERCISES.filter((e) => e.lessonSlug === slug && e.status === "approved");
}

/** Pending proposals for one lesson — shown for community voting. */
export function pendingForLesson(slug) {
  return PROPOSED_EXERCISES.filter((e) => e.lessonSlug === slug && e.status === "pending");
}

/** Admin decision on a proposal: "approved" or "rejected". Stamps the time so
 *  it lands in the history, and removes it from the pending queue. */
export function decideExercise(id, decision) {
  const ex = PROPOSED_EXERCISES.find((e) => e.id === id);
  if (!ex || (decision !== "approved" && decision !== "rejected")) return null;
  ex.status = decision;
  ex.decidedAt = Date.now();
  ex.decidedTime = "acum";
  return ex;
}

/** Build a fresh proposal from the composer. */
export function newExercise({ lessonSlug, lessonTitle, authorId, kind, prompt, data = null }) {
  return makeExercise({ lessonSlug, lessonTitle, authorId, agoMs: 0, kind, prompt, data, status: "pending", votes: 0 });
}

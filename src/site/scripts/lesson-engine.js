// =========================================================
// Lesson exercise engine — written once, reused by every lesson (DRY).
// Lessons stay pure HTML: declare exercises with data-* attributes and
// call initLessonExercises() once. Three exercise types:
//
//   data-type="choice"  multiple choice (mark the correct <button>)
//   data-type="fill"    fill-in inputs (each <input data-answer="a|b">)
//   data-type="match"   matching via <select data-answer="value">
//
// Each exercise gives instant feedback (correct / try again).
// =========================================================

/** Normalize text for comparison: lowercase, trim, strip diacritics. */
function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Accepted answers are pipe-separated: "dativ|genitiv". */
function isAccepted(value, accepted) {
  const options = accepted.split("|").map(normalize);
  return options.includes(normalize(value));
}

function setFeedback(exercise, ok, message) {
  const box = exercise.querySelector(".exercise__feedback");
  if (!box) return;
  box.textContent = message;
  box.classList.toggle("is-correct", ok);
  box.classList.toggle("is-wrong", !ok);
  // Let listeners react to a solved exercise (points, streak…) without
  // coupling the engine to any of that.
  if (ok) exercise.dispatchEvent(new CustomEvent("exercise:correct", { bubbles: true }));
}

// --- Multiple choice ---
function initChoice(exercise) {
  const options = exercise.querySelectorAll(".option");
  options.forEach((option) => {
    option.addEventListener("click", () => {
      const correct = option.dataset.correct === "true";
      options.forEach((o) => o.classList.remove("is-correct", "is-wrong"));
      if (correct) {
        option.classList.add("is-correct");
        setFeedback(exercise, true, "Corect!");
      } else {
        option.classList.add("is-wrong");
        // reveal the right one
        exercise
          .querySelector('.option[data-correct="true"]')
          ?.classList.add("is-correct");
        setFeedback(exercise, false, "Nu chiar — răspunsul corect e evidențiat.");
      }
    });
  });
}

// --- Fill in the blank ---
function initFill(exercise) {
  const inputs = exercise.querySelectorAll(".blank");
  const check = exercise.querySelector(".exercise__check");
  check?.addEventListener("click", () => {
    let allOk = true;
    inputs.forEach((input) => {
      const ok = isAccepted(input.value, input.dataset.answer || "");
      input.classList.toggle("is-correct", ok);
      input.classList.toggle("is-wrong", !ok);
      if (!ok) allOk = false;
    });
    setFeedback(
      exercise,
      allOk,
      allOk ? "Corect!" : "Mai verifică spațiile marcate cu roșu."
    );
  });
}

// --- Matching (via selects) ---
function initMatch(exercise) {
  const selects = exercise.querySelectorAll(".match__select");
  const check = exercise.querySelector(".exercise__check");
  check?.addEventListener("click", () => {
    let correct = 0;
    selects.forEach((select) => {
      const ok = normalize(select.value) === normalize(select.dataset.answer || "");
      select.classList.toggle("is-correct", ok);
      select.classList.toggle("is-wrong", !ok);
      if (ok) correct += 1;
    });
    const total = selects.length;
    setFeedback(
      exercise,
      correct === total,
      correct === total
        ? "Corect! Toate potrivirile sunt bune."
        : `${correct} din ${total} corecte. Mai încearcă.`
    );
  });
}

const INITIALIZERS = {
  choice: initChoice,
  fill: initFill,
  match: initMatch,
};

/** Wire every .exercise under `root` (idempotent — safe on re-renders).
 *  Also used by the community section to make APPROVED proposed exercises
 *  actually solvable with the exact same engine (DRY). */
export function initExercisesIn(root = document) {
  root.querySelectorAll(".exercise").forEach((exercise) => {
    if (exercise.dataset.wired) return;
    exercise.dataset.wired = "1";
    // Every exercise shows its author: the lesson's own (hand-written)
    // ones are the professor's; community ones (data-ex-id) carry their
    // proposer's clickable name in the card around them instead.
    if (!exercise.dataset.exId && !exercise.querySelector(".exercise__author")) {
      const tag = document.createElement("span");
      tag.className = "exercise__author";
      tag.title = "Exercițiu creat de profesor";
      tag.textContent = "🎓 Profesor";
      exercise.prepend(tag);
    }
    const init = INITIALIZERS[exercise.dataset.type];
    if (init) init(exercise);
  });
}

/** Wire up every .exercise on the page. Call once after DOM is ready. */
export function initLessonExercises() {
  initExercisesIn(document);
}

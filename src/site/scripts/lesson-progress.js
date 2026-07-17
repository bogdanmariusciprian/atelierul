// =========================================================
// Lesson progress — the missing core loop: LEARNING pays.
//   • "Marchează lecția ca finalizată" (members): +points, streak, the
//     lessons counter grows, a note lands in the personal notebook and
//     the lesson's ring on the Lecții hub fills to 100%. Persistent.
//   • Guests see the same card as a reason to make an account.
//   • The teacher/admin isn't in the game — no card for him.
//   • Selecting text inside the lesson offers "➕ În caiet" (members).
// One call per lesson page: initLessonProgress(basePath).
// =========================================================
import { MY_PROFILE, awardPoints } from "../../shared/scripts/community-data.js";
import { isLoggedIn, isAdmin } from "../../shared/scripts/session.js";
import { supabase } from "../../shared/scripts/supabase-client.js";
import { store } from "../../shared/scripts/store.js";
import { addNote } from "../../shared/scripts/notebook.js";
import { touchStreak } from "../../shared/scripts/streak.js";
import { pointsFx } from "../../shared/scripts/points-fx.js";
import { showToast } from "../../shared/scripts/toast.js";
import { currentLessonSlug, lessonHrefBySlug } from "../../shared/scripts/lessons-index.js";
import { localDayStr } from "../../shared/scripts/format.js";

const DONE_KEY = "atelier_lessons_done"; // { slug: "YYYY-MM-DD" }
export const LESSON_COMPLETE_REWARD = 70;

export function doneLessons() {
  return store.get(DONE_KEY, {});
}
export function isLessonDone(slug) {
  return Boolean(doneLessons()[slug]);
}

export function initLessonProgress(basePath = "") {
  const article = document.querySelector(".lesson");
  if (!article) return;

  const slug = currentLessonSlug();
  if (!slug) return;
  const title = (article.querySelector("h1")?.textContent || document.title).trim();

  // ---------- Completion card ----------
  const mount = document.createElement("section");
  mount.className = "lesson-section lesson-done";
  const nav = article.querySelector(".lesson-nav");
  article.insertBefore(mount, nav || null);

  function render() {
    if (isAdmin()) {
      mount.innerHTML = ""; // the teacher has no progress to track
      return;
    }
    if (!isLoggedIn()) {
      mount.innerHTML = `
        <div class="lesson-done__card">
          <span class="lesson-done__ic" aria-hidden="true">🔓</span>
          <div class="lesson-done__body">
            <b>Ține-ți progresul!</b>
            <p>Cu un cont, marchezi lecțiile finalizate, primești +${LESSON_COMPLETE_REWARD} puncte pe lecție și îți vezi inelele umplându-se.</p>
          </div>
          <a class="btn btn--primary btn--sm" href="${basePath}comunitate/login/">Creează cont</a>
        </div>`;
      return;
    }
    const doneAt = doneLessons()[slug];
    mount.innerHTML = doneAt
      ? `<div class="lesson-done__card lesson-done__card--done">
           <span class="lesson-done__ic" aria-hidden="true">✅</span>
           <div class="lesson-done__body">
             <b>Lecție finalizată</b>
             <p>Bravo! Ai bifat-o pe ${new Date(doneAt + "T12:00").toLocaleDateString("ro-RO")}. E și în caietul tău.</p>
           </div>
         </div>`
      : `<div class="lesson-done__card">
           <span class="lesson-done__ic" aria-hidden="true">🏁</span>
           <div class="lesson-done__body">
             <b>Ai terminat lecția?</b>
             <p>Marcheaz-o ca finalizată: +${LESSON_COMPLETE_REWARD} puncte, streak-ul crește, iar lecția intră în caietul tău.</p>
           </div>
           <button type="button" class="btn btn--primary btn--sm" data-action="lesson-done">✔ Marchează ca finalizată</button>
         </div>`;
  }

  mount.addEventListener("click", (e) => {
    if (!e.target.closest('[data-action="lesson-done"]')) return;
    if (!isLoggedIn() || isAdmin()) return;
    const done = doneLessons();
    if (done[slug]) return; // already counted
    done[slug] = localDayStr();
    store.set(DONE_KEY, done);

    // REAL: record progress + award points server-side (cheat-safe, and
    // idempotent — the RPC ignores a lesson already completed). Feeds the
    // real leaderboard via profiles.points.
    supabase
      .rpc("complete_lesson", { p_slug: slug, p_points: LESSON_COMPLETE_REWARD })
      .then(({ error }) => {
        if (error) console.warn("complete_lesson:", error.message);
      });

    awardPoints(`Lecția «${title}» finalizată`, LESSON_COMPLETE_REWARD);
    pointsFx(LESSON_COMPLETE_REWARD);
    MY_PROFILE.lessons += 1;
    touchStreak();
    addNote({
      title: "Lecție finalizată 🏁",
      text: title,
      lessonHref: lessonHrefBySlug(slug),
    });
    showToast(`🏁 «${title}» finalizată — felicitări!`, { kind: "success" });
    render();
  });

  // ---------- Select text → "➕ În caiet" (members only) ----------
  let bubble = null;
  const removeBubble = () => {
    bubble?.remove();
    bubble = null;
  };

  document.addEventListener("selectionchange", () => {
    if (!isLoggedIn() || isAdmin()) return;
    const sel = document.getSelection();
    const text = sel?.toString().trim();
    // Only selections inside the lesson's own content are noteworthy.
    if (!text || text.length < 8 || !sel.anchorNode || !article.contains(sel.anchorNode)) {
      removeBubble();
      return;
    }
    const range = sel.getRangeAt(0).getBoundingClientRect();
    if (!bubble) {
      bubble = document.createElement("button");
      bubble.type = "button";
      bubble.className = "lesson-clip";
      bubble.textContent = "➕ În caiet";
      // mousedown (not click) — it must win BEFORE the selection collapses.
      bubble.addEventListener("mousedown", (e) => {
        e.preventDefault();
        addNote({
          title: `Din lecția «${title.slice(0, 40)}»`,
          text: text.slice(0, 400),
          lessonHref: lessonHrefBySlug(slug),
        });
        showToast("📓 Adăugat în caietul tău", { kind: "success" });
        removeBubble();
        sel.removeAllRanges();
      });
      document.body.appendChild(bubble);
    }
    bubble.style.left = `${Math.max(8, range.left + range.width / 2)}px`;
    bubble.style.top = `${Math.max(8, range.top - 40)}px`;
  });
  window.addEventListener("scroll", removeBubble, { passive: true });

  window.addEventListener("atelier:role", render);
  render();
}

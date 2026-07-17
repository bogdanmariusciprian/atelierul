// =========================================================
// "Propose an exercise" — per lesson. Logged-in users can suggest an
// exercise tied to this lesson and up-vote others' suggestions; a teacher
// later approves them. Guests see everything but are invited to log in or
// create an account to interact. Shares the SAME real data as the community
// hub's "Exerciții propuse" section (exercises-repo.js → Supabase).
//   • Approved exercises are SOLVABLE here; solving is scored SERVER-side
//     (solve_exercise RPC, cheat-safe, once per pupil).
//   • The teacher approves/edits/rejects/deletes right on the lesson page.
// =========================================================
import {
  EXERCISE_KINDS, exerciseKind, fetchApprovedForLesson, fetchPendingForLesson,
  proposeExercise, voteExercise, approveExercise, rejectExercise,
  updateExercise, deleteExercise, solveExercise,
} from "../../shared/scripts/exercises-repo.js";
import { CURRENT_USER, isLoggedIn, isAdmin } from "../../shared/scripts/session.js";
import { escapeHtml } from "../../shared/scripts/thread.js";
import { findProfanity } from "../../shared/scripts/moderation.js";
import { userById, slugForUser } from "../../shared/scripts/community-data.js";
import { pointsFx } from "../../shared/scripts/points-fx.js";
import { showToast } from "../../shared/scripts/toast.js";
import { exerciseFormFields, readExerciseForm, exerciseSolverHtml, exerciseEditFormHtml, exercisePreviewHtml } from "../../shared/scripts/exercise-form.js";
import { initExercisesIn } from "./lesson-engine.js";
import { touchStreak } from "../../shared/scripts/streak.js";
import { currentLessonSlug } from "../../shared/scripts/lessons-index.js";

export function initProposeExercise(basePath = "") {
  const article = document.querySelector(".lesson");
  if (!article) return;

  const slug = currentLessonSlug();
  if (!slug) return;
  const lessonTitle = (article.querySelector("h1")?.textContent || document.title).trim();

  const mount = document.createElement("section");
  mount.className = "lesson-section propose";
  mount.id = "propose-exercise";
  const nav = article.querySelector(".lesson-nav");
  article.insertBefore(mount, nav || null);

  const state = { open: false, kind: "choice", warn: null, editId: null, editWarn: null, preview: null };
  // Real, per-lesson exercise lists (loaded from Supabase).
  let published = [];
  let pending = [];
  // Reward a solved community exercise only once (per page visit).
  const solvedOnce = new Set();

  // Every exercise wears its author: the professor's tag (inert) or the
  // proposer's CLICKABLE name linking to their community profile.
  const authorLabel = (e) => {
    if (e.isTeacher)
      return `<span class="cx-teacher" title="Profesor · cadru didactic">🎓 Profesor</span>`;
    return userById(e.authorId)
      ? `<a class="cx-userlink" href="${basePath}comunitate/#u/${slugForUser(e.authorId)}" title="Vezi profilul">${escapeHtml(e.name)}</a>`
      : `<span title="Cont șters">${escapeHtml(e.name)}</span>`;
  };

  function exerciseCard(e) {
    const k = exerciseKind(e.kind);
    const published_ = e.status === "approved";
    const voteCol = published_
      ? ""
      : `<div class="propose__vote">
          ${e.authorId === CURRENT_USER.id
            ? `<span class="propose__up propose__up--own" title="Propunerea ta — colegii o votează">—</span>`
            : `<button type="button" class="propose__up${e.votedByMe ? " on" : ""}" data-action="vote" data-id="${e.id}" aria-label="Votează">▲</button>`}
          <b>${e.votes}</b>
        </div>`;
    const tag = published_
      ? `<span class="cx-tag cx-tag--ok">✓ publicat</span>`
      : `<span class="cx-tag cx-tag--wait">în așteptare</span>`;
    const adminBar = isAdmin()
      ? `<div class="propose__admin">
           <button type="button" class="btn-mini" data-action="admin-edit" data-id="${e.id}">✎ Editează</button>
           ${published_ ? "" : `<button type="button" class="btn-mini btn-mini--ok" data-action="admin-approve" data-id="${e.id}">✓ Aprobă</button>
           <button type="button" class="btn-mini btn-mini--no" data-action="admin-reject" data-id="${e.id}">✕ Respinge</button>`}
           <button type="button" class="btn-mini btn-mini--ghost" data-action="admin-del" data-id="${e.id}" title="Șterge propunerea">🗑 Șterge</button>
         </div>`
      : "";

    if (isAdmin() && state.editId === e.id) {
      return `<div class="propose__ex propose__ex--editing">
          <div class="propose__exbody propose__compose">
            ${exerciseEditFormHtml(e)}
            <div class="propose__actions">
              <button type="button" class="btn btn--primary btn--sm" data-action="admin-save-edit" data-id="${e.id}">Salvează modificările</button>
              <button type="button" class="btn-mini btn-mini--ghost" data-action="admin-cancel-edit">Renunță</button>
            </div>
            ${state.editWarn ? `<p class="thr__warn" role="alert">⚠️ ${state.editWarn}</p>` : ""}
          </div>
        </div>`;
    }

    // A PUBLISHED exercise with structured data is fully SOLVABLE — the same
    // engine as the lesson's own exercises.
    // A PENDING one is shown in its FINAL form too (options, blank, pairs) but
    // INERT and greyed out, so you can actually judge/vote on what it will be.
    // The answer is revealed only to the teacher and to the proposal's author.
    const body = published_
      ? exerciseSolverHtml(e) || `<p class="propose__prompt">${escapeHtml(e.prompt)}</p>`
      : `<div class="exprev-wrap is-pending" aria-disabled="true">
           ${exercisePreviewHtml(e, { showAnswer: isAdmin() || e.authorId === CURRENT_USER.id })}
         </div>`;
    const verified = e.verified
      ? `<span class="cx-tag" title="Verificată și ajustată de profesor">✎ verificată</span>`
      : "";
    return `<div class="propose__ex${published_ ? " propose__ex--pub" : ""}">
        ${voteCol}
        <div class="propose__exbody">
          ${body}
          <div class="propose__meta">
            <span class="cx-tag cx-tag--${e.kind}">${k.label}</span>
            ${tag}
            ${verified}
            <span class="propose__by">propus de ${authorLabel(e)} · ${e.time}</span>
          </div>
          ${adminBar}
        </div>
      </div>`;
  }

  function render() {
    renderInner();
    // Wire the freshly rendered solvable exercises (idempotent).
    initExercisesIn(mount);
  }

  /** Fetch this lesson's real exercises, then re-render. */
  async function reload() {
    [published, pending] = await Promise.all([fetchApprovedForLesson(slug), fetchPendingForLesson(slug)]);
    render();
  }

  function renderInner() {
    const logged = isLoggedIn();
    const group = (title, items) =>
      items.length
        ? `<h3 class="propose__subh">${title}</h3><div class="propose__list">${items.map(exerciseCard).join("")}</div>`
        : "";
    const listHtml =
      published.length || pending.length
        ? group("Exerciții publicate", published) + group("Propuneri în așteptare", pending)
        : `<p class="propose__empty">Niciun exercițiu propus încă pentru această lecție. Fii primul!</p>`;

    const kinds = EXERCISE_KINDS.map(
      (k) => `<button type="button" class="cx-kind${state.kind === k.key ? " on" : ""}" data-action="kind" data-key="${k.key}" title="${k.hint}">${k.label}</button>`
    ).join("");

    let action;
    if (!logged) {
      action = `<div class="propose__invite">
          <span>🔒 Conectează-te sau creează-ți cont ca să propui exerciții și să votezi.</span>
          <span class="propose__invite__btns">
            <a class="btn btn--primary btn--sm" href="${basePath}comunitate/login/">Creează cont / Conectează-te</a>
          </span>
        </div>`;
    } else if (state.open) {
      action = `<div class="propose__compose">
          <label class="cx-label">Tipul exercițiului</label>
          <div class="cx-kinds">${kinds}</div>
          <label class="cx-label">Enunțul propus</label>
          <textarea class="cx-input" id="propose-prompt" rows="3" placeholder="Scrie enunțul exercițiului tău pentru «${escapeHtml(lessonTitle)}»…"></textarea>
          ${exerciseFormFields(state.kind, state.preview?.data || null)}
          <div class="propose__actions">
            <button type="button" class="btn btn--primary btn--sm" data-action="submit">Trimite propunerea</button>
            <button type="button" class="btn-mini" data-action="preview">${state.preview ? "Ascunde previzualizarea" : "👁 Previzualizează"}</button>
            <button type="button" class="btn-mini btn-mini--ghost" data-action="toggle">Renunță</button>
          </div>
          ${state.warn ? `<p class="thr__warn" role="alert">⚠️ ${state.warn}</p>` : ""}
          ${state.preview
            ? `<div class="propose__preview">
                 <p class="propose__preview__label">Așa va arăta exercițiul tău (chiar merge — încearcă-l):</p>
                 ${exerciseSolverHtml(state.preview) || `<p class="thr__warn">⚠️ Completează câmpurile ca să vezi previzualizarea.</p>`}
               </div>`
            : ""}
        </div>`;
    } else {
      action = `<button type="button" class="cx-propose" data-action="toggle">+ Propune un exercițiu pentru această lecție</button>`;
    }

    mount.innerHTML = `
      <h2 class="lesson-section__title">Exerciții propuse de comunitate</h2>
      <p class="propose__lead">Ai o idee bună de exercițiu? Propune-l colegilor și votați-le pe cele mai utile.</p>
      ${action}
      ${listHtml}`;
  }

  mount.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const rawId = btn.dataset.id; // exercise ids are Supabase UUIDs

    if (!isLoggedIn()) {
      showToast("Conectează-te ca să propui exerciții și să votezi 🔑");
      return;
    }

    switch (action) {
      case "toggle":
        state.open = !state.open;
        state.preview = null;
        return render();
      case "kind":
        state.kind = btn.dataset.key;
        state.preview = null;
        return render();
      case "preview": {
        if (state.preview) {
          state.preview = null;
          return render();
        }
        const prompt = mount.querySelector("#propose-prompt")?.value.trim() || "";
        const form = readExerciseForm(mount, state.kind);
        state.preview = {
          id: `prev-${Date.now()}`,
          kind: state.kind,
          prompt: prompt || "(enunțul tău)",
          data: form.ok ? form.data : null,
        };
        render();
        const pr = mount.querySelector("#propose-prompt");
        if (pr) pr.value = prompt;
        return;
      }
      case "vote": {
        const ex = pending.find((x) => x.id === rawId);
        // Never your own proposal (same rule as self-like).
        if (ex && ex.authorId !== CURRENT_USER.id) {
          ex.votedByMe = !ex.votedByMe;
          ex.votes += ex.votedByMe ? 1 : -1;
          voteExercise(ex.id, ex.votedByMe); // persist (real)
        }
        return render();
      }

      // ---- admin: edit/decide/delete right on the lesson page ----
      case "admin-edit": {
        if (!isAdmin()) return;
        state.editId = rawId;
        state.editWarn = null;
        state.open = false; // one exf-* form at a time
        return render();
      }
      case "admin-cancel-edit":
        state.editId = null;
        state.editWarn = null;
        return render();
      case "admin-save-edit": {
        if (!isAdmin()) return;
        const ex = [...published, ...pending].find((x) => x.id === rawId);
        if (!ex) return;
        const prompt = mount.querySelector("#exf-prompt")?.value.trim();
        if (!prompt) {
          state.editWarn = "Enunțul nu poate rămâne gol.";
          return render();
        }
        const form = readExerciseForm(mount, ex.kind);
        if (!form.ok) {
          state.editWarn = form.error;
          return render();
        }
        // Store RAW (escaped at render). Persist as the teacher (RLS admin-only).
        updateExercise(rawId, { prompt, data: form.data }).then(reload);
        state.editId = null;
        state.editWarn = null;
        showToast("✎ Propunere actualizată — o poți aproba acum", { kind: "success" });
        return render();
      }
      case "admin-approve":
      case "admin-reject": {
        if (!isAdmin()) return;
        const approved = action === "admin-approve";
        // The SERVER approves + awards the author (cheat-safe). Then reload.
        (approved ? approveExercise(rawId) : rejectExercise(rawId)).then(reload);
        showToast(approved ? "✓ Propunere aprobată — publicată la lecție" : "✕ Propunere respinsă", { kind: approved ? "success" : "info" });
        return;
      }
      case "admin-del": {
        if (!isAdmin()) return;
        deleteExercise(rawId).then(reload); // real delete
        showToast("🗑 Propunere ștearsă");
        return;
      }
      case "submit": {
        const prompt = mount.querySelector("#propose-prompt")?.value.trim();
        if (!prompt) return;
        const bad = findProfanity(prompt);
        if (bad.length) {
          state.warn = "Enunțul conține limbaj nepotrivit. Reformulează, te rog — profesorul a fost anunțat.";
          return render();
        }
        const form = readExerciseForm(mount, state.kind);
        if (!form.ok) {
          state.warn = form.error;
          return render();
        }
        state.warn = null;
        // Store RAW (escaped at render); status forced 'pending' by RLS.
        proposeExercise({ lessonSlug: slug, kind: state.kind, prompt, data: form.data }).then(reload);
        state.open = false;
        touchStreak(); // proposing counts as today's activity
        showToast("✅ Propunere trimisă — profesorul o va verifica.", { kind: "success" });
        return render();
      }
    }
  });

  // Solving a community exercise counts: the SERVER decides correctness +
  // awards points (once, members only). We already know it's correct (the
  // engine fired), so we submit the matching answer to record + score it.
  mount.addEventListener("exercise:correct", (e) => {
    const div = e.target.closest(".exercise");
    const exId = div?.dataset.exId;
    if (!exId || solvedOnce.has(exId)) return;
    solvedOnce.add(exId);
    if (!isLoggedIn() || isAdmin()) return;
    solveExercise(exId, answerFromExercise(div)).then((res) => {
      if (res && res.awarded) { pointsFx(res.awarded); touchStreak(); }
    });
  });

  window.addEventListener("atelier:role", reload);

  reload();
}

// Reconstruct the (correct) answer from the solved exercise's DOM, in the shape
// solve_exercise expects: choice → {choice:"<index>"}, fill → {text}, match →
// {pairs:[[left,right],…]}. The answer is already in the markup (client-side
// solving), so this just formats it for the server's re-check + one-time score.
function answerFromExercise(div) {
  const kind = div?.dataset.type;
  if (kind === "choice") {
    const opts = [...div.querySelectorAll(".option")];
    const idx = opts.findIndex((o) => o.dataset.correct === "true");
    return { choice: String(idx) };
  }
  if (kind === "fill") {
    const ans = div.querySelector(".blank")?.dataset.answer || "";
    return { text: ans.split("|")[0] }; // any accepted variant scores
  }
  if (kind === "match") {
    const pairs = [...div.querySelectorAll(".match__row")].map((row) => {
      const label = (row.childNodes[0]?.textContent || "").trim();
      return [label, row.querySelector(".match__select")?.dataset.answer || ""];
    });
    return { pairs };
  }
  return {};
}

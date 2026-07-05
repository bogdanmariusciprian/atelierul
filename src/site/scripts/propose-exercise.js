// =========================================================
// "Propose an exercise" — per lesson. Logged-in users can suggest an
// exercise tied to this lesson and up-vote others' suggestions; a teacher
// later approves them. Guests see everything but are invited to log in or
// create an account to interact. Shares data with the community hub's
// "Exerciții propuse" section (exercises-data.js). Mock for now.
// =========================================================
import { PROPOSED_EXERCISES, EXERCISE_KINDS, exerciseKind, approvedForLesson, pendingForLesson, newExercise, decideExercise } from "../../shared/scripts/exercises-data.js";
import { CURRENT_USER, isLoggedIn, isAdmin } from "../../shared/scripts/session.js";
import { escapeHtml } from "../../shared/scripts/thread.js";
import { findProfanity, queueBlockedComment } from "../../shared/scripts/moderation.js";
import { awardPoints, userById, slugForUser } from "../../shared/scripts/community-data.js";
import { pointsFx } from "../../shared/scripts/points-fx.js";
import { showToast } from "../../shared/scripts/toast.js";
import { exerciseFormFields, readExerciseForm, exerciseSolverHtml, exerciseEditFormHtml } from "../../shared/scripts/exercise-form.js";
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
  // Place it just before the closing lesson navigation, if present.
  const nav = article.querySelector(".lesson-nav");
  article.insertBefore(mount, nav || null);

  const state = { open: false, kind: "choice", warn: null, editId: null, editWarn: null, preview: null };
  // Reward a solved community exercise only once (per page visit).
  const solvedOnce = new Set();

  // Every exercise wears its author: the professor's tag (inert) or the
  // proposer's CLICKABLE name linking to their community profile.
  const authorLabel = (e) => {
    if (e.authorId === 0)
      return `<span class="cx-teacher" title="Profesor · cadru didactic">🎓 Profesor</span>`;
    return userById(e.authorId)
      ? `<a class="cx-userlink" href="${basePath}comunitate/#u/${slugForUser(e.authorId)}" title="Vezi profilul">${escapeHtml(e.name)}</a>`
      : `<span title="Cont șters">${escapeHtml(e.name)}</span>`;
  };

  function exerciseCard(e) {
    const k = exerciseKind(e.kind);
    const published = e.status === "approved";
    // Published exercises are settled — no more voting; pending ones are
    // votable, but never your own (same rule as self-like).
    const voteCol = published
      ? ""
      : `<div class="propose__vote">
          ${e.authorId === CURRENT_USER.id
            ? `<span class="propose__up propose__up--own" title="Propunerea ta — colegii o votează">—</span>`
            : `<button type="button" class="propose__up${e.votedByMe ? " on" : ""}" data-action="vote" data-id="${e.id}" aria-label="Votează">▲</button>`}
          <b>${e.votes}</b>
        </div>`;
    const tag = published
      ? `<span class="cx-tag cx-tag--ok">✓ publicat</span>`
      : `<span class="cx-tag cx-tag--wait">în așteptare</span>`;
    // Admin decides right here (same flow as the hub — one logic, two doors):
    // EDIT (proposals get checked & polished before approval), then
    // approve/reject pending ones, delete anything (published included).
    const adminBar = isAdmin()
      ? `<div class="propose__admin">
           <button type="button" class="btn-mini" data-action="admin-edit" data-id="${e.id}">✎ Editează</button>
           ${published ? "" : `<button type="button" class="btn-mini btn-mini--ok" data-action="admin-approve" data-id="${e.id}">✓ Aprobă</button>
           <button type="button" class="btn-mini btn-mini--no" data-action="admin-reject" data-id="${e.id}">✕ Respinge</button>`}
           <button type="button" class="btn-mini btn-mini--ghost" data-action="admin-del" data-id="${e.id}" title="Șterge propunerea">🗑 Șterge</button>
         </div>`
      : "";

    // Admin edit mode: the card becomes a prefilled form.
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

    // A PUBLISHED exercise with structured data is fully SOLVABLE — the
    // exact same engine as the lesson's own exercises. Pending (or old,
    // unstructured) proposals stay read-only text.
    const solver = published ? exerciseSolverHtml(e) : null;
    const body = solver || `<p class="propose__prompt">${escapeHtml(e.prompt)}</p>`;
    const verified = e.editedByAdmin
      ? `<span class="cx-tag" title="Verificată și ajustată de profesor">✎ verificată</span>`
      : "";
    return `<div class="propose__ex${published ? " propose__ex--pub" : ""}">
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

  function renderInner() {
    const logged = isLoggedIn();
    const published = approvedForLesson(slug);
    const pending = pendingForLesson(slug);
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
        // Keep the fields (exerciseFormFields prefIlls from state.preview.data).
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
        const id = Number(btn.dataset.id);
        const ex = PROPOSED_EXERCISES.find((x) => x.id === id);
        // Never your own proposal (same rule as self-like).
        if (ex && ex.authorId !== CURRENT_USER.id) {
          ex.votedByMe = !ex.votedByMe;
          ex.votes += ex.votedByMe ? 1 : -1;
        }
        return render();
      }

      // ---- admin: edit/decide/delete right on the lesson page ----
      case "admin-edit": {
        if (!isAdmin()) return;
        state.editId = Number(btn.dataset.id);
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
        const ex = PROPOSED_EXERCISES.find((x) => x.id === Number(btn.dataset.id));
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
        ex.prompt = escapeHtml(prompt);
        ex.data = form.data;
        ex.editedByAdmin = true;
        state.editId = null;
        state.editWarn = null;
        showToast("✎ Propunere actualizată — o poți aproba acum", { kind: "success" });
        return render();
      }
      case "admin-approve":
      case "admin-reject": {
        if (!isAdmin()) return;
        const approved = action === "admin-approve";
        const ex = decideExercise(Number(btn.dataset.id), approved ? "approved" : "rejected");
        // Approval rewards the author (+40) — identical to the hub flow.
        // Exception: the teacher himself never earns points.
        if (ex && approved) {
          const REWARD = 40;
          if (ex.authorId === CURRENT_USER.id) {
            if (!isAdmin()) {
              awardPoints("Exercițiu aprobat — publicat la lecție", REWARD);
              pointsFx(REWARD);
            }
          } else {
            const u = userById(ex.authorId);
            if (u) u.points += REWARD;
          }
        }
        showToast(approved ? "✓ Propunere aprobată — publicată la lecție" : "✕ Propunere respinsă", { kind: approved ? "success" : "info" });
        return render();
      }
      case "admin-del": {
        if (!isAdmin()) return;
        const i = PROPOSED_EXERCISES.findIndex((x) => x.id === Number(btn.dataset.id));
        if (i >= 0) {
          PROPOSED_EXERCISES.splice(i, 1);
          showToast("🗑 Propunere ștearsă");
        }
        return render();
      }
      case "submit": {
        const prompt = mount.querySelector("#propose-prompt")?.value.trim();
        if (!prompt) return;
        // Same language filter as everywhere else; attempts reach the teacher.
        const bad = findProfanity(prompt);
        if (bad.length) {
          state.warn = "Enunțul conține limbaj nepotrivit. Reformulează, te rog — profesorul a fost anunțat.";
          queueBlockedComment({
            authorId: CURRENT_USER.id, name: CURRENT_USER.name, text: prompt, matches: bad,
            context: `Propunere de exercițiu la lecția „${lessonTitle}”`,
          });
          return render();
        }
        // The structured fields make the exercise actually solvable later.
        const form = readExerciseForm(mount, state.kind);
        if (!form.ok) {
          state.warn = form.error;
          return render();
        }
        state.warn = null;
        PROPOSED_EXERCISES.unshift(
          newExercise({
            lessonSlug: slug,
            lessonTitle,
            authorId: CURRENT_USER.id,
            kind: state.kind,
            prompt: escapeHtml(prompt),
            data: form.data,
          })
        );
        state.open = false;
        touchStreak(); // proposing counts as today's activity
        return render();
      }
    }
  });

  // Solving a community exercise counts: small reward + streak (members
  // only, once per exercise per visit). Decoupled via the engine's event.
  mount.addEventListener("exercise:correct", (e) => {
    const id = Number(e.target.closest(".exercise")?.dataset.exId || 0);
    if (!id || solvedOnce.has(id)) return;
    solvedOnce.add(id);
    if (isLoggedIn() && !isAdmin()) {
      awardPoints("Exercițiu din comunitate rezolvat", 5);
      pointsFx(5);
      touchStreak();
    }
  });

  // The demo role switch changes what this section may show (admin tools,
  // composer) — follow it live.
  window.addEventListener("atelier:role", render);

  render();
}

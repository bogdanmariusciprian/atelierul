// =========================================================
// Structured fields for PROPOSING an exercise (single source, DRY —
// used by the lesson-page composer AND the hub's "Exerciții" composer).
// Each kind collects the data the solver needs:
//   choice → 4 options + which is correct
//   fill   → the accepted answer(s), separated by "|"
//   match  → 3 pairs (left → right)
// =========================================================
import { escapeHtml } from "./thread.js";

/** The extra inputs for one kind (below the prompt textarea). Pass an
 *  existing `data` payload to PREFILL the fields (admin editing). */
export function exerciseFormFields(kind, data = null) {
  if (kind === "choice") {
    const options = data?.options || [];
    const correct = data?.correct ?? 0;
    const opt = (i) => `
      <label class="exf__opt">
        <input type="radio" name="exf-correct" value="${i}" ${i === correct ? "checked" : ""} title="Marchează răspunsul corect" />
        <input class="cx-input" id="exf-opt-${i}" value="${escapeHtml(options[i] || "")}" placeholder="Varianta ${i + 1}${i < 2 ? "" : " (opțional)"}" />
      </label>`;
    return `
      <label class="cx-label">Variantele de răspuns <span class="cx-muted">(bifează-l pe cel corect)</span></label>
      ${opt(0)}${opt(1)}${opt(2)}${opt(3)}`;
  }
  if (kind === "fill") {
    // Internally the engine uses "|", but users type the friendlier "/".
    const shown = (data?.answer || "").split("|").join(" / ");
    return `
      <label class="cx-label">Răspunsul corect <span class="cx-muted">(mai multe variante acceptate se despart cu / )</span></label>
      <input class="cx-input" id="exf-answer" value="${escapeHtml(shown)}" placeholder="ex: să vină / vină" />`;
  }
  if (kind === "match") {
    const pairs = data?.pairs || [];
    const pair = (i) => `
      <div class="exf__pair">
        <input class="cx-input" id="exf-l-${i}" value="${escapeHtml(pairs[i]?.[0] || "")}" placeholder="Stânga ${i + 1}" />
        <span aria-hidden="true">→</span>
        <input class="cx-input" id="exf-r-${i}" value="${escapeHtml(pairs[i]?.[1] || "")}" placeholder="Dreapta ${i + 1}" />
      </div>`;
    return `
      <label class="cx-label">Perechile de asociat</label>
      ${pair(0)}${pair(1)}${pair(2)}`;
  }
  return "";
}

/** The whole ADMIN edit block for a proposal: prompt + prefilled fields.
 *  (Students' proposals get checked & polished before approval.) The
 *  caller adds its own Save/Cancel buttons and reads back via
 *  #exf-prompt + readExerciseForm. The kind stays fixed while editing. */
export function exerciseEditFormHtml(e) {
  return `
    <label class="cx-label">Enunțul <span class="cx-muted">(editare ca profesor)</span></label>
    <textarea class="cx-input" id="exf-prompt" rows="3">${escapeHtml(e.prompt)}</textarea>
    ${exerciseFormFields(e.kind, e.data)}`;
}

/** Read + validate the kind's fields. Returns { ok, data } or { ok:false, error }. */
export function readExerciseForm(root, kind) {
  const val = (id) => root.querySelector(`#${id}`)?.value.trim() || "";
  if (kind === "choice") {
    const options = [0, 1, 2, 3].map((i) => val(`exf-opt-${i}`)).filter(Boolean);
    if (options.length < 2) return { ok: false, error: "O grilă are nevoie de cel puțin 2 variante." };
    const picked = Number(root.querySelector('input[name="exf-correct"]:checked')?.value ?? 0);
    // The correct index must point at a non-empty option.
    const correctText = val(`exf-opt-${picked}`);
    if (!correctText) return { ok: false, error: "Bifează o variantă completată drept răspuns corect." };
    return { ok: true, data: { options, correct: options.indexOf(correctText) } };
  }
  if (kind === "fill") {
    // Users separate accepted variants with "/" (or "|"); the engine's
    // internal format is "|" — normalize here, transparently.
    const answer = val("exf-answer")
      .split(/[/|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join("|");
    if (!answer) return { ok: false, error: "Scrie răspunsul corect pentru completare." };
    return { ok: true, data: { answer } };
  }
  if (kind === "match") {
    const pairs = [0, 1, 2]
      .map((i) => [val(`exf-l-${i}`), val(`exf-r-${i}`)])
      .filter(([l, r]) => l && r);
    if (pairs.length < 2) return { ok: false, error: "O potrivire are nevoie de cel puțin 2 perechi complete." };
    return { ok: true, data: { pairs } };
  }
  return { ok: true, data: null };
}

// ---------------------------------------------------------
// Solver markup — the EXACT structure the lesson engine understands
// (.exercise[data-type] + .option/.blank/.match__select), so approved
// community exercises behave identically to the hand-written ones.
// ---------------------------------------------------------
export function exerciseSolverHtml(e) {
  if (!e.data) return null; // old/simple proposal — nothing to solve
  const prompt = `<p class="exercise__prompt">${escapeHtml(e.prompt)}</p>`;
  if (e.kind === "choice") {
    const opts = e.data.options
      .map((o, i) => `<button type="button" class="option" data-correct="${i === e.data.correct}">${escapeHtml(o)}</button>`)
      .join("");
    return `<div class="exercise" data-type="choice" data-ex-id="${e.id}">
        ${prompt}
        <div class="exercise__options">${opts}</div>
        <p class="exercise__feedback"></p>
      </div>`;
  }
  if (e.kind === "fill") {
    return `<div class="exercise" data-type="fill" data-ex-id="${e.id}">
        ${prompt}
        <p><input class="blank" data-answer="${escapeHtml(e.data.answer)}" placeholder="scrie răspunsul…" /></p>
        <button type="button" class="exercise__check btn-mini">Verifică</button>
        <p class="exercise__feedback"></p>
      </div>`;
  }
  if (e.kind === "match") {
    const rights = e.data.pairs.map(([, r]) => r);
    const shuffled = [...rights].sort((a, b) => (a > b ? 1 : -1)); // stable, not random — no reflow surprises
    const rows = e.data.pairs
      .map(
        ([l, r]) => `<label class="match__row">${escapeHtml(l)}
          <select class="match__select" data-answer="${escapeHtml(r)}">
            <option value="">alege…</option>
            ${shuffled.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
          </select>
        </label>`
      )
      .join("");
    return `<div class="exercise" data-type="match" data-ex-id="${e.id}">
        ${prompt}
        <div class="exercise__match">${rows}</div>
        <button type="button" class="exercise__check btn-mini">Verifică</button>
        <p class="exercise__feedback"></p>
      </div>`;
  }
  return null;
}

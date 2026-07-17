// =========================================================
// Lesson „Sintaxa frazei – Introducere” — the page's three interactive parts
// (styles live in src/site/styles/sintaxa-fraza-intro.css, classes `sf-*`):
//   A) WALKTHROUGH — builds the model sentence from SEQ, lists the steps from
//      STEPS, animates each step ONCE and locks „Înainte” until the step's
//      last animation finishes (Web Animations API, no setTimeout chains).
//   B) NOTATION — the starter words are hard-coded (static by design); the
//      "+" pill adds LIVE ones (Supabase, migration 0026): a member PROPOSES
//      (pending), the teacher approves/rejects INLINE, right here; approved
//      words are visible to everyone, guests included.
//   C) STRATEGIES — on the tooltip's first disappearance the card becomes
//      „revealed” and the corner pill re-opens the same tooltip instantly.
// =========================================================
import { CURRENT_USER, isLoggedIn, isAdmin } from "../../shared/scripts/session.js";
import { showToast } from "../../shared/scripts/toast.js";
import { escapeHtml } from "../../shared/scripts/thread.js";
import { findProfanity } from "../../shared/scripts/moderation.js";
import { touchStreak } from "../../shared/scripts/streak.js";
import { fetchNotationWords, addNotationWord, reviewNotationWord } from "../../shared/scripts/notation-repo.js";

export function initFrazaIntro() {
  initWalkthrough();
  initNotation();
  initStrategies();
}

/* ══════════════════════════════════════════════════════════════════════════
   A) WALKTHROUGH
   SEQ = the model sentence, in order. Each element is a "token":
     pred:true              → predicate (gets underlined); parts:[...] = the
                              predicate split in pieces (e.g. „Să”+„ știi”),
                              so a piece can be BOTH circled AND underlined.
     mark:"circle"|"square" → relation word (circle = subordinating, square =
                              coordinating); rel:true = VALID relation.
     cut:"ext"|"int"        → cut on the outside / inside (FALSE relation).
     bar:true, prop, type   → proposition boundary + its number + its kind.
   The "one by one" order comes from CSS variables per element: --d (underline),
   --m (circle/square), --b (bar), --c (cut) — consumed by transition/animation
   delays in the CSS. This avoids a fragile pile of setTimeout calls.
   ══════════════════════════════════════════════════════════════════════════ */
const SEQ = [
  { pred: true, parts: [{ t: "Să", ul: 1, circle: 1, cut: "ext" }, { t: " știi", ul: 1 }] }, // „Să știi” – underlined whole; „Să” is a circle + cut
  { bar: true, prop: 1, type: "PP" },
  { t: "că", mark: "circle", rel: true },
  { pred: true, caps: true, parts: [{ t: "nu-", ul: 1 }, { t: "mi", cl: 1 }, { t: " place", ul: 1 }] },
  { bar: true, prop: 2, type: "PS" },
  { pred: true, caps: true, parts: [{ t: "să", ul: 1, circle: 1 }, { t: " îmi", cl: 1 }, { t: " spui", ul: 1 }] }, // „să…spui” like „nu-mi place”; „îmi” = clitic
  { t: "tu" },
  { bar: true, prop: 3, type: "PS" },
  { t: "ce", mark: "circle", rel: true },
  { t: "trebuie", pred: true },
  { bar: true, prop: 4, type: "PS" },
  { pred: true, parts: [{ t: "să", ul: 1, circle: 1 }, { t: " fac", ul: 1 }] }, // „să fac” – whole
  { bar: true, prop: 5, type: "PS" },
  { t: "când", mark: "circle", rel: true },
  { t: "vreau", pred: true },
  { bar: true, prop: 6, type: "PS" },
  { pred: true, parts: [{ t: "să", ul: 1, circle: 1 }, { t: " vând", ul: 1 }] }, // „să vând” – whole
  { t: "cărți" },
  { t: "și", mark: "square", cut: "ext" },
  { t: "caiete." },
  { bar: true, prop: 7, type: "PS" },
];

const STEPS = [
  { cls: "s-pred", t: "Subliniem predicatele",
    d: "Fiecare predicat = o propoziție. Aici sunt <b>7</b>: știi, place, spui, trebuie, fac, vreau, vând." },
  { cls: "s-math", t: "Facem calculul matematic",
    d: "7 predicate → <b>7 propoziții</b>. Iar rezultatul calculului e numărul de <b>elemente de relație</b>: 7 − 1 = <b>6</b>. Acum știm câte relații să căutăm." },
  { cls: "s-marks", t: "Încercuim / încadrăm elementele de relație",
    d: "<span class='sf-lg-c'></span> <b>cerc</b> = subordonator (că, să, ce, când…)<br><span class='sf-lg-s'></span> <b>pătrat</b> = coordonator (și)." },
  { cls: "s-cut", t: "Verificăm calitatea cercurilor și pătratelor",
    d: "Tăiem (de la stânga-sus spre dreapta-jos) ce nu e relație – aici, tăiere <b>pe exterior</b>: „Să” (ordin) și „și” (leagă părți). Rămân fix <b>6</b> – cât ne-a dat calculul. ✓" },
  { cls: "s-bars", t: "Punem bare",
    d: "O bară oblică (ca un slash) la fiecare cerc/pătrat care <b>nu</b> are tăietură pe exterior – plus una la final. Deocamdată fără numere." },
  { cls: "s-check", t: "Între două bare, o singură linie",
    d: "Clipesc sublinierile și barele: verificăm că între fiecare pereche de bare există fix un predicat (o linie). Totul e curat." },
  { cls: "s-num", t: "Numărăm predicatele la bară",
    d: "Numerotăm barele – dar doar pe cele care au un predicat înaintea lor. Ies <b>7</b>. Deci <b>7 = 7 = 6</b>." },
  { cls: "s-type", t: "Precizăm felul propozițiilor",
    d: "Lângă fiecare număr trecem, în paranteză, felul: prima e <b>(PP)</b>, restul <b>(PS)</b>. Regula: orice propoziție care are cerc este <b>PS</b>." },
];

function initWalkthrough() {
  const walk = document.getElementById("sf-walk");
  const stage = document.getElementById("sf-stage");
  if (!walk || !stage) return;
  const E = (id) => document.getElementById(id);

  // ---- build the sentence from SEQ ----
  let html = "", pIdx = 0, mIdx = 0, bIdx = 0, cIdx = 0;
  for (const it of SEQ) {
    if (it.bar) {
      html += `<span class="bar" style="--b:${bIdx++}"><i></i><span class="labwrap"><span class="lab"><span class="num">${it.prop}</span><span class="type">(${it.type})</span></span></span></span>`;
      continue;
    }
    let c = "tok", vars = "";
    if (it.pred) { c += " pred"; vars += `--d:${pIdx++};`; } // order of the underlines
    if (it.caps) c += " pred-caps"; // clitic predicate → vertical caps at the underline's ends
    if (it.mark === "circle") { c += " circle"; vars += `--m:${mIdx++};`; } // order of the rings
    else if (it.mark === "square") { c += " square"; vars += `--m:${mIdx++};`; }
    if (it.cut) { c += " cut cut-" + it.cut; vars += `--c:${cIdx++};`; } // order of the cuts
    let inner;
    if (it.parts) {
      inner = it.parts.map((p, pi) => {
        let pc = p.ul ? "ul" : "cl", pv = "", extra = "";
        if (p.circle) { pc += " pcirc"; pv += `--m:${mIdx++};`; } // circle on a PIECE of a predicate („Să”, „să”)
        if (p.cut) { pc += " pcut pcut-" + p.cut; pv += `--c:${cIdx++};`; extra += "<i></i>"; }
        if (it.caps && p.circle && pi === 0) extra += "<i class='capL'></i>"; // left vertical cap (the ring occupies ::before)
        return `<span class="${pc}"${pv ? ` style="${pv}"` : ""}>${extra}${p.t}</span>`;
      }).join("");
    } else if (it.pred) inner = `<span class="ul">${it.t}</span>`; // underline just the verb
    else inner = it.t;
    const style = vars ? ` style="${vars}"` : "";
    html += `<span class="${c}"${style}><span class="w">${inner}</span></span>`;
  }
  stage.innerHTML = html;

  // ---- build the steps list ----
  const listEl = E("sf-steps-list");
  STEPS.forEach((s, k) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="n">${k + 1}</span><span class="txt">${s.t}</span>`;
    li.onclick = () => { if (k <= maxReached + 1) go(k); }; // only unlocked steps are clickable
    listEl.appendChild(li);
  });

  let i = -1;          // -1 = initial state: the bare sentence, no markings
  let maxReached = -1; // furthest step reached — for progressive unlocking
  let stepLocked = false; // while a new step's animation runs, no advancing
  let animToken = 0;      // invalidates a stale animation wait if the user navigates meanwhile

  function render(animate) {
    const started = i >= 0;
    // Animate ONLY on a step's first visit; revisiting = instant (no animation).
    stage.className = "sf-stage" + (animate ? "" : " no-anim") + (started ? " " + STEPS.slice(0, i + 1).map((s) => s.cls).join(" ") : "");
    if (started) {
      const s = STEPS[i];
      E("sf-step-num").textContent = i + 1;
      E("sf-step-title").textContent = s.t;
      E("sf-step-desc").innerHTML = s.d;
      E("sf-progress").textContent = `Pasul ${i + 1} / ${STEPS.length}`;
    } else {
      E("sf-step-num").textContent = "0";
      E("sf-step-title").textContent = "Fraza de analizat";
      E("sf-step-desc").innerHTML = "Aceasta e fraza pe care o rezolvăm. Apasă <b>Începe</b> și o luăm pas cu pas.";
      E("sf-progress").textContent = "Start";
    }
    // counters — all three cards appear at step 2 (the math), in cascade
    E("sf-c-pred").classList.toggle("on", i >= 1);
    E("sf-c-prop").classList.toggle("on", i >= 1);
    E("sf-c-rel").classList.toggle("on", i >= 1);
    E("sf-formula").classList.toggle("on", i >= 1);
    E("sf-c-rel").classList.toggle("pulse", i === 1); // pulses on the math step
    walk.classList.toggle("reveal-schema", i >= 7);
    walk.classList.toggle("no-anim", !animate); // revisits: cards/schema don't re-animate
    // steps list state — done / on / locked (not reached yet)
    [...listEl.children].forEach((li, k) => {
      li.classList.toggle("on", k === i);
      li.classList.toggle("done", k < i);
      li.classList.toggle("locked", k > maxReached + 1);
    });
    E("sf-prev").disabled = i < 0;
    E("sf-next").disabled = i === STEPS.length - 1;
    E("sf-next").textContent = i < 0 ? "Începe ›" : (i === STEPS.length - 1 ? "Gata ✓" : "Înainte ›");
  }

  function go(n) {
    n = Math.max(-1, Math.min(STEPS.length - 1, n));
    if (stepLocked && n > i) return; // while the current step animates, no advancing
    const isNew = n > maxReached;
    if (isNew) maxReached = n;
    i = n;
    animToken++; // any navigation ends a previous wait
    stepLocked = false;
    E("sf-next").classList.remove("waiting");
    render(isNew);
    if (isNew) waitForStepAnim(); // new step: lock „Înainte” until its last animation ends
  }

  // Waits for ALL of the new step's animations/transitions, then unlocks.
  // getAnimations() means we never hard-code durations (fragile if the CSS
  // delays change); we wait exactly as long as they run. animToken invalidates
  // a stale wait if the user navigates meanwhile.
  function waitForStepAnim() {
    const token = animToken, nextBtn = E("sf-next");
    stepLocked = true;
    nextBtn.disabled = true;
    nextBtn.classList.add("waiting");
    const unlock = () => {
      if (token !== animToken) return; // a newer navigation took over
      stepLocked = false;
      nextBtn.classList.remove("waiting");
      nextBtn.disabled = (i === STEPS.length - 1);
    };
    if (!walk.getAnimations) { unlock(); return; } // no Web Animations API: no locking
    requestAnimationFrame(() => {
      if (token !== animToken) return;
      const anims = walk.getAnimations({ subtree: true }).filter((a) => {
        const eff = a.effect, tgt = eff && eff.target;
        if (tgt && tgt.closest && tgt.closest("button")) return false; // ignore button hovers
        const t = eff && eff.getComputedTiming ? eff.getComputedTiming() : {};
        return t.iterations !== Infinity && a.playState !== "finished";
      });
      if (!anims.length) { unlock(); return; }
      Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(unlock);
    });
  }

  // Shrinks the sentence's font just enough to fit on one line, measuring the
  // WIDEST state (all markings + bars) — no scroll, no font jumps mid-lesson.
  function fitStage() {
    stage.style.fontSize = "";
    const prev = stage.className;
    stage.className = "sf-stage measuring " + STEPS.map((s) => s.cls).join(" ");
    const need = stage.scrollWidth, avail = stage.clientWidth - 6;
    const base = parseFloat(getComputedStyle(stage).fontSize);
    stage.className = prev;
    if (need > avail) stage.style.fontSize = Math.max(10, (base * avail) / need) + "px";
  }

  E("sf-next").onclick = () => go(i + 1);
  E("sf-prev").onclick = () => go(i - 1);
  // ←/→ navigate the steps — but never while typing (comments, proposals,
  // the notation input…): a caret moving through a textarea must not flip steps.
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t instanceof Element && t.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key === "ArrowRight") go(i + 1);
    if (e.key === "ArrowLeft") go(i - 1);
  });
  window.addEventListener("resize", fitStage);
  window.addEventListener("load", fitStage);
  fitStage();
  render(false);
}

/* ══════════════════════════════════════════════════════════════════════════
   B) NOTATION — live words on top of the hard-coded starters.
   Roles (philosophy: guest is invited, member proposes, teacher decides):
     guest  → "+" invites to log in; sees only APPROVED words;
     member → "+" opens the inline input; Enter proposes (status 'pending',
              forced by RLS) and shows a ⏳ pill only they (and the teacher) see;
     admin  → "+" adds the word directly (born approved); pending pills carry
              ✓/✕ decide buttons; approved dynamic pills carry a discreet ✕
              (withdraw). All decisions happen right here, on the lesson.
   ══════════════════════════════════════════════════════════════════════════ */
function initNotation() {
  const boxes = [...document.querySelectorAll(".sf-words[data-kind]")];
  if (!boxes.length) return;

  /** The words already in a card (starters + live), lowercased — duplicate guard. */
  const wordsIn = (box) =>
    [...box.querySelectorAll(".sf-word:not(.sf-word--add):not(.sf-word-input)")]
      .map((el) => (el.dataset.word || el.textContent).trim().toLocaleLowerCase("ro"));

  async function reloadWords() {
    const words = await fetchNotationWords(); // RLS: approved + mine + all-for-teacher
    for (const box of boxes) {
      box.querySelectorAll("[data-dyn]").forEach((el) => el.remove());
      const addBtn = box.querySelector(".sf-word--add");
      const mine = words.filter((w) => w.kind === box.dataset.kind);
      const pill = (w) => {
        const el = document.createElement("span");
        el.className = "sf-word" + (w.status === "pending" ? " sf-word--pending" : "");
        el.dataset.dyn = "1";
        el.dataset.word = w.word;
        if (w.status === "pending") {
          el.title = w.mine ? "Propunerea ta – în așteptarea aprobării profesorului" : "Propunere în așteptare";
          el.innerHTML = isAdmin()
            ? `${escapeHtml(w.word)}
               <button type="button" class="sf-wbtn sf-wbtn--ok" data-review="approve" data-id="${w.id}" title="Aprobă – devine vizibil tuturor">✓</button>
               <button type="button" class="sf-wbtn sf-wbtn--no" data-review="reject" data-id="${w.id}" title="Respinge">✕</button>`
            : `${escapeHtml(w.word)} <span class="sf-word__wait" aria-hidden="true">⏳</span>`;
        } else {
          el.innerHTML = isAdmin()
            ? `${escapeHtml(w.word)} <button type="button" class="sf-wbtn sf-wbtn--no" data-review="reject" data-id="${w.id}" title="Retrage cuvântul">✕</button>`
            : escapeHtml(w.word);
        }
        return el;
      };
      // approved first (part of the list), pending last (next to the "+")
      for (const w of mine.filter((x) => x.status === "approved")) box.insertBefore(pill(w), addBtn);
      for (const w of mine.filter((x) => x.status === "pending")) box.insertBefore(pill(w), addBtn);
    }
  }

  // The teacher decides inline (RLS re-checks admin on the server).
  document.querySelector(".sf-legend")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-review]");
    if (!btn || !isAdmin()) return;
    const approve = btn.dataset.review === "approve";
    const ok = await reviewNotationWord(btn.dataset.id, approve);
    if (ok) showToast(approve ? "✓ Cuvânt aprobat – acum îl vede toată lumea" : "✕ Cuvânt respins", { kind: approve ? "success" : "info" });
    reloadWords();
  });

  // The "+" pill → inline input; Enter adds and re-opens for one more, Esc/empty closes.
  for (const box of boxes) {
    const addBtn = box.querySelector(".sf-word--add");
    if (!addBtn) continue;
    const kind = box.dataset.kind;

    const openInput = () => {
      if (!isLoggedIn()) { showToast("Conectează-te ca să propui cuvinte noi 🔑"); return; }
      if (box.querySelector(".sf-word-input")) return; // already open
      const inp = document.createElement("input");
      inp.className = "sf-word sf-word-input";
      inp.maxLength = 24;
      inp.setAttribute("aria-label", "Cuvânt nou");
      box.insertBefore(inp, addBtn);
      inp.focus();

      const commit = async (save) => {
        if (!inp.isConnected) return;
        const v = inp.value.trim().toLocaleLowerCase("ro");
        inp.remove();
        if (!save || !v) return;
        const bad = findProfanity(v);
        if (bad.length) {
          showToast("⚠️ Cuvânt nepotrivit – profesorul a fost anunțat.");
          return;
        }
        if (wordsIn(box).includes(v)) { showToast(`„${v}” este deja în listă.`); return; }
        const res = await addNotationWord(kind, v);
        if (res.ok) {
          if (isAdmin()) showToast(`✓ „${v}” adăugat – vizibil pentru toată lumea`, { kind: "success" });
          else { showToast(`✅ „${v}” trimis – profesorul îl va aproba.`, { kind: "success" }); touchStreak(); }
          reloadWords();
        } else if (res.duplicate) showToast(`„${v}” există deja sau e deja propus.`);
        else showToast("Nu s-a putut trimite – încearcă din nou.");
      };

      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); const again = !!inp.value.trim(); commit(true); if (again) openInput(); }
        else if (e.key === "Escape") { e.preventDefault(); commit(false); }
      });
      inp.addEventListener("blur", () => commit(true));
    };

    addBtn.addEventListener("click", openInput);
    addBtn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openInput(); } });
  }

  window.addEventListener("atelier:role", reloadWords); // login/logout → re-fetch what I may see
  reloadWords();
}

/* ══════════════════════════════════════════════════════════════════════════
   C) STRATEGIES — first time, the tooltip opens after a 2s hover (CSS). Once
   it has fully SHOWN and then DISAPPEARED, the card becomes „revealed”: the
   faded corner pill appears and re-opens the same tooltip instantly.
   ══════════════════════════════════════════════════════════════════════════ */
function initStrategies() {
  document.querySelectorAll(".sf-strat").forEach((card) => {
    const tip = card.querySelector(".sf-strat-tip");
    if (!tip) return;
    let shown = false; // the tooltip has been fully shown at least once
    tip.addEventListener("transitionend", (e) => {
      if (e.propertyName !== "opacity") return;
      if (parseFloat(getComputedStyle(tip).opacity) > 0.5) shown = true; // fully shown
      else if (shown) card.classList.add("revealed"); // first disappearance → the pill appears
    });
  });
}

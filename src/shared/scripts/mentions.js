// =========================================================
// @mentions (single source of truth, DRY). Typing "@" in a post/comment
// box opens an autocomplete with the CURRENT USER'S FRIENDS only. A friend
// who couldn't SEE that content (wrong audience / not a group member) is
// shown disabled, with the reason — and publishing is validated again, so
// nobody can be mentioned into a conversation they have no access to.
//
//   initMentions(root, resolveEligibility) — autocomplete on textareas
//     resolveEligibility(textarea) → (user) => true | "reason" | null(skip)
//   invalidMentions(text, eligible)  — publish-time validation
//   linkifyMentions(escapedHtml, hrefFor) — render @Name as profile links
// =========================================================
import { MY_PROFILE, COMMUNITY_USERS, userById } from "./community-data.js";

/** Fold diacritics + case so "ștefan" matches "@Stef". */
function fold(s) {
  return String(s)
    .toLowerCase()
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t");
}

/** The only people you may mention: your friends. */
export function friendCandidates() {
  return MY_PROFILE.friendIds.map((id) => userById(id)).filter(Boolean);
}

/** Friends mentioned as "@Full Name" in a text (manual typing included). */
export function mentionsIn(text) {
  return friendCandidates().filter((u) => text.includes(`@${u.name}`));
}

/** Any "@Known User" who is NOT a friend → always invalid; a friend who
 *  fails the context's eligibility check → invalid with that reason. */
export function invalidMentions(text, eligible = () => true) {
  const bad = [];
  for (const u of COMMUNITY_USERS) {
    if (!text.includes(`@${u.name}`)) continue;
    if (!MY_PROFILE.friendIds.includes(u.id)) {
      bad.push({ user: u, reason: "poți menționa doar prieteni" });
      continue;
    }
    const ok = eligible(u);
    if (ok !== true) bad.push({ user: u, reason: ok || "nu are acces la această postare" });
  }
  return bad;
}

/** Render-time: turn "@Full Name" into a real profile link (escaped HTML
 *  in, HTML out). hrefFor(user) → url or null (plain highlight only). */
export function linkifyMentions(html, hrefFor = () => null) {
  let out = String(html);
  // Longest names first, so "Ana Maria Pop" wins over "Ana Maria".
  const all = [...COMMUNITY_USERS].sort((a, b) => b.name.length - a.name.length);
  for (const u of all) {
    const tag = `@${u.name}`;
    if (!out.includes(tag)) continue;
    const href = hrefFor(u);
    const rep = href
      ? `<a class="cx-userlink cx-mention" href="${href}">${tag}</a>`
      : `<span class="cx-mention">${tag}</span>`;
    out = out.split(tag).join(rep);
  }
  return out;
}

// ---------------------------------------------------------
// Autocomplete. One panel at a time; input-driven; click to insert.
// ---------------------------------------------------------
let panel = null;
let activeBox = null;

/** Find the "@query" being typed before the caret (null if none). */
function mentionQuery(box) {
  const upto = box.value.slice(0, box.selectionStart ?? box.value.length);
  const m = upto.match(/(^|[\s(„"])@([\p{L}\- ]{0,30})$/u);
  return m ? m[2] : null;
}

export function initMentions(root, resolveEligibility) {
  root.addEventListener("input", (e) => {
    const box = e.target;
    if (!(box instanceof HTMLTextAreaElement)) return;
    const q = mentionQuery(box);
    if (q === null) return closePanel();
    const eligible = resolveEligibility(box);
    if (!eligible) return closePanel();

    const fq = fold(q);
    const options = friendCandidates()
      .map((u) => ({ u, ok: eligible(u) }))
      .filter(({ u }) => !fq || fold(u.name).includes(fq))
      .slice(0, 6);
    if (!options.length) return closePanel();
    openPanel(box, options);
  });

  // Click a suggestion → insert "@Full Name " at the query position.
  document.addEventListener("click", (e) => {
    const opt = e.target.closest(".mentions__opt");
    if (!opt || !activeBox) return closePanel();
    if (opt.dataset.ok !== "1") return; // disabled — reason shown inline
    const box = activeBox;
    const caret = box.selectionStart ?? box.value.length;
    const before = box.value.slice(0, caret).replace(/@[\p{L}\- ]{0,30}$/u, `@${opt.dataset.name} `);
    box.value = before + box.value.slice(caret);
    closePanel();
    box.focus();
    box.setSelectionRange(before.length, before.length);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
  });
}

function openPanel(box, options) {
  closePanel();
  activeBox = box;
  panel = document.createElement("div");
  panel.className = "mentions";
  panel.setAttribute("role", "listbox");
  panel.innerHTML = options
    .map(({ u, ok }) =>
      ok === true
        ? `<button type="button" class="mentions__opt" data-ok="1" data-name="${u.name}">@ ${u.name}</button>`
        : `<button type="button" class="mentions__opt mentions__opt--off" data-ok="0" title="${ok}">@ ${u.name}<span class="mentions__why">${ok}</span></button>`
    )
    .join("");
  document.body.appendChild(panel);
  const r = box.getBoundingClientRect();
  const pr = panel.getBoundingClientRect();
  panel.style.left = `${Math.min(r.left, innerWidth - pr.width - 8)}px`;
  panel.style.top = `${Math.min(r.bottom + 4, innerHeight - pr.height - 8)}px`;
}

function closePanel() {
  if (panel) {
    panel.remove();
    panel = null;
    activeBox = null;
  }
}

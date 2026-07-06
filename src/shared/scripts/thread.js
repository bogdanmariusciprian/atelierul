// =========================================================
// Reusable threaded-comments engine (DRY). One source of truth for the
// discussion UI used by BOTH lesson comments and forum-post comments:
//   - arbitrarily nested replies, indented per depth
//   - a color-coded connector line + avatar ring so it's obvious who
//     replied to whom (depth cycles through a hue ramp)
//   - likes (you can't like your own), emoji reactions, reply
//   - the author may EDIT their own comment for 5 minutes after posting
//     (typo window); after that they can only DELETE it and write a new
//     one. Admin edits/deletes anything, anytime. (Marius's rule.)
//   - optional profanity filter + "Raportează" (wired via opts)
//
// The caller owns the comments array and a tiny `state` object holding
// which reply/edit/reaction picker is currently open; this module renders
// the tree and handles every click on a [data-action^="t-"] control.
// =========================================================
// Only presentation is imported (the level/streak badge markup); the comment
// DATA still comes from the caller via opts, keeping this engine data-agnostic.
import { badgeHtml } from "./badges.js";

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "💡", "🎉"];

/** Points awarded to a comment's author when an admin marks it correct. */
export const CORRECT_REWARD = 25;

// Hue ramp for nesting depth. Cycles so very deep threads stay readable.
const DEPTH_COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#16a34a", "#f59e0b", "#db2777"];
export function depthColor(depth) {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/** Total comments incl. nested replies. */
export function countComments(list) {
  return list.reduce((n, c) => n + 1 + countComments(c.replies || []), 0);
}

/** Find + act on a comment anywhere in the tree. */
export function walk(list, id, fn) {
  for (const c of list) {
    if (c.id === id) return fn(c), true;
    if (c.replies?.length && walk(c.replies, id, fn)) return true;
  }
  return false;
}

/** Remove a comment (and its whole subtree) anywhere in the tree. */
export function removeComment(list, id) {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list.splice(i, 1);
      return true;
    }
    if (list[i].replies?.length && removeComment(list[i].replies, id)) return true;
  }
  return false;
}

/** The author's typo window: edit your own for 5 minutes, then delete-only. */
export const EDIT_WINDOW_MS = 5 * 60 * 1000;

function isOwn(c, user) {
  return c.authorId === user.id;
}
function canEdit(c, user) {
  return isOwn(c, user) && Date.now() - (c.createdAt || 0) < EDIT_WINDOW_MS;
}
function canLike(c, user) {
  return c.authorId !== user.id; // no liking your own
}

function avatarHtml(c, ring = false, gifUrl = null) {
  if (gifUrl) {
    return `<span class="thr__avatar thr__avatar--gif${ring ? " thr__avatar--ring" : ""}" style="background-image:url('${gifUrl}')" role="img" aria-label="${escapeHtml(c.name)}"></span>`;
  }
  return `<span class="thr__avatar${ring ? " thr__avatar--ring" : ""}" style="--a:${c.color}">${escapeHtml(c.initials || "?")}</span>`;
}

function reactionsHtml(c, state) {
  // One reaction per user. Your own reaction is a removable chip; everyone
  // else's reactions are inert counts you can't touch.
  const mine = c.myReaction || null;
  const chips = Object.entries(c.reactions || {})
    .filter(([, n]) => n > 0)
    .map(([e, n]) =>
      e === mine
        ? `<button type="button" class="thr__chip is-mine" data-action="t-remove-react" data-id="${c.id}" data-emoji="${e}" title="Elimină reacția ta">${e} ${n}</button>`
        : `<span class="thr__chip">${e} ${n}</span>`
    )
    .join("");
  // The "add" button + picker appear only if you haven't reacted yet.
  const adder = mine
    ? ""
    : `<button type="button" class="thr__addreact" data-action="t-react" data-id="${c.id}" aria-label="Adaugă reacție">+</button>${
        state.openReactId === c.id
          ? `<span class="thr__picker">${REACTION_EMOJIS.map(
              (e) => `<button type="button" class="thr__emoji" data-action="t-add-react" data-id="${c.id}" data-emoji="${e}">${e}</button>`
            ).join("")}</span>`
          : ""
      }`;
  return `<span class="thr__reacts">${chips} ${adder}</span>`;
}

function editorHtml(c, opts) {
  const note = opts.isAdmin ? "editare ca administrator" : "editezi propriul comentariu";
  return `<div class="thr__edit">
      <textarea class="thr__input">${escapeHtml(c.text)}</textarea>
      <div class="thr__editactions">
        <button type="button" class="btn-mini" data-action="t-save-edit" data-id="${c.id}">Salvează</button>
        <button type="button" class="btn-mini btn-mini--ghost" data-action="t-cancel-edit">Renunță</button>
        <span class="thr__editnote">${note}</span>
      </div>
    </div>`;
}

function commentHtml(c, depth, parentName, state, user, opts) {
  const color = depthColor(depth);
  const liked = c.likedByMe ? " is-liked" : "";
  const editing = state.openEditId === c.id;

  // Own comments show no like button at all (you can't like yourself).
  const likeBtn = canLike(c, user)
    ? `<button type="button" class="thr__act${liked}" data-action="t-like" data-id="${c.id}">♥ <span>${c.likes}</span></button>`
    : "";

  // Admin can mark a reply "correct" → its author earns points.
  const adminBtn = opts.isAdmin
    ? `<button type="button" class="thr__act thr__act--admin${c.correct ? " on" : ""}" data-action="t-correct" data-id="${c.id}">${c.correct ? "✓ Corect" : "Marchează corect"}</button>`
    : "";
  const correctBadge = c.correct
    ? `<span class="thr__correct" title="Răspuns marcat corect de admin">✓ răspuns corect · +${CORRECT_REWARD}</span>`
    : "";

  // The current user's own avatar, shown next to the reply box while typing.
  const myUrl = opts.avatarUrl ? opts.avatarUrl({ authorId: user.id, name: user.name }) : null;
  const myAv = myUrl
    ? `<span class="thr__avatar thr__avatar--gif" style="background-image:url('${myUrl}')"></span>`
    : `<span class="thr__avatar" style="--a:${user.color}">${escapeHtml(user.initials || "?")}</span>`;

  const replyBox =
    state.openReplyId === c.id
      ? `<div class="thr__reply">
           ${myAv}
           <div class="thr__replybody">
             <textarea class="thr__input" placeholder="Scrie un răspuns…"></textarea>
             <div class="thr__replyactions">
               <button type="button" class="btn-mini" data-action="t-post-reply" data-id="${c.id}">Răspunde</button>
               <button type="button" class="btn-mini btn-mini--ghost" data-action="t-cancel-reply">Renunță</button>
             </div>
           </div>
         </div>`
      : "";

  const replies = (c.replies || []).map((r) => commentHtml(r, depth + 1, c.name, state, user, opts)).join("");
  const repliesWrap = replies ? `<div class="thr__replies" style="--c:${depthColor(depth + 1)}">${replies}</div>` : "";

  // The author edits their own comment only in the 5-minute window;
  // admin edits any, anytime. Deleting your own stays available forever.
  const editBtn = canEdit(c, user) || opts.isAdmin
    ? `<button type="button" class="thr__act" data-action="t-edit" data-id="${c.id}">✎ Editează</button>`
    : "";
  const delBtn = isOwn(c, user) || opts.isAdmin
    ? `<button type="button" class="thr__act thr__act--del" data-action="t-del" data-id="${c.id}">🗑 Șterge</button>`
    : "";
  // Others' comments can be reported (never your own; wired by the caller).
  const FLAG_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4c4-2 8 2 12 0v9c-4 2-8-2-12 0"/></svg>`;
  const reportBtn = !isOwn(c, user) && opts.onReport
    ? c.reportedByMe
      ? `<span class="thr__act thr__act--reported" title="Raportat profesorului">${FLAG_SVG} Raportat</span>`
      : `<button type="button" class="thr__act thr__act--report" data-action="t-report" data-id="${c.id}" title="Semnalează profesorului">${FLAG_SVG} Raportează</button>`
    : "";
  // Inline warning (e.g. the profanity filter stopped a reply/edit).
  const warning = state.warnId === c.id && state.warnMsg
    ? `<p class="thr__warn" role="alert">⚠️ ${escapeHtml(state.warnMsg)}</p>`
    : "";

  // Avatar gif for this comment's author (resolver provided by the caller).
  const gifUrl = opts.avatarUrl ? opts.avatarUrl(c) : null;
  // Level + streak meta → badges on the ring (global consistency).
  const meta = opts.userMeta ? opts.userMeta(c.authorId) : null;
  const avatarInner = meta
    ? `<span class="thr__avwrap">
         <span class="thr__lvlring" style="--ring:${meta.fill}">${avatarHtml(c, false, gifUrl)}</span>
         ${badgeHtml(meta, "thr__badge")}
       </span>`
    : avatarHtml(c, depth > 0, gifUrl);
  // The caller provides a profile URL per author via opts.userHref (null =
  // not linkable). The professor (teacher/admin) is never linkable and wears
  // a "Profesor" tag. Real links, so they work on any page (community + lessons).
  const isProf = opts.professorId != null && c.authorId === opts.professorId;
  const href = !isProf && opts.userHref ? opts.userHref(c) : null;
  const avatarBlock = href
    ? `<a class="cx-avlink" href="${href}" title="Vezi profilul">${avatarInner}</a>`
    : avatarInner;
  const teacherTag = isProf ? ` <span class="cx-teacher" title="Profesor · cadru didactic">🎓 Profesor</span>` : "";
  const nameBlock = href
    ? `<a class="thr__name cx-userlink" href="${href}">${escapeHtml(c.name)}</a>`
    : `<span class="thr__name">${escapeHtml(c.name)}${teacherTag}</span>`;

  return `
    <div class="thr__c" data-depth="${depth}" style="--c:${color}">
      ${depth > 0 ? `<span class="thr__elbow" aria-hidden="true"></span>` : ""}
      ${avatarBlock}
      <div class="thr__body">
        <p class="thr__meta">
          ${nameBlock}
          ${parentName ? `<span class="thr__replyto">↳ ${escapeHtml(parentName)}</span>` : ""}
          <span class="thr__time">${c.time}${c.edited ? " · editat" : ""}</span>
          ${correctBadge}
        </p>
        ${editing ? editorHtml(c, opts) : `<p class="thr__text">${opts.decorateText ? opts.decorateText(c.text) : c.text}</p>`}
        <div class="thr__actions">
          ${likeBtn}
          ${reactionsHtml(c, state)}
          <button type="button" class="thr__act" data-action="t-reply" data-id="${c.id}">↩ Răspunde</button>
          ${editBtn}
          ${delBtn}
          ${reportBtn}
          ${adminBtn}
        </div>
        ${warning}
        ${replyBox}
        ${repliesWrap}
      </div>
    </div>`;
}

/** Render a whole comment tree to an HTML string. `opts.isAdmin` enables
 *  the admin "mark correct" control. */
export function renderThread(comments, state, user, opts = {}) {
  if (!comments.length) {
    return `<p class="thr__empty">Niciun comentariu încă. Fii primul care scrie ceva!</p>`;
  }
  return `<div class="thr">${comments.map((c) => commentHtml(c, 0, null, state, user, opts)).join("")}</div>`;
}

/** Build a fresh comment authored by the current user. */
export function makeUserComment(text, user, nextId) {
  return {
    id: nextId(),
    authorId: user.id,
    name: user.name,
    initials: user.initials,
    color: user.color,
    createdAt: Date.now(),
    time: "acum",
    text: escapeHtml(text),
    likes: 0,
    likedByMe: false,
    reactions: {},
    edited: false,
    replies: [],
  };
}

// ---------------------------------------------------------
// Central click handler for every thread control. Returns true if it
// consumed the event (so the caller knows to stop). The caller passes:
//   comments  – the array to mutate
//   state     – { openReplyId, openReactId, openEditId, warnId, warnMsg }
//   user      – current user { id, name, initials, color }
//   nextId    – () => unique id
//   canInteract – () => boolean (gate for guests)
//   onGuard   – optional, called when a guest tries to act
//   moderate  – optional, (text) => offending words [] (profanity filter)
//   validate  – optional, (text) => null | "message" (e.g. @mention rules)
//   onBlocked – optional, (text, matches) => void (log a stopped attempt)
//   onReport  – optional, (comment) => void ("Raportează" pressed)
//   onReply   – optional, (parentComment, text) => void (reply published)
//   decorateText – optional, (escapedText) => html (e.g. linkify @mentions)
//   rerender  – () => void, called after any mutation
// ---------------------------------------------------------
export function handleThreadClick(e, opts) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return false;
  const action = btn.dataset.action;
  if (!action || !action.startsWith("t-")) return false;

  if (!opts.canInteract()) {
    opts.onGuard?.();
    return true;
  }

  const { comments, state, user, nextId, rerender } = opts;
  const id = Number(btn.dataset.id);

  switch (action) {
    case "t-like":
      walk(comments, id, (c) => {
        if (c.authorId === user.id) return; // no self-like
        c.likedByMe = !c.likedByMe;
        c.likes += c.likedByMe ? 1 : -1;
        opts.onLike?.(c, c.likedByMe);
      });
      break;

    case "t-react":
      state.openReactId = state.openReactId === id ? null : id;
      break;

    case "t-add-react":
      walk(comments, id, (c) => {
        if (c.myReaction) return; // one reaction per user — can't add another
        const em = btn.dataset.emoji;
        c.reactions[em] = (c.reactions[em] || 0) + 1;
        c.myReaction = em;
        opts.onReact?.(c, em, true);
      });
      state.openReactId = null;
      break;

    case "t-remove-react":
      walk(comments, id, (c) => {
        if (!c.myReaction) return;
        const em = c.myReaction;
        c.reactions[em] = Math.max(0, (c.reactions[em] || 0) - 1);
        c.myReaction = null;
        opts.onReact?.(c, em, false);
      });
      break;

    case "t-reply":
      state.openReplyId = state.openReplyId === id ? null : id;
      state.openEditId = null;
      state.warnId = state.warnMsg = null;
      break;

    case "t-cancel-reply":
      state.openReplyId = null;
      state.warnId = state.warnMsg = null;
      break;

    case "t-post-reply": {
      const box = btn.closest(".thr__reply")?.querySelector(".thr__input");
      const text = box?.value.trim();
      if (!text) return true;
      // Profanity filter (if the caller wired one): stop + warn inline.
      const bad = opts.moderate ? opts.moderate(text) : [];
      if (bad.length) {
        state.warnId = id;
        state.warnMsg = opts.warnMsg || "Mesajul conține limbaj nepotrivit. Reformulează, te rog.";
        opts.onBlocked?.(text, bad);
        rerender();
        return true;
      }
      // Context rules (e.g. an @mention the target couldn't see): stop + explain.
      const vmsg = opts.validate ? opts.validate(text) : null;
      if (vmsg) {
        state.warnId = id;
        state.warnMsg = vmsg;
        rerender();
        return true;
      }
      walk(comments, id, (c) => {
        c.replies.push(makeUserComment(text, user, nextId));
        opts.onReply?.(c, text); // e.g. record it in "Activitatea mea"
      });
      state.openReplyId = null;
      state.warnId = state.warnMsg = null;
      break;
    }

    case "t-edit":
      state.openEditId = id;
      state.openReplyId = null;
      state.warnId = state.warnMsg = null;
      break;

    case "t-cancel-edit":
      state.openEditId = null;
      state.warnId = state.warnMsg = null;
      break;

    case "t-save-edit": {
      const box = btn.closest(".thr__edit")?.querySelector(".thr__input");
      const text = box?.value.trim();
      if (!text) return true;
      const bad = opts.moderate ? opts.moderate(text) : [];
      if (bad.length) {
        state.warnId = id;
        state.warnMsg = opts.warnMsg || "Mesajul conține limbaj nepotrivit. Reformulează, te rog.";
        opts.onBlocked?.(text, bad);
        rerender();
        return true;
      }
      const vmsg = opts.validate ? opts.validate(text) : null;
      if (vmsg) {
        state.warnId = id;
        state.warnMsg = vmsg;
        rerender();
        return true;
      }
      walk(comments, id, (c) => {
        // Author edits own only within the 5-minute window; admin anytime.
        if (!opts.isAdmin && !canEdit(c, user)) return;
        c.text = escapeHtml(text);
        c.edited = true;
        opts.onEdit?.(c, text);
      });
      state.openEditId = null;
      state.warnId = state.warnMsg = null;
      break;
    }

    case "t-correct": {
      if (!opts.isAdmin) return true; // admin-only
      walk(comments, id, (c) => {
        c.correct = !c.correct;
        opts.onCorrect?.(c, c.correct);
      });
      break;
    }

    case "t-del": {
      // The author may delete their own comment; admin may delete any.
      let allowed = false;
      let target = null;
      walk(comments, id, (c) => {
        allowed = opts.isAdmin || c.authorId === user.id;
        target = c;
      });
      if (!allowed) return true;
      opts.onDelete?.(target);
      removeComment(comments, id);
      state.openEditId = state.openReplyId = null;
      break;
    }

    case "t-report": {
      walk(comments, id, (c) => {
        if (c.authorId !== user.id) opts.onReport?.(c);
      });
      break;
    }

    default:
      return false;
  }

  rerender();
  return true;
}

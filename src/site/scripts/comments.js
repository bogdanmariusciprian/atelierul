// =========================================================
// Lesson comments — threaded, with likes + emoji reactions + 5-minute
// edit window, and (for admin) marking a reply "correct" to award points.
// Guests read; members interact; admin moderates. The whole thread UI
// comes from the shared thread.js engine (DRY — same code powers the
// forum). Mock session; a small 3-state switch previews the roles.
// =========================================================
import {
  fetchLessonComments, addLessonComment, toggleCommentLike, toggleCommentReaction,
  updateComment, deleteComment, mapComment, markCommentCorrect, reportCommentBySurrogate,
} from "../../shared/scripts/forum-repo.js";
import { nextId } from "../../shared/scripts/forum-data.js";
import { CURRENT_USER, isLoggedIn, isAdmin } from "../../shared/scripts/session.js";
import { MY_PROFILE, slugForUser } from "../../shared/scripts/community-data.js";
import { findProfanity } from "../../shared/scripts/moderation.js";
import { initMentions, invalidMentions, linkifyMentions } from "../../shared/scripts/mentions.js";
import { touchStreak } from "../../shared/scripts/streak.js";
import { showToast } from "../../shared/scripts/toast.js";
import { notifyMention } from "../../shared/scripts/activity-repo.js";
import { mentionsIn } from "../../shared/scripts/mentions.js";
import {
  renderThread,
  handleThreadClick,
  countComments,
  makeUserComment,
  CORRECT_REWARD,
} from "../../shared/scripts/thread.js";
import { avatarForUser } from "../../shared/scripts/avatars.js";
import { userMeta } from "../../shared/scripts/badges.js";
import { currentLessonSlug } from "../../shared/scripts/lessons-index.js";

export function initLessonComments(basePath = "") {
  const article = document.querySelector(".lesson");
  if (!article) return;

  const mount = document.createElement("section");
  mount.className = "lesson-section comments";
  mount.id = "lesson-comments";
  article.appendChild(mount);

  const slug = currentLessonSlug();
  if (!slug) return;
  const state = {
    comments: [], // real lesson comments (Supabase) — loaded in load()
    openReplyId: null,
    openReactId: null,
    openEditId: null,
    warnId: null,
    warnMsg: null,
    composerWarn: null, // profanity notice under the main comment box
  };

  // The teacher marks a reply correct → the SERVER flips the flag AND awards
  // (or takes back) the author's points via mark_comment_correct (cheat-safe,
  // idempotent, persisted). His OWN replies earn nothing (not in the game).
  function award(c, nowCorrect) {
    if (!isAdmin()) return;
    markCommentCorrect(c.id, nowCorrect); // REAL: persisted + points on the server
    const mine = c.authorId === CURRENT_USER.id;
    showToast(
      mine
        ? nowCorrect ? "✓ Marcat corect (răspunsul tău — fără puncte)" : "Marcaj retras"
        : nowCorrect
          ? `✓ Marcat corect — ${c.name} primește +${CORRECT_REWARD} puncte`
          : `Marcaj retras — ${CORRECT_REWARD} puncte retrase de la ${c.name}`,
      { kind: nowCorrect ? "success" : "info" }
    );
  }

  // A published comment/reply with @mentions sends each mentioned friend a REAL
  // notification (notify_mention RPC — the server forces the actor to be you
  // and enforces the friends-only rule).
  const notifyMentions = (text) => {
    for (const u of mentionsIn(text)) {
      notifyMention(u.id, String(text).slice(0, 90), `Comentariu la lecția „${slug}”`);
    }
  };

  // Shared moderation wiring (same rules as the community hub).
  const moderate = (text) => findProfanity(text || "");
  const WARN = "Mesajul conține limbaj nepotrivit. Reformulează, te rog — profesorul a fost anunțat.";
  const report = (c) => {
    if (c.reportedByMe) return;
    c.reportedByMe = true;
    reportCommentBySurrogate(c.id); // REAL: persisted to the Supabase `reports` table
    showToast("⚑ Semnalat — profesorul va verifica.", { kind: "success" });
  };

  // @mentions: lesson comments are public, so any friend is eligible; the
  // "friends only" rule still applies (validated below + at autocomplete).
  const validateMentions = (text) => {
    const bad = invalidMentions(text);
    return bad.length ? `Nu-l poți menționa pe @${bad[0].user.name}: ${bad[0].reason}.` : null;
  };

  function render() {
    const logged = isLoggedIn();
    const myGif = MY_PROFILE.avatar ? `${basePath}${MY_PROFILE.avatar}` : null;
    const avatarUrl = (c) => (c.authorId === CURRENT_USER.id ? myGif : `${basePath}${avatarForUser(c.authorId)}`);
    // Comment authors link to their community profile (the professor — id 0 —
    // stays inert). Cross-page: full path to the hub + shareable hash.
    const hubProfile = (id) =>
      id === CURRENT_USER.id ? null : `${basePath}comunitate/#u/${slugForUser(id)}`;
    const composerAv = myGif
      ? `<span class="thr__avatar thr__avatar--gif" style="background-image:url('${myGif}')"></span>`
      : `<span class="thr__avatar" style="--a:${CURRENT_USER.color}">${CURRENT_USER.initials}</span>`;
    const composer = logged
      ? `<div class="cmt-composer">
           ${composerAv}
           <textarea class="thr__input" id="cmt-new" placeholder="Scrie un comentariu la această lecție…"></textarea>
           <button type="button" class="btn-mini" data-action="post">Publică</button>
         </div>`
      : `<div class="cmt-guestbar">
           <span>🔒 Doar utilizatorii conectați pot comenta, aprecia și reacționa. Comentariile rămân vizibile pentru toți.</span>
           <a href="${basePath}comunitate/login/">Conectează-te</a>
         </div>`;

    mount.className = "lesson-section comments" + (logged ? "" : " is-guest");
    mount.innerHTML = `
      <div class="comments__head">
        <h2 class="lesson-section__title">Comentarii · ${countComments(state.comments)}</h2>
      </div>
      ${composer}
      ${state.composerWarn ? `<p class="thr__warn" role="alert">⚠️ ${state.composerWarn}</p>` : ""}
      <div class="comments__list">${renderThread(state.comments, state, CURRENT_USER, {
        isAdmin: isAdmin(),
        avatarUrl,
        userMeta: (c) => (isAdmin() && c.authorId === CURRENT_USER.id ? null : userMeta(c.authorId)),
        userHref: (c) => hubProfile(c.authorId),
        professorId: CURRENT_USER.id,
        onReport: report,
        decorateText: (t) => linkifyMentions(t, (u) => hubProfile(u.id)),
      })}</div>`;
  }

  mount.addEventListener("click", (e) => {
    // Shared thread controls first (like/react/reply/edit/correct).
    const consumed = handleThreadClick(e, {
      comments: state.comments,
      state,
      user: CURRENT_USER,
      nextId,
      canInteract: isLoggedIn,
      isAdmin: isAdmin(),
      onCorrect: award,
      moderate,
      warnMsg: WARN,
      onReport: report,
      validate: validateMentions,
      // REAL: persist comment interactions to Supabase (by comment surrogate id).
      onLike: (c, liked) => toggleCommentLike(c.id, liked),
      onReact: (c, emoji, added) => toggleCommentReaction(c.id, emoji, added),
      onEdit: (c, text) => updateComment(c.id, text),
      onDelete: (c) => deleteComment(c.id),
      onReply: (parent, text) => {
        // REAL: persist the reply, then map its optimistic id to the uuid.
        const newReply = parent.replies[parent.replies.length - 1];
        addLessonComment({ lessonSlug: slug, parentSurrogate: parent.id, text }).then((row) => {
          if (row && newReply) mapComment(newReply.id, row.id);
        });
        touchStreak(); // replying counts as today's activity
        notifyMentions(text);
      },
      onGuard: () => showToast("Conectează-te ca să interacționezi cu comentariile 🔑"),
      rerender: render,
    });
    if (consumed) return;

    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;

    if (!isLoggedIn()) {
      showToast("Conectează-te ca să interacționezi cu comentariile 🔑");
      return;
    }

    if (action === "post") {
      const box = mount.querySelector("#cmt-new");
      const text = box.value.trim();
      if (!text) return;
      const bad = moderate(text);
      if (bad.length) {
        state.composerWarn = WARN;
        return render();
      }
      const vmsg = validateMentions(text);
      if (vmsg) {
        state.composerWarn = vmsg;
        return render();
      }
      state.composerWarn = null;
      state.comments.push(makeUserComment(text, CURRENT_USER, nextId));
      // REAL: persist the comment, then map its optimistic id to the uuid.
      const newC = state.comments[state.comments.length - 1];
      addLessonComment({ lessonSlug: slug, text }).then((row) => {
        if (row) mapComment(newC.id, row.id);
      });
      notifyMentions(text);
      touchStreak(); // commenting counts as today's activity
      return render();
    }
  });

  // @mentions autocomplete — the lesson page is public, so every friend
  // is eligible (the friends-only rule is enforced by mentions.js itself).
  initMentions(mount, () => () => true);

  // Fetch the lesson's real comments, then render.
  async function load() {
    state.comments = await fetchLessonComments(slug);
    render();
  }

  // A role change (login/logout) changes what this section shows — reload.
  window.addEventListener("atelier:role", () => {
    state.openReplyId = state.openReactId = state.openEditId = null;
    load();
  });

  load();
}

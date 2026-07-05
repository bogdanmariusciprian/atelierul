// =========================================================
// Lesson comments — threaded, with likes + emoji reactions + 5-minute
// edit window, and (for admin) marking a reply "correct" to award points.
// Guests read; members interact; admin moderates. The whole thread UI
// comes from the shared thread.js engine (DRY — same code powers the
// forum). Mock session; a small 3-state switch previews the roles.
// =========================================================
import { getLessonComments, nextId } from "../../shared/scripts/comments-data.js";
import { CURRENT_USER, isLoggedIn, isAdmin } from "../../shared/scripts/session.js";
import { MY_PROFILE, userById, slugForUser, awardPoints } from "../../shared/scripts/community-data.js";
import { findProfanity, queueBlockedComment, queueReport } from "../../shared/scripts/moderation.js";
import { initMentions, invalidMentions, linkifyMentions } from "../../shared/scripts/mentions.js";
import { touchStreak } from "../../shared/scripts/streak.js";
import { showToast } from "../../shared/scripts/toast.js";
import { notifyReceived, notifyUser } from "../../shared/scripts/activity-data.js";
import { mentionsIn } from "../../shared/scripts/mentions.js";
import {
  renderThread,
  handleThreadClick,
  countComments,
  makeUserComment,
  CORRECT_REWARD,
} from "../../shared/scripts/thread.js";
import { pointsFx } from "../../shared/scripts/points-fx.js";
import { avatarForUser } from "../../shared/scripts/avatars.js";
import { userMeta } from "../../shared/scripts/badges.js";

export function initLessonComments(basePath = "") {
  const article = document.querySelector(".lesson");
  if (!article) return;

  const mount = document.createElement("section");
  mount.className = "lesson-section comments";
  mount.id = "lesson-comments";
  article.appendChild(mount);

  const slug = location.pathname.split("/").pop().replace(".html", "");
  const state = {
    comments: getLessonComments(slug),
    openReplyId: null,
    openReactId: null,
    openEditId: null,
    warnId: null,
    warnMsg: null,
    composerWarn: null, // profanity notice under the main comment box
  };

  // Admin marks a reply correct → its author earns points. Mine go through
  // awardPoints so the "Puncte" history stays in sync with the total.
  function award(c, nowCorrect) {
    if (c.authorId === CURRENT_USER.id) {
      // The teacher never earns points (marking is admin-only anyway).
      if (isAdmin()) return;
      awardPoints(
        nowCorrect ? "Răspuns marcat corect de profesor" : "Retragere: răspuns corect",
        nowCorrect ? CORRECT_REWARD : -CORRECT_REWARD
      );
      if (nowCorrect) {
        pointsFx(CORRECT_REWARD);
        notifyReceived({
          actorId: 0, kind: "award",
          action: `ți-a marcat răspunsul drept CORECT (+${CORRECT_REWARD} puncte)`,
          snippet: String(c.text).slice(0, 90),
          context: `La lecția „${slug}”`,
        });
      }
    } else {
      const u = userById(c.authorId);
      if (u) u.points += nowCorrect ? CORRECT_REWARD : -CORRECT_REWARD;
      if (nowCorrect) notifyUser(c.authorId, { actorId: 0, kind: "award", action: "ți-a marcat răspunsul drept corect", snippet: String(c.text).slice(0, 90), context: `La lecția „${slug}”` });
    }
  }

  // A published comment/reply with @mentions notifies the mentioned friends.
  const notifyMentions = (text) => {
    for (const u of mentionsIn(text)) {
      notifyUser(u.id, { actorId: 0, kind: "mention", action: "te-a menționat", snippet: String(text).slice(0, 90), context: `Comentariu la lecția „${slug}”` });
    }
  };

  // Shared moderation wiring (same rules as the community hub).
  const moderate = (text) => findProfanity(text || "");
  const WARN = "Mesajul conține limbaj nepotrivit. Reformulează, te rog — profesorul a fost anunțat.";
  const logBlocked = (text, matches) =>
    queueBlockedComment({
      authorId: CURRENT_USER.id, name: CURRENT_USER.name, text, matches,
      context: `Comentariu la lecția „${slug}”`,
    });
  const report = (c) => {
    if (c.reportedByMe) return;
    c.reportedByMe = true;
    queueReport({
      targetType: "comment",
      targetId: c.id,
      authorId: c.authorId,
      name: c.name,
      snippet: String(c.text).slice(0, 120),
      reporterId: CURRENT_USER.id,
      reporterName: CURRENT_USER.name,
    });
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
      id === CURRENT_USER.id ? null : `${basePath}src/community/pages/spatiul-meu.html#u/${slugForUser(id)}`;
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
           <a href="${basePath}src/community/pages/login.html">Conectează-te</a>
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
      onBlocked: logBlocked,
      onReport: report,
      validate: validateMentions,
      onReply: (parent, text) => {
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
        logBlocked(text, bad);
        return render();
      }
      const vmsg = validateMentions(text);
      if (vmsg) {
        state.composerWarn = vmsg;
        return render();
      }
      state.composerWarn = null;
      state.comments.push(makeUserComment(text, CURRENT_USER, nextId));
      notifyMentions(text);
      touchStreak(); // commenting counts as today's activity
      return render();
    }
  });

  // @mentions autocomplete — the lesson page is public, so every friend
  // is eligible (the friends-only rule is enforced by mentions.js itself).
  initMentions(mount, () => () => true);

  // The global 🎭 role switcher changes what this section shows — follow it.
  window.addEventListener("atelier:role", () => {
    state.openReplyId = state.openReactId = state.openEditId = null;
    render();
  });

  render();
}

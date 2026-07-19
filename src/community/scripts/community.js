// =========================================================
// Community hub (logged-in only). A single app-shell with a fixed left
// sidebar and a content pane on the right. Sections:
//   forum       – public community feed (default)
//   pagina-mea  – my personal wall
//   activitate  – comments received / given / followed
//   exercitii   – community-proposed exercises (per lesson)
//   lectii      – my favorite lessons
//   caiet       – my notebook
//   puncte      – points log
//   profil      – editable profile
//
// Posts (shared by forum + wall, DRY) support: a type with an icon, a
// chosen background tint, image uploads (object URLs), a YouTube video
// that only plays on click, likes (no self-like), reshare (self allowed),
// follow, and threaded comments (shared thread.js engine) revealed on
// clicking the comment icon.
//
// Everything is mock (local state + mock session) for preview.
// =========================================================
import { CURRENT_USER, isLoggedIn, isAdmin } from "../../shared/scripts/session.js";
import { getGateOff, setGateOff } from "../../shared/scripts/site-gate.js";
import { fetchFeed, fetchMembers, adminFetchUsers, fetchPublicProfile, uuidForSurrogate, surrogateForPostUuid, createPost, createComment, mapComment, mapPostSurrogate, togglePostLike, toggleSave, updatePost, deletePost, updateComment, deleteComment, toggleCommentLike, toggleCommentReaction, markCommentCorrect, fetchMyEventsAccess, fetchMyFriends, sendFriendRequest, cancelFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend, fetchMyProfile, updateMyProfile, fetchConversations, sendTemplateMsg, sendTeacherMsg, sendTeacherReply, sendFreeMsg, reportMessage, markConversationReadReal, fetchConversationLabels, setConversationLabel, fetchEventAccessUsers, fetchContentReports, resolveReport, fetchProfanityTerms, addProfanityTerm, removeProfanityTerm, fetchHeldContent, moderateContent, fetchMyBlocks, blockUser, unblockUser, fetchPointsHistory, fetchFavorites, addFavorite, removeFavorite, fetchMyLessonProgress, pinGroupPost, reportPostBySurrogate, reportCommentBySurrogate, resolveTestReport } from "../../shared/scripts/forum-repo.js";
import { confirmDialog } from "../../shared/scripts/confirm.js";
import { isOnlineSince } from "../../shared/scripts/presence.js";
import { MY_PROFILE, COMMUNITY_USERS, userById, avatarColor, publicProfileOf, slugForUser, userBySlug, awardPoints } from "../../shared/scripts/community-data.js";
import { clapsFor, hasClapped, giveClap, hasPoked, givePoke, loadKudos } from "../../shared/scripts/kudos-repo.js";
import {
  findProfanity, FILTER_MESSAGE, setCustomProfanity,
} from "../../shared/scripts/moderation.js";
import {
  adminFetchTestItem, adminFetchBonusQuestions, saveBonusQuestion, deleteBonusQuestion,
  adminFetchTestDownloads, saveTestDownload, deleteTestDownload, directDownloadUrl,
  listDriveFolder, driveFileId, fetchAppSettings, saveAppSetting,
} from "../../shared/scripts/test-repo.js";
import { sanitizeRich } from "../../shared/scripts/rich-text.js";
// Shared with the Teste pages: one source for the category colours.
import { TEST_CATEGORIES, TEST_CAT_BY_SLUG } from "../../site/scripts/test-categories.js";
import {
  wordOfToday, GROUP_ICONS, groupIcon, groupColor, EVENT_KINDS, BADGES,
} from "../../shared/scripts/discover-data.js";
import {
  listEvents, rsvpEvent, createEvent, updateEvent, deleteEvent,
  grantEventAccess, revokeEventAccess,
} from "../../shared/scripts/events-repo.js";
import {
  // aliased: a LOCAL function createGroup() (the composer handler) already
  // exists below — without the alias it would shadow this import and recurse.
  listGroups, fetchGroupPosts, postToGroup, createGroup as createGroupRow, joinGroup,
  leaveGroup, addGroupMember, kickGroupMember, updateGroup, deleteGroup,
} from "../../shared/scripts/groups-repo.js";
import {
  fetchTodayChallenge, fetchMyChallengeSolve, solveChallenge, fetchChallengeAnswer,
  listChallenges, createChallenge, updateChallenge, deleteChallenge,
} from "../../shared/scripts/challenges-repo.js";
import {
  POST_TYPES, postType,
  POST_BACKGROUNDS, postBackground, topPost, nextId, relTime,
} from "../../shared/scripts/forum-data.js";
import {
  EXERCISE_KINDS, exerciseKind, fetchPendingExercises, fetchExerciseHistory,
  proposeExercise, voteExercise, approveExercise, rejectExercise,
  updateExercise, deleteExercise, fetchMyApprovedExerciseCount,
} from "../../shared/scripts/exercises-repo.js";
import {
  ACTIVITY_KINDS, receivedActivity, fetchGivenActivity, fetchMyContributionCounts,
  fetchMyLessonSlugs, unreadActivityCount, markActivityRead, notifyMention,
} from "../../shared/scripts/activity-repo.js";
import { AVATAR_GIFS, CHAMPION_GIF, CHAMPION_UNLOCK_LEVEL, avatarForUser } from "../../shared/scripts/avatars.js";
import {
  renderThread, handleThreadClick, countComments, makeUserComment, escapeHtml,
  CORRECT_REWARD, EDIT_WINDOW_MS,
} from "../../shared/scripts/thread.js";
import { pointsFx, burstAt } from "../../shared/scripts/points-fx.js";
import { showToast } from "../../shared/scripts/toast.js";
import { initMentions, invalidMentions, linkifyMentions, mentionsIn } from "../../shared/scripts/mentions.js";
import { exerciseFormFields, readExerciseForm, exerciseEditFormHtml, exercisePreviewHtml } from "../../shared/scripts/exercise-form.js";
import { touchStreak, getStreakInfo } from "../../shared/scripts/streak.js";
import { store } from "../../shared/scripts/store.js";
import { getNotes, loadNotes, addNote, updateNote, deleteNote } from "../../shared/scripts/notebook.js";
import { MESSAGE_TEMPLATES, searchTemplates, templateStats, suggestReplies, intentOfTemplate, slotsIn, slotOptions, fillTemplate } from "../../shared/scripts/messages.js";
import { mascotSvg } from "../../shared/scripts/mascot.js";
import { MAX_LEVEL, xpSkin, levelInfo, setPreview, xpBarMarkup, applyBar } from "../../shared/scripts/xp-bar.js";
import { userMeta, badgeHtml } from "../../shared/scripts/badges.js";
import { lessonHrefBySlug, lessonBySlug, LESSONS } from "../../shared/scripts/lessons-index.js";
import { countNoun, plural } from "../../shared/scripts/format.js";

// --- Small inline icons for the sidebar (single source, DRY) ----------
const NAV_ICONS = {
  forum: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 20l1.4-4.2A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/></svg>`,
  "pagina-mea": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>`,
  activitate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>`,
  exercitii: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h6v4a2 2 0 1 0 4 0V7h2a2 2 0 1 1 0 4h-1v6H5a1 1 0 0 1-1-1v-3a2 2 0 1 0 0-4z"/></svg>`,
  lectii: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20"/></svg>`,
  caiet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M13 8h3M13 12h3"/></svg>`,
  salvate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>`,
  mesaje: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
  puncte: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M9 14l-1.5 7L12 18l4.5 3L15 14"/></svg>`,
  profil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.3-1.3L13.7 2h-3.4l-.3 2.5a7 7 0 0 0-2.3 1.3l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.3l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.3 1.3l.3 2.5h3.4l.3-2.5a7 7 0 0 0 2.3-1.3l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12z"/></svg>`,
  provocare: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>`,
  clasament: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>`,
  grupuri: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5.5M21 20a6 6 0 0 0-4-5.7"/></svg>`,
  membri: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6M22 11h-6"/></svg>`,
  evenimente: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>`,
  insigne: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M9 14l-1.5 7L12 18l4.5 3L15 14"/></svg>`,
  admin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
};

// ONE navigation, grouped — the old top tabs + sidebar were two competing
// systems and made wayfinding confusing. Everything now lives in the
// sidebar; a breadcrumb above the content always says where you are.
const NAV_GROUPS = [
  {
    title: "Comunitate",
    items: [
      { id: "forum", label: "Forum" },
      { id: "pagina-mea", label: "Pagina mea" },
      { id: "activitate", label: "Activitatea mea" },
      { id: "mesaje", label: "Mesaje" },
      { id: "exercitii", label: "Exerciții" },
    ],
  },
  {
    title: "Descoperă",
    items: [
      { id: "provocare", label: "Provocarea zilei" },
      { id: "clasament", label: "Clasament" },
      { id: "membri", label: "Membri" },
      { id: "grupuri", label: "Grupuri de studiu" },
      { id: "evenimente", label: "Evenimente" },
      { id: "insigne", label: "Insigne" },
    ],
  },
  {
    title: "Spațiul meu",
    items: [
      { id: "lectii", label: "Lecțiile mele" },
      { id: "salvate", label: "Salvate" },
      { id: "caiet", label: "Caietul meu" },
      { id: "puncte", label: "Puncte" },
      { id: "profil", label: "Profil" },
    ],
  },
];

// Flat list of every section id (for hash validation) + label lookup.
const ALL_SECTIONS = [...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)), "admin"];
// Member-only sections: the ADMIN (teacher) has no wall, points or badges —
// gamification belongs to students. (The "Logat" demo role previews those.)
const ADMIN_HIDDEN_SECTIONS = new Set(["pagina-mea", "puncte", "insigne"]);
// Every lesson in the "morfologie" domain — the "all of morphology" badge is
// earned only when ALL of them are really completed (lesson_progress).
const MORFOLOGIE_SLUGS = LESSONS.filter((l) => l.domain === "morfologie").map((l) => l.slug);

// What a GUEST may open: the public forum (read-only), the leaderboard,
// the daily challenge (a real taste, no points) and public profiles.
// Everything else invites them to join.
const GUEST_SECTIONS = new Set(["forum", "clasament", "provocare", "profil"]);

// Actions a guest may perform (read/view-only + the demo challenge).
// Anything else shows a friendly "join us" toast instead of failing silently.
const GUEST_ALLOWED_ACTIONS = new Set([
  "go", "nav-back", "feed-type", "feed-sort", "feed-more", "toggle-comments",
  "play-yt", "open-image", "lb-close", "lb-copy", "lb-save", "dismiss-notice",
  "challenge", "copy-profile-link",
]);

// A stand-in identity for guests, so "is this mine?" checks in the thread
// engine never match a real member's content.
const GUEST_USER = { id: -999, name: "Vizitator", initials: "?", color: "#94a3b8" };
const SECTION_LABELS = {
  ...Object.fromEntries(NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.label]))),
  admin: "Panou admin",
};

const ACTION_ICONS = {
  like: `♥`,
  save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>`,
  flag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4c4-2 8 2 12 0v9c-4 2-8-2-12 0"/></svg>`,
  comment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 20l1.4-4.2A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 15V3M8 7l4-4 4 4"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>`,
};

function parseYouTubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/);
  return m ? m[1] : /^[\w-]{6,}$/.test(url) ? url : null;
}

function freshComposer() {
  return {
    type: "discutie", bg: "none", media: null, text: "",
    audience: "public", // "public" | "members" | "friends" | "private"
    ytOpen: false, typeOpen: false, bgOpen: false,
    // Group-creation fields (used when type === "grup")
    groupName: "", iconId: 0, iconOpen: false,
  };
}

export function renderCommunity(basePath = "") {
  const mount = document.getElementById("community");
  if (!mount) return;

  // The daily challenge is REAL now (Supabase `challenges` + the
  // solve_challenge RPC): it loads in loadFeed (state.challenge /
  // state.challengeSolve) and the SERVER decides correctness + points.
  const todayStr = () => new Date().toISOString().slice(0, 10);
  // Lifetime count of solved daily challenges (drives a badge — still local
  // until badges are derived from real data in a later batch).
  const SOLVED_KEY = "atelier_challenges_solved";
  const challengesSolved = () => Number(localStorage.getItem(SOLVED_KEY) || 0);

  const state = {
    section: location.hash.slice(1) || "forum",
    // ONE unified post list (Facebook model): the forum shows every public
    // post; "Pagina mea" is just the filter of your own. Sorted newest-first.
    posts: [], // real posts load from Supabase (loadFeed) on first render
    members: [], // real member directory (surrogate ids, points desc) — leaderboard
    blockedIds: new Set(), // members I've blocked (their content is hidden)
    pointsHistory: [], // real points ledger (Puncte section)
    favorites: [], // real favorite lessons [{slug,title,href}]
    _feedLoaded: false,
    notes: [], // persistent notebook (Supabase; loaded in loadFeed)
    noteQuery: "",
    memberQuery: "", // "Membri" (discover) search
    editingNote: null, // note id being edited
    saved: new Set(), // real: populated from Supabase (saved_posts) in loadFeed
    feedLimit: 6, // forum pagination ("Încarcă mai mult")
    groupCreateOpen: false, // the "create group" composer in Grupuri
    proposed: [], // real exercises (pending + admin history) — loaded in loadFeed
    myApprovedEx: 0, // how many of my proposals were approved (badge)
    openComments: new Set(),
    playing: new Set(),
    composer: freshComposer(),
    exComposer: { open: false, lesson: LESSONS[0]?.title || "", kind: "choice" },
    thread: { openReplyId: null, openReactId: null, openEditId: null, warnId: null, warnMsg: null },
    activityTab: "primite",
    given: [], // "Oferite" — derived from my REAL posts/comments/likes/kudos
    myCounts: { posts: 0, comments: 0, likes: 0, given: 0 }, // real counts (badges)
    myLessons: new Set(), // lesson slugs I actually completed (lesson_progress)
    challengeAnswer: null, // revealed only after you answer (or to the teacher)
    exTab: "pending", // exercises section: "pending" | "history" (admin)
    exEditId: null, // proposal being edited by the admin (checked & polished)
    exEditWarn: null,
    histSort: { key: "date", dir: "desc" }, // history table sort
    histFilter: "all", // history table: "all" | "approved" | "rejected"
    challenge: null, // today's REAL challenge (loaded in loadFeed)
    challengeSolve: null, // my answer to it: { choice, correct } or null
    challengePending: false, // waiting for the server's verdict
    adminChallenges: [], // real challenges list (admin scheduling)
    groups: [], // real study groups (Supabase) — loaded (with posts) in loadFeed
    events: [], // real events (Supabase) — loaded in loadFeed (RLS-gated by event_access)
    openGroup: null, // id of the group topic being viewed
    addMemberOpen: false,
    editingPost: null, // post id being edited (author or admin)
    editingGroup: false, // editing the open group's details (admin/creator)
    editingEvent: null, // event id being edited (admin)
    newEventOpen: false, // admin "create event" form
    simLevel: null, // admin: simulate a level to preview the bar/frame
    simPrestige: 0, // admin: simulate prestige stars
    editingProfile: false, // profile edit mode
    needsName: false, // member must set first+last name before using the hub
    pickAvatar: undefined, // avatar chosen while editing (path or null)
    viewUser: null, // when set, the profile section shows this user's profile
    viewUserProfile: null, // { sid, loaded, data } — the viewed member's REAL profile (get_public_profile)
    // Forum discovery toolbar.
    feedQuery: "", // free-text search
    feedType: "all", // "all" | a POST_TYPES key
    feedSort: "new", // "new" | "top"
    // Inline notices/warnings (profanity filter & co).
    notice: null, // message shown under the post composer
    commentWarn: null, // { postId, msg } under a post's comment box
    exWarn: null, // under the exercise proposal composer
    groupWarn: null, // under the group post composer
    profileWarn: null, // in the profile edit form
    // Admin dashboard.
    adminTab: "overview", // "overview" | "users" | "moderation" | "challenges" | "gamification"
    adminUserQuery: "",
    adminUserSort: "points", // "points" | "name"
    adminUserPage: 1, // 10 per page
    adminUsers: [], // REAL members (Supabase) for the admin „Utilizatori" list
    contentReports: [], // REAL open reports (posts/comments/test items/exercises)
    reportItems: {},    // id → full test item behind a flagged-item report
    bonusQs: [],        // flying bonus questions (teacher-authored)
    downloads: [],      // downloadable tests (files on the teacher's Drive)
    settings: {},       // private settings: Drive key + folder per category
    driveFiles: {},     // slug → { loading, error, files } after a „Încarcă"
    profanityTerms: [], // admin-managed custom filtered words
    heldContent: [], // posts/comments held by the profanity filter (admin review)
    gateOff: false, // pre-launch gate kill-switch (app_flags.gate_off)
    chEditId: null, // the custom challenge being edited ("new" = fresh form)
    chWarn: null,
    lightbox: null, // { postId, i } — the enlarged post image
    prevNav: null, // one-step "←" snapshot (section/group/profile)
    postMenu: null, // post id with the "⋯" menu open
    composerOpen: false, // collapsed by default — expands on focus/click
    exPreview: false, // live preview of the exercise being proposed (hub)
    // Messaging (chat conversations; safe templates between members,
    // free text only ↔ teacher).
    msgOpen: null, // open conversation key ("t" | "u<id>" | "g:<name>")
    msgCat: -1, // template category (-1 = a taste of everything)
    msgQuery: "", // template search
    convQuery: "", // conversation/message search (left rail)
    msgParts: [], // templates chained into the message being composed
    msgWarn: null,
    conversations: [], // REAL conversations (Supabase) — loaded in loadFeed
    msgSlot: null, // a slotted template being filled ({opera}/{zi} pick)
    msgNewQuery: "", // "Conversație nouă" — search a member by name
    pendingMsgUuid: null, // #msg/<uuid> deep link → open that conversation after load
    pendingPostUuid: null, // #post/<uuid> deep link → open that post after the feed loads
    convLabels: {}, // admin inbox: member UUID → 'curent'|'incheiat'|'amanat'
    eventAccessUuids: new Set(), // members with Events access (auto "Evenimente")
    msgLabelFilter: "all", // admin inbox filter
  };
  const MSG_MAX_PARTS = 5;
  // Unread message count, derived from the REAL conversations.
  const unreadMsgCount = () => state.conversations.reduce((n, c) => n + (c.unread || 0), 0);
  // Deep links into a specific admin tab: #admin/moderare, #admin/utilizatori…
  // (used by the floating admin quick-panel, from any page of the site).
  const ADMIN_TAB_BY_SLUG = { prezentare: "overview", utilizatori: "users", moderare: "moderation", provocari: "challenges", gamificare: "gamification", bonus: "bonus", descarcabile: "downloads" };
  const ADMIN_SLUG_BY_TAB = Object.fromEntries(Object.entries(ADMIN_TAB_BY_SLUG).map(([s, t]) => [t, s]));
  function applyAdminHash() {
    const h = location.hash.slice(1);
    if (h !== "admin" && !h.startsWith("admin/")) return false;
    if (!isAdmin()) {
      state.section = "forum";
      return true;
    }
    state.section = "admin";
    // Plain #admin = the dashboard's start (Prezentare); #admin/<slug>
    // opens that exact tab. Without the reset, the last visited tab stuck
    // and "Panou admin" vs "Moderare" looked like the same destination.
    const slug = h.split("/")[1];
    state.adminTab = slug && ADMIN_TAB_BY_SLUG[slug] ? ADMIN_TAB_BY_SLUG[slug] : "overview";
    return true;
  }

  if (!applyAdminHash()) {
    if (!ALL_SECTIONS.includes(state.section)) state.section = "forum";
    if (state.section === "admin" && !isAdmin()) state.section = "forum";
  }

  // Shareable deep link: ...#u/<slug> opens that member's profile directly.
  applyUserHash();
  function applyUserHash() {
    const h = location.hash.slice(1);
    if (!h.startsWith("u/")) return false;
    const u = userBySlug(decodeURIComponent(h.slice(2)));
    state.section = "profil";
    state.viewUser = u && u.id !== CURRENT_USER.id ? u.id : null;
    loadViewUser(state.viewUser); // fetch their REAL profile (get_public_profile)
    return true;
  }

  // Notification deep link: ...#msg/<sender-uuid> → open that conversation
  // (resolved to the surrogate id once conversations have loaded).
  applyMsgHash();
  function applyMsgHash() {
    const h = location.hash.slice(1);
    if (!h.startsWith("msg/")) return false;
    state.section = "mesaje";
    state.pendingMsgUuid = decodeURIComponent(h.slice(4));
    return true;
  }

  // Notification deep link: ...#post/<post-uuid> → open the EXACT post once the
  // feed has loaded (resolved to its numeric surrogate id).
  applyPostHash();
  function applyPostHash() {
    const h = location.hash.slice(1);
    if (!h.startsWith("post/")) return false;
    state.section = "forum";
    state.pendingPostUuid = decodeURIComponent(h.slice(5));
    return true;
  }

  // findPost searches the unified feed and every group topic's posts, so
  // the shared like/comment/share/thread handlers work everywhere.
  const allPosts = () => [...state.posts, ...state.groups.flatMap((g) => g.posts)];
  const findPost = (id) => allPosts().find((p) => p.id === id);
  const findGroup = (id) => state.groups.find((g) => g.id === id);
  const canAddMembers = (g) =>
    isAdmin() || g.creatorId === CURRENT_USER.id || g.adderIds.includes(CURRENT_USER.id) ||
    (g.allowMembersAdd && g.memberIds.includes(CURRENT_USER.id));

  // Whether I'm allowed to see this post (audience gate, used everywhere a
  // post could surface: feed, spotlight, urmărite, profiles — no leaks).
  // Guests see ONLY public posts — so "🌐 Public" finally means public.
  const canSeePost = (p) => {
    if (!isLoggedIn()) return p.audience === "public";
    if (isAdmin() || p.authorId === CURRENT_USER.id) return true;
    if (p.audience === "private") return false;
    if (p.audience === "friends") return isFriend(p.authorId);
    return true; // public + members (and I'm logged in)
  };

  // A user's wall = their posts from the unified feed that I may see.
  // Group posts stay INSIDE their group (they never leak onto walls).
  const wallPostsOf = (id) => state.posts.filter((p) => p.authorId === id && p.surface === "wall" && canSeePost(p));

  // Remove a post from wherever it lives; reshares of it disappear too
  // (a share without its original is meaningless).
  function removePost(id) {
    for (const coll of [state.posts, ...state.groups.map((g) => g.posts)]) {
      const i = coll.findIndex((p) => p.id === id);
      if (i >= 0) {
        coll.splice(i, 1);
        state.posts = state.posts.filter((p) => p.shareOf !== id);
        return true;
      }
    }
    return false;
  }
  // The author (or admin) manages a post; members may report others'.
  // Guests manage nothing (they only borrow the id-0 mock identity).
  const canManagePost = (p) => isLoggedIn() && (isAdmin() || p.authorId === CURRENT_USER.id);
  // The creator of the OPEN group may moderate (delete) posts inside it — but not
  // EDIT them (canEditPost stays author/admin only). RLS enforces it server-side (0039).
  const isOpenGroupMine = () => { const g = findGroup(state.openGroup); return !!g && g.creatorId === CURRENT_USER.id; };
  // In a group topic I created, every post shown belongs to that group → I can moderate it.
  const canModeratePost = (p) => canManagePost(p) || (isLoggedIn() && state.section === "grupuri" && !!state.openGroup && isOpenGroupMine());
  const canPinHere = () => state.section === "grupuri" && !!state.openGroup && isOpenGroupMine();
  // The author may EDIT only in the 5-minute typo window (then delete-only);
  // admin edits anytime. Same rule as comments (Marius's rule).
  // A game-made capture is never editable — not even by the teacher. Its whole
  // value is that it shows the item exactly as it was solved; an editable copy
  // could be doctored and would still wear the „item" framing. Deleting it
  // stays allowed, and the server enforces the same rule (migration 0046).
  const canEditPost = (p) =>
    !p.generated && (isAdmin() || (canManagePost(p) && Date.now() - (p.createdAt || 0) < EDIT_WINDOW_MS));

  // Profanity gate for one text field: returns the offending words.
  const moderate = (text) => findProfanity(text || "");

  // The teacher marks a reply correct → the SERVER flips the flag AND awards
  // (or takes back) the author's points via mark_comment_correct (cheat-safe,
  // idempotent, persisted). Only the admin can mark; his OWN replies earn
  // nothing (he isn't in the game).
  function awardCorrect(c, nowCorrect) {
    if (!isAdmin()) return;
    markCommentCorrect(c.id, nowCorrect); // REAL: persisted + points on the server
    const mine = c.authorId === CURRENT_USER.id; // the teacher's own reply
    showToast(
      mine
        ? nowCorrect ? "✓ Marcat corect (răspunsul tău — fără puncte)" : "Marcaj retras"
        : nowCorrect
          ? `✓ Marcat corect — ${c.name} primește +${CORRECT_REWARD} puncte`
          : `Marcaj retras — ${CORRECT_REWARD} puncte retrase de la ${c.name}`,
      { kind: nowCorrect ? "success" : "info" }
    );
  }

  // Tiny audit trail: the admin's last actions, so "Prezentare" can show
  // the community's pulse at a glance. (Mock: store.js, capped at 20.)
  function logAdmin(text) {
    const log = store.get("atelier_admin_log", []);
    log.unshift({ t: Date.now(), text });
    store.set("atelier_admin_log", log.slice(0, 20));
  }

  // Resolve an activity entry to its source post: live entries carry a
  // postId; seeds carry a distinctive text fragment (postMatch).
  function resolveActivityPostId(a) {
    if (a.postId && findPost(a.postId)) return a.postId;
    if (a.postMatch) {
      const p = allPosts().find((x) => String(x.text).includes(a.postMatch));
      if (p) return p.id;
    }
    return null;
  }

  // Jump to a post from anywhere (activity rows): opens the right section
  // (forum or its group), expands the comments, scrolls and flashes it.
  function goToPost(id) {
    const inFeed = state.posts.some((p) => p.id === id);
    const group = inFeed ? null : state.groups.find((g) => g.posts.some((p) => p.id === id));
    if (!inFeed && !group) return;
    remember();
    if (group) {
      state.section = "grupuri";
      state.openGroup = group.id;
    } else {
      state.section = "forum";
      // The post must actually be visible: reset any filters hiding it.
      state.feedQuery = "";
      state.feedType = "all";
    }
    state.openComments.add(id);
    history.replaceState(null, "", `#${state.section}`);
    render();
    const card = mount.querySelector(`article[data-post-id="${id}"]`);
    if (card) {
      card.scrollIntoView({ block: "center", behavior: "smooth" });
      card.classList.add("post--flash");
      setTimeout(() => card.classList.remove("post--flash"), 1600);
    }
  }

  // Reshare toggle — used by the post footer AND the image lightbox (DRY).
  // Creates/removes the wrapper post on my wall and confirms with a toast.
  function toggleShare(p) {
    if (!p || p.shareOf || p.inGroup || p.audience !== "public") return; // only public posts travel
    p.sharedByMe = !p.sharedByMe;
    p.shares += p.sharedByMe ? 1 : -1;
    if (p.sharedByMe) {
      // A REAL reshare: a wrapper post lands on my wall (and the feed).
      state.posts.unshift({
        id: nextId(),
        authorId: CURRENT_USER.id,
        name: CURRENT_USER.name,
        initials: CURRENT_USER.initials,
        color: CURRENT_USER.color,
        createdAt: Date.now(),
        time: "acum",
        type: p.type,
        bg: "none",
        audience: "public",
        text: "",
        media: null,
        likes: 0,
        likedByMe: false,
        shares: 0,
        sharedByMe: false,
        followed: false,
        comments: [],
        surface: "forum",
        shareOf: p.id,
      });
      showToast("↪ Redistribuit — postarea apare acum pe Pagina ta", { kind: "success" });
    } else {
      // Un-share removes my wrapper.
      state.posts = state.posts.filter((x) => !(x.shareOf === p.id && x.authorId === CURRENT_USER.id));
      showToast("Redistribuirea a fost anulată");
    }
  }

  // "Raportează" on a post/comment → the admin's moderation queue. The
  // flag is remembered on the item so the button turns inert.
  function reportPost(p) {
    if (p.authorId === CURRENT_USER.id || p.reportedByMe) return;
    p.reportedByMe = true;
    reportPostBySurrogate(p.id); // REAL: persisted to the `reports` table for the profesor
  }
  function reportComment(c) {
    if (c.reportedByMe) return;
    confirmDialog("Comentariul va fi trimis profesorului spre verificare.", { title: "Raportezi comentariul?", okLabel: "Raportează" }).then((ok) => {
      if (!ok) return;
      c.reportedByMe = true;
      reportCommentBySurrogate(c.id); // REAL: persisted to the `reports` table
      showToast("⚑ Semnalat — profesorul va arunca o privire", { kind: "success" });
      render();
    });
  }

  const avatar = (init, color, cls = "") =>
    `<span class="cx-av ${cls}" style="--a:${color}">${init}</span>`;

  // Wrap an avatar in a level-styled ring with level + streak badges — used
  // everywhere a user's name & avatar appear (global consistency). Both the
  // data (userMeta) and the badge markup (badgeHtml) come from the shared
  // badges.js, so the leaderboard, hub and threads never drift apart.
  // Presence: green dot = active now, red = offline. "Me" is always here.
  const isUserOnline = (id) =>
    id === CURRENT_USER.id ? true : isOnlineSince((userById(id) || {}).lastSeen);
  const presenceDot = (id) =>
    isProfessor(id)
      ? "" // the teacher isn't part of presence — no online/offline dot
      : `<span class="cx-presence${isUserOnline(id) ? " is-on" : ""}" title="${isUserOnline(id) ? "activ acum" : "offline"}" aria-hidden="true"></span>`;

  const badged = (id, inner) => {
    // The teacher wears no level ring / badges — he's not in the game.
    if (isAdmin() && id === CURRENT_USER.id) return `<span class="cx-avwrap">${inner}${presenceDot(id)}</span>`;
    const m = userMeta(id);
    return `<span class="cx-avwrap">
        <span class="cx-ring" style="--ring:${m.fill}">${inner}</span>
        ${badgeHtml(m, "cx-bdg")}
        ${presenceDot(id)}
      </span>`;
  };

  // The current user's avatar — the chosen gif if set, else the initials.
  const meAvatar = (cls = "") => {
    const inner = MY_PROFILE.avatar
      ? `<span class="cx-av cx-av--gif ${cls}" style="background-image:url('${basePath}${MY_PROFILE.avatar}')" role="img" aria-label="Avatarul meu"></span>`
      : `<span class="cx-av ${cls}" style="--a:${CURRENT_USER.color}">${CURRENT_USER.initials}</span>`;
    return badged(CURRENT_USER.id, inner);
  };

  // Any user's avatar: the current user's chosen one, or a stable mock gif
  // for the other (seed) members — always ringed + badged.
  const userAvatar = (id, cls = "") => {
    if (id === CURRENT_USER.id) return meAvatar(cls);
    const u = userById(id) || {};
    // Real (Supabase) users show their CHOSEN gif if they picked one, else
    // initials in their colour. Seed users use a stable mock gif.
    const inner = u.real
      ? (u.avatar
          ? `<span class="cx-av cx-av--gif ${cls}" style="background-image:url('${basePath}${u.avatar}')" role="img" aria-label="${escapeHtml(u.name || "")}"></span>`
          : `<span class="cx-av ${cls}" style="--a:${u.color || "#7c5cff"}">${escapeHtml(u.initials || "?")}</span>`)
      : `<span class="cx-av cx-av--gif ${cls}" style="background-image:url('${basePath}${avatarForUser(id)}')" role="img" aria-label="${escapeHtml(u.name || "")}"></span>`;
    return badged(id, inner);
  };

  // Avatar URL for a thread comment's author (used by renderThread).
  // Real users → their chosen gif (or null = initials); seed → a mock gif.
  const avatarUrlFor = (id) => {
    if (id === CURRENT_USER.id) return MY_PROFILE.avatar ? `${basePath}${MY_PROFILE.avatar}` : null;
    const u = userById(id) || {};
    if (u.real) return u.avatar ? `${basePath}${u.avatar}` : null;
    return `${basePath}${avatarForUser(id)}`;
  };

  // A clickable label linking a proposal back to its source lesson page.
  // Falls back to plain text if the proposal has no known lesson slug.
  const lessonLink = (e) =>
    e.lessonSlug
      ? `<a class="cx-lessonlink" href="${basePath}${lessonHrefBySlug(e.lessonSlug)}" title="Mergi la lecția „${escapeHtml(e.lessonTitle)}”">📘 ${escapeHtml(e.lessonTitle)}</a>`
      : `<span class="cx-muted">${escapeHtml(e.lessonTitle)}</span>`;

  // ---- Friend graph helpers (mock, read/write MY_PROFILE arrays) ----
  const isFriend = (id) => MY_PROFILE.friendIds.includes(id);
  const reqIncoming = (id) => MY_PROFILE.friendReqIncoming.includes(id);
  const reqOutgoing = (id) => MY_PROFILE.friendReqOutgoing.includes(id);

  // The teacher/admin account. Their name & avatar are shown with a
  // "Profesor" tag and are NOT clickable — students must never be routed to
  // an admin surface. (Real role check still happens in the handlers.)
  // The professor = the ADMIN (by role), NOT "whoever is logged in". For me
  // (id 0) that's only true when I'm the admin; for other users it's their
  // real role. (Fixes a regular member showing up tagged "Profesor".)
  const isProfessor = (id) =>
    id === CURRENT_USER.id ? isAdmin() : (userById(id) || {}).role === "admin";
  const teacherTag = `<span class="cx-teacher" title="Profesor · cadru didactic">🎓 Profesor</span>`;

  // A user still exists (0 = me/professor; otherwise must be in the user
  // table). Deleted accounts keep their content, but every link to their
  // profile degrades to plain text.
  const userExists = (id) => id === CURRENT_USER.id || !!userById(id);

  // Every user link points to the shareable profile deep link (same page on
  // the hub → just the hash). The professor is never linkable; neither is a
  // deleted account.
  const profileHref = (id) => `#u/${slugForUser(id)}`;
  const userProfileHref = (id) => (isProfessor(id) || !userExists(id) ? null : profileHref(id));

  // Wrap an avatar in a real link to that user's profile — except the
  // professor's (inert) and deleted accounts' (inert too).
  const avatarLink = (id, cls = "") =>
    isProfessor(id)
      ? `<span class="cx-avteacher" title="Profesor">${userAvatar(id, cls)}</span>`
      : !userExists(id)
        ? `<span title="Cont șters">${userAvatar(id, cls)}</span>`
        : `<a class="cx-avlink" href="${profileHref(id)}" title="Vezi profilul">${userAvatar(id, cls)}</a>`;

  // A user name as a real link to their profile — except the professor's
  // (inert text + "Profesor" tag) and deleted accounts' (plain text).
  const userNameLink = (id, name, extraCls = "") =>
    isProfessor(id)
      ? `<span class="cx-username ${extraCls}">${teacherTag}</span>`
      : !userExists(id)
        ? `<span class="cx-username ${extraCls}" title="Cont șters">${escapeHtml(name)}</span>`
        : `<a class="cx-userlink ${extraCls}" href="${profileHref(id)}">${escapeHtml(name)}</a>`;

  // ---- @mentions plumbing ----
  // Render-time: "@Nume Prenume" in post/comment text becomes a real
  // profile link (professor & deleted accounts stay plain highlights).
  const decorateText = (text) => linkifyMentions(text, (u) => userProfileHref(u.id));

  // Can this friend SEE the post the mention lives on? (audience gate)
  const mentionEligibleForPost = (post) => (u) => {
    if (post.inGroup) {
      const g = state.groups.find((x) => x.posts.some((p) => p.id === post.id));
      return g && g.memberIds.includes(u.id) ? true : "nu e membru al acestui grup";
    }
    if (post.audience === "private")
      return "postarea e privată — n-o vede nimeni altcineva";
    if (post.audience === "friends" && post.authorId !== CURRENT_USER.id)
      return "postarea e doar pentru prietenii autorului, iar el/ea s-ar putea să n-o vadă";
    return true;
  };
  const mentionMsg = (bad) =>
    `Nu-l poți menționa pe @${bad[0].user.name}: ${bad[0].reason}.`;

  // A published text with @mentions sends each mentioned friend a REAL
  // notification (notify_mention RPC — the server forces the actor to be you
  // and enforces the friends-only rule).
  function notifyMentions(text, context) {
    for (const u of mentionsIn(text)) {
      notifyMention(u.id, String(text).slice(0, 90), context);
    }
  }

  // The four audience levels. Server-side RLS is what actually enforces them
  // (migration 0042); this is the label + picker the pupil sees.
  const AUD_META = {
    public: { icon: "🌐", label: "Public", title: "Vizibilă tuturor, chiar și vizitatorilor" },
    members: { icon: "🎓", label: "Elevii cu cont", title: "Vizibilă doar celor conectați" },
    friends: { icon: "👥", label: "Prieteni", title: "Vizibilă doar prietenilor tăi" },
    private: { icon: "🔒", label: "Doar eu", title: "Vizibilă doar ție" },
  };
  const audienceBadge = (a) => {
    const m = AUD_META[a] || AUD_META.public;
    return `<span class="post__aud" title="${m.title}">${m.icon} ${m.label}</span>`;
  };
  const audiencePicker = (a) => {
    const opt = (key) => {
      const m = AUD_META[key];
      return `<button type="button" class="cx-audopt${a === key ? " on" : ""}" data-action="set-audience" data-key="${key}" title="${m.title}">${m.icon} ${m.label}</button>`;
    };
    return `<div class="cx-audience" title="Cine vede postarea">${opt("public")}${opt("members")}${opt("friends")}${opt("private")}</div>`;
  };

  // ---------- Guest bits ----------
  // Instead of a wall, guests get the real (read-only) forum plus friendly
  // invitations exactly where an account would unlock something.
  function guestComposerInvite() {
    return `
      <div class="cx-guestinvite">
        <span>👋 Citești forumul ca vizitator. Cu un cont poți posta, comenta, câștiga puncte și streak.</span>
        <a class="btn btn--primary btn--sm" href="${basePath}comunitate/login/">Creează cont / Conectează-te</a>
      </div>`;
  }
  function guestGateCard(title, sub) {
    return `
      ${sectionHead(title, sub)}
      <div class="cx-gate">
        <div class="cx-gate__glow" aria-hidden="true"></div>
        <div class="cx-gate__mascot" aria-hidden="true">${mascotSvg("hello", 110)}</div>
        <h2>Zona asta e doar a membrilor</h2>
        <p>Fă-ți cont gratuit și primești pagina ta, caietul, punctele, streak-ul — tot tacâmul.</p>
        <div class="cx-gate__actions">
          <a class="btn btn--primary" href="${basePath}comunitate/login/">Conectează-te cu Google</a>
        </div>
      </div>`;
  }

  // ---------- Sidebar ----------
  function sidebar() {
    // Admin gets an extra group, visible only in the admin role. Badges:
    // "Activitatea mea" shows unread notifications; "Panou admin" shows
    // how many things await the teacher (proposals + moderation).
    // GUESTS get a slim, read-only navigation + a join card.
    const guest = !isLoggedIn();
    const attention = isAdmin() ? state.proposed.filter((e) => e.status === "pending").length + state.contentReports.length + state.heldContent.length : 0;
    const unread = guest ? 0 : unreadActivityCount();
    const friendReqs = guest || isAdmin() ? 0 : MY_PROFILE.friendReqIncoming.length;
    const groupNews = guest ? 0 : state.groups.filter(groupHasNews).length;
    const badgeFor = (id) =>
      id === "activitate" && unread
        ? `<span class="cx-side__badge" title="Notificări necitite">${unread}</span>`
        : id === "profil" && friendReqs
          ? `<span class="cx-side__badge" title="Cereri de prietenie în așteptare">${friendReqs}</span>`
          : id === "grupuri" && groupNews
            ? `<span class="cx-side__badge" title="Grupuri cu activitate nouă">${groupNews}</span>`
            : id === "mesaje" && !guest && unreadMsgCount()
              ? `<span class="cx-side__badge" title="Mesaje necitite">${unreadMsgCount()}</span>`
              : id === "admin" && attention
                ? `<span class="cx-side__badge" title="Necesită atenție">${attention}</span>`
                : "";
    const navGroups = [
      ...NAV_GROUPS.map((g) => ({
        ...g,
        // The teacher's sidebar hides the member-only, gamified sections;
        // a guest's shows only what guests may open.
        items: g.items.filter((i) => {
          // "Evenimente" shows only for the teacher or members granted access.
          if (i.id === "evenimente" && !isAdmin() && !MY_PROFILE.eventsAccess) return false;
          return guest ? GUEST_SECTIONS.has(i.id) && i.id !== "profil" : !isAdmin() || !ADMIN_HIDDEN_SECTIONS.has(i.id);
        }),
      })).filter((g) => g.items.length),
      ...(isAdmin() ? [{ title: "Administrare", items: [{ id: "admin", label: "Panou admin" }] }] : []),
    ];
    const groups = navGroups
      .map(
        (g) => `<div class="cx-side__group${g.title === "Administrare" ? " cx-side__group--admin" : ""}">
          <p class="cx-side__title">${g.title}</p>
          ${g.items
            .map(
              (s) => `<button class="cx-side__item${s.id === state.section ? " on" : ""}"${s.id === state.section ? ' aria-current="page"' : ""} data-action="go" data-id="${s.id}">
                <span class="cx-side__icon">${NAV_ICONS[s.id]}</span>
                <span class="cx-side__label">${s.label}</span>
                ${badgeFor(s.id)}
              </button>`
            )
            .join("")}
        </div>`
      )
      .join("");

    // (The role preview switch moved to the discreet global 🎭 button.)
    const meBox = guest
      ? `<div class="cx-side__me cx-side__me--guest">
           <span class="cx-av" style="--a:#94a3b8">?</span>
           <div class="cx-side__meid">
             <b>Vizitator</b>
             <a class="cx-side__join" href="${basePath}comunitate/login/">Creează cont →</a>
           </div>
         </div>
         <div class="cx-side__sell">
           <p class="cx-side__selltitle">Cu un cont primești:</p>
           <span class="cx-side__sellrow">🏅 puncte, niveluri și insigne</span>
           <span class="cx-side__sellrow">🔥 streak zilnic + provocări</span>
           <span class="cx-side__sellrow">🐌 loc în clasament (și poke!)</span>
           <span class="cx-side__sellrow">📓 caiet personal + progres salvat</span>
         </div>`
      : `<div class="cx-side__me">
           ${meAvatar("cx-av--lg")}
           <div class="cx-side__meid">
             <b>${isAdmin() ? "🎓 Profesor" : escapeHtml(CURRENT_USER.name)}${isAdmin() ? ' <span class="cx-adminchip">admin</span>' : ""}</b>
             <span class="cx-side__mini">
               ${isAdmin()
                 ? `<span>🎓 profesor · fără puncte</span>`
                 : `<span class="cx-flame">🔥 ${MY_PROFILE.streak}</span> · <span>${MY_PROFILE.points} pct</span>`}
             </span>
           </div>
         </div>`;

    return `
      <aside class="cx-side">
        ${meBox}
        <nav class="cx-side__nav">${groups}</nav>
      </aside>`;
  }

  // ---------- Post composer (forum + wall). Choosing the "Grup" type turns
  // it into a group-topic creator (name + one of 30 animated icons). -------
  function composer() {
    const c = state.composer;
    const isGroup = c.type === "grup";

    // Collapsed by default — one friendly line; the full toolkit (type,
    // background, media, audience) unfolds only when you actually write.
    if (!state.composerOpen && !isGroup && !c.text && !c.media) {
      return `
        <button type="button" class="cx-composer cx-composer--collapsed" data-action="composer-open">
          ${meAvatar()}
          <span class="cx-composer__hint">La ce te gândești? Scrie, întreabă, laudă-te…</span>
        </button>`;
    }

    const types =
      POST_TYPES.map(
        (t) => `<button type="button" class="cx-type${c.type === t.key ? " on" : ""}" data-action="set-type" data-key="${t.key}"
            style="--t:${t.color}" title="${t.hint}"><span class="cx-type__ic">${t.icon}</span><span>${t.label}</span></button>`
      ).join("") +
      `<button type="button" class="cx-type cx-type--group${isGroup ? " on" : ""}" data-action="set-type" data-key="grup"
          style="--t:#0891b2" title="Creează un topic de grup"><span class="cx-type__ic">${NAV_ICONS.grupuri}</span><span>Grup</span></button>`;

    // Group-creation extras
    const gi = groupIcon(c.iconId);
    const groupUI = isGroup
      ? `<div class="cx-grouprow">
           <button type="button" class="cx-iconpick" data-action="toggle-icon" title="Alege un icon pentru grup">
             <span class="gi gi--${gi.anim}">${gi.char}</span>
           </button>
           <input class="cx-input" id="cx-group-name" placeholder="Numele grupului…" value="${escapeHtml(c.groupName)}" />
         </div>
         ${c.iconOpen
           ? `<div class="cx-icongrid">${GROUP_ICONS.map(
               (ic) => `<button type="button" class="cx-iconopt${ic.id === c.iconId ? " on" : ""}" data-action="set-icon" data-id="${ic.id}"><span class="gi gi--${ic.anim}">${ic.char}</span></button>`
             ).join("")}</div>`
           : ""}`
      : "";

    const swatches = POST_BACKGROUNDS.map(
      (b) => `<button type="button" class="cx-swatch${c.bg === b.key ? " on" : ""}" data-action="set-bg" data-key="${b.key}"
          style="--sw:${b.swatch}" title="${b.label}" aria-label="${b.label}"></button>`
    ).join("");

    const media = isGroup ? "" : mediaPreview(c.media, true);
    const ytRow =
      !isGroup && c.ytOpen
        ? `<div class="cx-ytrow">
             <input class="cx-input" id="cx-yt-url" placeholder="Lipește linkul YouTube (se redă doar la click)…" />
             <button type="button" class="btn-mini" data-action="add-yt">Adaugă</button>
           </div>`
        : "";

    const tint = postBackground(c.bg);
    const tintStyle =
      isGroup || c.bg === "none" ? "" : `style="background:linear-gradient(135deg,${tint.from},${tint.to})"`;

    const tools = isGroup
      ? ""
      : `<div class="cx-composer__tools">
            <button type="button" class="cx-tool${c.ytOpen ? " on" : ""}" data-action="toggle-yt" title="Adaugă un clip YouTube">▶️ YouTube</button>
            <span class="cx-swatches" title="Culoare de fundal">${swatches}</span>
          </div>`;

    return `
      <div class="cx-composer" ${tintStyle}>
        <div class="cx-composer__top">
          ${meAvatar()}
          <textarea class="cx-input cx-composer__text" id="cx-post-text" rows="2"
            placeholder="${isGroup ? "Descrie pe scurt grupul (opțional)…" : "Împarte o idee, o întrebare sau o reușită cu comunitatea…"}">${escapeHtml(c.text)}</textarea>
        </div>
        ${groupUI}
        ${media}
        ${ytRow}
        <div class="cx-composer__types">${types}</div>
        <div class="cx-composer__bar">
          ${tools || "<span></span>"}
          <div class="cx-composer__send">
            ${isGroup ? "" : audiencePicker(c.audience)}
            <button type="button" class="btn btn--primary btn--sm" data-action="publish">${isGroup ? "Creează grupul" : "Publică"}</button>
          </div>
        </div>
      </div>`;
  }

  function mediaPreview(media, editable) {
    if (!media) return "";
    if (media.kind === "youtube") {
      return `<div class="cx-mediaprev">
          <span class="cx-mediaprev__yt">▶ YouTube: ${escapeHtml(media.title || media.videoId)}</span>
          ${editable ? `<button type="button" class="cx-x" data-action="clear-media" aria-label="Elimină">×</button>` : ""}
        </div>`;
    }
    return "";
  }

  // ---------- One post card (shared) ----------
  function postMedia(post) {
    if (!post.media) return "";
    if (post.media.kind === "youtube") {
      const id = post.media.videoId;
      if (state.playing.has(post.id)) {
        return `<div class="post__yt post__yt--live">
            <iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0"
              title="${escapeHtml(post.media.title || "YouTube")}" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>
          </div>`;
      }
      return `<button type="button" class="post__yt post__yt--facade" data-action="play-yt" data-id="${post.id}" aria-label="Redă clipul">
          <img class="post__yt__thumb" src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" onerror="this.style.display='none'" />
          <span class="post__yt__play" aria-hidden="true">▶</span>
          <span class="post__yt__title">${escapeHtml(post.media.title || "Clip YouTube")}</span>
        </button>`;
    }
    return "";
  }

  // ---------- Image lightbox ----------
  // Click a post image → it grows to (near) full screen with floating
  // actions: copy, save, share (the post), reply (about that image).
  // A click on the image or outside it closes; Esc works too.
  function lightboxHtml() {
    if (!state.lightbox) return "";
    const p = findPost(state.lightbox.postId);
    const im = p?.media?.images?.[state.lightbox.i];
    if (!p || !im) return "";
    const real = !!im.src;
    // Resharing is off until the author-consent flow (needs notifications):
    // a post can't be pushed to the forum without its author's approval.
    const canShare = false;
    const visual = real
      ? `style="background-image:url('${im.src}')"`
      : `style="background:${im.gradient}"`;
    // Arrows between the post's images (keyboard ←/→ works too).
    const total = p.media.images.length;
    const arrows = total > 1
      ? `<button type="button" class="cx-lightbox__arrow cx-lightbox__arrow--prev" data-action="lb-prev" aria-label="Imaginea anterioară">‹</button>
         <button type="button" class="cx-lightbox__arrow cx-lightbox__arrow--next" data-action="lb-next" aria-label="Imaginea următoare">›</button>
         <span class="cx-lightbox__count">${state.lightbox.i + 1} / ${total}</span>`
      : "";
    return `
      <div class="cx-lightbox" data-action="lb-close" role="dialog" aria-modal="true" aria-label="Imagine mărită">
        ${arrows}
        <figure class="cx-lightbox__fig">
          <div class="cx-lightbox__img${real ? "" : " cx-lightbox__img--ph"}" ${visual} data-action="lb-close">
            ${real ? "" : `<span>${escapeHtml(im.label || "")}</span>`}
          </div>
          <figcaption class="cx-lightbox__bar" aria-label="Acțiuni imagine">
            ${real ? `<button type="button" class="cx-lbbtn" data-action="lb-copy">📋 Copiază</button>
            <a class="cx-lbbtn" data-action="lb-save" href="${im.src}" download="atelierul-imagine-${p.id}-${state.lightbox.i + 1}.png">💾 Salvează</a>` : ""}
            ${canShare ? `<button type="button" class="cx-lbbtn" data-action="lb-share">↪ Distribuie postarea</button>` : ""}
            <button type="button" class="cx-lbbtn" data-action="lb-reply">💬 Răspunde la imagine</button>
          </figcaption>
        </figure>
      </div>`;
  }

  // A reshare renders as a slim wrapper: "X a redistribuit" + the original
  // embedded read-only. If the original vanished, the share explains itself.
  function shareCard(post) {
    const orig = findPost(post.shareOf);
    const inner = orig
      ? `<div class="post__embed">
           <header class="post__head post__head--embed">
             ${avatarLink(orig.authorId)}
             <div class="post__id">
               ${userNameLink(orig.authorId, orig.name, "post__name")}
               <span class="post__sub">${orig.time} · ${audienceBadge(orig.audience)}</span>
             </div>
           </header>
           <p class="post__text">${decorateText(orig.text)}</p>${postMedia(orig)}
         </div>`
      : `<p class="cx-muted post__embed post__embed--gone">Postarea originală nu mai există.</p>`;
    return { inner };
  }

  function postCard(post) {
    const t = postType(post.type);
    const bg = postBackground(post.bg);
    // A game capture is framed in ITS game's colour (amber for Drept, and so on
    // as the other categories go live).
    const frameCol = post.generated
      ? (TEST_CAT_BY_SLUG[post.generatedFrom]?.color || "#b45309")
      : null;
    const styleBits = [
      post.bg === "none" ? null : `--postfrom:${bg.from};--postto:${bg.to}`,
      frameCol ? `--post-frame:${frameCol}` : null,
    ].filter(Boolean).join(";");
    const tintStyle = styleBits ? `style="${styleBits}"` : "";
    const isMine = isLoggedIn() && post.authorId === CURRENT_USER.id;
    const isShare = !!post.shareOf;
    // Own posts: no like BUTTON (you can't like yourself), but the count of
    // likes you RECEIVED stays visible as a static (non-clickable) indicator.
    // Others — and guests (clicking invites them to join) — get the button.
    // The teacher likes others' content and sees his own received likes too.
    const likeBtn = isMine
      ? `<span class="post__act post__act--static" title="Aprecieri primite — nu-ți poți aprecia propria postare" aria-label="${post.likes} aprecieri primite">
            <span class="post__act__ic">${ACTION_ICONS.like}</span><span>${post.likes}</span>
          </span>`
      : `<button type="button" class="post__act${post.likedByMe ? " is-liked" : ""}" data-action="like" data-id="${post.id}">
            <span class="post__act__ic">${ACTION_ICONS.like}</span><span>${post.likes}</span>
          </button>`;
    const commentsCount = countComments(post.comments);
    const open = state.openComments.has(post.id);

    // Sharing: only PUBLIC posts travel. Anything narrower (members, friends,
    // private) or inside a group would leak past its intended audience once
    // the resharer picks their own.
    const shareBtn =
      isShare || post.audience !== "public" || post.inGroup
        ? ""
        : `<button type="button" class="post__act${post.sharedByMe ? " is-shared" : ""}" data-action="share" data-id="${post.id}"
             title="${post.sharedByMe ? "Anulează redistribuirea" : "Redistribuie pe pagina ta"}">
             <span class="post__act__ic">${ACTION_ICONS.share}</span><span>${post.shares}</span>
           </button>`;

    // Bookmark ("Salvate") — a primary action, stays in the footer.
    const savedNow = state.saved.has(post.id);
    const saveBtn = isLoggedIn()
      ? `<button type="button" class="post__act${savedNow ? " is-saved" : ""}" data-action="save-post" data-id="${post.id}"
          title="${savedNow ? "Scoate de la Salvate" : "Salvează postarea"}"><span class="post__act__ic">${ACTION_ICONS.save}</span></button>`
      : "";

    // Secondary actions (follow, report) fold into a "⋯" menu — the footer
    // stays breathable, everything stays one tap away. (Design critique M1.)
    const menuOpen = state.postMenu === post.id;
    const menuBtn = !isMine && isLoggedIn()
      ? `<span class="post__more">
           <button type="button" class="post__act${menuOpen ? " on" : ""}" data-action="post-menu" data-id="${post.id}" title="Mai multe" aria-expanded="${menuOpen}">⋯</button>
           ${menuOpen
             ? `<span class="post__menu">
                  <button type="button" class="post__menu__item" data-action="follow" data-id="${post.id}">
                    <span class="post__act__ic">${ACTION_ICONS.bell}</span>${post.followed ? "Nu mai urmări" : "Urmărește postarea"}
                  </button>
                  ${post.reportedByMe
                    ? `<span class="post__menu__item is-done"><span class="post__act__ic">${ACTION_ICONS.flag}</span>Raportat profesorului ✓</span>`
                    : `<button type="button" class="post__menu__item" data-action="post-report" data-id="${post.id}">
                        <span class="post__act__ic">${ACTION_ICONS.flag}</span>Raportează profesorului
                      </button>`}
                </span>`
             : ""}
         </span>`
      : "";
    const followedDot = post.followed && !isMine && isLoggedIn()
      ? `<span class="post__followdot" title="Urmărești postarea">${ACTION_ICONS.bell}</span>`
      : "";

    // Manage toolbar: the author EDITS only in the 5-minute window (admin
    // anytime); DELETING your own stays available forever.
    const manageBar = canModeratePost(post)
      ? `<span class="post__admin">
           ${canPinHere() ? `<button type="button" class="post__adminbtn" data-action="post-pin" data-id="${post.id}" title="${post.pinned ? "Anulează fixarea" : "Fixează în grup"}">${post.pinned ? "📌" : "📍"}</button>` : ""}
           ${isShare || !canEditPost(post) ? "" : `<button type="button" class="post__adminbtn" data-action="post-edit" data-id="${post.id}" title="Editează (5 min)">✎</button>`}
           <button type="button" class="post__adminbtn post__adminbtn--del" data-action="post-del" data-id="${post.id}" title="Șterge">🗑</button>
         </span>`
      : "";

    const editing = state.editingPost === post.id;
    const bodyInner = isShare
      ? shareCard(post).inner
      : editing
        ? `<div class="post__edit">
             <textarea class="cx-input" data-role="edit-post" rows="3">${post.text}</textarea>
             <div class="post__editactions">
               <button type="button" class="btn-mini" data-action="post-save" data-id="${post.id}">Salvează</button>
               <button type="button" class="btn-mini btn-mini--ghost" data-action="post-cancel-edit">Renunță</button>
             </div>
           </div>`
        : `<p class="post__text">${highlightQuery(decorateText(post.text))}</p>${postMedia(post)}`;

    const warn =
      state.commentWarn && state.commentWarn.postId === post.id
        ? `<p class="cx-warn" role="alert">⚠️ ${escapeHtml(state.commentWarn.msg)}</p>`
        : "";
    const composeRow = isLoggedIn()
      ? `<div class="cx-postcompose">
           ${meAvatar()}
           <textarea class="cx-input" placeholder="Scrie un comentariu…" data-role="post-comment-input"></textarea>
           <button type="button" class="btn-mini" data-action="post-comment" data-id="${post.id}">Trimite</button>
         </div>`
      : `<p class="cx-guestline">🔒 <a href="${basePath}comunitate/login/">Conectează-te</a> ca să comentezi, să apreciezi și să reacționezi.</p>`;
    const commentsBlock = open
      ? `<div class="post__comments" data-post-id="${post.id}">
           ${composeRow}
           ${warn}
           ${renderThread(post.comments, state.thread, isLoggedIn() ? CURRENT_USER : GUEST_USER, {
             isAdmin: isAdmin(),
             avatarUrl: (c) => avatarUrlFor(c.authorId),
             userMeta: (c) => (isAdmin() && c.authorId === CURRENT_USER.id ? null : userMeta(c.authorId)),
             userHref: (c) => userProfileHref(c.authorId),
             isProfessor: (authorId) => isProfessor(authorId),
             onReport: isLoggedIn() ? reportComment : undefined,
             isOnline: (authorId) => (isProfessor(authorId) ? null : isUserOnline(authorId)),
             decorateText: (t) => highlightQuery(decorateText(t)),
           })}
         </div>`
      : "";

    const edited = post.edited ? " · editat" : "";
    const sub = isShare
      ? `${post.time}${edited} · <span class="post__shared">↪ redistribuire</span> · ${audienceBadge(post.audience)}`
      : `${post.time}${edited} · ${audienceBadge(post.audience)}`;

    return `
      <article class="post ${post.bg !== "none" ? "post--tinted" : ""}${isShare ? " post--share" : ""}${post.generated ? " post--framed" : ""}" data-post-id="${post.id}" ${tintStyle}>
        <header class="post__head">
          ${avatarLink(post.authorId)}
          <div class="post__id">
            ${userNameLink(post.authorId, post.name, "post__name")}
            <span class="post__sub">${sub}</span>
          </div>
          <span class="post__type" style="--t:${t.color}"><span class="post__type__ic">${t.icon}</span>${t.label}</span>
          ${followedDot}
          ${manageBar}
        </header>
        <div class="post__body">
          ${bodyInner}
        </div>
        <footer class="post__foot${isLoggedIn() ? "" : " post__foot--ghost"}">
          ${likeBtn}
          <button type="button" class="post__act${open ? " on" : ""}" data-action="toggle-comments" data-id="${post.id}">
            <span class="post__act__ic">${ACTION_ICONS.comment}</span><span>${commentsCount}</span>
          </button>
          ${shareBtn}
          ${saveBtn}
          ${menuBtn}
        </footer>
        ${commentsBlock}
      </article>`;
  }

  // ---------- Sections ----------
  // The forum's discovery toolbar: search + type chips + Noi/Populare.
  function feedToolbar() {
    const typeChips = [{ key: "all", label: "Toate", color: "#64748b" }, ...POST_TYPES]
      .map(
        (t) => `<button type="button" class="cx-fchip${state.feedType === t.key ? " on" : ""}" style="--t:${t.color}"
            data-action="feed-type" data-key="${t.key}">${t.label}</button>`
      )
      .join("");
    const sortBtn = (key, label) =>
      `<button type="button" class="cx-fchip cx-fchip--sort${state.feedSort === key ? " on" : ""}" data-action="feed-sort" data-key="${key}">${label}</button>`;
    return `
      <div class="cx-feedbar">
        <input class="cx-input cx-feedbar__search" id="cx-feed-search" type="search"
          placeholder="Caută în forum…" value="${escapeHtml(state.feedQuery)}" />
        <span class="cx-feedbar__chips">${typeChips}</span>
        <span class="cx-feedbar__sort">${sortBtn("new", "Noi")}${sortBtn("top", "Populare")}</span>
      </div>`;
  }

  // Does any comment (at any depth) contain the query?
  function commentsMatch(list, q) {
    return (list || []).some(
      (c) => String(c.text).toLowerCase().includes(q) || commentsMatch(c.replies, q)
    );
  }

  // The forum feed everyone may see, with the toolbar's filters applied.
  // Search covers the post text, the author AND the comments underneath.
  function visibleForumPosts() {
    const q = state.feedQuery.trim().toLowerCase();
    let list = state.posts.filter((p) => p.surface === "forum" && canSeePost(p));
    if (state.feedType !== "all") list = list.filter((p) => p.type === state.feedType);
    if (q)
      list = list.filter(
        (p) =>
          String(p.text).toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          commentsMatch(p.comments, q)
      );
    return state.feedSort === "top"
      ? [...list].sort((a, b) => b.likes - a.likes)
      : [...list].sort((a, b) => b.createdAt - a.createdAt);
  }

  // Highlight the search term in rendered text (safe: input is already
  // escaped; we only wrap plain-text matches in <mark>).
  function highlightQuery(html) {
    const q = state.feedQuery.trim();
    if (q.length < 2 || state.section !== "forum") return html;
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${safe})`, "gi");
    // Touch only the TEXT between tags — never hrefs/attributes.
    return String(html)
      .split(/(<[^>]*>)/)
      .map((part) => (part.startsWith("<") ? part : part.replace(re, `<mark class="cx-mark">$1</mark>`)))
      .join("");
  }

  function sectionForum() {
    // Spotlight only over posts everyone can actually see (a friends-only
    // post must never be quoted publicly) and never over reshares.
    const spot = topPost(state.posts.filter((p) => p.surface === "forum" && canSeePost(p) && !p.shareOf && p.audience === "public"));
    const st = spot
      ? `<div class="cx-spotlight">
           <span class="cx-spotlight__badge">⭐ Postarea săptămânii</span>
           <p class="cx-spotlight__text">„${spot.text.replace(/<[^>]*>/g, "").slice(0, 120)}${spot.text.length > 120 ? "…" : ""}”</p>
           <span class="cx-spotlight__by">— ${userNameLink(spot.authorId, spot.name)} · ${spot.likes} aprecieri</span>
         </div>`
      : "";
    const visible = visibleForumPosts();
    // Pagination: show a slice + "Încarcă mai mult" (no endless wall).
    const shown = visible.slice(0, state.feedLimit);
    const remaining = visible.length - shown.length;
    const feed = shown.length
      ? shown.map(postCard).join("")
      : emptyState("Nimic aici", "Niciun rezultat pentru filtrele alese. Încearcă altă căutare.");
    const more = remaining > 0
      ? `<button type="button" class="cx-loadmore" data-action="feed-more">Încarcă mai mult <span class="cx-muted">(încă ${remaining})</span></button>`
      : "";
    return `
      ${sectionHead("Forum", "Întreabă, răspunde, laudă-te cu ce-ai învățat. Aici e agitația.")}
      ${st}
      ${isLoggedIn() ? composer() + composerNotice() : guestComposerInvite()}
      ${feedToolbar()}
      <div class="cx-feed">${feed}</div>
      ${more}`;
  }

  // The friendly note shown when the filter held a post for review.
  function composerNotice() {
    return state.notice
      ? `<div class="cx-notice" role="status">
           <span>🛡️ ${escapeHtml(state.notice)}</span>
           <button type="button" class="cx-x" data-action="dismiss-notice" aria-label="Închide">×</button>
         </div>`
      : "";
  }

  function sectionWall() {
    const mine = wallPostsOf(CURRENT_USER.id);
    const feed = mine.length
      ? mine.map(postCard).join("")
      : emptyState("Nicio postare încă", "Ce ai învățat azi? Spune-le prietenilor tăi.");
    return `
      ${sectionHead("Pagina mea", "Peretele tău personal. Ce publici aici NU apare în forum — rămâne pe pagina ta, vizibil publicului sau doar prietenilor, cum alegi.")}
      ${composer()}
      ${composerNotice()}
      <div class="cx-feed">${feed}</div>`;
  }

  function sectionActivity() {
    const TAB_ICONS = {
      primite: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/><path d="M8 11l4 4 4-4M12 3v12"/></svg>`,
      oferite: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>`,
      urmarite: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>`,
    };
    // Followed posts: from the feed + from groups I'm actually a member of.
    const followedPosts = [
      ...state.posts.filter((p) => p.followed && canSeePost(p)),
      ...state.groups
        .filter((g) => g.memberIds.includes(CURRENT_USER.id) || isAdmin())
        .flatMap((g) => g.posts.filter((p) => p.followed)),
    ];
    const received = receivedActivity(); // REAL notifications (shared with the 🔔 tray)
    const tabs = [
      { id: "primite", label: "Primite", count: received.length },
      { id: "oferite", label: "Oferite", count: state.given.length },
      { id: "urmarite", label: "Urmărite", count: followedPosts.length },
    ];
    const tabBar = `<div class="cx-tabs">${tabs
      .map(
        (t) => `<button class="cx-tabbtn${state.activityTab === t.id ? " on" : ""}" data-action="act-tab" data-id="${t.id}">
          <span class="cx-tabbtn__ic">${TAB_ICONS[t.id]}</span>${t.label}
          <span class="cx-tabbtn__n">${t.count}</span>
        </button>`
      )
      .join("")}</div>`;

    const actIcon = (kind) => {
      const k = ACTIVITY_KINDS[kind] || ACTIVITY_KINDS.comment;
      return `<span class="cx-actkind" style="--k:${k.color}" title="${k.label}">${k.icon}</span>`;
    };

    let body = "";
    if (state.activityTab === "primite" || state.activityTab === "oferite") {
      const list = state.activityTab === "primite" ? received : state.given;
      body = list
        .map((a) => {
          // Resolvable rows link to the post (or hub section) behind them.
          const srcId = resolveActivityPostId(a);
          const link = srcId
            ? { action: "act-open", id: srcId, label: "Vezi →" }
            : a.goSection
              ? { action: "go", id: a.goSection, label: "Deschide →" }
              : null;
          const openBtn = link
            ? `<button type="button" class="cx-actrow__go" data-action="${link.action}" data-id="${link.id}">${link.label}</button>`
            : "";
          const k = ACTIVITY_KINDS[a.kind] || ACTIVITY_KINDS.comment;
          return `<div class="cx-actrow cx-actrow--${a.kind}${a.read ? "" : " is-unread"}${link ? " cx-actrow--link" : ""}"${link ? ` data-action="${link.action}" data-id="${link.id}" role="link" tabindex="0"` : ""}>
            <span class="cx-actrow__avatar">
              ${a.authorId != null ? avatarLink(a.authorId) : `<span class="cx-av" style="--a:#94a3b8">🎓</span>`}
              ${actIcon(a.kind)}
            </span>
            <div class="cx-actrow__body">
              <span class="cx-actrow__kind" style="--k:${k.color}">${k.label}${a.read ? "" : ' · <b>nou</b>'}</span>
              <p class="cx-actrow__what"><b>${a.authorId === CURRENT_USER.id ? "Tu" : a.authorId != null ? userNameLink(a.authorId, a.name) : escapeHtml(a.name)}</b> ${escapeHtml(a.action)} <span class="cx-muted">· ${a.time}</span></p>
              <p class="cx-actrow__snip">„${escapeHtml(a.snippet)}”</p>
              <span class="cx-actrow__ctx">${escapeHtml(a.context)}</span>
            </div>
            ${openBtn}
          </div>`;
        })
        .join("");
    } else {
      body = followedPosts.length
        ? `<div class="cx-feed">${followedPosts.map(postCard).join("")}</div>`
        : emptyState("Nicio postare urmărită", "Apasă pe clopoțel la o postare din forum ca s-o urmărești aici.");
    }

    // Everything shown is now seen — the badge clears on the NEXT render,
    // so the "Nou" dots stay visible for this visit.
    markActivityRead();

    return `${sectionHead("Activitatea mea", "Cine te-a apreciat, cui i-ai răspuns, ce urmărești — pe scurt, viața ta de aici.")}${tabBar}<div class="cx-actlist">${body}</div>`;
  }

  // "Așa va arăta exercițiul tău" — read the form live and show a simple
  // rendition, so nobody submits a broken grilă by accident.
  function exPreviewHtml() {
    const prompt = mount.querySelector("#cx-ex-prompt")?.value.trim() || "(enunțul tău)";
    const form = readExerciseForm(mount, state.exComposer.kind);
    // The SAME renderer as everywhere else, so the preview is exactly what your
    // proposal will look like. Your own answer is shown (it's yours).
    const body = form.ok && form.data
      ? exercisePreviewHtml({ prompt, kind: state.exComposer.kind, data: form.data }, { showAnswer: true })
      : `<p class="cx-warn">⚠️ ${escapeHtml(form.error || "Completează câmpurile ca să vezi previzualizarea.")}</p>`;
    return `<div class="cx-expreview">
        <p class="cx-expreview__label">Așa va arăta:</p>
        ${body}
      </div>`;
  }

  function sectionExercises() {
    const kinds = EXERCISE_KINDS.map(
      (k) => `<button type="button" class="cx-kind${state.exComposer.kind === k.key ? " on" : ""}" data-action="ex-kind" data-key="${k.key}" title="${k.hint}">${k.label}</button>`
    ).join("");
    const lessonOpts = LESSONS
      .map((l) => `<option value="${escapeHtml(l.title)}"${state.exComposer.lesson === l.title ? " selected" : ""}>${escapeHtml(l.title)}</option>`)
      .join("");

    const composerBox = state.exComposer.open
      ? `<div class="cx-excompose">
           <label class="cx-label">Lecția</label>
           <select class="cx-input" id="cx-ex-lesson">${lessonOpts}</select>
           <label class="cx-label">Tipul exercițiului</label>
           <div class="cx-kinds">${kinds}</div>
           <label class="cx-label">Enunțul propus</label>
           <textarea class="cx-input" id="cx-ex-prompt" rows="3" placeholder="Scrie enunțul exercițiului tău…"></textarea>
           ${exerciseFormFields(state.exComposer.kind)}
           <div class="cx-excompose__actions">
             <button type="button" class="btn btn--primary btn--sm" data-action="ex-submit">Trimite propunerea</button>
             <button type="button" class="btn-mini" data-action="ex-preview">${state.exPreview ? "Ascunde previzualizarea" : "👁 Previzualizează"}</button>
             <button type="button" class="btn-mini btn-mini--ghost" data-action="ex-toggle">Renunță</button>
           </div>
           ${state.exPreview ? exPreviewHtml() : ""}
           ${state.exWarn ? `<p class="cx-warn" role="alert">⚠️ ${escapeHtml(state.exWarn)}</p>` : ""}
         </div>`
      : `<button type="button" class="cx-propose" data-action="ex-toggle">+ Propune un exercițiu</button>`;

    // Only proposals still awaiting a decision live in the "pending" tab; once
    // the admin approves/rejects, they move to the "history" tab.
    const pending = state.proposed.filter((e) => e.status === "pending").sort((a, b) => (b.votes || 0) - (a.votes || 0));
    const pendingList = pending.length
      ? pending
          .map((e) => {
            const k = exerciseKind(e.kind);
            // Admin edit mode: the proposal becomes a prefilled form —
            // check it, polish it, THEN approve it.
            if (isAdmin() && state.exEditId === e.id) {
              return `<div class="cx-excompose cx-excompose--edit">
                  ${exerciseEditFormHtml(e)}
                  <div class="cx-excompose__actions">
                    <button type="button" class="btn btn--primary btn--sm" data-action="ex-admin-save" data-id="${e.id}">Salvează modificările</button>
                    <button type="button" class="btn-mini btn-mini--ghost" data-action="ex-admin-cancel">Renunță</button>
                  </div>
                  ${state.exEditWarn ? `<p class="cx-warn" role="alert">⚠️ ${escapeHtml(state.exEditWarn)}</p>` : ""}
                </div>`;
            }
            const adminBar = isAdmin()
              ? `<div class="cx-ex__admin">
                   <button type="button" class="btn-mini" data-action="ex-admin-edit" data-id="${e.id}">✎ Editează</button>
                   <button type="button" class="btn-mini btn-mini--ok" data-action="admin-approve-ex" data-id="${e.id}">✓ Aprobă</button>
                   <button type="button" class="btn-mini btn-mini--no" data-action="admin-reject-ex" data-id="${e.id}">✕ Respinge</button>
                 </div>`
              : "";
            // You can't vote for your own proposal (same rule as self-like).
            const voteUi =
              e.authorId === CURRENT_USER.id
                ? `<span class="cx-ex__up cx-ex__up--own" title="Propunerea ta — colegii o votează">—</span>`
                : `<button type="button" class="cx-ex__up${e.votedByMe ? " on" : ""}" data-action="ex-vote" data-id="${e.id}" aria-label="Votează">▲</button>`;
            return `<div class="cx-ex">
                <div class="cx-ex__vote">
                  ${voteUi}
                  <b>${e.votes}</b>
                </div>
                <div class="cx-ex__body">
                  <div class="exprev-wrap is-pending" aria-disabled="true">
                    ${exercisePreviewHtml(e, { showAnswer: isAdmin() || e.authorId === CURRENT_USER.id })}
                  </div>
                  <div class="cx-ex__meta">
                    <span class="cx-tag cx-tag--${e.kind}">${k.label}</span>
                    <span class="cx-tag cx-tag--wait">în așteptare</span>
                    ${e.editedByAdmin ? `<span class="cx-tag" title="Verificată și ajustată de profesor">✎ verificată</span>` : ""}
                    ${lessonLink(e)}
                    <span class="cx-muted">· ${userNameLink(e.authorId, e.name)} · ${e.time}</span>
                  </div>
                  ${adminBar}
                </div>
              </div>`;
          })
          .join("")
      : `<p class="cx-muted cx-ex__empty">Nicio propunere în așteptare. Cele aprobate ajung la lecția lor.</p>`;

    // Tabs (admin only — regular users have no history to see).
    const showHistory = isAdmin();
    const activeTab = showHistory ? state.exTab || "pending" : "pending";
    let tabBar = "";
    let body = `<div class="cx-exlist">${pendingList}</div>`;
    if (showHistory) {
      const tabs = [
        { id: "pending", label: "În așteptare", count: pending.length },
        { id: "history", label: "Istoric", count: state.proposed.filter((e) => e.status !== "pending").sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0)).length },
      ];
      tabBar = `<div class="cx-tabs cx-tabs--sub">${tabs
        .map(
          (t) => `<button class="cx-tabbtn${activeTab === t.id ? " on" : ""}" data-action="ex-tab" data-id="${t.id}">
            ${t.label}<span class="cx-tabbtn__n">${t.count}</span>
          </button>`
        )
        .join("")}</div>`;
      body =
        activeTab === "history"
          ? proposalHistoryTable()
          : `<div class="cx-exlist">${pendingList}</div>`;
    }

    return `
      ${sectionHead("Exerciții propuse", "Propune exerciții pentru lecții și votează-le pe cele mai bune. Adminul le aprobă sau le respinge; cele aprobate apar la lecția respectivă.")}
      ${composerBox}
      ${tabBar}
      ${body}`;
  }

  const lessonTitleByHref = (href) => (LESSONS.find((l) => lessonHrefBySlug(l.slug) === href) || {}).title || "lecția";

  function sectionLessons() {
    const items = state.favorites
      .map(
        (f) => `<div class="cx-fav">
          <a class="cx-fav__link" href="${basePath}${f.href}">
            <span class="cx-fav__star" aria-hidden="true">⭐</span>
            <span class="cx-fav__title">${escapeHtml(f.title)}</span>
          </a>
          <button type="button" class="cx-fav__rm" data-action="fav-remove" data-slug="${escapeHtml(f.slug)}" title="Scoate de la favorite">×</button>
        </div>`
      )
      .join("");
    const body = state.favorites.length
      ? `<div class="cx-favs">${items}</div>`
      : emptyState("Nicio lecție favorită încă", "Deschide o lecție și apasă „⭐ Adaugă la favorite” — apare aici.");
    return `${sectionHead("Lecțiile mele", "Lecțiile pe care le-ai marcat ca preferate.")}${body}`;
  }

  function sectionNotebook() {
    const q = state.noteQuery.trim().toLowerCase();
    const list = q
      ? state.notes.filter((n) => (n.title + " " + n.text).toLowerCase().includes(q))
      : state.notes;

    const noteCard = (n) => {
      if (state.editingNote === n.id) {
        return `<div class="cx-note cx-note--edit" data-note-id="${n.id}">
            <input class="cx-input" data-role="note-title" value="${escapeHtml(n.title)}" />
            <textarea class="cx-input" data-role="note-text" rows="3">${escapeHtml(n.text)}</textarea>
            <div class="cx-note__actions">
              <button type="button" class="btn-mini" data-action="note-save" data-id="${n.id}">Salvează</button>
              <button type="button" class="btn-mini btn-mini--ghost" data-action="note-cancel">Renunță</button>
            </div>
          </div>`;
      }
      const lesson = n.lessonHref
        ? `<a class="cx-lessonlink" href="${basePath}${n.lessonHref}">📘 ${escapeHtml(lessonTitleByHref(n.lessonHref))}</a>`
        : "";
      return `<div class="cx-note" data-note-id="${n.id}">
          <div class="cx-note__head">
            <b>${escapeHtml(n.title)}</b>
            <span class="cx-note__tools">
              <span class="cx-muted">${n.when}</span>
              <button type="button" class="post__adminbtn" data-action="note-edit" data-id="${n.id}" title="Editează">✎</button>
              <button type="button" class="post__adminbtn post__adminbtn--del" data-action="note-del" data-id="${n.id}" title="Șterge">🗑</button>
            </span>
          </div>
          <p class="cx-note__text">${escapeHtml(n.text)}</p>
          ${lesson}
        </div>`;
    };

    const notes = list.length
      ? list.map(noteCard).join("")
      : q
        ? emptyState("Niciun rezultat", "Nicio notiță nu conține ce ai căutat.")
        : emptyState("Caiet gol", "Notează o regulă sau un truc ca să nu-l uiți.");

    const lessonOpts = [`<option value="">— fără lecție —</option>`]
      .concat(LESSONS.map((l) => `<option value="${escapeHtml(lessonHrefBySlug(l.slug))}">${escapeHtml(l.title)}</option>`))
      .join("");

    return `
      ${sectionHead("Caietul meu", "Notițe personale, doar pentru tine — cu editare, ștergere și legătură la lecție.")}
      <div class="cx-box cx-writer">
        <input class="cx-input" id="cx-note-title" placeholder="Titlu…" />
        <input class="cx-input" id="cx-note-text" placeholder="O notiță pentru tine…" />
        <select class="cx-input cx-writer__lesson" id="cx-note-lesson" title="Leagă notița de o lecție (opțional)">${lessonOpts}</select>
        <button type="button" class="btn-mini" data-action="add-note">Adaugă</button>
      </div>
      <input class="cx-input cx-notes__search" id="cx-note-search" type="search" placeholder="Caută în caiet…" value="${escapeHtml(state.noteQuery)}" />
      <div class="cx-notes">${notes}</div>`;
  }

  // ---------- Section: messages (chat-style conversations) ----------
  // ONE conversation per partner, chronological bubbles — the flow of the
  // discussion is always visible. Members talk through PREDEFINED
  // templates only (chainable into one message, searchable); free text
  // exists ONLY to/from the teacher.
  const msgTime = (ts) => new Date(ts).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  // WhatsApp-style delivery ticks, only on MY sent messages:
  //   ✓ gray = sent (recipient offline) · ✓✓ gray = delivered (online) ·
  //   ✓✓ blue = read.
  function msgTicks(m, partnerOnline) {
    if (m.read) return `<span class="cx-tick cx-tick--read" title="Citit">✓✓</span>`;
    if (partnerOnline) return `<span class="cx-tick" title="Livrat — e online">✓✓</span>`;
    return `<span class="cx-tick" title="Trimis">✓</span>`;
  }
  function msgBubble(m, mine, partnerOnline) {
    // Incoming messages from a member (not the teacher) can be reported.
    const reportBtn = !mine && !m.fromTeacher && m.id
      ? `<button type="button" class="cx-bubble__report" data-action="msg-report-msg" data-id="${m.id}" title="Raportează profesorului">⚑</button>`
      : "";
    return `<div class="cx-bubble${mine ? " cx-bubble--me" : ""}${m.fromTeacher ? " cx-bubble--teacher" : ""}${!mine && !m.read ? " is-unread" : ""}">
        <p class="cx-bubble__text">${escapeHtml(m.text).replace(/\n/g, "<br>")}</p>
        <span class="cx-bubble__meta">${msgTime(m.createdAt)}
          ${m.template ? `<span title="Mesaj din șabloanele sigure">🧩</span>` : ""}
          ${mine ? msgTicks(m, partnerOnline) : reportBtn}
        </span>
      </div>`;
  }
  // A clear day separator between messages from different days.
  function msgDayLabel(ts) {
    const d = new Date(ts);
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    if (sameDay(d, new Date())) return "Azi";
    if (sameDay(d, new Date(Date.now() - 864e5))) return "Ieri";
    return d.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  function renderBubbles(msgs, mineIs, partnerOnline) {
    let out = "";
    let lastDay = null;
    for (const m of msgs) {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        out += `<div class="cx-daysep"><span>${msgDayLabel(m.createdAt)}</span></div>`;
        lastDay = day;
      }
      out += msgBubble(m, mineIs(m), partnerOnline);
    }
    return out;
  }

  // The template picker: search + category chips + grid; every pick lands
  // in the compose strip, so ONE message can chain several templates.
  // Templates above your LEVEL show locked (🔒) — levelling up literally
  // gives you more to say.
  // The slot-fill box — shown when a {opera}/{zi} template is being completed.
  function slotPickerHtml() {
    const text = state.msgSlot;
    if (!text) return "";
    const label = (s) => (s === "opera" ? "operă / lecție" : s === "zi" ? "când" : s);
    const preview = escapeHtml(text.replace(/\{\w+\}/g, "___"));
    const pickers = slotsIn(text)
      .map((s) => `<label class="cx-slotpick"><span class="cx-muted">${label(s)}</span>
          <select class="cx-input" id="cx-slot-${s}">${slotOptions(s).map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}</select>
        </label>`)
      .join("");
    return `<div class="cx-slotbox">
        <p class="cx-slotbox__t">Completează: „${preview}"</p>
        <div class="cx-slotbox__row">${pickers}</div>
        <div class="cx-excompose__actions">
          <button type="button" class="btn-mini" data-action="msg-slot-add">Adaugă la mesaj</button>
          <button type="button" class="btn-mini btn-mini--ghost" data-action="msg-slot-cancel">Renunță</button>
        </div>
      </div>`;
  }

  // Free-text quota: 3 free messages per conversation + 1 for each 100 points.
  // A free message is ≤ 30 chars; templates stay unlimited. The SERVER enforces
  // this (send_free_message RPC) — the counter here just mirrors it.
  const freeAllowance = () => 3 + Math.floor((MY_PROFILE.points || 0) / 100);
  function freeMsgComposer(conv) {
    const used = conv.msgs.filter((m) => m.fromId === 0 && !m.fromTeacher && !m.template).length;
    const remaining = Math.max(0, freeAllowance() - used);
    const label = `<span class="cx-freecount">✍️ <b>${remaining}</b> ${remaining === 1 ? "mesaj liber rămas" : "mesaje libere rămase"}</span>`;
    if (remaining <= 0) {
      return `<div class="cx-freebox cx-freebox--empty">${label}
          <p class="cx-muted">Ai folosit mesajele libere aici. Adună puncte ca să primești altele — sau folosește șabloanele (nelimitate).</p>
        </div>`;
    }
    return `<div class="cx-freebox">
        ${label}
        <div class="cx-freerow">
          <input class="cx-input" id="cx-free-msg" type="text" maxlength="30" placeholder="Scrie liber (max 30 caractere)…" />
          <button type="button" class="btn-mini" data-action="msg-free-user">Trimite</button>
        </div>
        ${state.msgWarn ? `<p class="cx-warn" role="alert">⚠️ ${escapeHtml(state.msgWarn)}</p>` : ""}
      </div>`;
  }

  function templatePicker() {
    const level = levelInfo(MY_PROFILE.points).level;
    const stats = templateStats(level);
    const q = state.msgQuery.trim();
    const catIdx = state.msgCat;
    // A template button. Slotted templates show the blank as „…" and open the
    // slot picker on click; locked ones nudge to level up.
    const tplBtn = (i) =>
      i.lvl > level
        ? `<button type="button" class="cx-msgtpl cx-msgtpl--locked" data-action="msg-locked" data-lvl="${i.lvl}" title="Se deblochează la nivelul ${i.lvl}">🔒 ${escapeHtml(i.t.replace(/\{(\w+)\}/g, "…"))}<span class="cx-msgtpl__lvl">niv. ${i.lvl}</span></button>`
        : `<button type="button" class="cx-msgtpl${/\{\w+\}/.test(i.t) ? " cx-msgtpl--slot" : ""}" data-action="msg-pick" data-text="${escapeHtml(i.t)}">${escapeHtml(i.t.replace(/\{(\w+)\}/g, "…"))}</button>`;

    // 💡 Reply suggestions — templates that fit the last INCOMING message.
    const openConv = state.conversations.find((c) => c.key === state.msgOpen);
    const lastIncoming = openConv
      ? [...openConv.msgs].reverse().find((m) => !(m.fromId === 0 && !m.fromTeacher))
      : null;
    const suggs = lastIncoming && !q ? suggestReplies(intentOfTemplate(lastIncoming.text), level, 6) : [];
    const suggBox = suggs.length
      ? `<div class="cx-msgsugg"><p class="cx-muted">💡 Răspunsuri potrivite:</p><div class="cx-msggrid">${suggs.map(tplBtn).join("")}</div></div>`
      : "";

    const chips = [`<button type="button" class="cx-fchip${catIdx === -1 && !q ? " on" : ""}" data-action="msg-cat" data-i="-1">✨ Toate</button>`]
      .concat(MESSAGE_TEMPLATES.map(
        (c, i) => `<button type="button" class="cx-fchip${i === catIdx && !q ? " on" : ""}" data-action="msg-cat" data-i="${i}">${c.cat}</button>`
      ))
      .join("");
    let items; // [{ t, lvl }]
    if (q) {
      items = searchTemplates(q);
      if (!items.length) items = null;
    } else if (catIdx === -1) {
      items = MESSAGE_TEMPLATES.flatMap((c) => [
        ...c.items.filter((i) => i.lvl <= level).slice(0, 2),
        ...c.items.filter((i) => i.lvl > level).slice(0, 1),
      ]);
    } else {
      items = MESSAGE_TEMPLATES[Math.min(catIdx, MESSAGE_TEMPLATES.length - 1)].items;
    }
    const grid = items
      ? `<div class="cx-msggrid">${items.map(tplBtn).join("")}</div>`
      : `<p class="cx-muted">Niciun șablon nu se potrivește căutării. Încearcă alt cuvânt.</p>`;
    const statsLine = `<p class="cx-msgstats">🧩 <b>${stats.unlocked}</b> din <b>${stats.total}</b> șabloane deblocate${stats.nextLvl ? ` · următoarele vin la <b>nivelul ${stats.nextLvl}</b>` : " · le ai pe toate! 🎉"}</p>`;
    const strip = state.msgParts.length
      ? `<div class="cx-compose">
           <p class="cx-compose__label">Mesajul tău (${state.msgParts.length}${state.msgParts.length >= MSG_MAX_PARTS ? " · maxim atins" : ""}):</p>
           ${state.msgParts.map((p, i) => `<span class="cx-compose__part">${escapeHtml(p)}<button type="button" class="cx-compose__x" data-action="msg-part-del" data-i="${i}" title="Scoate">×</button></span>`).join("")}
           <div class="cx-excompose__actions">
             <button type="button" class="btn btn--primary btn--sm" data-action="msg-send">Trimite ✉️</button>
             <button type="button" class="btn-mini btn-mini--ghost" data-action="msg-parts-clear">Golește</button>
           </div>
         </div>`
      : `<p class="cx-muted cx-compose__hint">Apasă pe șabloane ca să-ți compui mesajul — poți înlănțui până la ${MSG_MAX_PARTS}.</p>`;
    return `
      ${suggBox}
      ${slotPickerHtml()}
      <input class="cx-input cx-msgsearch" id="cx-msg-search" type="search" placeholder="🔍 Caută un șablon…" value="${escapeHtml(q)}" />
      ${statsLine}
      <div class="cx-msgchips">${chips}</div>
      ${grid}
      ${strip}`;
  }

  // Teacher's inbox labels. "Evenimente" is auto (derived from event access);
  // the other three are set manually per member conversation.
  const CONV_LABELS = [
    { id: "curent", label: "Curent", color: "#2563eb" },
    { id: "incheiat", label: "Încheiat", color: "#16a34a" },
    { id: "amanat", label: "Amânat", color: "#f59e0b" },
  ];
  const convLabelId = (conv) =>
    conv.partnerId != null ? state.convLabels[uuidForSurrogate(conv.partnerId)] || null : null;
  const convHasEvents = (conv) =>
    conv.partnerId != null && state.eventAccessUuids.has(uuidForSurrogate(conv.partnerId));
  const convLabelChips = (conv) => {
    const m = CONV_LABELS.find((l) => l.id === convLabelId(conv));
    return `${m ? `<span class="cx-convlabel" style="--l:${m.color}">${m.label}</span>` : ""}${convHasEvents(conv) ? `<span class="cx-convlabel" style="--l:#7c3aed">🎟️</span>` : ""}`;
  };
  function adminLabelBar() {
    const count = (id) =>
      id === "all" ? state.conversations.length
        : id === "evenimente" ? state.conversations.filter(convHasEvents).length
          : state.conversations.filter((c) => convLabelId(c) === id).length;
    const chip = (id, label) =>
      `<button type="button" class="cx-fchip${state.msgLabelFilter === id ? " on" : ""}" data-action="msg-label-filter" data-id="${id}">${label} <span class="cx-muted">${count(id)}</span></button>`;
    return `<div class="cx-histfilter cx-msglabelbar">${chip("all", "Toate")}${CONV_LABELS.map((l) => chip(l.id, l.label)).join("")}${chip("evenimente", "🎟️ Evenimente")}</div>`;
  }
  function convLabelSetter(conv) {
    if (conv.partnerId == null) return "";
    const cur = convLabelId(conv);
    const btn = (l) => `<button type="button" class="cx-labelbtn${cur === l.id ? " on" : ""}" style="--l:${l.color}" data-action="msg-label" data-uid="${conv.partnerId}" data-label="${l.id}">${l.label}</button>`;
    return `<div class="cx-labelset"><span class="cx-muted">Etichetă:</span> ${CONV_LABELS.map(btn).join("")}${cur ? `<button type="button" class="cx-labelbtn cx-labelbtn--clear" data-action="msg-label" data-uid="${conv.partnerId}" data-label="">✕</button>` : ""}${convHasEvents(conv) ? ` <span class="cx-convlabel" style="--l:#7c3aed">🎟️ Evenimente (auto)</span>` : ""}</div>`;
  }

  // "Conversație nouă" — a search box + result cards (no giant dropdown). The
  // auto handle (@slug) disambiguates identical names; no user-chosen usernames
  // (safer for minors — nothing inappropriate to moderate).
  function newConversationBox(existingPartnerIds) {
    const q = state.msgNewQuery.trim();
    const ql = q.toLowerCase();
    const teacherOpt = !state.conversations.some((c) => c.teacher)
      ? `<button type="button" class="cx-newconv__item" data-action="msg-to-teacher">
           <span class="cx-av" style="--a:#7c3aed">🎓</span>
           <span class="cx-newconv__id"><b>Profesorul</b><span class="cx-muted">scrie-i cu cuvintele tale</span></span>
         </button>`
      : "";
    let results = "";
    if (ql.length >= 1) {
      const matches = state.members
        .map((id) => userById(id))
        .filter((u) => u && u.id !== CURRENT_USER.id && !existingPartnerIds.has(u.id) && (u.name || "").toLowerCase().includes(ql))
        .slice(0, 8);
      const nameCount = {};
      matches.forEach((u) => { const n = (u.name || "").toLowerCase(); nameCount[n] = (nameCount[n] || 0) + 1; });
      results = matches.length
        ? `<div class="cx-newconv__list">${matches
            .map((u) => {
              const dup = nameCount[(u.name || "").toLowerCase()] > 1;
              const meta = [u.status ? `„${escapeHtml(u.status)}”` : `Nivel ${levelInfo(u.points || 0).level}`, dup ? `@${slugForUser(u.id)}` : ""].filter(Boolean).join(" · ");
              return `<button type="button" class="cx-newconv__item" data-action="msg-to" data-uid="${u.id}">
                  ${userAvatar(u.id)}
                  <span class="cx-newconv__id"><b>${escapeHtml(u.name)}</b><span class="cx-muted">${meta}</span></span>
                </button>`;
            })
            .join("")}</div>`
        : `<p class="cx-muted cx-newconv__empty">Niciun coleg „${escapeHtml(q)}".${state.members.filter((id) => id !== CURRENT_USER.id).length ? "" : " Încă nu-s alți elevi înscriși."}</p>`;
    }
    return `<div class="cx-newconv">
        <input class="cx-input" id="cx-msg-search-user" type="search" placeholder="🔍 Scrie unui coleg — caută după nume…" value="${escapeHtml(q)}" />
        ${teacherOpt}
        ${results}
      </div>`;
  }

  function sectionMessages() {
    const asAdmin = isAdmin();
    const convs = state.conversations; // REAL conversations (Supabase)
    const shownConvs = asAdmin && state.msgLabelFilter !== "all"
      ? convs.filter((c) => (state.msgLabelFilter === "evenimente" ? convHasEvents(c) : convLabelId(c) === state.msgLabelFilter))
      : convs;
    // Search conversations by partner name OR message content.
    const cq = state.convQuery.trim().toLowerCase();
    const filteredConvs = cq
      ? shownConvs.filter((c) => (c.partnerName || "").toLowerCase().includes(cq) || c.msgs.some((m) => (m.text || "").toLowerCase().includes(cq)))
      : shownConvs;
    let open = convs.find((c) => c.key === state.msgOpen) || null;
    // Brand-new conversation (no messages yet) → synthesize an EMPTY one so the
    // composer shows. This is how you message ANYONE — no friendship needed.
    if (!open && state.msgOpen) {
      if (state.msgOpen === "t") {
        open = { key: "t", partnerId: null, partnerName: "Profesorul", teacher: true, guest: false, msgs: [], unread: 0 };
      } else if (state.msgOpen.startsWith("u")) {
        const pid = Number(state.msgOpen.slice(1));
        const u = userById(pid);
        if (u && pid !== CURRENT_USER.id) open = { key: state.msgOpen, partnerId: pid, partnerName: u.name || "Membru", teacher: false, guest: false, msgs: [], unread: 0 };
      }
    }

    // --- left rail: conversations + "new message" (SEARCH real members) ---
    const partnersInConvs = new Set(convs.map((c) => c.partnerId));
    // Members start conversations via a search box (not a giant dropdown); the
    // teacher only replies to incoming ones.
    const newBox = asAdmin ? "" : newConversationBox(partnersInConvs);
    const rail = convs.length || !asAdmin
      ? `<aside class="cx-chat__list">
          ${newBox}
          ${asAdmin ? adminLabelBar() : ""}
          ${convs.length > 1 ? `<input class="cx-input cx-chat__search" id="cx-conv-search" type="search" placeholder="Caută în mesaje…" value="${escapeHtml(state.convQuery)}" />` : ""}
          ${filteredConvs
            .map((c) => {
              const last = c.msgs[c.msgs.length - 1];
              const av = c.teacher
                ? `<span class="cx-av" style="--a:#7c3aed">🎓</span>`
                : c.guest
                  ? `<span class="cx-av" style="--a:#94a3b8">✉️</span>`
                  : userAvatar(c.partnerId); // plain (we're inside a <button> — no nested links)
              return `<button type="button" class="cx-chat__item${c.key === state.msgOpen ? " on" : ""}" data-action="msg-open" data-key="${c.key}">
                ${av}
                <span class="cx-chat__meta">
                  <b class="cx-chat__name">${escapeHtml(c.partnerName)}${c.guest ? ` <span class="cx-tag">vizitator</span>` : ""}</b>
                  <span class="cx-chat__snippet">${escapeHtml(last.text.split("\n")[0].slice(0, 42))}${last.text.length > 42 ? "…" : ""}</span>
                  ${asAdmin ? `<span class="cx-chat__labels">${convLabelChips(c)}</span>` : ""}
                </span>
                <span class="cx-chat__side">
                  <span class="cx-chat__time">${relTime(Math.max(0, Date.now() - last.createdAt))}</span>
                  ${c.unread ? `<b class="cx-chat__unread">${c.unread}</b>` : ""}
                </span>
              </button>`;
            })
            .join("")}
          ${!filteredConvs.length && cq ? `<p class="cx-muted" style="padding:.6rem">Niciun rezultat pentru „${escapeHtml(state.convQuery)}".</p>` : ""}
        </aside>`
      : "";

    // --- right pane: the open conversation ---
    let pane;
    if (!open) {
      pane = `<div class="cx-chat__pane cx-chat__pane--empty">
          ${emptyState("Alege o conversație", convs.length
            ? "Deschide o discuție din stânga sau începe una nouă."
            : asAdmin
              ? "Mesajele elevilor și ale vizitatorilor vor apărea aici."
              : "Începe o conversație cu un coleg sau scrie-i profesorului.")}
        </div>`;
    } else {
      const mineIs = (m) => (asAdmin ? m.fromTeacher === true : m.fromId === 0 && !m.fromTeacher);
      const partnerOnline = open.partnerId != null && !open.teacher ? isUserOnline(open.partnerId) : false;
      const bubbles = renderBubbles(open.msgs, mineIs, partnerOnline);
      const who = open.teacher
        ? `<span class="cx-teacher">🎓 Profesorul</span>`
        : open.guest
          ? `<b>${escapeHtml(open.partnerName)}</b> <span class="cx-tag">vizitator</span>`
          : userNameLink(open.partnerId, open.partnerName);
      // Composer: free text toward/from the teacher, safe templates
      // between members. (Server-side this will be enforced by RLS too.)
      const freeText = asAdmin || open.teacher;
      // A GUEST conversation can't be answered in-app (no account) — the
      // teacher replies by e-mail. Show the address instead of a composer.
      const composer = open.guest
        ? `<div class="cx-chat__composer">
             ${open.guestEmail
               ? `<p class="cx-guestmail">✉️ Răspunde-i pe e-mail: <a href="mailto:${escapeHtml(open.guestEmail)}"><b>${escapeHtml(open.guestEmail)}</b></a></p>`
               : `<p class="cx-muted">Vizitatorul nu a lăsat un e-mail — nu-i poți răspunde direct.</p>`}
           </div>`
        : freeText
          ? `<div class="cx-chat__composer">
               <textarea class="cx-input" id="cx-msg-free" rows="2" placeholder="${asAdmin ? "Răspunsul tău (text liber — ești profesorul)…" : "Scrie-i profesorului cu cuvintele tale…"}"></textarea>
               ${state.msgWarn ? `<p class="cx-warn" role="alert">⚠️ ${escapeHtml(state.msgWarn)}</p>` : ""}
               <div class="cx-excompose__actions">
                 <button type="button" class="btn btn--primary btn--sm" data-action="msg-free-send">Trimite ✉️</button>
               </div>
             </div>`
          : `<div class="cx-chat__composer">
               ${freeMsgComposer(open)}
               <p class="cx-muted cx-tplhint">…sau alege un șablon (nelimitate):</p>
               ${templatePicker()}
             </div>`;
      // Admin: label the member conversation right under the header.
      const labelSetter = asAdmin && open.partnerId != null ? convLabelSetter(open) : "";
      pane = `<div class="cx-chat__pane">
          <p class="cx-chat__head">${who}</p>
          ${labelSetter}
          <div class="cx-chat__scroll" id="cx-chat-scroll">${bubbles}</div>
          ${composer}
        </div>`;
    }

    return `
      ${sectionHead("Mesaje", asAdmin
        ? "Conversațiile cu elevii și vizitatorii. Le răspunzi cu text liber."
        : "Mesagerie sigură: conversații pe șabloane cu colegii, cuvintele tale doar către profesor.")}
      <div class="cx-chat">${rail}${pane}</div>`;
  }

  // ---------- Section: saved posts ("Salvate") ----------
  function sectionSaved() {
    const posts = [...state.saved].map((id) => findPost(id)).filter((p) => p && canSeePost(p));
    const feed = posts.length
      ? posts.map(postCard).join("")
      : emptyState("Nimic salvat încă", "Apasă 🔖 pe o postare din forum ca s-o regăsești aici.");
    return `
      ${sectionHead("Salvate", "Postările pe care ți le-ai pus deoparte.")}
      <div class="cx-feed">${feed}</div>`;
  }

  function pointsReasonLabel(reason) {
    const r = reason || "";
    if (r.startsWith("lesson:")) { const l = lessonBySlug(r.slice(7)); return l ? `Lecția «${l.title}»` : "Lecție finalizată"; }
    if (r.startsWith("exercise-solved:")) return "Exercițiu rezolvat";
    if (r.startsWith("exercise:")) return "Exercițiu propus, aprobat";
    if (r.startsWith("challenge")) return "Provocarea zilei";
    if (r.startsWith("test")) return "Răspuns corect la un test";
    if (r.includes("correct")) return "Răspuns marcat corect";
    return r || "Puncte";
  }

  function sectionPoints() {
    const rows = state.pointsHistory
      .map(
        (e) => `<li class="cx-plog">
          <span class="cx-plog__label">${escapeHtml(pointsReasonLabel(e.reason))}</span>
          <span class="cx-plog__when">${relTime(Math.max(0, Date.now() - e.when))}</span>
          <span class="cx-plog__pts${e.points < 0 ? " cx-plog__pts--neg" : ""}">${e.points > 0 ? "+" : ""}${e.points}</span>
        </li>`
      )
      .join("") || `<li class="cx-muted" style="padding:.5rem 0">Încă niciun punct — termină o lecție ca să începi!</li>`;
    // Level context — the page finally talks to the XP bar above it.
    const info = levelInfo(MY_PROFILE.points);
    const toNext = Math.max(0, Math.round(info.next - info.pointsInRun));
    const levelCard = `
      <div class="cx-box cx-levelcard">
        <div class="cx-levelcard__head">
          <b>Nivel ${info.level}</b>
          <span class="cx-muted">încă ${toNext.toLocaleString("ro-RO")} puncte până la nivelul ${Math.min(info.level + 1, MAX_LEVEL)}</span>
        </div>
        <div class="cx-levelcard__track"><span style="width:${Math.round(info.pct)}%"></span></div>
      </div>`;

    return `
      ${sectionHead("Puncte", "Fiecare lecție, exercițiu și zi de streak îți aduce puncte.")}
      ${levelCard}
      <div class="cx-box">
        <div class="cx-total"><b>${MY_PROFILE.points}</b><span>puncte în total</span></div>
        <ul class="cx-plist">${rows}</ul>
      </div>`;
  }

  const VIS_LABELS = {
    members: "Membri conectați",
    friends: "Doar prietenii",
    everyone: "Toată lumea (inclusiv nelogați)",
  };

  function profileBadges() {
    // The teacher's profile shows his role, not gamification stats.
    const items = isAdmin()
      ? [
          { icon: "🎓", label: "Profesor" },
          { icon: "🛡️", label: "Administrator" },
        ]
      : [
          { icon: "🔥", label: `Streak ${MY_PROFILE.streak} ${plural(MY_PROFILE.streak, "zi", "zile")}` },
          { icon: "🏅", label: `${MY_PROFILE.points} ${plural(MY_PROFILE.points, "punct", "puncte")}` },
          { icon: "📚", label: `${MY_PROFILE.lessons} ${plural(MY_PROFILE.lessons, "lecție", "lecții")}` },
          { icon: "✍️", label: "Primul comentariu" },
        ];
    return items
      .map((b) => `<span class="cx-badge"><span aria-hidden="true">${b.icon}</span> ${b.label}</span>`)
      .join("");
  }

  // Dispatcher: your own profile, or another member's (respecting privacy).
  // Fetch a member's REAL public profile (get_public_profile RPC — visibility
  // enforced server-side) when their profile opens. Seed users (no real uuid)
  // fall back to the transitional mock until their module goes real.
  function loadViewUser(sid) {
    state.viewUserProfile = null;
    const uuid = sid != null && sid !== CURRENT_USER.id ? uuidForSurrogate(sid) : null;
    if (!uuid) return;
    fetchPublicProfile(uuid).then((data) => {
      state.viewUserProfile = { sid, loaded: true, data: data || null };
      if (state.section === "profil" && state.viewUser === sid) render();
    });
  }

  // Another member's profile — REAL data. The RPC returns a row only if the
  // target's visibility lets me see it; otherwise a "locked" card. Seed users
  // (no uuid) use the transitional mock renderer.
  function otherProfile(id) {
    const uuid = uuidForSurrogate(id);
    if (!uuid) return otherProfileMock(id); // seed user (transitional)

    const back = `<div class="cx-profiletools">
        <button type="button" class="btn-mini cx-sharebtn" data-action="copy-profile-link" data-slug="${slugForUser(id)}">🔗 Copiază link</button>
      </div>`;
    const u = userById(id) || {};
    const nameGuess = u.name || "Membru";
    const vp = state.viewUserProfile;

    // Still fetching this member's real profile.
    if (!vp || vp.sid !== id || !vp.loaded) {
      return `
        ${sectionHead("Profil", "Cum îi vezi pe ceilalți în comunitate.")}
        ${back}
        <div class="cx-box cx-profile">
          <div class="cx-profile__row">
            ${avatarLink(id, "cx-av--xl")}
            <div class="cx-profile__id"><h3>${escapeHtml(nameGuess)}</h3><p class="cx-muted">se încarcă…</p></div>
          </div>
        </div>`;
    }

    const p = vp.data;
    // No row → the target's visibility forbids me → locked card.
    if (!p) {
      return `
        ${sectionHead("Profil", "Cum îi vezi pe ceilalți în comunitate.")}
        ${back}
        <div class="cx-box cx-profile cx-profile--locked">
          <div class="cx-profile__row">
            ${avatarLink(id, "cx-av--xl")}
            <div class="cx-profile__id"><h3>${escapeHtml(nameGuess)}</h3></div>
            ${isLoggedIn() && !isAdmin() ? friendButton(id) : ""}
          </div>
          <div class="cx-locked">
            <span class="cx-locked__ic" aria-hidden="true">🔒</span>
            <p>Acest profil este vizibil doar prietenilor. Trimite o cerere de prietenie ca să-l poți vedea.</p>
          </div>
        </div>`;
    }

    const fullName = [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.display_name || nameGuess;
    const status = p.status_line || "";
    const firstName = fullName.split(" ")[0] || "El/ea";
    const head = `<div class="cx-profile__row">
        ${avatarLink(id, "cx-av--xl")}
        <div class="cx-profile__id">
          <h3>${escapeHtml(fullName)}</h3>
          ${status ? `<p class="cx-muted">„${escapeHtml(status)}”</p>` : ""}
          <span class="cx-vis"><span aria-hidden="true">👁️</span> ${VIS_LABELS[p.visibility] || VIS_LABELS.members}</span>
        </div>
        <div class="cx-profileacts">
          ${isLoggedIn() && id !== CURRENT_USER.id ? `<button type="button" class="btn-mini cx-msgbtn" data-action="msg-to" data-uid="${id}">✉️ Mesaj</button>` : ""}
          ${isLoggedIn() && !isAdmin() ? friendButton(id) : ""}
        </div>
      </div>`;

    const badges = [
      { icon: "🏅", label: `${(p.points || 0).toLocaleString("ro-RO")} puncte` },
      { icon: "📈", label: `Nivel ${levelInfo(p.points || 0).level}` },
    ].map((b) => `<span class="cx-badge"><span aria-hidden="true">${b.icon}</span> ${b.label}</span>`).join("");

    const rows = [
      ["Nume complet", fullName],
      ["Clasa", p.grade],
      ["Localitate", p.locality],
      ["Școală", p.school],
      ["Pasiuni", p.passions],
    ].map(([k, v]) => `<div class="cx-inforow"><span class="cx-inforow__k">${k}</span><span class="cx-inforow__v">${v ? escapeHtml(v) : "—"}</span></div>`).join("");

    const theirPosts = wallPostsOf(id);
    const wall = theirPosts.length
      ? `<div class="cx-feed">${theirPosts.map(postCard).join("")}</div>`
      : `<p class="cx-muted cx-profile__empty">${escapeHtml(firstName)} n-a postat încă nimic vizibil pentru tine.</p>`;

    return `
      ${sectionHead("Profil", "Cum îi vezi pe ceilalți în comunitate.")}
      ${back}
      <div class="cx-box cx-profile">
        ${head}
        <div class="cx-badges">${badges}</div>
        <div class="cx-info">${rows}</div>
      </div>
      <h3 class="cx-profile__ph">Postările lui ${escapeHtml(firstName)}</h3>
      ${wall}`;
  }

  // Mandatory-name onboarding — a member with a Google nickname must set a real
  // first + last name before entering the community (so only that name shows).
  function nameGateScreen() {
    return `
      <div class="cx-namegate">
        <div class="cx-namegate__card">
          <span class="cx-namegate__ic" aria-hidden="true">👋</span>
          <h2>Bun venit! Cum te cheamă?</h2>
          <p>Ca să te recunoască colegii și profesorul, pune-ți numele real. Așa vei apărea peste tot cu numele tău — nu cu cel de la contul de Google.</p>
          <div class="cx-fieldgrid">
            <div><label class="cx-label">Prenume</label><input class="cx-input" id="ng-first" value="${escapeHtml(MY_PROFILE.firstName || "")}" placeholder="ex: Andrei" /></div>
            <div><label class="cx-label">Nume</label><input class="cx-input" id="ng-last" value="${escapeHtml(MY_PROFILE.lastName || "")}" placeholder="ex: Popescu" /></div>
          </div>
          ${state.profileWarn ? `<p class="cx-warn" role="alert">⚠️ ${escapeHtml(state.profileWarn)}</p>` : ""}
          <button type="button" class="btn btn--primary" data-action="save-name">Continuă →</button>
        </div>
      </div>`;
  }

  function sectionProfile() {
    if (state.viewUser && state.viewUser !== CURRENT_USER.id) return otherProfile(state.viewUser);
    // A guest has no own profile — invite them to make one.
    if (!isLoggedIn()) return guestGateCard("Profil", "Pagina ta din comunitate.");
    return ownProfile();
  }

  // The friend button for another user's profile — its label/action depends
  // on the current relationship (friend, requested, incoming, or none).
  function friendButton(id) {
    // The teacher isn't in the social game — no friend requests to the admin,
    // and you can't friend yourself.
    if (id === CURRENT_USER.id || (userById(id) || {}).role === "admin") return "";
    if (isFriend(id))
      return `<div class="cx-friendbtns">
          <span class="cx-friendtag">✓ Prieteni</span>
          <button type="button" class="btn-mini btn-mini--no" data-action="friend-remove" data-uid="${id}">Elimină</button>
        </div>`;
    if (reqIncoming(id))
      return `<div class="cx-friendbtns">
          <button type="button" class="btn-mini btn-mini--ok" data-action="friend-accept" data-uid="${id}">✓ Acceptă cererea</button>
          <button type="button" class="btn-mini btn-mini--ghost" data-action="friend-decline" data-uid="${id}">Refuză</button>
        </div>`;
    if (reqOutgoing(id))
      return `<button type="button" class="btn-mini" data-action="friend-cancel" data-uid="${id}">⏳ Cerere trimisă · anulează</button>`;
    return `<button type="button" class="btn btn--primary btn--sm" data-action="friend-add" data-uid="${id}">+ Adaugă prieten</button>`;
  }

  // Block/mute a member: you stop seeing their posts. Teacher isn't blockable
  // (handled by only showing this for non-admin targets, like friendButton).
  function blockButton(id) {
    const blocked = state.blockedIds.has(id);
    return `<button type="button" class="btn-mini btn-mini--ghost" data-action="${blocked ? "unblock" : "block"}" data-uid="${id}" title="${blocked ? "Deblochează" : "Nu-i mai vezi postările"}">${blocked ? "🚫 Deblochează" : "🚫 Blochează"}</button>`;
  }

  // TRANSITIONAL mock profile — used ONLY for seed users (from modules not yet
  // wired to Supabase, e.g. groups). Real members go through otherProfile()
  // below → real data via get_public_profile. Removed entirely in Batch 6.
  function otherProfileMock(id) {
    const pp = publicProfileOf(id);
    if (!pp) {
      state.viewUser = null;
      return ownProfile();
    }
    // Wayfinding lives in the breadcrumb now (Atelier › Profil › nume + ←).
    const back = `<div class="cx-profiletools">
        <button type="button" class="btn-mini cx-sharebtn" data-action="copy-profile-link" data-slug="${slugForUser(id)}">🔗 Copiază link</button>
      </div>`;
    const canView =
      pp.visibility === "everyone" ||
      (pp.visibility === "members" && isLoggedIn()) ||
      (pp.visibility === "friends" && isFriend(id)) ||
      isAdmin();

    const head = `<div class="cx-profile__row">
        ${avatarLink(id, "cx-av--xl")}
        <div class="cx-profile__id">
          <h3>${escapeHtml(pp.fullName)}</h3>
          <p class="cx-muted">„${escapeHtml(pp.status)}”</p>
          <span class="cx-vis"><span aria-hidden="true">👁️</span> ${VIS_LABELS[pp.visibility]}</span>
        </div>
        ${isLoggedIn() && !isAdmin() ? friendButton(id) + blockButton(id) : ""}
      </div>`;

    if (!canView) {
      return `
        ${sectionHead("Profil", "Cum îi vezi pe ceilalți în comunitate.")}
        ${back}
        <div class="cx-box cx-profile cx-profile--locked">
          ${head}
          <div class="cx-locked">
            <span class="cx-locked__ic" aria-hidden="true">🔒</span>
            <p>Acest profil este vizibil doar prietenilor. Trimite o cerere de prietenie ca să-l poți vedea.</p>
          </div>
        </div>`;
    }

    const badges = [
      { icon: "🏅", label: `${pp.points.toLocaleString("ro-RO")} ${plural(pp.points, "punct", "puncte")}` },
      { icon: "📈", label: `Nivel ${levelInfo(pp.points).level}` },
      { icon: "🔥", label: `Streak ${pp.streak} ${plural(pp.streak, "zi", "zile")}` },
      { icon: "📚", label: `${pp.lessons} ${plural(pp.lessons, "lecție", "lecții")}` },
      { icon: "🤝", label: `${pp.friendsCount} prieteni` },
    ]
      .map((b) => `<span class="cx-badge"><span aria-hidden="true">${b.icon}</span> ${b.label}</span>`)
      .join("");
    const rows = [
      ["Nume complet", pp.fullName],
      ["Clasa", pp.grade],
      ["Localitate", pp.locality],
      ["Pasiuni", pp.passions],
    ]
      .map(([k, v]) => `<div class="cx-inforow"><span class="cx-inforow__k">${k}</span><span class="cx-inforow__v">${v ? escapeHtml(v) : "—"}</span></div>`)
      .join("");

    // Their wall: only their FEED posts I'm allowed to see. Posts made
    // inside groups stay in those groups — they never leak onto the wall.
    const firstName = pp.fullName.split(" ")[0];
    const theirPosts = wallPostsOf(id);
    const wall = theirPosts.length
      ? `<div class="cx-feed">${theirPosts.map(postCard).join("")}</div>`
      : `<p class="cx-muted cx-profile__empty">${escapeHtml(firstName)} n-a postat încă nimic vizibil pentru tine.</p>`;

    return `
      ${sectionHead("Profil", "Cum îi vezi pe ceilalți în comunitate.")}
      ${back}
      <div class="cx-box cx-profile">
        ${head}
        <div class="cx-badges">${badges}</div>
        <div class="cx-info">${rows}</div>
      </div>
      <h3 class="cx-profile__ph">Postările lui ${escapeHtml(firstName)}</h3>
      ${wall}`;
  }

  function ownProfile() {
    const P = MY_PROFILE;
    const level = levelInfo(P.points).level;
    const champUnlocked = level >= CHAMPION_UNLOCK_LEVEL || isAdmin();

    // ---- Edit mode ----
    if (state.editingProfile) {
      const initialsOpt = `<button type="button" class="cx-gifopt cx-gifopt--initials${!state.pickAvatar ? " on" : ""}" data-action="profile-pick" data-gif="" title="Inițiale">
          <span class="cx-av" style="--a:${CURRENT_USER.color}">${CURRENT_USER.initials}</span></button>`;
      const gifs = AVATAR_GIFS.map(
        (g) => `<button type="button" class="cx-gifopt${state.pickAvatar === g ? " on" : ""}" data-action="profile-pick" data-gif="${g}"><img src="${basePath}${g}" alt="" loading="lazy" /></button>`
      ).join("");
      const champ = champUnlocked
        ? `<button type="button" class="cx-gifopt cx-gifopt--champ${state.pickAvatar === CHAMPION_GIF ? " on" : ""}" data-action="profile-pick" data-gif="${CHAMPION_GIF}" title="Champion — deblocat!"><img src="${basePath}${CHAMPION_GIF}" alt="" loading="lazy" /><span class="cx-gifopt__crown" aria-hidden="true">🏆</span></button>`
        : `<div class="cx-gifopt cx-gifopt--locked" title="Se deblochează la nivelul ${CHAMPION_UNLOCK_LEVEL}"><span class="cx-gifopt__lock" aria-hidden="true">🔒</span><span class="cx-gifopt__lvl">Champion · Nv ${CHAMPION_UNLOCK_LEVEL}</span></div>`;

      return `
        ${sectionHead("Editează profilul", "Completează-ți datele și alege-ți imaginea de profil.")}
        <div class="cx-box cx-profileform">
          <label class="cx-label">Imagine de profil</label>
          <div class="cx-gifgrid">${initialsOpt}${gifs}${champ}</div>

          <div class="cx-fieldgrid">
            <div><label class="cx-label">Prenume</label><input class="cx-input" id="pf-first" value="${escapeHtml(P.firstName)}" /></div>
            <div><label class="cx-label">Nume</label><input class="cx-input" id="pf-last" value="${escapeHtml(P.lastName)}" /></div>
            ${isAdmin() ? "" : `
            <div><label class="cx-label">Clasa</label><input class="cx-input" id="pf-grade" value="${escapeHtml(P.grade)}" placeholder="ex: clasa a X-a" /></div>
            <div><label class="cx-label">Localitate</label><input class="cx-input" id="pf-locality" value="${escapeHtml(P.locality)}" /></div>`}
          </div>
          ${isAdmin() ? "" : `
          <label class="cx-label">Școală <span class="cx-muted">(opțional)</span></label>
          <input class="cx-input" id="pf-school" value="${escapeHtml(P.school)}" />
          <label class="cx-label">Pasiuni</label>
          <textarea class="cx-input" id="pf-passions" rows="2">${escapeHtml(P.passions)}</textarea>
          <label class="cx-label">Provocări / dificultăți</label>
          <textarea class="cx-input" id="pf-challenges" rows="2">${escapeHtml(P.challenges)}</textarea>

          <label class="cx-label">Cine îmi poate vedea profilul</label>
          <select class="cx-input" id="pf-vis">
            ${Object.entries(VIS_LABELS).map(([k, v]) => `<option value="${k}"${P.visibility === k ? " selected" : ""}>${v}</option>`).join("")}
          </select>`}

          ${state.profileWarn ? `<p class="cx-warn" role="alert">⚠️ ${escapeHtml(state.profileWarn)}</p>` : ""}
          <div class="cx-excompose__actions">
            <button type="button" class="btn btn--primary btn--sm" data-action="save-profile">Salvează profilul</button>
            <button type="button" class="btn-mini btn-mini--ghost" data-action="cancel-profile">Renunță</button>
          </div>
        </div>`;
    }

    // ---- View mode ----
    const fullName = isAdmin() ? "Profesor" : ([P.firstName, P.lastName].filter(Boolean).join(" ") || CURRENT_USER.name);
    // The teacher's profile is just an identity — no student fields.
    const rows = (isAdmin()
      ? []
      : [
          ["Nume complet", fullName],
          ["Clasa", P.grade],
          ["Școală", P.school],
          ["Localitate", P.locality],
          ["Pasiuni", P.passions],
          // Personal struggles are between you and the teacher — never public.
          ["Provocări 🔒", P.challenges, "doar tu și profesorul vedeți asta"],
        ])
      .map(([k, v, hint]) => `<div class="cx-inforow"><span class="cx-inforow__k">${k}${hint ? ` <span class="cx-inforow__hint" title="${hint}">privat</span>` : ""}</span><span class="cx-inforow__v">${v ? escapeHtml(v) : "—"}</span></div>`)
      .join("");

    return `
      ${sectionHead("Profil", "Cum te văd ceilalți în comunitate.")}
      <div class="cx-box cx-profile cx-profile--cover">
        <div class="cx-profile__cover" aria-hidden="true"></div>
        <div class="cx-profile__row">
          ${meAvatar("cx-av--xl")}
          <div class="cx-profile__id">
            <h3>${isAdmin() ? teacherTag : escapeHtml(fullName)}</h3>
            <p class="cx-muted">„${escapeHtml(P.status)}” · ${isAdmin() ? "profesor · cont de administrare" : `membru din ${P.joined}`}</p>
            <span class="cx-vis"><span aria-hidden="true">👁️</span> ${VIS_LABELS[P.visibility]}</span>
          </div>
          <span class="cx-profiletools">
            <button type="button" class="btn-mini" data-action="edit-profile">✎ Editează profilul</button>
            <button type="button" class="btn-mini cx-sharebtn" data-action="copy-profile-link" data-slug="${slugForUser(CURRENT_USER.id)}">🔗 Copiază link</button>
          </span>
        </div>
        <div class="cx-badges">${profileBadges()}</div>
        <div class="cx-info">${rows}</div>
        <label class="cx-label" for="cx-status">Starea ta <span class="cx-muted">(max 10 cuvinte)</span></label>
        <div class="cx-statusedit">
          <input class="cx-input" id="cx-status" maxlength="90" value="${escapeHtml(P.status)}" />
          <button type="button" class="btn-mini" data-action="save-status">Salvează</button>
        </div>
        ${state.profileWarn ? `<p class="cx-warn" role="alert">⚠️ ${escapeHtml(state.profileWarn)}</p>` : ""}
        <p class="cx-muted" id="cx-wordcount">${P.status.trim().split(/\s+/).filter(Boolean).length}/10 cuvinte</p>
      </div>
      ${isAdmin() ? "" : friendsBox()}`;
  }

  // Incoming friend requests (accept/decline) + my friends list (own profile).
  function friendsBox() {
    const incoming = MY_PROFILE.friendReqIncoming;
    const friends = MY_PROFILE.friendIds;
    const reqRows = incoming.length
      ? incoming
          .map((id) => {
            const u = userById(id);
            if (!u) return "";
            return `<div class="cx-friendrow">
                ${avatarLink(id, "cx-av--sm")}
                ${userNameLink(id, u.name, "cx-friendrow__name")}
                <span class="cx-friendrow__act">
                  <button type="button" class="btn-mini btn-mini--ok" data-action="friend-accept" data-uid="${id}">Acceptă</button>
                  <button type="button" class="btn-mini btn-mini--ghost" data-action="friend-decline" data-uid="${id}">Refuză</button>
                </span>
              </div>`;
          })
          .join("")
      : `<p class="cx-muted">Nicio cerere nouă.</p>`;
    const friendCards = friends.length
      ? friends
          .map((id) => {
            const u = userById(id);
            if (!u) return "";
            return `<a class="cx-friendchip" href="${profileHref(id)}" title="Vezi profilul">
                ${userAvatar(id, "cx-av--sm")}<span>${escapeHtml(u.name.split(" ")[0])}</span>
              </a>`;
          })
          .join("")
      : `<p class="cx-muted">Încă n-ai prieteni adăugați.</p>`;
    return `
      <div class="cx-box">
        <div class="cx-admin__head"><h3>Cereri de prietenie${incoming.length ? ` · ${incoming.length}` : ""}</h3></div>
        <div class="cx-friendreqs">${reqRows}</div>
      </div>
      <div class="cx-box">
        <div class="cx-admin__head"><h3>Prietenii mei · ${friends.length}</h3></div>
        <div class="cx-friendgrid">${friendCards}</div>
      </div>`;
  }

  // ---------- Section: daily challenge + word of the day ----------
  function sectionChallenge() {
    const w = wordOfToday();
    const c = state.challenge; // today's REAL challenge (Supabase) or null
    const solve = state.challengeSolve; // { choice, correct } or null
    const answered = !!solve;
    const pending = state.challengePending;
    const myChoice = solve ? solve.choice : null;
    const wasCorrect = solve ? solve.correct : false;
    // The ANSWER is not in the browser (0024). It arrives only once you've used
    // your attempt (from solve_challenge) — or straight away for the teacher.
    const answer = state.challengeAnswer;
    const opts = c
      ? c.options
          .map((o, i) => {
            let cls = "cx-ch__opt";
            if (answered)
              cls += answer != null && i === answer
                ? " is-correct"
                : i === myChoice
                  ? " is-wrong"
                  : " is-dim";
            return `<button type="button" class="${cls}" data-action="challenge" data-i="${i}" ${answered || pending ? "disabled" : ""}>${escapeHtml(o)}</button>`;
          })
          .join("")
      : "";
    const okLabel = !isLoggedIn()
      ? `✓ Corect! Cu un cont primeai +${c ? c.reward : 15} puncte și streak 😉`
      : isAdmin()
        ? "✓ Corect!"
        : `✓ Corect! +${c ? c.reward : 15} puncte`;
    const feedback = pending
      ? `<div class="cx-ch__feedback">⏳ Se verifică…</div>`
      : answered
        ? `<div class="cx-ch__feedback ${wasCorrect ? "ok" : "no"}">
             <b>${wasCorrect ? okLabel : "✗ Aproape! Uite de ce:"}</b>
             <p>${escapeHtml(c ? c.explanation : "")}</p>
           </div>`
        : "";
    // The streak calendar: the last 14 days, active ones lit — the visual
    // memory that makes daily streaks addictive (in the healthy way).
    const cal = (() => {
      if (!isLoggedIn() || isAdmin()) return "";
      const { count, lastDay } = getStreakInfo();
      const last = lastDay ? new Date(lastDay + "T12:00") : null;
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 864e5);
        const diff = last ? Math.round((last - d) / 864e5) : -1;
        // Active = within the current run of `count` days ending lastDay.
        const active = last && diff >= 0 && diff < count;
        const label = d.toLocaleDateString("ro-RO", { weekday: "narrow" });
        days.push(`<span class="cx-cal__day${active ? " on" : ""}${i === 0 ? " today" : ""}" title="${d.toLocaleDateString("ro-RO")}">${label}</span>`);
      }
      return `<div class="cx-cal">
          <span class="cx-cal__flame">🔥 ${MY_PROFILE.streak} ${MY_PROFILE.streak === 1 ? "zi" : "zile"}</span>
          <div class="cx-cal__strip">${days.join("")}</div>
        </div>`;
    })();

    return `
      ${sectionHead("Provocarea zilei", "Un cuvânt nou și o întrebare rapidă — revino zilnic pentru puncte și streak.")}
      ${cal}
      <div class="cx-bento">
        <div class="cx-word">
          <span class="cx-word__badge">Cuvântul zilei</span>
          <h3 class="cx-word__w">${escapeHtml(w.word)} <span class="cx-word__type">${w.type}</span></h3>
          <p class="cx-word__def">${escapeHtml(w.definition)}</p>
          <p class="cx-word__ex">„${escapeHtml(w.example)}”</p>
          <div class="cx-word__syn">
            ${w.synonyms.map((s) => `<span class="cx-chip cx-chip--syn">= ${escapeHtml(s)}</span>`).join("")}
            ${w.antonyms.map((s) => `<span class="cx-chip cx-chip--ant">≠ ${escapeHtml(s)}</span>`).join("")}
          </div>
        </div>
        <div class="cx-ch">
          <span class="cx-ch__badge">Provocare</span>
          ${c
            ? `<p class="cx-ch__q">${escapeHtml(c.prompt)}</p>
          <div class="cx-ch__opts">${opts}</div>
          ${feedback}`
            : `<p class="cx-ch__q cx-muted">Nicio provocare azi. Revino mâine — profesorul pregătește una nouă.</p>`}
        </div>
      </div>`;
  }

  // ---------- Section: leaderboard ----------
  // Alive, not a list: podium with auras + applause (the top feels SEEN),
  // a "🚀 în formă" chip for the week's biggest climber, and "Zona ta" —
  // your neighbours, progress toward the one above, a daily 👉 Poke and a
  // snail 🐌 that starts climbing after you poke. (By design, names here
  // stay non-clickable; right-click still offers "copiază numele".)
  function clapBtnCx(u) {
    const done = hasClapped(u.id);
    return `<button type="button" class="cx-clap${done ? " is-done" : ""}" data-action="clap" data-uid="${u.id}"
        title="${done ? "Ai aplaudat azi" : `Aplaudă-l pe ${escapeHtml(u.name.split(" ")[0])}`}">
        👏 <span>${clapsFor(u.id)}</span>
      </button>`;
  }

  function sectionLeaderboard() {
    // REAL members from Supabase (points desc), me included as id 0. No more
    // invented colleagues — this is the actual community.
    const memberRow = (id) =>
      id === CURRENT_USER.id
        ? { id, name: CURRENT_USER.name, points: MY_PROFILE.points, lessons: MY_PROFILE.lessons, streak: MY_PROFILE.streak }
        : userById(id);
    const rows = state.members
      .map(memberRow)
      .filter(Boolean)
      .sort((a, b) => (b.points || 0) - (a.points || 0));

    // Honest low/empty state — we NEVER invent people to fill the board.
    if (rows.length < 3) {
      return `
        ${sectionHead("Clasament", "Cei mai activi membri ai comunității.")}
        ${emptyState("Clasamentul prinde viață în curând", "Pe măsură ce membrii termină lecții și adună puncte, urcă aici — iar primii din top primesc aplauze.")}`;
    }

    const top = rows.slice(0, 10);
    const myIndex = rows.findIndex((r) => r.id === CURRENT_USER.id);
    const myRank = myIndex >= 0 ? myIndex + 1 : null;

    // Podium (top 3) — crowned, with animated auras + applause. You can't
    // applaud yourself (same spirit as no self-like).
    const CROWNS = ["👑", "🥈", "🥉"];
    const pod = (u, i) =>
      u
        ? `<div class="cx-pod cx-pod--${i + 1}">
            <span class="cx-pod__aura" aria-hidden="true"></span>
            <span class="cx-pod__crown" aria-hidden="true">${CROWNS[i]}</span>
            ${userAvatar(u.id, "cx-av--lg")}
            <b class="cx-pod__name" data-user-name>${escapeHtml((u.name || "Membru").split(" ")[0])}</b>
            <span class="cx-pod__pts">${(u.points || 0).toLocaleString("ro-RO")}</span>
            ${u.id === CURRENT_USER.id ? "" : clapBtnCx(u)}
            <span class="cx-pod__base">${i + 1}</span>
          </div>`
        : "";
    const podium = `<div class="cx-podium">${pod(top[1], 1)}${pod(top[0], 0)}${pod(top[2], 2)}</div>`;

    // Ranks 4–10.
    const list = top
      .slice(3)
      .map((u, i) => {
        const meta = [u.lessons ? `${u.lessons} ${plural(u.lessons, "lecție", "lecții")}` : "", u.streak ? `🔥 ${u.streak}` : ""].filter(Boolean).join(" · ");
        return `<div class="cx-lb__row">
          <span class="cx-lb__rank">${i + 4}</span>
          ${userAvatar(u.id)}
          <div class="cx-lb__id"><b data-user-name>${escapeHtml(u.name || "Membru")}</b>${meta ? `<span class="cx-muted">${meta}</span>` : ""}</div>
          ${u.id === CURRENT_USER.id ? "" : clapBtnCx(u)}
          <span class="cx-lb__pts">${(u.points || 0).toLocaleString("ro-RO")}</span>
        </div>`;
      })
      .join("");

    // ---- "Zona ta": my neighbours + progress + Poke + snail. Members only
    // (the teacher and guests have no rank). ----
    let zone = "";
    if (isLoggedIn() && !isAdmin() && myIndex >= 0) {
      const above = rows[myIndex - 1] || null;
      const below = rows[myIndex + 1] || null;
      if (above) {
        const gap = Math.max(0, (above.points || 0) - MY_PROFILE.points);
        const pct = Math.max(4, Math.min(96, above.points ? (MY_PROFILE.points / above.points) * 100 : 100));
        const poked = hasPoked(above.id);
        const pokeUi = poked
          ? `<span class="cx-poke is-done" title="Poke trimis azi">👉 Poke trimis ✓</span>`
          : `<button type="button" class="cx-poke" data-action="poke" data-uid="${above.id}" title="Dă-i de știre că te apropii">👉 Poke</button>`;
        const snail = poked
          ? `<span class="cx-zone__snail" style="--from:${pct}%" title="Melcul tău urcă spre ${escapeHtml((above.name || "").split(" ")[0])}…">🐌</span>`
          : "";
        zone = `
          <div class="cx-zone">
            <div class="cx-zone__head"><h3>Zona ta</h3><span class="cx-muted">locul <b>#${myRank}</b> din ${rows.length}</span></div>
            <div class="cx-zone__row cx-zone__row--target">
              ${userAvatar(above.id, "cx-av--sm")}
              <span class="cx-zone__who"><b data-user-name>${escapeHtml(above.name || "Membru")}</b> <span class="cx-muted">· #${myRank - 1} · ${(above.points || 0).toLocaleString("ro-RO")} pct</span></span>
              ${pokeUi}
            </div>
            <div class="cx-zone__trackwrap">
              <div class="cx-zone__track"><span class="cx-zone__fill" style="width:${pct}%"></span>${snail}</div>
              <span class="cx-zone__gap">îți mai trebuie <b>${gap.toLocaleString("ro-RO")}</b> puncte ca să-l întreci</span>
            </div>
            <div class="cx-zone__row cx-zone__row--me">
              ${meAvatar("cx-av--sm")}
              <span class="cx-zone__who"><b>Tu</b> <span class="cx-muted">· #${myRank} · ${MY_PROFILE.points.toLocaleString("ro-RO")} pct</span></span>
            </div>
            ${below
              ? `<div class="cx-zone__row cx-zone__row--chaser">
                  ${userAvatar(below.id, "cx-av--sm")}
                  <span class="cx-zone__who"><b data-user-name>${escapeHtml(below.name || "Membru")}</b> <span class="cx-muted">· e la ${Math.max(0, MY_PROFILE.points - (below.points || 0)).toLocaleString("ro-RO")} puncte în spatele tău — nu te lăsa!</span></span>
                </div>`
              : ""}
          </div>`;
      } else {
        zone = `<div class="cx-zone"><div class="cx-zone__head"><h3>Zona ta</h3><span class="cx-muted">locul <b>#1</b> — ești în vârf! 👑</span></div></div>`;
      }
    }

    return `
      ${sectionHead("Clasament", "Cei mai activi membri ai comunității. Aplaudă-i pe cei din top — și ia-le locul.")}
      ${podium}
      <div class="cx-lb">${list}</div>
      ${zone}`;
  }

  // ---------- Section: members directory (discover REAL people) ----------
  function sectionMembers() {
    const q = state.memberQuery.trim().toLowerCase();
    const list = state.members
      .filter((id) => id !== CURRENT_USER.id && !state.blockedIds.has(id))
      .map((id) => userById(id))
      .filter(Boolean);
    const filtered = q ? list.filter((u) => (u.name || "").toLowerCase().includes(q)) : list;
    const card = (u) => `
      <div class="cx-membercard">
        ${avatarLink(u.id)}
        <div class="cx-membercard__id">
          ${userNameLink(u.id, u.name)}
          <span class="cx-muted">${u.status ? `„${escapeHtml(u.status)}”` : `${(u.points || 0).toLocaleString("ro-RO")} pct · Nivel ${levelInfo(u.points || 0).level}`}</span>
        </div>
        ${isLoggedIn() && !isAdmin() ? friendButton(u.id) : ""}
      </div>`;
    const grid = filtered.length
      ? `<div class="cx-membergrid">${filtered.map(card).join("")}</div>`
      : emptyState(q ? "Niciun membru găsit" : "Încă nu sunt membri de descoperit", q ? "Încearcă alt nume." : "Pe măsură ce se alătură colegi, apar aici.");
    return `
      ${sectionHead("Membri", "Descoperă colegi din comunitate și adaugă-i ca prieteni.")}
      <input class="cx-input cx-members__search" id="cx-member-search" type="search" placeholder="Caută un membru după nume…" value="${escapeHtml(state.memberQuery)}" />
      ${grid}`;
  }

  // ---------- Section: study groups (list) + group topic (detail) ----------
  // When did I last open each group? Anything newer earns a "nou" pulse.
  const groupSeen = () => store.get("atelier_group_seen", {});
  const groupLatest = (g) => Math.max(0, ...g.posts.map((p) => p.createdAt || 0));
  const groupHasNews = (g) =>
    isLoggedIn() && g.memberIds.includes(CURRENT_USER.id) && groupLatest(g) > (groupSeen()[g.id] || 0);

  function sectionGroups() {
    if (state.openGroup) return sectionGroupTopic(findGroup(state.openGroup));
    // Create a group right where you'd look for it (not only from Forum).
    const createUi = !isLoggedIn()
      ? ""
      : state.groupCreateOpen
        ? `${composer()}${composerNotice()}`
        : `<button type="button" class="cx-propose" data-action="group-create-toggle">+ Creează un grup de studiu</button>`;
    const cards = state.groups
      .map((g) => {
        const gi = groupIcon(g.iconId);
        const joined = isLoggedIn() && g.memberIds.includes(CURRENT_USER.id);
        const latest = groupLatest(g);
        const pulse = latest
          ? `· ultima activitate ${relTime(Math.max(0, Date.now() - latest))}`
          : "· încă liniște";
        const news = groupHasNews(g)
          ? `<span class="cx-group__new" title="Postări noi de la ultima vizită">nou</span>`
          : "";
        return `<button type="button" class="cx-group" style="--g:${g.color}" data-action="open-group" data-id="${g.id}">
          <span class="cx-group__badge" style="background:${g.color}"><span class="gi gi--${gi.anim}">${gi.char}</span></span>
          <span class="cx-group__body">
            <b class="cx-group__name">${escapeHtml(g.name)} ${news}</b>
            <span class="cx-group__topic">${escapeHtml(g.description)}</span>
            <span class="cx-muted">👥 ${countNoun(g.memberIds.length, "membru", "membri")} · 💬 ${countNoun(g.posts.length, "postare", "postări")} ${pulse}${joined ? " · membru ✓" : ""}</span>
          </span>
          <span class="cx-group__go" aria-hidden="true">→</span>
        </button>`;
      })
      .join("");
    return `
      ${sectionHead("Grupuri de studiu", "Fiecare grup are propriul topic, membri și discuții.")}
      ${createUi}
      <div class="cx-groups">${cards}</div>`;
  }

  // Group topic detail: members, membership, add-member permissions, and
  // its own posts with the shared threading engine.
  function sectionGroupTopic(g) {
    if (!g) {
      state.openGroup = null;
      return sectionGroups();
    }
    const gi = groupIcon(g.iconId);
    const joined = g.memberIds.includes(CURRENT_USER.id);
    const isCreator = g.creatorId === CURRENT_USER.id || isAdmin();
    const canAdd = canAddMembers(g);
    const creatorName = (userById(g.creatorId) || CURRENT_USER).name;

    const members = g.memberIds
      .map((mid) => {
        const name = mid === CURRENT_USER.id ? CURRENT_USER.name : (userById(mid) || {}).name || "Membru";
        // Creator/admin can remove any member except the creator and themselves.
        const kick = isCreator && mid !== g.creatorId && mid !== CURRENT_USER.id
          ? `<button type="button" class="cx-member__kick" data-action="group-kick" data-uid="${mid}" title="Scoate din grup">×</button>`
          : "";
        return `<span class="cx-member" title="${escapeHtml(name)}">${avatarLink(mid)}${kick}</span>`;
      })
      .join("");

    // REAL members (not seed): those not already in the group. uuidForSurrogate
    // then resolves each so addGroupMember actually persists.
    const candidates = state.members
      .filter((id) => id !== CURRENT_USER.id && !g.memberIds.includes(id))
      .map((id) => userById(id))
      .filter(Boolean)
      .slice(0, 12);
    const addPanel =
      canAdd && state.addMemberOpen
        ? `<div class="cx-addmember">
             <p class="cx-label">Adaugă un membru</p>
             <div class="cx-addmember__list">${candidates
               .map((u) => `<button type="button" class="cx-addmember__opt" data-action="add-member" data-uid="${u.id}">${userAvatar(u.id)} ${escapeHtml(u.name.split(" ")[0])}</button>`)
               .join("")}</div>
           </div>`
        : "";

    const posts = g.posts.length
      ? [...g.posts].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map(postCard).join("")
      : emptyState("Niciun mesaj în grup încă", "Pornește prima discuție a grupului.");

    const composerBox =
      joined || isAdmin()
        ? `<div class="cx-box cx-groupcompose">
             ${meAvatar()}
             <textarea class="cx-input" id="cx-group-post" rows="2" placeholder="Scrie o postare în grup…"></textarea>
             <button type="button" class="btn btn--primary btn--sm" data-action="group-post" data-id="${g.id}">Postează</button>
           </div>${state.groupWarn ? `<p class="cx-warn" role="alert">⚠️ ${escapeHtml(state.groupWarn)}</p>` : ""}`
        : `<div class="cx-groupjoinbar">Alătură-te grupului ca să poți posta.</div>`;

    // Admin/creator can edit (name/description/icon) or delete the group.
    const editForm =
      isCreator && state.editingGroup
        ? `<div class="cx-box cx-groupedit">
             <label class="cx-label">Icon</label>
             <div class="cx-icongrid">${GROUP_ICONS.map(
               (ic) => `<button type="button" class="cx-iconopt${ic.id === g.iconId ? " on" : ""}" data-action="group-set-icon" data-id="${ic.id}"><span class="gi gi--${ic.anim}">${ic.char}</span></button>`
             ).join("")}</div>
             <label class="cx-label">Nume</label>
             <input class="cx-input" id="cx-editgroup-name" value="${escapeHtml(g.name)}" />
             <label class="cx-label">Descriere</label>
             <textarea class="cx-input" id="cx-editgroup-desc" rows="2">${escapeHtml(g.description)}</textarea>
             <div class="cx-excompose__actions">
               <button type="button" class="btn btn--primary btn--sm" data-action="group-save" data-id="${g.id}">Salvează</button>
               <button type="button" class="btn-mini btn-mini--ghost" data-action="group-edit-cancel">Renunță</button>
             </div>
           </div>`
        : "";

    const adminBar = isCreator
      ? `<span class="cx-grouphead__admin">
           <button type="button" class="post__adminbtn" data-action="group-edit" data-id="${g.id}" title="Editează grupul">✎</button>
           <button type="button" class="post__adminbtn post__adminbtn--del" data-action="group-del" data-id="${g.id}" title="Șterge grupul">🗑</button>
         </span>`
      : "";

    return `
      <div class="cx-grouphead" style="--g:${g.color}">
        <span class="cx-grouphead__ic"><span class="gi gi--${gi.anim}">${gi.char}</span></span>
        <div class="cx-grouphead__id">
          <h1>${escapeHtml(g.name)}</h1>
          <p>${escapeHtml(g.description)}</p>
          <span class="cx-muted">Creat de ${escapeHtml(creatorName)} · 👥 ${countNoun(g.memberIds.length, "membru", "membri")}</span>
        </div>
        <button type="button" class="cx-group__join${joined ? " on" : ""}" data-action="group-toggle" data-id="${g.id}">${joined ? "Membru ✓" : "Alătură-te"}</button>
        ${adminBar}
      </div>
      ${editForm}
      <div class="cx-groupbar">
        <div class="cx-members">${members}</div>
        <div class="cx-groupbar__actions">
          ${canAdd ? `<button type="button" class="btn-mini${state.addMemberOpen ? " on" : ""}" data-action="toggle-addmember">+ Adaugă membru</button>` : ""}
          ${isCreator ? `<button type="button" class="btn-mini${g.allowMembersAdd ? " on" : ""}" data-action="toggle-members-add" data-id="${g.id}">${g.allowMembersAdd ? "Membrii pot invita ✓" : "Permite membrilor să invite"}</button>` : ""}
        </div>
      </div>
      ${addPanel}
      ${composerBox}
      <div class="cx-feed">${posts}</div>`;
  }

  // ---------- Section: events (admin-gated) ----------
  function sectionEvents() {
    const allowed = isAdmin() || MY_PROFILE.eventsAccess;
    if (!allowed) {
      return `
        ${sectionHead("Evenimente", "Sesiuni live, quiz-uri și cluburi de lectură.")}
        <div class="cx-lock">
          <div class="cx-lock__ic" aria-hidden="true">🔒</div>
          <b>Acces restricționat</b>
          <p>Evenimentele sunt vizibile doar membrilor cărora un administrator le-a acordat acces. Cere-i profesorului să te adauge.</p>
        </div>`;
    }
    const kindOptions = (sel) =>
      Object.entries(EVENT_KINDS)
        .map(([key, k]) => `<option value="${key}"${sel === key ? " selected" : ""}>${k.label}</option>`)
        .join("");
    const eventForm = (ev, isNew) => `<div class="cx-box cx-eventform">
        <label class="cx-label">Titlu</label>
        <input class="cx-input" id="cx-ev-title" value="${escapeHtml(ev.title || "")}" />
        <div class="cx-eventform__row">
          <div><label class="cx-label">Tip</label><select class="cx-input" id="cx-ev-kind">${kindOptions(ev.kind || "live")}</select></div>
          <div><label class="cx-label">Când</label><input class="cx-input" id="cx-ev-when" value="${escapeHtml(ev.when || "")}" placeholder="ex: vineri, 19:00" /></div>
        </div>
        <label class="cx-label">Gazdă</label>
        <input class="cx-input" id="cx-ev-host" value="${escapeHtml(ev.host || "")}" />
        <div class="cx-excompose__actions">
          <button type="button" class="btn btn--primary btn--sm" data-action="${isNew ? "admin-create-event" : "admin-save-event"}" data-id="${ev.id || 0}">${isNew ? "Creează evenimentul" : "Salvează"}</button>
          <button type="button" class="btn-mini btn-mini--ghost" data-action="admin-event-cancel">Renunță</button>
        </div>
      </div>`;

    const createUI = isAdmin()
      ? state.newEventOpen
        ? eventForm({ kind: "live" }, true)
        : `<button type="button" class="cx-propose" data-action="admin-new-event">+ Creează un eveniment</button>`
      : "";

    const cards = state.events
      .map((e) => {
        if (isAdmin() && state.editingEvent === e.id) return eventForm(e, false);
        const k = EVENT_KINDS[e.kind] || EVENT_KINDS.live; // 'other' kinds fall back

        const adminBar = isAdmin()
          ? `<span class="cx-event__admin">
               <button type="button" class="post__adminbtn" data-action="admin-edit-event" data-id="${e.id}" title="Editează">✎</button>
               <button type="button" class="post__adminbtn post__adminbtn--del" data-action="admin-del-event" data-id="${e.id}" title="Șterge">🗑</button>
             </span>`
          : "";
        return `<div class="cx-event" style="--e:${k.color}">
          <span class="cx-event__icon">${k.icon}</span>
          <div class="cx-event__body">
            <span class="cx-event__kind">${k.label}</span>
            <b class="cx-event__title">${escapeHtml(e.title)}</b>
            <span class="cx-muted">📅 ${escapeHtml(e.when)} · ${escapeHtml(e.host)}</span>
          </div>
          <button type="button" class="cx-event__go${e.going ? " on" : ""}" data-action="event-go" data-id="${e.id}">${e.going ? "Particip ✓" : "Particip"}</button>
          ${adminBar}
        </div>`;
      })
      .join("");
    return `
      ${sectionHead("Evenimente", "Sesiuni live, quiz-uri și cluburi de lectură. Nu rata nimic.")}
      ${createUI}
      <div class="cx-events">${cards}</div>`;
  }

  // ---------- Section: admin dashboard (admin role only) ----------
  function adminUserRow(u, hasAccess, isMe) {
    const li = levelInfo(u.points || 0);
    return `<div class="cx-adminrow">
      <span class="cx-adminrow__u">${avatarLink(u.id)} ${userNameLink(u.id, u.name)}${u.email ? `<br><small class="cx-muted cx-adminrow__email">${escapeHtml(u.email)}</small>` : ""}${isMe ? ' <span class="cx-adminchip">tu</span>' : ""}</span>
      <span>${(u.points || 0).toLocaleString("ro-RO")} <span class="cx-levelchip">Nv ${li.level}${li.prestige ? ` ⭐${li.prestige}` : ""}</span></span>
      <span><button type="button" class="cx-toggle${hasAccess ? " on" : ""}" data-action="grant-events" data-uid="${u.id}">${hasAccess ? "Acordat ✓" : "Acordă"}</button></span>
      <span class="cx-crudbtns"><button type="button" class="btn-mini" data-action="admin-view" data-uid="${u.id}">Vezi profil</button></span>
    </div>`;
  }

  function adminProfilePreview() {
    const uid = state.adminViewUser;
    if (uid === undefined || uid === null) return "";
    const isMe = uid === CURRENT_USER.id;
    const u = isMe
      ? { name: CURRENT_USER.name, points: MY_PROFILE.points, lessons: MY_PROFILE.lessons, streak: MY_PROFILE.streak, status: MY_PROFILE.status }
      : userById(uid);
    if (!u) return "";
    const col = isMe ? CURRENT_USER.color : avatarColor(uid);
    return `<div class="cx-box cx-adminprofile">
      <div class="cx-admin__head"><h3>Profil utilizator</h3><button type="button" class="cx-x" data-action="admin-closeview" aria-label="Închide">×</button></div>
      <div class="cx-adminprofile__row">${userAvatar(uid, "cx-av--lg")}
        <div><b>${escapeHtml(u.name)}</b><p class="cx-muted">„${escapeHtml(u.status || "—")}”</p></div>
      </div>
      <div class="cx-adminprofile__stats">
        <span><b>${(u.points || 0).toLocaleString("ro-RO")}</b> puncte</span>
        <span><b>${u.lessons ?? "—"}</b> lecții</span>
        <span><b>🔥 ${u.streak ?? "—"}</b> streak</span>
      </div>
      <p class="cx-muted">Din contul de admin poți vedea complet profilul oricărui utilizator (mockup).</p>
    </div>`;
  }

  // Admin proposal history as a sortable, filterable table. Reused in the
  // "Exerciții" tab AND wrapped in a box for the admin panel (DRY).
  function proposalHistoryTable() {
    const filter = state.histFilter || "all";
    const sort = state.histSort || { key: "date", dir: "desc" };

    let rows = state.proposed.filter((e) => e.status !== "pending").sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0));
    if (filter !== "all") rows = rows.filter((e) => e.status === filter);

    const cmp = {
      user: (a, b) => a.name.localeCompare(b.name, "ro"),
      date: (a, b) => (a.decidedAt || 0) - (b.decidedAt || 0),
      status: (a, b) => a.status.localeCompare(b.status),
    }[sort.key] || ((a, b) => (a.decidedAt || 0) - (b.decidedAt || 0));
    rows = [...rows].sort(cmp);
    if (sort.dir === "desc") rows.reverse();

    const arrow = (key) => (sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "");
    const th = (key, label) =>
      `<th><button type="button" class="cx-th${sort.key === key ? " on" : ""}" data-action="hist-sort" data-id="${key}">${label}${arrow(key)}</button></th>`;

    const chips = [
      { id: "all", label: "Toate" },
      { id: "approved", label: "Aprobate" },
      { id: "rejected", label: "Respinse" },
    ]
      .map((c) => `<button type="button" class="cx-fchip${filter === c.id ? " on" : ""}" data-action="hist-filter" data-id="${c.id}">${c.label}</button>`)
      .join("");

    const body = rows.length
      ? rows
          .map((e, i) => {
            const ok = e.status === "approved";
            const k = exerciseKind(e.kind);
            const date = e.decidedAt ? new Date(e.decidedAt).toLocaleDateString("ro-RO") : "—";
            return `<tr>
                <td class="cx-histt__n">${i + 1}</td>
                <td>${userNameLink(e.authorId, e.name)}</td>
                <td class="cx-histt__prompt"><span class="cx-tag cx-tag--${e.kind}">${k.label}</span>
                  <div class="exprev-wrap exprev-wrap--compact">${exercisePreviewHtml(e, { showAnswer: true })}</div>
                  <div class="cx-histt__lesson">${lessonLink(e)}</div></td>
                <td title="decis ${e.decidedTime || ""}">${date}</td>
                <td class="cx-histt__status"><span class="cx-dot cx-dot--${ok ? "ok" : "no"}" title="${ok ? "aprobat" : "respins"}"></span></td>
                <td class="cx-histt__act"><button type="button" class="post__adminbtn post__adminbtn--del" data-action="admin-del-ex" data-id="${e.id}" title="Șterge din istoric">🗑</button></td>
              </tr>`;
          })
          .join("")
      : `<tr><td colspan="6" class="cx-histt__empty cx-muted">Nicio propunere ${filter === "approved" ? "aprobată" : filter === "rejected" ? "respinsă" : "decisă"} încă.</td></tr>`;

    return `<div class="cx-histfilter">Filtru: ${chips}</div>
      <div class="cx-histtable-wrap">
        <table class="cx-histtable">
          <thead><tr>
            <th class="cx-histt__n">#</th>
            ${th("user", "Propunător")}
            <th>Propunere</th>
            ${th("date", "Data")}
            ${th("status", "Status")}
            <th></th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }
  function proposalHistory() {
    return `<div class="cx-box">
        <div class="cx-admin__head"><h3>Istoric propuneri · ${state.proposed.filter((e) => e.status !== "pending").sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0)).length}</h3></div>
        <p class="cx-muted">Propunerile de exerciții pe care le-ai aprobat sau respins. Cele aprobate apar în lista de exerciții de la lecția lor.</p>
        ${proposalHistoryTable()}
      </div>`;
  }

  function moderationBox() {
    // REAL reports (posts/comments/test items/exercises) — persisted in Supabase.
    const RTYPE = { post: "postare", comment: "comentariu", test_item: "item de test", exercise: "exercițiu", message: "mesaj" };
    const OPTL = ["A", "B", "C", "D"];
    const reportCard = (r) => {
      const who = `<span class="cx-muted">semnalat de ${escapeHtml(r.reporterName)} · ${relTime(Math.max(0, Date.now() - r.createdAt))}</span>`;
      // Anything that isn't a flagged item keeps the old compact row.
      if (r.targetType !== "test_item") {
        return `<div class="cx-moditem">
            <div class="cx-moditem__body">
              <p class="cx-moditem__text"><b>${RTYPE[r.targetType] || escapeHtml(r.targetType)}</b>${r.reason ? ` — „${escapeHtml(r.reason)}”` : ""}</p>
              <p class="cx-moditem__meta">${who}</p>
            </div>
            <span class="cx-moditem__act"><button type="button" class="btn-mini btn-mini--ok" data-action="report-resolve" data-id="${r.id}">✓ Rezolvă</button></span>
          </div>`;
      }
      const it = state.reportItems[r.targetId];
      if (!it) {
        return `<div class="cx-moditem"><div class="cx-moditem__body">
            <p class="cx-moditem__text">Item semnalat — nu s-a putut încărca.</p>
            <p class="cx-moditem__meta">${who}</p></div>
            <span class="cx-moditem__act"><button type="button" class="btn-mini btn-mini--ok" data-action="report-resolve" data-id="${r.id}">✓ Rezolvă</button></span>
          </div>`;
      }
      // The answer that counts today (2026 grammar wins where it differs).
      const key = it.correct2026 || it.correct;
      const chosen = r.meta?.chosen || null;
      const opts = OPTL.filter((k) => it.options?.[k]).map((k) => `
        <li class="cx-repopt${key === k ? " is-key" : ""}${chosen === k ? " is-pick" : ""}">
          <b>${k}</b><span>${sanitizeRich(it.options[k])}</span>
          ${key === k ? `<em class="cx-reptag cx-reptag--key">corect</em>` : ""}
          ${chosen === k ? `<em class="cx-reptag cx-reptag--pick">bifat de elev</em>` : ""}
        </li>`).join("");
      return `<div class="cx-repcard">
          <a class="cx-repcard__go" href="${basePath}teste/admitere-drept/?item=${encodeURIComponent(it.id)}" title="Deschide itemul în grila de itemi">
            <span class="cx-repcard__meta">${it.year ?? ""}${it.session ? ` · ${escapeHtml(it.session)}` : ""}${it.itemNo != null ? ` · itemul ${it.itemNo}` : ""} · deschide în grilă ↗</span>
            <p class="cx-repcard__q">${sanitizeRich(it.question)}</p>
            <ul class="cx-repopts">${opts}</ul>
          </a>
          <div class="cx-repcard__say">
            <span class="cx-repcard__lab">Ce spune elevul</span>
            <p>„${escapeHtml(r.reason || "")}”</p>
            <p class="cx-moditem__meta">${who}${chosen ? "" : ` · <span class="cx-muted">n-a apucat să răspundă</span>`}</p>
          </div>
          ${r.reporterId
            ? `<input class="cx-input cx-repnote" data-rid="${r.id}" maxlength="300" placeholder="notă pentru elev (opțională)…" />`
            : `<p class="cx-muted cx-repnote__none">Semnalare de la un vizitator — n-are cont, deci nu poate primi răspuns.</p>`}
          <div class="cx-repacts">
            <button type="button" class="btn-mini btn-mini--ok" data-action="report-founded" data-id="${r.id}">✓ Întemeiată${r.reporterId ? " · anunță + puncte" : ""}</button>
            <button type="button" class="btn-mini btn-mini--no" data-action="report-unfounded" data-id="${r.id}">✕ Neîntemeiată${r.reporterId ? " · trimite nota" : ""}</button>
          </div>
        </div>`;
    };
    const realReports = state.contentReports.length
      ? `<div class="cx-box">
          <div class="cx-admin__head"><h3>⚑ Rapoarte semnalate · ${state.contentReports.length}</h3></div>
          <div class="cx-modlist">${state.contentReports.map(reportCard).join("")}</div>
        </div>`
      : "";

    const profBox = `<div class="cx-box">
        <div class="cx-admin__head"><h3>Cuvinte filtrate · ${state.profanityTerms.length}</h3></div>
        <p class="cx-muted">Termeni pe care filtrul îi reține (postări/comentarii). Se aplică și pe server.</p>
        <div class="cx-prof-add">
          <input class="cx-input" id="cx-prof-term" placeholder="cuvânt de interzis…" maxlength="40" />
          <button type="button" class="btn btn--primary btn--sm" data-action="prof-add">Adaugă</button>
        </div>
        <div class="cx-prof-list">${state.profanityTerms.map((t) => `<span class="cx-prof-chip">${escapeHtml(t.term)}<button type="button" class="cx-prof-x" data-action="prof-del" data-id="${t.id}" title="Șterge">×</button></span>`).join("") || `<span class="cx-muted">Niciun termen custom încă.</span>`}</div>
      </div>`;

    const heldBox = state.heldContent.length
      ? `<div class="cx-box">
          <div class="cx-admin__head"><h3>🛡️ Reținute de filtru · ${state.heldContent.length}</h3></div>
          <div class="cx-modlist">${state.heldContent.map((h) => `
            <div class="cx-moditem">
              <div class="cx-moditem__body">
                <p class="cx-moditem__text">${h.kind === "comment" ? "💬" : "📝"} „${escapeHtml((h.body || "").slice(0, 200))}${(h.body || "").length > 200 ? "…" : ""}”</p>
                <p class="cx-moditem__meta"><span class="cx-muted">${escapeHtml(h.authorName)} · ${relTime(Math.max(0, Date.now() - h.createdAt))}</span></p>
              </div>
              <span class="cx-moditem__act">
                <button type="button" class="btn-mini btn-mini--ok" data-action="held-approve" data-kind="${h.kind}" data-id="${h.id}">✓ Publică</button>
                <button type="button" class="btn-mini btn-mini--no" data-action="held-reject" data-kind="${h.kind}" data-id="${h.id}">✕ Ascunde</button>
              </span>
            </div>`).join("")}</div>
        </div>`
      : "";

    const nothing = (!state.contentReports.length && !state.heldContent.length)
      ? `<p class="cx-muted">Nimic de moderat acum. 🎉</p>`
      : "";
    return `${realReports}${heldBox}${nothing}${profBox}`;
  }

  // Pending exercise proposals, decidable right here (same handlers as the
  // Exerciții section — one flow, two entry points).
  function adminPendingBox() {
    const pending = state.proposed.filter((e) => e.status === "pending").sort((a, b) => (b.votes || 0) - (a.votes || 0));
    if (!pending.length) return "";
    const rows = pending
      .map(
        (e) => `<div class="cx-moditem cx-moditem--exercise">
          <span class="cx-moditem__ic">🧩</span>
          <div class="cx-moditem__body">
            <p class="cx-moditem__head"><b>Propunere de exercițiu</b> <span class="cx-muted">· ${userNameLink(e.authorId, e.name)} · ▲ ${e.votes} voturi</span></p>
            <div class="exprev-wrap exprev-wrap--compact">
              ${exercisePreviewHtml(e, { showAnswer: true })}
            </div>
            <p class="cx-moditem__meta">${lessonLink(e)}</p>
          </div>
          <span class="cx-moditem__act">
            <button type="button" class="btn-mini" data-action="ex-admin-edit" data-id="${e.id}" title="Verifică și ajustează înainte de aprobare">✎ Editează</button>
            <button type="button" class="btn-mini btn-mini--ok" data-action="admin-approve-ex" data-id="${e.id}">✓ Aprobă</button>
            <button type="button" class="btn-mini btn-mini--no" data-action="admin-reject-ex" data-id="${e.id}">✕ Respinge</button>
          </span>
        </div>`
      )
      .join("");
    return `<div class="cx-box">
        <div class="cx-admin__head"><h3>Exerciții în așteptare · ${pending.length}</h3></div>
        <div class="cx-modlist">${rows}</div>
      </div>`;
  }

  function adminTabOverview() {
    const totalPosts = state.posts.length + state.groups.reduce((n, g) => n + g.posts.length, 0);

    // The community's pulse: what happened TODAY + your last actions.
    const dayStart = new Date().setHours(0, 0, 0, 0);
    const postsToday = allPosts().filter((p) => (p.createdAt || 0) >= dayStart).length;
    const proposalsToday = state.proposed.filter((e) => (e.createdAt || 0) >= dayStart).length;
    const log = store.get("atelier_admin_log", []).slice(0, 8);
    const pulse = `
      <div class="cx-box">
        <div class="cx-admin__head"><h3>Pulsul de azi</h3></div>
        <div class="cx-pulse">
          <span class="cx-pulse__stat"><b>${postsToday}</b> postări noi</span>
          <span class="cx-pulse__stat"><b>${proposalsToday}</b> exerciții propuse</span>
          <span class="cx-pulse__stat"><b>${state.heldContent.length}</b> de moderat</span>
          <span class="cx-pulse__stat"><b>${state.contentReports.length}</b> rapoarte</span>
          <span class="cx-pulse__stat"><b>${unreadMsgCount()}</b> mesaje necitite</span>
        </div>
        ${log.length
          ? `<p class="cx-muted cx-pulse__logtitle">Ultimele tale acțiuni:</p>
             <ul class="cx-pulse__log">${log
               .map((l) => `<li><span class="cx-muted">${relTime(Math.max(0, Date.now() - l.t))}</span> ${escapeHtml(l.text)}</li>`)
               .join("")}</ul>`
          : ""}
      </div>`;
    const attention = [
      { n: state.contentReports.length + state.heldContent.length, label: "de moderat", tab: "moderation" },
      { n: state.proposed.filter((e) => e.status === "pending").length, label: "exerciții în așteptare", tab: "moderation" },
    ].filter((a) => a.n > 0);
    const attentionBox = attention.length
      ? `<div class="cx-attention">
           <b>⚠️ Necesită atenție</b>
           ${attention
             .map((a) => `<button type="button" class="cx-attention__item" data-action="admin-tab" data-id="${a.tab}"><b>${a.n}</b> ${a.label} →</button>`)
             .join("")}
         </div>`
      : `<div class="cx-attention cx-attention--clear"><b>✅ Totul e în regulă</b> <span class="cx-muted">— nimic în așteptare.</span></div>`;

    // Every number is a real door: it opens the place where you act on it.
    const stats = [
      { n: state.adminUsers.length, l: "utilizatori", tab: "users" },
      { n: totalPosts, l: "postări", go: "forum" },
      { n: state.groups.length, l: "grupuri", go: "grupuri" },
      { n: state.proposed.length, l: "exerciții", go: "exercitii" },
      { n: state.events.length, l: "evenimente", go: "evenimente" },
    ]
      .map(
        (s) => `<button type="button" class="cx-adminstat" data-action="${s.tab ? "admin-tab" : "go"}" data-id="${s.tab || s.go}">
          <b>${s.n}</b><span>${s.l}</span>
        </button>`
      )
      .join("");

    const crud = [
      { label: "Postări", section: "forum", hint: "editezi/ștergi pe fiecare postare, din feed" },
      { label: "Grupuri", section: "grupuri", hint: "editezi/ștergi în pagina fiecărui grup" },
      { label: "Exerciții", section: "exercitii", hint: "aprobi/respingi și din fila Moderare" },
      { label: "Evenimente", section: "evenimente", hint: "creezi/editezi/ștergi evenimente" },
    ]
      .map(
        (c) => `<div class="cx-crudrow">
          <b>${c.label}</b>
          <span class="cx-crudrow__hint cx-muted">${c.hint}</span>
          <button type="button" class="btn-mini" data-action="go" data-id="${c.section}">Gestionează →</button>
        </div>`
      )
      .join("");

    return `
      ${attentionBox}
      <div class="cx-adminstats">${stats}</div>
      ${pulse}
      <div class="cx-box">
        <div class="cx-admin__head"><h3>Poartă pre-lansare</h3></div>
        <p class="cx-muted">Când e <b>oprită</b>, tot site-ul e public. Când e <b>pornită</b>, doar conturile permise intră; restul văd „în curând".</p>
        <button type="button" class="cx-gatebtn${state.gateOff ? " is-off" : " is-on"}" data-action="gate-toggle">
          ${state.gateOff ? "Site public (poarta oprită) — pornește poarta" : "Poarta pornită (doar echipa) — oprește poarta"}
        </button>
      </div>
      <div class="cx-box">
        <div class="cx-admin__head"><h3>Unde gestionezi conținutul</h3></div>
        <p class="cx-muted">Controalele de editare/ștergere sunt inline, exact unde trăiește conținutul.</p>
        <div class="cx-crud">${crud}</div>
      </div>`;
  }

  function adminTabUsers() {
    const q = state.adminUserQuery.trim().toLowerCase();
    let users = [...state.adminUsers];
    if (q) users = users.filter((u) => u.name.toLowerCase().includes(q));
    users.sort(state.adminUserSort === "name" ? (a, b) => a.name.localeCompare(b.name, "ro") : (a, b) => b.points - a.points);

    // Only MEMBERS are listed — the teacher/admin isn't a member account.
    // Paginated (10/page) so it stays scannable at any class size.
    const PER_PAGE = 10;
    const pages = Math.max(1, Math.ceil(users.length / PER_PAGE));
    const page = Math.min(state.adminUserPage, pages);
    const slice = users.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const rows = slice.map((u) => adminUserRow(u, state.eventAccessUuids.has(uuidForSurrogate(u.id)), false)).join("");
    const pager = pages > 1
      ? `<div class="cx-pager">
           <button type="button" class="btn-mini" data-action="admin-user-page" data-dir="-1" ${page === 1 ? "disabled" : ""}>‹</button>
           <span class="cx-muted">pagina ${page} din ${pages}</span>
           <button type="button" class="btn-mini" data-action="admin-user-page" data-dir="1" ${page === pages ? "disabled" : ""}>›</button>
         </div>`
      : "";
    const sortBtn = (key, label) =>
      `<button type="button" class="cx-fchip${state.adminUserSort === key ? " on" : ""}" data-action="admin-user-sort" data-key="${key}">${label}</button>`;

    return `
      ${adminProfilePreview()}
      <div class="cx-box">
        <div class="cx-admin__head"><h3>Utilizatori · ${users.length}</h3></div>
        <div class="cx-userbar">
          <input class="cx-input cx-userbar__search" id="cx-admin-usearch" type="search" placeholder="Caută un membru…" value="${escapeHtml(state.adminUserQuery)}" />
          <span>${sortBtn("points", "După puncte")}${sortBtn("name", "După nume")}</span>
        </div>
        <div class="cx-admintable">
          <div class="cx-adminrow cx-adminrow--head"><span>Utilizator</span><span>Puncte</span><span>Evenimente</span><span>Acțiuni</span></div>
          ${rows}
        </div>
        ${pager}
      </div>`;
  }

  function adminTabModeration() {
    return `${moderationBox()}${adminPendingBox()}${proposalHistory()}`;
  }

  // ---- Admin: schedule the daily challenges ----
  function challengeForm(ch = {}) {
    const opts = ch.options || [];
    const opt = (i) => `
      <label class="exf__opt">
        <input type="radio" name="chf-correct" value="${i}" ${i === (ch.correct ?? 0) ? "checked" : ""} title="Răspunsul corect" />
        <input class="cx-input" id="chf-opt-${i}" value="${escapeHtml(opts[i] || "")}" placeholder="Varianta ${i + 1}${i < 2 ? "" : " (opțional)"}" />
      </label>`;
    return `<div class="cx-excompose">
        <label class="cx-label">Întrebarea</label>
        <textarea class="cx-input" id="chf-prompt" rows="2">${escapeHtml(ch.prompt || "")}</textarea>
        <label class="cx-label">Variantele <span class="cx-muted">(bifează răspunsul corect)</span></label>
        ${opt(0)}${opt(1)}${opt(2)}${opt(3)}
        <label class="cx-label">Explicația <span class="cx-muted">(apare după răspuns)</span></label>
        <textarea class="cx-input" id="chf-explanation" rows="2">${escapeHtml(ch.explanation || "")}</textarea>
        <div class="cx-eventform__row">
          <div>
            <label class="cx-label">Programată pe ziua <span class="cx-muted">(gol = intră în rotația zilnică)</span></label>
            <input class="cx-input" id="chf-date" type="date" value="${ch.date || ""}" />
          </div>
          <div>
            <label class="cx-label">Recompensă (puncte)</label>
            <input class="cx-input" id="chf-reward" type="number" min="5" max="50" value="${ch.reward ?? 15}" />
          </div>
        </div>
        <div class="cx-excompose__actions">
          <button type="button" class="btn btn--primary btn--sm" data-action="ch-save" data-chid="${ch.id || ""}">${ch.id ? "Salvează" : "Adaugă provocarea"}</button>
          <button type="button" class="btn-mini btn-mini--ghost" data-action="ch-cancel">Renunță</button>
        </div>
        ${state.chWarn ? `<p class="cx-warn" role="alert">⚠️ ${escapeHtml(state.chWarn)}</p>` : ""}
      </div>`;
  }

  function adminTabChallenges() {
    const list = state.adminChallenges || []; // REAL challenges (Supabase)
    const todayId = state.challenge ? state.challenge.id : null;
    const todayISO = new Date().toISOString().slice(0, 10);
    // The next 7 days at a glance — plan with your eyes open.
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() + i * 864e5);
      const iso = d.toISOString().slice(0, 10);
      const pinned = list.find((c) => c.date === iso);
      return `<span class="cx-week__day${pinned ? " on" : ""}" title="${pinned ? escapeHtml(pinned.prompt) : "neprogramată"}">
          <b>${d.toLocaleDateString("ro-RO", { weekday: "short" })}</b>
          <span>${d.getDate()}</span>
          <em>${pinned ? "⚡ fixată" : "— liberă"}</em>
        </span>`;
    }).join("");
    const rows = list.length
      ? list
          .map((c) => {
            const isToday = c.id === todayId;
            const expired = c.date && c.date < todayISO;
            const when = c.date
              ? `📅 ${new Date(c.date + "T12:00").toLocaleDateString("ro-RO")}${expired ? ` <span class="cx-tag cx-tag--no">expirată</span>` : ""}`
              : "fără dată";
            return `<div class="cx-moditem${isToday ? " cx-moditem--exercise" : ""}">
                <span class="cx-moditem__ic">${isToday ? "⭐" : "⚡"}</span>
                <div class="cx-moditem__body">
                  <p class="cx-moditem__head"><b>${when}</b>${isToday ? ` <span class="cx-tag cx-tag--ok">azi</span>` : ""} <span class="cx-muted">· +${c.reward} pct</span></p>
                  <p class="cx-moditem__text">„${escapeHtml(c.prompt)}”</p>
                  <p class="cx-moditem__meta"><span class="cx-muted">${(c.options || []).map((o, i) => (i === c.correct ? `✔ ${escapeHtml(o)}` : escapeHtml(o))).join(" · ")}</span></p>
                </div>
                <span class="cx-moditem__act">
                  <button type="button" class="btn-mini" data-action="ch-edit" data-chid="${c.id}">✎ Editează</button>
                  <button type="button" class="btn-mini btn-mini--no" data-action="ch-del" data-chid="${c.id}">🗑</button>
                </span>
              </div>`;
          })
          .join("")
      : `<p class="cx-muted">Nicio provocare programată încă. Adaugă una și fix-o pe o zi.</p>`;

    const editing = state.chEditId !== null;
    const form = editing
      ? challengeForm(state.chEditId === "new" ? {} : list.find((c) => c.id === state.chEditId) || {})
      : `<button type="button" class="cx-propose" data-action="ch-new">+ Programează o provocare nouă</button>`;

    return `
      <div class="cx-box">
        <div class="cx-admin__head"><h3>Provocarea zilei · planificare</h3></div>
        <p class="cx-muted">Fixează o provocare pe o zi — atunci elevii o primesc și câștigă puncte rezolvând-o corect (o singură dată, verificat de server). Salvate în Supabase.</p>
        <div class="cx-week">${week}</div>
        ${form}
        <div class="cx-modlist">${rows}</div>
      </div>`;
  }

  // Short, easy questions that fly across the screen in the game's classic
  // mode. The accepted answers never reach a pupil's browser (the column is
  // revoked); they come back here through a definer RPC.
  function adminTabBonus() {
    const rows = state.bonusQs.map((q) => `
      <div class="cx-bonusrow" data-id="${q.id}">
        <input class="cx-input" data-f="prompt" value="${escapeHtml(q.prompt)}" placeholder="întrebarea…" maxlength="140" />
        <input class="cx-input" data-f="answers" value="${escapeHtml((q.answers || []).join(", "))}" placeholder="răspunsuri acceptate, separate prin virgulă" maxlength="200" />
        <label class="cx-bonusrow__on"><input type="checkbox" data-f="active"${q.active ? " checked" : ""} /> activă</label>
        <button type="button" class="btn-mini btn-mini--ok" data-action="bonus-save" data-id="${q.id}">Salvează</button>
        <button type="button" class="btn-mini btn-mini--no" data-action="bonus-del" data-id="${q.id}">Șterge</button>
      </div>`).join("");
    return `<div class="cx-box">
        <div class="cx-admin__head"><h3>✦ Întrebări bonus · ${state.bonusQs.length}</h3></div>
        <p class="cx-muted">Întrebări scurte și ușoare. În modul clasic trec în zbor pe ecran; elevul le prinde, răspunde și câștigă un ajutor. Poți trece mai multe variante acceptate, separate prin virgulă — comparația ignoră diacriticele, majusculele și semnele de punctuație.</p>
        <div class="cx-bonusrow cx-bonusrow--new">
          <input class="cx-input" id="cx-bonus-prompt" placeholder="întrebarea nouă…" maxlength="140" />
          <input class="cx-input" id="cx-bonus-answers" placeholder="răspunsuri acceptate, separate prin virgulă" maxlength="200" />
          <button type="button" class="btn btn--primary btn--sm" data-action="bonus-add">Adaugă</button>
        </div>
        ${rows || `<p class="cx-muted">Încă nicio întrebare bonus.</p>`}
      </div>`;
  }

  // Files stay on the teacher's Drive; only the link lives here. Paste the
  // share link exactly as Drive gives it — the site turns it into a direct
  // download by itself, so there's no URL surgery to learn.
  function adminTabDownloads() {
    const key = state.settings.drive_api_key || "";
    // One block per category: its Drive folder, a Load button, whatever that
    // load found, and the files already published.
    const blocks = TEST_CATEGORIES.map((c) => {
      const folder = state.settings[`drive_folder_${c.slug}`] || "";
      const st = state.driveFiles[c.slug] || {};
      const mine = state.downloads.filter((d) => d.exam === c.slug);
      const known = new Set(mine.map((d) => driveFileId(d.url)).filter(Boolean));
      const found = (st.files || []).map((f) => {
        const already = known.has(f.id);
        return `<div class="cx-dlfound${already ? " is-known" : ""}">
            <span class="cx-dlfound__n">${escapeHtml(f.name)}</span>
            ${already
              ? `<span class="cx-muted">deja adăugat</span>`
              : `<button type="button" class="btn-mini btn-mini--ok" data-action="drive-add"
                   data-slug="${c.slug}" data-fid="${f.id}" data-name="${escapeHtml(f.name)}">Adaugă</button>`}
          </div>`;
      }).join("");
      return `<div class="cx-box cx-drivecat">
          <div class="cx-admin__head"><h3><span aria-hidden="true">${c.icon}</span> ${escapeHtml(c.title)} · ${mine.length}</h3></div>
          <div class="cx-driverow">
            <input class="cx-input" data-f="folder" data-slug="${c.slug}" value="${escapeHtml(folder)}"
                   placeholder="lipește aici linkul folderului din Drive" />
            <button type="button" class="btn-mini" data-action="drive-save-folder" data-slug="${c.slug}">Salvează folderul</button>
            <button type="button" class="btn btn--primary btn--sm" data-action="drive-load" data-slug="${c.slug}"${folder && key ? "" : " disabled"}>
              ${st.loading ? "Se încarcă…" : "Încarcă din Drive"}
            </button>
          </div>
          ${st.error ? `<p class="cx-muted cx-driveerr">⚠ ${escapeHtml(st.error)}</p>` : ""}
          ${found ? `<div class="cx-dlfoundlist">${found}</div>` : ""}
          ${mine.map(dlRow).join("") || `<p class="cx-muted">Niciun fișier publicat la această categorie.</p>`}
        </div>`;
    }).join("");

    return `<div class="cx-box">
        <div class="cx-admin__head"><h3>🔑 Legătura cu Drive</h3></div>
        <p class="cx-muted">Cheia se citește DOAR din contul tău de profesor — elevii n-o primesc niciodată. Folderele trebuie partajate în Drive ca „oricine are linkul".</p>
        <div class="cx-driverow">
          <input class="cx-input" id="cx-drive-key" value="${escapeHtml(key)}" placeholder="cheia din Google Cloud Console" />
          <button type="button" class="btn-mini btn-mini--ok" data-action="drive-save-key">Salvează cheia</button>
        </div>
      </div>
      ${blocks}`;
  }

  // One published file, editable.
  function dlRow(d) {
    return `
      <div class="cx-dlrow" data-id="${d.id}" data-exam="${escapeHtml(d.exam || "")}">
        <input class="cx-input" data-f="year" value="${escapeHtml(d.year ?? "")}" placeholder="an" inputmode="numeric" maxlength="4" />
        <input class="cx-input" data-f="label" value="${escapeHtml(d.label || "")}" placeholder="ex. Simulare" maxlength="60" />
        <input class="cx-input" data-f="note" value="${escapeHtml(d.note || "")}" placeholder="ex. subiect și barem" maxlength="80" />
        <input class="cx-input" data-f="kind" value="${escapeHtml(d.kind || "PDF")}" placeholder="PDF" maxlength="12" />
        <input class="cx-input cx-dlrow__url" data-f="url" value="${escapeHtml(d.url || "")}" placeholder="linkul din Drive" />
        <label class="cx-bonusrow__on"><input type="checkbox" data-f="active"${d.active ? " checked" : ""} /> activ</label>
        <button type="button" class="btn-mini btn-mini--ok" data-action="dl-save" data-id="${d.id}">Salvează</button>
        <button type="button" class="btn-mini btn-mini--no" data-action="dl-del" data-id="${d.id}">Șterge</button>
        <a class="cx-dlrow__test" href="${escapeHtml(directDownloadUrl(d.url))}" target="_blank" rel="noopener noreferrer">testează ↗</a>
      </div>`;
  }

  function adminTabGamification() {
    return `
      <div class="cx-box">
        <div class="cx-admin__head"><h3>Simulează nivelul (test)</h3></div>
        <p class="cx-muted">Mișcă sliderele ca să vezi bara reală de sus: nivelul (skinul + valurile la 20 + rama de pagină) și prestige-ul (stelele care apar după ce completezi bara 20). Nu-ți modifică punctele.</p>
        <div class="cx-simlevel">
          <label class="cx-simlbl">Nivel</label>
          <input type="range" id="cx-simlevel" min="1" max="${MAX_LEVEL}" value="${state.simLevel || 1}" />
          <b id="cx-simlevel-out">${state.simLevel || 1}</b>
        </div>
        <div class="cx-simlevel">
          <label class="cx-simlbl">Prestige ⭐</label>
          <input type="range" id="cx-simprestige" min="0" max="6" value="${state.simPrestige || 0}" />
          <b id="cx-simprestige-out">${state.simPrestige || 0}</b>
        </div>
        <div class="xp xp--preview" id="cx-simpreview">${xpBarMarkup(false)}</div>
        <p class="cx-muted">↑ previzualizarea de aici se mișcă odată cu sliderele; bara reală de sus se schimbă și ea.</p>
        <button type="button" class="btn-mini" data-action="sim-reset">Revino la starea reală</button>
      </div>
      <div class="cx-box">
        <details class="cx-details">
          <summary><h3>Bare pe niveluri · previzualizare (1–${MAX_LEVEL})</h3></summary>
          <p class="cx-muted">Cum arată bara la fiecare nivel — de la simplu la fancy. Se acumulează: emblemă, segmente, stele, steaguri, reflexie, gradient, ramă. Efectele rulează live.</p>
          <div class="xp-prev-list">${barPreviews()}</div>
        </details>
      </div>`;
  }

  function sectionAdmin() {
    if (!isAdmin()) return sectionForum();
    const modCount = state.contentReports.length + state.heldContent.length + state.proposed.filter((e) => e.status === "pending").length;
    const TABS = [
      { id: "overview", label: "Prezentare" },
      { id: "users", label: "Utilizatori" },
      { id: "moderation", label: "Moderare", badge: modCount },
      { id: "challenges", label: "Provocări" },
      { id: "gamification", label: "Gamificare" },
      { id: "bonus", label: "Întrebări bonus" },
      { id: "downloads", label: "Descărcabile" },
    ];
    const tabBar = `<div class="cx-tabs cx-tabs--admin">${TABS.map(
      (t) => `<button class="cx-tabbtn${state.adminTab === t.id ? " on" : ""}" data-action="admin-tab" data-id="${t.id}">
        ${t.label}${t.badge ? `<span class="cx-tabbtn__n cx-tabbtn__n--hot">${t.badge}</span>` : ""}
      </button>`
    ).join("")}</div>`;

    const BODY = {
      overview: adminTabOverview,
      users: adminTabUsers,
      moderation: adminTabModeration,
      challenges: adminTabChallenges,
      gamification: adminTabGamification,
      bonus: adminTabBonus,
      downloads: adminTabDownloads,
    };
    return `
      ${sectionHead("Panou de administrare", "Vizibil doar pentru tine. Tot ce ține de administrarea comunității, organizat pe file.")}
      ${tabBar}
      ${(BODY[state.adminTab] || adminTabOverview)()}`;
  }

  // 20 mini XP-bar skins so the admin can see every level at a glance.
  function barPreviews() {
    return Array.from({ length: MAX_LEVEL }, (_, i) => {
      const L = i + 1;
      const s = xpSkin(L);
      const width = 100; // each bar is shown fully filled (its completed look)
      const flags = [33, 66].map((p) => `<span class="xp__flag is-passed" style="left:${p}%"></span>`).join("");
      return `<div class="xp-prev-row">
          <span class="xp-prev-lbl">Nivel ${L}</span>
          <div class="xp xp--preview ${s.classes}" data-level="${L}" style="--xp-fill:${s.fill};--lvl:${L};--seg:${s.segCount}">
            <div class="xp__inner">
              <span class="xp__emblem"><span class="xp__ring"></span><span class="xp__emblem-ic">${s.emblem}</span></span>
              <span class="xp__badge"><b class="xp__lvl">${L}</b></span>
              <div class="xp__wrap">
                <div class="xp__stars"></div>
                <div class="xp__track">${flags}<div class="xp__fill" style="width:${width}%"><span class="xp__seg"></span><span class="xp__wave"></span><span class="xp__shine"></span><span class="xp__spark"></span></div></div>
              </div>
            </div>
          </div>
        </div>`;
    }).join("");
  }

  // ---------- Section: badges ----------
  // Earned states are DERIVED from real data (they used to be static flags,
  // so "Streak 7 zile" showed as earned while the actual streak was 2).
  function badgeEarned(b) {
    // My rank in the REAL leaderboard (state.members is points-desc).
    const myRank = state.members.indexOf(CURRENT_USER.id); // -1 when unknown
    switch (b.id) {
      case 1: return state.myCounts.comments > 0; // first comment (real)
      case 2: return MY_PROFILE.streak >= 7;
      case 3: return state.myLessons.size >= 10; // real lesson_progress
      case 4: return state.myCounts.given >= 50; // real contributions
      case 5: return myRank >= 0 && myRank < 10; // real top-10
      case 6: // every morphology lesson actually completed
        return MORFOLOGIE_SLUGS.length > 0 && MORFOLOGIE_SLUGS.every((s) => state.myLessons.has(s));
      case 7: return state.myApprovedEx > 0;
      case 8: return challengesSolved() >= 30;
      default: return false;
    }
  }
  function sectionBadges() {
    const cards = BADGES.map((b) => {
      const earned = badgeEarned(b);
      return `<div class="cx-badgecard${earned ? " is-earned" : " is-locked"}">
        <span class="cx-badgecard__ic">${earned ? b.icon : "🔒"}</span>
        <b>${escapeHtml(b.name)}</b>
        <p>${escapeHtml(b.desc)}</p>
      </div>`;
    }).join("");
    const earnedCount = BADGES.filter(badgeEarned).length;
    return `${sectionHead("Insigne", `Ai câștigat ${earnedCount} din ${BADGES.length}. Continuă și le deblochezi pe toate!`)}<div class="cx-badges-grid">${cards}</div>`;
  }

  function sectionHead(title, sub) {
    return `<div class="cx-head"><h1 class="cx-head__title">${title}</h1><p class="cx-head__sub">${sub}</p></div>`;
  }

  function emptyState(title, sub) {
    return `<div class="cx-empty"><div class="cx-empty__mascot" aria-hidden="true">${mascotSvg("lost", 96)}</div><b>${title}</b><p>${sub}</p></div>`;
  }

  const SECTION_RENDER = {
    forum: sectionForum,
    "pagina-mea": sectionWall,
    activitate: sectionActivity,
    exercitii: sectionExercises,
    provocare: sectionChallenge,
    clasament: sectionLeaderboard,
    membri: sectionMembers,
    grupuri: sectionGroups,
    evenimente: sectionEvents,
    insigne: sectionBadges,
    lectii: sectionLessons,
    mesaje: sectionMessages,
    salvate: sectionSaved,
    caiet: sectionNotebook,
    puncte: sectionPoints,
    profil: sectionProfile,
    admin: sectionAdmin,
  };

  // ---------- Wayfinding ----------
  // Snapshot the current place before navigating, so "←" always returns
  // exactly one step — no more getting lost between sections.
  function remember() {
    state.prevNav = {
      section: state.section,
      openGroup: state.openGroup,
      viewUser: state.viewUser,
      adminTab: state.adminTab,
    };
  }

  // The breadcrumb above the content: Atelier › secțiune [› subpagină],
  // plus a "←" that undoes the last jump. Every segment is clickable.
  function crumbs() {
    const sep = `<span class="cx-crumbs__sep" aria-hidden="true">›</span>`;
    const parts = [
      `<button type="button" class="cx-crumbs__seg cx-crumbs__root" data-action="go" data-id="forum">Atelier</button>`,
    ];
    // Current section.
    const label = SECTION_LABELS[state.section] || "Forum";
    // Sub-page (a group topic / someone's profile) → the section segment
    // stays clickable and the sub-page is the current, bold crumb.
    let sub = null;
    if (state.section === "grupuri" && state.openGroup) {
      const g = findGroup(state.openGroup);
      if (g) sub = g.name;
    } else if (state.section === "profil" && state.viewUser) {
      const u = userById(state.viewUser);
      if (u) sub = u.name;
    }
    parts.push(sep, sub
      ? `<button type="button" class="cx-crumbs__seg" data-action="go" data-id="${state.section}">${label}</button>`
      : `<b class="cx-crumbs__here">${label}</b>`);
    if (sub) parts.push(sep, `<b class="cx-crumbs__here">${escapeHtml(sub)}</b>`);

    const back = state.prevNav
      ? `<button type="button" class="cx-crumbs__back" data-action="nav-back" title="Înapoi unde erai">←</button>`
      : "";
    return `<nav class="cx-crumbs" aria-label="Unde te afli">${back}${parts.join("")}</nav>`;
  }

  let podiumCelebrated = false;
  // Reload the challenge data after the teacher schedules/edits/deletes one,
  // so both the admin list and today's card reflect it right away.
  async function reloadChallenges() {
    if (isAdmin()) state.adminChallenges = await listChallenges();
    state.challenge = await fetchTodayChallenge();
    state.challengeSolve = state.challenge ? await fetchMyChallengeSolve(state.challenge.id) : null;
    state.challengeAnswer = await revealAnswerIfAllowed();
    render();
  }

  // The answer is fetched ONLY when you may see it: the teacher always, a pupil
  // only after they've used their one attempt (enforced by get_challenge_answer).
  async function revealAnswerIfAllowed() {
    if (!state.challenge || !isLoggedIn()) return null;
    if (!isAdmin() && !state.challengeSolve) return null; // no peeking
    return await fetchChallengeAnswer(state.challenge.id);
  }

  // Reload events after RSVP or an admin create/edit/delete.
  async function reloadEvents() {
    if (isLoggedIn()) state.events = await listEvents();
    render();
  }

  // Reload study groups (+ walls) after create/join/leave/post/edit/delete.
  async function reloadGroups() {
    state.groups = await listGroups();
    await Promise.all(state.groups.map(async (g) => {
      g.posts = await fetchGroupPosts(g.id);
      g.color = groupColor(g.iconId);
    }));
    render();
  }

  // Reload just ONE group's wall (after posting), keeping the rest untouched.
  async function reloadGroupPosts(groupId) {
    const g = state.groups.find((x) => x.id === groupId);
    if (g) g.posts = await fetchGroupPosts(groupId);
    render();
  }

  // Reload proposed exercises after propose/vote/approve/reject/delete.
  async function reloadExercises() {
    const exPending = await fetchPendingExercises();
    const exHistory = isAdmin() ? await fetchExerciseHistory() : [];
    state.proposed = [...exPending, ...exHistory];
    for (const e of state.proposed) e.lessonTitle = lessonBySlug(e.lessonSlug)?.title || e.lessonSlug;
    state.myApprovedEx = await fetchMyApprovedExerciseCount();
    render();
  }

  // Reload conversations after sending/reading a message.
  async function reloadConversations() {
    state.conversations = await fetchConversations(isAdmin());
    render();
    const sc = mount.querySelector("#cx-chat-scroll");
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  // Load the REAL forum feed once (on first paint), then re-render.
  async function loadFeed() {
    try {
      const forumPosts = await fetchFeed({ surface: "forum" });
      const wallPosts = await fetchFeed({ surface: "wall" });
      state.posts = [...forumPosts, ...wallPosts];
      state.members = await fetchMembers(); // real leaderboard directory (points desc)
      state.profanityTerms = await fetchProfanityTerms(); // admin's custom filtered words
      setCustomProfanity(state.profanityTerms); // feed them into the client filter
      state.blockedIds = await fetchMyBlocks(); // members I've blocked → hide their posts
      if (state.blockedIds.size) state.posts = state.posts.filter((p) => !state.blockedIds.has(p.authorId));
      state.pointsHistory = await fetchPointsHistory(); // real points ledger
      const favSlugs = await fetchFavorites(); // real favorite lessons
      state.favorites = favSlugs
        .map((slug) => { const l = lessonBySlug(slug); return l ? { slug, title: l.title, href: lessonHrefBySlug(slug) } : null; })
        .filter(Boolean);
      await loadNotes(); state.notes = getNotes(); // real notebook (Supabase)
      await loadKudos(); // real claps/pokes — members are registered above, so surrogate→uuid resolves
      // Today's REAL daily challenge + whether I've already answered it.
      state.challenge = await fetchTodayChallenge();
      state.challengeSolve = state.challenge ? await fetchMyChallengeSolve(state.challenge.id) : null;
      state.challengeAnswer = await revealAnswerIfAllowed(); // only if allowed
      if (isAdmin()) state.adminChallenges = await listChallenges();
      // Real proposed exercises: pending (everyone) + decided history (admin only).
      const exPending = await fetchPendingExercises();
      const exHistory = isAdmin() ? await fetchExerciseHistory() : [];
      state.proposed = [...exPending, ...exHistory];
      for (const e of state.proposed) e.lessonTitle = lessonBySlug(e.lessonSlug)?.title || e.lessonSlug;
      state.myApprovedEx = await fetchMyApprovedExerciseCount();
      // "Activitatea mea": OFERITE derived from what I really did + real counts
      // for the badges. (PRIMITE comes from the shared notification cache.)
      if (isLoggedIn()) {
        state.given = await fetchGivenActivity();
        state.myCounts = await fetchMyContributionCounts();
        state.myLessons = await fetchMyLessonSlugs(); // real progress → badges
      }
      if (isLoggedIn()) state.events = await listEvents(); // RLS returns [] without event_access
      // Real study groups + each group's wall (posts tagged with group_id).
      state.groups = await listGroups();
      await Promise.all(state.groups.map(async (g) => {
        g.posts = await fetchGroupPosts(g.id);
        g.color = groupColor(g.iconId);
      }));
      state.conversations = await fetchConversations(isAdmin()); // real messages
      if (isAdmin()) {
        state.adminUsers = await adminFetchUsers(); // real members (+ e-mail); also bridges them so they're messageable
        state.contentReports = await fetchContentReports(); // real reports queue (posts/comments/teste/exerciții)
        state.heldContent = await fetchHeldContent();       // filter-held posts/comments awaiting review
        // Flagged test items are shown IN FULL (question, options, key), so the
        // teacher can judge without leaving the moderation tab.
        state.reportItems = {};
        await Promise.all([...new Set(state.contentReports
          .filter((r) => r.targetType === "test_item").map((r) => r.targetId))]
          .map(async (id) => { const it = await adminFetchTestItem(id); if (it) state.reportItems[id] = it; }));
        state.bonusQs = await adminFetchBonusQuestions(); // with their answers (definer RPC)
        state.downloads = await adminFetchTestDownloads(); // all categories
        state.settings = await fetchAppSettings();         // Drive key + folders
        state.gateOff = await getGateOff();         // pre-launch gate state for the toggle
        state.convLabels = await fetchConversationLabels();
        state.eventAccessUuids = await fetchEventAccessUsers();
      }
      // A #msg/<uuid> notification link → open that person's conversation.
      if (state.pendingMsgUuid) {
        const conv = state.conversations.find(
          (c) => c.partnerId != null && uuidForSurrogate(c.partnerId) === state.pendingMsgUuid
        );
        if (conv) state.msgOpen = conv.key;
        state.pendingMsgUuid = null;
      }
      state.saved = new Set(state.posts.filter((p) => p.savedByMe).map((p) => p.id));
      MY_PROFILE.eventsAccess = await fetchMyEventsAccess(); // real events gating
      const fr = await fetchMyFriends(); // real friend graph
      MY_PROFILE.friendIds = fr.friendIds;
      MY_PROFILE.friendReqIncoming = fr.incoming;
      MY_PROFILE.friendReqOutgoing = fr.outgoing;
      // My own editable profile (settings) → the real, persisted values.
      const prof = await fetchMyProfile();
      if (prof) {
        MY_PROFILE.firstName = prof.first_name || "";
        MY_PROFILE.lastName = prof.last_name || "";
        MY_PROFILE.grade = prof.grade || "";
        MY_PROFILE.locality = prof.locality || "";
        MY_PROFILE.school = prof.school || "";
        MY_PROFILE.passions = prof.passions || "";
        MY_PROFILE.challenges = prof.challenges || "";
        MY_PROFILE.visibility = prof.visibility || "members";
        MY_PROFILE.avatar = prof.avatar || null;
        if (prof.status_line != null) MY_PROFILE.status = prof.status_line;
        if (prof.points != null) MY_PROFILE.points = prof.points;
        if (prof.created_at)
          MY_PROFILE.joined = new Date(prof.created_at).toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
        if (prof.avatar_color) CURRENT_USER.color = prof.avatar_color;
        // The admin stays "Profesor" (set in session.js) — never their name.
        if (!isAdmin()) {
          const dn = (prof.display_name || CURRENT_USER.name || "").replace(/[<>]/g, "");
          if (dn) {
            CURRENT_USER.name = dn;
            CURRENT_USER.initials = dn.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
          }
        }
        // Mandatory name: a member with no first+last name must set it before
        // using the community, so the Google nickname never shows to others.
        state.needsName = !isAdmin() && (!prof.first_name || !prof.last_name);
      }
      render();
      // Notification deep-link to a post → open it now that the feed is here.
      if (state.pendingPostUuid) {
        const sid = surrogateForPostUuid(state.pendingPostUuid);
        state.pendingPostUuid = null;
        if (sid) goToPost(sid);
      }
    } catch (e) {
      console.warn("feed:", e.message);
      // Don't fail silently: an empty hub would look the same as a real error.
      state.notice = "⚠️ N-am putut încărca tot conținutul acum. Reîncarcă pagina sau încearcă din nou.";
      render();
    }
  }

  function render() {
    if (!state._feedLoaded) {
      state._feedLoaded = true;
      loadFeed();
    }
    // Member-only sections don't exist for the teacher; guests get the
    // read-only subset (everything else lands on the public forum).
    if (isAdmin() && ADMIN_HIDDEN_SECTIONS.has(state.section)) state.section = "forum";
    if (!isLoggedIn() && !GUEST_SECTIONS.has(state.section)) state.section = "forum";
    // Mandatory name gate: a member with no real name sets it before anything.
    if (state.needsName && isLoggedIn() && !isAdmin()) {
      mount.innerHTML = `<div class="cx-shell cx-shell--gate">${nameGateScreen()}</div>`;
      const f = mount.querySelector("#ng-first");
      if (f && document.activeElement !== f) f.focus();
      return;
    }
    // Fault isolation: a throw in ONE piece (a section, the sidebar…) must not
    // blank the whole hub — the sidebar carries navigation + logout. Each piece
    // is guarded; failures log which one broke and show an inline notice.
    const guard = (fn, label, fallback = "") => {
      try {
        return fn();
      } catch (e) {
        console.error(`[community] ${label} failed:`, e);
        return fallback;
      }
    };
    const sectionHtml = guard(
      () => (SECTION_RENDER[state.section] || sectionForum)(),
      `section "${state.section}"`,
      `<div class="cx-emptybox"><h2>Această secțiune n-a putut fi afișată.</h2>
       <p class="cx-muted">Reîncarcă pagina; dacă problema persistă, anunță profesorul.</p></div>`
    );
    mount.innerHTML = `
      <div class="cx-shell">
        ${guard(sidebar, "sidebar", `<aside class="cx-side"><a class="cx-side__join" href="${basePath}">← Înapoi la site</a></aside>`)}
        <div class="cx-main">
          ${guard(crumbs, "crumbs")}
          ${sectionHtml}
        </div>
      </div>
      ${guard(lightboxHtml, "lightbox")}`;

    // The gamification simulator's local preview mirrors the current sim.
    if (state.section === "admin" && state.adminTab === "gamification") {
      const local = mount.querySelector("#cx-simpreview");
      if (local) applyBar(local, state.simLevel || 1, 62, state.simPrestige || 0);
    }

    // Chat: always land at the LATEST message (the conversation reads
    // bottom-up like any messenger).
    const chatScroll = mount.querySelector("#cx-chat-scroll");
    if (chatScroll) chatScroll.scrollTop = chatScroll.scrollHeight;

    // First time the Clasament opens: confetti over the champion's crown —
    // the top of the top should feel like an event.
    if (state.section === "clasament" && !podiumCelebrated) {
      podiumCelebrated = true;
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const crown = mount.querySelector(".cx-pod--1 .cx-pod__crown");
        if (crown) {
          const r = crown.getBoundingClientRect();
          burstAt(r.left + r.width / 2, r.top + r.height / 2, 20);
        }
      }
    }

    // Auto-focus a freshly revealed input so the user can type immediately
    // (reply box, edit box, or anything flagged via state.pendingFocus). The
    // "typing" guard avoids stealing focus if the user is already in a field.
    const focusSel =
      state.pendingFocus ||
      (state.thread.openReplyId ? ".thr__reply .thr__input" : null) ||
      (state.thread.openEditId ? ".thr__edit .thr__input" : null);
    state.pendingFocus = null;
    if (focusSel) {
      const el = mount.querySelector(focusSel);
      const a = document.activeElement;
      const typing = a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT");
      if (el && !typing) {
        el.focus();
        if (el.setSelectionRange) {
          const n = el.value.length;
          el.setSelectionRange(n, n);
        }
      }
    }
  }

  // Keep the composer textarea across re-renders triggered by its own controls.
  function syncComposer() {
    const box = mount.querySelector("#cx-post-text");
    if (box) state.composer.text = box.value;
    const gn = mount.querySelector("#cx-group-name");
    if (gn) state.composer.groupName = gn.value;
  }

  // Build a fresh post from the composer (not yet published — the publish
  // handler decides: into the feed, or held for moderation).
  function buildPost() {
    const c = state.composer;
    const text = (c.text || "").trim();
    if (!text && !c.media) return null;
    return {
      id: nextId(),
      authorId: CURRENT_USER.id,
      name: CURRENT_USER.name,
      initials: CURRENT_USER.initials,
      color: CURRENT_USER.color,
      createdAt: Date.now(),
      time: "acum",
      type: c.type,
      bg: c.bg,
      audience: c.audience || "public",
      // Where you post decides the surface: your page → wall, else the forum.
      surface: state.section === "pagina-mea" ? "wall" : "forum",
      text: escapeHtml(text),
      media: c.media,
      likes: 0,
      likedByMe: false,
      shares: 0,
      sharedByMe: false,
      followed: false,
      comments: [],
    };
  }

  function createGroup() {
    const c = state.composer;
    const name = (c.groupName || "").trim();
    if (!name) return; // a group needs a name
    // The group's name & description pass through the same language filter.
    const bad = moderate(`${name} ${c.text || ""}`);
    if (bad.length) {
      state.notice = FILTER_MESSAGE; // inline filter: warn + block (server also holds profane content)
      return;
    }
    const badM = invalidMentions(`${name} ${c.text || ""}`);
    if (badM.length) {
      state.notice = mentionMsg(badM);
      return;
    }
    // Real group: create it (name/description stored RAW, escaped at render),
    // then reload and jump straight into the new topic.
    createGroupRow({ name, iconId: c.iconId, description: (c.text || "").trim() }).then((row) => {
      if (row) state.openGroup = row.id;
      reloadGroups();
    });
    state.composer = freshComposer();
    state.groupCreateOpen = false;
    state.section = "grupuri";
    history.replaceState(null, "", "#grupuri");
  }

  // ---------- Events ----------
  mount.addEventListener("click", (e) => {
    // 1) Thread controls, scoped to the post whose comments were clicked.
    const postScope = e.target.closest("[data-post-id]");
    if (postScope) {
      const post = findPost(Number(postScope.dataset.postId));
      if (post) {
        const consumed = handleThreadClick(e, {
          comments: post.comments,
          state: state.thread,
          user: isLoggedIn() ? CURRENT_USER : GUEST_USER,
          nextId,
          canInteract: isLoggedIn,
          onGuard: () => showToast("Conectează-te ca să interacționezi cu comunitatea 🔑"),
          isAdmin: isAdmin(),
          onCorrect: awardCorrect,
          moderate,
          warnMsg: "Răspunsul conține limbaj nepotrivit. Reformulează, te rog — profesorul a fost anunțat.",
          onReport: reportComment,
          // REAL: persist comment interactions to Supabase.
          onLike: (c, liked) => toggleCommentLike(c.id, liked),
          onReact: (c, emoji, added) => toggleCommentReaction(c.id, emoji, added),
          onEdit: (c, text) => updateComment(c.id, text),
          onDelete: (c) => deleteComment(c.id),
          decorateText,
          validate: (text) => {
            const bad = invalidMentions(text, mentionEligibleForPost(post));
            return bad.length ? mentionMsg(bad) : null;
          },
          onReply: (parent, text) => {
            // REAL: persist the reply; map the new reply's id to its uuid.
            const newReply = parent.replies[parent.replies.length - 1];
            createComment({ postSurrogate: post.id, parentSurrogate: parent.id, text }).then((row) => {
              if (row && newReply) mapComment(newReply.id, row.id);
            });
            touchStreak(); // replying counts as today's activity
            notifyMentions(text, "Într-un răspuns");
            // ("Oferite" is derived from your real comments — nothing to log.)
          },
          rerender: render,
        });
        if (consumed) return;
      }
    }

    // Real links (profiles, lessons) navigate on their own — don't let a
    // clickable ancestor row (e.g. an activity row) hijack the click.
    const anchor = e.target.closest("a[href]");
    if (anchor && !anchor.dataset.action) return;

    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;

    // Guests may browse (go, filters, lightbox, the demo challenge…);
    // anything that WRITES invites them to join — but only ONCE per visit
    // (after that the ghost styling speaks for itself, no toast spam).
    if (!isLoggedIn() && !GUEST_ALLOWED_ACTIONS.has(action)) {
      if (!state.guestNudged) {
        state.guestNudged = true;
        showToast("Conectează-te ca să interacționezi cu comunitatea 🔑");
      }
      return;
    }

    const id = Number(btn.dataset.id);
    const rawId = btn.dataset.id; // string ids (exercises = Supabase UUIDs)

    switch (action) {
      case "go":
        remember();
        state.section = btn.dataset.id;
        // "Panou admin" from the sidebar always starts at Prezentare —
        // same rule as the #admin deep link (least surprise).
        if (state.section === "admin") state.adminTab = "overview";
        state.openComments.clear();
        state.openGroup = null;
        state.addMemberOpen = false;
        state.viewUser = null;
        state.editingProfile = false;
        state.feedLimit = 6;
        state.groupCreateOpen = false;
        state.postMenu = null;
        state.exPreview = false;
        // Section-local notices don't follow you around.
        state.commentWarn = state.exWarn = state.groupWarn = state.profileWarn = null;
        history.replaceState(null, "", `#${state.section}`);
        return render();

      case "nav-back": {
        const p = state.prevNav;
        if (!p) return;
        state.prevNav = null;
        state.section = p.section;
        state.openGroup = p.openGroup;
        state.viewUser = p.viewUser;
        state.adminTab = p.adminTab;
        state.editingProfile = false;
        history.replaceState(null, "", `#${p.section}`);
        return render();
      }

      // ---- profiles & friends ----
      case "view-user": {
        remember();
        const uid = Number(btn.dataset.uid);
        state.viewUser = uid === CURRENT_USER.id ? null : uid;
        state.editingProfile = false;
        state.section = "profil";
        loadViewUser(state.viewUser); // fetch their REAL profile
        // Shareable URL for this profile (deep link).
        history.replaceState(null, "", `#u/${slugForUser(uid)}`);
        return render();
      }
      case "copy-profile-link": {
        const slug = btn.dataset.slug;
        // In production, profiles have PRETTY addresses on the community
        // subdomain (comunitate.atelierulderomana.ro/vasile-ion — routed
        // by 404.html). Locally we fall back to the hash deep-link.
        const url = location.hostname.endsWith("atelierulderomana.ro")
          ? `https://comunitate.atelierulderomana.ro/${slug}`
          : `${location.origin}${location.pathname}#u/${slug}`;
        const done = () => {
          const old = btn.textContent;
          btn.textContent = "✓ Link copiat";
          setTimeout(() => { btn.textContent = old; }, 1500);
        };
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(done);
        else done();
        return;
      }
      case "friend-add": {
        const uid = Number(btn.dataset.uid);
        if (!isFriend(uid) && !reqOutgoing(uid) && !reqIncoming(uid)) {
          MY_PROFILE.friendReqOutgoing.push(uid);
          sendFriendRequest(uid); // REAL
        }
        return render();
      }
      case "friend-cancel": {
        const uid = Number(btn.dataset.uid);
        MY_PROFILE.friendReqOutgoing = MY_PROFILE.friendReqOutgoing.filter((x) => x !== uid);
        cancelFriendRequest(uid); // REAL
        return render();
      }
      case "friend-accept": {
        const uid = Number(btn.dataset.uid);
        MY_PROFILE.friendReqIncoming = MY_PROFILE.friendReqIncoming.filter((x) => x !== uid);
        if (!isFriend(uid)) MY_PROFILE.friendIds.push(uid);
        acceptFriendRequest(uid); // REAL
        return render();
      }
      case "friend-decline": {
        const uid = Number(btn.dataset.uid);
        MY_PROFILE.friendReqIncoming = MY_PROFILE.friendReqIncoming.filter((x) => x !== uid);
        declineFriendRequest(uid); // REAL
        return render();
      }
      case "friend-remove": {
        const uid = Number(btn.dataset.uid);
        MY_PROFILE.friendIds = MY_PROFILE.friendIds.filter((x) => x !== uid);
        removeFriend(uid); // REAL
        return render();
      }
      case "set-audience":
        syncComposer();
        state.composer.audience = btn.dataset.key;
        return render();

      // ---- composer ----
      case "set-type":
        syncComposer();
        state.composer.type = btn.dataset.key;
        return render();
      case "set-bg":
        syncComposer();
        state.composer.bg = btn.dataset.key;
        return render();
      case "toggle-icon":
        syncComposer();
        state.composer.iconOpen = !state.composer.iconOpen;
        return render();
      case "set-icon":
        syncComposer();
        state.composer.iconId = Number(btn.dataset.id);
        state.composer.iconOpen = false;
        return render();
      case "toggle-yt":
        syncComposer();
        state.composer.ytOpen = !state.composer.ytOpen;
        return render();
      case "add-yt": {
        const url = mount.querySelector("#cx-yt-url")?.value.trim();
        const vid = parseYouTubeId(url);
        syncComposer();
        if (vid) state.composer.media = { kind: "youtube", videoId: vid, title: "Clip YouTube" };
        state.composer.ytOpen = false;
        return render();
      }
      case "clear-media":
        syncComposer();
        state.composer.media = null;
        return render();
      case "publish": {
        syncComposer();
        if (state.composer.type === "grup") {
          createGroup();
          return render();
        }
        const post = buildPost();
        if (!post) return;
        // Profanity gate (inline): a flagged post is blocked with a friendly
        // heads-up. Anything that reaches the server is also held by the
        // `hold_if_profane` trigger for the teacher to review.
        const bad = moderate(state.composer.text);
        if (bad.length) {
          state.notice = FILTER_MESSAGE;
          state.composer = freshComposer();
          return render();
        }
        // @mentions: only friends can be mentioned (any audience I choose
        // is visible to my friends, so no further gate needed here).
        const badM = invalidMentions(state.composer.text);
        if (badM.length) {
          state.notice = mentionMsg(badM);
          return render();
        }
        state.posts.unshift(post);
        // REAL: persist to Supabase (raw composer text, not the escaped copy).
        createPost({
          type: post.type,
          bg: post.bg,
          audience: post.audience,
          text: state.composer.text,
          media: post.media,
          surface: post.surface,
        }).then((row) => {
          if (row) mapPostSurrogate(post.id, row.id);
        });
        state.notice = null;
        notifyMentions(state.composer.text, "Într-o postare din forum");
        state.composer = freshComposer();
        state.composerOpen = false; // fold back after publishing
        touchStreak(); // posting counts as today's activity
        return render();
      }
      case "dismiss-notice":
        state.notice = null;
        return render();
      case "composer-open": {
        state.composerOpen = true;
        render();
        const box = mount.querySelector("#cx-post-text");
        box?.focus();
        return;
      }

      // ---- forum discovery toolbar ----
      case "feed-type":
        state.feedType = btn.dataset.key;
        state.feedLimit = 6; // filters changed → start the page fresh
        return render();
      case "feed-sort":
        state.feedSort = btn.dataset.key;
        state.feedLimit = 6;
        return render();
      case "feed-more":
        state.feedLimit += 6;
        return render();

      // ---- bookmarks ("Salvate") ----
      case "save-post": {
        const p = findPost(id);
        if (!p) return;
        if (state.saved.has(id)) {
          state.saved.delete(id);
          showToast("Scos de la Salvate");
        } else {
          state.saved.add(id);
          showToast("🔖 Salvat — îl găsești în „Salvate”", { kind: "success" });
        }
        toggleSave(id, state.saved.has(id)); // REAL: persist to saved_posts
        return render();
      }

      // ---- post actions ----
      case "like": {
        const p = findPost(id);
        if (p && p.authorId !== CURRENT_USER.id) {
          p.likedByMe = !p.likedByMe;
          p.likes += p.likedByMe ? 1 : -1;
          togglePostLike(p.id, p.likedByMe); // REAL: persist to post_reactions
        }
        return render();
      }
      case "share": {
        const p = findPost(id);
        toggleShare(p);
        return render();
      }
      case "follow": {
        const p = findPost(id);
        if (p) {
          p.followed = !p.followed;
          showToast(p.followed ? "🔔 Urmărești postarea — o găsești la Activitate › Urmărite" : "Nu mai urmărești postarea");
        }
        state.postMenu = null;
        return render();
      }
      case "post-menu":
        state.postMenu = state.postMenu === id ? null : id;
        return render();
      case "toggle-comments": {
        const opening = !state.openComments.has(id);
        opening ? state.openComments.add(id) : state.openComments.delete(id);
        if (opening) state.pendingFocus = `[data-post-id="${id}"] [data-role="post-comment-input"]`;
        state.commentWarn = null;
        return render();
      }
      case "play-yt":
        state.playing.add(id);
        return render();
      case "post-comment": {
        const area = btn.closest(".post__comments");
        const box = area?.querySelector('[data-role="post-comment-input"]');
        const text = box?.value.trim();
        if (!text) return;
        const p = findPost(id);
        if (!p) return;
        const bad = moderate(text);
        if (bad.length) {
          state.commentWarn = { postId: id, msg: "Comentariul conține limbaj nepotrivit. Reformulează, te rog — profesorul a fost anunțat." };
          return render();
        }
        const badM = invalidMentions(text, mentionEligibleForPost(p));
        if (badM.length) {
          state.commentWarn = { postId: id, msg: mentionMsg(badM) };
          return render();
        }
        state.commentWarn = null;
        p.comments.push(makeUserComment(text, CURRENT_USER, nextId));
        // REAL: persist the comment to Supabase, then map its id to the uuid.
        const newC = p.comments[p.comments.length - 1];
        createComment({ postSurrogate: p.id, text }).then((row) => {
          if (row) mapComment(newC.id, row.id);
        });
        notifyMentions(text, "Într-un comentariu");
        touchStreak(); // commenting counts as today's activity
        // ("Oferite" is derived from your real comments — nothing to log.)
        return render();
      }
      case "post-report": {
        const p = findPost(id);
        if (!p) return;
        state.postMenu = null;
        confirmDialog("Postarea va fi trimisă profesorului spre verificare.", { title: "Raportezi postarea?", okLabel: "Raportează" }).then((ok) => {
          if (ok) {
            reportPost(p);
            showToast("⚑ Semnalat — profesorul va arunca o privire", { kind: "success" });
          }
          render();
        });
        return;
      }

      // ---- image lightbox ----
      case "open-image":
        state.lightbox = { postId: id, i: Number(btn.dataset.i) };
        return render();
      case "lb-close":
        state.lightbox = null;
        return render();
      case "lb-prev":
      case "lb-next": {
        const p = findPost(state.lightbox?.postId);
        const n = p?.media?.images?.length || 0;
        if (!n) return;
        const dir = action === "lb-next" ? 1 : -1;
        state.lightbox.i = (state.lightbox.i + dir + n) % n;
        return render();
      }
      case "lb-copy": {
        const p = findPost(state.lightbox?.postId);
        const im = p?.media?.images?.[state.lightbox?.i];
        if (!im?.src) return;
        // Copy the actual pixels to the clipboard (falls back gracefully).
        fetch(im.src)
          .then((r) => r.blob())
          .then((blob) => navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]))
          .then(() => showToast("📋 Imagine copiată în clipboard", { kind: "success" }))
          .catch(() => showToast("Nu s-a putut copia imaginea în acest browser", { kind: "error" }));
        return;
      }
      case "lb-save":
        // The <a download> does the job natively; just confirm it.
        showToast("💾 Descărcarea a pornit", { kind: "success" });
        return;
      case "lb-share": {
        const p = findPost(state.lightbox?.postId);
        toggleShare(p); // its own toast; the lightbox stays open
        return render();
      }
      case "lb-reply": {
        const lb = state.lightbox;
        if (!lb) return;
        state.lightbox = null;
        state.openComments.add(lb.postId);
        render();
        // Prefill a comment about THAT image and put the caret ready to type.
        const box = mount.querySelector(`[data-post-id="${lb.postId}"] [data-role="post-comment-input"]`);
        if (box) {
          box.value = `Referitor la imaginea ${lb.i + 1}: `;
          box.focus();
          box.setSelectionRange(box.value.length, box.value.length);
          box.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        return;
      }

      // ---- manage own posts (author) / any post (admin) ----
      case "post-edit": {
        const p = findPost(id);
        if (!p || !canEditPost(p)) return;
        state.editingPost = id;
        state.pendingFocus = `[data-post-id="${id}"] [data-role="edit-post"]`;
        return render();
      }
      case "post-cancel-edit":
        state.editingPost = null;
        return render();
      case "post-save": {
        const p = findPost(id);
        if (!p || !canEditPost(p)) return;
        const box = btn.closest("[data-post-id]")?.querySelector('[data-role="edit-post"]');
        const text = box?.value.trim();
        if (!text) return;
        const bad = moderate(text);
        if (bad.length) {
          state.notice = FILTER_MESSAGE;
          state.editingPost = null;
          return render();
        }
        p.text = escapeHtml(text);
        p.edited = true;
        updatePost(p.id, text); // REAL: persist the edit
        state.editingPost = null;
        return render();
      }
      case "post-del": {
        const p = findPost(id);
        if (!p || !canManagePost(p)) return;
        confirmDialog("Postarea va fi ștearsă definitiv — nu se poate anula.", { title: "Ștergi postarea?", okLabel: "Șterge", danger: true }).then((ok) => {
          if (!ok) return;
          deletePost(p.id); // REAL: persist the deletion
          removePost(id);
          if (isAdmin() && p.authorId !== CURRENT_USER.id) logAdmin(`🗑 ai șters o postare a lui ${p.name}`);
          render();
        });
        return;
      }

      // ---- activity ----
      case "act-tab":
        state.activityTab = btn.dataset.id;
        return render();
      case "act-open":
        return goToPost(id);

      // ---- leaderboard: applause + poke ----
      case "clap": {
        const uid = Number(btn.dataset.uid);
        const u = userById(uid);
        if (u && giveClap(uid)) showToast(`👏 Aplauze trimise lui ${u.name.split(" ")[0]}!`, { kind: "success" });
        return render();
      }
      case "poke": {
        const uid = Number(btn.dataset.uid);
        const u = userById(uid);
        if (u && givePoke(uid)) {
          showToast(`👉 Poke trimis lui ${u.name.split(" ")[0]} — știe acum că te apropii!`, { kind: "success" });
        }
        return render();
      }

      // ---- exercises: pending / history tabs ----
      case "ex-tab":
        state.exTab = btn.dataset.id;
        return render();
      case "hist-sort": {
        const key = btn.dataset.id;
        const s = state.histSort;
        // Same column → flip direction; new column → sensible default.
        state.histSort = s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "date" ? "desc" : "asc" };
        return render();
      }
      case "hist-filter":
        state.histFilter = btn.dataset.id;
        return render();

      // ---- discover: challenge — the SERVER decides + awards (cheat-safe) ----
      case "challenge": {
        if (!state.challenge || state.challengeSolve || state.challengePending) return;
        const choice = Number(btn.dataset.i);
        // A GUEST no longer gets a local verdict — the answer isn't in the page
        // any more. That's honest AND the best moment to invite them in.
        if (!isLoggedIn()) {
          showToast("Conectează-te ca să afli dacă e corect — și să primești puncte 🔑");
          return;
        }
        // The teacher previews locally (he already holds the answer) — no
        // points, no server write: he isn't in the game.
        if (isAdmin()) {
          const ans = state.challengeAnswer;
          state.challengeSolve = { choice, correct: ans != null && choice === ans };
          return render();
        }
        // Members: solve_challenge decides correctness + awards points ONCE,
        // and returns the answer so we can reveal it.
        state.challengePending = true;
        render();
        solveChallenge(state.challenge.id, choice).then((res) => {
          state.challengePending = false;
          if (!res || res.error) return render();
          state.challengeSolve = { choice, correct: !!res.correct };
          if (res.answer != null) state.challengeAnswer = Number(res.answer); // reveal now
          touchStreak(); // showing up for the challenge keeps the flame
          if (res.correct && res.awarded) {
            awardPoints("Provocarea zilei rezolvată", res.awarded); // sync total + history
            pointsFx(res.awarded);
          }
          render();
        });
        return;
      }

      // ---- groups (topics) ----
      case "group-create-toggle":
        syncComposer();
        state.groupCreateOpen = !state.groupCreateOpen;
        state.composer.type = state.groupCreateOpen ? "grup" : "discutie";
        return render();
      case "open-group": {
        remember();
        state.openGroup = rawId;
        state.addMemberOpen = false;
        state.openComments.clear();
        // Visiting clears this group's "nou" pulse.
        const seen = groupSeen();
        seen[rawId] = Date.now();
        store.set("atelier_group_seen", seen);
        return render();
      }
      case "group-toggle": {
        const g = findGroup(rawId);
        if (g) {
          const i = g.memberIds.indexOf(CURRENT_USER.id);
          const wasMember = i >= 0;
          if (wasMember) g.memberIds.splice(i, 1);
          else g.memberIds.push(CURRENT_USER.id);
          (wasMember ? leaveGroup(rawId) : joinGroup(rawId)); // persist (real)
        }
        return render();
      }
      case "toggle-addmember":
        state.addMemberOpen = !state.addMemberOpen;
        return render();
      case "add-member": {
        const g = findGroup(state.openGroup);
        const uid = Number(btn.dataset.uid);
        if (g && canAddMembers(g) && !g.memberIds.includes(uid)) {
          g.memberIds.push(uid);
          const uuid = uuidForSurrogate(uid);
          if (uuid) addGroupMember(state.openGroup, uuid); // persist (RLS checks the rule)
        }
        return render();
      }
      case "group-kick": {
        const g = findGroup(state.openGroup);
        const uid = Number(btn.dataset.uid);
        const uuid = uuidForSurrogate(uid);
        if (g && (g.creatorId === CURRENT_USER.id || isAdmin()) && uuid) {
          g.memberIds = g.memberIds.filter((m) => m !== uid);
          kickGroupMember(state.openGroup, uuid); // persist (RLS: creator/admin)
        }
        return render();
      }
      case "toggle-members-add": {
        const g = findGroup(rawId);
        if (g && (g.creatorId === CURRENT_USER.id || isAdmin())) {
          g.allowMembersAdd = !g.allowMembersAdd;
          updateGroup(rawId, { allowMembersAdd: g.allowMembersAdd }); // persist
        }
        return render();
      }
      case "group-post": {
        const g = findGroup(rawId);
        const box = mount.querySelector("#cx-group-post");
        const text = box?.value.trim();
        if (!g || !text) return;
        const bad = moderate(text);
        if (bad.length) {
          state.groupWarn = "Postarea conține limbaj nepotrivit. Reformulează, te rog — profesorul a fost anunțat.";
          return render();
        }
        const badM = invalidMentions(text, (u) =>
          g.memberIds.includes(u.id) ? true : "nu e membru al acestui grup"
        );
        if (badM.length) {
          state.groupWarn = mentionMsg(badM);
          return render();
        }
        state.groupWarn = null;
        // Real group post (raw body; escaped at render). Reload this wall after.
        postToGroup(rawId, { text }).then(() => reloadGroupPosts(rawId));
        if (box) box.value = "";
        touchStreak(); // group activity counts too
        return render();
      }
      case "group-edit":
        state.editingGroup = true;
        return render();
      case "group-edit-cancel":
        state.editingGroup = false;
        return render();
      case "group-set-icon": {
        const g = findGroup(state.openGroup);
        if (g) {
          g.iconId = Number(btn.dataset.id);
          g.color = groupColor(g.iconId);
        }
        return render();
      }
      case "group-save": {
        const g = findGroup(rawId);
        const name = mount.querySelector("#cx-editgroup-name")?.value.trim();
        const desc = mount.querySelector("#cx-editgroup-desc")?.value.trim();
        if (g && name) {
          const bad = moderate(`${name} ${desc || ""}`);
          if (bad.length) {
            state.groupWarn = "Numele sau descrierea conțin limbaj nepotrivit.";
            return render();
          }
          state.groupWarn = null;
          g.name = name; // raw; escaped at render
          g.description = desc || "";
          updateGroup(rawId, { name, description: desc || "", iconId: g.iconId }); // persist
        }
        state.editingGroup = false;
        return render();
      }
      case "group-del": {
        const g = findGroup(rawId);
        if (!g || !(g.creatorId === CURRENT_USER.id || isAdmin())) return;
        confirmDialog(`Grupul „${g.name}” va fi șters, cu tot cu postările lui.`, { title: "Ștergi grupul?", okLabel: "Șterge", danger: true }).then((ok) => {
          if (!ok) return;
          state.openGroup = null;
          state.editingGroup = false;
          if (isAdmin()) logAdmin(`🗑 ai șters grupul „${g.name}”`);
          deleteGroup(rawId).then(reloadGroups); // real delete (cascades group posts)
        });
        return;
      }

      // ---- events ----
      case "event-go": {
        const ev = state.events.find((x) => x.id === rawId);
        if (ev) { ev.going = !ev.going; rsvpEvent(rawId, ev.going); } // persist RSVP (real)
        return render();
      }
      case "admin-new-event":
        if (!isAdmin()) return;
        state.newEventOpen = true;
        state.editingEvent = null;
        return render();
      case "admin-edit-event":
        if (!isAdmin()) return;
        state.editingEvent = rawId;
        state.newEventOpen = false;
        return render();
      case "admin-event-cancel":
        state.newEventOpen = false;
        state.editingEvent = null;
        return render();
      case "admin-create-event": {
        if (!isAdmin()) return;
        const title = mount.querySelector("#cx-ev-title")?.value.trim();
        if (!title) return;
        // Store RAW (escaped at render); the teacher creates it (RLS admin-only).
        createEvent({
          title,
          kind: mount.querySelector("#cx-ev-kind")?.value || "live",
          whenText: mount.querySelector("#cx-ev-when")?.value.trim() || "curând",
          host: mount.querySelector("#cx-ev-host")?.value.trim() || "Atelierul",
        }).then(reloadEvents);
        state.newEventOpen = false;
        return render();
      }
      case "admin-save-event": {
        if (!isAdmin()) return;
        const title = mount.querySelector("#cx-ev-title")?.value.trim();
        if (title) {
          updateEvent(rawId, {
            title,
            kind: mount.querySelector("#cx-ev-kind")?.value || "live",
            whenText: mount.querySelector("#cx-ev-when")?.value.trim() || "",
            host: mount.querySelector("#cx-ev-host")?.value.trim() || "",
          }).then(reloadEvents);
        }
        state.editingEvent = null;
        return render();
      }
      case "admin-del-event": {
        if (!isAdmin()) return;
        deleteEvent(rawId).then(reloadEvents); // real delete
        return render();
      }

      // ---- admin ----
      case "grant-events": {
        if (!isAdmin()) return;
        const uid = Number(btn.dataset.uid);
        const uuid = uuidForSurrogate(uid);
        if (!uuid) return;
        // Real event access: insert/delete an event_access row (admin-only, RLS).
        if (state.eventAccessUuids.has(uuid)) { state.eventAccessUuids.delete(uuid); revokeEventAccess(uuid); }
        else { state.eventAccessUuids.add(uuid); grantEventAccess(uuid); }
        return render();
      }
      case "admin-view":
        state.adminViewUser = Number(btn.dataset.uid);
        return render();
      case "admin-closeview":
        state.adminViewUser = null;
        return render();
      case "sim-reset":
        state.simLevel = null;
        state.simPrestige = 0;
        setPreview(null, 0);
        return render();
      case "admin-tab":
        if (!isAdmin()) return;
        state.adminTab = btn.dataset.id;
        state.section = "admin";
        // Shareable, quick-panel-compatible URL for this exact tab.
        history.replaceState(null, "", `#admin/${ADMIN_SLUG_BY_TAB[state.adminTab] || "prezentare"}`);
        return render();
      case "gate-toggle": {
        if (!isAdmin()) return;
        const next = !state.gateOff;
        setGateOff(next).then((ok) => {
          if (!ok) { showToast("Nu am putut schimba poarta.", { kind: "error" }); return; }
          state.gateOff = next;
          showToast(next ? "Poarta oprită — site public." : "Poarta pornită — doar echipa intră.", { kind: "success" });
          render();
        });
        return;
      }
      case "admin-user-sort":
        if (!isAdmin()) return;
        state.adminUserSort = btn.dataset.key;
        state.adminUserPage = 1;
        return render();
      case "admin-user-page":
        if (!isAdmin()) return;
        state.adminUserPage = Math.max(1, state.adminUserPage + Number(btn.dataset.dir));
        return render();

      // ---- admin: scheduled daily challenges ----
      case "ch-new":
        if (!isAdmin()) return;
        state.chEditId = "new";
        state.chWarn = null;
        return render();
      case "ch-edit":
        if (!isAdmin()) return;
        state.chEditId = btn.dataset.chid;
        state.chWarn = null;
        return render();
      case "ch-cancel":
        state.chEditId = null;
        state.chWarn = null;
        return render();
      case "ch-del": {
        if (!isAdmin()) return;
        deleteChallenge(btn.dataset.chid).then(reloadChallenges); // REAL delete
        showToast("🗑 Provocare ștearsă");
        return render();
      }
      case "ch-save": {
        if (!isAdmin()) return;
        const val = (sel) => mount.querySelector(sel)?.value.trim() || "";
        const prompt = val("#chf-prompt");
        const options = [0, 1, 2, 3].map((i) => val(`#chf-opt-${i}`)).filter(Boolean);
        const picked = Number(mount.querySelector('input[name="chf-correct"]:checked')?.value ?? 0);
        const correctText = val(`#chf-opt-${picked}`);
        if (!prompt || options.length < 2 || !correctText) {
          state.chWarn = "Completează întrebarea și cel puțin 2 variante, cu răspunsul corect bifat.";
          return render();
        }
        const fields = {
          date: val("#chf-date") || null,
          prompt,
          options,
          correct: options.indexOf(correctText),
          explanation: val("#chf-explanation"),
          reward: Math.max(5, Math.min(50, Number(val("#chf-reward")) || 15)),
        };
        const chid = btn.dataset.chid; // "" for a new one, uuid for an edit
        // REAL: insert or update in Supabase, then refresh the list + today.
        (chid ? updateChallenge(chid, fields) : createChallenge(fields)).then(reloadChallenges);
        state.chEditId = null;
        state.chWarn = null;
        showToast("⚡ Provocare salvată", { kind: "success" });
        return render();
      }

      // ---- moderation queue (real: reports + filter-held content) ----
      case "report-resolve": {
        const rid = btn.dataset.id;
        resolveReport(rid);
        state.contentReports = state.contentReports.filter((r) => r.id !== rid);
        return render();
      }
      // Closing a flagged item also answers the pupil: founded → notification
      // (+ points), unfounded → the teacher's note in their inbox. The server
      // decides both, so neither can be triggered from the client alone.
      case "report-founded":
      case "report-unfounded": {
        const rid = btn.dataset.id;
        const founded = btn.dataset.action === "report-founded";
        const note = mount.querySelector(`.cx-repnote[data-rid="${rid}"]`)?.value || "";
        resolveTestReport(rid, founded, note);
        state.contentReports = state.contentReports.filter((r) => r.id !== rid);
        showToast(founded
          ? "✓ Întemeiată — elevul a fost anunțat și premiat."
          : "Respinsă — explicația a plecat în mesageria elevului.");
        return render();
      }
      case "drive-save-key": {
        const v = (mount.querySelector("#cx-drive-key")?.value || "").trim();
        saveAppSetting("drive_api_key", v).then((ok) => {
          state.settings.drive_api_key = v;
          showToast(ok ? "Cheie salvată." : "N-am putut salva cheia.");
          render();
        });
        return;
      }
      case "drive-save-folder": {
        const slug = btn.dataset.slug;
        const v = (mount.querySelector(`[data-f="folder"][data-slug="${slug}"]`)?.value || "").trim();
        saveAppSetting(`drive_folder_${slug}`, v).then((ok) => {
          state.settings[`drive_folder_${slug}`] = v;
          showToast(ok ? "Folder salvat." : "N-am putut salva folderul.");
          render();
        });
        return;
      }
      case "drive-load": {
        const slug = btn.dataset.slug;
        state.driveFiles[slug] = { loading: true };
        render();
        listDriveFolder(state.settings[`drive_folder_${slug}`], state.settings.drive_api_key)
          .then((res) => {
            state.driveFiles[slug] = res.error ? { error: res.error } : { files: res.files };
            render();
          });
        return;
      }
      // Adds one found file. The name gives the label, the year and the kind —
      // all editable afterwards on the row itself.
      case "drive-add": {
        const slug = btn.dataset.slug;
        const name = btn.dataset.name || "fișier";
        saveTestDownload({
          exam: slug,
          year: (name.match(/(20\d{2})/) || [])[1] || "",
          label: name.replace(/\.[a-z0-9]+$/i, ""),
          kind: ((name.match(/\.([a-z0-9]+)$/i) || [])[1] || "pdf").toUpperCase(),
          url: `https://drive.google.com/file/d/${btn.dataset.fid}/view`,
          active: true,
        }).then(async (ok) => {
          if (!ok) return showToast("N-am putut adăuga fișierul.");
          state.downloads = await adminFetchTestDownloads();
          render();
        });
        return;
      }
      case "dl-save": {
        const row = btn.closest(".cx-dlrow");
        if (!row) return;
        const f = (name) => row.querySelector(`[data-f="${name}"]`);
        const label = f("label")?.value.trim() || "", url = f("url")?.value.trim() || "";
        if (!label || !url) { showToast("Eticheta și linkul nu pot fi goale."); return; }
        saveTestDownload({
          id: btn.dataset.id, exam: row.dataset.exam, // keep it in ITS category
          year: f("year")?.value.trim(), label,
          note: f("note")?.value.trim(), kind: f("kind")?.value.trim() || "PDF",
          url, active: !!f("active")?.checked,
        }).then(async (ok) => {
          if (!ok) return showToast("N-am putut salva.");
          state.downloads = await adminFetchTestDownloads();
          render();
        });
        return;
      }
      case "dl-del": {
        const did = btn.dataset.id;
        deleteTestDownload(did);
        state.downloads = state.downloads.filter((d) => d.id !== did);
        return render();
      }
      case "bonus-add": {
        const p = (mount.querySelector("#cx-bonus-prompt")?.value || "").trim();
        const a = (mount.querySelector("#cx-bonus-answers")?.value || "")
          .split(",").map((s) => s.trim()).filter(Boolean);
        if (!p || !a.length) { showToast("Scrie întrebarea și cel puțin un răspuns."); return; }
        saveBonusQuestion({ prompt: p, answers: a, active: true }).then(async (ok) => {
          if (!ok) return showToast("N-am putut salva întrebarea.");
          state.bonusQs = await adminFetchBonusQuestions();
          render();
        });
        return;
      }
      case "bonus-save": {
        const row = btn.closest(".cx-bonusrow");
        if (!row) return;
        const prompt = row.querySelector('[data-f="prompt"]')?.value.trim() || "";
        const answers = (row.querySelector('[data-f="answers"]')?.value || "")
          .split(",").map((s) => s.trim()).filter(Boolean);
        const active = !!row.querySelector('[data-f="active"]')?.checked;
        if (!prompt || !answers.length) { showToast("Întrebarea și răspunsurile nu pot fi goale."); return; }
        saveBonusQuestion({ id: btn.dataset.id, prompt, answers, active })
          .then((ok) => showToast(ok ? "Salvat." : "N-am putut salva."));
        return;
      }
      case "bonus-del": {
        const bid = btn.dataset.id;
        deleteBonusQuestion(bid);
        state.bonusQs = state.bonusQs.filter((q) => q.id !== bid);
        return render();
      }
      case "prof-add": {
        const inp = mount.querySelector("#cx-prof-term");
        const term = (inp?.value || "").trim().toLowerCase();
        if (term && !state.profanityTerms.some((t) => t.term === term)) {
          addProfanityTerm(term).then((row) => {
            if (!row) return;
            state.profanityTerms = [...state.profanityTerms, row].sort((a, b) => a.term.localeCompare(b.term));
            setCustomProfanity(state.profanityTerms);
            render();
          });
        }
        return render();
      }
      case "prof-del": {
        const pid = btn.dataset.id;
        removeProfanityTerm(pid);
        state.profanityTerms = state.profanityTerms.filter((t) => t.id !== pid);
        setCustomProfanity(state.profanityTerms);
        return render();
      }
      case "held-approve": {
        moderateContent(btn.dataset.kind, btn.dataset.id, "visible");
        state.heldContent = state.heldContent.filter((h) => !(h.id === btn.dataset.id && h.kind === btn.dataset.kind));
        state._feedLoaded = false; // reload so the published item shows in the feed
        return render();
      }
      case "held-reject": {
        moderateContent(btn.dataset.kind, btn.dataset.id, "blocked");
        state.heldContent = state.heldContent.filter((h) => !(h.id === btn.dataset.id && h.kind === btn.dataset.kind));
        return render();
      }
      case "block": {
        const uid = Number(btn.dataset.uid);
        state.blockedIds.add(uid);
        blockUser(uid);
        state.posts = state.posts.filter((p) => p.authorId !== uid); // hide their content now
        showToast("🚫 Blocat — nu-i mai vezi postările.");
        return render();
      }
      case "unblock": {
        const uid = Number(btn.dataset.uid);
        state.blockedIds.delete(uid);
        unblockUser(uid);
        state._feedLoaded = false; // reload so their posts come back
        return render();
      }
      case "fav-remove": {
        const slug = btn.dataset.slug;
        removeFavorite(slug);
        state.favorites = state.favorites.filter((f) => f.slug !== slug);
        return render();
      }
      case "post-pin": {
        const p = findPost(Number(btn.dataset.id));
        if (p) { p.pinned = !p.pinned; pinGroupPost(p.id, p.pinned); }
        return render();
      }
      // ---- exercises ----
      case "ex-toggle":
        state.exComposer.open = !state.exComposer.open;
        state.exEditId = null; // one exf-* form at a time
        state.exPreview = false;
        return render();
      case "ex-preview": {
        // Keep what's typed: preview re-renders the form with live values.
        const keep = {
          prompt: mount.querySelector("#cx-ex-prompt")?.value || "",
          lesson: mount.querySelector("#cx-ex-lesson")?.value || state.exComposer.lesson,
        };
        state.exPreview = !state.exPreview;
        const form = readExerciseForm(mount, state.exComposer.kind);
        render();
        const pr = mount.querySelector("#cx-ex-prompt");
        if (pr) pr.value = keep.prompt;
        const ls = mount.querySelector("#cx-ex-lesson");
        if (ls) ls.value = keep.lesson;
        // Re-fill the structured fields from what was just read.
        if (form.ok && form.data) {
          const d = form.data;
          if (state.exComposer.kind === "choice")
            d.options.forEach((o, i) => { const el = mount.querySelector(`#exf-opt-${i}`); if (el) el.value = o; });
          if (state.exComposer.kind === "fill") {
            const el = mount.querySelector("#exf-answer");
            if (el) el.value = d.answer.split("|").join(" / ");
          }
          if (state.exComposer.kind === "match")
            d.pairs.forEach(([l, r], i) => {
              const le = mount.querySelector(`#exf-l-${i}`);
              const re2 = mount.querySelector(`#exf-r-${i}`);
              if (le) le.value = l;
              if (re2) re2.value = r;
            });
        }
        return;
      }

      // ---- admin: edit a proposal before approving it ----
      case "ex-admin-edit":
        if (!isAdmin()) return;
        state.exEditId = rawId;
        state.exEditWarn = null;
        state.exComposer.open = false; // one exf-* form at a time
        // From the Moderare tab, jump to Exerciții where the editor lives.
        if (state.section === "admin") {
          state.section = "exercitii";
          state.exTab = "pending";
          history.replaceState(null, "", "#exercitii");
        }
        return render();
      case "ex-admin-cancel":
        state.exEditId = null;
        state.exEditWarn = null;
        return render();
      case "ex-admin-save": {
        if (!isAdmin()) return;
        const ex = state.proposed.find((x) => x.id === rawId);
        if (!ex) return;
        const prompt = mount.querySelector("#exf-prompt")?.value.trim();
        if (!prompt) {
          state.exEditWarn = "Enunțul nu poate rămâne gol.";
          return render();
        }
        const form = readExerciseForm(mount, ex.kind);
        if (!form.ok) {
          state.exEditWarn = form.error;
          return render();
        }
        ex.prompt = prompt; // stored RAW; escaped at render (no double-escape)
        ex.data = form.data;
        ex.editedByAdmin = true;
        updateExercise(rawId, { prompt, data: form.data }); // persist (admin, real)
        state.exEditId = null;
        state.exEditWarn = null;
        showToast("✎ Propunere actualizată — o poți aproba acum", { kind: "success" });
        return render();
      }
      case "ex-kind":
        state.exComposer.kind = btn.dataset.key;
        return render();
      case "ex-vote": {
        const ex = state.proposed.find((x) => x.id === rawId);
        // Same rule as likes: never your own proposal.
        if (ex && ex.authorId !== CURRENT_USER.id) {
          ex.votedByMe = !ex.votedByMe;
          ex.votes += ex.votedByMe ? 1 : -1;
          voteExercise(ex.id, ex.votedByMe); // persist (real)
        }
        return render();
      }
      case "admin-approve-ex":
      case "admin-reject-ex": {
        if (!isAdmin()) return;
        const approved = action === "admin-approve-ex";
        const ex = state.proposed.find((x) => x.id === rawId);
        if (ex) logAdmin(`${approved ? "✓ ai aprobat" : "✕ ai respins"} exercițiul lui ${ex.name}`);
        // The SERVER approves + awards the author (approve_exercise RPC,
        // cheat-safe via points_ledger). No client-side points.
        (approved ? approveExercise(rawId) : rejectExercise(rawId)).then(reloadExercises);
        return;
      }
      case "admin-del-ex": {
        if (!isAdmin()) return;
        confirmDialog("Propunerea de exercițiu va fi ștearsă definitiv.", { title: "Ștergi propunerea?", okLabel: "Șterge", danger: true }).then((ok) => {
          if (!ok) return;
          logAdmin("🗑 ai șters o propunere de exercițiu");
          deleteExercise(rawId).then(reloadExercises); // real delete
        });
        return;
      }
      case "ex-submit": {
        const lesson = mount.querySelector("#cx-ex-lesson")?.value || state.exComposer.lesson;
        const prompt = mount.querySelector("#cx-ex-prompt")?.value.trim();
        if (!prompt) return;
        const badEx = moderate(prompt);
        if (badEx.length) {
          state.exWarn = "Enunțul conține limbaj nepotrivit. Reformulează, te rog — profesorul a fost anunțat.";
          return render();
        }
        // Structured fields → the exercise becomes solvable once approved.
        const form = readExerciseForm(mount, state.exComposer.kind);
        if (!form.ok) {
          state.exWarn = form.error;
          return render();
        }
        state.exWarn = null;
        const slug = LESSONS.find((l) => l.title === lesson)?.slug || "";
        if (!slug) { state.exWarn = "Alege o lecție validă din listă."; return render(); }
        // Store the prompt RAW (escaped at render); status forced 'pending' by RLS.
        proposeExercise({ lessonSlug: slug, kind: state.exComposer.kind, prompt, data: form.data })
          .then(reloadExercises);
        state.exComposer.open = false;
        touchStreak(); // proposing counts as today's activity
        showToast("✅ Propunere trimisă — profesorul o va verifica.", { kind: "success" });
        return render();
      }

      // ---- messages (chat) ----
      case "msg-to": {
        // "✉️ Mesaj" on a member's profile → open (or start) their chat.
        const uid = Number(btn.dataset.uid);
        if (!isLoggedIn() || uid === CURRENT_USER.id || !userById(uid)) return;
        remember();
        state.section = "mesaje";
        state.msgOpen = `u${uid}`;
        state.viewUser = null;
        state.msgParts = [];
        state.msgSlot = null;
        state.msgWarn = null;
        state.msgNewQuery = "";
        history.replaceState(null, "", "#mesaje");
        return render();
      }
      case "msg-to-teacher": {
        // "Conversație nouă → Profesorul" (member free-text channel).
        state.section = "mesaje";
        state.msgOpen = "t";
        state.msgNewQuery = "";
        state.msgWarn = null;
        return render();
      }
      case "msg-open": {
        const key = btn.dataset.key;
        state.msgOpen = key;
        state.msgParts = [];
        state.msgSlot = null;
        state.msgWarn = null;
        const conv = state.conversations.find((c) => c.key === key);
        if (conv && conv.unread) {
          markConversationReadReal(conv, isAdmin()); // REAL: persist read
          conv.unread = 0;
          conv.msgs.forEach((m) => (m.read = true));
          window.dispatchEvent(new CustomEvent("atelier:notifs")); // badges follow
        }
        return render();
      }
      case "msg-cat":
        state.msgCat = Number(btn.dataset.i);
        state.msgQuery = "";
        return render();
      case "msg-locked":
        // Locked template tapped: a nudge, not a wall — say HOW to get it.
        showToast(`🔒 Se deblochează la nivelul ${btn.dataset.lvl} — adună puncte!`);
        return;
      case "msg-pick": {
        if (state.msgParts.length >= MSG_MAX_PARTS) {
          showToast(`Maxim ${MSG_MAX_PARTS} șabloane într-un mesaj`, { kind: "warn" });
          return;
        }
        const text = btn.dataset.text;
        // A slotted template ("…{opera}…") → pick the blank from a list first.
        if (slotsIn(text).length) { state.msgSlot = text; return render(); }
        state.msgParts.push(text);
        return render();
      }
      case "msg-slot-add": {
        const text = state.msgSlot;
        if (!text) return;
        const values = {};
        for (const s of slotsIn(text)) values[s] = mount.querySelector(`#cx-slot-${s}`)?.value || "";
        if (state.msgParts.length < MSG_MAX_PARTS) state.msgParts.push(fillTemplate(text, values));
        state.msgSlot = null;
        return render();
      }
      case "msg-slot-cancel":
        state.msgSlot = null;
        return render();
      case "msg-part-del":
        state.msgParts.splice(Number(btn.dataset.i), 1);
        return render();
      case "msg-parts-clear":
        state.msgParts = [];
        return render();
      case "msg-send": {
        // Member → member: chained templates, ONE message. REAL (Supabase);
        // the server also requires a template_key (migration 0013).
        const conv = state.msgOpen;
        const toId = conv?.startsWith("u") ? Number(conv.slice(1)) : NaN;
        const target = userById(toId);
        if (!target || !state.msgParts.length) return;
        const body = state.msgParts.join("\n");
        sendTemplateMsg(toId, body, "tpl").then(reloadConversations);
        state.msgParts = [];
        showToast(`✉️ Trimis lui ${(target.name || "").split(" ")[0]}`, { kind: "success" });
        touchStreak();
        return render();
      }
      case "msg-free-user": {
        // Member → member FREE text (≤30 chars), quota enforced by the server.
        const conv = state.msgOpen;
        const toId = conv?.startsWith("u") ? Number(conv.slice(1)) : NaN;
        const target = userById(toId);
        const box = mount.querySelector("#cx-free-msg");
        const text = box?.value.trim();
        if (!target || !text) return;
        if (text.length > 30) { state.msgWarn = "Maxim 30 de caractere pentru un mesaj liber."; return render(); }
        if (moderate(text).length) { state.msgWarn = "Mesajul conține limbaj nepotrivit — reformulează, te rog."; return render(); }
        state.msgWarn = null;
        sendFreeMsg(toId, text).then((res) => {
          if (res && res.error === "quota") showToast("Ai terminat mesajele libere cu acest coleg — adună puncte pentru altele.", { kind: "warn" });
          else if (res && res.error) showToast("Mesajul liber n-a putut fi trimis.", { kind: "error" });
          reloadConversations();
        });
        touchStreak();
        return render();
      }
      case "msg-report-msg": {
        const mid = btn.dataset.id; // real message uuid
        if (!mid) return;
        confirmDialog("Mesajul va fi trimis profesorului spre verificare.", { title: "Raportezi mesajul?", okLabel: "Raportează" }).then((ok) => {
          if (!ok) return;
          reportMessage(mid);
          showToast("⚑ Semnalat — profesorul va verifica.", { kind: "success" });
        });
        return;
      }
      case "msg-free-send": {
        // Free text: member → teacher, or the teacher → anyone.
        const box = mount.querySelector("#cx-msg-free");
        const text = box?.value.trim();
        if (!text) return;
        // Free text — but still civilised, even toward the teacher.
        if (moderate(text).length) {
          state.msgWarn = "Mesajul conține limbaj nepotrivit — reformulează, te rog.";
          return render();
        }
        state.msgWarn = null;
        const conv = state.msgOpen;
        if (isAdmin()) {
          const open = state.conversations.find((c) => c.key === conv);
          // Partner surrogate: from an existing conversation, OR parsed from a
          // fresh "u<sid>" key when the teacher STARTS a chat with a member who
          // hasn't written first (before, this returned → the message never sent).
          let partner = open ? open.partnerId : null;
          if (partner == null && typeof conv === "string" && /^u\d+$/.test(conv)) partner = Number(conv.slice(1));
          if (partner == null) return; // guest replies are handled elsewhere
          sendTeacherReply(partner, text).then(reloadConversations); // REAL
          showToast("✉️ Mesaj trimis", { kind: "success" });
        } else {
          if (conv !== "t") return; // members' free text goes ONLY to the teacher
          sendTeacherMsg(text).then(reloadConversations); // REAL
          showToast("✉️ Mesaj trimis profesorului", { kind: "success" });
          touchStreak();
        }
        return render();
      }

      // ---- admin inbox: conversation labels ----
      case "msg-label": {
        if (!isAdmin()) return;
        const uid = Number(btn.dataset.uid);
        const label = btn.dataset.label || null;
        const uuid = uuidForSurrogate(uid);
        if (uuid) {
          if (label) state.convLabels[uuid] = label;
          else delete state.convLabels[uuid];
        }
        setConversationLabel(uid, label); // REAL
        return render();
      }
      case "msg-label-filter":
        state.msgLabelFilter = btn.dataset.id;
        return render();

      // ---- notebook / status ----
      case "add-note": {
        const t = mount.querySelector("#cx-note-title")?.value.trim();
        const x = mount.querySelector("#cx-note-text")?.value.trim();
        const lessonHref = mount.querySelector("#cx-note-lesson")?.value || null;
        if (!x) return;
        addNote({ title: t, text: x, lessonHref }).then(() => { state.notes = getNotes(); render(); });
        return render();
      }
      case "note-edit":
        state.editingNote = id;
        return render();
      case "note-cancel":
        state.editingNote = null;
        return render();
      case "note-save": {
        const box = btn.closest("[data-note-id]");
        const title = box?.querySelector('[data-role="note-title"]')?.value.trim();
        const text = box?.querySelector('[data-role="note-text"]')?.value.trim();
        if (text) updateNote(id, { title, text }).then(() => { state.notes = getNotes(); render(); });
        state.editingNote = null;
        return render();
      }
      case "note-del":
        deleteNote(id).then(() => { state.notes = getNotes(); render(); });
        return render();
      case "save-status": {
        const box = mount.querySelector("#cx-status");
        const words = box.value.trim().split(/\s+/).filter(Boolean).slice(0, 10);
        const next = words.join(" ");
        if (!next) return render();
        if (moderate(next).length) {
          state.profileWarn = "Starea conține limbaj nepotrivit. Alege altă formulare, te rog.";
          return render();
        }
        state.profileWarn = null;
        MY_PROFILE.status = next; // persists on the profile — others see it
        return render();
      }

      // ---- mandatory name onboarding ----
      case "save-name": {
        const first = mount.querySelector("#ng-first")?.value.trim() || "";
        const last = mount.querySelector("#ng-last")?.value.trim() || "";
        if (first.length < 2 || last.length < 2) {
          state.profileWarn = "Completează prenumele și numele (minim 2 litere fiecare).";
          return render();
        }
        if (moderate(`${first} ${last}`).length) {
          state.profileWarn = "Nume nepotrivit — folosește numele tău real.";
          return render();
        }
        const clean = (s) => s.replace(/[<>]/g, "").trim();
        const displayName = `${clean(first)} ${clean(last)}`;
        MY_PROFILE.firstName = escapeHtml(first);
        MY_PROFILE.lastName = escapeHtml(last);
        CURRENT_USER.name = displayName;
        CURRENT_USER.initials = displayName.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
        updateMyProfile({ first_name: clean(first), last_name: clean(last), display_name: displayName }); // REAL → Supabase
        state.needsName = false;
        state.profileWarn = null;
        window.dispatchEvent(new CustomEvent("atelier:role")); // refresh chip/nav + re-cache the name
        showToast(`✓ Bun venit, ${escapeHtml(first)}!`, { kind: "success" });
        return render();
      }

      // ---- profile ----
      case "edit-profile":
        state.editingProfile = true;
        state.pickAvatar = MY_PROFILE.avatar; // path or null
        return render();
      case "cancel-profile":
        state.editingProfile = false;
        return render();
      case "profile-pick":
        state.pickAvatar = btn.dataset.gif || null;
        return render();
      case "save-profile": {
        const val = (id) => mount.querySelector(id)?.value.trim() || "";
        // The whole profile passes through the language filter at once.
        const combined = ["#pf-first", "#pf-last", "#pf-grade", "#pf-school", "#pf-locality", "#pf-passions", "#pf-challenges"]
          .map(val)
          .join(" ");
        if (moderate(combined).length) {
          state.profileWarn = "Unul dintre câmpuri conține limbaj nepotrivit. Corectează-l, te rog.";
          return render();
        }
        state.profileWarn = null;
        MY_PROFILE.firstName = escapeHtml(val("#pf-first"));
        MY_PROFILE.lastName = escapeHtml(val("#pf-last"));
        MY_PROFILE.grade = escapeHtml(val("#pf-grade"));
        MY_PROFILE.school = escapeHtml(val("#pf-school"));
        MY_PROFILE.locality = escapeHtml(val("#pf-locality"));
        MY_PROFILE.passions = escapeHtml(val("#pf-passions"));
        MY_PROFILE.challenges = escapeHtml(val("#pf-challenges"));
        MY_PROFILE.avatar = state.pickAvatar === undefined ? MY_PROFILE.avatar : state.pickAvatar;
        const vis = mount.querySelector("#pf-vis")?.value;
        if (vis) MY_PROFILE.visibility = vis;
        // REAL: persist to Supabase. Store raw (stripped of <> for safety —
        // the UI escapes on render) so it round-trips without double-escaping.
        const clean = (s) => s.replace(/[<>]/g, "").trim();
        const displayName =
          [clean(val("#pf-first")), clean(val("#pf-last"))].filter(Boolean).join(" ") || CURRENT_USER.name;
        updateMyProfile({
          display_name: displayName,
          first_name: clean(val("#pf-first")),
          last_name: clean(val("#pf-last")),
          grade: clean(val("#pf-grade")),
          locality: clean(val("#pf-locality")),
          school: clean(val("#pf-school")),
          passions: clean(val("#pf-passions")),
          challenges: clean(val("#pf-challenges")),
          visibility: MY_PROFILE.visibility,
          avatar: MY_PROFILE.avatar || null,
        });
        CURRENT_USER.name = displayName;
        CURRENT_USER.initials = displayName.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
        window.dispatchEvent(new CustomEvent("atelier:role")); // refresh nav/XP name
        showToast("✓ Profil salvat", { kind: "success" });
        state.editingProfile = false;
        return render();
      }
    }
  });


  // Esc closes the image lightbox; ←/→ walk between the post's images.
  document.addEventListener("keydown", (e) => {
    if (!state.lightbox) return;
    if (e.key === "Escape") {
      state.lightbox = null;
      render();
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const p = findPost(state.lightbox.postId);
      const n = p?.media?.images?.length || 0;
      if (n > 1) {
        state.lightbox.i = (state.lightbox.i + (e.key === "ArrowRight" ? 1 : -1) + n) % n;
        render();
      }
    }
  });

  // @mentions autocomplete — the context decides who's eligible: the post
  // composer accepts any friend; a group box only that group's members;
  // boxes under a post follow the post's audience. Other textareas
  // (profil, caiet, exerciții) have no mentions.
  initMentions(mount, (box) => {
    if (box.id === "cx-post-text") return () => true;
    if (box.id === "cx-group-post") {
      const g = findGroup(state.openGroup);
      if (!g) return null;
      return (u) => (g.memberIds.includes(u.id) ? true : "nu e membru al acestui grup");
    }
    const scope = box.closest("[data-post-id]");
    if (scope) {
      const post = findPost(Number(scope.dataset.postId));
      if (post) return mentionEligibleForPost(post);
    }
    return null;
  });

  // Re-render triggered while typing in a search box: keep the caret where
  // it was so the search feels live, not jumpy.
  function rerenderKeepingFocus(inputId) {
    render();
    const el = mount.querySelector(`#${inputId}`);
    if (el) {
      const end = el.value.length;
      el.focus();
      el.setSelectionRange(end, end);
    }
  }

  // Live word counter on the profile status, live searches (forum + admin
  // users) and the admin level simulator.
  mount.addEventListener("input", (e) => {
    if (e.target.id === "cx-feed-search") {
      state.feedQuery = e.target.value;
      state.feedLimit = 6; // new search → first page
      return rerenderKeepingFocus("cx-feed-search");
    }
    if (e.target.id === "cx-note-search") {
      state.noteQuery = e.target.value;
      return rerenderKeepingFocus("cx-note-search");
    }
    if (e.target.id === "cx-member-search") {
      state.memberQuery = e.target.value;
      return rerenderKeepingFocus("cx-member-search");
    }
    if (e.target.id === "cx-conv-search") {
      state.convQuery = e.target.value;
      return rerenderKeepingFocus("cx-conv-search");
    }
    if (e.target.id === "cx-msg-search-user") {
      state.msgNewQuery = e.target.value;
      return rerenderKeepingFocus("cx-msg-search-user");
    }
    if (e.target.id === "cx-msg-search") {
      state.msgQuery = e.target.value;
      return rerenderKeepingFocus("cx-msg-search");
    }
    if (e.target.id === "cx-admin-usearch") {
      state.adminUserQuery = e.target.value;
      return rerenderKeepingFocus("cx-admin-usearch");
    }
    if (e.target.id === "cx-status") {
      const n = e.target.value.trim().split(/\s+/).filter(Boolean).length;
      const out = mount.querySelector("#cx-wordcount");
      if (out) out.textContent = `${n}/10 cuvinte`;
      return;
    }
    if (!isAdmin()) return;
    const syncSimPreview = () => {
      const local = mount.querySelector("#cx-simpreview");
      if (local) applyBar(local, state.simLevel || 1, 62, state.simPrestige || 0);
    };
    if (e.target.id === "cx-simlevel") {
      const v = Number(e.target.value);
      state.simLevel = v;
      setPreview(v, state.simPrestige || 0); // updates the real top bar live
      const out = mount.querySelector("#cx-simlevel-out");
      if (out) out.textContent = `${v}`;
      syncSimPreview(); // …and the preview RIGHT NEXT to the sliders
    } else if (e.target.id === "cx-simprestige") {
      const v = Number(e.target.value);
      state.simPrestige = v;
      setPreview(state.simLevel || 1, v);
      const out = mount.querySelector("#cx-simprestige-out");
      if (out) out.textContent = `${v}`;
      syncSimPreview();
    }
  });

  // Role changed via the global 🎭 switcher: sections that don't exist for
  // the new role fall back to the forum, then everything re-renders.
  window.addEventListener("atelier:role", () => {
    if (state.section === "admin" && !isAdmin()) state.section = "forum";
    state.thread.openReplyId = state.thread.openEditId = state.thread.openReactId = null;
    render();
  });

  // Shareable links opened directly / pasted / via back-forward: re-sync the
  // view from the URL hash. (replaceState above does NOT fire this.)
  window.addEventListener("hashchange", () => {
    remember(); // real-link navigation (profile anchors) is a jump too
    if (applyUserHash()) return render();
    if (applyMsgHash()) {
      // Conversations are already loaded → resolve + open immediately.
      const conv = state.conversations.find(
        (c) => c.partnerId != null && uuidForSurrogate(c.partnerId) === state.pendingMsgUuid
      );
      if (conv) state.msgOpen = conv.key;
      state.pendingMsgUuid = null;
      return render();
    }
    if (applyPostHash()) {
      // The feed is already loaded → resolve the uuid and jump to the post.
      const sid = surrogateForPostUuid(state.pendingPostUuid);
      state.pendingPostUuid = null;
      if (sid) { goToPost(sid); return; }
      return render();
    }
    if (applyAdminHash()) return render();
    const h = location.hash.slice(1);
    state.viewUser = null;
    if (ALL_SECTIONS.includes(h)) state.section = h;
    render();
  });

  render();
}

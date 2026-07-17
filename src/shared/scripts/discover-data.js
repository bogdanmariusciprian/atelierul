// =========================================================
// Mock data for the community "Descoperă" sections (no backend yet):
//   • Cuvântul zilei + Provocarea zilei (daily habit hooks)
//   • Grupuri de studiu — each is a FORUM TOPIC (its own posts + members,
//     created from the composer by choosing the "Grup" type; the creator
//     picks one of 30 animated icons and manages membership)
//   • Evenimente (admin-gated) + Insigne
// Content is Romanian; identifiers stay English. Replace with Supabase later.
// =========================================================
import { userById, initials, avatarColor } from "./community-data.js";
import { relTime, nextId, makeComment } from "./forum-data.js";
import { localDayStr } from "./format.js";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ---------- Words of the day (rotating pool) ----------
const WORDS_POOL = [
  {
    word: "efemer",
    type: "adjectiv",
    definition: "Care ține foarte puțin timp; trecător, de scurtă durată.",
    example: "Gloria lui a fost efemeră, uitată în doar câțiva ani.",
    synonyms: ["trecător", "pieritor", "vremelnic"],
    antonyms: ["etern", "durabil"],
  },
  {
    word: "a tăinui",
    type: "verb",
    definition: "A ține secret; a ascunde ceva de ceilalți.",
    example: "Și-a tăinuit emoțiile până la final.",
    synonyms: ["a ascunde", "a disimula"],
    antonyms: ["a dezvălui", "a mărturisi"],
  },
  {
    word: "cutezanță",
    type: "substantiv",
    definition: "Îndrăzneală, curaj de a înfrunta greutăți.",
    example: "A răspuns cu o cutezanță care i-a surprins pe toți.",
    synonyms: ["îndrăzneală", "temeritate"],
    antonyms: ["timiditate", "lașitate"],
  },
];

// ---------- Daily challenges: a scheduled POOL ----------
// The teacher can ADD challenges and pin them to exact dates (admin tab
// „Provocări", persisted locally in the mock; Supabase later). A day with
// no pinned challenge rotates through the pool — so „provocarea ZILEI”
// really changes daily.
const CHALLENGE_SEEDS = [
  {
    id: "seed-1",
    date: null, // în rotație
    prompt: "Care variantă este scrisă corect?",
    options: ["nici-o dată", "niciodată", "nici o dată"],
    correct: 1,
    explanation:
      "„Niciodată” se scrie într-un cuvânt când înseamnă „în niciun moment”. „Nici o dată” (separat) se folosește doar în sensul de „nicio singură dată”.",
    reward: 15,
  },
  {
    id: "seed-2",
    date: null,
    prompt: "Care e forma corectă de plural?",
    options: ["chibrite", "chibrituri", "chibriți"],
    correct: 1,
    explanation: "Pluralul corect este „chibrituri”. Substantivele neutre primesc adesea „-uri”.",
    reward: 15,
  },
  {
    id: "seed-3",
    date: null,
    prompt: "„Cărțile ELEVILOR sunt pe bancă.” — cuvântul subliniat este în cazul…",
    options: ["dativ", "genitiv", "acuzativ"],
    correct: 1,
    explanation: "„Elevilor” răspunde la „ale cui?” — deci genitiv (arată posesia).",
    reward: 15,
  },
];

// Teacher-added challenges (mock persistence; Supabase table later).
const CUSTOM_KEY = "atelier_custom_challenges";
function loadCustom() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveCustom(list) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  } catch {
    /* private mode */
  }
}

/** Everything, seeds + the teacher's own (customs first, they win ties). */
export function allChallenges() {
  return [...loadCustom(), ...CHALLENGE_SEEDS];
}

const dayStr = (d = new Date()) => localDayStr(d); // LOCAL day (provocarea fixată pe dată)
const dayOfYear = (d = new Date()) =>
  Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);

/** Today's word — rotates daily through the pool. */
export function wordOfToday() {
  return WORDS_POOL[dayOfYear() % WORDS_POOL.length];
}

/** Today's challenge: a date-pinned one wins; otherwise daily rotation. */
export function challengeOfToday() {
  const all = allChallenges();
  const pinned = all.find((c) => c.date === dayStr());
  if (pinned) return pinned;
  const rotating = all.filter((c) => !c.date);
  return rotating[dayOfYear() % Math.max(1, rotating.length)] || CHALLENGE_SEEDS[0];
}

/** Admin: add / update / delete a custom challenge (mock-persistent). */
export function upsertCustomChallenge(ch) {
  const list = loadCustom();
  const i = list.findIndex((c) => c.id === ch.id);
  if (i >= 0) list[i] = ch;
  else list.unshift({ ...ch, id: `custom-${Date.now()}` });
  saveCustom(list);
}
export function deleteCustomChallenge(id) {
  saveCustom(loadCustom().filter((c) => c.id !== id));
}
export function isCustomChallenge(id) {
  return String(id).startsWith("custom-");
}

// ---------- 30 group icons (colorful, gently looping animations) ----------
// `anim` maps to a CSS class (.gi--<anim>) with a subtle infinite loop.
const ANIMS = ["float", "bounce", "spin", "pulse", "wobble", "swing"];
const ICON_CHARS = [
  "📚", "🎯", "🔥", "🧠", "✍️", "🎭", "📖", "💡", "🏆", "⭐",
  "🚀", "🎨", "🎓", "📝", "🗣️", "🧩", "📌", "🌟", "💬", "🔬",
  "🎬", "🎵", "⚡", "🌈", "🦉", "🐉", "🍀", "🎲", "🧭", "❤️",
];
export const GROUP_ICONS = ICON_CHARS.map((char, id) => ({
  id,
  char,
  anim: ANIMS[id % ANIMS.length],
}));
export function groupIcon(id) {
  return GROUP_ICONS[id] || GROUP_ICONS[0];
}

const groupColors = ["#7c3aed", "#2563eb", "#16a34a", "#ea580c", "#db2777", "#0891b2"];
export function groupColor(id) {
  return groupColors[id % groupColors.length];
}

// ---------- Group posts (same shape as forum posts, so postCard renders them) ----------
function authorFields(id) {
  const u = userById(id) || { id, name: "Membru" };
  return { authorId: id, name: u.name, initials: initials(u.name), color: avatarColor(id) };
}
function makeGroupPost({ authorId, agoMs = 0, text, likes = 0, comments = [] }) {
  return {
    id: nextId(),
    ...authorFields(authorId),
    createdAt: Date.now() - agoMs,
    time: relTime(agoMs),
    type: "discutie",
    bg: "none",
    inGroup: true, // lives inside a group → never reshared to the main feed
    text,
    media: null,
    likes,
    likedByMe: false,
    shares: 0,
    sharedByMe: false,
    followed: false,
    comments,
  };
}

// ---------- Group topics (study groups) ----------
// creatorId = owner; memberIds = who's in; adderIds = members the creator
// let invite others; allowMembersAdd = any member may invite. Marius (id 0)
// owns one so the demo can show creator controls.
export const GROUP_TOPICS = [
  {
    id: 9001,
    name: "Pregătire Bac 2026",
    iconId: 8, // 🏆
    color: groupColor(1),
    creatorId: 0,
    description: "Rezolvăm subiecte de sinteză împreună, în fiecare duminică seara.",
    memberIds: [0, 1, 3, 6, 12],
    adderIds: [1], // Andrei may also invite
    allowMembersAdd: false,
    posts: [
      makeGroupPost({
        authorId: 0,
        agoMs: 3 * HOUR,
        text: "Bine ați venit! Postați aici subiectele la care vă blocați. Duminică le luăm pe rând.",
        likes: 6,
        comments: [makeComment({ authorId: 1, agoMs: 2 * HOUR, text: "Super! Am eu un subiect de la simulare, îl pun diseară.", likes: 2 })],
      }),
      makeGroupPost({ authorId: 3, agoMs: 1 * DAY, text: "Cineva a înțeles cerința 9 de la ultima variantă? Mie mi se pare ambiguă.", likes: 4 }),
    ],
  },
  {
    id: 9002,
    name: "Clubul de lectură",
    iconId: 6, // 📖
    color: groupColor(2),
    creatorId: 13,
    description: "O carte din programă pe lună, discuții libere și fără spoilere nedorite.",
    memberIds: [13, 25, 9],
    adderIds: [],
    allowMembersAdd: true,
    posts: [
      makeGroupPost({ authorId: 13, agoMs: 2 * DAY, text: "Luna aceasta citim „Enigma Otiliei”. Ne vedem vineri seara pentru primele impresii.", likes: 9 }),
    ],
  },
  {
    id: 9003,
    name: "Gramatică fără frică",
    iconId: 3, // 🧠
    color: groupColor(3),
    creatorId: 3,
    description: "Ne lămurim împreună regulile care ne dau bătăi de cap.",
    memberIds: [3, 2],
    adderIds: [2],
    allowMembersAdd: false,
    posts: [],
  },
];

/** Build a fresh group topic (from the composer's "Grup" type). */
export function newGroupTopic({ name, iconId, creatorId, description }) {
  return {
    id: nextId(),
    name,
    iconId,
    color: groupColor(iconId),
    creatorId,
    description: description || "",
    memberIds: [creatorId],
    adderIds: [],
    allowMembersAdd: false,
    posts: [],
  };
}

/** A post inside a group topic, authored by the current user. */
export function newGroupPost(authorId, text) {
  return makeGroupPost({ authorId, agoMs: 0, text, likes: 0, comments: [] });
}

// ---------- Events (admin-gated) ----------
export const EVENTS = [
  { id: 1, title: "Sesiune live: textul argumentativ", kind: "live", when: "azi, 19:00", host: "prof. Ionescu", going: false },
  { id: 2, title: "Quiz de morfologie — 20 de întrebări", kind: "quiz", when: "mâine, 18:00", host: "Atelierul", going: false },
  { id: 3, title: "Club de lectură: «Enigma Otiliei»", kind: "reading", when: "vineri, 20:00", host: "Clubul de lectură", going: true },
  { id: 4, title: "Q&A: pregătirea pentru Evaluarea Națională", kind: "live", when: "duminică, 11:00", host: "prof. Radu", going: false },
];
export const EVENT_KINDS = {
  live: { label: "Live", color: "#db2777", icon: "🔴" },
  quiz: { label: "Quiz", color: "#2563eb", icon: "❓" },
  reading: { label: "Lectură", color: "#16a34a", icon: "📖" },
};

// ---------- Badges ----------
export const BADGES = [
  { id: 1, icon: "✍️", name: "Prima postare", desc: "Ai scris primul comentariu.", earned: true },
  { id: 2, icon: "🔥", name: "Streak 7 zile", desc: "Șapte zile de învățat la rând.", earned: true },
  { id: 3, icon: "📚", name: "Cititor de cursă lungă", desc: "Ai terminat 10 lecții.", earned: false },
  { id: 4, icon: "💬", name: "Sufletul discuției", desc: "50 de comentarii utile.", earned: false },
  { id: 5, icon: "🏆", name: "Top 10", desc: "Ajungi în primii 10 din clasament.", earned: false },
  { id: 6, icon: "🧠", name: "Maestru al gramaticii", desc: "Toate lecțiile de morfologie, gata.", earned: false },
  { id: 7, icon: "⭐", name: "Mentor", desc: "Un exercițiu propus de tine a fost aprobat.", earned: false },
  { id: 8, icon: "🎯", name: "Provocator", desc: "30 de provocări zilnice rezolvate.", earned: false },
];

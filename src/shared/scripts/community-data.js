// =========================================================
// Mock community data (no backend yet). Used by the homepage
// leaderboard and, later, the community space. Replace with real
// Supabase data when auth + profiles are wired.
//
// `points` drives the leaderboard ranking. Everything is invented for
// preview purposes. Content is Romanian; identifiers stay English.
// =========================================================

// `status` is a short line each user sets on their profile (max 10 words).
// Shown as a hover bubble in the leaderboard.
export const COMMUNITY_USERS = [
  { id: 1, name: "Andrei Popescu", points: 118000, lessons: 42, streak: 31, status: "Recitesc «Moromeții». Ce carte!" },
  { id: 2, name: "Maria Ionescu", points: 21000, lessons: 39, streak: 28, status: "Azi înving virgula o dată pentru totdeauna." },
  { id: 3, name: "Ștefan Radu", points: 13200, lessons: 40, streak: 19, status: "Gramatica e sportul meu preferat." },
  { id: 4, name: "Elena Dumitru", points: 8600, lessons: 36, streak: 24, status: "Învăț pentru Bac, un pas pe zi." },
  { id: 5, name: "Cristina Marin", points: 5600, lessons: 35, streak: 15, status: "Îmi place mirosul cărților vechi." },
  { id: 6, name: "Vlad Georgescu", points: 3200, lessons: 33, streak: 22, status: "Streak de 22 de zile, nu mă opresc." },
  { id: 7, name: "Ioana Stan", points: 1960, lessons: 31, streak: 12, status: "Caut sinonime ca pe comori." },
  { id: 8, name: "Alexandru Nagy", points: 1845, lessons: 30, streak: 18, status: "Adverbele nu-mi mai scapă." },
  { id: 9, name: "Bianca Toma", points: 1730, lessons: 28, streak: 9, status: "Poezia lui Bacovia mă liniștește." },
  { id: 10, name: "Mihai Constantin", points: 1615, lessons: 27, streak: 14, status: "Exercițiu zilnic, progres sigur." },
  { id: 11, name: "Gabriela Barbu", points: 1520, lessons: 25, streak: 7, status: "Îndrăgostită de limba română." },
  { id: 12, name: "Robert Florea", points: 1445, lessons: 24, streak: 11, status: "Azi am înțeles conjunctivul!" },
  { id: 13, name: "Diana Rusu", points: 1370, lessons: 23, streak: 5, status: "Scriu un jurnal în fiecare seară." },
  { id: 14, name: "Paul Munteanu", points: 1295, lessons: 22, streak: 8, status: "Pregătesc admiterea la Drept." },
  { id: 15, name: "Larisa Voicu", points: 1220, lessons: 21, streak: 6, status: "Cratima și cu mine, prieteni acum." },
  { id: 16, name: "Cătălin Sava", points: 1150, lessons: 20, streak: 10, status: "Fac fișe pentru fiecare lecție." },
  { id: 17, name: "Alina Neagu", points: 1080, lessons: 19, streak: 4, status: "Citesc câte o pagină pe zi." },
  { id: 18, name: "George Matei", points: 1010, lessons: 18, streak: 13, status: "Verbul e cel mai frumos, punct." },
  { id: 19, name: "Raluca Ene", points: 945, lessons: 17, streak: 3, status: "Vreau nota 10 la Evaluare." },
  { id: 20, name: "Tudor Iacob", points: 880, lessons: 16, streak: 6, status: "Colecționez cuvinte rare." },
  { id: 21, name: "Simona Preda", points: 815, lessons: 15, streak: 2, status: "Pas cu pas spre olimpiadă." },
  { id: 22, name: "Dragoș Lung", points: 750, lessons: 14, streak: 5, status: "Repet paronimele până le știu perfect." },
  { id: 23, name: "Oana Crăciun", points: 690, lessons: 13, streak: 1, status: "Îmi place să corectez greșeli." },
  { id: 24, name: "Bogdan Șerban", points: 630, lessons: 12, streak: 4, status: "Fac primii pași, dar cu spor." },
  { id: 25, name: "Teodora Dima", points: 575, lessons: 11, streak: 2, status: "Eminescu, mereu la căpătâi." },
  { id: 26, name: "Sergiu Pop", points: 520, lessons: 10, streak: 3, status: "Învăț cu muzică pe fundal." },
  { id: 27, name: "Denisa Anton", points: 465, lessons: 9, streak: 1, status: "Abia am început, dar îmi place." },
  { id: 28, name: "Marius Ciobanu", points: 410, lessons: 8, streak: 2, status: "Recuperez timpul pierdut cu drag." },
  { id: 29, name: "Carmen Lazăr", points: 355, lessons: 7, streak: 1, status: "O lecție pe zi, promisiune." },
  { id: 30, name: "Victor Moldovan", points: 300, lessons: 6, streak: 1, status: "Bine v-am găsit în Atelier!" },
];

/** Top N users by points (leaderboard). */
export function topUsers(n = 10) {
  return [...COMMUNITY_USERS].sort((a, b) => b.points - a.points).slice(0, n);
}

/** Initials for an avatar bubble, e.g. "Andrei Popescu" → "AP". */
export function initials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Stable accent color per user id (for avatars), from the site palette. */
const AVATAR_COLORS = [
  "#7c3aed", "#0ea5e9", "#16a34a", "#f59e0b",
  "#db2777", "#6366f1", "#0f766e", "#dc2626",
];
export function avatarColor(id) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

/** Look up a community user by id (for friend lists). */
export function userById(id) {
  return COMMUNITY_USERS.find((u) => u.id === id);
}

/** Mock weekly trend for a user (stable): did they rise/fall and by how
 *  much? Shared by the homepage leaderboard AND the hub's Clasament (DRY). */
export function trendOf(u) {
  const t = ((u.id * 3 + 1) % 5) - 2;
  return { dir: t > 0 ? "up" : t < 0 ? "down" : "same", n: Math.abs(t) };
}

// --- Public profiles for the seed users (deterministic, stable, varied) ---
const GRADES = ["clasa a VII-a", "clasa a VIII-a", "clasa a IX-a", "clasa a X-a", "clasa a XI-a", "clasa a XII-a"];
const LOCALITIES = ["Cluj-Napoca", "Iași", "Timișoara", "București", "Brașov", "Craiova", "Constanța", "Sibiu"];
const PASSIONS = [
  "Lectură și poezie", "Teatru și oratorie", "Scriere creativă", "Jurnalism școlar",
  "Debate și argumentare", "Caligrafie", "Podcasturi literare", "Limbi străine",
];
// Who can see each user's profile. Most are open; a few are members-only or
// friends-only, so the visibility gating is actually testable.
const VIS_CYCLE = ["everyone", "members", "everyone", "friends", "everyone", "members"];

/** Profile visibility for a user id (0 = me → my own setting). */
export function visibilityOf(id) {
  if (id === 0) return MY_PROFILE.visibility;
  return VIS_CYCLE[id % VIS_CYCLE.length];
}

/** A viewable public profile for a seed user (generated but stable). */
export function publicProfileOf(id) {
  const u = userById(id);
  if (!u) return null;
  return {
    id: u.id,
    fullName: u.name,
    grade: GRADES[id % GRADES.length],
    locality: LOCALITIES[id % LOCALITIES.length],
    school: "",
    passions: PASSIONS[id % PASSIONS.length],
    challenges: "",
    status: u.status,
    points: u.points,
    lessons: u.lessons,
    streak: u.streak,
    visibility: visibilityOf(id),
    friendsCount: 3 + ((id * 7) % 38), // stable mock count
  };
}

// =========================================================
// The logged-in user's own profile (mock). Powers the community space:
// "pagina mea", profil, lecții preferate, puncte, caietul meu.
// hrefs are relative to the project root (prefix with basePath).
// =========================================================
export const MY_PROFILE = {
  joined: "ianuarie 2026",
  points: 410,
  lessons: 8,
  streak: 2,
  // Short status line shown on the profile ("Starea ta", max 10 words).
  status: "Recuperez timpul pierdut cu drag.",
  // Whether an admin has granted this member access to Evenimente (mock).
  eventsAccess: false,

  // Editable profile fields (mock — persists in memory for the session).
  firstName: "Marius",
  lastName: "",
  grade: "clasa a X-a",
  school: "",
  locality: "",
  passions: "Lectură, scriere creativă",
  challenges: "Virgula și cratima încă îmi dau bătăi de cap.",
  avatar: "assets/avatars/profileIcon01.gif", // chosen gif (or null = initials)
  visibility: "members", // "members" | "friends" | "everyone"
  friendIds: [1, 2, 3, 6, 9, 12, 13, 18, 20, 22, 25, 26, 27, 29],
  // Friend requests (mock). Incoming = people who want to befriend me;
  // outgoing = requests I've sent, awaiting their acceptance. None overlap
  // with friendIds above.
  friendReqIncoming: [7, 11, 17, 23],
  friendReqOutgoing: [],

  favorites: [
    { title: "Verbul: moduri, timpuri și conjugare", href: "src/site/pages/lessons/morfologie-verbul.html" },
    { title: "Substantivul: cazuri și funcții sintactice", href: "src/site/pages/lessons/morfologie-substantiv.html" },
    { title: "Textul argumentativ", href: "src/site/pages/lessons/redactare-text-argumentativ.html" },
  ],

  pointsLog: [
    { label: "Lecția «Verbul» finalizată", points: 80, when: "acum 3 ore" },
    { label: "Exerciții «Substantivul» (5/5)", points: 60, when: "ieri" },
    { label: "Lecția «Text argumentativ»", points: 70, when: "acum 2 zile" },
    { label: "Bonus streak (2 zile la rând)", points: 20, when: "acum 2 zile" },
    { label: "Lecția «Grupuri vocalice»", points: 50, when: "acum 4 zile" },
    { label: "Primul comentariu la o lecție", points: 10, when: "acum 5 zile" },
    { label: "Cont creat — bun venit!", points: 120, when: "ianuarie 2026" },
  ],

  notes: [
    { title: "Vocativ", text: "băiete, omule. Virgulă la adresarea directă: „Vino, Ioane!”", when: "acum 2 zile" },
    { title: "decât / doar", text: "„decât” cere negație: „Nu am decât un leu.” Altfel → „doar”.", when: "acum 4 zile" },
    { title: "niciun / nicio", text: "Se scriu legat. „nici un” e greșit.", when: "acum o săptămână" },
  ],
};

// =========================================================
// Points — the ONE place points enter or leave the current user's account.
// Keeps the total and the "Puncte" history in sync (they used to diverge:
// challenge/correct/approval awards skipped the log). Callers handle any
// visual celebration (pointsFx) themselves.
// =========================================================
export function awardPoints(label, points) {
  if (!points) return;
  MY_PROFILE.points = Math.max(0, MY_PROFILE.points + points);
  MY_PROFILE.pointsLog.unshift({ label, points, when: "acum" });
}

// =========================================================
// Shareable per-user URL slugs (e.g. "Vasile Ion" → "vasile-ion"). Used for
// deep links like ...#u/vasile-ion that open a member's profile directly.
// =========================================================
export function slugify(name) {
  return String(name)
    .replace(/[ăâ]/gi, "a")
    .replace(/î/gi, "i")
    .replace(/[șş]/gi, "s")
    .replace(/[țţ]/gi, "t")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SLUG_BY_ID = {};
const ID_BY_SLUG = {};
(function buildSlugMaps() {
  const meName = [MY_PROFILE.firstName, MY_PROFILE.lastName].filter(Boolean).join(" ") || "eu";
  const all = [{ id: 0, name: meName }, ...COMMUNITY_USERS];
  for (const u of all) {
    let s = slugify(u.name) || `user-${u.id}`;
    if (ID_BY_SLUG[s] !== undefined) s = `${s}-${u.id}`; // de-duplicate
    SLUG_BY_ID[u.id] = s;
    ID_BY_SLUG[s] = u.id;
  }
})();

/** URL slug for a user id (id 0 = the current user). */
export function slugForUser(id) {
  return SLUG_BY_ID[id] || `user-${id}`;
}

/** Resolve a slug back to a user ({id} for the current user, else the seed
 *  user object). Returns null if unknown. */
export function userBySlug(slug) {
  const id = ID_BY_SLUG[slug];
  if (id === undefined) return null;
  return id === 0 ? { id: 0 } : userById(id);
}

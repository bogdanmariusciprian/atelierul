// =========================================================
// Mock forum data (no backend yet). Powers the public community feed
// ("Forum") and the personal wall ("Pagina mea"). Content is Romanian;
// identifiers stay English. Replace with Supabase data later.
//
// A "post" can carry media (uploaded images or a YouTube video that only
// plays on click), a type (with its own icon) and a chosen background
// tint. Comments reuse the shared threaded-comments engine (thread.js).
// =========================================================
import { COMMUNITY_USERS, userById, initials, avatarColor } from "./community-data.js";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ---------------------------------------------------------
// Post TYPES — a small, fixed vocabulary. Each has a label, an accent
// color and an inline SVG glyph (single source of truth, DRY). The user
// picks one when composing so the feed is easy to scan.
// Icons are 24×24, drawn with currentColor so CSS tints them.
// ---------------------------------------------------------
export const POST_TYPES = [
  {
    key: "discutie",
    label: "Discuție",
    hint: "Deschide o discuție",
    color: "#7c3aed",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 20l1.4-4.2A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/></svg>`,
  },
  {
    key: "intrebare",
    label: "Întrebare",
    hint: "Ai o nelămurire?",
    color: "#2563eb",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2.3-2.6 4"/><line x1="12" y1="17.5" x2="12" y2="17.6"/></svg>`,
  },
  {
    key: "resursa",
    label: "Resursă",
    hint: "Împarte o resursă utilă",
    color: "#16a34a",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20"/></svg>`,
  },
  {
    key: "reusita",
    label: "Reușită",
    hint: "Sărbătorește un progres",
    color: "#f59e0b",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>`,
  },
  {
    key: "anunt",
    label: "Anunț",
    hint: "Ceva important",
    color: "#db2777",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h2l6 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a3 3 0 0 1 0 6"/></svg>`,
  },
];

export function postType(key) {
  return POST_TYPES.find((t) => t.key === key) || POST_TYPES[0];
}

// ---------------------------------------------------------
// Post BACKGROUND tints — soft, teen-friendly options. `none` is the
// default (plain card). Others paint a gentle gradient behind the text.
// ---------------------------------------------------------
export const POST_BACKGROUNDS = [
  { key: "none", label: "Simplu", swatch: "transparent" },
  { key: "violet", label: "Violet", swatch: "#ede9fe", from: "#f5f3ff", to: "#ede9fe" },
  { key: "sky", label: "Azur", swatch: "#e0f2fe", from: "#f0f9ff", to: "#e0f2fe" },
  { key: "mint", label: "Mentă", swatch: "#dcfce7", from: "#f0fdf4", to: "#dcfce7" },
  { key: "amber", label: "Chihlimbar", swatch: "#fef3c7", from: "#fffbeb", to: "#fef3c7" },
  { key: "rose", label: "Roz", swatch: "#ffe4e6", from: "#fff1f2", to: "#ffe4e6" },
  { key: "slate", label: "Grafit", swatch: "#e2e8f0", from: "#f8fafc", to: "#e8edf3" },
];

export function postBackground(key) {
  return POST_BACKGROUNDS.find((b) => b.key === key) || POST_BACKGROUNDS[0];
}

// ---------------------------------------------------------
// Helpers to build people + comments from the shared user table (DRY).
// ---------------------------------------------------------
function authorFields(id) {
  const u = userById(id) || { id, name: "Membru" };
  return { authorId: id, name: u.name, initials: initials(u.name), color: avatarColor(id) };
}

let seq = 500;
export function nextId() {
  return ++seq;
}

/** Build a threaded comment (used by seeds and by fresh posts). */
export function makeComment({ authorId, text, agoMs = 0, likes = 0, reactions = {}, replies = [] }) {
  return {
    id: nextId(),
    ...authorFields(authorId),
    createdAt: Date.now() - agoMs,
    time: relTime(agoMs),
    text,
    likes,
    likedByMe: false,
    reactions,
    edited: false,
    replies,
  };
}

/** Rough "acum / acum N min / ore / zile" from a millisecond age. */
export function relTime(ageMs) {
  if (ageMs < MIN) return "acum";
  if (ageMs < HOUR) return `acum ${Math.round(ageMs / MIN)} min`;
  if (ageMs < DAY) {
    const h = Math.round(ageMs / HOUR);
    return `acum ${h} ${h === 1 ? "oră" : "ore"}`;
  }
  const d = Math.round(ageMs / DAY);
  if (d === 1) return "ieri";
  return `acum ${d} zile`;
}

function makePost({ authorId, agoMs, type, bg = "none", text, media = null, likes = 0, shares = 0, followed = false, comments = [], audience = "public" }) {
  return {
    id: nextId(),
    ...authorFields(authorId),
    createdAt: Date.now() - agoMs,
    time: relTime(agoMs),
    type,
    bg,
    audience, // "public" | "friends"
    text,
    media,
    likes,
    likedByMe: false,
    shares,
    sharedByMe: false,
    followed,
    comments,
  };
}

// ---------------------------------------------------------
// Seed: the public forum feed. A lively mix of types, one with a YouTube
// video (plays only on click), one with images (soft gradient stand-ins
// for the preview — real uploads become object URLs at runtime).
// ---------------------------------------------------------
export const FORUM_POSTS = [
  makePost({
    authorId: 2,
    agoMs: 25 * MIN,
    type: "intrebare",
    bg: "sky",
    text: "Cum deosebesc rapid complementul direct de cel indirect? Mereu le încurc la teze. 😅",
    likes: 14,
    followed: true,
    comments: [
      makeComment({
        authorId: 3,
        agoMs: 18 * MIN,
        text: "Truc: pune întrebarea. Direct = „pe cine? ce?”, indirect = „cui?”. „Îi dau Mariei (cui?) o carte (ce?).”",
        likes: 11,
        reactions: { "💡": 6, "👍": 3 },
        replies: [
          makeComment({
            authorId: 2,
            agoMs: 12 * MIN,
            text: "Aaa, acum are logică. Mulțumesc mult!",
            likes: 2,
          }),
        ],
      }),
    ],
  }),
  makePost({
    authorId: 1,
    agoMs: 2 * HOUR,
    type: "resursa",
    bg: "mint",
    audience: "friends",
    text: "Am găsit un clip scurt despre figurile de stil — explică metafora și epitetul cu exemple din Eminescu. Merită 4 minute.",
    media: { kind: "youtube", videoId: "kXYiU_JCYtU", title: "Figuri de stil — pe scurt" },
    likes: 28,
    comments: [
      makeComment({ authorId: 9, agoMs: 90 * MIN, text: "Exact ce-mi trebuia pentru comentariul la poezie. Salvat!", likes: 5 }),
    ],
  }),
  makePost({
    authorId: 6,
    agoMs: 5 * HOUR,
    type: "reusita",
    bg: "amber",
    text: "Streak de 22 de zile și tocmai am trecut de tot capitolul de morfologie! Cine mai ține ritmul? 🔥",
    likes: 41,
    comments: [
      makeComment({ authorId: 4, agoMs: 4 * HOUR, text: "Bravo! Eu sunt la 24 de zile, hai să ne ținem reciproc motivați.", likes: 7, reactions: { "🎉": 4 } }),
      makeComment({ authorId: 12, agoMs: 3 * HOUR, text: "Foarte tare, mă inspiri să încep și eu.", likes: 3 }),
    ],
  }),
  makePost({
    authorId: 5,
    agoMs: 8 * HOUR,
    type: "resursa",
    bg: "none",
    audience: "friends",
    text: "Fișele mele cu paronime (efect/afect, a evalua/a evolua…). Le-am scris de mână, poate vă ajută și pe voi. 📚",
    media: {
      kind: "images",
      images: [
        { gradient: "linear-gradient(135deg,#c4b5fd,#818cf8)", label: "Fișă · Paronime 1" },
        { gradient: "linear-gradient(135deg,#6ee7b7,#34d399)", label: "Fișă · Paronime 2" },
      ],
    },
    likes: 33,
    followed: true,
    comments: [],
  }),
  makePost({
    authorId: 13,
    agoMs: 1 * DAY,
    type: "discutie",
    bg: "rose",
    text: "Care e cartea din programa de liceu care v-a plăcut cel mai mult și de ce? Eu votez „Enigma Otiliei”.",
    likes: 19,
    comments: [
      makeComment({ authorId: 25, agoMs: 20 * HOUR, text: "„Moromeții”, fără discuție. Scena cu ceasul mă bântuie și acum.", likes: 8, reactions: { "❤️": 5 } }),
    ],
  }),
  makePost({
    authorId: 3,
    agoMs: 2 * DAY,
    type: "anunt",
    bg: "violet",
    text: "Grup de studiu pentru Bac în fiecare duminică seara. Rezolvăm subiecte de sinteză împreună. Scrieți-mi dacă vreți linkul!",
    likes: 52,
    comments: [],
  }),
];

// ---------------------------------------------------------
// Personal wall ("Pagina mea") seed posts — authored by the current user.
// Kept authorId = 0 so the "no self-like" rule applies to them.
// ---------------------------------------------------------
export function myWallPosts() {
  return [
    makePost({
      authorId: 0,
      agoMs: 2 * HOUR,
      type: "reusita",
      bg: "amber",
      text: "Am terminat lecția despre verb! Conjunctivul nu mai are secrete. 💪",
      likes: 9,
      comments: [
        makeComment({
          authorId: 1,
          agoMs: 100 * MIN,
          text: "Felicitări! Urmează timpurile compuse, sunt floare la ureche după asta.",
          likes: 2,
          replies: [makeComment({ authorId: 0, agoMs: 80 * MIN, text: "Mersi! Chiar mă apuc diseară de ele.", likes: 1 })],
        }),
        makeComment({ authorId: 6, agoMs: 60 * MIN, text: "Verbul e cel mai frumos capitol, punct. 😄", likes: 3, reactions: { "😂": 2 } }),
      ],
    }),
    makePost({
      authorId: 0,
      agoMs: 5 * HOUR,
      type: "intrebare",
      bg: "sky",
      text: "Cum se analizează corect o frază cu mai multe subordonate? Mă încurc mereu la cele completive.",
      likes: 11,
      comments: [
        makeComment({
          authorId: 3,
          agoMs: 4 * HOUR,
          text: "Pornește de la predicatul principal, apoi întreabă-te ce funcție are fiecare propoziție față de el.",
          likes: 8,
          reactions: { "💡": 5 },
          replies: [
            makeComment({ authorId: 0, agoMs: 3 * HOUR, text: "Deci practic pun întrebarea de la regentă. Are logică, mersi!", likes: 1 }),
            makeComment({ authorId: 2, agoMs: 2 * HOUR, text: "Și eu făceam la fel, ajută enorm să subliniezi predicatele întâi.", likes: 2 }),
          ],
        }),
      ],
    }),
    makePost({
      authorId: 0,
      agoMs: 9 * HOUR,
      type: "reusita",
      bg: "none",
      text: "Am luat 9 la simularea de Bac! 🎉 Cel mai mult m-a ajutat comunitatea aici.",
      likes: 34,
      comments: [
        makeComment({ authorId: 9, agoMs: 8 * HOUR, text: "Bravooo! Meriti, ai muncit mult.", likes: 4, reactions: { "🎉": 6 } }),
        makeComment({ authorId: 12, agoMs: 7 * HOUR, text: "Felicitări! Ce te-a picat mai greu la subiectul II?", likes: 1 }),
      ],
    }),
    makePost({
      authorId: 0,
      agoMs: 1 * DAY,
      type: "resursa",
      bg: "mint",
      text: "Mi-am făcut niște fișe cu modurile și timpurile verbului. Le pun aici, poate vă ajută și pe voi. 📚",
      media: {
        kind: "images",
        images: [
          { gradient: "linear-gradient(135deg,#a78bfa,#7c3aed)", label: "Fișă · Moduri personale" },
          { gradient: "linear-gradient(135deg,#67e8f9,#0891b2)", label: "Fișă · Timpuri" },
        ],
      },
      likes: 27,
      comments: [makeComment({ authorId: 4, agoMs: 20 * HOUR, text: "Salvate! Exact de asta aveam nevoie pentru recapitulare.", likes: 3 })],
    }),
    makePost({
      authorId: 0,
      agoMs: 1 * DAY + 4 * HOUR,
      type: "intrebare",
      bg: "sky",
      text: "Caut pe cineva cu care să exersez pentru admiterea la Drept. Cine e în aceeași barcă?",
      likes: 15,
      comments: [makeComment({ authorId: 12, agoMs: 1 * DAY, text: "Eu! Hai să ne dăm subiecte reciproc în weekend.", likes: 2 })],
    }),
    makePost({
      authorId: 0,
      agoMs: 2 * DAY,
      type: "discutie",
      bg: "violet",
      text: "Care e cea mai frumoasă poezie din programă, după voi? Eu rămân la „Luceafărul”, chiar dacă e lungă.",
      likes: 20,
      comments: [
        makeComment({ authorId: 25, agoMs: 44 * HOUR, text: "„Plumb” de Bacovia. Atmosfera aia apăsătoare e genială.", likes: 6, reactions: { "❤️": 3 } }),
        makeComment({ authorId: 18, agoMs: 43 * HOUR, text: "Eu zic „Testament” — ce lecție despre rolul poetului!", likes: 4 }),
      ],
    }),
    makePost({
      authorId: 0,
      agoMs: 2 * DAY + 6 * HOUR,
      type: "resursa",
      bg: "none",
      text: "Un clip scurt care explică figurile de stil cu exemple. Mi-a limpezit diferența dintre metaforă și comparație.",
      media: { kind: "youtube", videoId: "kXYiU_JCYtU", title: "Figuri de stil — explicate simplu" },
      likes: 29,
      comments: [makeComment({ authorId: 9, agoMs: 2 * DAY + 2 * HOUR, text: "Super util pentru comentariul literar. Mulțumesc!", likes: 2 })],
    }),
    makePost({
      authorId: 0,
      agoMs: 3 * DAY,
      type: "discutie",
      bg: "none",
      text: "Mic truc: „î” la începutul și sfârșitul cuvântului, „â” în interior. Simplu, dar mereu uitat.",
      likes: 22,
      comments: [makeComment({ authorId: 20, agoMs: 2 * DAY + 20 * HOUR, text: "Excepție: cuvintele derivate păstrează „î”, ex. „reîncepe”.", likes: 5, reactions: { "💡": 4 } })],
    }),
    makePost({
      authorId: 0,
      agoMs: 4 * DAY,
      type: "reusita",
      bg: "amber",
      text: "Streak de 5 zile la rând! 🔥 Nu credeam că țin ritmul, dar provocările zilnice mă motivează.",
      likes: 18,
      comments: [makeComment({ authorId: 6, agoMs: 3 * DAY + 20 * HOUR, text: "Ține-o tot așa! După 7 zile devine obicei.", likes: 3 })],
    }),
    makePost({
      authorId: 0,
      agoMs: 5 * DAY,
      type: "discutie",
      bg: "slate",
      text: "Îmi place tot mai mult lectura. Aveți recomandări de cărți dincolo de programă, pentru vară?",
      likes: 25,
      comments: [
        makeComment({ authorId: 13, agoMs: 4 * DAY + 18 * HOUR, text: "„Maitreyi” de Eliade — se citește pe nerăsuflate.", likes: 7, reactions: { "❤️": 4 } }),
        makeComment({
          authorId: 27,
          agoMs: 4 * DAY + 10 * HOUR,
          text: "Orice de Agatha Christie dacă vrei ceva ușor și captivant.",
          likes: 3,
          replies: [makeComment({ authorId: 0, agoMs: 4 * DAY + 8 * HOUR, text: "Perfect, îmi notez amândouă. Mersi!", likes: 1 })],
        }),
      ],
    }),
  ];
}

// ---------------------------------------------------------
// "Post of the week" — the most-liked public post, surfaced to spotlight
// good contributions and nudge retention.
// ---------------------------------------------------------
export function topPost(posts = FORUM_POSTS) {
  return [...posts].sort((a, b) => b.likes - a.likes)[0];
}

// =========================================================
// Mock lesson comments (no backend yet). A threaded sample used by every
// lesson for preview. `replies` nest arbitrarily deep; each comment keeps
// its own likes and emoji reactions. Uses the shared thread.js shape
// (authorId + createdAt) so likes/edit rules work. Replace with Supabase
// later. Content is Romanian; identifiers stay English.
// =========================================================
export { REACTION_EMOJIS } from "./thread.js";

const HOUR = 60 * 60 * 1000;

let seq = 100; // ids for freshly posted comments
export function nextId() {
  return ++seq;
}

// A ready-made thread. Returned fresh (deep-cloned) per lesson so the UI
// can mutate its own copy without touching this template. `createdAt` is
// well in the past so the 5-minute edit window is already closed on seeds.
const SAMPLE_THREAD = [
  {
    id: 1,
    authorId: 7,
    name: "Ioana Stan",
    initials: "IS",
    color: "#0ea5e9",
    createdAt: Date.now() - 2 * HOUR,
    time: "acum 2 ore",
    text: "Foarte utilă partea cu cazurile. Aveți și un exemplu cu vocativul?",
    likes: 12,
    likedByMe: true,
    reactions: { "👍": 5, "💡": 3 },
    edited: false,
    replies: [
      {
        id: 2,
        authorId: 1,
        name: "Andrei Popescu",
        initials: "AP",
        color: "#16a34a",
        createdAt: Date.now() - 1 * HOUR,
        time: "acum 1 oră",
        text: "Da! „băiete”, „omule” — le găsești în secțiunea de exemple.",
        likes: 4,
        likedByMe: false,
        reactions: { "❤️": 2 },
        edited: false,
        replies: [
          {
            id: 3,
            authorId: 7,
            name: "Ioana Stan",
            initials: "IS",
            color: "#0ea5e9",
            createdAt: Date.now() - 40 * 60 * 1000,
            time: "acum 40 min",
            text: "Mulțumesc, le-am găsit!",
            likes: 1,
            likedByMe: false,
            reactions: {},
            edited: false,
            replies: [],
          },
        ],
      },
    ],
  },
  {
    id: 4,
    authorId: 6,
    name: "Vlad Georgescu",
    initials: "VG",
    color: "#f59e0b",
    createdAt: Date.now() - 26 * HOUR,
    time: "ieri",
    text: "Exercițiul 3 mi s-a părut cel mai greu, dar feedbackul a ajutat mult.",
    likes: 8,
    likedByMe: false,
    reactions: { "😂": 1, "👍": 6 },
    edited: false,
    replies: [],
  },
];

/** A fresh, mutable copy of the sample thread for a lesson. */
export function getLessonComments(_slug) {
  return structuredClone(SAMPLE_THREAD);
}

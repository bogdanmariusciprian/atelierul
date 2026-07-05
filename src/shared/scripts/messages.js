// =========================================================
// Messaging — SAFE by design (Marius's policy):
//   • member ↔ member: ONLY predefined templates (no free text → no
//     insults, no ads, no "add me on insta"). Many templates, grouped.
//   • member → TEACHER/ADMIN: free text (their own words) — the only
//     free-text channel, and it passes the profanity filter.
//   • guests → teacher: free text via the floating ✉️ (name optional).
//   • teacher → member: free text (he's the moderator).
// Inbox/outbox model, mock-persistent via store.js (Supabase later).
// Message: { id, fromId, fromName, toId, toAdmin, text, template, createdAt, read }
// =========================================================
import { store } from "./store.js";
import { userById } from "./community-data.js";

const KEY = "atelier_messages";

// ---------- The template catalogue (member ↔ member vocabulary) ----------
export const MESSAGE_TEMPLATES = [
  {
    cat: "👋 Salutări",
    items: [
      "Salut! 👋",
      "Bună! Ce mai faci?",
      "Mă bucur că ești online!",
      "Bine ai revenit în Atelier!",
    ],
  },
  {
    cat: "📚 Studiu împreună",
    items: [
      "Vrei să învățăm împreună azi?",
      "Facem un grup de studiu pentru test?",
      "Îmi explici și mie lecția de azi, te rog?",
      "Hai să rezolvăm împreună provocarea zilei!",
      "Ai terminat lecția? Eu tocmai am marcat-o. 🏁",
      "Ce lecție îmi recomanzi să fac azi?",
    ],
  },
  {
    cat: "🎉 Felicitări",
    items: [
      "Felicitări pentru streak! 🔥",
      "Bravo pentru locul din clasament! 🏆",
      "Super postarea ta de azi! 👏",
      "Felicitări pentru exercițiul aprobat! ⭐",
      "Se vede că ai muncit — respect!",
    ],
  },
  {
    cat: "🙏 Mulțumiri",
    items: [
      "Mulțumesc pentru ajutor! 🙏",
      "Mi-a fost foarte util răspunsul tău!",
      "Mulțumesc pentru aplauze! 😊",
      "Mersi că m-ai adăugat în grup!",
    ],
  },
  {
    cat: "⚔️ Provocări",
    items: [
      "Te provoc la un duel de puncte săptămâna asta! ⚔️",
      "Vezi că te ajung din urmă în clasament! 👀",
      "Cine termină prima lecția de azi? 🏁",
      "Pariu că iau mai multe puncte azi? 😄",
    ],
  },
  {
    cat: "❓ Întrebări",
    items: [
      "Ai înțeles lecția de azi? Eu m-am blocat puțin.",
      "Ce notă ai luat la ultimul test?",
      "Cu ce lecție începi azi?",
      "Ai rezolvat exercițiul propus de la lecție?",
      "Care e trucul tău ca să ții minte regulile?",
    ],
  },
  {
    cat: "💬 Răspunsuri",
    items: [
      "Da, am înțeles — te pot ajuta eu!",
      "Și eu m-am blocat acolo, hai să ne uităm împreună.",
      "Încă n-am ajuns la ea, dar o fac azi.",
      "Da! A fost mai ușor decât părea.",
      "Nu pot acum, dar diseară te ajut sigur.",
      "Mulțumesc de întrebare — mi-ai amintit că am de repetat!",
    ],
  },
  {
    cat: "☀️ De încheiere",
    items: [
      "Ne auzim mai târziu!",
      "Spor la învățat! 📚",
      "O zi frumoasă! ☀️",
      "Succes la test mâine!",
    ],
  },
];

// ---------- Storage ----------
function seed() {
  const now = Date.now();
  return [
    {
      id: now - 3,
      fromId: 1,
      fromName: "Andrei Popescu",
      toId: 0,
      toAdmin: false,
      text: "Vrei să învățăm împreună azi?",
      template: true,
      createdAt: now - 4 * 3600e3,
      read: false,
    },
    {
      id: now - 2,
      fromId: 12,
      fromName: "Robert Florea",
      toId: 0,
      toAdmin: false,
      text: "Felicitări pentru streak! 🔥",
      template: true,
      createdAt: now - 26 * 3600e3,
      read: true,
    },
    {
      id: now - 1,
      fromId: null,
      fromName: "Vizitator (Ioana)",
      toId: 0,
      toAdmin: true,
      text: "Bună ziua! Copilul meu e în clasa a VII-a — site-ul e potrivit și pentru Evaluarea Națională?",
      template: false,
      createdAt: now - 8 * 3600e3,
      read: false,
    },
  ];
}

export function getMessages() {
  let list = store.get(KEY);
  if (!list) {
    list = seed();
    store.set(KEY, list);
  }
  return list;
}

function save(list) {
  store.set(KEY, list);
}

/** Send a message. Member→member MUST be a template — enforced HERE too
 *  (defense in depth), not just hidden in the UI. Free text is allowed
 *  only toward the teacher (toAdmin) or FROM the teacher (fromTeacher). */
export function sendMessage({ fromId, fromName, toId = null, toAdmin = false, fromTeacher = false, text, template = false }) {
  if (!toAdmin && !fromTeacher && !template) return null; // members: templates only
  const list = getMessages();
  const msg = {
    id: Date.now(),
    fromId,
    fromName: fromName || (fromId != null ? (userById(fromId)?.name ?? "Membru") : "Vizitator"),
    toId,
    toAdmin,
    fromTeacher,
    text: String(text).slice(0, 600),
    template,
    createdAt: Date.now(),
    read: false,
  };
  list.unshift(msg);
  save(list);
  return msg;
}

/** My inbox (as the member id 0) / the teacher's inbox (toAdmin). The
 *  member's inbox also shows the teacher's replies (fromTeacher → toId 0). */
export function inboxFor(asAdmin) {
  return getMessages().filter((m) => (asAdmin ? m.toAdmin : !m.toAdmin && m.toId === 0));
}
export function outboxFor(asAdmin) {
  return getMessages().filter((m) => (asAdmin ? m.fromTeacher : m.fromId === 0 && !m.fromTeacher));
}

export function unreadMessages(asAdmin) {
  return inboxFor(asAdmin).filter((m) => !m.read).length;
}

export function markInboxRead(asAdmin) {
  const list = getMessages();
  for (const m of list) {
    if (asAdmin ? m.toAdmin : !m.toAdmin && m.toId === 0) m.read = true;
  }
  save(list);
}

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
// A message can CHAIN several templates ("Salut! 👋" + "Vrei să învățăm
// împreună azi?") — each part is validated against this catalogue, so the
// whole message stays safe by construction.
export const MESSAGE_TEMPLATES = [
  {
    cat: "👋 Salutări",
    items: [
      "Salut! 👋",
      "Bună! Ce mai faci?",
      "Hei, ce faci?",
      "Mă bucur că ești online!",
      "Bine ai revenit în Atelier!",
      "Nu ne-am mai „văzut” de ceva vreme! 😊",
      "Bună dimineața! Gata de lecții?",
      "Bună seara! Mai înveți ceva azi?",
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
      "Hai pe forum, e o discuție interesantă!",
      "Ne vedem în grupul de studiu diseară?",
      "Repetăm împreună la gramatică?",
    ],
  },
  {
    cat: "📖 Despre lecții",
    items: [
      "Lecția despre substantiv m-a lămurit total!",
      "Cazurile îmi dădeau bătăi de cap — acum am înțeles!",
      "Ai făcut lecția despre verb? E foarte bună.",
      "Exercițiile de la finalul lecției sunt geniale.",
      "Diftongul și triftongul nu mai au secrete pentru mine! 😎",
      "Textul argumentativ e mai simplu decât credeam.",
      "Am adăugat o grămadă de notițe în caiet azi.",
      "Recomand lecția de vocabular — chiar ajută.",
    ],
  },
  {
    cat: "🧩 Exerciții",
    items: [
      "Ai rezolvat exercițiul propus de la lecție?",
      "Am propus un exercițiu nou — vezi dacă îl prinzi! 🧩",
      "Exercițiul tău a fost aprobat? Felicitări!",
      "M-am blocat la un exercițiu… îmi dai un indiciu?",
      "Exercițiul propus de tine mi-a plăcut mult!",
      "Hai să vedem cine rezolvă mai multe exerciții azi!",
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
      "Felicitări pentru insigna nouă! 🥇",
      "Ai urcat în clasament — meriți!",
      "Wow, ce nivel ai atins! 🚀",
    ],
  },
  {
    cat: "🙏 Mulțumiri",
    items: [
      "Mulțumesc pentru ajutor! 🙏",
      "Mi-a fost foarte util răspunsul tău!",
      "Mulțumesc pentru aplauze! 😊",
      "Mersi că m-ai adăugat în grup!",
      "Mulțumesc pentru sfat — a funcționat!",
      "Ești un coleg de nota 10! 🌟",
    ],
  },
  {
    cat: "⚔️ Provocări",
    items: [
      "Te provoc la un duel de puncte săptămâna asta! ⚔️",
      "Vezi că te ajung din urmă în clasament! 👀",
      "Cine termină prima lecția de azi? 🏁",
      "Pariu că iau mai multe puncte azi? 😄",
      "Azi îmi apăr locul în clasament! 🛡️",
      "Streak-ul meu îl întrece pe al tău! 🔥",
      "Provocarea zilei în sub un minut — poți mai repede?",
    ],
  },
  {
    cat: "❓ Întrebări",
    items: [
      "Ai înțeles lecția de azi? Eu m-am blocat puțin.",
      "Ce notă ai luat la ultimul test?",
      "Cu ce lecție începi azi?",
      "Care e trucul tău ca să ții minte regulile?",
      "Cât timp înveți pe zi, de obicei?",
      "Ce faci când nu-ți iese un exercițiu?",
      "Tu cum te pregătești pentru examen?",
      "Care e lecția ta preferată de până acum?",
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
      "Sigur, cu plăcere!",
      "Da, hai! Sunt liber(ă) după ora 17.",
      "Nu știu încă, dar aflu și îți zic.",
      "Îmi pare rău, azi nu reușesc. Mâine?",
    ],
  },
  {
    cat: "📝 Teste & examene",
    items: [
      "Succes la test mâine!",
      "Cum a fost testul?",
      "Hai să repetăm împreună pentru examen!",
      "Nu te stresa — ai muncit, o să fie bine! 💪",
      "Eu la teste încep mereu cu subiectele ușoare.",
      "După test, îmi zici cum a fost?",
    ],
  },
  {
    cat: "💪 Încurajări",
    items: [
      "Nu renunța, ești aproape!",
      "Toți greșim la început — așa se învață.",
      "Puțin câte puțin, în fiecare zi. Poți!",
      "Ai progresat enorm în ultima vreme!",
      "O lecție pe zi și nimeni nu te mai prinde! 🚀",
      "Azi n-a mers? Mâine sigur merge.",
    ],
  },
  {
    cat: "🤝 Prietenie",
    items: [
      "Ți-am trimis o cerere de prietenie! 🤝",
      "Mulțumesc că mi-ai acceptat cererea!",
      "Mă bucur că suntem prieteni în Atelier!",
      "Colegii ca tine fac comunitatea mai faină!",
    ],
  },
  {
    cat: "😅 Scuze",
    items: [
      "Scuze că răspund târziu!",
      "Îmi pare rău, am uitat complet!",
      "Scuze, ieri n-am mai apucat să intru.",
      "N-am vrut să sune așa — pace? 🕊️",
    ],
  },
  {
    cat: "☀️ De încheiere",
    items: [
      "Ne auzim mai târziu!",
      "Spor la învățat! 📚",
      "O zi frumoasă! ☀️",
      "Noapte bună! Mâine continuăm.",
      "Pa! Mă întorc diseară.",
      "Ne vedem în clasament! 😄",
    ],
  },
];

// One flat set of every template — validation of chained messages.
const TEMPLATE_SET = new Set(MESSAGE_TEMPLATES.flatMap((c) => c.items));

/** True if the text is exactly one of the safe templates. */
export function isTemplate(text) {
  return TEMPLATE_SET.has(text);
}

/** Diacritics-insensitive template search → [{cat, item}]. */
export function searchTemplates(query) {
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const q = norm(query.trim());
  if (!q) return [];
  const hits = [];
  for (const c of MESSAGE_TEMPLATES)
    for (const item of c.items)
      if (norm(item).includes(q)) hits.push({ cat: c.cat, item });
  return hits;
}

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

/** Send a message. Member→member MUST be template-only — enforced HERE
 *  too (defense in depth), not just hidden in the UI. A message may chain
 *  SEVERAL templates (`parts`); each part is validated against the
 *  catalogue. Free text is allowed only toward the teacher (toAdmin) or
 *  FROM the teacher (fromTeacher). */
export function sendMessage({ fromId, fromName, toId = null, toAdmin = false, fromTeacher = false, guestName = null, text = "", parts = null, template = false }) {
  if (parts) {
    // Chained templates: every link in the chain must be a known template.
    if (!parts.length || !parts.every((p) => TEMPLATE_SET.has(p))) return null;
    text = parts.join("\n");
    template = true;
  } else if (!toAdmin && !fromTeacher) {
    if (!template || !TEMPLATE_SET.has(text)) return null; // members: templates only
  }
  const list = getMessages();
  const msg = {
    id: Date.now(),
    fromId,
    fromName: fromName || (fromId != null ? (userById(fromId)?.name ?? "Membru") : "Vizitator"),
    toId,
    toAdmin,
    fromTeacher,
    guestName, // teacher → visitor replies keep the conversation together
    text: String(text).slice(0, 900),
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

// ---------- Conversations (chat-style threading) ----------
// A conversation = all messages exchanged with ONE partner, chronological.
// Partner keys: "t" = the teacher (from the member's view), "u<id>" = a
// member, "g:<name>" = a visitor writing to the teacher (no account).

/** All conversations for the current viewer, newest-activity first:
 *  [{ key, partnerId, partnerName, teacher, guest, msgs[], unread }] */
export function conversationsFor(asAdmin) {
  const mine = [...inboxFor(asAdmin), ...outboxFor(asAdmin)];
  const map = new Map();
  for (const m of mine) {
    let key, partnerId = null, partnerName, teacher = false, guest = false;
    if (asAdmin) {
      const incoming = m.toAdmin;
      if (incoming && m.fromId == null) { key = `g:${m.fromName}`; partnerName = m.fromName; guest = true; }
      else { partnerId = incoming ? m.fromId : m.toId; key = `u${partnerId}`; partnerName = incoming ? m.fromName : (userById(partnerId)?.name ?? "Membru"); }
      // A teacher reply to a guest has toId=null → attach to the guest
      // conversation by name (stored in fromName of the original; here we
      // fall back to a generic bucket if unknown).
      if (!incoming && m.toId == null) { key = m.guestName ? `g:${m.guestName}` : key || "g:?"; partnerName = m.guestName || partnerName || "Vizitator"; guest = true; }
    } else {
      const sent = m.fromId === 0 && !m.fromTeacher;
      if (sent ? m.toAdmin : m.fromTeacher) { key = "t"; partnerName = "Profesorul"; teacher = true; }
      else { partnerId = sent ? m.toId : m.fromId; key = `u${partnerId}`; partnerName = sent ? (userById(partnerId)?.name ?? "Membru") : m.fromName; }
    }
    if (!key) continue;
    if (!map.has(key)) map.set(key, { key, partnerId, partnerName, teacher, guest, msgs: [], unread: 0 });
    const conv = map.get(key);
    conv.msgs.push(m);
    const incoming = asAdmin ? m.toAdmin : !m.toAdmin && m.toId === 0;
    if (incoming && !m.read) conv.unread++;
  }
  for (const c of map.values()) c.msgs.sort((a, b) => a.createdAt - b.createdAt);
  return [...map.values()].sort(
    (a, b) => b.msgs[b.msgs.length - 1].createdAt - a.msgs[a.msgs.length - 1].createdAt
  );
}

/** Mark ONLY one conversation's incoming messages as read. */
export function markConversationRead(key, asAdmin) {
  const list = getMessages();
  for (const m of list) {
    const incoming = asAdmin ? m.toAdmin : !m.toAdmin && m.toId === 0;
    if (!incoming || m.read) continue;
    const mKey = asAdmin
      ? m.fromId == null ? `g:${m.fromName}` : `u${m.fromId}`
      : m.fromTeacher ? "t" : `u${m.fromId}`;
    if (mKey === key) m.read = true;
  }
  save(list);
}

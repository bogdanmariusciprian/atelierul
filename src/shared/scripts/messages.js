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
import { TEMPLATE_CATALOGUE, SLOTS, CATEGORY_INTENT, REPLY_INTENTS } from "./message-templates.js";

const KEY = "atelier_messages";

// ---------- The template catalogue ----------
// The ~520 one-liners live in message-templates.js (28 categories).
// About HALF of them UNLOCK at progress-bar levels — growing in level
// literally gives you more to say. Normalized here to { t, lvl }.
export const MESSAGE_TEMPLATES = TEMPLATE_CATALOGUE.map((c) => ({
  cat: c.cat,
  intent: CATEGORY_INTENT[c.cat] || "general",
  items: c.items.map((it) => (Array.isArray(it) ? { t: it[0], lvl: it[1] } : { t: it, lvl: 1 })),
}));

// ---------- Slots (fill-in-the-blank, from FIXED lists — never free text) ----------
/** Slot names inside a template text, e.g. "…{opera}…" → ["opera"]. */
export function slotsIn(text) {
  const out = [];
  const re = /\{(\w+)\}/g;
  let m;
  while ((m = re.exec(String(text)))) out.push(m[1]);
  return out;
}
/** Allowed values for a slot (a fixed list — the only things a pupil may pick). */
export function slotOptions(slot) {
  return SLOTS[slot] || [];
}
/** Fill a template's {slots} with chosen values. */
export function fillTemplate(text, values = {}) {
  return String(text).replace(/\{(\w+)\}/g, (_, k) => (values[k] != null ? values[k] : `{${k}}`));
}

// SAFETY: a member↔member message is valid only if it's a known template —
// either an exact (no-slot) one, or a slotted one whose blanks are filled
// with ALLOWED slot values. Built as regexes so a filled message ("Mă poți
// ajuta la Testament?") still validates against its pattern.
function escRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const ALL_TEMPLATE_TEXTS = MESSAGE_TEMPLATES.flatMap((c) => c.items.map((i) => i.t));
const PLAIN_TEMPLATES = new Set(ALL_TEMPLATE_TEXTS.filter((t) => !/\{\w+\}/.test(t)));
const SLOTTED_PATTERNS = ALL_TEMPLATE_TEXTS
  .filter((t) => /\{\w+\}/.test(t))
  .map((t) => {
    let src = "^";
    let last = 0;
    const re = /\{(\w+)\}/g;
    let m;
    while ((m = re.exec(t))) {
      src += escRe(t.slice(last, m.index));
      const opts = (SLOTS[m[1]] || []).map(escRe).join("|");
      src += opts ? `(?:${opts})` : "\\S+";
      last = m.index + m[0].length;
    }
    return new RegExp(src + escRe(t.slice(last)) + "$");
  });

/** True if the text is a safe template (plain, or a slot filled from its list). */
export function isTemplate(text) {
  if (PLAIN_TEMPLATES.has(text)) return true;
  return SLOTTED_PATTERNS.some((re) => re.test(text));
}

/** Suggested reply templates given the intent of the LAST received message,
 *  unlocked at the viewer's level → [{ cat, t, lvl }]. Drives „sugestii". */
export function suggestReplies(lastIntent, level = 1, limit = 6) {
  const wants = REPLY_INTENTS[lastIntent || "general"] || REPLY_INTENTS.general;
  const hits = [];
  for (const c of MESSAGE_TEMPLATES) {
    if (!wants.includes(c.intent)) continue;
    for (const i of c.items) if (i.lvl <= level) hits.push({ cat: c.cat, t: i.t, lvl: i.lvl });
  }
  return hits.slice(0, limit);
}

/** The intent a template text belongs to (for threading reply suggestions). */
export function intentOfTemplate(text) {
  for (const c of MESSAGE_TEMPLATES) {
    for (const i of c.items) {
      if (i.t === text) return c.intent;
      // a filled slot template still maps to its category's intent
    }
  }
  // slot templates: match by pattern
  for (const c of MESSAGE_TEMPLATES) {
    if (c.intent === "general") continue;
    for (const i of c.items) {
      if (!/\{\w+\}/.test(i.t)) continue;
      // cheap check: same prefix before the first slot
      const prefix = i.t.split("{")[0];
      if (prefix.length > 4 && text.startsWith(prefix)) return c.intent;
    }
  }
  return "general";
}

/** Catalogue numbers for a member level: how much is unlocked, and the
 *  NEXT level that brings new templates (teasing the grind). */
export function templateStats(level) {
  let total = 0, unlocked = 0, nextLvl = null;
  for (const c of MESSAGE_TEMPLATES)
    for (const i of c.items) {
      total++;
      if (i.lvl <= level) unlocked++;
      else if (nextLvl === null || i.lvl < nextLvl) nextLvl = i.lvl;
    }
  return { total, unlocked, nextLvl };
}

/** Diacritics-insensitive template search → [{cat, t, lvl}]. */
export function searchTemplates(query) {
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const q = norm(query.trim());
  if (!q) return [];
  const hits = [];
  for (const c of MESSAGE_TEMPLATES)
    for (const i of c.items)
      if (norm(i.t).includes(q)) hits.push({ cat: c.cat, t: i.t, lvl: i.lvl });
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
    if (!parts.length || !parts.every((p) => isTemplate(p))) return null;
    text = parts.join("\n");
    template = true;
  } else if (!toAdmin && !fromTeacher) {
    if (!template || !isTemplate(text)) return null; // members: templates only
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

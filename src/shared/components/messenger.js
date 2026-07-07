// =========================================================
// Floating Messenger widget — bottom-right, on EVERY page.
//   • Logged-in members/teacher: a Facebook-Messenger-style widget — the list
//     of conversations, open one, reply inline (templates + free text with the
//     points-earned quota), report a message — WITHOUT leaving the page.
//   • Guests: a simple "write to the teacher" form (e-mail for the reply).
// Reuses the same real data layer as the hub (forum-repo) + the safe template
// catalogue (messages.js), so both surfaces stay in sync.
// =========================================================
import { CURRENT_USER, isLoggedIn, isAdmin } from "../scripts/session.js";
import { MY_PROFILE, userById } from "../scripts/community-data.js";
import {
  fetchConversations, sendTemplateMsg, sendTeacherMsg, sendTeacherReply,
  sendFreeMsg, reportMessage, markConversationReadReal, contactTeacher,
} from "../scripts/forum-repo.js";
import { suggestReplies, intentOfTemplate } from "../scripts/messages.js";
import { levelInfo } from "../scripts/xp-bar.js";
import { findProfanity } from "../scripts/moderation.js";
import { showToast } from "../scripts/toast.js";
import { isOnlineSince } from "../scripts/presence.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mtime = (ts) => new Date(ts).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (ts) => {
  const d = new Date(ts), same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, new Date())) return "Azi";
  if (same(d, new Date(Date.now() - 864e5))) return "Ieri";
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
};

let el = null;
const st = { open: false, convKey: null, convs: [] };

function unreadTotal() {
  return st.convs.reduce((n, c) => n + (c.unread || 0), 0);
}

/** Reload conversations (logged-in only), then re-render. */
export async function reloadMessenger() {
  if (!isLoggedIn()) { st.convs = []; if (el) render(); return; }
  try { st.convs = await fetchConversations(isAdmin()); } catch { st.convs = []; }
  if (el) render();
  window.dispatchEvent(new CustomEvent("atelier:notifs"));
}

function openConv() {
  return st.convs.find((c) => c.key === st.convKey) || null;
}

/** Open the Messenger panel (used by the footer "Scrie-i profesorului"). */
export function openMessenger() {
  if (!el) return;
  st.open = true;
  st.convKey = null;
  render();
  el.querySelector(".msgr-fab")?.scrollIntoView({ block: "end", behavior: "smooth" });
}

// ---- Composer for the open conversation ----
function composerHtml(conv) {
  const asAdmin = isAdmin();
  // Guest conversation (admin side) → reply by e-mail, no in-app send.
  if (conv.guest) {
    return conv.guestEmail
      ? `<p class="msgr-guestmail">✉️ Răspunde pe e-mail: <a href="mailto:${esc(conv.guestEmail)}">${esc(conv.guestEmail)}</a></p>`
      : `<p class="msgr-muted">Vizitatorul n-a lăsat un e-mail.</p>`;
  }
  // Free text toward/from the teacher, or the teacher replying to a member.
  if (asAdmin || conv.teacher) {
    return `<div class="msgr-compose">
        <textarea class="msgr-input" data-role="free" rows="1" placeholder="${asAdmin ? "Răspunde ca profesor…" : "Scrie-i profesorului…"}"></textarea>
        <button type="button" class="msgr-send" data-act="send-teacher">➤</button>
      </div>`;
  }
  // Member ↔ member: free text (quota) + quick reply-suggestion templates.
  const allowance = 3 + Math.floor((MY_PROFILE.points || 0) / 100);
  const used = conv.msgs.filter((m) => m.fromId === 0 && !m.fromTeacher && !m.template).length;
  const remaining = Math.max(0, allowance - used);
  const level = levelInfo(MY_PROFILE.points).level;
  const lastIn = [...conv.msgs].reverse().find((m) => !(m.fromId === 0 && !m.fromTeacher));
  const suggs = (lastIn ? suggestReplies(intentOfTemplate(lastIn.text), level, 5) : suggestReplies("general", level, 5))
    .filter((s) => !/\{\w+\}/.test(s.t)); // slotted templates stay in the hub
  const chips = suggs.map((s) => `<button type="button" class="msgr-tpl" data-act="tpl" data-text="${esc(s.t)}">${esc(s.t)}</button>`).join("");
  const free = remaining > 0
    ? `<div class="msgr-compose">
         <input class="msgr-input" data-role="free" type="text" maxlength="30" placeholder="Liber (max 30)… ${remaining} rămase" />
         <button type="button" class="msgr-send" data-act="send-free">➤</button>
       </div>`
    : `<p class="msgr-muted">Ai terminat mesajele libere aici. Alege un șablon 👇 sau adună puncte.</p>`;
  return `${free}<div class="msgr-tpls">${chips || `<span class="msgr-muted">Deschide „Mesaje" în comunitate pentru toate șabloanele.</span>`}</div>`;
}

function convView(conv) {
  const asAdmin = isAdmin();
  const mineIs = (m) => (asAdmin ? m.fromTeacher : m.fromId === 0 && !m.fromTeacher);
  const partnerOnline = conv.partnerId != null && !conv.teacher ? isOnlineSince((userById(conv.partnerId) || {}).lastSeen) : false;
  let bubbles = "", lastDay = null;
  for (const m of conv.msgs) {
    const day = new Date(m.createdAt).toDateString();
    if (day !== lastDay) { bubbles += `<div class="msgr-day"><span>${dayLabel(m.createdAt)}</span></div>`; lastDay = day; }
    const mine = mineIs(m);
    const tick = mine ? (m.read ? `<span class="msgr-tick msgr-tick--read">✓✓</span>` : partnerOnline ? `<span class="msgr-tick">✓✓</span>` : `<span class="msgr-tick">✓</span>`) : "";
    const report = !mine && !m.fromTeacher && m.id ? `<button type="button" class="msgr-report" data-act="report" data-id="${m.id}" title="Raportează">⚑</button>` : "";
    bubbles += `<div class="msgr-b${mine ? " msgr-b--me" : ""}${m.fromTeacher ? " msgr-b--teacher" : ""}">
        <span class="msgr-b__t">${esc(m.text)}</span>
        <span class="msgr-b__m">${mtime(m.createdAt)} ${tick} ${report}</span>
      </div>`;
  }
  const who = conv.teacher ? "🎓 Profesorul" : esc(conv.partnerName);
  return `
    <div class="msgr-head">
      <button type="button" class="msgr-back" data-act="back" aria-label="Înapoi">‹</button>
      <b>${who}</b>
    </div>
    <div class="msgr-scroll" data-role="scroll">${bubbles || `<p class="msgr-muted msgr-empty">Niciun mesaj încă. Scrie primul!</p>`}</div>
    ${composerHtml(conv)}`;
}

function listView() {
  if (!st.convs.length) {
    return `<div class="msgr-head"><b>Mesaje</b></div>
      <p class="msgr-muted msgr-empty">Nicio conversație încă. Începe una din „Membri" sau de pe profilul unui coleg.</p>`;
  }
  const rows = st.convs.map((c) => {
    const last = c.msgs[c.msgs.length - 1];
    const av = c.teacher ? "🎓" : c.guest ? "✉️" : esc((c.partnerName || "?").slice(0, 1).toUpperCase());
    return `<button type="button" class="msgr-item${c.unread ? " is-unread" : ""}" data-act="open" data-key="${esc(c.key)}">
        <span class="msgr-av">${av}</span>
        <span class="msgr-item__id"><b>${esc(c.partnerName)}</b><span class="msgr-muted">${esc((last?.text || "").slice(0, 34))}</span></span>
        ${c.unread ? `<b class="msgr-badge">${c.unread}</b>` : ""}
      </button>`;
  }).join("");
  return `<div class="msgr-head"><b>Mesaje</b></div><div class="msgr-list">${rows}</div>`;
}

function guestForm() {
  return `<div class="msgr-head"><b>Scrie-i profesorului</b></div>
    <div class="msgr-guest">
      <p class="msgr-muted">Nu ai nevoie de cont — lasă un e-mail și profesorul îți răspunde acolo.</p>
      <input class="msgr-input" data-role="g-name" placeholder="Numele tău (opțional)" />
      <input class="msgr-input" data-role="g-email" type="email" placeholder="E-mailul tău (ca să-ți răspundă)" />
      <textarea class="msgr-input" data-role="g-text" rows="3" placeholder="Scrie aici…"></textarea>
      <p class="msgr-warn" data-role="g-warn" hidden></p>
      <button type="button" class="btn btn--primary btn--sm" data-act="g-send">Trimite</button>
    </div>`;
}

function panelHtml() {
  if (!isLoggedIn()) return guestForm();
  const conv = openConv();
  return conv ? convView(conv) : listView();
}

function render() {
  // The teacher also has the 🛡️ quick-panel bottom-right → shift left to avoid it.
  el.classList.toggle("msgr--admin", isLoggedIn() && isAdmin());
  const unread = isLoggedIn() ? unreadTotal() : 0;
  el.innerHTML = `
    <button type="button" class="msgr-fab" data-act="toggle" aria-expanded="${st.open}" title="Mesaje">
      💬${unread ? `<b class="msgr-fabbadge">${unread}</b>` : ""}
    </button>
    <div class="msgr-panel" ${st.open ? "" : "hidden"}>${panelHtml()}</div>`;
  if (st.open) {
    const sc = el.querySelector('[data-role="scroll"]');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }
}

function sendCurrentFree(kind) {
  const conv = openConv();
  if (!conv) return;
  const box = el.querySelector('[data-role="free"]');
  const text = (box?.value || "").trim();
  if (!text) return;
  if (findProfanity(text).length) { showToast("Mesajul conține limbaj nepotrivit — reformulează.", { kind: "warn" }); return; }
  if (kind === "teacher") {
    if (isAdmin()) { if (conv.partnerId != null) sendTeacherReply(conv.partnerId, text).then(reloadMessenger); }
    else sendTeacherMsg(text).then(reloadMessenger);
  } else {
    if (text.length > 30) { showToast("Maxim 30 de caractere.", { kind: "warn" }); return; }
    sendFreeMsg(conv.partnerId, text).then((res) => {
      if (res && res.error === "quota") showToast("Ai terminat mesajele libere aici — adună puncte.", { kind: "warn" });
      reloadMessenger();
    });
  }
  if (box) box.value = "";
}

export function initMessenger(basePath = "") {
  if (window.__messengerOn) return;
  window.__messengerOn = true;
  el = document.createElement("div");
  el.className = "msgr";
  document.body.appendChild(el);
  render();
  reloadMessenger();

  el.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const act = t.dataset.act;
    if (act === "toggle") { st.open = !st.open; if (!st.open) st.convKey = null; return render(); }
    if (act === "open") {
      st.convKey = t.dataset.key;
      const conv = openConv();
      if (conv && conv.unread) { markConversationReadReal(conv, isAdmin()); conv.unread = 0; conv.msgs.forEach((m) => (m.read = true)); window.dispatchEvent(new CustomEvent("atelier:notifs")); }
      return render();
    }
    if (act === "back") { st.convKey = null; return render(); }
    if (act === "send-teacher") return sendCurrentFree("teacher");
    if (act === "send-free") return sendCurrentFree("free");
    if (act === "tpl") {
      const conv = openConv();
      if (conv && conv.partnerId != null) sendTemplateMsg(conv.partnerId, t.dataset.text, "tpl").then(reloadMessenger);
      return;
    }
    if (act === "report") {
      reportMessage(t.dataset.id);
      showToast("⚑ Semnalat — profesorul va verifica.", { kind: "success" });
      return;
    }
    if (act === "g-send") {
      const val = (r) => el.querySelector(`[data-role="${r}"]`)?.value.trim() || "";
      const text = val("g-text");
      const warn = el.querySelector('[data-role="g-warn"]');
      if (!text) return;
      if (findProfanity(text).length) { warn.textContent = "⚠️ Limbaj nepotrivit — reformulează."; warn.hidden = false; return; }
      const email = val("g-email");
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { warn.textContent = "⚠️ Lasă un e-mail valid."; warn.hidden = false; return; }
      contactTeacher(val("g-name"), email, text);
      st.open = false;
      showToast("✉️ Mesaj trimis profesorului — mulțumim!", { kind: "success" });
      return render();
    }
  });

  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && e.target.matches('[data-role="free"]')) {
      e.preventDefault();
      sendCurrentFree(isAdmin() || openConv()?.teacher ? "teacher" : "free");
    }
  });

  // Re-render on role changes; reload when the notif system refreshes.
  window.addEventListener("atelier:role", () => { st.convKey = null; render(); reloadMessenger(); });
}

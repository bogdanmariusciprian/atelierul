// =========================================================
// Rich text — a tiny, SAFE formatter shared by the test-item admin editor
// (input) and the pupil-facing quiz (output). DRY, single source of truth.
//
// The teacher may format item text with BOLD / UNDERLINE (and italic/mark) —
// e.g. underline the key word to analyse. That formatting is stored as small
// HTML inside the normal text fields. Because the field could later render to
// pupils/guests, we NEVER trust raw HTML: sanitizeRich() escapes all text and
// keeps ONLY a whitelist of inline tags, with NO attributes (so no style,
// no onclick, no href — no XSS surface even though only the admin authors it).
// =========================================================

// Inline formatting tags we allow; everything else is unwrapped (kept as text).
const ALLOWED = new Set(["b", "strong", "u", "i", "em", "mark"]);

const escapeText = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function serialize(node) {
  let out = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += escapeText(n.nodeValue);
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const tag = n.tagName.toLowerCase();
      if (tag === "br") { out += "<br>"; return; }
      const inner = serialize(n); // clean children regardless of this tag
      out += ALLOWED.has(tag) ? `<${tag}>${inner}</${tag}>` : inner; // unwrap unknown tags
    }
    // comments / other node types are dropped
  });
  return out;
}

/** Safe HTML from possibly-dirty HTML: escaped text + whitelisted inline tags. */
export function sanitizeRich(html) {
  if (html == null || html === "") return "";
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html);
  return serialize(tpl.content);
}

/** Plain text (no tags) — for search/filter and for a compact preview. */
export function stripRich(html) {
  if (html == null) return "";
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html);
  return (tpl.content.textContent || "").trim();
}

/** True if the value has no visible text (e.g. "<br>" or empty). */
export function isRichEmpty(html) {
  return stripRich(html) === "";
}

// ---- editor commands (for a focused contenteditable) --------------------
// Force tag-based output (<b>/<u>) instead of inline styles, so sanitizeRich
// preserves the formatting.
let tagModeSet = false;
function ensureTagMode() {
  if (tagModeSet) return;
  try { document.execCommand("styleWithCSS", false, false); } catch { /* ignore */ }
  tagModeSet = true;
}
export function execBold() { ensureTagMode(); document.execCommand("bold"); }
export function execUnderline() { ensureTagMode(); document.execCommand("underline"); }
export function execItalic() { ensureTagMode(); document.execCommand("italic"); }

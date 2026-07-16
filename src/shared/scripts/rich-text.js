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

const escapeText = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// Canonical inline formatting for an element, derived from BOTH its tag name and
// its inline style. This is what makes formatting save reliably on phones: some
// mobile browsers apply bold as <span style="font-weight:bold"> (or 700) rather
// than <b>, even with styleWithCSS=false. Reading the style too, we normalise it
// to <b>/<i>/<u> so it survives sanitization instead of being silently dropped.
function fmtTagsFor(el) {
  const tag = el.tagName.toLowerCase();
  const s = el.style || {};
  const fw = String(s.fontWeight || "").toLowerCase();
  const bold = tag === "b" || tag === "strong" || fw === "bold" || fw === "bolder"
    || (/^\d+$/.test(fw) && Number(fw) >= 600);
  const fst = String(s.fontStyle || "").toLowerCase();
  const italic = tag === "i" || tag === "em" || fst === "italic" || fst === "oblique";
  const dec = String(s.textDecoration || s.textDecorationLine || "").toLowerCase();
  const underline = tag === "u" || dec.includes("underline");
  const tags = [];
  if (bold) tags.push("b");
  if (italic) tags.push("i");
  if (underline) tags.push("u");
  if (tag === "mark") tags.push("mark");
  return tags;
}

function serialize(node) {
  let out = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += escapeText(n.nodeValue);
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const tag = n.tagName.toLowerCase();
      if (tag === "br") { out += "<br>"; return; }
      let inner = serialize(n); // clean children regardless of this tag
      const tags = fmtTagsFor(n);
      for (let i = tags.length - 1; i >= 0; i--) inner = `<${tags[i]}>${inner}</${tags[i]}>`;
      out += inner; // unknown / unformatted tags are unwrapped, keeping their text
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
// Prefer tag-based output (<b>/<u>) over inline styles. We re-assert it before
// every command because some browsers reset the flag; and even when a browser
// ignores it and emits <span style>, sanitizeRich now normalises that back to
// tags (see fmtTagsFor), so bold/italic/underline save reliably on phones too.
function ensureTagMode() {
  try { document.execCommand("styleWithCSS", false, false); } catch { /* ignore */ }
}
export function execBold() { ensureTagMode(); document.execCommand("bold"); }
export function execUnderline() { ensureTagMode(); document.execCommand("underline"); }
export function execItalic() { ensureTagMode(); document.execCommand("italic"); }

/** On/off state of the formatting at the caret/selection — so toolbar buttons
 *  (B/U/I) can light up to match what's active. Guarded: queryCommandState can
 *  throw when there's no live selection. */
export function formatState() {
  const q = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
  return { bold: q("bold"), underline: q("underline"), italic: q("italic") };
}

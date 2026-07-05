// =========================================================
// Melcul Atelierului 🐌 — the site's mascot (he already stars on the
// leaderboard's progress bar, so he got the job officially).
// Inline SVG, colored via CSS variables → follows the active palette
// and dark mode automatically. Three poses:
//   "hello"     – friendly wave (empty states, onboarding)
//   "reading"   – glasses + book (lessons, notebook, study spots)
//   "party"     – confetti mood (celebrations, milestones)
//   "lost"      – puzzled, for 404 / nothing-found moments
// Usage: container.innerHTML = mascotSvg("hello", 120);
// =========================================================

const SHELL = `
  <circle cx="88" cy="70" r="34" fill="var(--color-primary)" opacity="0.92"/>
  <circle cx="88" cy="70" r="24" fill="var(--color-bg)" opacity="0.25"/>
  <path d="M88 46a24 24 0 0 1 24 24" stroke="var(--color-bg)" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.5"/>
  <circle cx="88" cy="70" r="10" fill="var(--color-accent)" opacity="0.9"/>`;

const BODY = `
  <path d="M20 104c0-18 14-34 34-34 6 0 10 4 10 10v24z" fill="var(--color-accent)"/>
  <path d="M14 104c8-6 96-6 106 0 4 2 2 6-2 6H16c-4 0-6-4-2-6z" fill="var(--color-primary)" opacity="0.35"/>
  <circle cx="43" cy="62" r="3.4" fill="var(--color-text)"/>
  <circle cx="57" cy="62" r="3.4" fill="var(--color-text)"/>
  <line x1="43" y1="46" x2="40" y2="34" stroke="var(--color-text)" stroke-width="3" stroke-linecap="round"/>
  <line x1="57" y1="46" x2="60" y2="34" stroke="var(--color-text)" stroke-width="3" stroke-linecap="round"/>
  <circle cx="39" cy="31" r="4" fill="var(--color-accent-2)"/>
  <circle cx="61" cy="31" r="4" fill="var(--color-accent-2)"/>
  <path d="M38 58c4-10 20-10 24 0" fill="none" stroke="none"/>`;

const POSES = {
  hello: `
    ${BODY}
    <path d="M42 72c4 4 12 4 16 0" stroke="var(--color-text)" stroke-width="3" stroke-linecap="round" fill="none"/>
    ${SHELL}
    <path d="M116 52l6-10M122 56l10-4M120 46l2-12" stroke="var(--color-accent-2)" stroke-width="3" stroke-linecap="round"/>`,
  reading: `
    ${BODY}
    <circle cx="43" cy="62" r="7.5" fill="none" stroke="var(--color-primary)" stroke-width="2.5"/>
    <circle cx="57" cy="62" r="7.5" fill="none" stroke="var(--color-primary)" stroke-width="2.5"/>
    <line x1="50.5" y1="62" x2="49.5" y2="62" stroke="var(--color-primary)" stroke-width="2.5"/>
    <path d="M40 72c4 3 12 3 16 0" stroke="var(--color-text)" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M26 84l12-6 12 6v14l-12-6-12 6z" fill="var(--color-accent-2)" opacity="0.85"/>
    <line x1="38" y1="78" x2="38" y2="92" stroke="var(--color-bg)" stroke-width="2"/>
    ${SHELL}`,
  party: `
    ${BODY}
    <path d="M40 70c5 6 15 6 20 0" stroke="var(--color-text)" stroke-width="3" stroke-linecap="round" fill="none"/>
    ${SHELL}
    <path d="M50 18l3 8M70 12l1 9M30 22l5 6" stroke="var(--color-accent)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="24" cy="40" r="3" fill="var(--color-accent-2)"/>
    <circle cx="76" cy="24" r="3" fill="var(--color-primary)"/>
    <rect x="60" y="20" width="6" height="6" rx="1" fill="var(--color-accent-2)" transform="rotate(20 63 23)"/>`,
  lost: `
    ${BODY}
    <path d="M42 74c4-3 12-3 16 0" stroke="var(--color-text)" stroke-width="3" stroke-linecap="round" fill="none"/>
    ${SHELL}
    <path d="M112 34c0-7 12-9 12-1 0 5-6 5-6 10" stroke="var(--color-accent-2)" stroke-width="4" stroke-linecap="round" fill="none"/>
    <circle cx="118" cy="52" r="2.6" fill="var(--color-accent-2)"/>`,
};

/** The mascot as an inline SVG string. */
export function mascotSvg(pose = "hello", size = 120) {
  const art = POSES[pose] || POSES.hello;
  return `<svg class="mascot mascot--${pose}" width="${size}" height="${Math.round(size * 0.86)}"
      viewBox="0 0 136 116" role="img" aria-label="Melcul Atelierului" xmlns="http://www.w3.org/2000/svg">
      ${art}
    </svg>`;
}

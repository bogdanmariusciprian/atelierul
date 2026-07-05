// =========================================================
// Level + streak "badges" that ring a user's avatar — ONE source of truth
// for both the DATA (level, prestige, ring gradient, streak) and the badge
// MARKUP, shared by the homepage leaderboard, the community hub and the
// comment threads. Keeps the three surfaces from drifting apart (DRY): tweak
// a colour or a label here and every avatar everywhere updates.
// =========================================================
import { levelInfo, xpSkin } from "./xp-bar.js";
import { MY_PROFILE, userById } from "./community-data.js";
import { CURRENT_USER } from "./session.js";

/** Badge data from a user's own numbers (when you already hold the object,
 *  e.g. the leaderboard rows). */
export function metaFromPoints(points = 0, streak = 0) {
  const info = levelInfo(points);
  return {
    level: info.level,
    prestige: info.prestige,
    fill: xpSkin(info.level).fill, // same gradient as that user's XP bar
    streak,
  };
}

/** Badge data for a user id: the current user (MY_PROFILE) or a seed member. */
export function userMeta(id) {
  const u = id === CURRENT_USER.id ? MY_PROFILE : userById(id) || {};
  return metaFromPoints(u.points || 0, u.streak || 0);
}

/** The two badges (level bottom + streak top) that sit on an avatar's ring.
 *  `prefix` selects the surface's CSS classes, e.g. "cx-bdg" → cx-bdg-lvl /
 *  cx-bdg-streak. Surfaces: "cx-bdg", "lb-badge", "thr__badge". */
export function badgeHtml(meta, prefix) {
  const level = `<span class="${prefix}-lvl" style="background:${meta.fill}" title="Nivel ${meta.level}">${meta.level}${meta.prestige ? "★" : ""}</span>`;
  // Only show the streak badge once there IS a streak (no "🔥0").
  const streak = meta.streak > 0
    ? `<span class="${prefix}-streak" title="${meta.streak} zile streak">🔥${meta.streak}</span>`
    : "";
  return level + streak;
}

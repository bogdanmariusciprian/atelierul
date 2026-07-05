// =========================================================
// Profile avatar options — animated GIFs (moved out of the project root
// into assets/avatars/ and renamed profileIcon01..40). "champion" is a
// special reward avatar, unlocked once the user reaches level 15.
// Paths are relative to the project root; prefix with basePath when used.
// =========================================================

export const AVATAR_GIFS = Array.from(
  { length: 40 },
  (_, i) => `assets/avatars/profileIcon${String(i + 1).padStart(2, "0")}.gif`
);

export const CHAMPION_GIF = "assets/avatars/champion.gif";
export const CHAMPION_UNLOCK_LEVEL = 15;

/** A stable mock avatar gif for a given user id (cycles through the pool). */
export function avatarForUser(id) {
  return AVATAR_GIFS[id % AVATAR_GIFS.length];
}

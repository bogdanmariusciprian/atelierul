// =========================================================
// Persistence adapter — the ONE place data is saved/loaded.
//
// PER ACCOUNT, NOT PER BROWSER. Every key gets the signed-in account appended,
// so two people sharing a computer never look into the same drawer. This used
// to be per-browser, and it leaked: the teacher worked on a board, signed out,
// a pupil signed in on the same machine and found the teacher's work waiting.
// Nothing had been broken into — the database was faultless, every row carrying
// its `user_id` behind a policy. The leak was in the local safety net, which
// had never asked WHOSE the work was. See `session.js` for the whole story and
// for the cleanup that runs when the account changes.
//
// TODAY (mock): localStorage, synchronous.
// LATER (Supabase): swap these three functions for table reads/writes
// keyed by the authenticated user — every caller stays untouched.
// Keys in use: atelier_notes, atelier_saved_posts, atelier_lessons_done,
// atelier_streak, atelier_kudos, atelier_daily_challenge,
// atelier_challenges_solved, atelier_activity_read, atelier_custom_challenges,
// atelier_messages, atelier_notif_seen, atelier_admin_log, atelier_group_seen,
// atelier_theme_palette, atelier_theme_mode.
// =========================================================

import { cheiaMea } from "./session.js";

export const store = {
  /** Read a JSON value (or the fallback if missing/corrupt). */
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(cheiaMea(key));
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  /** Write a JSON value. */
  set(key, value) {
    try {
      localStorage.setItem(cheiaMea(key), JSON.stringify(value));
    } catch {
      /* private mode — data lives only for this session */
    }
  },

  /** Delete a key. */
  remove(key) {
    try {
      localStorage.removeItem(cheiaMea(key));
    } catch {
      /* ignore */
    }
  },
};

// =========================================================
// Persistence adapter — the ONE place data is saved/loaded.
//
// TODAY (mock): localStorage, synchronous, per-browser.
// LATER (Supabase): swap these three functions for table reads/writes
// keyed by the authenticated user — every caller stays untouched.
// Keys in use: atelier_notes, atelier_saved_posts, atelier_lessons_done,
// atelier_streak, atelier_kudos, atelier_daily_challenge,
// atelier_challenges_solved, atelier_activity_read, atelier_custom_challenges,
// atelier_messages, atelier_notif_seen, atelier_admin_log, atelier_group_seen,
// atelier_theme_palette, atelier_theme_mode.
// =========================================================

export const store = {
  /** Read a JSON value (or the fallback if missing/corrupt). */
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  /** Write a JSON value. */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode — data lives only for this session */
    }
  },

  /** Delete a key. */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

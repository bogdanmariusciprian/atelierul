# Supabase — database & auth (plan)

This folder holds the database plan for **Atelierul-LRO**. No real keys live
here. Public keys go in `src/shared/scripts/config.js`; secrets go in `.env`
(git-ignored).

## Auth
- Google OAuth (enabled in Supabase → Authentication → Providers).
- Front-end helpers: `src/shared/scripts/auth.js`.

## Planned tables (macro sketch — refine later)

**Community**
- `profiles` — user profile (id → auth.users, display_name, bio, avatar_url, status/level).
- `posts` — a post (author_id, title, body, scope: 'forum' | 'user_wall', is_closed).
- `comments` — threaded replies (post_id, parent_comment_id for indentation, author_id, body, is_accepted_answer).
- `likes` — like on a post or comment (user_id, target type + id).
- `subscriptions` — follow a post/comment for notifications (user_id, target).
- `notifications` — generated when a followed thread gets a new reply.
- `badges` + `user_badges` — gamification/achievements.
- `exercises` + `exercise_attempts` — interactive exercises and progress.

**Planner**
- `planner_access` — teacher grants a student access (student_id, granted_by).
- `tutoring_sessions` — scheduled meditații (student_id, starts_at, notes).

## Security
- Enable **Row Level Security (RLS)** on every table.
- Planner tables: readable only by the student and the teacher.

## Migrations
SQL migration files go in `supabase/migrations/` once the schema is designed.

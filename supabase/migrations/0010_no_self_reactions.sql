-- =========================================================
-- Migration 0010 — No self-like / self-reaction, enforced on the SERVER.
--
-- The UI already hides the like button and the reaction adder on your own
-- posts/comments, but the client is only cosmetic — a determined user could
-- still insert a reaction row directly through the API. This makes the rule
-- real: the INSERT policies on the reaction tables now ALSO require that you
-- are NOT the author of the thing you're reacting to.
--
-- Notes:
--   • A "like" is stored as a ♥ row in *_reactions, so this covers likes too.
--   • The teacher (admin) is an author like anyone else here: he may react to
--     OTHERS' content, but not to his own — exactly as asked.
--   • We do NOT force "one reaction per user per comment" in the DB: a like
--     (♥) and an emoji reaction legitimately coexist as separate rows; the
--     "one emoji reaction, swappable" rule stays an app-level concern.
--
-- Ref: OWASP — never trust client-side validation; re-enforce on the server.
-- Safe to re-run (drop policy if exists + create). Depends on 0003.
-- =========================================================

-- ---- Posts: you can't react to (or like) your OWN post ----
drop policy if exists post_reactions_insert on public.post_reactions;
create policy post_reactions_insert on public.post_reactions for insert
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

-- ---- Comments: you can't react to (or like) your OWN comment ----
drop policy if exists comment_reactions_insert on public.comment_reactions;
create policy comment_reactions_insert on public.comment_reactions for insert
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.comments c
      where c.id = comment_id and c.author_id = auth.uid()
    )
  );

-- (SELECT/DELETE policies from 0003 stay as-is: everyone reads counts, and
--  you may always remove your OWN reaction row.)

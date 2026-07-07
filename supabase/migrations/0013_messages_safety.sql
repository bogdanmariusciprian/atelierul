-- =========================================================
-- Migration 0013 — Messaging safety (server-enforced).
--
-- Between MEMBERS, only template messages are allowed — a message must carry
-- a `template_key`. Free text is allowed ONLY toward the teacher (to_admin)
-- or FROM the teacher (an admin). This closes the bullying/abuse vector on
-- the SERVER, not just in the UI: a pupil can never send another pupil raw
-- free text through the API.
--
-- (The client additionally builds member↔member messages only from the safe
-- template catalogue with fixed-list slots — this is the server backstop.)
-- Depends on 0004 (messages) + 0003 (is_admin_user()). Safe to re-run.
-- =========================================================
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (
      to_admin                     -- member → teacher: free text OK
      or public.is_admin_user()    -- teacher → anyone: free text OK
      or template_key is not null  -- member → member: TEMPLATE ONLY
    )
  );

-- =========================================================
-- Migration 0014 — Guest "Scrie-i profesorului" (contact form).
--
-- A signed-out visitor can message the teacher and leave an e-mail so the
-- teacher can reply by e-mail (the visitor has no account/inbox). Since the
-- messages INSERT policy requires sender_id = auth.uid() (nobody for anon),
-- guests go through a SECURITY DEFINER RPC that inserts a to_admin message
-- with the guest's name + e-mail. Members use the normal signed-in path.
--
-- Privacy (minors): we store only what's needed to reply (name optional,
-- e-mail for the answer). Depends on 0004 (messages). Safe to re-run.
-- =========================================================
alter table public.messages add column if not exists guest_email text;
alter table public.messages add column if not exists guest_name  text;

create or replace function public.contact_teacher(p_name text, p_email text, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'empty message';
  end if;
  insert into public.messages (sender_id, recipient_id, to_admin, body, guest_name, guest_email)
  values (
    null, null, true,
    left(trim(p_body), 900),
    nullif(trim(p_name), ''),
    nullif(trim(p_email), '')
  );
end;
$$;

grant execute on function public.contact_teacher(text, text, text) to anon, authenticated;

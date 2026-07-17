-- =========================================================
-- Migration 0040 — Pin de postare în grup.
-- Creatorul grupului (sau adminul) poate FIXA o postare în capul grupului.
-- Coloană `pinned` pe posts + RPC `set_group_pin` (doar creator/admin).
-- Sigur la re-rulare. Depinde de 0003 (posts) + 0004 (groups).
-- =========================================================
alter table public.posts add column if not exists pinned boolean not null default false;

create or replace function public.set_group_pin(p_post uuid, p_pinned boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare gid uuid;
begin
  select group_id into gid from public.posts where id = p_post;
  if gid is null then
    raise exception 'not a group post';
  end if;
  if not (
    public.is_admin_user()
    or exists (select 1 from public.groups g where g.id = gid and g.creator_id = auth.uid())
  ) then
    raise exception 'not allowed';
  end if;
  update public.posts set pinned = coalesce(p_pinned, false) where id = p_post;
end;
$$;

grant execute on function public.set_group_pin(uuid, boolean) to authenticated;

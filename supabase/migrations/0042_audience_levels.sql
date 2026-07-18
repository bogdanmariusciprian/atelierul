-- =========================================================
-- Migration 0042 — Audiență pe 4 niveluri (era doar public/prieteni).
--   public   → oricine, inclusiv vizitatorii nelogați
--   members  → orice utilizator cu cont (nu și vizitatorii)
--   friends  → autorul + prietenii lui
--   private  → DOAR autorul (util pentru însemnări personale)
--
-- Vizibilitatea rămâne impusă de server (RLS), nu de interfață. „private" nu
-- are clauză proprie: nu se potrivește cu nimic, deci rămâne acoperit exclusiv
-- de `author_id = auth.uid()` de mai sus. Depinde de 0003. Sigur la re-rulare.
-- =========================================================

-- Vechea constrângere a fost declarată inline, deci numele ei e generat de
-- Postgres. O caut după definiție, ca migrarea să nu depindă de acel nume.
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public'
       and rel.relname = 'posts'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%audience%'
  loop
    execute format('alter table public.posts drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.posts add constraint posts_audience_check
  check (audience in ('public', 'members', 'friends', 'private'));

-- READ: admin vede tot; autorul își vede tot (inclusiv held/blocked/private);
-- ceilalți văd postările VIZIBILE, după nivelul de audiență.
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (
  public.is_admin_user()
  or author_id = auth.uid()
  or (moderation_status = 'visible'
      and ( audience = 'public'
         or (audience = 'members' and auth.uid() is not null)
         or (audience = 'friends' and public.are_friends(author_id, auth.uid())) ))
);

-- Aceeași logică pentru comentarii (definer → fără recursivitate pe RLS).
create or replace function public.can_see_post(p_post uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post
      and ( public.is_admin_user()
         or p.author_id = auth.uid()
         or (p.moderation_status = 'visible'
             and ( p.audience = 'public'
                or (p.audience = 'members' and auth.uid() is not null)
                or (p.audience = 'friends' and public.are_friends(p.author_id, auth.uid())) )) )
  );
$$;

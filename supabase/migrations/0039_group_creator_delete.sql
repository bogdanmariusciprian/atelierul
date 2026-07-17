-- =========================================================
-- Migration 0039 — Creatorul unui grup poate ȘTERGE postările din grupul lui.
-- Extinde posts_delete (0003: author sau admin) cu „creatorul grupului postării".
-- Sigur la re-rulare. Depinde de 0003 (posts) + 0004 (groups).
-- =========================================================
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete using (
  author_id = auth.uid()
  or public.is_admin_user()
  or (posts.group_id is not null and exists (
        select 1 from public.groups g
        where g.id = posts.group_id and g.creator_id = auth.uid()
     ))
);

-- =========================================================
-- 0118 · FIȘA DE SUB TABLĂ: ȘI PDF, NU DOAR WORD
--
-- Cererea lui Marius (22 noiembrie 2026), la #LaTablă din „Redactare":
-- „să pot pune și pdf-uri, nu doar worduri". Găleata `tabla-fise` (0107)
-- primește acum și PDF; restul (publică, 10 MB, scrie doar adminul) rămâne.
--
-- Se poate rula de mai multe ori.
-- =========================================================

update storage.buckets
   set allowed_mime_types = array[
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/pdf']
 where id = 'tabla-fise';

-- ---------- PAZA ----------
do $$
begin
  if not exists (select 1 from storage.buckets
                  where id = 'tabla-fise' and public
                    and 'application/pdf' = any(allowed_mime_types)
                    and 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' = any(allowed_mime_types)) then
    raise exception '0118: găleata „tabla-fise" nu primește și Word, și PDF';
  end if;
end $$;

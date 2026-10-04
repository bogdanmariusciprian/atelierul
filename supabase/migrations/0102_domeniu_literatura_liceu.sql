-- =========================================================
-- 0102 · DOMENIUL „LITERATURĂ (LICEU)"
--
-- Cererea lui Marius (4 octombrie 2026), la „Lecții pe domenii": „Vreau încă
-- un domeniu: Literatură (liceu)". Domeniile stau în cod
-- (`src/shared/scripts/domains.js`), nu în bază; în bază le cunoaște un singur
-- loc: regula de pe lecțiile propuse de elevi (0089), care primește doar cele
-- șase de până acum. Fără migrarea asta, o lecție propusă la Literatură
-- (liceu) ar fi refuzată la salvare.
--
-- Adresa domeniului e `literatura-liceu`, fără diacritice, ca celelalte.
-- Se poate rula de mai multe ori.
-- =========================================================

alter table public.learn_lesson_proposals
  drop constraint if exists learn_lesson_proposals_domain_check;

alter table public.learn_lesson_proposals
  add constraint learn_lesson_proposals_domain_check check (domain in
    ('morfologie','vocabular','fonetica','sintaxa-frazei','redactare','lectura',
     'literatura-liceu'));

-- ---------- PAZA ----------
-- Se probează regula însăși: pentru fiecare domeniu se încearcă o lecție
-- propusă, iar încercarea se desface pe loc. Cele șapte domenii adevărate
-- trebuie să intre, unul inventat trebuie să fie refuzat.
do $$
declare
  autor uuid;
  d text;
  a_intrat boolean;
  regula text;
begin
  select id into autor from public.profiles limit 1;
  if autor is null then
    raise notice '0102: niciun cont în profiles, proba pe tabel se sare';
    return;
  end if;

  foreach d in array array['morfologie','vocabular','fonetica','sintaxa-frazei',
                           'redactare','lectura','literatura-liceu','inventat']
  loop
    begin
      /* Lecția are nevoie de măcar o pagină (`file_de_lectie_bune`). */
      insert into public.learn_lesson_proposals (author_id, title, domain, pages)
      values (autor, 'proba 0102', d, '[{"name": "Proba", "body": "proba 0102"}]'::jsonb);
      raise exception using errcode = 'P0102', message = 'desfac proba';
    exception
      when sqlstate 'P0102' then a_intrat := true;
      when check_violation then
        /* Refuzul trebuie să vină de la regula de domeniu, nu de la alta:
           altfel paza ar trece din motivul greșit. */
        get stacked diagnostics regula = constraint_name;
        if regula <> 'learn_lesson_proposals_domain_check' then
          raise exception '0102: proba a fost refuzată de altă regulă (%), nu de cea de domeniu', regula;
        end if;
        a_intrat := false;
    end;
    if a_intrat <> (d <> 'inventat') then
      raise exception '0102: domeniul „%" % de regulă, dar n-ar trebui',
        d, case when a_intrat then 'e primit' else 'e refuzat' end;
    end if;
  end loop;

  if exists (
    select 1 from public.learn_lesson_proposals
    where domain not in ('morfologie','vocabular','fonetica','sintaxa-frazei',
                         'redactare','lectura','literatura-liceu')
  ) then
    raise exception '0102: există lecții propuse cu un domeniu necunoscut';
  end if;
end $$;

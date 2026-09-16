-- =========================================================
-- 0094 · LICEU: comutatorul „deschis / închis"
--
-- Marius vrea un comutator care să ascundă modulul de elevi până îl deschide
-- el. Un buton ascuns n-ar fi însemnat nimic — adresa `/liceu/` rămâne scrisă
-- de mână, iar datele s-ar fi cerut mai departe de la bază. Lacătul se pune
-- deci AICI, în politici, iar butonul și fereastra din sit sunt doar chipul lui.
--
-- 1. SEMNUL STĂ ÎN `school_config`, lângă intervale și structura anului, sub
--    cheia `liceu_deschis`. Nu i-am făcut tabel al lui: e o singură vorbă de
--    „da / nu", iar `school_config` e chiar locul vorbelor de felul ăsta.
--
-- 2. SEMNUL RĂMÂNE CITIBIL DE ORICINE, și trebuie să rămână: pagina are nevoie
--    să afle dacă e deschisă înainte să deseneze ceva. O vorbă care spune
--    „modulul e închis" nu trădează nimic — nu e orarul, nu e planificarea.
--    Tot de-aici vine și motivul pentru care politica de pe `school_config` NU
--    se strâmtează: ea ar trebui să se întrebe pe sine ca să afle semnul.
--
-- 3. SE ÎNCHID CELE TREI CU DATE: orarul, planificările și totalurile. Cu
--    semnul stins, o cerere de la un elev (ori de la cineva fără cont) se
--    întoarce goală. Nu „ascunsă la desenare" — goală de la bază, oricine ar
--    chema API-ul și oricâte unelte de browser ar deschide.
--
-- 4. `liceu_azi` NU SE ATINGE. În `0092` am scos-o de sub `security definer`
--    tocmai pentru ziua asta: mergând pe drepturile celui care o cheamă, se
--    supune singură politicilor de mai jos. Dacă rămânea „definer", ar fi fost
--    o portiță care ocolea tot ce scriem acum.
--
-- 5. PORNEȘTE STINS, dar numai la prima rulare: dacă semnul e deja pus, nu i se
--    umblă la valoare. Altfel, o a doua rulare ar fi închis modulul sub mâna
--    lui Marius, în mijlocul unei ore.
-- =========================================================

-- ---------- 1. semnul ----------
insert into public.school_config (cheie, valoare)
values ('liceu_deschis', '{"da": false}'::jsonb)
on conflict (cheie) do nothing;

-- ---------- 2. funcția care citește semnul ----------
/* `security definer`, ca să citească `school_config` fără să atârne de
   politicile cui o cheamă; `stable`, ca planificatorul s-o poată chema o dată
   pe cerere, nu o dată pe rând.
   `search_path` e legat de gât: o funcție „definer" fără el poate fi păcălită
   să cheme alt tabel decât cel pe care-l crede. */
create or replace function public.liceu_deschis()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (valoare->>'da')::boolean from public.school_config where cheie = 'liceu_deschis'),
    false
  );
$$;

comment on function public.liceu_deschis() is
  'Semnul „modulul Liceu e deschis". Stins = orarul și planificările nu se citesc de nimeni afară de profesor.';

revoke all on function public.liceu_deschis() from public;
grant execute on function public.liceu_deschis() to anon, authenticated;

-- ---------- 3. politicile de citire ----------
/* Cele trei cu date se strâmtează. `school_config` rămâne pe `using (true)`:
   acolo stă chiar semnul, iar o politică ce s-ar întreba pe sine n-ar avea
   niciun capăt. */
do $$
declare t text;
begin
  foreach t in array array['school_timetable', 'school_plan', 'school_plan_meta'] loop
    execute format('drop policy if exists %I on public.%I', t || '_citire', t);
    execute format(
      'create policy %I on public.%I for select using (public.liceu_deschis() or public.is_admin_user())',
      t || '_citire', t);
  end loop;
end $$;

-- ---------- 4. paza de după ----------
do $$
declare t text; conditia text;
begin
  /* Cele trei trebuie să aibă politica cea nouă, iar `school_config` pe cea
     veche. Dacă vreuna a rămas pe `true`, se află aici, nu peste o lună. */
  foreach t in array array['school_timetable', 'school_plan', 'school_plan_meta'] loop
    select qual into conditia from pg_policies
     where schemaname = 'public' and tablename = t and policyname = t || '_citire';
    if conditia is null then
      raise exception 'Tabelul % a rămas fără politica de citire.', t;
    end if;
    if conditia not like '%liceu_deschis%' then
      raise exception 'Politica de citire de pe % nu întreabă semnul: %', t, conditia;
    end if;
  end loop;

  select qual into conditia from pg_policies
   where schemaname = 'public' and tablename = 'school_config' and policyname = 'school_config_citire';
  if conditia is distinct from 'true' then
    raise exception 'Semnul nu se mai poate citi (school_config: %). Pagina n-ar mai ști dacă e deschisă.', conditia;
  end if;

  /* `liceu_azi` trebuie să rămână pe drepturile celui care o cheamă. */
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'liceu_azi' and p.prosecdef) then
    raise exception 'liceu_azi a ajuns „security definer" și ar ocoli politicile.';
  end if;
end $$;

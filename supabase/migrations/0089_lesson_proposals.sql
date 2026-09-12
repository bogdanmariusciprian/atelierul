-- =========================================================
-- 0089 · LECȚII PROPUSE DE ELEVI
--
-- Cererea lui Marius (12 septembrie 2026), din pagina Conturi: „vreau să pot
-- acorda elevilor și dreptul de a adăuga lecții. Deci aici faci un buton
-- «Lecții»". Drumul ales: elevul scrie o lecție, profesorul o citește, o
-- îndreaptă dacă vrea și o publică; lecția publicată se vede pe sit pe loc,
-- fără commit.
--
-- TREI HOTĂRÂRI, ca să se înțeleagă de ce arată așa:
--
-- 1. DREPTUL STĂ PE CONT, nu pe lista de la meditații. Celelalte două
--    îngăduințe (`can_propose` pentru explicații, `can_tag` pentru etichete)
--    stau pe `planner_pupils`, fiindcă sunt ale elevilor care vin la meditații.
--    Pe asta Marius o vrea pentru oricine din Conturi, chiar dacă nu vine la
--    meditații, deci îi e locul pe `profiles`.
--
-- 2. COLOANA NOUĂ NU INTRĂ ÎN `admin_list_users()`. Funcția aceea are
--    `returns table(...)` cu coloane fixe: ca să adaug una, ar trebui ștearsă
--    și făcută din nou, iar între push și aplicarea migrării pagina Conturi ar
--    rămâne fără listă. Cine are dreptul se cere SEPARAT, cu
--    `admin_lesson_authors()`, exact cum se cere azi accesul la meditații. Dacă
--    migrarea nu-i aplicată încă, doar butoanele rămân stinse; lista merge.
--    (Lecția din august, scrisă în `migrarea-si-codul-impreuna`.)
--
-- 3. LECȚIA PUBLICATĂ E CITITĂ DE ORICINE, inclusiv de un vizitator nelogat:
--    e conținut de învățat, ca orice altă lecție a sitului. Ce nu-i publicat
--    se vede doar de autorul ei și de profesor.
-- =========================================================

-- ---------- 1. dreptul, pe cont ----------
alter table public.profiles
  add column if not exists can_propose_lesson boolean not null default false;

/* `profiles` n-are drept de citire pe tot tabelul (0009 l-a retras, ca datele
   minorilor să nu plece în browser): drepturile se dau pe coloane, una câte
   una. Fără rândul ăsta, elevul n-ar putea afla că are voie, iar o cerere care
   cere o coloană nepermisă e refuzată ÎNTREAGĂ. */
grant select (can_propose_lesson) on public.profiles to authenticated;

/* Întrebarea „am voie?", pusă de client fără să poată minți la răspuns.
   `security definer`, deci trece pe lângă drepturile pe coloane. */
create or replace function public.poate_propune_lectie(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select coalesce((select can_propose_lesson from public.profiles where id = p_user), false);
$$;

revoke all on function public.poate_propune_lectie(uuid) from public;
grant execute on function public.poate_propune_lectie(uuid) to authenticated;

-- ---------- 2. lecțiile propuse ----------
create table if not exists public.learn_lesson_proposals (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles (id) on delete cascade,

  /* Titlul și cuprinsul, cu măsuri: prea scurt nu e o lecție, iar prea lung
     n-are cum fi citit. Marginile sunt largi dinadins, ca să nu stea în calea
     nimănui; strâmtarea se poate face oricând, lărgirea niciodată fără grijă. */
  title        text not null check (char_length(btrim(title)) between 3 and 120),
  domain       text not null check (domain in
                 ('morfologie','vocabular','fonetica','sintaxa-frazei','redactare','lectura')),
  body         text not null check (char_length(btrim(body)) between 50 and 40000),

  status       text not null default 'in_asteptare'
                 check (status in ('in_asteptare','publicata','respinsa')),
  /* Adresa lecției publicate. Se pune ABIA la publicare, de profesor, și e
     unică pe tot situl: două lecții cu același nume s-ar acoperi una pe alta. */
  slug         text unique,
  /* De ce a fost respinsă. Un refuz fără motiv nu învață pe nimeni nimic. */
  note         text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references public.profiles (id),
  published_at timestamptz
);

/* Coada profesorului: cele în așteptare, cele mai vechi întâi (cine a scris
   primul așteaptă de mai mult timp). */
create index if not exists learn_lesson_proposals_coada
  on public.learn_lesson_proposals (status, created_at);
/* Lecțiile mele, pe pagina elevului. */
create index if not exists learn_lesson_proposals_ale_mele
  on public.learn_lesson_proposals (author_id, created_at desc);
/* Deschiderea unei lecții publicate se face după slug. */
create index if not exists learn_lesson_proposals_slug
  on public.learn_lesson_proposals (slug) where status = 'publicata';

alter table public.learn_lesson_proposals enable row level security;

/* CITIREA. Trei feluri de oameni, trei răspunsuri:
     · oricine, chiar nelogat, vede lecțiile PUBLICATE (sunt conținut de sit);
     · autorul își vede și propunerile nehotărâte;
     · profesorul le vede pe toate. */
drop policy if exists lesson_proposals_read on public.learn_lesson_proposals;
create policy lesson_proposals_read on public.learn_lesson_proposals
  for select using (
    status = 'publicata'
    or author_id = auth.uid()
    or public.is_admin_user()
  );

/* SCRIEREA. Elevul scrie numai cu dreptul dat de profesor, numai în numele
   lui, și numai în așteptare: nu-și poate publica singur lecția. */
drop policy if exists lesson_proposals_insert on public.learn_lesson_proposals;
create policy lesson_proposals_insert on public.learn_lesson_proposals
  for insert with check (
    author_id = auth.uid()
    and public.poate_propune_lectie(auth.uid())
    and status = 'in_asteptare'
    and slug is null
  );

/* ÎNDREPTAREA, cât n-a hotărât profesorul. Poate schimba textul, dar nu starea
   și nici adresa: altfel și-ar publica singur lecția printr-un `update`. */
drop policy if exists lesson_proposals_update_own on public.learn_lesson_proposals;
create policy lesson_proposals_update_own on public.learn_lesson_proposals
  for update
  using (author_id = auth.uid() and status = 'in_asteptare')
  with check (author_id = auth.uid() and status = 'in_asteptare' and slug is null);

/* Elevul își poate retrage propunerea cât timp n-a fost citită. După ce
   profesorul a hotărât, nu: o lecție publicată e a sitului, iar una respinsă e
   urma unei hotărâri. */
drop policy if exists lesson_proposals_delete_own on public.learn_lesson_proposals;
create policy lesson_proposals_delete_own on public.learn_lesson_proposals
  for delete using (author_id = auth.uid() and status = 'in_asteptare');

drop policy if exists lesson_proposals_admin on public.learn_lesson_proposals;
create policy lesson_proposals_admin on public.learn_lesson_proposals
  for all using (public.is_admin_user()) with check (public.is_admin_user());

grant select, insert, update, delete on public.learn_lesson_proposals to authenticated;
grant select on public.learn_lesson_proposals to anon;

/* `updated_at` se mișcă singur: lăsat pe seama clientului, ar rămâne în urmă
   tocmai când contează, adică după o îndreptare. */
create or replace function public.lesson_proposal_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists learn_lesson_proposals_touch on public.learn_lesson_proposals;
create trigger learn_lesson_proposals_touch
  before update on public.learn_lesson_proposals
  for each row execute function public.lesson_proposal_touch();

-- ---------- 3. cine are dreptul (pentru butoanele din Conturi) ----------
/* Cerere SEPARATĂ, nu o coloană în plus la `admin_list_users()`: vezi
   hotărârea 2 din capul fișierului. */
create or replace function public.admin_lesson_authors()
returns setof uuid
language sql stable security definer set search_path to 'public'
as $$
  select id from public.profiles
  where can_propose_lesson and public.is_admin_user();
$$;

revoke all on function public.admin_lesson_authors() from public;
grant execute on function public.admin_lesson_authors() to authenticated;

/* Pornirea și oprirea dreptului. Prin funcție, nu prin `update` de-a dreptul:
   `profiles` n-are drept de scriere pentru client, iar o politică nouă de
   update pe tot tabelul ar fi deschis mai mult decât trebuie. */
create or replace function public.set_lesson_access(p_user uuid, p_on boolean)
returns boolean
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;
  update public.profiles set can_propose_lesson = coalesce(p_on, false)
   where id = p_user;
  return found;
end;
$$;

revoke all on function public.set_lesson_access(uuid, boolean) from public;
grant execute on function public.set_lesson_access(uuid, boolean) to authenticated;

-- ---------- 4. coada profesorului ----------
/* Propunerile în așteptare, cu numele autorului lângă ele. Prin funcție,
   fiindcă numele stă în `profiles`, iar o legătură scrisă din client ar cere
   coloane pe care clientul n-are voie să le ceară. */
create or replace function public.admin_pending_lessons()
returns table (
  id uuid, author_id uuid, author_name text,
  title text, domain text, body text,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;
  return query
    select lp.id, lp.author_id,
           coalesce(nullif(btrim(p.display_name), ''), 'elev'),
           lp.title, lp.domain, lp.body, lp.created_at, lp.updated_at
      from public.learn_lesson_proposals lp
      join public.profiles p on p.id = lp.author_id
     where lp.status = 'in_asteptare'
     order by lp.created_at;
end;
$$;

revoke all on function public.admin_pending_lessons() from public;
grant execute on function public.admin_pending_lessons() to authenticated;

-- ---------- 5. publicarea și refuzul ----------
/* Slug-ul se face din titlu, dar îl poate pune și profesorul. Diacriticele
   cad, spațiile se fac liniuțe, restul se aruncă: adresa trebuie să poată fi
   scrisă de mână și trimisă prin mesaj. */
create or replace function public.slug_din_titlu(p_titlu text)
returns text
language sql immutable
as $$
  select trim(both '-' from
    regexp_replace(
      lower(translate(btrim(p_titlu),
        'ăâîșțĂÂÎȘȚáéíóúàèìòùäëïöüÁÉÍÓÚÀÈÌÒÙÄËÏÖÜçÇñÑ',
        'aaistAAISTaeiouaeiouaeiouAEIOUAEIOUAEIOUcCnN')),
      '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.publish_lesson(p_id uuid, p_title text default null,
                                                 p_body text default null,
                                                 p_slug text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare lp public.learn_lesson_proposals; s text;
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;

  select * into lp from public.learn_lesson_proposals
   where id = p_id and status = 'in_asteptare' for update;
  if not found then
    return jsonb_build_object('error', 'propunerea nu mai e în așteptare');
  end if;

  /* Profesorul poate îndrepta titlul și textul chiar la publicare: de cele mai
     multe ori asta și face, iar un drum în doi pași (întâi salvez, apoi
     public) s-ar rupe la mijloc. */
  lp.title := coalesce(nullif(btrim(p_title), ''), lp.title);
  lp.body  := coalesce(nullif(btrim(p_body), ''), lp.body);
  if char_length(lp.title) < 3 or char_length(lp.body) < 50 then
    return jsonb_build_object('error', 'titlul ori textul sunt prea scurte');
  end if;

  s := coalesce(nullif(btrim(p_slug), ''), public.slug_din_titlu(lp.title));
  if s = '' then
    return jsonb_build_object('error', 'din titlul ăsta nu iese o adresă');
  end if;
  /* Două lecții cu același nume: a doua capătă un număr, ca să nu se acopere
     una pe alta și să nu piară munca nimănui. */
  if exists (select 1 from public.learn_lesson_proposals where slug = s and id <> p_id) then
    for i in 2..50 loop
      if not exists (select 1 from public.learn_lesson_proposals
                     where slug = s || '-' || i and id <> p_id) then
        s := s || '-' || i;
        exit;
      end if;
    end loop;
  end if;

  update public.learn_lesson_proposals
     set title = lp.title, body = lp.body, slug = s,
         status = 'publicata', note = null,
         decided_at = now(), decided_by = auth.uid(), published_at = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'slug', s, 'title', lp.title);
end;
$$;

revoke all on function public.publish_lesson(uuid, text, text, text) from public;
grant execute on function public.publish_lesson(uuid, text, text, text) to authenticated;

create or replace function public.reject_lesson(p_id uuid, p_note text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;
  update public.learn_lesson_proposals
     set status = 'respinsa', note = nullif(btrim(p_note), ''),
         decided_at = now(), decided_by = auth.uid()
   where id = p_id and status = 'in_asteptare';
  if not found then
    return jsonb_build_object('error', 'propunerea nu mai e în așteptare');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.reject_lesson(uuid, text) from public;
grant execute on function public.reject_lesson(uuid, text) to authenticated;

/* O lecție publicată poate fi scoasă de pe sit fără să piară: se întoarce în
   așteptare, cu adresa ștearsă, ca profesorul s-o poată îndrepta și publica
   iar. Ștergerea de tot rămâne a lui, prin politica de admin. */
create or replace function public.unpublish_lesson(p_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;
  update public.learn_lesson_proposals
     set status = 'in_asteptare', slug = null, published_at = null,
         decided_at = null, decided_by = null
   where id = p_id and status = 'publicata';
  if not found then
    return jsonb_build_object('error', 'lecția asta nu e publicată');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.unpublish_lesson(uuid) from public;
grant execute on function public.unpublish_lesson(uuid) to authenticated;

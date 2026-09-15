-- =========================================================
-- 0090 · LECȚIA PE MAI MULTE FILE
--
-- Marius, 12 septembrie 2026: „elevul cu drept de Lecții să poată posta o
-- lecție pe mai multe pagini". Forma aleasă: FILE în capul lecției („Teorie",
-- „Exemple", „Exerciții"), cu nume date de el.
--
-- DE CE `jsonb` ȘI NU UN TABEL DE PAGINI. O pagină n-are viață de sine
-- stătătoare: nu se caută singură, nu se leagă nimic de ea, nu se dă drept pe
-- ea. Se scrie și se citește MEREU odată cu lecția, iar ordinea filelor e chiar
-- ordinea din vector. Un tabel ar fi cerut chei, ordine ținută de mână și o
-- legătură la fiecare citire, ca să răspundă la aceleași întrebări.
--
-- `body` RĂMÂNE, dar ca oglindă: în el se strâng textele tuturor filelor, ca
-- lecțiile să se poată căuta cu un singur `like` și ca vechea pagină să nu
-- rămână fără nimic dacă o citește cineva înainte de a fi adusă la zi. Se umple
-- singur, la scriere; nu-l mai scrie nimeni de mână.
-- =========================================================

-- ---------- 1. filele ----------
alter table public.learn_lesson_proposals
  add column if not exists pages jsonb not null default '[]'::jsonb;

/* Lecțiile scrise înainte de migrarea asta (dacă apucaseră să fie) devin o
   singură filă, ca să nu piară nimic. */
update public.learn_lesson_proposals
   set pages = jsonb_build_array(jsonb_build_object('name', 'Lecția', 'body', body))
 where jsonb_array_length(pages) = 0 and coalesce(btrim(body), '') <> '';

/* CE E O FILĂ BUNĂ: un vector cu una până la douăzeci de file, fiecare cu nume
   și cuprins. Verificarea stă în bază, nu doar în pagină: o lecție stricată
   scrisă pe lângă interfață ar strica pagina care o citește. */
create or replace function public.file_de_lectie_bune(p jsonb)
returns boolean
language sql immutable
as $$
  select p is not null
     and jsonb_typeof(p) = 'array'
     and jsonb_array_length(p) between 1 and 20
     and not exists (
       select 1 from jsonb_array_elements(p) f
        where jsonb_typeof(f) <> 'object'
           or coalesce(btrim(f->>'name'), '') = ''
           or char_length(f->>'name') > 40
           or coalesce(btrim(f->>'body'), '') = ''
           or char_length(f->>'body') > 40000
     );
$$;

alter table public.learn_lesson_proposals
  drop constraint if exists learn_lesson_proposals_pages_check;
alter table public.learn_lesson_proposals
  add constraint learn_lesson_proposals_pages_check
  check (public.file_de_lectie_bune(pages));

/* `body` nu mai e scris de om, deci nu mai are de ce să fie neapărat plin la
   inserare: se umple din file, printr-un declanșator. Măsura de jos (50 de
   semne) pleacă odată cu el: o lecție scurtă pe trei file poate avea mai puțin
   în fiecare, iar măsura care contează e acum pe file. */
alter table public.learn_lesson_proposals alter column body drop not null;
alter table public.learn_lesson_proposals
  drop constraint if exists learn_lesson_proposals_body_check;

/* Oglinda: textul tuturor filelor, una după alta. Se face la fiecare scriere,
   ca să nu rămână în urmă tocmai când cauți ceva.

   TOT AICI SE ÎNTOARCE ÎN AȘTEPTARE O LECȚIE TRIMISĂ ÎNAPOI, dacă autorul ei o
   umblă. În 0089 rămăsese o fundătură: profesorul trimitea lecția înapoi cu o
   vorbă de îndreptat, dar regulile de scriere cereau `in_asteptare`, deci elevul
   nu mai putea nici s-o îndrepte, nici s-o șteargă. Rămânea în lista lui pe
   vecie, cu observația profesorului și fără nicio ieșire.

   Regula stă în bază, nu în pagină: „dacă autorul îndreaptă o lecție întoarsă,
   ea pleacă din nou la profesor" e o regulă de viață a lecției, nu un amănunt
   de ecran; o pagină ar fi putut s-o uite, baza nu. */
create or replace function public.lesson_body_din_file()
returns trigger language plpgsql as $$
begin
  new.body := (
    select string_agg(f->>'body', E'\n\n' order by ord)
      from jsonb_array_elements(new.pages) with ordinality as t(f, ord)
  );
  new.updated_at := now();

  if tg_op = 'UPDATE'
     and old.status = 'respinsa'
     and auth.uid() = old.author_id then
    new.status := 'in_asteptare';
    new.note := null;
    new.decided_at := null;
    new.decided_by := null;
  end if;

  return new;
end;
$$;

/* Regulile de scriere, lărgite cât să încapă drumul de mai sus. Elevul umblă la
   lecția lui cât e în așteptare SAU cât e întoarsă; ce iese trebuie să fie, și
   într-un caz, și în celălalt, o lecție în așteptare, fără adresă (adresa o dă
   numai publicarea). Declanșatorul de mai sus se face ÎNAINTE, deci rândul
   ajunge la `with check` cu starea potrivită. */
drop policy if exists lesson_proposals_update_own on public.learn_lesson_proposals;
create policy lesson_proposals_update_own on public.learn_lesson_proposals
  for update
  using (author_id = auth.uid() and status in ('in_asteptare', 'respinsa'))
  with check (author_id = auth.uid() and status = 'in_asteptare' and slug is null);

/* Și ștersul: o lecție întoarsă trebuie să poată fi și aruncată, nu doar
   îndreptată. Una publicată rămâne neatinsă de elev. */
drop policy if exists lesson_proposals_delete_own on public.learn_lesson_proposals;
create policy lesson_proposals_delete_own on public.learn_lesson_proposals
  for delete
  using (author_id = auth.uid() and status in ('in_asteptare', 'respinsa'));

/* Ia locul declanșatorului din 0089, care doar mișca `updated_at`: sunt
   amândouă „ce se face la fiecare scriere", iar două declanșatoare pe același
   rând s-ar fi bătut pe aceeași coloană. */
drop trigger if exists learn_lesson_proposals_touch on public.learn_lesson_proposals;
drop trigger if exists learn_lesson_proposals_body on public.learn_lesson_proposals;
create trigger learn_lesson_proposals_body
  before insert or update on public.learn_lesson_proposals
  for each row execute function public.lesson_body_din_file();

-- ---------- 2. coada profesorului, cu file ----------
/* `returns table(...)` nu se poate schimba cu `create or replace`: funcția
   trebuie ștearsă întâi. E a noastră și n-o cheamă nimeni altcineva. */
drop function if exists public.admin_pending_lessons();
create function public.admin_pending_lessons()
returns table (
  id uuid, author_id uuid, author_name text,
  title text, domain text, pages jsonb,
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
           lp.title, lp.domain, lp.pages, lp.created_at, lp.updated_at
      from public.learn_lesson_proposals lp
      join public.profiles p on p.id = lp.author_id
     where lp.status = 'in_asteptare'
     order by lp.created_at;
end;
$$;

revoke all on function public.admin_pending_lessons() from public;
grant execute on function public.admin_pending_lessons() to authenticated;

-- ---------- 3. publicarea, cu file ----------
/* DOUĂ ARUNCĂRI, NU UNA, și asta e o lecție plătită: prima rulare a mers, a
   doua a căzut cu „function publish_lesson already exists with same argument
   types".
     · prima linie aruncă semnătura din 0089, cu `p_body text`;
     · a doua o aruncă pe cea de AICI, care există deja dacă migrarea se rulează
       a doua oară.
   `create or replace` n-ar fi ajuns: se schimbă tipul unui argument, iar pentru
   Postgres altă semnătură înseamnă altă funcție, nu aceeași de înlocuit. */
drop function if exists public.publish_lesson(uuid, text, text, text);
drop function if exists public.publish_lesson(uuid, text, jsonb, text);
create function public.publish_lesson(p_id uuid, p_title text default null,
                                      p_pages jsonb default null,
                                      p_slug text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare lp public.learn_lesson_proposals; s text; noile jsonb;
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;

  select * into lp from public.learn_lesson_proposals
   where id = p_id and status = 'in_asteptare' for update;
  if not found then
    return jsonb_build_object('error', 'propunerea nu mai e în așteptare');
  end if;

  /* Profesorul poate îndrepta titlul și filele chiar la publicare: de cele mai
     multe ori asta și face, iar un drum în doi pași s-ar rupe la mijloc. */
  lp.title := coalesce(nullif(btrim(p_title), ''), lp.title);
  noile := coalesce(p_pages, lp.pages);
  if char_length(lp.title) < 3 then
    return jsonb_build_object('error', 'titlul e prea scurt');
  end if;
  if not public.file_de_lectie_bune(noile) then
    return jsonb_build_object('error', 'filele nu sunt întregi: fiecare are nevoie de nume și de text');
  end if;

  s := coalesce(nullif(btrim(p_slug), ''), public.slug_din_titlu(lp.title));
  if s = '' then
    return jsonb_build_object('error', 'din titlul ăsta nu iese o adresă');
  end if;
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
     set title = lp.title, pages = noile, slug = s,
         status = 'publicata', note = null,
         decided_at = now(), decided_by = auth.uid(), published_at = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'slug', s, 'title', lp.title);
end;
$$;

revoke all on function public.publish_lesson(uuid, text, jsonb, text) from public;
grant execute on function public.publish_lesson(uuid, text, jsonb, text) to authenticated;

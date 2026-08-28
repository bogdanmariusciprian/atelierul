-- =========================================================
-- Migration 0087: elevii de la meditații propun explicații la itemi.
--
-- DE CE. Banca de la Câmpina are 880 de itemi și aproape nicio explicație, iar
-- scrise de un singur om ar lua un an. Numai că, privind mai atent, scrisul lor
-- nu-i o corvoadă de dat altcuiva: a lămuri de ce răspunsul e B E chiar
-- exercițiul. Deci lucrul se mută acolo unde se și învață, ca la etichetarea
-- cuvintelor (0082): elevul propune, profesorul hotărăște.
--
-- CINE POATE. Nu oricine: doar elevii de la meditații, și dintre ei doar cei pe
-- care profesorul îi pornește, unul câte unul, cât stă cu ei. De aceea
-- comutatorul stă pe `planner_pupils`, care E chiar lista de la meditații; o
-- tabel nou pentru „cine" ar fi fost o a doua listă de ținut la zi.
--
-- NUMAI ITEMII FĂRĂ EXPLICAȚIE. Elevii umplu golurile, nu rescriu ce e scris.
-- Regula e ținută în bază, nu doar în pagină: o pază care trăiește în browser
-- se ocolește cu unealta de dezvoltare.
--
-- APROBAREA E O SINGURĂ MIȘCARE. Scrierea explicației în bancă și închiderea
-- propunerii se fac într-un RPC, deci ori se întâmplă amândouă, ori niciuna.
-- Despărțite, ai fi rămas cu explicații publicate din propuneri care par încă
-- în așteptare, iar coada ta n-ar mai fi spus adevărul.
--
-- CE NU FACE. Nu semnează explicația și nu dă puncte: așa a ales Marius. Nota
-- privată a elevului din `tests_progress` rămâne a lui, neatinsă de aprobare.
--
-- Depinde de 0085 (cheia compusă `(id, exam)`) și 0086 (drepturile). Sigur la
-- re-rulare.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Comutatorul, pe elev
-- ---------------------------------------------------------
alter table public.planner_pupils
  add column if not exists can_propose boolean not null default false;

comment on column public.planner_pupils.can_propose is
  'Elevul poate propune explicații la itemi. Se aprinde și se stinge din butonul plutitor al profesorului, cât lucrează cu el.';

/* Cele două întrebări de mai jos se pun din politici, iar politicile se judecă
   cu drepturile celui care întreabă. Elevul n-are voie să citească nici lista
   de la meditații a altora, nici coloana `observation` (îi e revocată din 0044),
   deci întrebările trebuie puse de cineva care are voie: de aici `security
   definer`. Ele NU dezvăluie nimic, întorc doar da sau nu. */
create or replace function public.poate_propune(p_user uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.planner_pupils p
    where p.user_id = p_user and p.can_propose
  );
$$;

create or replace function public.item_fara_explicatie(p_item uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(btrim(observation), '') = ''
  from public.tests_items where id = p_item;
$$;

revoke all on function public.poate_propune(uuid) from public;
revoke all on function public.item_fara_explicatie(uuid) from public;
grant execute on function public.poate_propune(uuid) to authenticated;
grant execute on function public.item_fara_explicatie(uuid) to authenticated;

-- ---------------------------------------------------------
-- 2. Propunerile
-- ---------------------------------------------------------
create table if not exists public.tests_explanations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  item_id     uuid not null,
  exam        text not null,
  text        text not null check (char_length(btrim(text)) between 10 and 2000),
  status      text not null default 'in_asteptare'
              check (status in ('in_asteptare', 'aprobata', 'respinsa')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references public.profiles (id),
  -- Un elev, o propunere pe item: dacă se răzgândește, o rescrie pe a lui.
  unique (user_id, item_id),
  -- Perechea, nu fiecare pe rând: propunerea nu poate pretinde alt examen
  -- decât itemul. Aceeași plasă ca la `tests_progress` (0085).
  constraint tests_explanations_item_fk foreign key (item_id, exam)
    references public.tests_items (id, exam) on delete cascade on update cascade
);

comment on table public.tests_explanations is
  'Explicații propuse de elevii de la meditații. Aprobate, trec în tests_items.observation și se văd la toți; nota privată a elevului rămâne în tests_progress.';

create index if not exists tests_explanations_coada
  on public.tests_explanations (status, created_at desc);
create index if not exists tests_explanations_ale_mele
  on public.tests_explanations (user_id, item_id);

alter table public.tests_explanations enable row level security;

-- Elevul își vede propriile propuneri; profesorul le vede pe toate.
drop policy if exists tests_explanations_read on public.tests_explanations;
create policy tests_explanations_read on public.tests_explanations
  for select using (user_id = auth.uid() or public.is_admin_user());

/* Elevul scrie numai pentru el, numai dacă e pornit, și numai pe itemi care
   n-au încă explicație. Trei condiții, toate în bază: butonul care lipsește din
   pagină e curtoazie, aici e paza. */
drop policy if exists tests_explanations_insert on public.tests_explanations;
create policy tests_explanations_insert on public.tests_explanations
  for insert with check (
    user_id = auth.uid()
    and public.poate_propune(auth.uid())
    and public.item_fara_explicatie(item_id)
    and status = 'in_asteptare'
  );

/* Se poate rescrie doar cât e ÎN AȘTEPTARE. După ce ai hotărât tu, elevul nu
   mai poate schimba textul pe care l-ai citit: altfel „aprobat" n-ar mai
   însemna nimic. */
drop policy if exists tests_explanations_update_own on public.tests_explanations;
create policy tests_explanations_update_own on public.tests_explanations
  for update using (user_id = auth.uid() and status = 'in_asteptare')
  with check (user_id = auth.uid() and status = 'in_asteptare');

drop policy if exists tests_explanations_admin on public.tests_explanations;
create policy tests_explanations_admin on public.tests_explanations
  for all using (public.is_admin_user()) with check (public.is_admin_user());

drop trigger if exists tests_explanations_touch on public.tests_explanations;
create trigger tests_explanations_touch before update on public.tests_explanations
  for each row execute function public.tests_touch_updated_at();

grant select, insert, update on public.tests_explanations to authenticated;

-- ---------------------------------------------------------
-- 3. Coada profesorului, într-o singură chemare
-- ---------------------------------------------------------
/* Propunerea singură nu spune nimic: ca s-o judeci îți trebuie enunțul, cele
   patru variante, litera corectă și numele elevului. Adunate în client ar fi
   însemnat trei chemări și o coloană (`correct`) pe care clientul n-o poate
   citi. Aici se adună o dată, pe server, unde tot ce trebuie e la îndemână. */
create or replace function public.admin_pending_explanations()
returns table (
  id uuid, created_at timestamptz, text text,
  pupil text, item_id uuid, exam text,
  year integer, session text, item_no integer,
  question text, option_a text, option_b text, option_c text, option_d text,
  correct text
)
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;
  return query
    select e.id, e.created_at, e.text,
           coalesce(nullif(btrim(p.display_name), ''), p.username, 'elev') as pupil,
           i.id, i.exam, i.year, i.session, i.item_no,
           i.question, i.option_a, i.option_b, i.option_c, i.option_d,
           coalesce(i.correct_2026, i.correct)
    from public.tests_explanations e
    join public.tests_items i on i.id = e.item_id
    left join public.profiles p on p.id = e.user_id
    where e.status = 'in_asteptare'
    order by e.created_at;
end;
$$;

-- ---------------------------------------------------------
-- 4. Aprobarea și respingerea
-- ---------------------------------------------------------
/* `p_text` îngăduie profesorului să îndrepte fraza înainte s-o publice. Ce
   aprobă e ce se scrie: și în bancă, și în propunere, ca să rămână urma
   textului chiar aprobat, nu a celui trimis. */
create or replace function public.approve_explanation(p_id uuid, p_text text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare pr public.tests_explanations; txt text;
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;
  select * into pr from public.tests_explanations
    where id = p_id and status = 'in_asteptare' for update;
  if not found then
    return jsonb_build_object('error', 'propunerea nu mai e în așteptare');
  end if;

  txt := nullif(btrim(coalesce(p_text, pr.text)), '');
  if txt is null or char_length(txt) < 10 then
    return jsonb_build_object('error', 'explicația e prea scurtă');
  end if;
  if not public.item_fara_explicatie(pr.item_id) then
    return jsonb_build_object('error', 'itemul are deja explicație');
  end if;

  update public.tests_items set observation = txt where id = pr.item_id;
  update public.tests_explanations
     set status = 'aprobata', text = txt, decided_at = now(), decided_by = auth.uid()
   where id = pr.id;

  /* Celelalte propuneri pe ACELAȘI item se închid singure: itemul are de acum
     explicație, deci n-ar mai putea fi aprobate oricum. Lăsate deschise, ar fi
     stat în coada ta la nesfârșit, refuzate abia la apăsare. */
  update public.tests_explanations
     set status = 'respinsa', decided_at = now(), decided_by = auth.uid()
   where item_id = pr.item_id and status = 'in_asteptare' and id <> pr.id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.reject_explanation(p_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin_user() then
    raise exception 'admin only';
  end if;
  update public.tests_explanations
     set status = 'respinsa', decided_at = now(), decided_by = auth.uid()
   where id = p_id and status = 'in_asteptare';
  return jsonb_build_object('ok', found);
end;
$$;

revoke all on function public.admin_pending_explanations() from public;
revoke all on function public.approve_explanation(uuid, text) from public;
revoke all on function public.reject_explanation(uuid) from public;
grant execute on function public.admin_pending_explanations() to authenticated;
grant execute on function public.approve_explanation(uuid, text) to authenticated;
grant execute on function public.reject_explanation(uuid) to authenticated;

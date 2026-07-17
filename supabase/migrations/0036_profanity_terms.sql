-- =========================================================
-- Migration 0036 — Listă de termeni interziși administrabilă de profesor.
--
-- Profesorul poate ADĂUGA / ȘTERGE termeni; sunt folosiți ȘI de trigger-ul
-- server (is_profane → held) ȘI de filtrul din client (moderation.js).
-- Depinde de 0035 (is_profane, trigger held). Sigur la re-rulare.
-- =========================================================

create table if not exists public.profanity_terms (
  id         uuid primary key default gen_random_uuid(),
  term       text not null unique,
  added_by   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.profanity_terms enable row level security;

-- Orice utilizator LOGAT poate citi lista (filtrul din client are nevoie de ea;
-- e o listă de cuvinte, nu date sensibile). Doar profesorul o modifică.
drop policy if exists profanity_read on public.profanity_terms;
create policy profanity_read on public.profanity_terms for select
  using (auth.uid() is not null);
drop policy if exists profanity_ins on public.profanity_terms;
create policy profanity_ins on public.profanity_terms for insert
  with check (public.is_admin_user());
drop policy if exists profanity_del on public.profanity_terms;
create policy profanity_del on public.profanity_terms for delete
  using (public.is_admin_user());
grant select, insert, delete on public.profanity_terms to authenticated;

-- ---- is_profane: stems fixe + termenii CUSTOM ai profesorului ----
-- Normalizează diacriticele, transformă tot ce nu-i literă în spații (cuvinte
-- separate), apoi caută la ÎNCEPUT de cuvânt. Termenii custom sunt verificați
-- cu position() (fără regex) → sigur față de caractere speciale.
create or replace function public.is_profane(txt text)
returns boolean
language sql stable
set search_path = public
as $$
  with n as (
    select ' ' || regexp_replace(
      lower(translate(coalesce(txt, ''), 'ăâîșşțţ', 'aaisstt')),
      '[^a-z]+', ' ', 'g') || ' ' as s
  )
  select
    (select s from n) ~
      '( )(pula|pule|puli|pizd|muie|muist|fute|futu|futa|futi|coaie|cacat|cacan|curva|curve|curvo|tarfa|labagi|bulangi|poponar|gaoz|handicapat|retardat|dobitoc|tampit|fuck|shit|bitch|cunt|asshole|whore|slut|nigg|faggot)'
    or exists (
      select 1 from public.profanity_terms t, n
      where position(' ' || lower(translate(t.term, 'ăâîșşțţ', 'aaisstt')) in n.s) > 0
    );
$$;

-- =========================================================
-- Pași client (după această migrare):
--   • forum-repo: fetchProfanityTerms / addProfanityTerm / removeProfanityTerm
--   • moderation.js: setCustomProfanity(terms) → incluse în findProfanity
--   • community.js: box admin în fila „Moderare" (adaugă/șterge termeni)
-- =========================================================

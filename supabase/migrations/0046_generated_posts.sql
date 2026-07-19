-- =========================================================
-- Migration 0046 — Postări GENERATE de joc: conținut needitabil.
--
-- Un item postat pe perete e o captură a itemului așa cum l-a rezolvat elevul:
-- enunț, variante, răspuns corect, explicație. Dacă textul ar putea fi editat,
-- captura ar putea fi falsificată — cineva ar putea schimba răspunsul corect
-- și ar rămâne postat sub eticheta de item oficial. Deci textul se blochează.
--
-- Ștergerea rămâne permisă: e postarea lui, poate renunța la ea oricând.
-- Restul câmpurilor (audiență, de exemplu) rămân editabile.
--
-- Marcajul e o coloană dedicată, nu tipul postării: o „reușită" scrisă de mână
-- trebuie să rămână editabilă. Tot ea decide și chenarul din interfață, deci
-- încadrarea nimerește exact postările generate.
--
-- Depinde de 0003 (posts). Sigur la re-rulare.
-- =========================================================

alter table public.posts
  add column if not exists generated boolean not null default false;

-- Blocarea e pe SERVER, nu doar prin ascunderea butonului: un client modificat
-- ar putea trimite oricând un update direct.
create or replace function public.block_generated_body_edit()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.generated and new.body is distinct from old.body then
    raise exception 'continutul unei postari generate nu poate fi editat';
  end if;
  -- marcajul în sine nu se poate scoate, ca să nu se ocolească regula
  new.generated := old.generated;
  return new;
end; $$;

drop trigger if exists posts_block_generated_edit on public.posts;
create trigger posts_block_generated_edit
  before update on public.posts
  for each row execute function public.block_generated_body_edit();

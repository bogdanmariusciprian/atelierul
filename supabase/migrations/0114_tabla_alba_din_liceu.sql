-- =========================================================
-- 0114 · TABLA ALBĂ, DIN LICEU: clic pe titlul clasei („10D") → tabla ei
--
-- Cererea lui Marius (17 noiembrie 2026): elevii, logați ori nu, ajung pe tabla
-- clasei lor din modulul Liceu, cu un clic pe titlul clasei, fără să scrie
-- codul.
--
-- Clasa din Liceu și clasa de pe tablă se potrivesc după nume („10D" = „10d").
-- Intrarea după nume merge DOAR cât e deschis modulul Liceu (`liceu_deschis()`,
-- 0094), adică doar pentru cine vede deja pagina clasei; adminul intră oricând.
-- Cu Liceul închis, singura cale rămâne codul clasei (0113).
--
-- Întoarce același lucru ca `tabla_alba_intra`, plus codul: pagina tablei îl
-- folosește mai departe ca să ceară paginile și materialul.
--
-- Se poate rula de mai multe ori.
-- =========================================================

create or replace function public.tabla_alba_intra_clasa(p_nume text)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  c public.tabla_alba_clase;
begin
  if not (public.liceu_deschis() or public.is_admin_user()) then
    return null;
  end if;
  if p_nume is null or char_length(btrim(p_nume)) not between 1 and 40 then
    return null;
  end if;
  select * into c from public.tabla_alba_clase
   where lower(btrim(nume)) = lower(btrim(p_nume))
   order by ordine, creat_la limit 1;
  if not found then
    return null;
  end if;
  return public.tabla_alba_intra(c.cod) || jsonb_build_object('cod', c.cod);
end;
$$;

revoke all on function public.tabla_alba_intra_clasa(text) from public;
grant execute on function public.tabla_alba_intra_clasa(text) to anon, authenticated;

-- ---------- PAZA ----------
do $$
begin
  if not (select prosecdef from pg_proc where oid = 'public.tabla_alba_intra_clasa(text)'::regprocedure) then
    raise exception '0114: tabla_alba_intra_clasa trebuie să ruleze ca security definer';
  end if;
  if position('liceu_deschis()' in pg_get_functiondef('public.tabla_alba_intra_clasa(text)'::regprocedure)) = 0 then
    raise exception '0114: intrarea după nume nu mai atârnă de semnul Liceului';
  end if;
end $$;

-- =========================================================
-- 0116 · TABLA ALBĂ: AUTOMAT / DESCHISĂ / ÎNCHISĂ
--
-- Cererea lui Marius (17 noiembrie 2026): „din admin am deschis tabla, chiar
-- dacă nu am oră acum la 9B … vreau să o pot vedea, logat sau nelogat".
--
-- Comutatorul din 0115 (`deschisa`, da / nu) devine trei stări:
--   automat   elevii o văd doar la ora clasei din orar (±2 minute), cu Liceul
--             deschis (regula din 0115);
--   deschisa  o vede oricine, oricând, cât o lasă profesorul așa (nu ține cont
--             nici de orar, nici de Liceu);
--   inchisa   n-o vede nimeni afară de profesor, nici la ora clasei.
-- Profesorul o vede oricând.
--
-- Tablele lăsate „deschise" în 0115 trec pe „deschisa", celelalte pe „automat".
--
-- Se poate rula de mai multe ori.
-- =========================================================

alter table public.tabla_alba_clase add column if not exists acces text not null default 'automat'
  check (acces in ('automat', 'deschisa', 'inchisa'));
comment on column public.tabla_alba_clase.acces is
  'automat = la ora clasei din orar, cu Liceul deschis; deschisa = oricând; inchisa = doar profesorul (0116).';

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'tabla_alba_clase' and column_name = 'deschisa') then
    update public.tabla_alba_clase set acces = case when deschisa then 'deschisa' else 'automat' end;
    alter table public.tabla_alba_clase drop column deschisa;
  end if;
end $$;

/* E vizibilă acum tabla clasei, după starea ei? (fără admin: pentru liste) */
create or replace function public.tabla_alba_acum(c public.tabla_alba_clase)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select c.acces = 'deschisa'
      or (c.acces = 'automat' and public.liceu_deschis() and public.liceu_la_ora(c.nume));
$$;

create or replace function public.tabla_alba_vizibila(p_clasa uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select public.is_admin_user() or exists (
    select 1 from public.tabla_alba_clase c where c.id = p_clasa and public.tabla_alba_acum(c));
$$;

create or replace function public.tabla_alba_deschise()
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('nume', c.nume) order by c.ordine, c.creat_la), '[]'::jsonb)
    from public.tabla_alba_clase c
   where public.tabla_alba_acum(c);
$$;

revoke all on function public.tabla_alba_acum(public.tabla_alba_clase) from public;
grant execute on function public.tabla_alba_acum(public.tabla_alba_clase) to anon, authenticated;

-- ---------- PAZA ----------
do $$
begin
  if position('acces' in pg_get_functiondef('public.tabla_alba_acum(public.tabla_alba_clase)'::regprocedure)) = 0 then
    raise exception '0116: tabla nu atârnă de starea ei';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'tabla_alba_clase' and column_name = 'deschisa') then
    raise exception '0116: a rămas coloana veche „deschisa"';
  end if;
end $$;

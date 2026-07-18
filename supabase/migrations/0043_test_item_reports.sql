-- =========================================================
-- Migration 0043 — Semnalarea erorilor de conținut, cu buclă completă.
--
--   • Oricine (inclusiv un vizitator nelogat) poate semnala un item de test,
--     scriind o explicație. Vizitatorii NU capătă drept de scriere pe tabel:
--     merg printr-un RPC security definer, exact ca `contact_teacher` (0010).
--   • Semnalarea reține și varianta bifată de elev (dacă apucase să răspundă),
--     ca profesorul să vadă din ce a pornit confuzia.
--   • Profesorul închide semnalarea în două feluri:
--       ÎNTEMEIATĂ  → elevul primește notificare (îl duce la item) + puncte;
--       NEÎNTEMEIATĂ → elevul primește un mesaj cu explicația profesorului.
--     Ambele doar dacă semnalarea are autor cunoscut (nelogații pot doar semnala).
--
-- Depinde de 0004 (reports/messages/notifications) + 0027 (test_items)
-- + 0035 (target_type extins). Sigur la re-rulare.
-- =========================================================

-- ---- 1) Semnalări și de la vizitatori: autorul devine opțional ----
alter table public.reports alter column reporter_id drop not null;
-- varianta bifată de elev etc. („{chosen: 'B'}")
alter table public.reports add column if not exists meta jsonb not null default '{}'::jsonb;

-- ---- 2) Semnalarea unui item (anon + logat) ----
create or replace function public.report_test_item(
  p_item uuid, p_reason text, p_chosen text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare txt text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_item is null then
    raise exception 'missing item';
  end if;
  if txt is null then
    raise exception 'explicatia e obligatorie';
  end if;
  if not exists (select 1 from public.test_items where id = p_item) then
    raise exception 'item inexistent';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, meta)
  values (
    auth.uid(), -- NULL pentru vizitatori
    'test_item',
    p_item,
    left(txt, 500),
    jsonb_build_object('chosen', nullif(btrim(coalesce(p_chosen, '')), ''))
  );
end; $$;

grant execute on function public.report_test_item(uuid, text, text) to anon, authenticated;

-- ---- 3) Itemul complet (cu cheia) pentru cardul de moderare ----
create or replace function public.admin_test_item(p_id uuid)
returns setof public.test_items
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_user() then
    raise exception 'not allowed';
  end if;
  return query select * from public.test_items where id = p_id;
end; $$;

grant execute on function public.admin_test_item(uuid) to authenticated;

-- ---- 4) Închiderea semnalării, cu răspuns către elev ----
create or replace function public.resolve_test_report(
  p_report uuid, p_founded boolean, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare r public.reports%rowtype;
        note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin_user() then
    raise exception 'not allowed';
  end if;
  -- Doar o semnalare DESCHISĂ se poate închide → fără puncte duble la re-apel.
  select * into r from public.reports where id = p_report and status = 'open' for update;
  if not found then
    return;
  end if;

  update public.reports set status = 'resolved' where id = r.id;

  -- Nelogatul n-are unde primi răspuns; ne oprim aici.
  if r.reporter_id is null then
    return;
  end if;

  if p_founded then
    -- Mulțumim, îl ducem la item și îl recompensăm (profesorul nu e în joc,
    -- dar aici destinatarul e mereu un elev).
    insert into public.notifications (user_id, type, payload)
    values (r.reporter_id, 'report_ok',
            jsonb_build_object('item_id', r.target_id, 'note', note));
    if not exists (select 1 from public.profiles where id = r.reporter_id and role = 'admin') then
      insert into public.points_ledger (user_id, delta, reason)
      values (r.reporter_id, 10, 'report:' || r.id);
    end if;
  else
    -- Semnalare respinsă: explicația profesorului ajunge în mesagerie.
    insert into public.messages (sender_id, recipient_id, to_admin, body)
    values (auth.uid(), r.reporter_id, false,
            coalesce(note, 'Am verificat itemul semnalat și mi se pare corect așa cum e.'));
  end if;
end; $$;

grant execute on function public.resolve_test_report(uuid, boolean, text) to authenticated;

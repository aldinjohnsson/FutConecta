-- Editar/excluir quadra e perfis: quadra (nome público), empresa (nome empresarial) e atleta.

alter table public.institutions add column if not exists legal_name text;   -- nome empresarial
alter table public.profiles add column if not exists athlete_name text;     -- nome de atleta (competições)

create or replace function public.update_institution(
  _id uuid, _name text, _legal_name text, _city text, _address text, _phone text, _description text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from institutions where id = _id and owner_id = auth.uid()) then
    raise exception 'sem permissão nesta quadra';
  end if;
  if coalesce(trim(_name), '') = '' or coalesce(trim(_city), '') = '' then
    raise exception 'informe o nome e a cidade';
  end if;
  update institutions
     set name = trim(_name), legal_name = nullif(trim(_legal_name), ''), city = trim(_city),
         address = nullif(trim(_address), ''), phone = nullif(trim(_phone), ''),
         description = nullif(trim(_description), '')
   where id = _id;
end $$;

create or replace function public.update_court(
  _id uuid, _name text, _sport text, _capacity int, _rules text,
  _commission_mode text, _offline_surcharge_bps int, _free_cancel_hours int
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from courts c join institutions i on i.id = c.institution_id
                  where c.id = _id and i.owner_id = auth.uid()) then
    raise exception 'sem permissão nesta quadra';
  end if;
  if coalesce(trim(_name), '') = '' or _capacity < 1 then raise exception 'dados da quadra inválidos'; end if;
  execute format(
    'update courts set name = %L, sport = %L, capacity = %s, rules = %L, commission_mode = %L, offline_surcharge_bps = %s, free_cancel_hours = %s where id = %L',
    trim(_name), coalesce(nullif(trim(_sport), ''), 'futebol'), _capacity, nullif(trim(_rules), ''),
    _commission_mode, _offline_surcharge_bps, _free_cancel_hours, _id);
end $$;

-- "Excluir" = desativar: some das listas e libera nada novo; recusa se há partida marcada
create or replace function public.delete_court(_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from courts c join institutions i on i.id = c.institution_id
                  where c.id = _id and i.owner_id = auth.uid()) then
    raise exception 'sem permissão nesta quadra';
  end if;
  if exists (
    select 1 from matches m join court_slots s on s.id = m.slot_id
     where m.court_id = _id and m.status::text = 'scheduled' and s.slot_date >= current_date
  ) then
    raise exception 'esta quadra tem partidas marcadas: cancele-as antes de excluir';
  end if;
  update court_availability_rules set active = false where court_id = _id;
  update court_slots set status = 'closed' where court_id = _id and status = 'open' and slot_date >= current_date;
  update courts set active = false where id = _id;
end $$;

create or replace function public.set_athlete_name(_name text) returns void
language sql security definer set search_path = public as $$
  update profiles set athlete_name = nullif(trim(_name), '') where id = auth.uid();
$$;

grant execute on function public.update_institution(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.update_court(uuid,text,text,int,text,text,int,int) to authenticated;
grant execute on function public.delete_court(uuid) to authenticated;
grant execute on function public.set_athlete_name(text) to authenticated;

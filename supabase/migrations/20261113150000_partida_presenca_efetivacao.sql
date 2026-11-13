-- Presença, efetivação e cancelamento da partida.
--  * confirm_presence: o convidado confirma que vai (pagamento só depois do jogo)
--  * lock_match ("efetivar"): confirma que a partida vai acontecer; depois disso ninguém cancela a vaga
--  * cancel_match: o organizador cancela a partida, só se ainda não há quórum e não foi efetivada

alter table public.matches add column if not exists confirmed_at timestamptz;
alter table public.matches add column if not exists min_players int;  -- quórum; vazio = todas as vagas de linha

create or replace function public.match_quorum(_match uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(min_players, line_slots) from matches where id = _match;
$$;

create or replace function public.confirmed_count(_match uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from match_participants
   where match_id = _match and kind = 'line' and status in ('confirmed','attended','no_show');
$$;

create or replace function public.confirm_presence(_participant uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p record; mstatus text;
begin
  select * into p from match_participants where id = _participant;
  if not found or p.user_id is distinct from auth.uid() then raise exception 'vaga não encontrada'; end if;
  select status::text into mstatus from matches where id = p.match_id;
  if mstatus <> 'scheduled' then raise exception 'esta partida não está mais aberta'; end if;
  if p.status = 'confirmed' then return; end if;
  if p.status <> 'reserved' or (p.hold_expires_at is not null and p.hold_expires_at <= now()) then
    raise exception 'a reserva desta vaga expirou';
  end if;
  update match_participants set status = 'confirmed', hold_expires_at = null where id = _participant;
end $$;

create or replace function public.lock_match(_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if not can_manage_match(_match) then raise exception 'só quem organiza a partida pode efetivar'; end if;
  select * into m from matches where id = _match for update;
  if m.status::text <> 'scheduled' then raise exception 'esta partida não está mais aberta'; end if;
  if m.confirmed_at is not null then return; end if;
  if confirmed_count(_match) < match_quorum(_match) then
    raise exception 'ainda não há confirmados suficientes (%)', match_quorum(_match);
  end if;
  update matches set confirmed_at = now() where id = _match;
end $$;

create or replace function public.cancel_match(_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if not can_manage_match(_match) then raise exception 'só quem organiza a partida pode cancelar'; end if;
  select * into m from matches where id = _match for update;
  if m.status::text <> 'scheduled' then raise exception 'esta partida não está mais aberta'; end if;
  if m.confirmed_at is not null then raise exception 'partida efetivada: não é possível cancelar'; end if;
  if confirmed_count(_match) >= match_quorum(_match) then
    raise exception 'já há quórum: efetive a partida em vez de cancelar';
  end if;
  update match_participants set status = 'cancelled'
   where match_id = _match and status in ('reserved','confirmed');
  update matches set status = 'cancelled' where id = _match;
end $$;

-- depois de efetivada, ninguém cancela a própria vaga (só o dono da quadra)
create or replace function public.block_cancel_when_locked() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record; _owner uuid;
begin
  if new.status <> 'cancelled' or old.status not in ('reserved','confirmed') then return new; end if;
  select confirmed_at, status::text as st, institution_id into m from matches where id = new.match_id;
  if m.confirmed_at is null or m.st <> 'scheduled' then return new; end if;
  select owner_id into _owner from institutions where id = m.institution_id;
  if _owner is not distinct from auth.uid() then return new; end if;
  raise exception 'partida efetivada: não é possível cancelar a vaga';
end $$;

drop trigger if exists trg_block_cancel_when_locked on public.match_participants;
create trigger trg_block_cancel_when_locked
  before update of status on public.match_participants
  for each row execute function public.block_cancel_when_locked();

grant execute on function public.confirm_presence(uuid) to authenticated;
grant execute on function public.lock_match(uuid) to authenticated;
grant execute on function public.cancel_match(uuid) to authenticated;

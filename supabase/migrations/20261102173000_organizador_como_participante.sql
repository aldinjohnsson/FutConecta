-- Organizador conta como 1 participante + "entrar" sem erro de chave duplicada.
-- Rode no SQL Editor do Supabase (de preferência primeiro no projeto de testes).
--
-- Problema: uq_participant_user_active (match_id, user_id) conta status 'reserved' mesmo
-- depois que hold_expires_at venceu, mas a tela ignora reservas vencidas. Resultado: a pessoa
-- parece não estar na partida e, ao clicar em "Entrar", recebe "duplicate key value".

-- 1) create_match: o organizador já entra como participante --------------------------------
create or replace function public.create_match(
  _slot uuid,
  _title text,
  _line_slots integer,
  _goalkeeper_slots integer,
  _line_price_cents integer,
  _goalkeeper_price_cents integer,
  _accepts_app boolean default true,
  _accepts_manual boolean default true,
  _payment_deadline timestamp with time zone default null::timestamp with time zone,
  _rules text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare s court_slots; c courts; _id uuid; _org_kind slot_kind;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select * into s from court_slots where id = _slot for update;
  if s.id is null then raise exception 'horário inexistente'; end if;
  if s.status <> 'open' then raise exception 'horário indisponível'; end if;
  select * into c from courts where id = s.court_id;

  if not (manages_institution(c.institution_id) or s.organizer_booking) then
    raise exception 'este horário não está aberto para organizadores';
  end if;
  if _line_slots + _goalkeeper_slots > s.max_players then
    raise exception 'excede o máximo de % jogadores do horário', s.max_players;
  end if;

  insert into matches (slot_id, court_id, institution_id, organizer_id, title, rules,
    line_slots, goalkeeper_slots, line_price_cents, goalkeeper_price_cents,
    accepts_app_payment, accepts_manual_payment, payment_deadline)
  values (_slot, c.id, c.institution_id, auth.uid(), _title, _rules,
    _line_slots, _goalkeeper_slots, _line_price_cents, _goalkeeper_price_cents,
    _accepts_app, _accepts_manual, _payment_deadline)
  returning id into _id;

  -- o organizador ocupa a primeira vaga (linha; se não houver, goleiro).
  -- hold_expires_at nulo = a reserva dele não vence; ele paga como qualquer jogador.
  -- (Para o organizador não pagar pelo app, troque 'reserved' por 'confirmed'.)
  if _line_slots >= 1 then
    _org_kind := 'line';
  elsif _goalkeeper_slots >= 1 then
    _org_kind := 'goalkeeper';
  end if;
  if _org_kind is not null then
    insert into match_participants (match_id, user_id, kind, status, hold_expires_at, added_by)
    values (_id, auth.uid(), _org_kind, 'reserved', null, auth.uid());
  end if;

  update court_slots set status = 'booked' where id = _slot;
  return _id;
end $function$;

-- 2) join_match: libera reserva vencida do próprio jogador e não falha se ele já está na partida
create or replace function public.join_match(
  _match uuid,
  _kind slot_kind default 'line'::slot_kind,
  _user uuid default null::uuid,
  _guest_name text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m matches; _cap integer; _target uuid; _id uuid;
  _hold integer; _waiting integer; _recent_cancel integer;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  -- trava a partida: serializa reservas concorrentes
  select * into m from matches where id = _match for update;
  if m.id is null or m.status <> 'scheduled' then raise exception 'partida indisponível'; end if;

  _target := case when _user is null and _guest_name is null then auth.uid() else _user end;
  if _target is not null and _target <> auth.uid() and not can_manage_match(_match) then
    -- terceiros só podem ser adicionados como convidados nomeados pelo próprio chamador
    raise exception 'sem permissão para adicionar este jogador';
  end if;
  if _target is null and _guest_name is null then raise exception 'informe o participante'; end if;

  if _target is not null then
    -- reserva vencida do próprio jogador não pode bloquear uma nova entrada
    update match_participants
       set status = 'cancelled'
     where match_id = _match and user_id = _target
       and status = 'reserved' and hold_expires_at is not null and hold_expires_at <= now();

    -- já tem vaga ativa: devolve a existente em vez de dar erro
    select id into _id from match_participants
     where match_id = _match and user_id = _target
       and status in ('reserved', 'confirmed', 'attended', 'no_show')
     limit 1;
    if _id is not null then return _id; end if;
  end if;

  _cap := case when _kind = 'goalkeeper' then m.goalkeeper_slots else m.line_slots end;
  if seats_taken(_match, _kind) >= _cap then
    raise exception 'sem vagas disponíveis';
  end if;

  -- antifraude: quem cancelou não fura a fila de espera
  if _target is not null then
    select count(*) into _recent_cancel from cancellations
      where match_id = _match and user_id = _target;
    select count(*) into _waiting from waitlist_entries
      where match_id = _match and kind = _kind and status in ('waiting', 'offered') and user_id <> _target;
    if _recent_cancel > 0 and _waiting > 0 then
      raise exception 'você cancelou esta partida; entre na lista de espera';
    end if;
  end if;

  select hold_minutes into _hold from platform_settings;
  insert into match_participants (match_id, user_id, guest_name, kind, status, hold_expires_at, added_by)
  values (_match, _target, _guest_name, _kind, 'reserved', now() + make_interval(mins => _hold), auth.uid())
  returning id into _id;
  return _id;
end $function$;

-- 3) Partidas que já existem: coloca o organizador como participante ---------------------------
-- 3a) reserva do organizador que venceu e está bloqueando: reativa (sem prazo)
update match_participants mp
   set hold_expires_at = null
  from matches m
 where mp.match_id = m.id
   and mp.user_id = m.organizer_id
   and m.status = 'scheduled'
   and mp.status = 'reserved'
   and mp.hold_expires_at is not null
   and mp.hold_expires_at <= now();

-- 3b) organizador sem nenhuma participação ativa e com vaga livre: entra
insert into match_participants (match_id, user_id, kind, status, hold_expires_at, added_by)
select m.id, m.organizer_id,
       case when m.line_slots >= 1 then 'line'::slot_kind else 'goalkeeper'::slot_kind end,
       'reserved', null, m.organizer_id
  from matches m
 where m.status = 'scheduled'
   and (m.line_slots >= 1 or m.goalkeeper_slots >= 1)
   and not exists (
     select 1 from match_participants mp
      where mp.match_id = m.id and mp.user_id = m.organizer_id
        and mp.status in ('reserved', 'confirmed', 'attended', 'no_show')
   )
   and seats_taken(m.id, case when m.line_slots >= 1 then 'line'::slot_kind else 'goalkeeper'::slot_kind end)
       < case when m.line_slots >= 1 then m.line_slots else m.goalkeeper_slots end;

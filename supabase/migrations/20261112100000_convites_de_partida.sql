-- Convites de partida: o organizador (ou dono da quadra) convida um jogador disponível,
-- o jogador aceita ou recusa dentro do app. Ao aceitar, ele entra na partida.
-- Rode no SQL Editor do Supabase (depois da migration de disponibilidade).
--
-- Segurança: o app NÃO escreve na tabela diretamente. Toda escrita passa pelas funções abaixo,
-- que conferem quem está chamando (security definer).

-- 1) Tabela ---------------------------------------------------------------------------------------
create table if not exists public.match_invitations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  kind slot_kind not null default 'line',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- no máximo 1 convite pendente por jogador em cada partida
create unique index if not exists uq_invitation_pending
  on public.match_invitations (match_id, invited_user_id) where status = 'pending';
create index if not exists idx_invitation_user
  on public.match_invitations (invited_user_id, status);

alter table public.match_invitations enable row level security;

-- leitura: o convidado, quem convidou e quem gerencia a partida. Sem policy de escrita de propósito.
drop policy if exists match_invitations_select on public.match_invitations;
create policy match_invitations_select on public.match_invitations
  for select to authenticated
  using (invited_user_id = auth.uid() or invited_by = auth.uid() or public.can_manage_match(match_id));

-- 2) Enviar convite -------------------------------------------------------------------------------
create or replace function public.invite_player(_match uuid, _user uuid, _kind slot_kind default 'line')
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare m matches; _cap integer; _id uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;

  select * into m from matches where id = _match;
  if m.id is null or m.status <> 'scheduled' then raise exception 'partida indisponível'; end if;
  if not can_manage_match(_match) then raise exception 'só quem organiza a partida pode convidar'; end if;
  if _user = auth.uid() then raise exception 'você não pode convidar a si mesmo'; end if;

  if not exists (
    select 1 from profiles p
     where p.id = _user and p.available_to_play and p.suspended_at is null
  ) then
    raise exception 'este jogador não está mais disponível';
  end if;

  if exists (
    select 1 from match_participants
     where match_id = _match and user_id = _user
       and status in ('reserved', 'confirmed', 'attended', 'no_show')
  ) then
    raise exception 'este jogador já está na partida';
  end if;

  _cap := case when _kind = 'goalkeeper' then m.goalkeeper_slots else m.line_slots end;
  if _cap < 1 or seats_taken(_match, _kind) >= _cap then
    raise exception 'sem vagas disponíveis para essa posição';
  end if;

  begin
    insert into match_invitations (match_id, invited_user_id, invited_by, kind)
    values (_match, _user, auth.uid(), _kind)
    returning id into _id;
  exception when unique_violation then
    raise exception 'já existe um convite pendente para este jogador';
  end;
  return _id;
end $function$;

-- 3) Aceitar ou recusar (só o convidado) ----------------------------------------------------------
-- Ao aceitar, usa join_match: a vaga fica reservada e a pessoa paga/confirma na tela da partida.
create or replace function public.respond_invitation(_invitation uuid, _accept boolean)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare inv match_invitations;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;

  select * into inv from match_invitations where id = _invitation for update;
  if inv.id is null or inv.invited_user_id <> auth.uid() then
    raise exception 'convite não encontrado';
  end if;
  if inv.status <> 'pending' then
    raise exception 'este convite não está mais disponível';
  end if;

  if _accept then
    perform join_match(inv.match_id, inv.kind);  -- auth.uid() continua sendo o convidado
    update match_invitations set status = 'accepted', responded_at = now() where id = inv.id;
  else
    update match_invitations set status = 'declined', responded_at = now() where id = inv.id;
  end if;
  return inv.match_id;
end $function$;

-- 4) Cancelar convite pendente (quem convidou ou quem gerencia a partida) --------------------------
create or replace function public.cancel_invitation(_invitation uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare inv match_invitations;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select * into inv from match_invitations where id = _invitation for update;
  if inv.id is null then raise exception 'convite não encontrado'; end if;
  if not (inv.invited_by = auth.uid() or can_manage_match(inv.match_id)) then
    raise exception 'sem permissão';
  end if;
  if inv.status <> 'pending' then raise exception 'este convite não está mais pendente'; end if;
  update match_invitations set status = 'cancelled', responded_at = now() where id = inv.id;
end $function$;

-- 5) Convites que EU recebi (pendentes, de partidas futuras) -----------------------------------------
create or replace function public.list_my_invitations()
returns table (
  id uuid,
  match_id uuid,
  kind text,
  created_at timestamptz,
  title text,
  court_name text,
  institution_name text,
  slot_date text,
  start_time text,
  end_time text,
  inviter_name text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select i.id,
         i.match_id,
         i.kind::text,
         i.created_at,
         m.title,
         c.name,
         ins.name,
         s.slot_date::text,
         s.start_time::text,
         s.end_time::text,
         pr.full_name
    from match_invitations i
    join matches m on m.id = i.match_id
    join court_slots s on s.id = m.slot_id
    join courts c on c.id = m.court_id
    join institutions ins on ins.id = m.institution_id
    left join profiles pr on pr.id = i.invited_by
   where auth.uid() is not null
     and i.invited_user_id = auth.uid()
     and i.status = 'pending'
     and m.status = 'scheduled'
     and s.slot_date >= current_date
   order by s.slot_date, s.start_time;
$function$;

-- 6) Situação dos convites de uma partida (para quem gerencia): último status por jogador ---------
create or replace function public.list_match_invitations(_match uuid)
returns table (invited_user_id uuid, status text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select distinct on (i.invited_user_id) i.invited_user_id, i.status
    from match_invitations i
   where auth.uid() is not null
     and can_manage_match(_match)
     and i.match_id = _match
   order by i.invited_user_id, i.created_at desc;
$function$;

-- 7) Só usuários logados executam -------------------------------------------------------------------
revoke all on function public.invite_player(uuid, uuid, slot_kind) from public;
revoke all on function public.respond_invitation(uuid, boolean) from public;
revoke all on function public.cancel_invitation(uuid) from public;
revoke all on function public.list_my_invitations() from public;
revoke all on function public.list_match_invitations(uuid) from public;
grant execute on function public.invite_player(uuid, uuid, slot_kind) to authenticated;
grant execute on function public.respond_invitation(uuid, boolean) to authenticated;
grant execute on function public.cancel_invitation(uuid) to authenticated;
grant execute on function public.list_my_invitations() to authenticated;
grant execute on function public.list_match_invitations(uuid) to authenticated;

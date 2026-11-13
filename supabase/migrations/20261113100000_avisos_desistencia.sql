-- Avisos para quem gerencia a partida: quando um jogador desiste da própria vaga.

create table if not exists public.match_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- quem recebe o aviso
  match_id uuid not null references public.matches(id) on delete cascade,
  kind text not null default 'player_left',
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists match_notices_user_idx on public.match_notices (user_id, read_at, created_at desc);

alter table public.match_notices enable row level security;
drop policy if exists match_notices_select on public.match_notices;
create policy match_notices_select on public.match_notices for select using (user_id = auth.uid());
-- sem policy de insert/update: só as funções abaixo escrevem

create or replace function public.notify_player_left() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _m record; _who text; _owner uuid; _when text;
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then return new; end if;
  -- só quando a própria pessoa desiste (quem gerencia cancelando não gera aviso)
  if new.user_id is null or new.user_id <> auth.uid() then return new; end if;

  select m.id, m.title, m.organizer_id, m.institution_id, s.slot_date, s.start_time, c.name as court
    into _m
    from matches m
    join court_slots s on s.id = m.slot_id
    join courts c on c.id = m.court_id
   where m.id = new.match_id;
  if not found then return new; end if;

  select coalesce(nullif(full_name, ''), 'Um jogador') into _who from profiles where id = new.user_id;
  select owner_id into _owner from institutions where id = _m.institution_id;
  _when := to_char(_m.slot_date, 'DD/MM') || ' às ' || to_char(_m.start_time, 'HH24:MI');

  insert into match_notices (user_id, match_id, message)
  select distinct u, new.match_id,
         coalesce(_who, 'Um jogador') || ' desistiu da vaga em ' || _m.court || ' (' || _when || ').'
    from (values (_m.organizer_id), (_owner)) v(u)
   where u is not null and u <> new.user_id;
  return new;
end $$;

drop trigger if exists trg_notify_player_left on public.match_participants;
create trigger trg_notify_player_left
  after update of status on public.match_participants
  for each row execute function public.notify_player_left();

create or replace function public.list_my_notices()
returns table (id uuid, match_id uuid, message text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, match_id, message, created_at from match_notices
   where user_id = auth.uid() and read_at is null
   order by created_at desc limit 50;
$$;

create or replace function public.mark_notices_read() returns void
language sql security definer set search_path = public as $$
  update match_notices set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

grant execute on function public.list_my_notices() to authenticated;
grant execute on function public.mark_notices_read() to authenticated;

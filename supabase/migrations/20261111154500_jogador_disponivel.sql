-- "Estou disponível para jogo" + lista de jogadores disponíveis (Buscar Jogadores).
-- Rode no SQL Editor do Supabase (de preferência primeiro no projeto de testes).
--
-- Privacidade: a lista NÃO lê a tabela profiles diretamente pelo app. Ela passa por uma função
-- (security definer) que devolve só: nome, idade, cidade, posições, pé dominante, foto e recado.
-- Nunca devolve e-mail nem data de nascimento. Só aparece quem ligou a disponibilidade.

-- 1) Campos de disponibilidade no perfil --------------------------------------------------------
alter table public.profiles
  add column if not exists available_to_play boolean not null default false,
  add column if not exists available_since timestamptz,
  add column if not exists available_note text;

alter table public.profiles
  drop constraint if exists profiles_available_note_len;
alter table public.profiles
  add constraint profiles_available_note_len check (available_note is null or char_length(available_note) <= 140);

-- 2) Ligar/desligar a disponibilidade (e salvar o recado) ---------------------------------------
create or replace function public.set_availability(_available boolean, _note text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if _note is not null and char_length(btrim(_note)) > 140 then
    raise exception 'o recado pode ter no máximo 140 caracteres';
  end if;

  update profiles
     set available_to_play = _available,
         available_since   = case
                               when _available and not available_to_play then now()
                               when _available then available_since
                               else null
                             end,
         available_note    = case when _available then nullif(btrim(_note), '') else null end
   where id = auth.uid()
     and (suspended_at is null or not _available);  -- conta suspensa só pode desligar

  if not found then raise exception 'perfil indisponível'; end if;
end $function$;

-- 3) Lista de jogadores disponíveis (somente campos públicos) -----------------------------------
create or replace function public.list_available_players(_position text default null, _city text default null)
returns table (
  id uuid,
  full_name text,
  age integer,
  city text,
  positions text[],
  preferred_foot text,
  photo_url text,
  available_since timestamptz,
  available_note text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.id,
         p.full_name,
         case when p.birth_date is null then null
              else date_part('year', age(current_date, p.birth_date))::integer end,
         p.city,
         coalesce(p.positions::text[], '{}'::text[]),
         p.preferred_foot::text,
         p.photo_url,
         p.available_since,
         p.available_note
    from profiles p
   where auth.uid() is not null
     and p.available_to_play
     and p.suspended_at is null
     and p.id <> auth.uid()
     and (p.birth_date is null or p.birth_date <= (current_date - interval '18 years'))
     and (_position is null or _position = any (coalesce(p.positions::text[], '{}'::text[])))
     and (_city is null or btrim(_city) = '' or p.city ilike '%' || btrim(_city) || '%')
   order by p.available_since desc nulls last
   limit 200;
$function$;

-- 4) Só usuários logados executam -----------------------------------------------------------------
revoke all on function public.set_availability(boolean, text) from public;
revoke all on function public.list_available_players(text, text) from public;
grant execute on function public.set_availability(boolean, text) to authenticated;
grant execute on function public.list_available_players(text, text) to authenticated;

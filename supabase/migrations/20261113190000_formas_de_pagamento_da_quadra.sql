-- Formas de pagamento passam a ser definidas pelo dono da quadra (não por quem cria a partida).
alter table public.courts add column if not exists accepts_app_payment boolean not null default true;
alter table public.courts add column if not exists accepts_manual_payment boolean not null default true;

create or replace function public.set_court_payment_methods(_id uuid, _app boolean, _manual boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from courts c join institutions i on i.id = c.institution_id
                  where c.id = _id and i.owner_id = auth.uid()) then
    raise exception 'sem permissão nesta quadra';
  end if;
  if not _app and not _manual then raise exception 'escolha ao menos uma forma de pagamento'; end if;
  update courts set accepts_app_payment = _app, accepts_manual_payment = _manual where id = _id;
end $$;

grant execute on function public.set_court_payment_methods(uuid, boolean, boolean) to authenticated;

-- Concessao automatica do selo 'azul' ao atingir 100 mil fas (o unico criterio de selo que
-- e computavel hoje sem depender de contagem de views de stream ou de um fluxo de pagamento,
-- que ainda nao existem no produto). Nunca sobrescreve um selo ja concedido (ex: fundador,
-- manualmente atribuido), so preenche quando o perfil ainda nao tem nenhum selo.
create or replace function public.grant_verified_seal_if_eligible(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fans_count integer;
begin
  if target_user_id is null then
    return;
  end if;

  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Cannot check seal eligibility for another user';
  end if;

  select count(*) into fans_count
  from public.user_relationships
  where following_id = target_user_id;

  if fans_count >= 100000 then
    insert into public.profile_verified_seals (user_id, seal, granted_reason)
    values (target_user_id, 'azul', 'Atingiu 100 mil fas')
    on conflict (user_id) do nothing;
  end if;
end;
$$;

revoke execute on function public.grant_verified_seal_if_eligible(uuid) from public;
revoke execute on function public.grant_verified_seal_if_eligible(uuid) from anon;
grant execute on function public.grant_verified_seal_if_eligible(uuid) to authenticated;

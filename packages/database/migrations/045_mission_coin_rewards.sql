alter table public.mission_definitions add column if not exists coin_reward integer not null default 0;

update public.mission_definitions set coin_reward = case slug
  when 'daily_create_flow' then 5
  when 'daily_create_moments' then 5
  when 'daily_create_wave' then 4
  when 'weekly_7_days' then 25
  when 'weekly_join_5_communities' then 20
  when 'weekly_invite_10_friends' then 30
  when 'weekly_overachieve_500' then 100
  else coin_reward
end;

-- Mesma funcao de 030_user_mission_progress.sql, so acrescentando a concessao de Fluxo Coin e
-- notificacao de recompensa junto com o XP/aura que ja era concedido ao completar a missao.
create or replace function public.increment_mission_progress(
  target_user_id uuid,
  mission_slug text,
  increment_by integer default 1,
  progress_metadata jsonb default '{}'::jsonb
)
returns public.user_mission_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  mission_row public.mission_definitions;
  period text;
  progress_row public.user_mission_progress;
  was_completed boolean;
begin
  if target_user_id is null or mission_slug is null then
    raise exception 'target_user_id and mission_slug are required';
  end if;

  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Cannot increment mission for another user';
  end if;

  if increment_by is null or increment_by <= 0 then
    raise exception 'increment_by must be positive';
  end if;

  select *
  into mission_row
  from public.mission_definitions
  where slug = mission_slug
    and is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now());

  if mission_row.id is null then
    raise exception 'Mission not found: %', mission_slug;
  end if;

  period := public.ocean_mission_period_key(mission_row.cadence);

  insert into public.user_mission_progress (
    user_id, mission_id, period_key, current_value, target_value, metadata
  )
  values (
    target_user_id, mission_row.id, period, 0, mission_row.target_value, progress_metadata
  )
  on conflict (user_id, mission_id, period_key) do nothing;

  select *
  into progress_row
  from public.user_mission_progress
  where user_id = target_user_id
    and mission_id = mission_row.id
    and period_key = period
  for update;

  was_completed := progress_row.is_completed;

  update public.user_mission_progress
  set
    current_value = current_value + increment_by,
    is_completed = case when current_value + increment_by >= target_value then true else is_completed end,
    completed_at = case
      when completed_at is null and current_value + increment_by >= target_value then now()
      else completed_at
    end,
    metadata = user_mission_progress.metadata || coalesce(progress_metadata, '{}'::jsonb),
    updated_at = now()
  where id = progress_row.id
  returning * into progress_row;

  if progress_row.is_completed and not was_completed and not progress_row.reward_claimed then
    if mission_row.xp_reward > 0 then
      perform public.add_user_xp(target_user_id, mission_row.xp_reward, mission_row.slug, progress_metadata);
    end if;

    if mission_row.aura_reward_slug is not null then
      perform public.grant_user_aura(target_user_id, mission_row.aura_reward_slug, 'mission', mission_row.slug);
    end if;

    if mission_row.coin_reward > 0 then
      perform public.add_user_coins(target_user_id, mission_row.coin_reward, 'mission_reward', mission_row.title);
    end if;

    perform public.create_notification(
      target_user_id, 'mission_reward', null, null, mission_row.title
    );

    update public.user_mission_progress
    set reward_claimed = true,
        reward_claimed_at = now(),
        updated_at = now()
    where id = progress_row.id
    returning * into progress_row;
  end if;

  return progress_row;
end;
$$;

revoke execute on function public.increment_mission_progress(uuid, text, integer, jsonb) from public;
revoke execute on function public.increment_mission_progress(uuid, text, integer, jsonb) from anon;
grant execute on function public.increment_mission_progress(uuid, text, integer, jsonb) to authenticated;

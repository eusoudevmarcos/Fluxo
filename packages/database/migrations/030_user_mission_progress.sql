create table if not exists public.user_mission_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.mission_definitions(id) on delete cascade,
  period_key text not null,
  current_value integer not null default 0,
  target_value integer not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  reward_claimed boolean not null default false,
  reward_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint user_mission_progress_unique_period unique (user_id, mission_id, period_key)
);

create index if not exists user_mission_progress_user_id_idx on public.user_mission_progress(user_id);
create index if not exists user_mission_progress_mission_id_idx on public.user_mission_progress(mission_id);
create index if not exists user_mission_progress_period_idx on public.user_mission_progress(period_key);

alter table public.user_mission_progress enable row level security;

drop policy if exists "users can read own mission progress" on public.user_mission_progress;

create policy "users can read own mission progress"
on public.user_mission_progress for select
using (user_id = auth.uid());

create or replace function public.ocean_mission_period_key(cadence text)
returns text
language sql
stable
as $$
  select case
    when cadence = 'daily' then to_char(current_date, 'YYYY-MM-DD')
    when cadence = 'weekly' then to_char(current_date, 'IYYY-"W"IW')
    when cadence = 'monthly' then to_char(current_date, 'YYYY-MM')
    when cadence = 'seasonal' then to_char(current_date, 'YYYY-"S"Q')
    else 'once'
  end;
$$;

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

create or replace function public.claim_mission_reward(progress_id uuid)
returns public.user_mission_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  progress_row public.user_mission_progress;
  mission_row public.mission_definitions;
begin
  select *
  into progress_row
  from public.user_mission_progress
  where id = progress_id
  for update;

  if progress_row.id is null then
    raise exception 'Mission progress not found';
  end if;

  if auth.uid() is not null and auth.uid() <> progress_row.user_id then
    raise exception 'Cannot claim another user mission';
  end if;

  if not progress_row.is_completed then
    raise exception 'Mission not completed';
  end if;

  if progress_row.reward_claimed then
    return progress_row;
  end if;

  select *
  into mission_row
  from public.mission_definitions
  where id = progress_row.mission_id;

  if mission_row.xp_reward > 0 then
    perform public.add_user_xp(progress_row.user_id, mission_row.xp_reward, mission_row.slug, progress_row.metadata);
  end if;

  if mission_row.aura_reward_slug is not null then
    perform public.grant_user_aura(progress_row.user_id, mission_row.aura_reward_slug, 'mission', mission_row.slug);
  end if;

  update public.user_mission_progress
  set reward_claimed = true,
      reward_claimed_at = now(),
      updated_at = now()
  where id = progress_row.id
  returning * into progress_row;

  return progress_row;
end;
$$;

revoke execute on function public.claim_mission_reward(uuid) from public;
revoke execute on function public.claim_mission_reward(uuid) from anon;
grant execute on function public.claim_mission_reward(uuid) to authenticated;

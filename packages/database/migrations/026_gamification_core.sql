create table if not exists public.user_gamification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  level integer not null default 1,
  xp_total bigint not null default 0,
  xp_current_level bigint not null default 0,
  xp_next_level bigint not null default 1000,
  weekly_xp bigint not null default 0,
  monthly_xp bigint not null default 0,
  streak_days integer not null default 0,
  last_active_date date,
  is_founder boolean not null default false,
  is_official_profile boolean not null default false,
  has_all_auras boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_gamification_level_check') then
    alter table public.user_gamification
    add constraint user_gamification_level_check check (level between 1 and 9999);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_gamification_xp_check') then
    alter table public.user_gamification
    add constraint user_gamification_xp_check check (
      xp_total >= 0
      and xp_current_level >= 0
      and xp_next_level > 0
      and weekly_xp >= 0
      and monthly_xp >= 0
      and streak_days >= 0
    );
  end if;
end $$;

create index if not exists user_gamification_user_id_idx on public.user_gamification(user_id);
create index if not exists user_gamification_level_idx on public.user_gamification(level desc);

alter table public.user_gamification enable row level security;

drop policy if exists "users can read own gamification" on public.user_gamification;
drop policy if exists "users can insert own gamification shell" on public.user_gamification;

create policy "users can read own gamification"
on public.user_gamification for select
using (user_id = auth.uid());

create policy "users can insert own gamification shell"
on public.user_gamification for insert
with check (
  user_id = auth.uid()
  and level = 1
  and xp_total = 0
  and xp_current_level = 0
  and weekly_xp = 0
  and monthly_xp = 0
  and is_founder = false
  and is_official_profile = false
  and has_all_auras = false
);

create or replace function public.ensure_user_gamification(target_user_id uuid)
returns public.user_gamification
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.user_gamification;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Cannot ensure gamification for another user';
  end if;

  insert into public.user_gamification (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  select *
  into result_row
  from public.user_gamification
  where user_id = target_user_id;

  return result_row;
end;
$$;

revoke execute on function public.ensure_user_gamification(uuid) from public;
revoke execute on function public.ensure_user_gamification(uuid) from anon;
grant execute on function public.ensure_user_gamification(uuid) to authenticated;

create or replace function public.add_user_xp(
  target_user_id uuid,
  amount integer,
  reason text,
  metadata jsonb default '{}'::jsonb
)
returns public.user_gamification
language plpgsql
security definer
set search_path = public
as $$
declare
  gamification_row public.user_gamification;
  next_level integer;
  next_current bigint;
  next_required bigint;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Cannot add XP for another user';
  end if;

  if amount is null or amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  perform public.ensure_user_gamification(target_user_id);

  select *
  into gamification_row
  from public.user_gamification
  where user_id = target_user_id
  for update;

  if gamification_row.is_founder then
    update public.user_gamification
    set
      level = 9999,
      xp_total = greatest(xp_total + amount, 999999999),
      xp_current_level = 0,
      xp_next_level = 999999999,
      weekly_xp = weekly_xp + amount,
      monthly_xp = monthly_xp + amount,
      last_active_date = current_date,
      updated_at = now()
    where user_id = target_user_id
    returning * into gamification_row;

    return gamification_row;
  end if;

  next_level := gamification_row.level;
  next_current := gamification_row.xp_current_level + amount;
  next_required := greatest(gamification_row.xp_next_level, next_level * 1000);

  while next_current >= next_required and next_level < 9999 loop
    next_current := next_current - next_required;
    next_level := next_level + 1;
    next_required := next_level * 1000;
  end loop;

  update public.user_gamification
  set
    level = least(next_level, 9999),
    xp_total = xp_total + amount,
    xp_current_level = case when next_level >= 9999 then 0 else next_current end,
    xp_next_level = case when next_level >= 9999 then 999999999 else next_required end,
    weekly_xp = weekly_xp + amount,
    monthly_xp = monthly_xp + amount,
    streak_days = case
      when last_active_date = current_date then streak_days
      when last_active_date = current_date - interval '1 day' then streak_days + 1
      else 1
    end,
    last_active_date = current_date,
    updated_at = now()
  where user_id = target_user_id
  returning * into gamification_row;

  return gamification_row;
end;
$$;

revoke execute on function public.add_user_xp(uuid, integer, text, jsonb) from public;
revoke execute on function public.add_user_xp(uuid, integer, text, jsonb) from anon;
revoke execute on function public.add_user_xp(uuid, integer, text, jsonb) from authenticated;

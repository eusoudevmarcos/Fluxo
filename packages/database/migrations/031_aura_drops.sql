create table if not exists public.aura_drops (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  drop_month text not null,
  total_common integer not null default 30,
  total_special integer not null default 5,
  total_rare integer not null default 5,
  total_secret integer not null default 2,
  special_period_months integer not null default 1,
  rare_period_months integer not null default 2,
  secret_period_months integer not null default 5,
  status text not null default 'scheduled',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aura_drops_status_check') then
    alter table public.aura_drops
    add constraint aura_drops_status_check check (status in ('scheduled', 'active', 'ended'));
  end if;
end $$;

create table if not exists public.aura_drop_rewards (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.aura_drops(id) on delete cascade,
  aura_id uuid not null references public.aura_definitions(id) on delete cascade,
  rarity text not null,
  supply_limit integer,
  awarded_count integer not null default 0,
  condition jsonb not null default '{}'::jsonb
);

create table if not exists public.user_aura_drop_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  drop_id uuid not null references public.aura_drops(id) on delete cascade,
  reward_id uuid not null references public.aura_drop_rewards(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  rank_position integer,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists aura_drops_status_idx on public.aura_drops(status);
create index if not exists aura_drops_month_idx on public.aura_drops(drop_month);
create index if not exists aura_drop_rewards_drop_id_idx on public.aura_drop_rewards(drop_id);
create index if not exists user_aura_drop_awards_user_id_idx on public.user_aura_drop_awards(user_id);

alter table public.aura_drops enable row level security;
alter table public.aura_drop_rewards enable row level security;
alter table public.user_aura_drop_awards enable row level security;

drop policy if exists "active aura drops are public" on public.aura_drops;
drop policy if exists "active aura drop rewards are public" on public.aura_drop_rewards;
drop policy if exists "users can read own aura drop awards" on public.user_aura_drop_awards;

create policy "active aura drops are public"
on public.aura_drops for select
using (status in ('scheduled', 'active'));

create policy "active aura drop rewards are public"
on public.aura_drop_rewards for select
using (
  exists (
    select 1 from public.aura_drops
    where aura_drops.id = aura_drop_rewards.drop_id
      and aura_drops.status in ('scheduled', 'active')
  )
);

create policy "users can read own aura drop awards"
on public.user_aura_drop_awards for select
using (user_id = auth.uid());

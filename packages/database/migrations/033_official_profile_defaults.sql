create table if not exists public.official_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  kind text not null,
  is_default_follow boolean not null default false,
  is_founder boolean not null default false,
  label text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'official_accounts_kind_check') then
    alter table public.official_accounts
    add constraint official_accounts_kind_check
    check (kind in ('founder', 'company', 'updates'));
  end if;
end $$;

create table if not exists public.user_relationships (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint user_relationships_unique_pair unique (follower_id, following_id),
  constraint user_relationships_not_self check (follower_id <> following_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_relationships_source_check') then
    alter table public.user_relationships
    add constraint user_relationships_source_check
    check (source in ('manual', 'default_official', 'onboarding'));
  end if;
end $$;

create index if not exists official_accounts_user_id_idx on public.official_accounts(user_id);
create index if not exists official_accounts_default_follow_idx on public.official_accounts(is_default_follow);
create index if not exists user_relationships_follower_id_idx on public.user_relationships(follower_id);
create index if not exists user_relationships_following_id_idx on public.user_relationships(following_id);

alter table public.official_accounts enable row level security;
alter table public.user_relationships enable row level security;

drop policy if exists "official accounts are public" on public.official_accounts;
drop policy if exists "relationships are publicly readable" on public.user_relationships;
drop policy if exists "users can create own relationships" on public.user_relationships;
drop policy if exists "users can remove own relationships" on public.user_relationships;

create policy "official accounts are public"
on public.official_accounts for select
using (true);

create policy "relationships are publicly readable"
on public.user_relationships for select
using (true);

create policy "users can create own relationships"
on public.user_relationships for insert
with check (follower_id = auth.uid());

create policy "users can remove own relationships"
on public.user_relationships for delete
using (follower_id = auth.uid());

create or replace function public.apply_founder_entitlements(target_user_id uuid)
returns public.user_gamification
language plpgsql
security definer
set search_path = public
as $$
declare
  aura_record record;
  result_row public.user_gamification;
  first_aura_slug text;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  perform public.ensure_user_gamification(target_user_id);

  update public.user_gamification
  set
    is_founder = true,
    is_official_profile = true,
    has_all_auras = true,
    level = 9999,
    xp_total = 999999999,
    xp_current_level = 0,
    xp_next_level = 999999999,
    updated_at = now()
  where user_id = target_user_id
  returning * into result_row;

  for aura_record in
    select slug from public.aura_definitions where is_active = true order by created_at asc
  loop
    perform public.grant_user_aura(target_user_id, aura_record.slug, 'founder', 'Fundador Ocean');
  end loop;

  select slug
  into first_aura_slug
  from public.aura_definitions
  where is_active = true
  order by case when rarity = 'legendary' then 0 when rarity = 'secret' then 1 else 2 end, created_at asc
  limit 1;

  if first_aura_slug is not null then
    perform public.equip_user_aura(target_user_id, first_aura_slug);
  end if;

  return result_row;
end;
$$;

revoke execute on function public.apply_founder_entitlements(uuid) from public;
revoke execute on function public.apply_founder_entitlements(uuid) from anon;
revoke execute on function public.apply_founder_entitlements(uuid) from authenticated;

create or replace function public.apply_default_official_follows(new_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if new_user_id is null then
    raise exception 'new_user_id is required';
  end if;

  if auth.uid() is not null and auth.uid() <> new_user_id then
    raise exception 'Cannot apply default follows for another user';
  end if;

  insert into public.user_relationships (follower_id, following_id, source)
  select new_user_id, official_accounts.user_id, 'default_official'
  from public.official_accounts
  where official_accounts.is_default_follow = true
    and official_accounts.user_id <> new_user_id
  on conflict (follower_id, following_id) do nothing;

  get diagnostics inserted_count = row_count;

  return inserted_count;
end;
$$;

revoke execute on function public.apply_default_official_follows(uuid) from public;
revoke execute on function public.apply_default_official_follows(uuid) from anon;
grant execute on function public.apply_default_official_follows(uuid) to authenticated;

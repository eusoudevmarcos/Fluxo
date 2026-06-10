create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badge_definitions(id) on delete cascade,
  is_equipped boolean not null default false,
  granted_by uuid references auth.users(id) on delete set null,
  source text not null default 'system',
  granted_reason text,
  unlocked_at timestamptz not null default now(),
  equipped_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint user_badges_unique_user_badge unique (user_id, badge_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_badges_source_check') then
    alter table public.user_badges
    add constraint user_badges_source_check
    check (source in ('purchase', 'mission', 'engagement', 'founder', 'manual', 'system', 'verification_review'));
  end if;
end $$;

create index if not exists user_badges_user_id_idx on public.user_badges(user_id);
create index if not exists user_badges_badge_id_idx on public.user_badges(badge_id);
create index if not exists user_badges_equipped_idx on public.user_badges(user_id, is_equipped);

alter table public.user_badges enable row level security;

drop policy if exists "users can read own badges" on public.user_badges;
drop policy if exists "users can equip own badges" on public.user_badges;

create policy "users can read own badges"
on public.user_badges for select
using (user_id = auth.uid());

create policy "users can equip own badges"
on public.user_badges for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.grant_user_badge(
  target_user_id uuid,
  badge_slug text,
  source text default 'manual',
  reason text default null
)
returns public.user_badges
language plpgsql
security definer
set search_path = public
as $$
declare
  badge_row public.badge_definitions;
  result_row public.user_badges;
begin
  if target_user_id is null or badge_slug is null then
    raise exception 'target_user_id and badge_slug are required';
  end if;

  if source not in ('purchase', 'mission', 'engagement', 'founder', 'manual', 'system', 'verification_review') then
    raise exception 'Invalid badge source';
  end if;

  select *
  into badge_row
  from public.badge_definitions
  where slug = badge_slug
    and is_active = true;

  if badge_row.id is null then
    raise exception 'Badge not found: %', badge_slug;
  end if;

  insert into public.user_badges (user_id, badge_id, source, granted_reason)
  values (target_user_id, badge_row.id, source, reason)
  on conflict (user_id, badge_id) do update set
    granted_reason = coalesce(excluded.granted_reason, public.user_badges.granted_reason),
    metadata = public.user_badges.metadata
  returning * into result_row;

  return result_row;
end;
$$;

revoke execute on function public.grant_user_badge(uuid, text, text, text) from public;
revoke execute on function public.grant_user_badge(uuid, text, text, text) from anon;
revoke execute on function public.grant_user_badge(uuid, text, text, text) from authenticated;

create or replace function public.equip_user_badge(target_user_id uuid, badge_slug text)
returns public.user_badges
language plpgsql
security definer
set search_path = public
as $$
declare
  badge_row public.badge_definitions;
  owns_badge boolean;
  result_row public.user_badges;
begin
  if target_user_id is null or badge_slug is null then
    raise exception 'target_user_id and badge_slug are required';
  end if;

  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Cannot equip badge for another user';
  end if;

  select *
  into badge_row
  from public.badge_definitions
  where slug = badge_slug
    and is_active = true;

  if badge_row.id is null then
    raise exception 'Badge not found: %', badge_slug;
  end if;

  select exists (
    select 1 from public.user_badges
    where user_id = target_user_id
      and badge_id = badge_row.id
  ) into owns_badge;

  if not owns_badge then
    raise exception 'User does not own this badge';
  end if;

  update public.user_badges
  set is_equipped = false,
      equipped_at = null
  where user_id = target_user_id;

  update public.user_badges
  set is_equipped = true,
      equipped_at = now()
  where user_id = target_user_id
    and badge_id = badge_row.id
  returning * into result_row;

  return result_row;
end;
$$;

revoke execute on function public.equip_user_badge(uuid, text) from public;
revoke execute on function public.equip_user_badge(uuid, text) from anon;
grant execute on function public.equip_user_badge(uuid, text) to authenticated;

create or replace view public.public_equipped_badges as
select
  user_badges.user_id,
  badge_definitions.slug as badge_slug,
  badge_definitions.name as badge_name,
  badge_definitions.category,
  badge_definitions.rarity,
  badge_definitions.color_primary,
  badge_definitions.color_secondary,
  badge_definitions.visual_config
from public.user_badges
join public.badge_definitions on badge_definitions.id = user_badges.badge_id
where user_badges.is_equipped = true
  and badge_definitions.is_active = true;

create or replace function public.apply_founder_badge(target_user_id uuid)
returns public.user_badges
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.user_badges;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  perform public.grant_user_badge(target_user_id, 'badge-founder', 'founder', 'Fundador Ocean');
  select * into result_row from public.equip_user_badge(target_user_id, 'badge-founder');

  return result_row;
end;
$$;

revoke execute on function public.apply_founder_badge(uuid) from public;
revoke execute on function public.apply_founder_badge(uuid) from anon;
revoke execute on function public.apply_founder_badge(uuid) from authenticated;

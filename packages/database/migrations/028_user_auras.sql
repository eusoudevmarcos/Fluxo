create table if not exists public.user_auras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  aura_id uuid not null references public.aura_definitions(id) on delete cascade,
  source text not null default 'mission',
  unlocked_at timestamptz not null default now(),
  equipped_at timestamptz,
  is_equipped boolean not null default false,
  grant_reason text,
  granted_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  constraint user_auras_unique_user_aura unique (user_id, aura_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_auras_source_check') then
    alter table public.user_auras
    add constraint user_auras_source_check
    check (source in ('mission', 'level', 'drop', 'gift', 'founder', 'milestone', 'secret'));
  end if;
end $$;

create index if not exists user_auras_user_id_idx on public.user_auras(user_id);
create index if not exists user_auras_aura_id_idx on public.user_auras(aura_id);
create index if not exists user_auras_equipped_idx on public.user_auras(user_id, is_equipped);

alter table public.user_auras enable row level security;

drop policy if exists "users can read own auras" on public.user_auras;
drop policy if exists "users can equip own auras" on public.user_auras;

create policy "users can read own auras"
on public.user_auras for select
using (user_id = auth.uid());

create policy "users can equip own auras"
on public.user_auras for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.grant_user_aura(
  target_user_id uuid,
  aura_slug text,
  source text default 'mission',
  reason text default null
)
returns public.user_auras
language plpgsql
security definer
set search_path = public
as $$
declare
  aura_row public.aura_definitions;
  result_row public.user_auras;
begin
  if target_user_id is null or aura_slug is null then
    raise exception 'target_user_id and aura_slug are required';
  end if;

  select *
  into aura_row
  from public.aura_definitions
  where slug = aura_slug
    and is_active = true;

  if aura_row.id is null then
    raise exception 'Aura not found: %', aura_slug;
  end if;

  insert into public.user_auras (user_id, aura_id, source, grant_reason)
  values (target_user_id, aura_row.id, source, reason)
  on conflict (user_id, aura_id) do update set
    grant_reason = coalesce(excluded.grant_reason, public.user_auras.grant_reason),
    metadata = public.user_auras.metadata
  returning * into result_row;

  return result_row;
end;
$$;

revoke execute on function public.grant_user_aura(uuid, text, text, text) from public;
revoke execute on function public.grant_user_aura(uuid, text, text, text) from anon;
revoke execute on function public.grant_user_aura(uuid, text, text, text) from authenticated;

create or replace function public.equip_user_aura(target_user_id uuid, aura_slug text)
returns public.user_auras
language plpgsql
security definer
set search_path = public
as $$
declare
  aura_row public.aura_definitions;
  owns_aura boolean;
  has_all boolean;
  result_row public.user_auras;
begin
  if target_user_id is null or aura_slug is null then
    raise exception 'target_user_id and aura_slug are required';
  end if;

  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Cannot equip aura for another user';
  end if;

  select *
  into aura_row
  from public.aura_definitions
  where slug = aura_slug
    and is_active = true;

  if aura_row.id is null then
    raise exception 'Aura not found: %', aura_slug;
  end if;

  select coalesce(has_all_auras, false)
  into has_all
  from public.user_gamification
  where user_id = target_user_id;

  select exists (
    select 1 from public.user_auras
    where user_id = target_user_id
      and aura_id = aura_row.id
  ) into owns_aura;

  if not owns_aura and not coalesce(has_all, false) then
    raise exception 'User does not own this aura';
  end if;

  if not owns_aura and coalesce(has_all, false) then
    perform public.grant_user_aura(target_user_id, aura_slug, 'founder', 'has_all_auras entitlement');
  end if;

  update public.user_auras
  set is_equipped = false,
      equipped_at = null
  where user_id = target_user_id;

  update public.user_auras
  set is_equipped = true,
      equipped_at = now()
  where user_id = target_user_id
    and aura_id = aura_row.id
  returning * into result_row;

  return result_row;
end;
$$;

revoke execute on function public.equip_user_aura(uuid, text) from public;
revoke execute on function public.equip_user_aura(uuid, text) from anon;
grant execute on function public.equip_user_aura(uuid, text) to authenticated;

create or replace view public.public_equipped_auras as
select
  user_auras.user_id,
  aura_definitions.slug as aura_slug,
  aura_definitions.name as aura_name,
  aura_definitions.rarity,
  aura_definitions.visual_config,
  aura_definitions.color_primary,
  aura_definitions.color_secondary
from public.user_auras
join public.aura_definitions on aura_definitions.id = user_auras.aura_id
where user_auras.is_equipped = true
  and aura_definitions.is_active = true;

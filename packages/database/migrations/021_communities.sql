create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  cover_url text,
  category text,
  is_official boolean not null default false,
  is_local boolean not null default false,
  city text,
  state text,
  country text default 'BR',
  owner_id uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  max_rooms integer not null default 10,
  room_capacity integer not null default 200,
  rules text[] default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.communities
add column if not exists is_local boolean not null default false,
add column if not exists city text,
add column if not exists state text,
add column if not exists country text default 'BR';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'communities_status_check'
  ) then
    alter table public.communities
    add constraint communities_status_check check (status in ('active', 'paused', 'blocked'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'communities_max_rooms_check'
  ) then
    alter table public.communities
    add constraint communities_max_rooms_check check (max_rooms between 1 and 50);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'communities_room_capacity_check'
  ) then
    alter table public.communities
    add constraint communities_room_capacity_check check (room_capacity between 10 and 500);
  end if;
end $$;

create index if not exists communities_slug_idx on public.communities(slug);
create index if not exists communities_category_idx on public.communities(category);
create index if not exists communities_city_state_idx on public.communities(city, state, country);
create index if not exists communities_status_idx on public.communities(status);
create index if not exists communities_owner_id_idx on public.communities(owner_id);

alter table public.communities enable row level security;

drop policy if exists "communities are readable when active" on public.communities;
drop policy if exists "authenticated users can create own communities" on public.communities;
drop policy if exists "owners can update own communities" on public.communities;

create policy "communities are readable when active"
on public.communities for select
using (status = 'active');

create policy "authenticated users can create own communities"
on public.communities for insert
with check (auth.uid() is not null and owner_id = auth.uid());

create policy "owners can update own communities"
on public.communities for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

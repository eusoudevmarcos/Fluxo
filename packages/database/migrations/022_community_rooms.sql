create table if not exists public.community_rooms (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  room_number integer not null,
  capacity integer not null default 200,
  online_count integer not null default 0,
  status text not null default 'open',
  is_vip boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_rooms_unique_number unique (community_id, room_number),
  constraint community_rooms_status_check check (status in ('open', 'full', 'closed')),
  constraint community_rooms_online_count_check check (online_count >= 0),
  constraint community_rooms_capacity_check check (capacity between 10 and 500)
);

create index if not exists community_rooms_community_id_idx on public.community_rooms(community_id);
create index if not exists community_rooms_status_idx on public.community_rooms(status);

alter table public.community_rooms enable row level security;

drop policy if exists "community rooms are publicly readable" on public.community_rooms;
drop policy if exists "community owners can create rooms" on public.community_rooms;

create policy "community rooms are publicly readable"
on public.community_rooms for select
using (
  exists (
    select 1
    from public.communities
    where communities.id = community_rooms.community_id
      and communities.status = 'active'
  )
);

create policy "community owners can create rooms"
on public.community_rooms for insert
with check (
  exists (
    select 1
    from public.communities
    where communities.id = community_rooms.community_id
      and communities.owner_id = auth.uid()
      and communities.status = 'active'
  )
);

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  cover_url text,
  category text,
  is_official boolean not null default false,
  owner_id uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  max_rooms integer not null default 10,
  room_capacity integer not null default 200,
  rules text[] default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communities_status_check check (status in ('active', 'paused', 'blocked')),
  constraint communities_max_rooms_check check (max_rooms between 1 and 50),
  constraint communities_room_capacity_check check (room_capacity between 10 and 500)
);

create index if not exists communities_status_idx on public.communities(status);
create index if not exists communities_owner_id_idx on public.communities(owner_id);
create index if not exists communities_category_idx on public.communities(category);

alter table public.communities enable row level security;

drop policy if exists "communities are readable when active" on public.communities;
drop policy if exists "authenticated users can create own communities" on public.communities;
drop policy if exists "owners can update own communities" on public.communities;

create policy "communities are readable when active"
on public.communities for select
using (status = 'active');

create policy "authenticated users can create own communities"
on public.communities for insert
to authenticated
with check (owner_id = auth.uid());

create policy "owners can update own communities"
on public.communities for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

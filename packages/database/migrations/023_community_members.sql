create table if not exists public.community_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  constraint community_members_unique_user unique (community_id, user_id),
  constraint community_members_role_check check (role in ('owner', 'moderator', 'member')),
  constraint community_members_status_check check (status in ('active', 'muted', 'banned'))
);

create index if not exists community_members_community_id_idx on public.community_members(community_id);
create index if not exists community_members_user_id_idx on public.community_members(user_id);

alter table public.community_members enable row level security;

drop policy if exists "community memberships are readable" on public.community_members;
drop policy if exists "authenticated users can join communities" on public.community_members;
drop policy if exists "members can leave communities" on public.community_members;

create policy "community memberships are readable"
on public.community_members for select
using (status = 'active');

create policy "authenticated users can join communities"
on public.community_members for insert
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and (
    role = 'member'
    or exists (
      select 1
      from public.communities
      where communities.id = community_members.community_id
        and communities.owner_id = auth.uid()
        and community_members.role = 'owner'
    )
  )
);

create policy "members can leave communities"
on public.community_members for delete
using (user_id = auth.uid());

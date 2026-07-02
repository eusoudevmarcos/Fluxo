-- Wave community room chat migration
-- Run this in the Supabase SQL Editor after the community MVP tables.

create extension if not exists pgcrypto;

-- Allow community owners to maintain and remove their own communities.
drop policy if exists "owners can update own communities" on public.communities;
drop policy if exists "owners can delete own communities" on public.communities;

create policy "owners can update own communities"
on public.communities for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owners can delete own communities"
on public.communities for delete
using (owner_id = auth.uid());

create table if not exists public.community_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.community_rooms(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  message_type text not null default 'text',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint community_room_messages_body_check check (char_length(btrim(body)) between 1 and 2000),
  constraint community_room_messages_type_check check (message_type in ('text', 'system'))
);

create index if not exists community_room_messages_room_id_idx
on public.community_room_messages(room_id, created_at);

create index if not exists community_room_messages_community_id_idx
on public.community_room_messages(community_id);

create index if not exists community_room_messages_sender_id_idx
on public.community_room_messages(sender_id);

alter table public.community_room_messages enable row level security;

drop policy if exists "community room messages are readable by members" on public.community_room_messages;
drop policy if exists "members can send community room messages" on public.community_room_messages;
drop policy if exists "senders can soft delete own room messages" on public.community_room_messages;
drop policy if exists "senders can delete own room messages" on public.community_room_messages;

create policy "community room messages are readable by members"
on public.community_room_messages for select
using (
  exists (
    select 1
    from public.community_members members
    where members.community_id = community_room_messages.community_id
      and members.user_id = auth.uid()
      and members.status = 'active'
  )
);

create policy "members can send community room messages"
on public.community_room_messages for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.community_members members
    where members.community_id = community_room_messages.community_id
      and members.user_id = auth.uid()
      and members.status = 'active'
  )
  and exists (
    select 1
    from public.community_rooms rooms
    where rooms.id = community_room_messages.room_id
      and rooms.community_id = community_room_messages.community_id
      and rooms.status = 'open'
  )
);

create policy "senders can soft delete own room messages"
on public.community_room_messages for update
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

create policy "senders can delete own room messages"
on public.community_room_messages for delete
using (sender_id = auth.uid());

create table if not exists public.community_room_presence (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.community_rooms(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  constraint community_room_presence_unique_user unique (room_id, user_id)
);

create index if not exists community_room_presence_room_active_idx
on public.community_room_presence(room_id, left_at, last_seen_at);

create index if not exists community_room_presence_user_id_idx
on public.community_room_presence(user_id);

alter table public.community_room_presence enable row level security;

drop policy if exists "community room presence readable by members" on public.community_room_presence;
drop policy if exists "users can manage own room presence" on public.community_room_presence;
drop policy if exists "users can delete own room presence" on public.community_room_presence;

create policy "community room presence readable by members"
on public.community_room_presence for select
using (
  exists (
    select 1
    from public.community_members members
    where members.community_id = community_room_presence.community_id
      and members.user_id = auth.uid()
      and members.status = 'active'
  )
);

create policy "users can manage own room presence"
on public.community_room_presence for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own room presence"
on public.community_room_presence for delete
using (user_id = auth.uid());

create or replace function public.recompute_community_room_online_count(room_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id alias for $1;
  next_count integer;
begin
  select count(*)::integer
    into next_count
  from public.community_room_presence presence
  where presence.room_id = target_room_id
    and presence.left_at is null
    and presence.last_seen_at >= now() - interval '5 minutes';

  update public.community_rooms rooms
  set online_count = next_count,
      updated_at = now()
  where rooms.id = target_room_id;

  return coalesce(next_count, 0);
end;
$$;

create or replace function public.join_community_room(room_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id alias for $1;
  target_community_id uuid;
  next_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select rooms.community_id
    into target_community_id
  from public.community_rooms rooms
  where rooms.id = target_room_id
    and rooms.status = 'open';

  if target_community_id is null then
    raise exception 'Room not found';
  end if;

  if not exists (
    select 1
    from public.community_members members
    where members.community_id = target_community_id
      and members.user_id = auth.uid()
      and members.status = 'active'
  ) then
    raise exception 'Join the community before entering this room';
  end if;

  insert into public.community_room_presence (
    room_id,
    community_id,
    user_id,
    joined_at,
    last_seen_at,
    left_at
  )
  values (
    target_room_id,
    target_community_id,
    auth.uid(),
    now(),
    now(),
    null
  )
  on conflict (room_id, user_id)
  do update set
    community_id = excluded.community_id,
    last_seen_at = now(),
    left_at = null;

  next_count := public.recompute_community_room_online_count(target_room_id);
  return next_count;
end;
$$;

create or replace function public.leave_community_room(room_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id alias for $1;
  next_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.community_room_presence presence
  set left_at = now(),
      last_seen_at = now()
  where presence.room_id = target_room_id
    and presence.user_id = auth.uid();

  next_count := public.recompute_community_room_online_count(target_room_id);
  return next_count;
end;
$$;

grant select, insert, update, delete on public.community_room_messages to authenticated;
grant select, insert, update, delete on public.community_room_presence to authenticated;
grant execute on function public.recompute_community_room_online_count(uuid) to authenticated;
grant execute on function public.join_community_room(uuid) to authenticated;
grant execute on function public.leave_community_room(uuid) to authenticated;

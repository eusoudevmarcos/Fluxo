create table if not exists public.community_room_presence (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.community_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  constraint community_room_presence_unique unique (room_id, user_id)
);

create index if not exists community_room_presence_room_id_idx
on public.community_room_presence(room_id);

create index if not exists community_room_presence_user_id_idx
on public.community_room_presence(user_id);

alter table public.community_room_presence enable row level security;

drop policy if exists "room presence is readable for active communities" on public.community_room_presence;
drop policy if exists "users can join own room presence" on public.community_room_presence;
drop policy if exists "users can update own room presence" on public.community_room_presence;

create policy "room presence is readable for active communities"
on public.community_room_presence for select
using (
  exists (
    select 1
    from public.community_rooms
    join public.communities on communities.id = community_rooms.community_id
    where community_rooms.id = community_room_presence.room_id
      and communities.status = 'active'
  )
);

create policy "users can join own room presence"
on public.community_room_presence for insert
to authenticated
with check (user_id = auth.uid());

create policy "users can update own room presence"
on public.community_room_presence for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.join_community_room(room_id uuid)
returns public.community_room_presence
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  result_row public.community_room_presence;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if room_id is null then
    raise exception 'room_id is required';
  end if;

  insert into public.community_room_presence (room_id, user_id, joined_at, last_seen_at, left_at)
  values (room_id, current_user_id, now(), now(), null)
  on conflict (room_id, user_id) do update set
    last_seen_at = now(),
    left_at = null
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function public.leave_community_room(room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.community_room_presence
  set left_at = now(),
      last_seen_at = now()
  where community_room_presence.room_id = leave_community_room.room_id
    and user_id = auth.uid();
end;
$$;

revoke execute on function public.join_community_room(uuid) from public;
revoke execute on function public.join_community_room(uuid) from anon;
grant execute on function public.join_community_room(uuid) to authenticated;

revoke execute on function public.leave_community_room(uuid) from public;
revoke execute on function public.leave_community_room(uuid) from anon;
grant execute on function public.leave_community_room(uuid) to authenticated;

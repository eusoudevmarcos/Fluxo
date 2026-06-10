create table if not exists public.community_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.community_rooms(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  message_type text not null default 'text',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_room_messages_type_check') then
    alter table public.community_room_messages
    add constraint community_room_messages_type_check
    check (message_type in ('text', 'system'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_room_messages_body_check') then
    alter table public.community_room_messages
    add constraint community_room_messages_body_check
    check (char_length(btrim(body)) > 0 and char_length(body) <= 2000);
  end if;
end $$;

create index if not exists community_room_messages_room_created_idx
on public.community_room_messages(room_id, created_at desc);

create index if not exists community_room_messages_community_id_idx
on public.community_room_messages(community_id);

create index if not exists community_room_messages_sender_id_idx
on public.community_room_messages(sender_id);

alter table public.community_room_messages enable row level security;

drop policy if exists "room messages are readable for active communities" on public.community_room_messages;
drop policy if exists "community members can send room messages" on public.community_room_messages;
drop policy if exists "room message senders can soft delete own messages" on public.community_room_messages;

create policy "room messages are readable for active communities"
on public.community_room_messages for select
using (
  exists (
    select 1
    from public.communities
    where communities.id = community_room_messages.community_id
      and communities.status = 'active'
  )
);

create policy "community members can send room messages"
on public.community_room_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.community_rooms
    join public.communities on communities.id = community_rooms.community_id
    where community_rooms.id = community_room_messages.room_id
      and community_rooms.community_id = community_room_messages.community_id
      and communities.status = 'active'
  )
  and exists (
    select 1
    from public.community_members
    where community_members.community_id = community_room_messages.community_id
      and community_members.user_id = auth.uid()
      and community_members.status = 'active'
  )
);

create policy "room message senders can soft delete own messages"
on public.community_room_messages for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

do $$
begin
  begin
    alter publication supabase_realtime add table public.community_room_messages;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

create table if not exists public.priv_conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  conversation_type text not null default 'direct',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.priv_conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.priv_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  is_muted boolean not null default false,
  constraint priv_conversation_members_unique unique (conversation_id, user_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'priv_conversations_type_check') then
    alter table public.priv_conversations
    add constraint priv_conversations_type_check
    check (conversation_type in ('direct', 'group'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'priv_conversation_members_role_check') then
    alter table public.priv_conversation_members
    add constraint priv_conversation_members_role_check
    check (role in ('owner', 'member'));
  end if;
end $$;

create index if not exists priv_conversations_created_by_idx
on public.priv_conversations(created_by);

create index if not exists priv_conversation_members_conversation_id_idx
on public.priv_conversation_members(conversation_id);

create index if not exists priv_conversation_members_user_id_idx
on public.priv_conversation_members(user_id);

alter table public.priv_conversations enable row level security;
alter table public.priv_conversation_members enable row level security;

create or replace function public.is_priv_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.priv_conversation_members
    where conversation_id = target_conversation_id
      and user_id = auth.uid()
  );
$$;

revoke execute on function public.is_priv_conversation_member(uuid) from public;
revoke execute on function public.is_priv_conversation_member(uuid) from anon;
grant execute on function public.is_priv_conversation_member(uuid) to authenticated;

drop policy if exists "priv conversations are readable by members" on public.priv_conversations;
drop policy if exists "priv members are readable by members" on public.priv_conversation_members;
drop policy if exists "priv members can update own read state" on public.priv_conversation_members;

create policy "priv conversations are readable by members"
on public.priv_conversations for select
using (public.is_priv_conversation_member(id));

create policy "priv members are readable by members"
on public.priv_conversation_members for select
using (public.is_priv_conversation_member(conversation_id));

create policy "priv members can update own read state"
on public.priv_conversation_members for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.get_or_create_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_conversation_id uuid;
  next_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if other_user_id is null then
    raise exception 'other_user_id is required';
  end if;

  if other_user_id = current_user_id then
    raise exception 'Cannot create a direct conversation with yourself';
  end if;

  select conversation.id
  into existing_conversation_id
  from public.priv_conversations conversation
  join public.priv_conversation_members current_member
    on current_member.conversation_id = conversation.id
   and current_member.user_id = current_user_id
  join public.priv_conversation_members other_member
    on other_member.conversation_id = conversation.id
   and other_member.user_id = other_user_id
  where conversation.conversation_type = 'direct'
    and (
      select count(*)
      from public.priv_conversation_members count_member
      where count_member.conversation_id = conversation.id
    ) = 2
  limit 1;

  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  insert into public.priv_conversations (created_by, conversation_type)
  values (current_user_id, 'direct')
  returning id into next_conversation_id;

  insert into public.priv_conversation_members (conversation_id, user_id, role)
  values
    (next_conversation_id, current_user_id, 'owner'),
    (next_conversation_id, other_user_id, 'member')
  on conflict (conversation_id, user_id) do nothing;

  return next_conversation_id;
end;
$$;

create or replace function public.mark_conversation_read(conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.priv_conversation_members
  set last_read_at = now()
  where priv_conversation_members.conversation_id = mark_conversation_read.conversation_id
    and user_id = auth.uid();
end;
$$;

revoke execute on function public.get_or_create_direct_conversation(uuid) from public;
revoke execute on function public.get_or_create_direct_conversation(uuid) from anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

revoke execute on function public.mark_conversation_read(uuid) from public;
revoke execute on function public.mark_conversation_read(uuid) from anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

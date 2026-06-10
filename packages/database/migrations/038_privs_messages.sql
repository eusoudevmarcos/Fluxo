create table if not exists public.priv_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.priv_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  message_type text not null default 'text',
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'priv_messages_type_check') then
    alter table public.priv_messages
    add constraint priv_messages_type_check
    check (message_type in ('text', 'system'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'priv_messages_body_check') then
    alter table public.priv_messages
    add constraint priv_messages_body_check
    check (char_length(btrim(body)) > 0 and char_length(body) <= 2000);
  end if;
end $$;

create index if not exists priv_messages_conversation_created_idx
on public.priv_messages(conversation_id, created_at desc);

create index if not exists priv_messages_sender_id_idx
on public.priv_messages(sender_id);

alter table public.priv_messages enable row level security;

drop policy if exists "priv messages are readable by conversation members" on public.priv_messages;
drop policy if exists "conversation members can send priv messages" on public.priv_messages;
drop policy if exists "senders can soft delete own priv messages" on public.priv_messages;

create policy "priv messages are readable by conversation members"
on public.priv_messages for select
using (public.is_priv_conversation_member(conversation_id));

create policy "conversation members can send priv messages"
on public.priv_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_priv_conversation_member(conversation_id)
);

create policy "senders can soft delete own priv messages"
on public.priv_messages for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

create or replace function public.send_priv_message(conversation_id uuid, body text)
returns public.priv_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  result_row public.priv_messages;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if conversation_id is null then
    raise exception 'conversation_id is required';
  end if;

  if send_priv_message.body is null or char_length(btrim(send_priv_message.body)) = 0 then
    raise exception 'Message body is required';
  end if;

  if char_length(send_priv_message.body) > 2000 then
    raise exception 'Message body is too long';
  end if;

  if not public.is_priv_conversation_member(send_priv_message.conversation_id) then
    raise exception 'User is not a member of this conversation';
  end if;

  insert into public.priv_messages (conversation_id, sender_id, body)
  values (send_priv_message.conversation_id, current_user_id, btrim(send_priv_message.body))
  returning * into result_row;

  update public.priv_conversations
  set updated_at = now()
  where id = send_priv_message.conversation_id;

  update public.priv_conversation_members
  set last_read_at = now()
  where priv_conversation_members.conversation_id = send_priv_message.conversation_id
    and user_id = current_user_id;

  return result_row;
end;
$$;

revoke execute on function public.send_priv_message(uuid, text) from public;
revoke execute on function public.send_priv_message(uuid, text) from anon;
grant execute on function public.send_priv_message(uuid, text) to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.priv_messages;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

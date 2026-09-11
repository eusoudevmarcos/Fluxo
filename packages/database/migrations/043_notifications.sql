create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  content_id uuid references public.contents(id) on delete set null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_type_check') then
    alter table public.notifications
    add constraint notifications_type_check
    check (type in ('dahora', 'comment', 'wave', 'follow', 'mission_reward', 'coin_gift'));
  end if;
end $$;

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "users can read own notifications" on public.notifications;

create policy "users can read own notifications"
on public.notifications for select
using (recipient_id = auth.uid());

alter publication supabase_realtime add table public.notifications;

create or replace function public.create_notification(
  target_recipient_id uuid,
  notification_type text,
  target_actor_id uuid default null,
  target_content_id uuid default null,
  notification_body text default null
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.notifications;
begin
  if target_recipient_id is null or notification_type is null then
    raise exception 'target_recipient_id and notification_type are required';
  end if;

  if target_actor_id is not null and target_actor_id = target_recipient_id then
    return null;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, content_id, body)
  values (target_recipient_id, target_actor_id, notification_type, target_content_id, notification_body)
  returning * into result_row;

  return result_row;
end;
$$;

revoke execute on function public.create_notification(uuid, text, uuid, uuid, text) from public;
revoke execute on function public.create_notification(uuid, text, uuid, uuid, text) from anon;
revoke execute on function public.create_notification(uuid, text, uuid, uuid, text) from authenticated;

create or replace function public.mark_notification_read(notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.notifications;
begin
  update public.notifications
  set read_at = now()
  where id = notification_id
    and recipient_id = auth.uid()
    and read_at is null
  returning * into result_row;

  return result_row;
end;
$$;

revoke execute on function public.mark_notification_read(uuid) from public;
revoke execute on function public.mark_notification_read(uuid) from anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.notifications
  set read_at = now()
  where recipient_id = auth.uid()
    and read_at is null;

  get diagnostics updated_count = row_count;

  return updated_count;
end;
$$;

revoke execute on function public.mark_all_notifications_read() from public;
revoke execute on function public.mark_all_notifications_read() from anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Fan-out por trigger: dahoras, comments e waves sao inserts diretos do client (nao passam por
-- RPC), entao um trigger AFTER INSERT e o unico jeito de garantir a notificacao em qualquer
-- plataforma sem reescrever esses fluxos ja validados em producao.
create or replace function public.notify_on_dahora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  content_author_id uuid;
begin
  select author_id into content_author_id from public.contents where id = new.content_id;

  if content_author_id is not null then
    perform public.create_notification(content_author_id, 'dahora', new.user_id, new.content_id);
  end if;

  return new;
end;
$$;

drop trigger if exists dahoras_notify on public.dahoras;
create trigger dahoras_notify
after insert on public.dahoras
for each row execute function public.notify_on_dahora();

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  content_author_id uuid;
begin
  select author_id into content_author_id from public.contents where id = new.content_id;

  if content_author_id is not null then
    perform public.create_notification(content_author_id, 'comment', new.author_id, new.content_id, new.text);
  end if;

  return new;
end;
$$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
after insert on public.comments
for each row execute function public.notify_on_comment();

create or replace function public.notify_on_wave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  content_author_id uuid;
begin
  select author_id into content_author_id from public.contents where id = new.content_id;

  if content_author_id is not null then
    perform public.create_notification(content_author_id, 'wave', new.user_id, new.content_id);
  end if;

  return new;
end;
$$;

drop trigger if exists waves_notify on public.waves;
create trigger waves_notify
after insert on public.waves
for each row execute function public.notify_on_wave();

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_notification(new.following_id, 'follow', new.follower_id);
  return new;
end;
$$;

drop trigger if exists user_relationships_notify on public.user_relationships;
create trigger user_relationships_notify
after insert on public.user_relationships
for each row execute function public.notify_on_follow();

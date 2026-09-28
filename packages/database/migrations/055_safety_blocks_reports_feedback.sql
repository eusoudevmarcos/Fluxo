-- Seguranca para o beta (exigencia das lojas para redes com conteudo de usuario):
--   1) Bloquear usuarios
--   2) Denunciar conteudo/comentario/perfil/mensagem + fila de moderacao das contas oficiais
--   3) Privs: bloqueio e protecao de menores (so recebem mensagem de quem eles seguem)
--   4) Feedback e relatorio de erros dos testadores

-- ============================================================
-- 1) Bloqueios
-- ============================================================
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists "users can read own blocks" on public.user_blocks;

-- Quem foi bloqueado nao ve que foi bloqueado.
create policy "users can read own blocks"
on public.user_blocks for select
using (blocker_id = auth.uid());

-- Bloqueio vale nos dois sentidos para visibilidade e contato.
create or replace function public.is_blocked_between(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select user_a is not null and user_b is not null and exists (
    select 1 from public.user_blocks
    where (blocker_id = user_a and blocked_id = user_b)
       or (blocker_id = user_b and blocked_id = user_a)
  );
$$;

revoke execute on function public.is_blocked_between(uuid, uuid) from public;
grant execute on function public.is_blocked_between(uuid, uuid) to anon, authenticated;

create or replace function public.block_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Entre na Fluxo para continuar.';
  end if;

  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'Escolha outra pessoa para bloquear.';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (current_user_id, target_user_id)
  on conflict do nothing;

  -- Desfaz o seguir nos dois sentidos.
  delete from public.user_relationships
  where (follower_id = current_user_id and following_id = target_user_id)
     or (follower_id = target_user_id and following_id = current_user_id);
end;
$$;

revoke execute on function public.block_user(uuid) from public;
revoke execute on function public.block_user(uuid) from anon;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(target_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.user_blocks
  where blocker_id = auth.uid() and blocked_id = target_user_id;
$$;

revoke execute on function public.unblock_user(uuid) from public;
revoke execute on function public.unblock_user(uuid) from anon;
grant execute on function public.unblock_user(uuid) to authenticated;

-- Nao da para seguir quem te bloqueou (nem quem voce bloqueou).
create or replace function public.prevent_follow_when_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_blocked_between(new.follower_id, new.following_id) then
    raise exception 'Não é possível seguir este perfil.';
  end if;
  return new;
end;
$$;

drop trigger if exists user_relationships_block_guard on public.user_relationships;
create trigger user_relationships_block_guard
before insert on public.user_relationships
for each row execute function public.prevent_follow_when_blocked();

-- ============================================================
-- 2) Conteudo removido pela moderacao + visibilidade com bloqueio
-- ============================================================
alter table public.contents drop constraint if exists contents_visibility_check;
alter table public.contents
add constraint contents_visibility_check check (visibility in ('public', 'removed'));

drop policy if exists "public contents are readable" on public.contents;

create policy "public contents are readable"
on public.contents for select
using (
  (visibility = 'public' and not public.is_blocked_between(auth.uid(), author_id))
  -- o autor continua vendo o proprio post removido (para entender o que aconteceu)
  or author_id = auth.uid()
);

drop policy if exists "comments on public contents are readable" on public.comments;

create policy "comments on public contents are readable"
on public.comments for select
using (
  not public.is_blocked_between(auth.uid(), author_id)
  and exists (
    select 1
    from public.contents
    where contents.id = comments.content_id
      and contents.visibility = 'public'
  )
);

-- ============================================================
-- 3) Privs: bloqueio + menores so recebem de quem seguem
-- ============================================================
create or replace function public.guard_priv_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient record;
begin
  for recipient in
    select members.user_id
    from public.priv_conversation_members members
    where members.conversation_id = new.conversation_id
      and members.user_id <> new.sender_id
  loop
    if public.is_blocked_between(new.sender_id, recipient.user_id) then
      raise exception 'Não é possível enviar mensagem para esta pessoa.';
    end if;

    if public.user_age_band(recipient.user_id) in ('teen_14', 'teen_16')
      and public.user_age_band(new.sender_id) not in ('teen_14', 'teen_16')
      and not exists (
        select 1 from public.user_relationships
        where follower_id = recipient.user_id and following_id = new.sender_id
      ) then
      raise exception 'Essa pessoa só recebe mensagens de quem ela segue.';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists priv_messages_guard on public.priv_messages;
create trigger priv_messages_guard
before insert on public.priv_messages
for each row execute function public.guard_priv_message();

-- ============================================================
-- 4) Denuncias
-- ============================================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  target_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open',
  action_taken text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_target_type_check check (target_type in ('content', 'comment', 'profile', 'message')),
  constraint reports_reason_check check (reason in (
    'spam', 'harassment', 'hate', 'nudity', 'violence', 'minor_safety', 'self_harm', 'fake', 'other'
  )),
  constraint reports_status_check check (status in ('open', 'resolved', 'dismissed')),
  constraint reports_unique_per_reporter unique (reporter_id, target_type, target_id)
);

create index if not exists reports_status_idx on public.reports(status, created_at);
create index if not exists reports_target_idx on public.reports(target_type, target_id);

alter table public.reports enable row level security;

drop policy if exists "users can read own reports" on public.reports;

create policy "users can read own reports"
on public.reports for select
using (reporter_id = auth.uid());

-- Numero de denuncias distintas que oculta um post automaticamente ate a revisao.
create or replace function public.report_auto_hide_threshold()
returns integer
language sql
immutable
as $$ select 5 $$;

create or replace function public.submit_report(
  input_target_type text,
  input_target_id uuid,
  input_reason text,
  input_details text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  resolved_target_user uuid;
  open_count integer;
begin
  if current_user_id is null then
    raise exception 'Entre na Fluxo para denunciar.';
  end if;

  resolved_target_user := case input_target_type
    when 'content' then (select author_id from public.contents where id = input_target_id)
    when 'comment' then (select author_id from public.comments where id = input_target_id)
    when 'profile' then (select user_id from public.profiles where user_id = input_target_id)
    when 'message' then (
      select sender_id from public.priv_messages
      where id = input_target_id and public.is_priv_conversation_member(conversation_id)
    )
    else null
  end;

  if resolved_target_user is null then
    raise exception 'Não encontramos o que você quer denunciar.';
  end if;

  if resolved_target_user = current_user_id then
    raise exception 'Você não pode denunciar a si mesmo.';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason, details)
  values (
    current_user_id,
    input_target_type,
    input_target_id,
    resolved_target_user,
    input_reason,
    left(nullif(btrim(input_details), ''), 500)
  )
  on conflict (reporter_id, target_type, target_id) do update set
    reason = excluded.reason,
    details = excluded.details;

  if input_target_type = 'content' then
    select count(*) into open_count
    from public.reports
    where target_type = 'content' and target_id = input_target_id and status = 'open';

    if open_count >= public.report_auto_hide_threshold() then
      update public.contents set visibility = 'removed', updated_at = now()
      where id = input_target_id and visibility = 'public';
    end if;
  end if;
end;
$$;

revoke execute on function public.submit_report(text, uuid, text, text) from public;
revoke execute on function public.submit_report(text, uuid, text, text) from anon;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;

-- Fila de moderacao (so contas oficiais), agrupada por alvo.
create or replace function public.list_open_reports()
returns table (
  target_type text,
  target_id uuid,
  target_user_id uuid,
  target_username text,
  report_count integer,
  reasons text[],
  details text[],
  content_text text,
  content_media_url text,
  content_visibility text,
  first_reported_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_official_account(auth.uid()) then
    raise exception 'Acesso restrito às contas oficiais da Fluxo.';
  end if;

  return query
  select
    grouped.target_type,
    grouped.target_id,
    grouped.target_user_id,
    profiles.username::text,
    grouped.report_count,
    grouped.reasons,
    grouped.details,
    coalesce(contents.text, comments.text, priv_messages.body)::text,
    contents.media_url::text,
    contents.visibility::text,
    grouped.first_reported_at
  from (
    select
      reports.target_type,
      reports.target_id,
      (array_agg(reports.target_user_id))[1] as target_user_id,
      count(*)::integer as report_count,
      array_agg(distinct reports.reason) as reasons,
      array_remove(array_agg(reports.details), null) as details,
      min(reports.created_at) as first_reported_at
    from public.reports
    where reports.status = 'open'
    group by reports.target_type, reports.target_id
  ) grouped
  left join public.profiles on profiles.user_id = grouped.target_user_id
  left join public.contents on grouped.target_type = 'content' and contents.id = grouped.target_id
  left join public.comments on grouped.target_type = 'comment' and comments.id = grouped.target_id
  left join public.priv_messages on grouped.target_type = 'message' and priv_messages.id = grouped.target_id
  order by grouped.report_count desc, grouped.first_reported_at asc
  limit 200;
end;
$$;

revoke execute on function public.list_open_reports() from public;
revoke execute on function public.list_open_reports() from anon;
grant execute on function public.list_open_reports() to authenticated;

-- action: 'dismiss' (nada errado; restaura post oculto automaticamente) ou 'remove'
-- (remove o post/comentario denunciado).
create or replace function public.resolve_reports(
  input_target_type text,
  input_target_id uuid,
  action text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_count integer;
begin
  if not public.is_official_account(auth.uid()) then
    raise exception 'Acesso restrito às contas oficiais da Fluxo.';
  end if;

  if action not in ('dismiss', 'remove') then
    raise exception 'Ação inválida.';
  end if;

  if action = 'remove' then
    if input_target_type = 'content' then
      update public.contents set visibility = 'removed', updated_at = now() where id = input_target_id;
    elsif input_target_type = 'comment' then
      delete from public.comments where id = input_target_id;
    elsif input_target_type = 'message' then
      update public.priv_messages set deleted_at = now() where id = input_target_id;
    end if;
  elsif input_target_type = 'content' then
    update public.contents set visibility = 'public', updated_at = now()
    where id = input_target_id and visibility = 'removed';
  end if;

  update public.reports
  set status = case when action = 'remove' then 'resolved' else 'dismissed' end,
      action_taken = action,
      resolved_by = auth.uid(),
      resolved_at = now()
  where target_type = input_target_type
    and target_id = input_target_id
    and status = 'open';

  get diagnostics resolved_count = row_count;
  return resolved_count;
end;
$$;

revoke execute on function public.resolve_reports(text, uuid, text) from public;
revoke execute on function public.resolve_reports(text, uuid, text) from anon;
grant execute on function public.resolve_reports(text, uuid, text) to authenticated;

-- ============================================================
-- 5) Feedback e erros do app (beta)
-- ============================================================
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,
  message text not null,
  platform text,
  app_version text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint app_feedback_kind_check check (kind in ('bug', 'idea', 'other', 'crash')),
  constraint app_feedback_message_check check (char_length(btrim(message)) > 0 and char_length(message) <= 4000)
);

create index if not exists app_feedback_created_idx on public.app_feedback(kind, created_at desc);

alter table public.app_feedback enable row level security;

drop policy if exists "users can send feedback" on public.app_feedback;

create policy "users can send feedback"
on public.app_feedback for insert
to authenticated
with check (user_id = auth.uid());

create or replace function public.list_app_feedback(filter_kind text default null)
returns setof public.app_feedback
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_official_account(auth.uid()) then
    raise exception 'Acesso restrito às contas oficiais da Fluxo.';
  end if;

  return query
  select * from public.app_feedback
  where filter_kind is null or kind = filter_kind
  order by created_at desc
  limit 300;
end;
$$;

revoke execute on function public.list_app_feedback(text) from public;
revoke execute on function public.list_app_feedback(text) from anon;
grant execute on function public.list_app_feedback(text) to authenticated;

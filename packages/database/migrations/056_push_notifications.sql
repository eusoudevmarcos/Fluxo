-- Notificacoes push (app fechado). Cada notificacao criada em public.notifications (043+) vira
-- um push via Expo Push API. O envio e feito pelo gateway no Render (apps/api/src/push-worker.ts),
-- que chama claim_pending_pushes() a cada poucos segundos -- o Postgres do Render nao tem pg_net.
-- O app registra o token do aparelho com register_push_token().
--
-- Adolescentes (14-17): sem push entre 21h e 8h (horario de Brasilia), modelo TikTok / ECA
-- Digital -- a notificacao continua na lista dentro do app.

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;
-- sem policies: so as funcoes abaixo leem/escrevem.

create or replace function public.register_push_token(input_token text, input_platform text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na Fluxo para ativar notificações.';
  end if;

  if input_token is null or input_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Token de notificação inválido.';
  end if;

  -- Um aparelho pertence a quem estiver logado nele agora.
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (input_token, auth.uid(), left(input_platform, 20), now())
  on conflict (token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    updated_at = now();
end;
$$;

revoke execute on function public.register_push_token(text, text) from public;
revoke execute on function public.register_push_token(text, text) from anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Chamado ao sair da conta, para o aparelho parar de receber pushes dela.
create or replace function public.unregister_push_token(input_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = input_token and user_id = auth.uid();
$$;

revoke execute on function public.unregister_push_token(text) from public;
revoke execute on function public.unregister_push_token(text) from anon;
grant execute on function public.unregister_push_token(text) to authenticated;

create or replace function public.push_notification_text(notification public.notifications)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  select coalesce(display_name, username, 'Alguém') into actor_name
  from public.profiles
  where user_id = notification.actor_id;

  actor_name := coalesce(actor_name, 'Alguém');

  return case notification.type
    when 'wave' then actor_name || ' deu uma Wave no seu post'
    when 'dahora' then actor_name || ' achou seu post da hora'
    when 'comment' then actor_name || ' comentou: ' || left(coalesce(notification.body, ''), 80)
    when 'follow' then actor_name || ' agora é seu fã'
    when 'invite_accepted' then actor_name || ' entrou na Fluxo com o seu convite!'
    when 'mission_reward' then 'Missão concluída: ' || coalesce(notification.body, '')
    when 'seal_granted' then 'Você ganhou um novo selo! ' || coalesce(notification.body, '')
    when 'coin_gift' then actor_name || ' te enviou Fluxo Coin'
    when 'creator_application_reviewed' then coalesce(notification.body, 'Sua inscrição Prime Influencer foi revisada.')
    else coalesce(notification.body, 'Você tem uma novidade na Fluxo')
  end;
end;
$$;

revoke execute on function public.push_notification_text(public.notifications) from public;
revoke execute on function public.push_notification_text(public.notifications) from anon;
revoke execute on function public.push_notification_text(public.notifications) from authenticated;

-- Fila de envio: push_sent_at nulo = pendente. O que ja existia antes desta migration conta como
-- enviado (nada de enxurrada de push antigo).
alter table public.notifications add column if not exists push_sent_at timestamptz;

update public.notifications set push_sent_at = created_at where push_sent_at is null;

create index if not exists notifications_push_pending_idx
  on public.notifications(created_at)
  where push_sent_at is null;

-- Pega ate max_items notificacoes pendentes, marca como enviadas e devolve uma linha por aparelho
-- de destino, ja com o texto. Notificacao de adolescente em horario de silencio ou com mais de
-- 1 hora e so marcada (nao envia). Uso exclusivo do gateway (conexao do dono do banco).
create or replace function public.claim_pending_pushes(max_items integer default 500)
returns table (token text, body text, notification_id uuid, type text)
language plpgsql
security definer
set search_path = public
as $$
declare
  local_hour integer := extract(hour from now() at time zone 'America/Sao_Paulo');
begin
  return query
  with picked as (
    select pending.id
    from public.notifications pending
    where pending.push_sent_at is null
    order by pending.created_at
    limit greatest(coalesce(max_items, 500), 1)
    for update skip locked
  ),
  marked as (
    update public.notifications target
    set push_sent_at = now()
    from picked
    where target.id = picked.id
    returning target.id
  )
  select tokens.token, public.push_notification_text(source), source.id, source.type
  from marked
  join public.notifications source on source.id = marked.id
  join public.push_tokens tokens on tokens.user_id = source.recipient_id
  where source.created_at > now() - interval '1 hour'
    and not (
      public.user_age_band(source.recipient_id) in ('teen_14', 'teen_16')
      and (local_hour >= 21 or local_hour < 8)
    );
end;
$$;

revoke execute on function public.claim_pending_pushes(integer) from public;
revoke execute on function public.claim_pending_pushes(integer) from anon;
revoke execute on function public.claim_pending_pushes(integer) from authenticated;

-- Notificacoes push (app fechado). Cada notificacao criada em public.notifications (043+)
-- vira um push via Expo Push API, disparado pelo proprio banco com pg_net -- sem servidor ou
-- Edge Function extra. O app registra o token do aparelho com register_push_token().
--
-- Adolescentes (14-17): sem push entre 21h e 8h (horario de Brasilia), modelo TikTok / ECA
-- Digital -- a notificacao continua na lista dentro do app.

create extension if not exists pg_net with schema extensions;

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

create or replace function public.send_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  recipient_band text;
  local_hour integer;
  messages jsonb;
begin
  recipient_band := public.user_age_band(new.recipient_id);
  local_hour := extract(hour from now() at time zone 'America/Sao_Paulo');

  if recipient_band in ('teen_14', 'teen_16') and (local_hour >= 21 or local_hour < 8) then
    return new;
  end if;

  select jsonb_agg(jsonb_build_object(
    'to', tokens.token,
    'title', 'Fluxo',
    'body', public.push_notification_text(new),
    'sound', 'default',
    'data', jsonb_build_object('notification_id', new.id, 'type', new.type)
  ))
  into messages
  from public.push_tokens tokens
  where tokens.user_id = new.recipient_id;

  if messages is null then
    return new;
  end if;

  -- Assincrono: o pg_net enfileira e envia fora da transacao; falha de push nunca quebra a acao.
  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := messages,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json')
    );
  exception when others then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push
after insert on public.notifications
for each row execute function public.send_push_on_notification();

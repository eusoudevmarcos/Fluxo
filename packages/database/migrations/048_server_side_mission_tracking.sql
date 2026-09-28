-- Missoes passam a ser contadas no servidor, por trigger, a partir das acoes reais (post, wave,
-- comentario, seguir, entrar em comunidade). Ate aqui o client chamava
-- increment_mission_progress direto, entao qualquer um completava missao pela API sem fazer
-- nada -- inaceitavel quando missao passa a dar alcance/prioridade nas sugestoes.
--
-- Anti-farm:
--   * cada alvo conta uma vez por periodo (curtir/descurtir o mesmo post nao soma de novo;
--     seguir/deixar de seguir a mesma pessoa conta uma vez na vida);
--   * acao sobre o proprio conteudo nao conta;
--   * comentario precisa de pelo menos 5 caracteres uteis;
--   * teto diario por tipo de evento.

-- 1) Novos tipos de missao (o catalogo de 200+ missoes da etapa seguinte usa estes tipos).
alter table public.mission_definitions drop constraint if exists mission_definitions_type_check;
alter table public.mission_definitions
add constraint mission_definitions_type_check
check (mission_type in (
  'create_flow',
  'create_moments',
  'create_post',
  'create_wave',
  'create_comment',
  'mention_people',
  'follow_people',
  'gain_fans',
  'receive_waves',
  'receive_comments',
  'join_communities',
  'invite_friends',
  'invite_accepted',
  'daily_streak',
  'daily_active',
  'weekly_complete',
  'overachieve_weekly'
));

-- 2) Dia/semana no fuso do Brasil (antes era UTC: o "dia" virava as 21h de Brasilia).
create or replace function public.ocean_mission_period_key(cadence text)
returns text
language sql
stable
as $$
  select case
    when cadence = 'daily' then to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')
    when cadence = 'weekly' then to_char((now() at time zone 'America/Sao_Paulo')::date, 'IYYY-"W"IW')
    when cadence = 'monthly' then to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM')
    when cadence = 'seasonal' then to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-"S"Q')
    else 'once'
  end;
$$;

-- 3) add_user_xp ja nao e executavel pelo client (revogado em 026); a checagem de auth.uid()
-- impedia dar XP a quem RECEBE a acao (autor que recebe wave/comentario/fa). Mesma funcao sem
-- essa checagem.
create or replace function public.add_user_xp(
  target_user_id uuid,
  amount integer,
  reason text,
  metadata jsonb default '{}'::jsonb
)
returns public.user_gamification
language plpgsql
security definer
set search_path = public
as $$
declare
  gamification_row public.user_gamification;
  next_level integer;
  next_current bigint;
  next_required bigint;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if amount is null or amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  perform public.ensure_user_gamification(target_user_id);

  select *
  into gamification_row
  from public.user_gamification
  where user_id = target_user_id
  for update;

  if gamification_row.is_founder then
    update public.user_gamification
    set
      level = 9999,
      xp_total = greatest(xp_total + amount, 999999999),
      xp_current_level = 0,
      xp_next_level = 999999999,
      weekly_xp = weekly_xp + amount,
      monthly_xp = monthly_xp + amount,
      last_active_date = current_date,
      updated_at = now()
    where user_id = target_user_id
    returning * into gamification_row;

    return gamification_row;
  end if;

  next_level := gamification_row.level;
  next_current := gamification_row.xp_current_level + amount;
  next_required := greatest(gamification_row.xp_next_level, next_level * 1000);

  while next_current >= next_required and next_level < 9999 loop
    next_current := next_current - next_required;
    next_level := next_level + 1;
    next_required := next_level * 1000;
  end loop;

  update public.user_gamification
  set
    level = least(next_level, 9999),
    xp_total = xp_total + amount,
    xp_current_level = case when next_level >= 9999 then 0 else next_current end,
    xp_next_level = case when next_level >= 9999 then 999999999 else next_required end,
    weekly_xp = weekly_xp + amount,
    monthly_xp = monthly_xp + amount,
    streak_days = case
      when last_active_date = current_date then streak_days
      when last_active_date = current_date - interval '1 day' then streak_days + 1
      else 1
    end,
    last_active_date = current_date,
    updated_at = now()
  where user_id = target_user_id
  returning * into gamification_row;

  return gamification_row;
end;
$$;

revoke execute on function public.add_user_xp(uuid, integer, text, jsonb) from public;
revoke execute on function public.add_user_xp(uuid, integer, text, jsonb) from anon;
revoke execute on function public.add_user_xp(uuid, integer, text, jsonb) from authenticated;

-- ensure_user_gamification tambem barrava auth.uid() <> alvo; quando a recompensa vai para
-- outro usuario (autor que recebe a wave, quem convidou), auth.uid() e quem agiu. Mantem a
-- checagem para chamadas do client e libera quando apply_mission_increment (interno, nao
-- exposto) liga a flag local da transacao 'ocean.internal_call'.
create or replace function public.ensure_user_gamification(target_user_id uuid)
returns public.user_gamification
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.user_gamification;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if current_setting('ocean.internal_call', true) is distinct from 'on'
    and auth.uid() is not null
    and auth.uid() <> target_user_id then
    raise exception 'Cannot ensure gamification for another user';
  end if;

  insert into public.user_gamification (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  select *
  into result_row
  from public.user_gamification
  where user_id = target_user_id;

  return result_row;
end;
$$;

-- Mesma regra para a carteira de Fluxo Coin (044).
create or replace function public.ensure_user_coin_wallet(target_user_id uuid)
returns public.user_coin_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.user_coin_wallets;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if current_setting('ocean.internal_call', true) is distinct from 'on'
    and auth.uid() is not null
    and auth.uid() <> target_user_id then
    raise exception 'Cannot ensure wallet for another user';
  end if;

  insert into public.user_coin_wallets (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  select * into result_row from public.user_coin_wallets where user_id = target_user_id;

  return result_row;
end;
$$;

-- 4) Registro de eventos para deduplicar e aplicar teto diario.
create table if not exists public.mission_event_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  target_key text not null,
  period_key text not null,
  created_at timestamptz not null default now(),
  constraint mission_event_log_unique_target unique (user_id, event_type, target_key, period_key)
);

create index if not exists mission_event_log_user_day_idx
  on public.mission_event_log(user_id, event_type, created_at desc);

alter table public.mission_event_log enable row level security;
-- sem policies: so funcoes security definer leem/escrevem.

-- 5) Nucleo: aplica incremento numa missao (antigo corpo de increment_mission_progress, sem a
-- checagem de auth.uid(), que agora e interno).
create or replace function public.apply_mission_increment(
  target_user_id uuid,
  mission_row public.mission_definitions,
  increment_by integer,
  progress_metadata jsonb default '{}'::jsonb
)
returns public.user_mission_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  period text;
  progress_row public.user_mission_progress;
  was_completed boolean;
begin
  -- Libera ensure_user_gamification/ensure_user_coin_wallet para o usuario recompensado, que
  -- pode nao ser quem disparou a acao. Local a transacao; o client nao alcanca set_config.
  perform set_config('ocean.internal_call', 'on', true);

  period := public.ocean_mission_period_key(mission_row.cadence);

  insert into public.user_mission_progress (
    user_id, mission_id, period_key, current_value, target_value, metadata
  )
  values (
    target_user_id, mission_row.id, period, 0, mission_row.target_value, '{}'::jsonb
  )
  on conflict (user_id, mission_id, period_key) do nothing;

  select *
  into progress_row
  from public.user_mission_progress
  where user_id = target_user_id
    and mission_id = mission_row.id
    and period_key = period
  for update;

  was_completed := progress_row.is_completed;

  if was_completed then
    return progress_row;
  end if;

  update public.user_mission_progress
  set
    current_value = least(current_value + increment_by, target_value),
    is_completed = current_value + increment_by >= target_value,
    completed_at = case when current_value + increment_by >= target_value then now() else null end,
    updated_at = now()
  where id = progress_row.id
  returning * into progress_row;

  if progress_row.is_completed and not progress_row.reward_claimed then
    if mission_row.xp_reward > 0 then
      perform public.add_user_xp(target_user_id, mission_row.xp_reward, mission_row.slug, progress_metadata);
    end if;

    if mission_row.aura_reward_slug is not null then
      perform public.grant_user_aura(target_user_id, mission_row.aura_reward_slug, 'mission', mission_row.slug);
    end if;

    if mission_row.coin_reward > 0 then
      perform public.add_user_coins(target_user_id, mission_row.coin_reward, 'mission_reward', mission_row.title);
    end if;

    perform public.create_notification(
      target_user_id, 'mission_reward', null, null, mission_row.title
    );

    update public.user_mission_progress
    set reward_claimed = true,
        reward_claimed_at = now(),
        updated_at = now()
    where id = progress_row.id
    returning * into progress_row;
  end if;

  return progress_row;
end;
$$;

revoke execute on function public.apply_mission_increment(uuid, public.mission_definitions, integer, jsonb) from public;
revoke execute on function public.apply_mission_increment(uuid, public.mission_definitions, integer, jsonb) from anon;
revoke execute on function public.apply_mission_increment(uuid, public.mission_definitions, integer, jsonb) from authenticated;

-- 6) Ponto de entrada unico dos triggers: deduplica por alvo, aplica teto diario e incrementa
-- toda missao ativa daquele tipo. Retorna false quando o evento foi ignorado.
create or replace function public.track_mission_event(
  target_user_id uuid,
  mission_event_type text,
  event_target_key text,
  dedupe_scope text default 'daily',
  daily_cap integer default 50
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  period text;
  inserted_count integer;
  today_count integer;
  mission_row public.mission_definitions;
begin
  if target_user_id is null or mission_event_type is null or event_target_key is null then
    return false;
  end if;

  select count(*) into today_count
  from public.mission_event_log
  where user_id = target_user_id
    and mission_event_log.event_type = mission_event_type
    and created_at >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');

  if today_count >= daily_cap then
    return false;
  end if;

  period := public.ocean_mission_period_key(dedupe_scope);

  insert into public.mission_event_log (user_id, event_type, target_key, period_key)
  values (target_user_id, mission_event_type, event_target_key, period)
  on conflict (user_id, event_type, target_key, period_key) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    return false;
  end if;

  for mission_row in
    select *
    from public.mission_definitions
    where mission_type = mission_event_type
      and is_active = true
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
  loop
    perform public.apply_mission_increment(target_user_id, mission_row, 1);
  end loop;

  return true;
end;
$$;

revoke execute on function public.track_mission_event(uuid, text, text, text, integer) from public;
revoke execute on function public.track_mission_event(uuid, text, text, text, integer) from anon;
revoke execute on function public.track_mission_event(uuid, text, text, text, integer) from authenticated;

-- Presenca diaria: uma vez por dia, alimenta 'daily_active' e a sequencia 'daily_streak'.
create or replace function public.track_daily_presence(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
begin
  if public.track_mission_event(target_user_id, 'daily_active', today, 'daily', 1) then
    perform public.track_mission_event(target_user_id, 'daily_streak', today, 'daily', 1);
  end if;
end;
$$;

revoke execute on function public.track_daily_presence(uuid) from public;
revoke execute on function public.track_daily_presence(uuid) from anon;
revoke execute on function public.track_daily_presence(uuid) from authenticated;

-- 7) O client nao incrementa mais missao nem resgata recompensa por conta propria.
revoke execute on function public.increment_mission_progress(uuid, text, integer, jsonb) from authenticated;
revoke execute on function public.claim_mission_reward(uuid) from authenticated;

-- 8) Triggers.
create or replace function public.missions_on_content_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mentioned record;
  mention_count integer := 0;
begin
  perform public.track_daily_presence(new.author_id);

  if new.content_type = 'flow' then
    perform public.track_mission_event(new.author_id, 'create_flow', new.id::text, 'daily', 10);
  else
    perform public.track_mission_event(new.author_id, 'create_post', new.id::text, 'daily', 10);
  end if;

  -- Moments = publicacao com midia (o client nao grava a "superficie" moments no conteudo).
  if new.media_type in ('image', 'video') then
    perform public.track_mission_event(new.author_id, 'create_moments', new.id::text, 'daily', 10);
  end if;

  if new.text is not null and position('@' in new.text) > 0 then
    for mentioned in
      select distinct profiles.user_id
      from regexp_matches(new.text, '@([A-Za-z0-9._]{3,30})', 'g') as m(parts)
      join public.profiles on profiles.username = lower(m.parts[1])
      where profiles.user_id <> new.author_id
    loop
      mention_count := mention_count + 1;
      exit when mention_count > 10;
      perform public.track_mission_event(new.author_id, 'mention_people', mentioned.user_id::text, 'daily', 20);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists contents_missions on public.contents;
create trigger contents_missions
after insert on public.contents
for each row execute function public.missions_on_content_insert();

create or replace function public.missions_on_wave_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  content_author_id uuid;
begin
  select author_id into content_author_id from public.contents where id = new.content_id;

  if content_author_id is null or content_author_id = new.user_id then
    return new;
  end if;

  perform public.track_daily_presence(new.user_id);
  perform public.track_mission_event(new.user_id, 'create_wave', new.content_id::text, 'daily', 100);
  perform public.track_mission_event(
    content_author_id, 'receive_waves', new.user_id::text || ':' || new.content_id::text, 'daily', 500
  );

  return new;
end;
$$;

drop trigger if exists waves_missions on public.waves;
create trigger waves_missions
after insert on public.waves
for each row execute function public.missions_on_wave_insert();

create or replace function public.missions_on_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  content_author_id uuid;
begin
  select author_id into content_author_id from public.contents where id = new.content_id;

  if content_author_id is null or content_author_id = new.author_id then
    return new;
  end if;

  if char_length(regexp_replace(coalesce(new.text, ''), '\s', '', 'g')) < 5 then
    return new;
  end if;

  perform public.track_daily_presence(new.author_id);
  perform public.track_mission_event(new.author_id, 'create_comment', new.content_id::text, 'daily', 50);
  perform public.track_mission_event(
    content_author_id, 'receive_comments', new.author_id::text || ':' || new.content_id::text, 'daily', 300
  );

  return new;
end;
$$;

drop trigger if exists comments_missions on public.comments;
create trigger comments_missions
after insert on public.comments
for each row execute function public.missions_on_comment_insert();

create or replace function public.missions_on_follow_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'default_official' then
    return new;
  end if;

  -- 'once': seguir/deixar de seguir a mesma pessoa so conta uma vez na vida.
  perform public.track_mission_event(new.follower_id, 'follow_people', new.following_id::text, 'once', 100);
  perform public.track_mission_event(new.following_id, 'gain_fans', new.follower_id::text, 'once', 1000);

  return new;
end;
$$;

drop trigger if exists user_relationships_missions on public.user_relationships;
create trigger user_relationships_missions
after insert on public.user_relationships
for each row execute function public.missions_on_follow_insert();

create or replace function public.missions_on_community_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from 'active' then
    return new;
  end if;

  perform public.track_mission_event(new.user_id, 'join_communities', new.community_id::text, 'once', 20);

  return new;
end;
$$;

drop trigger if exists community_members_missions on public.community_members;
create trigger community_members_missions
after insert on public.community_members
for each row execute function public.missions_on_community_join();

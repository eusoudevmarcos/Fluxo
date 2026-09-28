-- Fluxo - pacote do beta de lancamento: migrations 046 a 057, na ordem.
-- Gerado a partir de packages/database/migrations (fonte da verdade).
--
-- PRE-REQUISITO: migrations 026-045 ja aplicadas (gamificacao, selos, notificacoes, Fluxo Coin).
-- COMO RODAR: Supabase > SQL Editor > colar tudo > Run. Rodar de uma vez: 053/054 chamam
-- is_blocked_between, criada na 055. Todas usam 'if not exists'/'create or replace' e podem
-- ser executadas de novo com seguranca.
--
-- IMPACTO AO APLICAR:
--   * 047 zera profile_required_completed de quem nao tem data de nascimento: todos (inclusive
--     fundador) passam uma vez pelo onboarding so para informar a data.
--   * Termos/privacidade mudaram de versao no app: todos aceitam de novo no proximo acesso.
--   * 056 habilita a extensao pg_net (push via Expo).
--
-- DEPOIS DE APLICAR, cadastrar as contas oficiais (aprovam criadores, moderam, veem metricas):
--   insert into public.official_accounts (user_id, kind, is_default_follow, is_founder, label)
--   select user_id, 'founder', true, true, 'Fundador'
--   from public.profiles where username = 'SEU_USERNAME'
--   on conflict (user_id) do nothing;


-- ============================================================
-- 046_disable_coin_gifting.sql
-- ============================================================

-- Fluxo Coin fica ativa apenas para ganhar/acumular por enquanto (missoes, niveis). Presentear
-- entre usuarios (presente 1-para-1) fica desativado ate o Fluxo Stream existir, quando o gasto
-- de moeda vira doacao em lives (estilo TikTok) em vez de transferencia livre entre pessoas.
-- A funcao continua definida para ser reativada mais tarde.
revoke execute on function public.gift_user_coins(uuid, bigint, text) from authenticated;


-- ============================================================
-- 047_profile_privacy_and_age_gate.sql
-- ============================================================

-- 1) Privacidade: profiles tem policy de select publica (using true), entao ate aqui qualquer
-- pessoa com a anon key lia location_lat/lng (6 casas = precisao de centimetros) e
-- biological_sex de todo mundo, apesar do onboarding prometer "coordenadas salvas de forma
-- privada". Troca o grant de tabela inteira por grant por coluna, deixando de fora as colunas
-- sensiveis. O proprio usuario le essas colunas so via get_my_private_profile().
--
-- ATENCAO para migrations futuras: toda coluna NOVA em profiles precisa de
--   grant select (nova_coluna) on public.profiles to anon, authenticated;
-- senao ela fica invisivel para o client.
do $$
declare
  public_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into public_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name not in (
      'location_lat',
      'location_lng',
      'location_accuracy_meters',
      'geolocation_consent_at',
      'geolocation_denied_at',
      'biological_sex'
    );

  revoke select on public.profiles from anon, authenticated;
  execute format('grant select (%s) on public.profiles to anon, authenticated', public_columns);
end $$;

-- 2) Idade (modelo TikTok adaptado): data de nascimento declarada uma unica vez, em tela neutra,
-- guardada fora de profiles. Menor de 14 e bloqueado e nao pode tentar de novo com outra data.
-- 14-15 e 16-17 recebem protecoes por padrao; o vinculo com responsavel (ECA Digital, ate 16)
-- fica em guardian_status ate existir o fluxo de e-mail para o responsavel aprovar.
create table if not exists public.user_age_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date not null,
  guardian_status text not null default 'not_required',
  declared_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_age_records_guardian_status_check') then
    alter table public.user_age_records
    add constraint user_age_records_guardian_status_check
    check (guardian_status in ('not_required', 'pending', 'approved'));
  end if;
end $$;

alter table public.user_age_records enable row level security;

drop policy if exists "users can read own age record" on public.user_age_records;

create policy "users can read own age record"
on public.user_age_records for select
using (user_id = auth.uid());

create table if not exists public.age_gate_blocks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  blocked_at timestamptz not null default now()
);

alter table public.age_gate_blocks enable row level security;

drop policy if exists "users can read own age block" on public.age_gate_blocks;

create policy "users can read own age block"
on public.age_gate_blocks for select
using (user_id = auth.uid());

-- 'adult' (18+), 'teen_16' (16-17), 'teen_14' (14-15), 'blocked' (<14) ou 'unknown' (ainda nao
-- declarou -- contas antigas). Interna: nao exposta ao client para nao vazar faixa etaria alheia.
create or replace function public.user_age_band(target_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  record_birth_date date;
  years integer;
begin
  if exists (select 1 from public.age_gate_blocks where user_id = target_user_id) then
    return 'blocked';
  end if;

  select birth_date into record_birth_date
  from public.user_age_records
  where user_id = target_user_id;

  if record_birth_date is null then
    return 'unknown';
  end if;

  years := extract(year from age(current_date, record_birth_date));

  return case
    when years >= 18 then 'adult'
    when years >= 16 then 'teen_16'
    when years >= 14 then 'teen_14'
    else 'blocked'
  end;
end;
$$;

revoke execute on function public.user_age_band(uuid) from public;
revoke execute on function public.user_age_band(uuid) from anon;
revoke execute on function public.user_age_band(uuid) from authenticated;

-- Retorna a faixa em vez de lancar erro no caso <14: um raise desfaria o insert do bloqueio.
create or replace function public.set_my_birth_date(input_birth_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  years integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Entre na Fluxo para continuar.';
  end if;

  if exists (select 1 from public.age_gate_blocks where user_id = current_user_id) then
    return 'blocked';
  end if;

  if exists (select 1 from public.user_age_records where user_id = current_user_id) then
    raise exception 'Sua data de nascimento já foi registrada. Fale com o suporte para corrigir.';
  end if;

  if input_birth_date is null
    or input_birth_date > current_date
    or input_birth_date < date '1900-01-01' then
    raise exception 'Informe uma data de nascimento válida.';
  end if;

  years := extract(year from age(current_date, input_birth_date));

  if years < 14 then
    insert into public.age_gate_blocks (user_id) values (current_user_id)
    on conflict (user_id) do nothing;
    return 'blocked';
  end if;

  insert into public.user_age_records (user_id, birth_date, guardian_status)
  values (
    current_user_id,
    input_birth_date,
    case when years < 16 then 'pending' else 'not_required' end
  );

  return public.user_age_band(current_user_id);
end;
$$;

revoke execute on function public.set_my_birth_date(date) from public;
revoke execute on function public.set_my_birth_date(date) from anon;
grant execute on function public.set_my_birth_date(date) to authenticated;

create or replace function public.get_my_private_profile()
returns table (
  location_lat numeric,
  location_lng numeric,
  location_accuracy_meters numeric,
  geolocation_consent_at timestamptz,
  geolocation_denied_at timestamptz,
  biological_sex text,
  birth_date date,
  age_band text,
  guardian_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.location_lat,
    profiles.location_lng,
    profiles.location_accuracy_meters,
    profiles.geolocation_consent_at,
    profiles.geolocation_denied_at,
    profiles.biological_sex,
    age_records.birth_date,
    public.user_age_band(auth.uid()),
    age_records.guardian_status
  from public.profiles
  left join public.user_age_records age_records on age_records.user_id = profiles.user_id
  where profiles.user_id = auth.uid();
$$;

revoke execute on function public.get_my_private_profile() from public;
revoke execute on function public.get_my_private_profile() from anon;
grant execute on function public.get_my_private_profile() to authenticated;

-- 3) Porta de entrada: o perfil so fica "completo" com data de nascimento valida. Todas as
-- guardas de rota (web e mobile) ja mandam para o onboarding quando profile_required_completed
-- e false, entao contas antigas sem data voltam ao onboarding (ja preenchido) so para informar
-- a data. Versoes antigas do app recebem a mensagem abaixo ao tentar concluir.
create or replace function public.enforce_age_before_profile_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.profile_required_completed is true
    and (tg_op = 'INSERT' or old.profile_required_completed is distinct from true)
    and not exists (select 1 from public.user_age_records where user_id = new.user_id) then
    raise exception 'Informe sua data de nascimento para continuar. Atualize o app se essa etapa não aparecer.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_age on public.profiles;
create trigger profiles_enforce_age
before insert or update of profile_required_completed on public.profiles
for each row execute function public.enforce_age_before_profile_completion();

update public.profiles
set profile_required_completed = false
where profile_required_completed = true
  and not exists (
    select 1 from public.user_age_records where user_age_records.user_id = profiles.user_id
  );


-- ============================================================
-- 048_server_side_mission_tracking.sql
-- ============================================================

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


-- ============================================================
-- 049_seal_history_and_campaigns.sql
-- ============================================================

-- Selos viram historico: todo selo conquistado fica registrado (exibido na bio como linha do
-- tempo de crescimento) e profile_verified_seals passa a guardar so o selo ATUAL, que e o de
-- maior patamar ja conquistado (em empate, o mais recente).
--
-- Campanhas de pioneiro ("os primeiros N") tem contador travado com FOR UPDATE, entao nunca
-- passam do limite mesmo com concessoes simultaneas, e fecham sozinhas quando a plataforma
-- chega ao limite de usuarios (100 mil). Depois disso so valem as regras permanentes (ex: azul
-- com 100 mil fas).

-- 1) Novos selos (arte ainda pendente -- campanhas deles nascem inativas).
alter table public.profile_verified_seals drop constraint if exists profile_verified_seals_seal_check;
alter table public.profile_verified_seals
add constraint profile_verified_seals_seal_check
check (seal in (
  'prime_user', 'azul', 'prime_influencer', 'roxo', 'gold', 'diamante', 'diamante_laranja', 'master', 'fundador'
));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
add constraint notifications_type_check
check (type in ('dahora', 'comment', 'wave', 'follow', 'mission_reward', 'coin_gift', 'seal_granted'));

create or replace function public.seal_rank(seal text)
returns integer
language sql
immutable
as $$
  select case seal
    when 'fundador' then 100
    when 'master' then 90
    when 'diamante_laranja' then 80
    when 'diamante' then 70
    when 'gold' then 60
    when 'roxo' then 50
    when 'prime_influencer' then 40
    when 'azul' then 30
    when 'prime_user' then 10
    else 0
  end;
$$;

-- 2) Historico publico de selos.
create table if not exists public.user_seal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seal text not null,
  campaign_slug text,
  granted_reason text,
  granted_at timestamptz not null default now(),
  constraint user_seal_history_unique_seal unique (user_id, seal),
  constraint user_seal_history_seal_check check (seal in (
    'prime_user', 'azul', 'prime_influencer', 'roxo', 'gold', 'diamante', 'diamante_laranja', 'master', 'fundador'
  ))
);

create index if not exists user_seal_history_user_idx on public.user_seal_history(user_id, granted_at);
create index if not exists user_seal_history_campaign_idx on public.user_seal_history(campaign_slug);

alter table public.user_seal_history enable row level security;

drop policy if exists "seal history is public" on public.user_seal_history;

create policy "seal history is public"
on public.user_seal_history for select
using (true);

-- Selos ja concedidos manualmente entram no historico.
insert into public.user_seal_history (user_id, seal, granted_reason, granted_at)
select user_id, seal, granted_reason, created_at
from public.profile_verified_seals
on conflict (user_id, seal) do nothing;

-- 3) Campanhas.
create table if not exists public.seal_campaigns (
  slug text primary key,
  seal text not null,
  title text not null,
  description text,
  max_grants integer not null,
  granted_count integer not null default 0,
  platform_user_limit integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seal_campaigns_count_check check (granted_count >= 0 and granted_count <= max_grants)
);

alter table public.seal_campaigns enable row level security;

drop policy if exists "seal campaigns are public" on public.seal_campaigns;

-- Publico: a UI mostra "restam X de 1000" para gerar escassez.
create policy "seal campaigns are public"
on public.seal_campaigns for select
using (true);

insert into public.seal_campaigns (slug, seal, title, description, max_grants, platform_user_limit, is_active)
values
  ('pioneiro_azul', 'azul', 'Pioneiro Azul',
   'Os 1.000 primeiros a ter 10 convites aceitos na Fluxo.', 1000, 100000, true),
  ('pioneiro_diamante', 'diamante', 'Diamante Pioneiro',
   'Os 100 primeiros influenciadores a chegar em 10 mil fãs.', 100, 100000, true),
  ('prime_user', 'prime_user', 'Prime',
   'Os 10 mil primeiros a trazer um amigo para a Fluxo.', 10000, 100000, false),
  ('prime_influencer', 'prime_influencer', 'Prime Influencer',
   'Os 5 mil primeiros criadores aprovados no programa de influenciadores.', 5000, null, false)
on conflict (slug) do update set
  seal = excluded.seal,
  title = excluded.title,
  description = excluded.description,
  max_grants = excluded.max_grants,
  platform_user_limit = excluded.platform_user_limit,
  updated_at = now();

-- 4) Recalcula o selo exibido.
create or replace function public.refresh_current_seal(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  top_seal record;
begin
  select seal, granted_reason
  into top_seal
  from public.user_seal_history
  where user_id = target_user_id
  order by public.seal_rank(seal) desc, granted_at desc
  limit 1;

  if top_seal.seal is null then
    delete from public.profile_verified_seals where user_id = target_user_id;
    return;
  end if;

  insert into public.profile_verified_seals (user_id, seal, granted_reason)
  values (target_user_id, top_seal.seal, top_seal.granted_reason)
  on conflict (user_id) do update set
    seal = excluded.seal,
    granted_reason = excluded.granted_reason,
    updated_at = now()
  where profile_verified_seals.seal is distinct from excluded.seal;
end;
$$;

revoke execute on function public.refresh_current_seal(uuid) from public;
revoke execute on function public.refresh_current_seal(uuid) from anon;
revoke execute on function public.refresh_current_seal(uuid) from authenticated;

-- Concessao unica de selo (interna). Retorna false se o usuario ja tinha esse selo.
create or replace function public.grant_seal(
  target_user_id uuid,
  seal_value text,
  source_campaign_slug text default null,
  reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.user_seal_history (user_id, seal, campaign_slug, granted_reason)
  values (target_user_id, seal_value, source_campaign_slug, reason)
  on conflict (user_id, seal) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    return false;
  end if;

  perform public.refresh_current_seal(target_user_id);
  perform public.create_notification(target_user_id, 'seal_granted', null, null, reason);

  return true;
end;
$$;

revoke execute on function public.grant_seal(uuid, text, text, text) from public;
revoke execute on function public.grant_seal(uuid, text, text, text) from anon;
revoke execute on function public.grant_seal(uuid, text, text, text) from authenticated;

-- Reserva uma vaga numa campanha e concede o selo. Interna: quem decide se o usuario cumpriu o
-- criterio e a funcao de elegibilidade de cada campanha.
create or replace function public.claim_seal_campaign(
  target_user_id uuid,
  target_campaign_slug text,
  reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_row public.seal_campaigns;
  platform_users bigint;
begin
  -- Checagem barata antes do lock: evita disputar a linha da campanha a cada novo fa de quem
  -- ja ganhou.
  if exists (
    select 1 from public.user_seal_history
    where user_id = target_user_id and campaign_slug = target_campaign_slug
  ) then
    return false;
  end if;

  select *
  into campaign_row
  from public.seal_campaigns
  where slug = target_campaign_slug
  for update;

  if campaign_row.slug is null or not campaign_row.is_active then
    return false;
  end if;

  if campaign_row.granted_count >= campaign_row.max_grants then
    update public.seal_campaigns set is_active = false, updated_at = now() where slug = campaign_row.slug;
    return false;
  end if;

  if campaign_row.platform_user_limit is not null then
    select count(*) into platform_users from public.profiles;

    if platform_users >= campaign_row.platform_user_limit then
      update public.seal_campaigns set is_active = false, updated_at = now() where slug = campaign_row.slug;
      return false;
    end if;
  end if;

  if not public.grant_seal(
    target_user_id, campaign_row.seal, campaign_row.slug, coalesce(reason, campaign_row.description)
  ) then
    return false;
  end if;

  update public.seal_campaigns
  set granted_count = granted_count + 1,
      updated_at = now()
  where slug = campaign_row.slug;

  return true;
end;
$$;

revoke execute on function public.claim_seal_campaign(uuid, text, text) from public;
revoke execute on function public.claim_seal_campaign(uuid, text, text) from anon;
revoke execute on function public.claim_seal_campaign(uuid, text, text) from authenticated;

-- 5) Elegibilidade por fas (substitui 042): Diamante Pioneiro aos 10 mil fas enquanto houver
-- vaga, e a regra permanente do azul aos 100 mil fas.
create or replace function public.grant_verified_seal_if_eligible(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fans_count integer;
begin
  if target_user_id is null then
    return;
  end if;

  if pg_trigger_depth() = 0 and auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Cannot check seal eligibility for another user';
  end if;

  select count(*) into fans_count
  from public.user_relationships
  where following_id = target_user_id;

  if fans_count >= 10000 then
    perform public.claim_seal_campaign(target_user_id, 'pioneiro_diamante', 'Entre os 100 primeiros a chegar em 10 mil fãs');
  end if;

  if fans_count >= 100000 then
    perform public.grant_seal(target_user_id, 'azul', null, 'Atingiu 100 mil fãs');
  end if;
end;
$$;

revoke execute on function public.grant_verified_seal_if_eligible(uuid) from public;
revoke execute on function public.grant_verified_seal_if_eligible(uuid) from anon;
grant execute on function public.grant_verified_seal_if_eligible(uuid) to authenticated;

-- Avalia no servidor a cada novo fa (antes dependia do app chamar a RPC).
create or replace function public.seals_on_follow_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.grant_verified_seal_if_eligible(new.following_id);
  return new;
end;
$$;

drop trigger if exists user_relationships_seals on public.user_relationships;
create trigger user_relationships_seals
after insert on public.user_relationships
for each row execute function public.seals_on_follow_insert();


-- ============================================================
-- 050_invites.sql
-- ============================================================

-- Convites limitados + link pessoal.
--
-- * Cada usuario tem um codigo pessoal (link fluxo/c/CODIGO) e comeca com 5 convites.
-- * Mais convites se ganham com engajamento: cada missao semanal concluida da +1 (ate 5 por semana).
-- * O convite so e "aceito" quando o convidado conclui o cadastro (com data de nascimento) numa
--   conta nova (ate 7 dias). Ai os dois passam a se seguir, quem convidou e notificado, avanca a
--   missao de convites e concorre as campanhas Prime (1o amigo) e Pioneiro Azul (10 aceitos).
-- * Protecao de menores: adulto e conta de 14-15 anos nao sao conectados automaticamente
--   (o convite conta, mas o seguir fica a criterio de cada um).

-- 1) Origem 'invite' em relacoes e novo tipo de notificacao.
alter table public.user_relationships drop constraint if exists user_relationships_source_check;
alter table public.user_relationships
add constraint user_relationships_source_check
check (source in ('manual', 'default_official', 'onboarding', 'invite'));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
add constraint notifications_type_check
check (type in (
  'dahora', 'comment', 'wave', 'follow', 'mission_reward', 'coin_gift', 'seal_granted', 'invite_accepted'
));

-- 2) Tabelas.
create table if not exists public.invite_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text unique not null,
  slots_total integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invite_codes_slots_check check (slots_total >= 0)
);

alter table public.invite_codes enable row level security;

drop policy if exists "users can read own invite code" on public.invite_codes;

create policy "users can read own invite code"
on public.invite_codes for select
using (user_id = auth.uid());

create table if not exists public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null,
  connected boolean not null default false,
  created_at timestamptz not null default now(),
  constraint invite_redemptions_not_self check (inviter_id <> invitee_id)
);

create index if not exists invite_redemptions_inviter_idx
  on public.invite_redemptions(inviter_id, created_at desc);

alter table public.invite_redemptions enable row level security;

drop policy if exists "users can read own invite redemptions" on public.invite_redemptions;

create policy "users can read own invite redemptions"
on public.invite_redemptions for select
using (inviter_id = auth.uid() or invitee_id = auth.uid());

-- 3) Codigo pessoal (8 caracteres, sem letras/numeros ambiguos como 0/O e 1/I).
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  -- gen_random_uuid e nativo (sem depender do schema do pgcrypto no Supabase). Bytes 6 e 8
  -- carregam versao/variante do UUID v4, entao so usa os totalmente aleatorios.
  random_bytes bytea := uuid_send(gen_random_uuid());
  byte_positions constant integer[] := array[0, 1, 2, 3, 4, 5, 10, 11];
  result text := '';
  byte_position integer;
begin
  foreach byte_position in array byte_positions loop
    result := result || substr(alphabet, (get_byte(random_bytes, byte_position) % 32) + 1, 1);
  end loop;

  return result;
end;
$$;

create or replace function public.ensure_invite_code(target_user_id uuid)
returns public.invite_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.invite_codes;
  attempt integer := 0;
begin
  select * into result_row from public.invite_codes where user_id = target_user_id;

  while result_row.user_id is null loop
    attempt := attempt + 1;

    begin
      insert into public.invite_codes (user_id, code)
      values (target_user_id, public.generate_invite_code())
      on conflict (user_id) do nothing;
    exception when unique_violation then
      -- colisao de codigo: tenta outro
      if attempt >= 5 then
        raise;
      end if;
    end;

    select * into result_row from public.invite_codes where user_id = target_user_id;
  end loop;

  return result_row;
end;
$$;

revoke execute on function public.ensure_invite_code(uuid) from public;
revoke execute on function public.ensure_invite_code(uuid) from anon;
revoke execute on function public.ensure_invite_code(uuid) from authenticated;

-- 4) Painel "meus convites".
create or replace function public.get_my_invite_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  code_row public.invite_codes;
  used_count integer;
  azul_campaign public.seal_campaigns;
begin
  if current_user_id is null then
    raise exception 'Entre na Fluxo para convidar amigos.';
  end if;

  code_row := public.ensure_invite_code(current_user_id);

  select count(*) into used_count
  from public.invite_redemptions
  where inviter_id = current_user_id;

  select * into azul_campaign from public.seal_campaigns where slug = 'pioneiro_azul';

  return jsonb_build_object(
    'code', code_row.code,
    'slots_total', code_row.slots_total,
    'slots_used', used_count,
    'slots_available', greatest(code_row.slots_total - used_count, 0),
    'pioneer_azul_target', 10,
    'pioneer_azul_active', coalesce(azul_campaign.is_active, false),
    'pioneer_azul_remaining', greatest(coalesce(azul_campaign.max_grants - azul_campaign.granted_count, 0), 0)
  );
end;
$$;

revoke execute on function public.get_my_invite_status() from public;
revoke execute on function public.get_my_invite_status() from anon;
grant execute on function public.get_my_invite_status() to authenticated;

-- 5) Pre-visualizacao publica do link (pagina /c/CODIGO, antes do cadastro). So dados publicos
-- do perfil de quem convidou.
create or replace function public.get_invite_preview(invite_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  code_row public.invite_codes;
  inviter record;
  used_count integer;
begin
  select * into code_row
  from public.invite_codes
  where code = upper(btrim(invite_code));

  if code_row.user_id is null then
    return null;
  end if;

  select username, display_name, avatar_url
  into inviter
  from public.profiles
  where user_id = code_row.user_id;

  select count(*) into used_count
  from public.invite_redemptions
  where inviter_id = code_row.user_id;

  return jsonb_build_object(
    'code', code_row.code,
    'username', inviter.username,
    'display_name', inviter.display_name,
    'avatar_url', inviter.avatar_url,
    'has_slots', used_count < code_row.slots_total
  );
end;
$$;

revoke execute on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- 6) Resgate do convite pelo convidado (chamado ao concluir o onboarding).
create or replace function public.redeem_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_invitee_id uuid := auth.uid();
  code_row public.invite_codes;
  used_count integer;
  accepted_count integer;
  invitee_created_at timestamptz;
  inviter_band text;
  invitee_band text;
  should_connect boolean;
  inviter_username text;
begin
  if current_invitee_id is null then
    raise exception 'Entre na Fluxo para usar um convite.';
  end if;

  select * into code_row
  from public.invite_codes
  where code = upper(btrim(invite_code))
  for update;

  if code_row.user_id is null then
    raise exception 'Código de convite inválido.';
  end if;

  if code_row.user_id = current_invitee_id then
    raise exception 'Você não pode usar o seu próprio convite.';
  end if;

  if exists (select 1 from public.invite_redemptions where invite_redemptions.invitee_id = current_invitee_id) then
    raise exception 'Você já entrou na Fluxo com um convite.';
  end if;

  if not exists (
    select 1 from public.profiles
    where user_id = current_invitee_id and profile_required_completed = true
  ) then
    raise exception 'Conclua seu cadastro antes de usar o convite.';
  end if;

  select created_at into invitee_created_at from auth.users where id = current_invitee_id;

  if invitee_created_at < now() - interval '7 days' then
    raise exception 'Convites valem só para contas novas.';
  end if;

  select count(*) into used_count
  from public.invite_redemptions
  where inviter_id = code_row.user_id;

  select username into inviter_username from public.profiles where user_id = code_row.user_id;

  if used_count >= code_row.slots_total then
    raise exception 'Os convites de @% acabaram por enquanto.', coalesce(inviter_username, 'fluxo');
  end if;

  inviter_band := public.user_age_band(code_row.user_id);
  invitee_band := public.user_age_band(current_invitee_id);
  should_connect := not (
    (inviter_band = 'adult' and invitee_band = 'teen_14')
    or (inviter_band = 'teen_14' and invitee_band = 'adult')
  );

  insert into public.invite_redemptions (inviter_id, invitee_id, code, connected)
  values (code_row.user_id, current_invitee_id, code_row.code, should_connect);

  if should_connect then
    insert into public.user_relationships (follower_id, following_id, source)
    values
      (current_invitee_id, code_row.user_id, 'invite'),
      (code_row.user_id, current_invitee_id, 'invite')
    on conflict (follower_id, following_id) do nothing;
  end if;

  perform public.create_notification(code_row.user_id, 'invite_accepted', current_invitee_id, null, null);

  -- Recompensas de quem convidou.
  perform public.track_mission_event(code_row.user_id, 'invite_accepted', current_invitee_id::text, 'once', 100);

  perform public.claim_seal_campaign(
    code_row.user_id, 'prime_user', 'Trouxe o primeiro amigo para a Fluxo'
  );

  accepted_count := used_count + 1;

  if accepted_count >= 10 then
    perform public.claim_seal_campaign(
      code_row.user_id, 'pioneiro_azul', 'Pioneiro: 10 amigos trazidos para a Fluxo'
    );
  end if;

  return jsonb_build_object(
    'inviter_username', inviter_username,
    'connected', should_connect
  );
end;
$$;

revoke execute on function public.redeem_invite(text) from public;
revoke execute on function public.redeem_invite(text) from anon;
grant execute on function public.redeem_invite(text) to authenticated;

-- 7) Missao semanal concluida = +1 convite.
alter table public.mission_definitions add column if not exists invite_slot_reward integer not null default 0;

update public.mission_definitions
set invite_slot_reward = 1
where cadence = 'weekly' and invite_slot_reward = 0;

create or replace function public.invite_slots_on_mission_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_reward integer;
begin
  if not new.is_completed or old.is_completed then
    return new;
  end if;

  select invite_slot_reward into slot_reward
  from public.mission_definitions
  where id = new.mission_id;

  if coalesce(slot_reward, 0) > 0 then
    perform public.ensure_invite_code(new.user_id);

    update public.invite_codes
    set slots_total = slots_total + slot_reward,
        updated_at = now()
    where user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists user_mission_progress_invite_slots on public.user_mission_progress;
create trigger user_mission_progress_invite_slots
after update of is_completed on public.user_mission_progress
for each row execute function public.invite_slots_on_mission_complete();

-- 8) A missao "Convidar 10 amigos" passa a contar convites ACEITOS (contados no servidor).
update public.mission_definitions
set mission_type = 'invite_accepted',
    title = '10 amigos na Fluxo',
    description = 'Traga 10 amigos para a Fluxo com o seu link de convite.'
where slug = 'weekly_invite_10_friends';


-- ============================================================
-- 051_mission_rotation.sql
-- ============================================================

-- Rotacao de missoes: cada pessoa recebe 3 missoes diarias e 5 semanais sorteadas do catalogo
-- (052), de acordo com a fase dela (novo / ativo / criador).
--
-- * O sorteio e deterministico (hash de usuario + periodo + missao) e fica gravado em
--   user_mission_assignments, entao nao muda se o catalogo mudar no meio do dia.
-- * No maximo uma missao por tipo em cada sorteio, para variar (nao cair 3 de "dar Waves").
-- * Contas de 14-17 anos nao recebem missoes de sequencia de dias (daily_streak): o ECA Digital
--   pede que o produto nao estimule uso compulsivo por adolescentes.
-- * So missoes sorteadas para a pessoa avancam; missoes fora da rotacao (in_rotation = false,
--   ex: desafios especiais) continuam valendo para todo mundo.

alter table public.mission_definitions add column if not exists in_rotation boolean not null default false;
alter table public.mission_definitions add column if not exists audience text not null default 'all';

alter table public.mission_definitions drop constraint if exists mission_definitions_audience_check;
alter table public.mission_definitions
add constraint mission_definitions_audience_check
check (audience in ('all', 'new', 'active', 'creator'));

create index if not exists mission_definitions_rotation_idx
  on public.mission_definitions(cadence, in_rotation, is_active);

-- As missoes antigas diarias/semanais entram na rotacao; o desafio secreto (500% da meta) segue fixo.
update public.mission_definitions
set in_rotation = true
where slug in (
  'daily_create_flow',
  'daily_create_moments',
  'daily_create_wave',
  'weekly_7_days',
  'weekly_join_5_communities',
  'weekly_invite_10_friends'
);

-- 10 convites aceitos numa semana e meta de quem ja tem rede, nao de quem acabou de chegar.
update public.mission_definitions
set audience = 'active'
where slug = 'weekly_invite_10_friends';

create table if not exists public.user_mission_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.mission_definitions(id) on delete cascade,
  period_key text not null,
  cadence text not null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, mission_id, period_key)
);

create index if not exists user_mission_assignments_user_period_idx
  on public.user_mission_assignments(user_id, period_key);

alter table public.user_mission_assignments enable row level security;

drop policy if exists "users can read own mission assignments" on public.user_mission_assignments;

create policy "users can read own mission assignments"
on public.user_mission_assignments for select
using (user_id = auth.uid());

-- Fase da pessoa: 'new' nos primeiros 7 dias, 'creator' com 1.000+ fas ou 30+ publicacoes,
-- senao 'active'.
create or replace function public.user_mission_stage(target_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  account_created_at timestamptz;
begin
  select created_at into account_created_at from auth.users where id = target_user_id;

  if account_created_at is null or account_created_at > now() - interval '7 days' then
    return 'new';
  end if;

  if (select count(*) from public.user_relationships where following_id = target_user_id) >= 1000
    or (select count(*) from public.contents where author_id = target_user_id) >= 30 then
    return 'creator';
  end if;

  return 'active';
end;
$$;

revoke execute on function public.user_mission_stage(uuid) from public;
revoke execute on function public.user_mission_stage(uuid) from anon;
revoke execute on function public.user_mission_stage(uuid) from authenticated;

create or replace function public.ensure_mission_assignments(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rotation record;
  period text;
  stage text;
  allowed_audiences text[];
  is_teen boolean;
begin
  if target_user_id is null then
    return;
  end if;

  for rotation in
    select * from (values ('daily', 3), ('weekly', 5)) as slots(cadence, amount)
  loop
    period := public.ocean_mission_period_key(rotation.cadence);

    if exists (
      select 1 from public.user_mission_assignments
      where user_id = target_user_id
        and period_key = period
        and cadence = rotation.cadence
    ) then
      continue;
    end if;

    -- Calculado so quando falta sorteio (uma vez por dia/semana por pessoa).
    if stage is null then
      stage := public.user_mission_stage(target_user_id);
      allowed_audiences := case stage
        when 'new' then array['all', 'new']
        when 'creator' then array['all', 'active', 'creator']
        else array['all', 'active']
      end;
      is_teen := public.user_age_band(target_user_id) in ('teen_14', 'teen_16');
    end if;

    insert into public.user_mission_assignments (user_id, mission_id, period_key, cadence)
    select target_user_id, picked.id, period, rotation.cadence
    from (
      select distinct on (mission_type)
        id,
        md5(target_user_id::text || period || id::text) as draw
      from public.mission_definitions
      where in_rotation = true
        and is_active = true
        and cadence = rotation.cadence
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
        and audience = any(allowed_audiences)
        and not (is_teen and mission_type = 'daily_streak')
      order by mission_type, md5(target_user_id::text || period || id::text)
    ) as picked
    order by picked.draw
    limit rotation.amount
    on conflict (user_id, mission_id, period_key) do nothing;
  end loop;
end;
$$;

revoke execute on function public.ensure_mission_assignments(uuid) from public;
revoke execute on function public.ensure_mission_assignments(uuid) from anon;
revoke execute on function public.ensure_mission_assignments(uuid) from authenticated;

-- Missoes da pessoa agora: as sorteadas no periodo atual + as fixas (fora da rotacao).
create or replace function public.get_my_current_missions()
returns setof public.mission_definitions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return;
  end if;

  perform public.ensure_mission_assignments(current_user_id);

  return query
  select missions.*
  from public.mission_definitions missions
  where missions.is_active = true
    and (missions.starts_at is null or missions.starts_at <= now())
    and (missions.ends_at is null or missions.ends_at >= now())
    and (
      missions.in_rotation = false
      or exists (
        select 1 from public.user_mission_assignments assignments
        where assignments.user_id = current_user_id
          and assignments.mission_id = missions.id
          and assignments.period_key = public.ocean_mission_period_key(missions.cadence)
      )
    )
  order by
    case missions.cadence when 'daily' then 0 when 'weekly' then 1 else 2 end,
    missions.xp_reward;
end;
$$;

revoke execute on function public.get_my_current_missions() from public;
revoke execute on function public.get_my_current_missions() from anon;
grant execute on function public.get_my_current_missions() to authenticated;

-- Progresso so do periodo atual (antes o app podia mostrar o progresso de ontem).
create or replace function public.get_my_current_mission_progress()
returns setof public.user_mission_progress
language sql
stable
security definer
set search_path = public
as $$
  select progress.*
  from public.user_mission_progress progress
  join public.mission_definitions missions on missions.id = progress.mission_id
  where progress.user_id = auth.uid()
    and progress.period_key = public.ocean_mission_period_key(missions.cadence);
$$;

revoke execute on function public.get_my_current_mission_progress() from public;
revoke execute on function public.get_my_current_mission_progress() from anon;
grant execute on function public.get_my_current_mission_progress() to authenticated;

-- track_mission_event (048) passa a respeitar o sorteio: missao de rotacao so avanca se foi
-- sorteada para a pessoa no periodo atual.
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

  perform public.ensure_mission_assignments(target_user_id);

  for mission_row in
    select missions.*
    from public.mission_definitions missions
    where missions.mission_type = mission_event_type
      and missions.is_active = true
      and (missions.starts_at is null or missions.starts_at <= now())
      and (missions.ends_at is null or missions.ends_at >= now())
      and (
        missions.in_rotation = false
        or exists (
          select 1 from public.user_mission_assignments assignments
          where assignments.user_id = target_user_id
            and assignments.mission_id = missions.id
            and assignments.period_key = public.ocean_mission_period_key(missions.cadence)
        )
      )
  loop
    perform public.apply_mission_increment(target_user_id, mission_row, 1);
  end loop;

  return true;
end;
$$;

revoke execute on function public.track_mission_event(uuid, text, text, text, integer) from public;
revoke execute on function public.track_mission_event(uuid, text, text, text, integer) from anon;
revoke execute on function public.track_mission_event(uuid, text, text, text, integer) from authenticated;


-- ============================================================
-- 052_mission_catalog_launch.sql
-- ============================================================

-- Catalogo de lancamento: 210 missoes (120 diarias + 90 semanais) para a rotacao (051).
-- Todas usam tipos contados no servidor (048/050). Metas respeitam os tetos anti-farm diarios
-- (ex: Waves ate 100/dia, comentarios ate 50/dia). Publico:
--   new     = primeiros 7 dias (metas baixas, nada que dependa de ja ter audiencia)
--   active  = pessoa ja ativa
--   creator = 1.000+ fas ou 30+ publicacoes (metas altas, missoes de audiencia)
--   all     = qualquer fase
-- Missao semanal concluida tambem libera +1 convite (invite_slot_reward, 050).

insert into public.mission_definitions (
  slug, title, description, mission_type, cadence, target_value, xp_reward, coin_reward,
  audience, in_rotation, invite_slot_reward, metadata
)
select
  catalog.slug,
  catalog.title,
  catalog.description,
  catalog.mission_type,
  catalog.cadence,
  catalog.target_value,
  catalog.xp_reward,
  catalog.coin_reward,
  catalog.audience,
  true,
  case when catalog.cadence = 'weekly' then 1 else 0 end,
  '{"catalog":"launch_v1"}'::jsonb
from (values
  -- ===================== DIARIAS (120) =====================
  -- Posts (12)
  ('d_post_01', 'Primeiros passos', 'Publique 1 post se apresentando para a Fluxo.', 'create_post', 'daily', 1, 50, 5, 'new'),
  ('d_post_02', 'Bom dia, Fluxo', 'Publique 1 post contando como começou seu dia.', 'create_post', 'daily', 1, 40, 4, 'all'),
  ('d_post_03', 'Opinião sincera', 'Publique 1 post com sua opinião sobre algo que está em alta.', 'create_post', 'daily', 1, 45, 4, 'all'),
  ('d_post_04', 'Dupla do dia', 'Publique 2 posts hoje.', 'create_post', 'daily', 2, 70, 6, 'all'),
  ('d_post_05', 'Recomendação quente', 'Publique 1 post recomendando uma música, série ou lugar.', 'create_post', 'daily', 1, 45, 4, 'all'),
  ('d_post_06', 'Pergunta pra galera', 'Publique 1 post com uma pergunta para seus fãs.', 'create_post', 'daily', 1, 45, 4, 'active'),
  ('d_post_07', 'Trinca de posts', 'Publique 3 posts hoje.', 'create_post', 'daily', 3, 100, 9, 'active'),
  ('d_post_08', 'Diário do flow', 'Publique 2 posts contando momentos do seu dia.', 'create_post', 'daily', 2, 70, 6, 'active'),
  ('d_post_09', 'Criador em ação', 'Publique 3 posts para manter seu perfil movimentado.', 'create_post', 'daily', 3, 110, 10, 'creator'),
  ('d_post_10', 'Bastidores', 'Publique 1 post mostrando os bastidores do que você faz.', 'create_post', 'daily', 1, 50, 5, 'creator'),
  ('d_post_11', 'Hot take', 'Publique 1 post com uma opinião que vai render conversa.', 'create_post', 'daily', 1, 50, 5, 'active'),
  ('d_post_12', 'Primeira palavra', 'Publique seu primeiro post do dia.', 'create_post', 'daily', 1, 40, 4, 'new'),
  -- Flows (10)
  ('d_flow_01', 'Solta o flow', 'Publique 1 Flow.', 'create_flow', 'daily', 1, 50, 5, 'all'),
  ('d_flow_02', 'Flow de estreia', 'Publique seu Flow do dia.', 'create_flow', 'daily', 1, 50, 5, 'new'),
  ('d_flow_03', 'Em movimento', 'Publique 2 Flows hoje.', 'create_flow', 'daily', 2, 90, 8, 'active'),
  ('d_flow_04', 'Tutorial rápido', 'Publique 1 Flow ensinando algo que você sabe fazer.', 'create_flow', 'daily', 1, 55, 5, 'all'),
  ('d_flow_05', 'Vibe do momento', 'Publique 1 Flow mostrando sua vibe de hoje.', 'create_flow', 'daily', 1, 50, 5, 'all'),
  ('d_flow_06', 'Maratona de Flows', 'Publique 3 Flows hoje.', 'create_flow', 'daily', 3, 130, 12, 'creator'),
  ('d_flow_07', 'Flow com trend', 'Publique 1 Flow entrando numa trend.', 'create_flow', 'daily', 1, 55, 5, 'active'),
  ('d_flow_08', 'Dobradinha', 'Publique 2 Flows para seus fãs.', 'create_flow', 'daily', 2, 95, 9, 'creator'),
  ('d_flow_09', 'Um dia na vida', 'Publique 1 Flow mostrando um pedaço do seu dia.', 'create_flow', 'daily', 1, 50, 5, 'all'),
  ('d_flow_10', 'Primeiro take', 'Publique 1 Flow, sem medo de errar.', 'create_flow', 'daily', 1, 50, 5, 'new'),
  -- Moments: publicacao com foto ou video (10)
  ('d_mom_01', 'Clique do dia', 'Publique 1 post com foto ou vídeo.', 'create_moments', 'daily', 1, 45, 4, 'all'),
  ('d_mom_02', 'Registro feliz', 'Publique 1 foto de algo que te fez sorrir hoje.', 'create_moments', 'daily', 1, 45, 4, 'all'),
  ('d_mom_03', 'Álbum do dia', 'Publique 2 posts com foto ou vídeo.', 'create_moments', 'daily', 2, 80, 7, 'active'),
  ('d_mom_04', 'Primeira foto', 'Publique sua primeira foto na Fluxo hoje.', 'create_moments', 'daily', 1, 45, 4, 'new'),
  ('d_mom_05', 'Look do dia', 'Publique 1 foto do seu look de hoje.', 'create_moments', 'daily', 1, 45, 4, 'all'),
  ('d_mom_06', 'Rolê registrado', 'Publique 1 foto ou vídeo do seu rolê.', 'create_moments', 'daily', 1, 45, 4, 'all'),
  ('d_mom_07', 'Galeria cheia', 'Publique 3 posts com foto ou vídeo.', 'create_moments', 'daily', 3, 115, 10, 'creator'),
  ('d_mom_08', 'Céu de hoje', 'Publique 1 foto do céu de hoje.', 'create_moments', 'daily', 1, 45, 4, 'all'),
  ('d_mom_09', 'Antes e depois', 'Publique 2 fotos mostrando uma transformação.', 'create_moments', 'daily', 2, 80, 7, 'active'),
  ('d_mom_10', 'Mesa posta', 'Publique 1 foto da sua comida favorita de hoje.', 'create_moments', 'daily', 1, 45, 4, 'all'),
  -- Dar Waves (18)
  ('d_wave_01', 'Primeiras ondas', 'Dê 3 Waves em posts de outras pessoas.', 'create_wave', 'daily', 3, 30, 3, 'new'),
  ('d_wave_02', 'Espalhando energia', 'Dê 5 Waves em posts de outras pessoas.', 'create_wave', 'daily', 5, 35, 3, 'all'),
  ('d_wave_03', 'Onda boa', 'Dê 5 Waves para dar boas-vindas ao feed.', 'create_wave', 'daily', 5, 35, 3, 'new'),
  ('d_wave_04', 'Maré alta', 'Dê 10 Waves em posts de outras pessoas.', 'create_wave', 'daily', 10, 50, 5, 'all'),
  ('d_wave_05', 'Surfista', 'Dê 10 Waves em posts que você curtiu de verdade.', 'create_wave', 'daily', 10, 50, 5, 'active'),
  ('d_wave_06', 'Tsunami de apoio', 'Dê 20 Waves em posts de outras pessoas.', 'create_wave', 'daily', 20, 80, 7, 'active'),
  ('d_wave_07', 'Radar ligado', 'Dê 8 Waves em posts de outras pessoas.', 'create_wave', 'daily', 8, 45, 4, 'all'),
  ('d_wave_08', 'Fã de carteirinha', 'Dê 15 Waves em posts de outras pessoas.', 'create_wave', 'daily', 15, 65, 6, 'active'),
  ('d_wave_09', 'Maremoto', 'Dê 25 Waves em posts de outras pessoas.', 'create_wave', 'daily', 25, 95, 9, 'creator'),
  ('d_wave_10', 'Ronda no feed', 'Dê 6 Waves em posts de outras pessoas.', 'create_wave', 'daily', 6, 40, 4, 'all'),
  ('d_wave_11', 'Curtida certeira', 'Dê 4 Waves em posts de outras pessoas.', 'create_wave', 'daily', 4, 32, 3, 'new'),
  ('d_wave_12', 'Vibrando junto', 'Dê 12 Waves em posts de outras pessoas.', 'create_wave', 'daily', 12, 55, 5, 'all'),
  ('d_wave_13', 'Onda sonora', 'Dê 7 Waves em posts de outras pessoas.', 'create_wave', 'daily', 7, 42, 4, 'all'),
  ('d_wave_14', 'Correnteza', 'Dê 18 Waves em posts de outras pessoas.', 'create_wave', 'daily', 18, 75, 7, 'active'),
  ('d_wave_15', 'Mar aberto', 'Dê 30 Waves em posts de outras pessoas.', 'create_wave', 'daily', 30, 110, 10, 'creator'),
  ('d_wave_16', 'Pequenas ondas', 'Dê 3 Waves em posts de outras pessoas.', 'create_wave', 'daily', 3, 30, 3, 'all'),
  ('d_wave_17', 'Boas-vindas em onda', 'Dê 5 Waves para receber bem a galera no feed.', 'create_wave', 'daily', 5, 35, 3, 'new'),
  ('d_wave_18', 'Onda gigante', 'Dê 40 Waves em posts de outras pessoas.', 'create_wave', 'daily', 40, 130, 12, 'creator'),
  -- Comentar (18) — comentario precisa de 5+ letras e ser em post de outra pessoa
  ('d_com_01', 'Puxa conversa', 'Comente em 1 post de outra pessoa.', 'create_comment', 'daily', 1, 35, 3, 'new'),
  ('d_com_02', 'Comentário de ouro', 'Deixe 1 comentário que faça o dia de alguém.', 'create_comment', 'daily', 1, 35, 3, 'all'),
  ('d_com_03', 'Papo reto', 'Comente em 2 posts de outras pessoas.', 'create_comment', 'daily', 2, 50, 5, 'all'),
  ('d_com_04', 'Tagarela', 'Comente em 3 posts de outras pessoas.', 'create_comment', 'daily', 3, 65, 6, 'all'),
  ('d_com_05', 'Conversa boa', 'Comente em 3 posts puxando assunto.', 'create_comment', 'daily', 3, 65, 6, 'active'),
  ('d_com_06', 'Debatedor', 'Comente em 5 posts de outras pessoas.', 'create_comment', 'daily', 5, 90, 8, 'active'),
  ('d_com_07', 'Opinião na roda', 'Comente em 2 posts dando sua opinião.', 'create_comment', 'daily', 2, 50, 5, 'new'),
  ('d_com_08', 'Elogio sincero', 'Deixe 2 comentários elogiando posts de outras pessoas.', 'create_comment', 'daily', 2, 50, 5, 'all'),
  ('d_com_09', 'Rei dos comentários', 'Comente em 8 posts de outras pessoas.', 'create_comment', 'daily', 8, 120, 11, 'creator'),
  ('d_com_10', 'Resenha', 'Comente em 4 posts de outras pessoas.', 'create_comment', 'daily', 4, 75, 7, 'active'),
  ('d_com_11', 'Voz ativa', 'Comente em 6 posts de outras pessoas.', 'create_comment', 'daily', 6, 100, 9, 'creator'),
  ('d_com_12', 'Pergunta curiosa', 'Comente em 2 posts fazendo uma pergunta ao autor.', 'create_comment', 'daily', 2, 50, 5, 'all'),
  ('d_com_13', 'Conselheiro', 'Comente em 3 posts dando uma dica.', 'create_comment', 'daily', 3, 65, 6, 'all'),
  ('d_com_14', 'Primeira resposta', 'Responda 1 post de alguém com um comentário.', 'create_comment', 'daily', 1, 35, 3, 'new'),
  ('d_com_15', 'Engajador', 'Comente em 10 posts de outras pessoas.', 'create_comment', 'daily', 10, 140, 13, 'creator'),
  ('d_com_16', 'Troca de ideia', 'Comente em 4 posts de outras pessoas.', 'create_comment', 'daily', 4, 75, 7, 'all'),
  ('d_com_17', 'Apoio nos comentários', 'Comente em 3 posts apoiando quem postou.', 'create_comment', 'daily', 3, 65, 6, 'active'),
  ('d_com_18', 'Comentarista', 'Comente em 5 posts de outras pessoas.', 'create_comment', 'daily', 5, 90, 8, 'all'),
  -- Marcar pessoas com @ (10)
  ('d_men_01', 'Chama o amigo', 'Marque 1 pessoa (@) em um post seu.', 'mention_people', 'daily', 1, 35, 3, 'new'),
  ('d_men_02', 'Marca a galera', 'Marque 2 pessoas (@) nos seus posts.', 'mention_people', 'daily', 2, 45, 4, 'all'),
  ('d_men_03', 'Bonde marcado', 'Marque 3 pessoas (@) nos seus posts.', 'mention_people', 'daily', 3, 60, 5, 'all'),
  ('d_men_04', 'Menção honrosa', 'Marque 1 pessoa (@) que merece destaque.', 'mention_people', 'daily', 1, 35, 3, 'all'),
  ('d_men_05', 'Squad completo', 'Marque 5 pessoas (@) nos seus posts.', 'mention_people', 'daily', 5, 85, 8, 'active'),
  ('d_men_06', 'Collab', 'Marque 2 criadores (@) em um post de parceria.', 'mention_people', 'daily', 2, 50, 5, 'creator'),
  ('d_men_07', 'Chamada geral', 'Marque 4 pessoas (@) nos seus posts.', 'mention_people', 'daily', 4, 70, 6, 'active'),
  ('d_men_08', 'Parceria', 'Marque 1 criador (@) com quem você quer colaborar.', 'mention_people', 'daily', 1, 40, 4, 'creator'),
  ('d_men_09', 'Te vi aqui', 'Marque 2 amigos (@) que já estão na Fluxo.', 'mention_people', 'daily', 2, 45, 4, 'new'),
  ('d_men_10', 'Rede de amigos', 'Marque 3 pessoas (@) nos seus posts.', 'mention_people', 'daily', 3, 60, 5, 'all'),
  -- Seguir pessoas (14)
  ('d_fol_01', 'Primeiro seleto', 'Siga 1 pessoa nova.', 'follow_people', 'daily', 1, 30, 3, 'new'),
  ('d_fol_02', 'Novas conexões', 'Siga 2 pessoas novas.', 'follow_people', 'daily', 2, 40, 4, 'new'),
  ('d_fol_03', 'Radar de talentos', 'Siga 3 pessoas novas.', 'follow_people', 'daily', 3, 50, 5, 'all'),
  ('d_fol_04', 'Círculo crescendo', 'Siga 5 pessoas novas.', 'follow_people', 'daily', 5, 70, 6, 'all'),
  ('d_fol_05', 'Explorador', 'Siga 3 pessoas que você encontrou explorando a Fluxo.', 'follow_people', 'daily', 3, 50, 5, 'new'),
  ('d_fol_06', 'Garimpeiro', 'Siga 5 pessoas novas.', 'follow_people', 'daily', 5, 70, 6, 'active'),
  ('d_fol_07', 'Seguindo a onda', 'Siga 2 pessoas novas.', 'follow_people', 'daily', 2, 40, 4, 'all'),
  ('d_fol_08', 'Descobridor', 'Siga 4 pessoas novas.', 'follow_people', 'daily', 4, 60, 5, 'all'),
  ('d_fol_09', 'Rede em expansão', 'Siga 8 pessoas novas.', 'follow_people', 'daily', 8, 90, 8, 'active'),
  ('d_fol_10', 'Olho vivo', 'Siga 3 pessoas novas.', 'follow_people', 'daily', 3, 50, 5, 'all'),
  ('d_fol_11', 'Conexão do dia', 'Siga 1 pessoa nova.', 'follow_people', 'daily', 1, 30, 3, 'all'),
  ('d_fol_12', 'Colecionador de flows', 'Siga 6 pessoas novas.', 'follow_people', 'daily', 6, 80, 7, 'active'),
  ('d_fol_13', 'Mente aberta', 'Siga 4 pessoas de fora da sua bolha.', 'follow_people', 'daily', 4, 60, 5, 'all'),
  ('d_fol_14', 'Networking', 'Siga 10 pessoas novas.', 'follow_people', 'daily', 10, 110, 10, 'creator'),
  -- Receber Waves (10)
  ('d_rw_01', 'Onda de volta', 'Receba 3 Waves nos seus posts.', 'receive_waves', 'daily', 3, 40, 4, 'active'),
  ('d_rw_02', 'Repercussão', 'Receba 5 Waves nos seus posts.', 'receive_waves', 'daily', 5, 50, 5, 'active'),
  ('d_rw_03', 'Bombando', 'Receba 10 Waves nos seus posts.', 'receive_waves', 'daily', 10, 75, 7, 'active'),
  ('d_rw_04', 'Viralizando', 'Receba 20 Waves nos seus posts.', 'receive_waves', 'daily', 20, 110, 10, 'creator'),
  ('d_rw_05', 'Em alta', 'Receba 30 Waves nos seus posts.', 'receive_waves', 'daily', 30, 140, 13, 'creator'),
  ('d_rw_06', 'Recebendo carinho', 'Receba 5 Waves nos seus posts.', 'receive_waves', 'daily', 5, 50, 5, 'active'),
  ('d_rw_07', 'Aplausos', 'Receba 8 Waves nos seus posts.', 'receive_waves', 'daily', 8, 65, 6, 'active'),
  ('d_rw_08', 'Hit do dia', 'Receba 50 Waves nos seus posts.', 'receive_waves', 'daily', 50, 180, 16, 'creator'),
  ('d_rw_09', 'Estrela do feed', 'Receba 15 Waves nos seus posts.', 'receive_waves', 'daily', 15, 90, 8, 'creator'),
  ('d_rw_10', 'Energia recebida', 'Receba 4 Waves nos seus posts.', 'receive_waves', 'daily', 4, 45, 4, 'active'),
  -- Receber comentarios (8)
  ('d_rc_01', 'Gerou conversa', 'Receba 1 comentário em um post seu.', 'receive_comments', 'daily', 1, 40, 4, 'active'),
  ('d_rc_02', 'Roda de conversa', 'Receba 2 comentários nos seus posts.', 'receive_comments', 'daily', 2, 55, 5, 'active'),
  ('d_rc_03', 'Assunto do dia', 'Receba 3 comentários nos seus posts.', 'receive_comments', 'daily', 3, 70, 6, 'active'),
  ('d_rc_04', 'Debate aberto', 'Receba 5 comentários nos seus posts.', 'receive_comments', 'daily', 5, 95, 9, 'creator'),
  ('d_rc_05', 'Caixa cheia', 'Receba 8 comentários nos seus posts.', 'receive_comments', 'daily', 8, 130, 12, 'creator'),
  ('d_rc_06', 'Alguém respondeu', 'Receba 1 comentário em um post seu.', 'receive_comments', 'daily', 1, 40, 4, 'active'),
  ('d_rc_07', 'Papo animado', 'Receba 4 comentários nos seus posts.', 'receive_comments', 'daily', 4, 80, 7, 'creator'),
  ('d_rc_08', 'Resenha garantida', 'Receba 10 comentários nos seus posts.', 'receive_comments', 'daily', 10, 150, 14, 'creator'),
  -- Ganhar fas (6)
  ('d_fan_01', 'Novo fã', 'Ganhe 1 fã novo hoje.', 'gain_fans', 'daily', 1, 50, 5, 'active'),
  ('d_fan_02', 'Dois fãs', 'Ganhe 2 fãs novos hoje.', 'gain_fans', 'daily', 2, 70, 6, 'active'),
  ('d_fan_03', 'Crescendo', 'Ganhe 3 fãs novos hoje.', 'gain_fans', 'daily', 3, 90, 8, 'active'),
  ('d_fan_04', 'Fã-clube', 'Ganhe 5 fãs novos hoje.', 'gain_fans', 'daily', 5, 120, 11, 'creator'),
  ('d_fan_05', 'Multidão', 'Ganhe 10 fãs novos hoje.', 'gain_fans', 'daily', 10, 170, 15, 'creator'),
  ('d_fan_06', 'Primeiro fã do dia', 'Ganhe 1 fã novo hoje.', 'gain_fans', 'daily', 1, 50, 5, 'creator'),
  -- Comunidades (4)
  ('d_comm_01', 'Ache sua tribo', 'Entre em 1 comunidade.', 'join_communities', 'daily', 1, 40, 4, 'new'),
  ('d_comm_02', 'Nova comunidade', 'Entre em 1 comunidade nova.', 'join_communities', 'daily', 1, 40, 4, 'all'),
  ('d_comm_03', 'Explorando comunidades', 'Entre em 2 comunidades.', 'join_communities', 'daily', 2, 60, 6, 'new'),
  ('d_comm_04', 'Cidadão da Fluxo', 'Entre em 2 comunidades novas.', 'join_communities', 'daily', 2, 60, 6, 'all'),

  -- ===================== SEMANAIS (90) =====================
  -- Posts (8)
  ('w_post_01', 'Semana ativa', 'Publique 5 posts nesta semana.', 'create_post', 'weekly', 5, 200, 20, 'all'),
  ('w_post_02', 'Presença constante', 'Publique 7 posts nesta semana.', 'create_post', 'weekly', 7, 260, 25, 'active'),
  ('w_post_03', 'Voz da semana', 'Publique 10 posts nesta semana.', 'create_post', 'weekly', 10, 340, 32, 'creator'),
  ('w_post_04', 'Começando forte', 'Publique 3 posts nesta semana.', 'create_post', 'weekly', 3, 150, 15, 'new'),
  ('w_post_05', 'Cronista', 'Publique 8 posts nesta semana.', 'create_post', 'weekly', 8, 290, 28, 'active'),
  ('w_post_06', 'Feed vivo', 'Publique 12 posts nesta semana.', 'create_post', 'weekly', 12, 380, 36, 'creator'),
  ('w_post_07', 'Uma por dia', 'Publique 7 posts nesta semana (que tal um por dia?).', 'create_post', 'weekly', 7, 260, 25, 'all'),
  ('w_post_08', 'Primeira semana', 'Publique 4 posts na sua primeira semana.', 'create_post', 'weekly', 4, 170, 17, 'new'),
  -- Flows (8)
  ('w_flow_01', 'Semana de Flows', 'Publique 5 Flows nesta semana.', 'create_flow', 'weekly', 5, 230, 22, 'all'),
  ('w_flow_02', 'Diretor', 'Publique 7 Flows nesta semana.', 'create_flow', 'weekly', 7, 290, 28, 'active'),
  ('w_flow_03', 'Produtora', 'Publique 10 Flows nesta semana.', 'create_flow', 'weekly', 10, 380, 36, 'creator'),
  ('w_flow_04', 'Flows de estreia', 'Publique 3 Flows nesta semana.', 'create_flow', 'weekly', 3, 170, 17, 'new'),
  ('w_flow_05', 'Série da semana', 'Publique 4 Flows sobre um mesmo tema.', 'create_flow', 'weekly', 4, 200, 20, 'all'),
  ('w_flow_06', 'Ritmo de criador', 'Publique 14 Flows nesta semana.', 'create_flow', 'weekly', 14, 460, 44, 'creator'),
  ('w_flow_07', 'Consistência', 'Publique 6 Flows nesta semana.', 'create_flow', 'weekly', 6, 260, 25, 'active'),
  ('w_flow_08', 'Cinco takes', 'Publique 5 Flows nesta semana.', 'create_flow', 'weekly', 5, 230, 22, 'all'),
  -- Moments (8)
  ('w_mom_01', 'Álbum da semana', 'Publique 5 posts com foto ou vídeo nesta semana.', 'create_moments', 'weekly', 5, 210, 20, 'all'),
  ('w_mom_02', 'Fotógrafo', 'Publique 7 posts com foto ou vídeo nesta semana.', 'create_moments', 'weekly', 7, 270, 26, 'active'),
  ('w_mom_03', 'Galeria', 'Publique 10 posts com foto ou vídeo nesta semana.', 'create_moments', 'weekly', 10, 350, 33, 'creator'),
  ('w_mom_04', 'Primeiros registros', 'Publique 3 posts com foto ou vídeo nesta semana.', 'create_moments', 'weekly', 3, 150, 15, 'new'),
  ('w_mom_05', 'Diário visual', 'Publique 7 fotos ou vídeos nesta semana (que tal um por dia?).', 'create_moments', 'weekly', 7, 270, 26, 'all'),
  ('w_mom_06', 'Portfólio', 'Publique 12 posts com foto ou vídeo nesta semana.', 'create_moments', 'weekly', 12, 400, 38, 'creator'),
  ('w_mom_07', 'Memórias', 'Publique 4 posts com foto ou vídeo nesta semana.', 'create_moments', 'weekly', 4, 180, 18, 'new'),
  ('w_mom_08', 'Registro de rolê', 'Publique 6 fotos ou vídeos dos seus rolês.', 'create_moments', 'weekly', 6, 240, 23, 'active'),
  -- Dar Waves (10)
  ('w_wave_01', 'Semana de apoio', 'Dê 30 Waves em posts de outras pessoas.', 'create_wave', 'weekly', 30, 180, 17, 'all'),
  ('w_wave_02', 'Maré cheia', 'Dê 50 Waves em posts de outras pessoas.', 'create_wave', 'weekly', 50, 240, 23, 'active'),
  ('w_wave_03', 'Oceano', 'Dê 100 Waves em posts de outras pessoas.', 'create_wave', 'weekly', 100, 380, 36, 'creator'),
  ('w_wave_04', 'Primeiras marés', 'Dê 20 Waves em posts de outras pessoas.', 'create_wave', 'weekly', 20, 150, 15, 'new'),
  ('w_wave_05', 'Onda contínua', 'Dê 40 Waves em posts de outras pessoas.', 'create_wave', 'weekly', 40, 210, 20, 'all'),
  ('w_wave_06', 'Fã número 1', 'Dê 60 Waves em posts de outras pessoas.', 'create_wave', 'weekly', 60, 270, 26, 'active'),
  ('w_wave_07', 'Corrente do bem', 'Dê 25 Waves em posts de outras pessoas.', 'create_wave', 'weekly', 25, 165, 16, 'new'),
  ('w_wave_08', 'Tempestade', 'Dê 150 Waves em posts de outras pessoas.', 'create_wave', 'weekly', 150, 480, 45, 'creator'),
  ('w_wave_09', 'Ressaca', 'Dê 80 Waves em posts de outras pessoas.', 'create_wave', 'weekly', 80, 320, 30, 'active'),
  ('w_wave_10', 'Mergulho', 'Dê 35 Waves em posts de outras pessoas.', 'create_wave', 'weekly', 35, 195, 19, 'all'),
  -- Comentar (10)
  ('w_com_01', 'Conversador', 'Comente em 10 posts de outras pessoas.', 'create_comment', 'weekly', 10, 220, 21, 'all'),
  ('w_com_02', 'Comunidade viva', 'Comente em 15 posts de outras pessoas.', 'create_comment', 'weekly', 15, 280, 27, 'active'),
  ('w_com_03', 'Voz do feed', 'Comente em 30 posts de outras pessoas.', 'create_comment', 'weekly', 30, 440, 42, 'creator'),
  ('w_com_04', 'Primeiros papos', 'Comente em 5 posts de outras pessoas.', 'create_comment', 'weekly', 5, 160, 16, 'new'),
  ('w_com_05', 'Semana de resenha', 'Comente em 20 posts de outras pessoas.', 'create_comment', 'weekly', 20, 340, 32, 'active'),
  ('w_com_06', 'Bom de papo', 'Comente em 12 posts de outras pessoas.', 'create_comment', 'weekly', 12, 250, 24, 'all'),
  ('w_com_07', 'Presente nos comentários', 'Comente em 8 posts de outras pessoas.', 'create_comment', 'weekly', 8, 200, 19, 'new'),
  ('w_com_08', 'Anfitrião', 'Comente em 25 posts de outras pessoas.', 'create_comment', 'weekly', 25, 390, 37, 'creator'),
  ('w_com_09', 'Ouvinte', 'Comente em 10 posts respondendo o que a pessoa contou.', 'create_comment', 'weekly', 10, 220, 21, 'all'),
  ('w_com_10', 'Mestre da resenha', 'Comente em 40 posts de outras pessoas.', 'create_comment', 'weekly', 40, 520, 50, 'creator'),
  -- Marcar pessoas (6)
  ('w_men_01', 'Marcador oficial', 'Marque 5 pessoas (@) nos seus posts nesta semana.', 'mention_people', 'weekly', 5, 180, 17, 'all'),
  ('w_men_02', 'Bonde da semana', 'Marque 10 pessoas (@) nos seus posts nesta semana.', 'mention_people', 'weekly', 10, 250, 24, 'active'),
  ('w_men_03', 'Rede de collabs', 'Marque 15 pessoas (@) nos seus posts nesta semana.', 'mention_people', 'weekly', 15, 320, 30, 'creator'),
  ('w_men_04', 'Trazendo amigos', 'Marque 3 amigos (@) nos seus posts nesta semana.', 'mention_people', 'weekly', 3, 140, 14, 'new'),
  ('w_men_05', 'Chama geral', 'Marque 8 pessoas (@) nos seus posts nesta semana.', 'mention_people', 'weekly', 8, 220, 21, 'all'),
  ('w_men_06', 'Conector', 'Marque 20 pessoas (@) nos seus posts nesta semana.', 'mention_people', 'weekly', 20, 380, 36, 'creator'),
  -- Seguir pessoas (8)
  ('w_fol_01', 'Rede crescendo', 'Siga 10 pessoas novas nesta semana.', 'follow_people', 'weekly', 10, 200, 19, 'all'),
  ('w_fol_02', 'Descobertas da semana', 'Siga 15 pessoas novas nesta semana.', 'follow_people', 'weekly', 15, 250, 24, 'active'),
  ('w_fol_03', 'Explorador nato', 'Siga 5 pessoas novas nesta semana.', 'follow_people', 'weekly', 5, 150, 15, 'new'),
  ('w_fol_04', 'Caçador de talentos', 'Siga 20 pessoas novas nesta semana.', 'follow_people', 'weekly', 20, 300, 28, 'active'),
  ('w_fol_05', 'Primeiros seletos', 'Siga 8 pessoas novas nesta semana.', 'follow_people', 'weekly', 8, 180, 17, 'new'),
  ('w_fol_06', 'Sempre de olho', 'Siga 12 pessoas novas nesta semana.', 'follow_people', 'weekly', 12, 220, 21, 'all'),
  ('w_fol_07', 'Conexões de criador', 'Siga 25 pessoas novas nesta semana.', 'follow_people', 'weekly', 25, 340, 32, 'creator'),
  ('w_fol_08', 'Networking semanal', 'Siga 30 pessoas novas nesta semana.', 'follow_people', 'weekly', 30, 380, 36, 'creator'),
  -- Receber Waves (8)
  ('w_rw_01', 'Semana em alta', 'Receba 30 Waves nos seus posts nesta semana.', 'receive_waves', 'weekly', 30, 250, 24, 'active'),
  ('w_rw_02', 'Repercutiu', 'Receba 50 Waves nos seus posts nesta semana.', 'receive_waves', 'weekly', 50, 320, 30, 'active'),
  ('w_rw_03', 'Viral', 'Receba 100 Waves nos seus posts nesta semana.', 'receive_waves', 'weekly', 100, 450, 43, 'creator'),
  ('w_rw_04', 'Fenômeno', 'Receba 200 Waves nos seus posts nesta semana.', 'receive_waves', 'weekly', 200, 600, 57, 'creator'),
  ('w_rw_05', 'Carinho da galera', 'Receba 20 Waves nos seus posts nesta semana.', 'receive_waves', 'weekly', 20, 210, 20, 'active'),
  ('w_rw_06', 'Reconhecido', 'Receba 75 Waves nos seus posts nesta semana.', 'receive_waves', 'weekly', 75, 380, 36, 'creator'),
  ('w_rw_07', 'Retorno garantido', 'Receba 40 Waves nos seus posts nesta semana.', 'receive_waves', 'weekly', 40, 290, 27, 'active'),
  ('w_rw_08', 'Hit da semana', 'Receba 150 Waves nos seus posts nesta semana.', 'receive_waves', 'weekly', 150, 520, 50, 'creator'),
  -- Receber comentarios (6)
  ('w_rc_01', 'Assunto da semana', 'Receba 5 comentários nos seus posts nesta semana.', 'receive_comments', 'weekly', 5, 230, 22, 'active'),
  ('w_rc_02', 'Caixa de comentários', 'Receba 10 comentários nos seus posts nesta semana.', 'receive_comments', 'weekly', 10, 300, 28, 'active'),
  ('w_rc_03', 'Fórum aberto', 'Receba 20 comentários nos seus posts nesta semana.', 'receive_comments', 'weekly', 20, 400, 38, 'creator'),
  ('w_rc_04', 'Conversa em alta', 'Receba 15 comentários nos seus posts nesta semana.', 'receive_comments', 'weekly', 15, 350, 33, 'creator'),
  ('w_rc_05', 'Alguém tá ouvindo', 'Receba 3 comentários nos seus posts nesta semana.', 'receive_comments', 'weekly', 3, 180, 17, 'active'),
  ('w_rc_06', 'Palco', 'Receba 30 comentários nos seus posts nesta semana.', 'receive_comments', 'weekly', 30, 500, 48, 'creator'),
  -- Ganhar fas (6)
  ('w_fan_01', 'Fã-clube em formação', 'Ganhe 5 fãs novos nesta semana.', 'gain_fans', 'weekly', 5, 280, 27, 'active'),
  ('w_fan_02', 'Base crescendo', 'Ganhe 10 fãs novos nesta semana.', 'gain_fans', 'weekly', 10, 360, 34, 'active'),
  ('w_fan_03', 'Legião', 'Ganhe 25 fãs novos nesta semana.', 'gain_fans', 'weekly', 25, 480, 46, 'creator'),
  ('w_fan_04', 'Multidão semanal', 'Ganhe 50 fãs novos nesta semana.', 'gain_fans', 'weekly', 50, 620, 60, 'creator'),
  ('w_fan_05', 'Primeiros fãs', 'Ganhe 3 fãs novos nesta semana.', 'gain_fans', 'weekly', 3, 220, 21, 'all'),
  ('w_fan_06', 'Ímã de fãs', 'Ganhe 15 fãs novos nesta semana.', 'gain_fans', 'weekly', 15, 420, 40, 'creator'),
  -- Comunidades (4)
  ('w_comm_01', 'Tribos', 'Entre em 3 comunidades nesta semana.', 'join_communities', 'weekly', 3, 180, 17, 'new'),
  ('w_comm_02', 'Cidadão das comunidades', 'Entre em 5 comunidades nesta semana.', 'join_communities', 'weekly', 5, 240, 23, 'all'),
  ('w_comm_03', 'Explorador de comunidades', 'Entre em 4 comunidades nesta semana.', 'join_communities', 'weekly', 4, 210, 20, 'all'),
  ('w_comm_04', 'Nômade', 'Entre em 7 comunidades nesta semana.', 'join_communities', 'weekly', 7, 300, 28, 'active'),
  -- Convites aceitos (4)
  ('w_inv_01', 'Traga um amigo', 'Traga 1 amigo para a Fluxo com seu convite.', 'invite_accepted', 'weekly', 1, 250, 25, 'all'),
  ('w_inv_02', 'Dupla dinâmica', 'Traga 2 amigos para a Fluxo com seu convite.', 'invite_accepted', 'weekly', 2, 350, 34, 'all'),
  ('w_inv_03', 'Bonde na Fluxo', 'Traga 3 amigos para a Fluxo com seu convite.', 'invite_accepted', 'weekly', 3, 450, 43, 'active'),
  ('w_inv_04', 'Embaixador', 'Traga 5 amigos para a Fluxo com seu convite.', 'invite_accepted', 'weekly', 5, 650, 62, 'creator'),
  -- Presenca (4)
  ('w_act_01', 'Marcando presença', 'Participe da Fluxo em 3 dias diferentes nesta semana.', 'daily_active', 'weekly', 3, 150, 15, 'new'),
  ('w_act_02', 'Quase todo dia', 'Participe da Fluxo em 5 dias diferentes nesta semana.', 'daily_active', 'weekly', 5, 220, 21, 'all'),
  ('w_act_03', 'Semana completa', 'Participe da Fluxo nos 7 dias da semana.', 'daily_active', 'weekly', 7, 320, 30, 'all'),
  ('w_act_04', 'Frequentador', 'Participe da Fluxo em 4 dias diferentes nesta semana.', 'daily_active', 'weekly', 4, 180, 17, 'all')
) as catalog(
  slug, title, description, mission_type, cadence, target_value, xp_reward, coin_reward, audience
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  mission_type = excluded.mission_type,
  cadence = excluded.cadence,
  target_value = excluded.target_value,
  xp_reward = excluded.xp_reward,
  coin_reward = excluded.coin_reward,
  audience = excluded.audience,
  in_rotation = true,
  invite_slot_reward = excluded.invite_slot_reward,
  metadata = excluded.metadata,
  is_active = true;


-- ============================================================
-- 053_follow_suggestions.sql
-- ============================================================

-- Sugestoes de quem seguir com fila de prioridade.
--
-- Pontuacao de cada candidato para quem esta vendo:
--   * amigos em comum (seguido por quem voce segue)          -> peso maior
--   * alcance: missoes concluidas nos ultimos dias             -> ate +60 (decai pela metade a cada 3 dias)
--   * perto de voce (so adultos, os DOIS com opcao ligada)     -> ate +40
--   * mesma cidade, selo, conta nova                           -> bonus menores
--   * leve variacao diaria para a lista nao ficar parada
--
-- Protecao de menores (modelo TikTok + ECA Digital):
--   * contas de 14-15 anos nao sao sugeridas a ninguem;
--   * contas de 16-17 anos nao sao sugeridas a adultos;
--   * "pessoas proximas" so existe entre adultos.
--
-- Privacidade da localizacao: ninguem ve coordenada nem distancia exata. A distancia aparece em
-- faixas ("ate 5 km") calculadas sobre coordenadas arredondadas (~1 km), e a posicao so pode ser
-- atualizada a cada 10 minutos -- dificulta triangular alguem mudando a propria posicao.

-- 1) Opcao "aparecer para pessoas proximas" (privada: colunas novas de profiles nao sao
-- liberadas para select pelo client desde a 047).
alter table public.profiles add column if not exists nearby_visible boolean not null default false;
alter table public.profiles add column if not exists location_updated_at timestamptz;

create index if not exists profiles_nearby_idx
  on public.profiles(location_lat, location_lng)
  where nearby_visible = true;

create or replace function public.update_my_location(
  input_lat numeric,
  input_lng numeric,
  input_accuracy_meters numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  last_update timestamptz;
begin
  if current_user_id is null then
    raise exception 'Entre na Fluxo para continuar.';
  end if;

  if input_lat is null or input_lng is null
    or input_lat not between -90 and 90
    or input_lng not between -180 and 180 then
    raise exception 'Localização inválida.';
  end if;

  select location_updated_at into last_update from public.profiles where user_id = current_user_id;

  if last_update is not null and last_update > now() - interval '10 minutes' then
    return;
  end if;

  update public.profiles
  set location_lat = round(input_lat, 6),
      location_lng = round(input_lng, 6),
      location_accuracy_meters = input_accuracy_meters,
      geolocation_permission = 'granted',
      geolocation_consent_at = coalesce(geolocation_consent_at, now()),
      geolocation_denied_at = null,
      location_updated_at = now(),
      updated_at = now()
  where user_id = current_user_id;
end;
$$;

revoke execute on function public.update_my_location(numeric, numeric, numeric) from public;
revoke execute on function public.update_my_location(numeric, numeric, numeric) from anon;
grant execute on function public.update_my_location(numeric, numeric, numeric) to authenticated;

create or replace function public.set_nearby_visibility(enabled boolean)
returns boolean
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

  if enabled then
    if public.user_age_band(current_user_id) <> 'adult' then
      raise exception 'Pessoas próximas está disponível apenas para maiores de 18 anos.';
    end if;

    if not exists (
      select 1 from public.profiles
      where user_id = current_user_id and location_lat is not null and location_lng is not null
    ) then
      raise exception 'Ative sua localização para aparecer para pessoas próximas.';
    end if;
  end if;

  update public.profiles
  set nearby_visible = coalesce(enabled, false),
      updated_at = now()
  where user_id = current_user_id;

  return coalesce(enabled, false);
end;
$$;

revoke execute on function public.set_nearby_visibility(boolean) from public;
revoke execute on function public.set_nearby_visibility(boolean) from anon;
grant execute on function public.set_nearby_visibility(boolean) to authenticated;

-- get_my_private_profile (047) passa a devolver tambem a opcao de proximidade.
drop function if exists public.get_my_private_profile();

create or replace function public.get_my_private_profile()
returns table (
  location_lat numeric,
  location_lng numeric,
  location_accuracy_meters numeric,
  geolocation_consent_at timestamptz,
  geolocation_denied_at timestamptz,
  biological_sex text,
  birth_date date,
  age_band text,
  guardian_status text,
  nearby_visible boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.location_lat,
    profiles.location_lng,
    profiles.location_accuracy_meters,
    profiles.geolocation_consent_at,
    profiles.geolocation_denied_at,
    profiles.biological_sex,
    age_records.birth_date,
    public.user_age_band(auth.uid()),
    age_records.guardian_status,
    profiles.nearby_visible
  from public.profiles
  left join public.user_age_records age_records on age_records.user_id = profiles.user_id
  where profiles.user_id = auth.uid();
$$;

revoke execute on function public.get_my_private_profile() from public;
revoke execute on function public.get_my_private_profile() from anon;
grant execute on function public.get_my_private_profile() to authenticated;

-- 2) Alcance ganho com missoes.
create table if not exists public.user_reach_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points numeric not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists user_reach_scores_points_idx on public.user_reach_scores(points desc);

alter table public.user_reach_scores enable row level security;
-- sem policies: so funcoes security definer leem/escrevem.

-- Meia-vida de 3 dias: o boost some se a pessoa para de cumprir missoes.
create or replace function public.effective_reach(points numeric, updated_at timestamptz)
returns numeric
language sql
stable
as $$
  select points * power(0.5, extract(epoch from (now() - updated_at)) / 259200.0);
$$;

create or replace function public.add_reach_points(target_user_id uuid, amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id is null or amount is null or amount <= 0 then
    return;
  end if;

  insert into public.user_reach_scores (user_id, points, updated_at)
  values (target_user_id, amount, now())
  on conflict (user_id) do update set
    points = public.effective_reach(user_reach_scores.points, user_reach_scores.updated_at) + excluded.points,
    updated_at = now();
end;
$$;

revoke execute on function public.add_reach_points(uuid, numeric) from public;
revoke execute on function public.add_reach_points(uuid, numeric) from anon;
revoke execute on function public.add_reach_points(uuid, numeric) from authenticated;

-- Missao concluida = XP/10 pontos de alcance (diaria ~3-18, semanal ~14-65).
create or replace function public.reach_on_mission_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mission_xp integer;
begin
  if not new.is_completed or old.is_completed then
    return new;
  end if;

  select xp_reward into mission_xp from public.mission_definitions where id = new.mission_id;
  perform public.add_reach_points(new.user_id, greatest(coalesce(mission_xp, 0), 0) / 10.0);

  return new;
end;
$$;

drop trigger if exists user_mission_progress_reach on public.user_mission_progress;
create trigger user_mission_progress_reach
after update of is_completed on public.user_mission_progress
for each row execute function public.reach_on_mission_complete();

-- 3) Sugestoes.
create or replace function public.distance_bucket_label(distance_km numeric)
returns text
language sql
immutable
as $$
  select case
    when distance_km < 2 then 'A menos de 2 km de você'
    when distance_km < 5 then 'Até 5 km de você'
    when distance_km < 10 then 'Até 10 km de você'
    when distance_km < 25 then 'Até 25 km de você'
    else 'Até 50 km de você'
  end;
$$;

create or replace function public.get_follow_suggestions(max_results integer default 12)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  location_label text,
  city text,
  state text,
  reason text,
  reason_detail text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_band text;
  viewer_city text;
  viewer_state text;
  viewer_lat numeric;
  viewer_lng numeric;
  viewer_nearby boolean;
begin
  if viewer_id is null then
    return;
  end if;

  viewer_band := public.user_age_band(viewer_id);

  select profiles.city, profiles.state, round(profiles.location_lat, 2), round(profiles.location_lng, 2),
         profiles.nearby_visible
  into viewer_city, viewer_state, viewer_lat, viewer_lng, viewer_nearby
  from public.profiles
  where profiles.user_id = viewer_id;

  viewer_nearby := viewer_band = 'adult' and coalesce(viewer_nearby, false) and viewer_lat is not null;

  return query
  with viewer_following as (
    select relationships.following_id, relationships.source
    from public.user_relationships relationships
    where relationships.follower_id = viewer_id
  ),
  mutual as (
    select
      second_hop.following_id as candidate_id,
      count(*)::integer as mutual_count,
      (array_agg(second_hop.follower_id))[1] as via_id
    from (
      select following_id from viewer_following
      where source <> 'default_official'
      limit 300
    ) first_hop
    join public.user_relationships second_hop on second_hop.follower_id = first_hop.following_id
    group by second_hop.following_id
  ),
  boosted as (
    select scores.user_id as candidate_id,
           public.effective_reach(scores.points, scores.updated_at) as reach
    from public.user_reach_scores scores
    order by scores.points desc
    limit 300
  ),
  nearby as (
    select candidate.user_id as candidate_id,
           -- haversine sobre coordenadas arredondadas (~1 km)
           (6371 * 2 * asin(sqrt(
             power(sin(radians(round(candidate.location_lat, 2) - viewer_lat) / 2), 2)
             + cos(radians(viewer_lat)) * cos(radians(round(candidate.location_lat, 2)))
             * power(sin(radians(round(candidate.location_lng, 2) - viewer_lng) / 2), 2)
           )))::numeric as distance_km
    from public.profiles candidate
    where viewer_nearby
      and candidate.nearby_visible = true
      and candidate.location_lat between viewer_lat - 0.45 and viewer_lat + 0.45
      and candidate.location_lng between viewer_lng - 0.6 and viewer_lng + 0.6
    limit 300
  ),
  same_city as (
    select candidate.user_id as candidate_id
    from public.profiles candidate
    where viewer_city is not null
      and candidate.city = viewer_city
      and candidate.state = viewer_state
    order by candidate.created_at desc
    limit 300
  ),
  recent as (
    select candidate.user_id as candidate_id
    from public.profiles candidate
    where candidate.profile_required_completed = true
    order by candidate.created_at desc
    limit 100
  ),
  candidate_ids as (
    select candidate_id from mutual
    union select candidate_id from boosted
    union select candidate_id from nearby where distance_km <= 50
    union select candidate_id from same_city
    union select candidate_id from recent
  ),
  scored as (
    select
      candidate.user_id,
      candidate.username,
      candidate.display_name,
      candidate.avatar_url,
      candidate.bio,
      candidate.location_label,
      candidate.city,
      candidate.state,
      candidate.created_at,
      coalesce(mutual.mutual_count, 0) as mutual_count,
      mutual.via_id,
      coalesce(boosted.reach, 0) as reach,
      case when nearby.distance_km <= 50 then nearby.distance_km end as distance_km,
      (viewer_city is not null and candidate.city = viewer_city and candidate.state = viewer_state) as is_same_city,
      public.user_age_band(candidate.user_id) as candidate_band,
      coalesce(public.seal_rank(seals.seal), 0) as seal_score
    from candidate_ids
    join public.profiles candidate on candidate.user_id = candidate_ids.candidate_id
    left join mutual on mutual.candidate_id = candidate.user_id
    left join boosted on boosted.candidate_id = candidate.user_id
    left join nearby on nearby.candidate_id = candidate.user_id
    left join public.profile_verified_seals seals on seals.user_id = candidate.user_id
    where candidate.user_id <> viewer_id
      and candidate.profile_required_completed = true
      and candidate.username is not null
      -- is_blocked_between vem da 055 (resolvida so na execucao; aplicar 047-055 juntas)
      and not public.is_blocked_between(viewer_id, candidate.user_id)
      and not exists (
        select 1 from viewer_following where viewer_following.following_id = candidate.user_id
      )
  ),
  allowed as (
    select scored.*,
      coalesce(scored.mutual_count, 0) * 12
      + least(scored.reach, 200) * 0.3
      + case when scored.distance_km is not null then greatest(0, 40 - scored.distance_km * 0.8) else 0 end
      + case when scored.is_same_city then 8 else 0 end
      + scored.seal_score / 10.0
      + case when scored.created_at > now() - interval '7 days' then 5 else 0 end
      + (abs(hashtext(viewer_id::text || scored.user_id::text || current_date::text)) % 100) / 33.0
        as score
    from scored
    where scored.candidate_band not in ('blocked', 'teen_14')
      and not (scored.candidate_band = 'teen_16' and viewer_band not in ('teen_14', 'teen_16'))
  )
  select
    allowed.user_id,
    allowed.username,
    allowed.display_name,
    allowed.avatar_url,
    allowed.bio,
    allowed.location_label,
    allowed.city,
    allowed.state,
    case
      when allowed.distance_km is not null and allowed.distance_km < 25 then 'nearby'
      when allowed.mutual_count > 0 then 'mutual'
      when allowed.reach >= 20 then 'trending'
      when allowed.is_same_city then 'same_city'
      when allowed.created_at > now() - interval '7 days' then 'new'
      else 'suggested'
    end,
    case
      when allowed.distance_km is not null and allowed.distance_km < 25
        then public.distance_bucket_label(allowed.distance_km)
      when allowed.mutual_count > 0 then
        'Seguido por @' || coalesce(
          (select via.username from public.profiles via where via.user_id = allowed.via_id), 'alguém'
        ) || case when allowed.mutual_count > 1 then ' e mais ' || (allowed.mutual_count - 1) else '' end
      when allowed.reach >= 20 then 'Em alta na Fluxo'
      when allowed.is_same_city then 'Também de ' || allowed.city
      when allowed.created_at > now() - interval '7 days' then 'Chegou agora na Fluxo'
      else 'Sugestão para você'
    end
  from allowed
  order by allowed.score desc
  limit least(greatest(coalesce(max_results, 12), 1), 50);
end;
$$;

revoke execute on function public.get_follow_suggestions(integer) from public;
revoke execute on function public.get_follow_suggestions(integer) from anon;
grant execute on function public.get_follow_suggestions(integer) to authenticated;


-- ============================================================
-- 054_creator_program_and_safe_search.sql
-- ============================================================

-- 1) Busca de perfis segura para menores.
-- 2) Programa Prime Influencer (inscricao, verificacao, aprovacao pelas contas oficiais).
-- 3) Tema exclusivo "Prime Gold" para os Prime Influencers (5 mil primeiros aprovados).

-- ============================================================
-- 1) Busca: menores de 18 so aparecem para outros adolescentes ou para quem eles ja seguem.
--    (Antes a busca lia profiles direto, sem filtro de idade.)
-- ============================================================
create or replace function public.search_profiles(search_term text, max_results integer default 20)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  location_label text,
  city text,
  state text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_is_teen boolean;
  clean_term text;
  username_term text;
begin
  viewer_is_teen := viewer_id is not null and public.user_age_band(viewer_id) in ('teen_14', 'teen_16');
  clean_term := left(btrim(regexp_replace(coalesce(search_term, ''), '[%_,()\\]', ' ', 'g')), 64);
  username_term := lower(regexp_replace(clean_term, '^[@~]', ''));

  if char_length(clean_term) < 2 then
    return;
  end if;

  return query
  select
    candidate.user_id,
    candidate.username::text,
    candidate.display_name::text,
    candidate.avatar_url::text,
    candidate.bio::text,
    candidate.location_label::text,
    candidate.city::text,
    candidate.state::text
  from public.profiles candidate
  where candidate.profile_required_completed = true
    and candidate.username is not null
    and (viewer_id is null or candidate.user_id <> viewer_id)
    -- is_blocked_between vem da 055 (resolvida so na execucao; aplicar 047-055 juntas)
    and not public.is_blocked_between(viewer_id, candidate.user_id)
    and (
      candidate.display_name ilike '%' || clean_term || '%'
      or candidate.username ilike '%' || username_term || '%'
    )
    and (
      public.user_age_band(candidate.user_id) not in ('teen_14', 'teen_16', 'blocked')
      or viewer_is_teen
      or exists (
        select 1 from public.user_relationships teen_follows
        where teen_follows.follower_id = candidate.user_id
          and teen_follows.following_id = viewer_id
      )
    )
  order by
    (candidate.username = username_term) desc,
    candidate.display_name
  limit least(greatest(coalesce(max_results, 20), 1), 50);
end;
$$;

revoke execute on function public.search_profiles(text, integer) from public;
grant execute on function public.search_profiles(text, integer) to anon, authenticated;

-- ============================================================
-- 2) Programa Prime Influencer
-- ============================================================
create or replace function public.is_official_account(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.official_accounts where user_id = target_user_id);
$$;

revoke execute on function public.is_official_account(uuid) from public;
revoke execute on function public.is_official_account(uuid) from anon;
grant execute on function public.is_official_account(uuid) to authenticated;

create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  platform text not null,
  handle text not null,
  profile_url text,
  followers_count integer not null,
  niche text,
  message text,
  -- Codigo que a pessoa coloca na bio da rede externa para provar que e dona do perfil.
  verification_code text not null,
  status text not null default 'pending',
  rewards_granted boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_applications_platform_check check (
    platform in ('instagram', 'tiktok', 'youtube', 'twitch', 'kwai', 'x', 'outra')
  ),
  constraint creator_applications_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint creator_applications_followers_check check (followers_count >= 0)
);

create index if not exists creator_applications_status_idx
  on public.creator_applications(status, created_at);

alter table public.creator_applications enable row level security;

drop policy if exists "users can read own creator application" on public.creator_applications;

create policy "users can read own creator application"
on public.creator_applications for select
using (user_id = auth.uid());

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
add constraint notifications_type_check
check (type in (
  'dahora', 'comment', 'wave', 'follow', 'mission_reward', 'coin_gift', 'seal_granted',
  'invite_accepted', 'creator_application_reviewed'
));

-- Minimo de seguidores declarados na rede externa para se inscrever.
create or replace function public.creator_program_min_followers()
returns integer
language sql
immutable
as $$ select 1000 $$;

create or replace function public.submit_creator_application(
  input_platform text,
  input_handle text,
  input_profile_url text,
  input_followers_count integer,
  input_niche text default null,
  input_message text default null
)
returns public.creator_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing public.creator_applications;
  result_row public.creator_applications;
begin
  if current_user_id is null then
    raise exception 'Entre na Fluxo para se inscrever.';
  end if;

  -- Programa de criadores (e futura monetizacao) so para maiores de 18 por enquanto; a regra de
  -- 16+ com responsavel entra junto com o fluxo de consentimento do responsavel.
  if public.user_age_band(current_user_id) <> 'adult' then
    raise exception 'O programa Prime Influencer está disponível para maiores de 18 anos.';
  end if;

  if coalesce(btrim(input_handle), '') = '' then
    raise exception 'Informe seu @ na rede social.';
  end if;

  if input_followers_count is null or input_followers_count < public.creator_program_min_followers() then
    raise exception 'O programa é para criadores com pelo menos % seguidores.', public.creator_program_min_followers();
  end if;

  select * into existing from public.creator_applications where user_id = current_user_id;

  if existing.id is not null and existing.status = 'approved' then
    raise exception 'Sua inscrição já foi aprovada.';
  end if;

  insert into public.creator_applications (
    user_id, platform, handle, profile_url, followers_count, niche, message, verification_code
  )
  values (
    current_user_id,
    input_platform,
    left(regexp_replace(btrim(input_handle), '^@', ''), 60),
    -- So links http(s): o painel de aprovacao abre esse endereco.
    case when btrim(coalesce(input_profile_url, '')) ~* '^https?://'
      then left(btrim(input_profile_url), 300) end,
    input_followers_count,
    left(nullif(btrim(input_niche), ''), 60),
    left(nullif(btrim(input_message), ''), 600),
    'FLUXO-' || public.generate_invite_code()
  )
  on conflict (user_id) do update set
    platform = excluded.platform,
    handle = excluded.handle,
    profile_url = excluded.profile_url,
    followers_count = excluded.followers_count,
    niche = excluded.niche,
    message = excluded.message,
    status = 'pending',
    reviewed_by = null,
    reviewed_at = null,
    review_note = null,
    updated_at = now()
  returning * into result_row;

  return result_row;
end;
$$;

revoke execute on function public.submit_creator_application(text, text, text, integer, text, text) from public;
revoke execute on function public.submit_creator_application(text, text, text, integer, text, text) from anon;
grant execute on function public.submit_creator_application(text, text, text, integer, text, text) to authenticated;

-- Fila de aprovacao (so contas oficiais).
create or replace function public.list_creator_applications(filter_status text default 'pending')
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  platform text,
  handle text,
  profile_url text,
  followers_count integer,
  niche text,
  message text,
  verification_code text,
  status text,
  rewards_granted boolean,
  review_note text,
  created_at timestamptz
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
    applications.id,
    applications.user_id,
    profiles.username::text,
    profiles.display_name::text,
    applications.platform,
    applications.handle,
    applications.profile_url,
    applications.followers_count,
    applications.niche,
    applications.message,
    applications.verification_code,
    applications.status,
    applications.rewards_granted,
    applications.review_note,
    applications.created_at
  from public.creator_applications applications
  left join public.profiles on profiles.user_id = applications.user_id
  where filter_status is null or applications.status = filter_status
  order by applications.created_at asc
  limit 200;
end;
$$;

revoke execute on function public.list_creator_applications(text) from public;
revoke execute on function public.list_creator_applications(text) from anon;
grant execute on function public.list_creator_applications(text) to authenticated;

-- ============================================================
-- 3) Tema exclusivo
-- ============================================================
create table if not exists public.user_theme_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_id text not null,
  source text,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, theme_id)
);

alter table public.user_theme_unlocks enable row level security;

drop policy if exists "users can read own theme unlocks" on public.user_theme_unlocks;

create policy "users can read own theme unlocks"
on public.user_theme_unlocks for select
using (user_id = auth.uid());

-- O client grava profiles.theme direto; este trigger impede usar tema exclusivo sem desbloqueio.
create or replace function public.enforce_exclusive_theme()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.theme in ('prime-gold')
    and (tg_op = 'INSERT' or old.theme is distinct from new.theme)
    and not exists (
      select 1 from public.user_theme_unlocks
      where user_id = new.user_id and theme_id = new.theme
    )
    and not public.is_official_account(new.user_id) then
    raise exception 'Esse tema é exclusivo dos Prime Influencers.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_exclusive_theme on public.profiles;
create trigger profiles_enforce_exclusive_theme
before insert or update of theme on public.profiles
for each row execute function public.enforce_exclusive_theme();

-- Recompensas do aprovado: selo Prime Influencer (5 mil vagas) + tema Prime Gold. Se a
-- campanha ainda estiver desligada (arte do selo pendente) ou cheia, fica aprovado sem
-- recompensa (rewards_granted = false) e grant_pending_creator_rewards() entrega depois.
create or replace function public.grant_creator_rewards(application_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  application public.creator_applications;
begin
  select * into application
  from public.creator_applications
  where id = application_id
  for update;

  if application.id is null or application.status <> 'approved' or application.rewards_granted then
    return false;
  end if;

  if not public.claim_seal_campaign(
    application.user_id, 'prime_influencer', 'Prime Influencer: entre os primeiros criadores da Fluxo'
  ) then
    return false;
  end if;

  insert into public.user_theme_unlocks (user_id, theme_id, source)
  values (application.user_id, 'prime-gold', 'prime_influencer')
  on conflict (user_id, theme_id) do nothing;

  update public.creator_applications
  set rewards_granted = true,
      updated_at = now()
  where id = application.id;

  return true;
end;
$$;

revoke execute on function public.grant_creator_rewards(uuid) from public;
revoke execute on function public.grant_creator_rewards(uuid) from anon;
revoke execute on function public.grant_creator_rewards(uuid) from authenticated;

create or replace function public.review_creator_application(
  application_id uuid,
  approve boolean,
  note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewer_id uuid := auth.uid();
  application public.creator_applications;
  rewarded boolean := false;
begin
  if not public.is_official_account(reviewer_id) then
    raise exception 'Acesso restrito às contas oficiais da Fluxo.';
  end if;

  update public.creator_applications
  set status = case when approve then 'approved' else 'rejected' end,
      reviewed_by = reviewer_id,
      reviewed_at = now(),
      review_note = left(nullif(btrim(note), ''), 400),
      updated_at = now()
  where id = application_id
  returning * into application;

  if application.id is null then
    raise exception 'Inscrição não encontrada.';
  end if;

  if approve then
    rewarded := public.grant_creator_rewards(application.id);
  end if;

  perform public.create_notification(
    application.user_id,
    'creator_application_reviewed',
    null,
    null,
    case when approve then 'Sua inscrição no Prime Influencer foi aprovada!'
         else 'Sua inscrição no Prime Influencer não foi aprovada desta vez.' end
  );

  return jsonb_build_object('status', application.status, 'rewards_granted', rewarded);
end;
$$;

revoke execute on function public.review_creator_application(uuid, boolean, text) from public;
revoke execute on function public.review_creator_application(uuid, boolean, text) from anon;
grant execute on function public.review_creator_application(uuid, boolean, text) to authenticated;

-- Entrega recompensas pendentes na ordem de aprovacao (rodar depois de ligar a campanha
-- prime_influencer, quando a arte do selo existir).
create or replace function public.grant_pending_creator_rewards()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  pending record;
  granted_count integer := 0;
begin
  if auth.uid() is not null and not public.is_official_account(auth.uid()) then
    raise exception 'Acesso restrito às contas oficiais da Fluxo.';
  end if;

  for pending in
    select id from public.creator_applications
    where status = 'approved' and rewards_granted = false
    order by reviewed_at asc
  loop
    if public.grant_creator_rewards(pending.id) then
      granted_count := granted_count + 1;
    end if;
  end loop;

  return granted_count;
end;
$$;

revoke execute on function public.grant_pending_creator_rewards() from public;
revoke execute on function public.grant_pending_creator_rewards() from anon;
grant execute on function public.grant_pending_creator_rewards() to authenticated;


-- ============================================================
-- 055_safety_blocks_reports_feedback.sql
-- ============================================================

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


-- ============================================================
-- 056_push_notifications.sql
-- ============================================================

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


-- ============================================================
-- 057_growth_metrics.sql
-- ============================================================

-- Painel de metricas do motor de crescimento (so contas oficiais). Tudo calculado na hora a partir
-- das tabelas existentes; suficiente para o volume do beta.
create or replace function public.get_growth_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  week_start timestamptz := today_start - interval '6 days';
begin
  if not public.is_official_account(auth.uid()) then
    raise exception 'Acesso restrito às contas oficiais da Fluxo.';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'completed_signup', (select count(*) from public.profiles where profile_required_completed),
      'new_today', (select count(*) from public.profiles where created_at >= today_start),
      'new_7d', (select count(*) from public.profiles where created_at >= week_start),
      'active_today', (
        select count(distinct user_id) from public.mission_event_log
        where event_type = 'daily_active' and created_at >= today_start
      ),
      'active_7d', (
        select count(distinct user_id) from public.mission_event_log
        where event_type = 'daily_active' and created_at >= week_start
      ),
      'teens', (
        select count(*) from public.user_age_records
        where extract(year from age(current_date, birth_date)) < 18
      ),
      'nearby_enabled', (select count(*) from public.profiles where nearby_visible)
    ),
    'invites', jsonb_build_object(
      'accepted_total', (select count(*) from public.invite_redemptions),
      'accepted_7d', (select count(*) from public.invite_redemptions where created_at >= week_start),
      'inviters_total', (select count(distinct inviter_id) from public.invite_redemptions),
      'signups_via_invite_pct', (
        select case when count(*) = 0 then 0
          else round(100.0 * (select count(*) from public.invite_redemptions) / count(*), 1) end
        from public.profiles where profile_required_completed
      )
    ),
    'missions', jsonb_build_object(
      'completed_today', (
        select count(*) from public.user_mission_progress where completed_at >= today_start
      ),
      'completed_7d', (
        select count(*) from public.user_mission_progress where completed_at >= week_start
      ),
      'users_completing_7d', (
        select count(distinct user_id) from public.user_mission_progress where completed_at >= week_start
      )
    ),
    'content', jsonb_build_object(
      'posts_today', (select count(*) from public.contents where created_at >= today_start),
      'posts_7d', (select count(*) from public.contents where created_at >= week_start),
      'comments_7d', (select count(*) from public.comments where created_at >= week_start),
      'waves_7d', (select count(*) from public.waves where created_at >= week_start),
      'follows_7d', (select count(*) from public.user_relationships where created_at >= week_start)
    ),
    'seal_campaigns', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slug', slug, 'title', title, 'granted', granted_count, 'max', max_grants, 'active', is_active
      ) order by slug), '[]'::jsonb)
      from public.seal_campaigns
    ),
    'safety', jsonb_build_object(
      'open_reports', (select count(*) from public.reports where status = 'open'),
      'hidden_contents', (select count(*) from public.contents where visibility = 'removed'),
      'blocks_7d', (select count(*) from public.user_blocks where created_at >= week_start),
      'feedback_7d', (select count(*) from public.app_feedback where kind <> 'crash' and created_at >= week_start),
      'crashes_7d', (select count(*) from public.app_feedback where kind = 'crash' and created_at >= week_start)
    ),
    'creators', jsonb_build_object(
      'pending', (select count(*) from public.creator_applications where status = 'pending'),
      'approved', (select count(*) from public.creator_applications where status = 'approved')
    )
  );
end;
$$;

revoke execute on function public.get_growth_metrics() from public;
revoke execute on function public.get_growth_metrics() from anon;
grant execute on function public.get_growth_metrics() to authenticated;


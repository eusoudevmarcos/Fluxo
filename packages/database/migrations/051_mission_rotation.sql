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

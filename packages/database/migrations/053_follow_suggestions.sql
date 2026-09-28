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

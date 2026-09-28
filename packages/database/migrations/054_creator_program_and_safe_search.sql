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

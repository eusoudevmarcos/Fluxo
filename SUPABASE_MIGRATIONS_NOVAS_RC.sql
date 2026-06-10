-- Ocean Beta RC - migrations novas para rodar no Supabase SQL Editor
-- Gerado para o estado atual do Supabase mostrado nos prints:
-- tabelas base existentes: profiles, contents, comments, dahoras, waves, presences, saved_contents
-- buckets existentes: avatars, content-media
--
-- Rode este arquivo inteiro em uma janela do SQL Editor.
-- Nao rode as migrations antigas 013-017 se for usar o bloco novo 021-025 de Comunidades.
-- Depois valide as tabelas criadas e rode o SQL do fundador, se ja tiver o UUID.


-- ==================================================
-- 009_profile_onboarding_details.sql
-- ==================================================

alter table public.profiles
add column if not exists onboarding_completed boolean default false;

alter table public.profiles
add column if not exists spotify_connected boolean default false;

alter table public.profiles
add column if not exists spotify_label text;

alter table public.profiles
add column if not exists interests text[] default '{}';

alter table public.profiles
add column if not exists date_intent text;

alter table public.profiles
add column if not exists vibe text;

alter table public.profiles
add column if not exists location_label text;

alter table public.profiles
add column if not exists looking_for text;



-- ==================================================
-- 012_add_comments_enabled_to_contents.sql
-- ==================================================

alter table public.contents
add column if not exists comments_enabled boolean not null default true;

drop policy if exists "authenticated users can delete own comment" on public.comments;

create policy "authenticated users can delete own comment"
on public.comments for delete
to authenticated
using (
  auth.uid() = author_id
  or exists (
    select 1
    from public.contents
    where contents.id = comments.content_id
      and contents.author_id = auth.uid()
  )
);



-- ==================================================
-- 018_legal_acceptances.sql
-- ==================================================

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  community_version text not null,
  content_license_version text not null,
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint legal_acceptances_unique_versions unique (
    user_id,
    terms_version,
    privacy_version,
    community_version,
    content_license_version
  )
);

create index if not exists legal_acceptances_user_id_idx on public.legal_acceptances(user_id);
create index if not exists legal_acceptances_accepted_at_idx on public.legal_acceptances(accepted_at);

alter table public.legal_acceptances enable row level security;

drop policy if exists "users can read own legal acceptances" on public.legal_acceptances;
drop policy if exists "users can insert own legal acceptances" on public.legal_acceptances;

create policy "users can read own legal acceptances"
on public.legal_acceptances for select
using (user_id = auth.uid());

create policy "users can insert own legal acceptances"
on public.legal_acceptances for insert
with check (user_id = auth.uid());

alter table public.profiles
add column if not exists legal_terms_accepted boolean not null default false,
add column if not exists legal_terms_accepted_at timestamptz,
add column if not exists legal_terms_version text;



-- ==================================================
-- 020_profile_required_onboarding.sql
-- ==================================================

alter table public.profiles
add column if not exists state text,
add column if not exists city text,
add column if not exists country text not null default 'BR',
add column if not exists location_lat numeric(9,6),
add column if not exists location_lng numeric(9,6),
add column if not exists location_accuracy_meters numeric,
add column if not exists geolocation_permission text not null default 'unknown',
add column if not exists geolocation_consent_at timestamptz,
add column if not exists geolocation_denied_at timestamptz,
add column if not exists biological_sex text,
add column if not exists profile_required_completed boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_geolocation_permission_check'
  ) then
    alter table public.profiles
    add constraint profiles_geolocation_permission_check
    check (geolocation_permission in ('unknown', 'granted', 'denied', 'unavailable'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_biological_sex_check'
  ) then
    alter table public.profiles
    add constraint profiles_biological_sex_check
    check (
      biological_sex is null
      or biological_sex in ('male', 'female', 'intersex', 'prefer_not_to_say')
    );
  end if;
end $$;

create index if not exists profiles_state_idx on public.profiles(state);
create index if not exists profiles_city_idx on public.profiles(city);
create index if not exists profiles_country_idx on public.profiles(country);



-- ==================================================
-- 021_communities.sql
-- ==================================================

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  cover_url text,
  category text,
  is_official boolean not null default false,
  is_local boolean not null default false,
  city text,
  state text,
  country text default 'BR',
  owner_id uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  max_rooms integer not null default 10,
  room_capacity integer not null default 200,
  rules text[] default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.communities
add column if not exists is_local boolean not null default false,
add column if not exists city text,
add column if not exists state text,
add column if not exists country text default 'BR';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'communities_status_check'
  ) then
    alter table public.communities
    add constraint communities_status_check check (status in ('active', 'paused', 'blocked'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'communities_max_rooms_check'
  ) then
    alter table public.communities
    add constraint communities_max_rooms_check check (max_rooms between 1 and 50);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'communities_room_capacity_check'
  ) then
    alter table public.communities
    add constraint communities_room_capacity_check check (room_capacity between 10 and 500);
  end if;
end $$;

create index if not exists communities_slug_idx on public.communities(slug);
create index if not exists communities_category_idx on public.communities(category);
create index if not exists communities_city_state_idx on public.communities(city, state, country);
create index if not exists communities_status_idx on public.communities(status);
create index if not exists communities_owner_id_idx on public.communities(owner_id);

alter table public.communities enable row level security;

drop policy if exists "communities are readable when active" on public.communities;
drop policy if exists "authenticated users can create own communities" on public.communities;
drop policy if exists "owners can update own communities" on public.communities;

create policy "communities are readable when active"
on public.communities for select
using (status = 'active');

create policy "authenticated users can create own communities"
on public.communities for insert
with check (auth.uid() is not null and owner_id = auth.uid());

create policy "owners can update own communities"
on public.communities for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());



-- ==================================================
-- 022_community_rooms.sql
-- ==================================================

create table if not exists public.community_rooms (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  room_number integer not null,
  capacity integer not null default 200,
  online_count integer not null default 0,
  status text not null default 'open',
  is_vip boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_rooms_unique_number unique (community_id, room_number),
  constraint community_rooms_status_check check (status in ('open', 'full', 'closed')),
  constraint community_rooms_online_count_check check (online_count >= 0),
  constraint community_rooms_capacity_check check (capacity between 10 and 500)
);

create index if not exists community_rooms_community_id_idx on public.community_rooms(community_id);
create index if not exists community_rooms_status_idx on public.community_rooms(status);

alter table public.community_rooms enable row level security;

drop policy if exists "community rooms are publicly readable" on public.community_rooms;
drop policy if exists "community owners can create rooms" on public.community_rooms;

create policy "community rooms are publicly readable"
on public.community_rooms for select
using (
  exists (
    select 1
    from public.communities
    where communities.id = community_rooms.community_id
      and communities.status = 'active'
  )
);

create policy "community owners can create rooms"
on public.community_rooms for insert
with check (
  exists (
    select 1
    from public.communities
    where communities.id = community_rooms.community_id
      and communities.owner_id = auth.uid()
      and communities.status = 'active'
  )
);



-- ==================================================
-- 023_community_members.sql
-- ==================================================

create table if not exists public.community_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  constraint community_members_unique_user unique (community_id, user_id),
  constraint community_members_role_check check (role in ('owner', 'moderator', 'member')),
  constraint community_members_status_check check (status in ('active', 'muted', 'banned'))
);

create index if not exists community_members_community_id_idx on public.community_members(community_id);
create index if not exists community_members_user_id_idx on public.community_members(user_id);

alter table public.community_members enable row level security;

drop policy if exists "community memberships are readable" on public.community_members;
drop policy if exists "authenticated users can join communities" on public.community_members;
drop policy if exists "members can leave communities" on public.community_members;

create policy "community memberships are readable"
on public.community_members for select
using (status = 'active');

create policy "authenticated users can join communities"
on public.community_members for insert
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and (
    role = 'member'
    or exists (
      select 1
      from public.communities
      where communities.id = community_members.community_id
        and communities.owner_id = auth.uid()
        and community_members.role = 'owner'
    )
  )
);

create policy "members can leave communities"
on public.community_members for delete
using (user_id = auth.uid());



-- ==================================================
-- 024_add_community_id_to_contents.sql
-- ==================================================

alter table public.contents
add column if not exists community_id uuid null references public.communities(id) on delete set null;

create index if not exists contents_community_id_idx on public.contents(community_id);



-- ==================================================
-- 025_seed_native_communities.sql
-- ==================================================

insert into public.communities (slug, name, description, category, is_official, is_local, country, rules)
values
  (
    'eu-odeio-acordar-cedo',
    'Eu odeio acordar cedo',
    'Para quem funciona melhor depois do segundo alarme.',
    'Humor',
    true,
    false,
    'BR',
    array['Respeite os membros.', 'Nada de ataques pessoais.', 'Memes são bem-vindos.', 'Conteúdo ofensivo pode ser removido.']
  ),
  (
    'teorias-da-conspiracao',
    'Teorias da conspiração',
    'Debates, hipóteses e histórias curiosas com respeito.',
    'Debates',
    true,
    false,
    'BR',
    array['Debata ideias sem atacar pessoas.', 'Não incentive violência.', 'Evite acusações sem contexto.', 'Respeite opiniões diferentes.']
  ),
  (
    'musica',
    'Música',
    'Descobertas, playlists, artistas e o som do momento.',
    'Cultura',
    true,
    false,
    'BR',
    array['Respeite gostos diferentes.', 'Credite artistas quando possível.', 'Não pratique spam.']
  ),
  (
    'games',
    'Games',
    'Partidas, lançamentos, nostalgia e comunidade gamer.',
    'Games',
    true,
    false,
    'BR',
    array['Sem toxicidade.', 'Respeite todos os niveis de jogo.', 'Evite spoilers sem aviso.']
  ),
  (
    'filmes-e-series',
    'Filmes e séries',
    'Recomendações, teorias, cenas favoritas e maratonas.',
    'Entretenimento',
    true,
    false,
    'BR',
    array['Avise sobre spoilers.', 'Respeite opiniões diferentes.', 'Não publique pirataria.']
  ),
  (
    'relacionamentos',
    'Relacionamentos',
    'Conversas sobre conexões, encontros, amizade e vida real.',
    'Social',
    true,
    false,
    'BR',
    array['Sem exposição de terceiros.', 'Respeite limites.', 'Não pratique assédio.']
  ),
  (
    'tecnologia',
    'Tecnologia',
    'Produtos, dev, IA, startups e cultura digital.',
    'Tecnologia',
    true,
    false,
    'BR',
    array['Compartilhe conhecimento.', 'Não publique golpes.', 'Respeite iniciantes.']
  ),
  (
    'humor',
    'Humor',
    'Memes, piadas e caos controlado com respeito.',
    'Humor',
    true,
    false,
    'BR',
    array['Humor sem ataque.', 'Não use ódio como piada.', 'Respeite as diretrizes da Ocean.']
  ),
  (
    'esportes',
    'Esportes',
    'Torcida, jogos, campeonatos e resenhas.',
    'Esportes',
    true,
    false,
    'BR',
    array['Rivalidade com respeito.', 'Sem ameaças.', 'Evite spam de placar.']
  ),
  (
    'arte-e-criacao',
    'Arte e criação',
    'Desenho, design, foto, vídeo, escrita e criadores.',
    'Criadores',
    true,
    false,
    'BR',
    array['Respeite autoria.', 'Credite referências.', 'Feedback deve ser construtivo.']
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  is_official = excluded.is_official,
  is_local = excluded.is_local,
  country = excluded.country,
  rules = excluded.rules,
  updated_at = now();

insert into public.community_rooms (community_id, name, room_number, capacity, online_count)
select communities.id, 'Sala ' || rooms.room_number, rooms.room_number, 200, rooms.online_count
from public.communities
cross join (
  values
    (1, 0),
    (2, 30),
    (3, 120),
    (4, 12),
    (5, 77)
) as rooms(room_number, online_count)
where communities.slug in (
  'eu-odeio-acordar-cedo',
  'teorias-da-conspiracao',
  'musica',
  'games',
  'filmes-e-series',
  'relacionamentos',
  'tecnologia',
  'humor',
  'esportes',
  'arte-e-criacao'
)
on conflict (community_id, room_number) do update set
  capacity = excluded.capacity,
  online_count = excluded.online_count,
  updated_at = now();



-- ==================================================
-- 026_gamification_core.sql
-- ==================================================

create table if not exists public.user_gamification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  level integer not null default 1,
  xp_total bigint not null default 0,
  xp_current_level bigint not null default 0,
  xp_next_level bigint not null default 1000,
  weekly_xp bigint not null default 0,
  monthly_xp bigint not null default 0,
  streak_days integer not null default 0,
  last_active_date date,
  is_founder boolean not null default false,
  is_official_profile boolean not null default false,
  has_all_auras boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_gamification_level_check') then
    alter table public.user_gamification
    add constraint user_gamification_level_check check (level between 1 and 9999);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_gamification_xp_check') then
    alter table public.user_gamification
    add constraint user_gamification_xp_check check (
      xp_total >= 0
      and xp_current_level >= 0
      and xp_next_level > 0
      and weekly_xp >= 0
      and monthly_xp >= 0
      and streak_days >= 0
    );
  end if;
end $$;

create index if not exists user_gamification_user_id_idx on public.user_gamification(user_id);
create index if not exists user_gamification_level_idx on public.user_gamification(level desc);

alter table public.user_gamification enable row level security;

drop policy if exists "users can read own gamification" on public.user_gamification;
drop policy if exists "users can insert own gamification shell" on public.user_gamification;

create policy "users can read own gamification"
on public.user_gamification for select
using (user_id = auth.uid());

create policy "users can insert own gamification shell"
on public.user_gamification for insert
with check (
  user_id = auth.uid()
  and level = 1
  and xp_total = 0
  and xp_current_level = 0
  and weekly_xp = 0
  and monthly_xp = 0
  and is_founder = false
  and is_official_profile = false
  and has_all_auras = false
);

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

  if auth.uid() is not null and auth.uid() <> target_user_id then
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

revoke execute on function public.ensure_user_gamification(uuid) from public;
revoke execute on function public.ensure_user_gamification(uuid) from anon;
grant execute on function public.ensure_user_gamification(uuid) to authenticated;

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

  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Cannot add XP for another user';
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



-- ==================================================
-- 027_aura_definitions.sql
-- ==================================================

create table if not exists public.aura_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  rarity text not null,
  color_primary text,
  color_secondary text,
  visual_config jsonb not null default '{}'::jsonb,
  xp_bonus_percent integer not null default 0,
  level_min integer,
  level_max integer,
  unlock_type text not null default 'mission',
  unlock_condition jsonb not null default '{}'::jsonb,
  monthly_drop_limit integer,
  total_supply_limit integer,
  is_active boolean not null default true,
  is_secret boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aura_definitions_rarity_check') then
    alter table public.aura_definitions
    add constraint aura_definitions_rarity_check
    check (rarity in ('common', 'special', 'rare', 'epic', 'secret', 'legendary', 'milenar'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'aura_definitions_unlock_type_check') then
    alter table public.aura_definitions
    add constraint aura_definitions_unlock_type_check
    check (unlock_type in ('level', 'mission', 'monthly_drop', 'milestone', 'founder', 'gift', 'secret'));
  end if;
end $$;

create index if not exists aura_definitions_slug_idx on public.aura_definitions(slug);
create index if not exists aura_definitions_rarity_idx on public.aura_definitions(rarity);
create index if not exists aura_definitions_active_idx on public.aura_definitions(is_active);

alter table public.aura_definitions enable row level security;

drop policy if exists "active auras are public" on public.aura_definitions;

create policy "active auras are public"
on public.aura_definitions for select
using (is_active = true);

insert into public.aura_definitions (
  slug, name, description, rarity, color_primary, color_secondary, visual_config,
  xp_bonus_percent, level_min, level_max, unlock_type, unlock_condition, is_secret
)
values
  ('aura-super-saiyajin-comum', 'Aura Super Saiyajin Comum', 'Aura dourada inicial para quem comeÃ§ou a subir de nÃ­vel na Ocean.', 'common', 'yellow', 'gold', '{"glow":"gold","motion":"pulse"}', 5, 1, 9, 'level', '{"level_min":1,"level_max":9}', false),
  ('aura-super-saiyajin-blue', 'Aura Super Saiyajin Blue', 'Aura azul/ciano para perfis que mantÃªm presenÃ§a e criaÃ§Ã£o.', 'rare', 'blue', 'cyan', '{"glow":"cyan","motion":"wave"}', 10, 10, 24, 'level', '{"level_min":10,"level_max":24}', false),
  ('aura-instinto-superior', 'Aura Instinto Superior', 'Aura branca/violeta para criadores em fase Ã©pica.', 'epic', 'white', 'violet', '{"glow":"violet","motion":"spark"}', 20, 25, 49, 'level', '{"level_min":25,"level_max":49}', false),
  ('aura-ego-superior', 'Aura Ego Superior', 'Aura secreta para quem ultrapassa 500% da meta semanal.', 'secret', 'red', 'magenta', '{"glow":"magenta","motion":"burst"}', 35, null, null, 'secret', '{"weekly_goal_percent":500}', true),
  ('raio-dourado', 'Raio Dourado', 'Aura especial para os primeiros 100 usuÃ¡rios a alcanÃ§ar 1M.', 'special', 'yellow', 'gold', '{"glow":"gold","motion":"bolt"}', 15, null, null, 'milestone', '{"xp_total":1000000,"first_users":100}', false),
  ('onda-confusa', 'Onda Confusa', 'Aura comum para usuÃ¡rios seguintes que alcanÃ§arem 1M.', 'common', 'cyan', 'blue', '{"glow":"cyan","motion":"ripple"}', 8, null, null, 'milestone', '{"xp_total":1000000}', false),
  ('broto-prime', 'Broto Prime', 'Aura rara para quem alcanÃ§ar 3M.', 'rare', 'green', 'lime', '{"glow":"lime","motion":"grow"}', 12, null, null, 'milestone', '{"xp_total":3000000}', false),
  ('mare-tatica', 'MarÃ© TÃ¡tica', 'Aura rara para quem alcanÃ§ar 5M com consistÃªncia.', 'rare', 'blue', 'teal', '{"glow":"teal","motion":"flow"}', 14, null, null, 'milestone', '{"xp_total":5000000}', false),
  ('fogo-lendario', 'Fogo LendÃ¡rio', 'Aura lendÃ¡ria para os primeiros 10 usuÃ¡rios a alcanÃ§ar 5M.', 'legendary', 'orange', 'red', '{"glow":"fire","motion":"flame"}', 30, null, null, 'milestone', '{"xp_total":5000000,"first_users":10}', false),
  ('brasa-epica', 'Brasa Ã‰pica', 'Aura Ã©pica para os prÃ³ximos 100 usuÃ¡rios a alcanÃ§ar 5M.', 'epic', 'orange', 'magenta', '{"glow":"ember","motion":"flare"}', 24, null, null, 'milestone', '{"xp_total":5000000,"next_users":100}', false),
  ('faisca-inicial', 'FaÃ­sca Inicial', 'Aura especial para demais usuÃ¡rios que alcanÃ§arem 5M.', 'special', 'yellow', 'cyan', '{"glow":"spark","motion":"blink"}', 16, null, null, 'milestone', '{"xp_total":5000000}', false)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  color_primary = excluded.color_primary,
  color_secondary = excluded.color_secondary,
  visual_config = excluded.visual_config,
  xp_bonus_percent = excluded.xp_bonus_percent,
  level_min = excluded.level_min,
  level_max = excluded.level_max,
  unlock_type = excluded.unlock_type,
  unlock_condition = excluded.unlock_condition,
  is_secret = excluded.is_secret,
  is_active = true,
  updated_at = now();



-- ==================================================
-- 028_user_auras.sql
-- ==================================================

create table if not exists public.user_auras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  aura_id uuid not null references public.aura_definitions(id) on delete cascade,
  source text not null default 'mission',
  unlocked_at timestamptz not null default now(),
  equipped_at timestamptz,
  is_equipped boolean not null default false,
  grant_reason text,
  granted_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  constraint user_auras_unique_user_aura unique (user_id, aura_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_auras_source_check') then
    alter table public.user_auras
    add constraint user_auras_source_check
    check (source in ('mission', 'level', 'drop', 'gift', 'founder', 'milestone', 'secret'));
  end if;
end $$;

create index if not exists user_auras_user_id_idx on public.user_auras(user_id);
create index if not exists user_auras_aura_id_idx on public.user_auras(aura_id);
create index if not exists user_auras_equipped_idx on public.user_auras(user_id, is_equipped);

alter table public.user_auras enable row level security;

drop policy if exists "users can read own auras" on public.user_auras;
drop policy if exists "users can equip own auras" on public.user_auras;

create policy "users can read own auras"
on public.user_auras for select
using (user_id = auth.uid());

create policy "users can equip own auras"
on public.user_auras for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.grant_user_aura(
  target_user_id uuid,
  aura_slug text,
  source text default 'mission',
  reason text default null
)
returns public.user_auras
language plpgsql
security definer
set search_path = public
as $$
declare
  aura_row public.aura_definitions;
  result_row public.user_auras;
begin
  if target_user_id is null or aura_slug is null then
    raise exception 'target_user_id and aura_slug are required';
  end if;

  select *
  into aura_row
  from public.aura_definitions
  where slug = aura_slug
    and is_active = true;

  if aura_row.id is null then
    raise exception 'Aura not found: %', aura_slug;
  end if;

  insert into public.user_auras (user_id, aura_id, source, grant_reason)
  values (target_user_id, aura_row.id, source, reason)
  on conflict (user_id, aura_id) do update set
    grant_reason = coalesce(excluded.grant_reason, public.user_auras.grant_reason),
    metadata = public.user_auras.metadata
  returning * into result_row;

  return result_row;
end;
$$;

revoke execute on function public.grant_user_aura(uuid, text, text, text) from public;
revoke execute on function public.grant_user_aura(uuid, text, text, text) from anon;
revoke execute on function public.grant_user_aura(uuid, text, text, text) from authenticated;

create or replace function public.equip_user_aura(target_user_id uuid, aura_slug text)
returns public.user_auras
language plpgsql
security definer
set search_path = public
as $$
declare
  aura_row public.aura_definitions;
  owns_aura boolean;
  has_all boolean;
  result_row public.user_auras;
begin
  if target_user_id is null or aura_slug is null then
    raise exception 'target_user_id and aura_slug are required';
  end if;

  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Cannot equip aura for another user';
  end if;

  select *
  into aura_row
  from public.aura_definitions
  where slug = aura_slug
    and is_active = true;

  if aura_row.id is null then
    raise exception 'Aura not found: %', aura_slug;
  end if;

  select coalesce(has_all_auras, false)
  into has_all
  from public.user_gamification
  where user_id = target_user_id;

  select exists (
    select 1 from public.user_auras
    where user_id = target_user_id
      and aura_id = aura_row.id
  ) into owns_aura;

  if not owns_aura and not coalesce(has_all, false) then
    raise exception 'User does not own this aura';
  end if;

  if not owns_aura and coalesce(has_all, false) then
    perform public.grant_user_aura(target_user_id, aura_slug, 'founder', 'has_all_auras entitlement');
  end if;

  update public.user_auras
  set is_equipped = false,
      equipped_at = null
  where user_id = target_user_id;

  update public.user_auras
  set is_equipped = true,
      equipped_at = now()
  where user_id = target_user_id
    and aura_id = aura_row.id
  returning * into result_row;

  return result_row;
end;
$$;

revoke execute on function public.equip_user_aura(uuid, text) from public;
revoke execute on function public.equip_user_aura(uuid, text) from anon;
grant execute on function public.equip_user_aura(uuid, text) to authenticated;

create or replace view public.public_equipped_auras as
select
  user_auras.user_id,
  aura_definitions.slug as aura_slug,
  aura_definitions.name as aura_name,
  aura_definitions.rarity,
  aura_definitions.visual_config,
  aura_definitions.color_primary,
  aura_definitions.color_secondary
from public.user_auras
join public.aura_definitions on aura_definitions.id = user_auras.aura_id
where user_auras.is_equipped = true
  and aura_definitions.is_active = true;



-- ==================================================
-- 029_missions.sql
-- ==================================================

create table if not exists public.mission_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  mission_type text not null,
  cadence text not null,
  target_value integer not null,
  xp_reward integer not null default 0,
  aura_reward_slug text,
  sticker_pack_reward_slug text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mission_definitions_type_check') then
    alter table public.mission_definitions
    add constraint mission_definitions_type_check
    check (mission_type in (
      'create_flow',
      'create_moments',
      'create_wave',
      'join_communities',
      'invite_friends',
      'daily_streak',
      'weekly_complete',
      'overachieve_weekly'
    ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'mission_definitions_cadence_check') then
    alter table public.mission_definitions
    add constraint mission_definitions_cadence_check
    check (cadence in ('daily', 'weekly', 'monthly', 'seasonal', 'once'));
  end if;
end $$;

create index if not exists mission_definitions_slug_idx on public.mission_definitions(slug);
create index if not exists mission_definitions_active_idx on public.mission_definitions(is_active);
create index if not exists mission_definitions_cadence_idx on public.mission_definitions(cadence);

alter table public.mission_definitions enable row level security;

drop policy if exists "active missions are public" on public.mission_definitions;

create policy "active missions are public"
on public.mission_definitions for select
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

insert into public.mission_definitions (
  slug, title, description, mission_type, cadence, target_value, xp_reward, aura_reward_slug, metadata
)
values
  ('daily_create_flow', '1 Flow', 'Publique 1 flow', 'create_flow', 'daily', 1, 50, null, '{}'),
  ('daily_create_moments', '1 Moments', 'Compartilhe 1 moment', 'create_moments', 'daily', 1, 50, null, '{}'),
  ('daily_create_wave', '1 Wave', 'Interaja com 1 criaÃ§Ã£o', 'create_wave', 'daily', 1, 40, null, '{}'),
  ('weekly_7_days', '7 dias seguidos', 'Mantenha presenÃ§a por 7 dias seguidos.', 'daily_streak', 'weekly', 7, 250, null, '{}'),
  ('weekly_join_5_communities', 'Participar de 5 comunidades', 'Entre em 5 comunidades durante a semana.', 'join_communities', 'weekly', 5, 200, null, '{}'),
  ('weekly_invite_10_friends', 'Convidar 10 amigos', 'Convide 10 amigos para a Ocean.', 'invite_friends', 'weekly', 10, 300, null, '{}'),
  ('weekly_overachieve_500', '500% da meta', 'Supere 500% da meta semanal.', 'overachieve_weekly', 'weekly', 500, 1000, 'aura-ego-superior', '{"secret":true}')
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  mission_type = excluded.mission_type,
  cadence = excluded.cadence,
  target_value = excluded.target_value,
  xp_reward = excluded.xp_reward,
  aura_reward_slug = excluded.aura_reward_slug,
  metadata = excluded.metadata,
  is_active = true;



-- ==================================================
-- 030_user_mission_progress.sql
-- ==================================================

create table if not exists public.user_mission_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.mission_definitions(id) on delete cascade,
  period_key text not null,
  current_value integer not null default 0,
  target_value integer not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  reward_claimed boolean not null default false,
  reward_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint user_mission_progress_unique_period unique (user_id, mission_id, period_key)
);

create index if not exists user_mission_progress_user_id_idx on public.user_mission_progress(user_id);
create index if not exists user_mission_progress_mission_id_idx on public.user_mission_progress(mission_id);
create index if not exists user_mission_progress_period_idx on public.user_mission_progress(period_key);

alter table public.user_mission_progress enable row level security;

drop policy if exists "users can read own mission progress" on public.user_mission_progress;

create policy "users can read own mission progress"
on public.user_mission_progress for select
using (user_id = auth.uid());

create or replace function public.ocean_mission_period_key(cadence text)
returns text
language sql
stable
as $$
  select case
    when cadence = 'daily' then to_char(current_date, 'YYYY-MM-DD')
    when cadence = 'weekly' then to_char(current_date, 'IYYY-"W"IW')
    when cadence = 'monthly' then to_char(current_date, 'YYYY-MM')
    when cadence = 'seasonal' then to_char(current_date, 'YYYY-"S"Q')
    else 'once'
  end;
$$;

create or replace function public.increment_mission_progress(
  target_user_id uuid,
  mission_slug text,
  increment_by integer default 1,
  progress_metadata jsonb default '{}'::jsonb
)
returns public.user_mission_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  mission_row public.mission_definitions;
  period text;
  progress_row public.user_mission_progress;
  was_completed boolean;
begin
  if target_user_id is null or mission_slug is null then
    raise exception 'target_user_id and mission_slug are required';
  end if;

  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Cannot increment mission for another user';
  end if;

  if increment_by is null or increment_by <= 0 then
    raise exception 'increment_by must be positive';
  end if;

  select *
  into mission_row
  from public.mission_definitions
  where slug = mission_slug
    and is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now());

  if mission_row.id is null then
    raise exception 'Mission not found: %', mission_slug;
  end if;

  period := public.ocean_mission_period_key(mission_row.cadence);

  insert into public.user_mission_progress (
    user_id, mission_id, period_key, current_value, target_value, metadata
  )
  values (
    target_user_id, mission_row.id, period, 0, mission_row.target_value, progress_metadata
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

  update public.user_mission_progress
  set
    current_value = current_value + increment_by,
    is_completed = case when current_value + increment_by >= target_value then true else is_completed end,
    completed_at = case
      when completed_at is null and current_value + increment_by >= target_value then now()
      else completed_at
    end,
    metadata = user_mission_progress.metadata || coalesce(progress_metadata, '{}'::jsonb),
    updated_at = now()
  where id = progress_row.id
  returning * into progress_row;

  if progress_row.is_completed and not was_completed and not progress_row.reward_claimed then
    if mission_row.xp_reward > 0 then
      perform public.add_user_xp(target_user_id, mission_row.xp_reward, mission_row.slug, progress_metadata);
    end if;

    if mission_row.aura_reward_slug is not null then
      perform public.grant_user_aura(target_user_id, mission_row.aura_reward_slug, 'mission', mission_row.slug);
    end if;

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

revoke execute on function public.increment_mission_progress(uuid, text, integer, jsonb) from public;
revoke execute on function public.increment_mission_progress(uuid, text, integer, jsonb) from anon;
grant execute on function public.increment_mission_progress(uuid, text, integer, jsonb) to authenticated;

create or replace function public.claim_mission_reward(progress_id uuid)
returns public.user_mission_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  progress_row public.user_mission_progress;
  mission_row public.mission_definitions;
begin
  select *
  into progress_row
  from public.user_mission_progress
  where id = progress_id
  for update;

  if progress_row.id is null then
    raise exception 'Mission progress not found';
  end if;

  if auth.uid() is not null and auth.uid() <> progress_row.user_id then
    raise exception 'Cannot claim another user mission';
  end if;

  if not progress_row.is_completed then
    raise exception 'Mission not completed';
  end if;

  if progress_row.reward_claimed then
    return progress_row;
  end if;

  select *
  into mission_row
  from public.mission_definitions
  where id = progress_row.mission_id;

  if mission_row.xp_reward > 0 then
    perform public.add_user_xp(progress_row.user_id, mission_row.xp_reward, mission_row.slug, progress_row.metadata);
  end if;

  if mission_row.aura_reward_slug is not null then
    perform public.grant_user_aura(progress_row.user_id, mission_row.aura_reward_slug, 'mission', mission_row.slug);
  end if;

  update public.user_mission_progress
  set reward_claimed = true,
      reward_claimed_at = now(),
      updated_at = now()
  where id = progress_row.id
  returning * into progress_row;

  return progress_row;
end;
$$;

revoke execute on function public.claim_mission_reward(uuid) from public;
revoke execute on function public.claim_mission_reward(uuid) from anon;
grant execute on function public.claim_mission_reward(uuid) to authenticated;



-- ==================================================
-- 031_aura_drops.sql
-- ==================================================

create table if not exists public.aura_drops (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  drop_month text not null,
  total_common integer not null default 30,
  total_special integer not null default 5,
  total_rare integer not null default 5,
  total_secret integer not null default 2,
  special_period_months integer not null default 1,
  rare_period_months integer not null default 2,
  secret_period_months integer not null default 5,
  status text not null default 'scheduled',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aura_drops_status_check') then
    alter table public.aura_drops
    add constraint aura_drops_status_check check (status in ('scheduled', 'active', 'ended'));
  end if;
end $$;

create table if not exists public.aura_drop_rewards (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.aura_drops(id) on delete cascade,
  aura_id uuid not null references public.aura_definitions(id) on delete cascade,
  rarity text not null,
  supply_limit integer,
  awarded_count integer not null default 0,
  condition jsonb not null default '{}'::jsonb
);

create table if not exists public.user_aura_drop_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  drop_id uuid not null references public.aura_drops(id) on delete cascade,
  reward_id uuid not null references public.aura_drop_rewards(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  rank_position integer,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists aura_drops_status_idx on public.aura_drops(status);
create index if not exists aura_drops_month_idx on public.aura_drops(drop_month);
create index if not exists aura_drop_rewards_drop_id_idx on public.aura_drop_rewards(drop_id);
create index if not exists user_aura_drop_awards_user_id_idx on public.user_aura_drop_awards(user_id);

alter table public.aura_drops enable row level security;
alter table public.aura_drop_rewards enable row level security;
alter table public.user_aura_drop_awards enable row level security;

drop policy if exists "active aura drops are public" on public.aura_drops;
drop policy if exists "active aura drop rewards are public" on public.aura_drop_rewards;
drop policy if exists "users can read own aura drop awards" on public.user_aura_drop_awards;

create policy "active aura drops are public"
on public.aura_drops for select
using (status in ('scheduled', 'active'));

create policy "active aura drop rewards are public"
on public.aura_drop_rewards for select
using (
  exists (
    select 1 from public.aura_drops
    where aura_drops.id = aura_drop_rewards.drop_id
      and aura_drops.status in ('scheduled', 'active')
  )
);

create policy "users can read own aura drop awards"
on public.user_aura_drop_awards for select
using (user_id = auth.uid());



-- ==================================================
-- 032_sticker_packs.sql
-- ==================================================

create table if not exists public.sticker_packs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  theme_slug text,
  rarity text not null default 'common',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  slug text unique not null,
  name text not null,
  emotion text not null,
  asset_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_sticker_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  source text not null default 'mission',
  granted_by uuid references auth.users(id) on delete set null,
  constraint user_sticker_packs_unique_user_pack unique (user_id, pack_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sticker_packs_rarity_check') then
    alter table public.sticker_packs
    add constraint sticker_packs_rarity_check
    check (rarity in ('common', 'special', 'rare', 'epic', 'secret', 'legendary', 'milenar'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'stickers_emotion_check') then
    alter table public.stickers
    add constraint stickers_emotion_check
    check (emotion in ('medo', 'rindo', 'admirado', 'estressado', 'tirando_onda'));
  end if;
end $$;

create index if not exists sticker_packs_slug_idx on public.sticker_packs(slug);
create index if not exists stickers_pack_id_idx on public.stickers(pack_id);
create index if not exists user_sticker_packs_user_id_idx on public.user_sticker_packs(user_id);

alter table public.sticker_packs enable row level security;
alter table public.stickers enable row level security;
alter table public.user_sticker_packs enable row level security;

drop policy if exists "active sticker packs are public" on public.sticker_packs;
drop policy if exists "active stickers are public" on public.stickers;
drop policy if exists "users can read own sticker packs" on public.user_sticker_packs;

create policy "active sticker packs are public"
on public.sticker_packs for select
using (is_active = true);

create policy "active stickers are public"
on public.stickers for select
using (
  exists (
    select 1 from public.sticker_packs
    where sticker_packs.id = stickers.pack_id
      and sticker_packs.is_active = true
  )
);

create policy "users can read own sticker packs"
on public.user_sticker_packs for select
using (user_id = auth.uid());

insert into public.sticker_packs (slug, name, description, theme_slug, rarity)
values
  ('pack-raio-dourado', 'Raio Dourado', 'Stickers de energia e conquista dourada.', 'raio-dourado', 'special'),
  ('pack-onda-confusa', 'Onda Confusa', 'Stickers de caos leve, dÃºvida e humor.', 'onda-confusa', 'common'),
  ('pack-broto-prime', 'Broto Prime', 'Stickers de crescimento, foco e evoluÃ§Ã£o.', 'broto-prime', 'rare'),
  ('pack-mare-tatica', 'MarÃ© TÃ¡tica', 'Stickers de estratÃ©gia e presenÃ§a.', 'mare-tatica', 'rare'),
  ('pack-fogo-lendario', 'Fogo LendÃ¡rio', 'Stickers de intensidade lendÃ¡ria.', 'fogo-lendario', 'legendary')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  theme_slug = excluded.theme_slug,
  rarity = excluded.rarity,
  is_active = true;

insert into public.stickers (pack_id, slug, name, emotion, sort_order)
select sticker_packs.id, sticker_packs.slug || '-' || emotions.emotion, emotions.name, emotions.emotion, emotions.sort_order
from public.sticker_packs
cross join (
  values
    ('medo', 'Medo', 1),
    ('rindo', 'Rindo', 2),
    ('admirado', 'Admirado', 3),
    ('estressado', 'Estressado', 4),
    ('tirando_onda', 'Tirando onda', 5)
) as emotions(emotion, name, sort_order)
where sticker_packs.slug in (
  'pack-raio-dourado',
  'pack-onda-confusa',
  'pack-broto-prime',
  'pack-mare-tatica',
  'pack-fogo-lendario'
)
on conflict (slug) do update set
  name = excluded.name,
  emotion = excluded.emotion,
  sort_order = excluded.sort_order;



-- ==================================================
-- 033_official_profile_defaults.sql
-- ==================================================

create table if not exists public.official_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  kind text not null,
  is_default_follow boolean not null default false,
  is_founder boolean not null default false,
  label text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'official_accounts_kind_check') then
    alter table public.official_accounts
    add constraint official_accounts_kind_check
    check (kind in ('founder', 'company', 'updates'));
  end if;
end $$;

create table if not exists public.user_relationships (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint user_relationships_unique_pair unique (follower_id, following_id),
  constraint user_relationships_not_self check (follower_id <> following_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_relationships_source_check') then
    alter table public.user_relationships
    add constraint user_relationships_source_check
    check (source in ('manual', 'default_official', 'onboarding'));
  end if;
end $$;

create index if not exists official_accounts_user_id_idx on public.official_accounts(user_id);
create index if not exists official_accounts_default_follow_idx on public.official_accounts(is_default_follow);
create index if not exists user_relationships_follower_id_idx on public.user_relationships(follower_id);
create index if not exists user_relationships_following_id_idx on public.user_relationships(following_id);

alter table public.official_accounts enable row level security;
alter table public.user_relationships enable row level security;

drop policy if exists "official accounts are public" on public.official_accounts;
drop policy if exists "relationships are publicly readable" on public.user_relationships;
drop policy if exists "users can create own relationships" on public.user_relationships;
drop policy if exists "users can remove own relationships" on public.user_relationships;

create policy "official accounts are public"
on public.official_accounts for select
using (true);

create policy "relationships are publicly readable"
on public.user_relationships for select
using (true);

create policy "users can create own relationships"
on public.user_relationships for insert
with check (follower_id = auth.uid());

create policy "users can remove own relationships"
on public.user_relationships for delete
using (follower_id = auth.uid());

create or replace function public.apply_founder_entitlements(target_user_id uuid)
returns public.user_gamification
language plpgsql
security definer
set search_path = public
as $$
declare
  aura_record record;
  result_row public.user_gamification;
  first_aura_slug text;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  perform public.ensure_user_gamification(target_user_id);

  update public.user_gamification
  set
    is_founder = true,
    is_official_profile = true,
    has_all_auras = true,
    level = 9999,
    xp_total = 999999999,
    xp_current_level = 0,
    xp_next_level = 999999999,
    updated_at = now()
  where user_id = target_user_id
  returning * into result_row;

  for aura_record in
    select slug from public.aura_definitions where is_active = true order by created_at asc
  loop
    perform public.grant_user_aura(target_user_id, aura_record.slug, 'founder', 'Fundador Ocean');
  end loop;

  select slug
  into first_aura_slug
  from public.aura_definitions
  where is_active = true
  order by case when rarity = 'legendary' then 0 when rarity = 'secret' then 1 else 2 end, created_at asc
  limit 1;

  if first_aura_slug is not null then
    perform public.equip_user_aura(target_user_id, first_aura_slug);
  end if;

  return result_row;
end;
$$;

revoke execute on function public.apply_founder_entitlements(uuid) from public;
revoke execute on function public.apply_founder_entitlements(uuid) from anon;
revoke execute on function public.apply_founder_entitlements(uuid) from authenticated;

create or replace function public.apply_default_official_follows(new_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if new_user_id is null then
    raise exception 'new_user_id is required';
  end if;

  if auth.uid() is not null and auth.uid() <> new_user_id then
    raise exception 'Cannot apply default follows for another user';
  end if;

  insert into public.user_relationships (follower_id, following_id, source)
  select new_user_id, official_accounts.user_id, 'default_official'
  from public.official_accounts
  where official_accounts.is_default_follow = true
    and official_accounts.user_id <> new_user_id
  on conflict (follower_id, following_id) do nothing;

  get diagnostics inserted_count = row_count;

  return inserted_count;
end;
$$;

revoke execute on function public.apply_default_official_follows(uuid) from public;
revoke execute on function public.apply_default_official_follows(uuid) from anon;
grant execute on function public.apply_default_official_follows(uuid) to authenticated;



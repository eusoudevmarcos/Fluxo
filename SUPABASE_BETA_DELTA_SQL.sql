-- Ocean Beta Delta SQL
-- Use este arquivo porque o Supabase ja tem as tabelas sociais basicas e os buckets Storage.
-- Este delta adiciona Legal, Onboarding obrigatorio final e Comunidades MVP.


-- ============================================================
-- 018_legal_acceptances.sql
-- ============================================================

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




-- ============================================================
-- 020_profile_required_onboarding.sql
-- ============================================================

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




-- ============================================================
-- 021_communities.sql
-- ============================================================

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




-- ============================================================
-- 022_community_rooms.sql
-- ============================================================

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




-- ============================================================
-- 023_community_members.sql
-- ============================================================

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




-- ============================================================
-- 024_add_community_id_to_contents.sql
-- ============================================================

alter table public.contents
add column if not exists community_id uuid null references public.communities(id) on delete set null;

create index if not exists contents_community_id_idx on public.contents(community_id);




-- ============================================================
-- 025_seed_native_communities.sql
-- ============================================================

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




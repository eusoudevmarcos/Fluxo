-- Ocean Beta SQL
-- Gerado para rodar no Supabase SQL Editor.
-- Rode em um projeto Supabase novo ou incompleto.
-- Se alguma migration ja tiver sido aplicada, a maioria dos comandos usa IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT.


-- ============================================================
-- 001_profiles.sql
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  theme text default 'sunflow',
  aura text default 'starter',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.profiles
set user_id = id
where user_id is null;

alter table public.profiles
alter column user_id set not null;

alter table public.profiles
add column if not exists username text;

alter table public.profiles
add column if not exists display_name text;

alter table public.profiles
add column if not exists avatar_url text;

alter table public.profiles
add column if not exists bio text;

alter table public.profiles
add column if not exists theme text default 'sunflow';

alter table public.profiles
add column if not exists aura text default 'starter';

alter table public.profiles
add column if not exists onboarding_completed boolean not null default false;

alter table public.profiles
alter column created_at set default now();

alter table public.profiles
alter column updated_at set default now();

alter table public.profiles
alter column theme set default 'sunflow';

alter table public.profiles
alter column aura type text using aura::text;

alter table public.profiles
alter column aura set default 'starter';

create unique index if not exists profiles_user_id_key
on public.profiles(user_id);

create unique index if not exists profiles_username_key
on public.profiles(username);

alter table public.profiles enable row level security;

drop policy if exists "profiles are publicly readable" on public.profiles;
drop policy if exists "users can insert their own profile" on public.profiles;
drop policy if exists "users can update their own profile" on public.profiles;
drop policy if exists "authenticated users can create own profile" on public.profiles;
drop policy if exists "authenticated users can update own profile" on public.profiles;

create policy "profiles are publicly readable"
on public.profiles for select
using (true);

create policy "authenticated users can create own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "authenticated users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);




-- ============================================================
-- 002_add_onboarding_completed_to_profiles.sql
-- ============================================================

alter table public.profiles
add column if not exists onboarding_completed boolean not null default false;



-- ============================================================
-- 003_contents.sql
-- ============================================================

create table if not exists public.contents (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null default 'post',
  text text,
  media_url text,
  media_type text not null default 'none',
  momentum_id uuid null,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contents_content_type_check check (content_type in ('post', 'flow')),
  constraint contents_media_type_check check (media_type in ('image', 'video', 'none')),
  constraint contents_visibility_check check (visibility in ('public'))
);

alter table public.contents
add column if not exists author_id uuid references auth.users(id) on delete cascade;

alter table public.contents
add column if not exists content_type text not null default 'post';

alter table public.contents
add column if not exists text text;

alter table public.contents
add column if not exists media_url text;

alter table public.contents
add column if not exists media_type text not null default 'none';

alter table public.contents
add column if not exists momentum_id uuid null;

alter table public.contents
add column if not exists visibility text not null default 'public';

alter table public.contents
add column if not exists created_at timestamptz not null default now();

alter table public.contents
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contents_content_type_check'
      and conrelid = 'public.contents'::regclass
  ) then
    alter table public.contents
    add constraint contents_content_type_check check (content_type in ('post', 'flow'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'contents_media_type_check'
      and conrelid = 'public.contents'::regclass
  ) then
    alter table public.contents
    add constraint contents_media_type_check check (media_type in ('image', 'video', 'none'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'contents_visibility_check'
      and conrelid = 'public.contents'::regclass
  ) then
    alter table public.contents
    add constraint contents_visibility_check check (visibility in ('public'));
  end if;
end $$;

create index if not exists contents_created_at_idx
on public.contents(created_at desc);

create index if not exists contents_author_id_idx
on public.contents(author_id);

alter table public.contents enable row level security;

drop policy if exists "public contents are readable" on public.contents;
drop policy if exists "authenticated users can create own content" on public.contents;
drop policy if exists "authenticated users can update own content" on public.contents;
drop policy if exists "authenticated users can delete own content" on public.contents;

create policy "public contents are readable"
on public.contents for select
using (visibility = 'public');

create policy "authenticated users can create own content"
on public.contents for insert
to authenticated
with check (auth.uid() = author_id);

create policy "authenticated users can update own content"
on public.contents for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "authenticated users can delete own content"
on public.contents for delete
to authenticated
using (auth.uid() = author_id);




-- ============================================================
-- 004_dahoras.sql
-- ============================================================

create table if not exists public.dahoras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint dahoras_user_content_key unique (user_id, content_id)
);

alter table public.dahoras
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.dahoras
add column if not exists content_id uuid references public.contents(id) on delete cascade;

alter table public.dahoras
add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'dahoras_user_content_key'
      and conrelid = 'public.dahoras'::regclass
  ) then
    alter table public.dahoras
    add constraint dahoras_user_content_key unique (user_id, content_id);
  end if;
end $$;

create index if not exists dahoras_content_id_idx
on public.dahoras(content_id);

create index if not exists dahoras_user_id_idx
on public.dahoras(user_id);

alter table public.dahoras enable row level security;

drop policy if exists "dahoras are readable" on public.dahoras;
drop policy if exists "authenticated users can create own dahora" on public.dahoras;
drop policy if exists "authenticated users can delete own dahora" on public.dahoras;

create policy "dahoras are readable"
on public.dahoras for select
using (true);

create policy "authenticated users can create own dahora"
on public.dahoras for insert
to authenticated
with check (auth.uid() = user_id);

create policy "authenticated users can delete own dahora"
on public.dahoras for delete
to authenticated
using (auth.uid() = user_id);




-- ============================================================
-- 005_comments.sql
-- ============================================================

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_text_length_check check (
    char_length(btrim(text)) > 0
    and char_length(text) <= 500
  )
);

alter table public.comments
add column if not exists content_id uuid references public.contents(id) on delete cascade;

alter table public.comments
add column if not exists author_id uuid references auth.users(id) on delete cascade;

alter table public.comments
add column if not exists text text;

alter table public.comments
add column if not exists created_at timestamptz not null default now();

alter table public.comments
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'comments_text_length_check'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
    add constraint comments_text_length_check check (
      char_length(btrim(text)) > 0
      and char_length(text) <= 500
    );
  end if;
end $$;

create index if not exists comments_content_id_idx
on public.comments(content_id);

create index if not exists comments_author_id_idx
on public.comments(author_id);

create index if not exists comments_created_at_idx
on public.comments(created_at desc);

alter table public.comments enable row level security;

drop policy if exists "comments on public contents are readable" on public.comments;
drop policy if exists "authenticated users can create own comment" on public.comments;
drop policy if exists "authenticated users can update own comment" on public.comments;
drop policy if exists "authenticated users can delete own comment" on public.comments;

create policy "comments on public contents are readable"
on public.comments for select
using (
  exists (
    select 1
    from public.contents
    where contents.id = comments.content_id
      and contents.visibility = 'public'
  )
);

create policy "authenticated users can create own comment"
on public.comments for insert
to authenticated
with check (
  auth.uid() = author_id
  and exists (
    select 1
    from public.contents
    where contents.id = comments.content_id
      and contents.visibility = 'public'
  )
);

create policy "authenticated users can update own comment"
on public.comments for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "authenticated users can delete own comment"
on public.comments for delete
to authenticated
using (auth.uid() = author_id);




-- ============================================================
-- 006_waves.sql
-- ============================================================

create table if not exists public.waves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint waves_user_content_key unique (user_id, content_id)
);

create index if not exists waves_user_id_idx
on public.waves(user_id);

create index if not exists waves_content_id_idx
on public.waves(content_id);

create index if not exists waves_created_at_idx
on public.waves(created_at desc);

alter table public.waves enable row level security;

drop policy if exists "waves are readable" on public.waves;
drop policy if exists "authenticated users can create own wave" on public.waves;
drop policy if exists "authenticated users can delete own wave" on public.waves;

create policy "waves are readable"
on public.waves for select
using (true);

create policy "authenticated users can create own wave"
on public.waves for insert
to authenticated
with check (auth.uid() = user_id);

create policy "authenticated users can delete own wave"
on public.waves for delete
to authenticated
using (auth.uid() = user_id);




-- ============================================================
-- 007_saved_contents.sql
-- ============================================================

create table if not exists public.saved_contents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_contents_user_content_key unique (user_id, content_id)
);

create index if not exists saved_contents_user_id_idx
on public.saved_contents(user_id);

create index if not exists saved_contents_content_id_idx
on public.saved_contents(content_id);

create index if not exists saved_contents_created_at_idx
on public.saved_contents(created_at desc);

alter table public.saved_contents enable row level security;

drop policy if exists "users can read own saved contents" on public.saved_contents;
drop policy if exists "authenticated users can create own saved content" on public.saved_contents;
drop policy if exists "authenticated users can delete own saved content" on public.saved_contents;

create policy "users can read own saved contents"
on public.saved_contents for select
to authenticated
using (auth.uid() = user_id);

create policy "authenticated users can create own saved content"
on public.saved_contents for insert
to authenticated
with check (auth.uid() = user_id);

create policy "authenticated users can delete own saved content"
on public.saved_contents for delete
to authenticated
using (auth.uid() = user_id);




-- ============================================================
-- 008_presences.sql
-- ============================================================

create table if not exists public.presences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint presences_user_content_key unique (user_id, content_id)
);

create index if not exists presences_user_id_idx
on public.presences(user_id);

create index if not exists presences_content_id_idx
on public.presences(content_id);

create index if not exists presences_created_at_idx
on public.presences(created_at desc);

alter table public.presences enable row level security;

drop policy if exists "presences are readable" on public.presences;
drop policy if exists "authenticated users can create own presence" on public.presences;
drop policy if exists "authenticated users can delete own presence" on public.presences;

create policy "presences are readable"
on public.presences for select
using (true);

create policy "authenticated users can create own presence"
on public.presences for insert
to authenticated
with check (auth.uid() = user_id);

create policy "authenticated users can delete own presence"
on public.presences for delete
to authenticated
using (auth.uid() = user_id);




-- ============================================================
-- 009_profile_onboarding_details.sql
-- ============================================================

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



-- ============================================================
-- 010_avatar_storage.sql
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar images are publicly readable" on storage.objects;
drop policy if exists "authenticated users can upload own avatar" on storage.objects;
drop policy if exists "authenticated users can update own avatar" on storage.objects;
drop policy if exists "authenticated users can delete own avatar" on storage.objects;

create policy "avatar images are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "authenticated users can upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "authenticated users can update own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "authenticated users can delete own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);



-- ============================================================
-- 011_storage_content_media.sql
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-media',
  'content-media',
  true,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "content media is publicly readable" on storage.objects;
drop policy if exists "authenticated users can upload own content media" on storage.objects;
drop policy if exists "authenticated users can update own content media" on storage.objects;
drop policy if exists "authenticated users can delete own content media" on storage.objects;

create policy "content media is publicly readable"
on storage.objects for select
using (bucket_id = 'content-media');

create policy "authenticated users can upload own content media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'content-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "authenticated users can update own content media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'content-media'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'content-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "authenticated users can delete own content media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'content-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);




-- ============================================================
-- 012_add_comments_enabled_to_contents.sql
-- ============================================================

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




-- ============================================================
-- 013_communities.sql
-- ============================================================

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  cover_url text,
  category text,
  is_official boolean not null default false,
  owner_id uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  max_rooms integer not null default 10,
  room_capacity integer not null default 200,
  rules text[] default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communities_status_check check (status in ('active', 'paused', 'blocked')),
  constraint communities_max_rooms_check check (max_rooms between 1 and 50),
  constraint communities_room_capacity_check check (room_capacity between 10 and 500)
);

create index if not exists communities_status_idx on public.communities(status);
create index if not exists communities_owner_id_idx on public.communities(owner_id);
create index if not exists communities_category_idx on public.communities(category);

alter table public.communities enable row level security;

drop policy if exists "communities are readable when active" on public.communities;
drop policy if exists "authenticated users can create own communities" on public.communities;
drop policy if exists "owners can update own communities" on public.communities;

create policy "communities are readable when active"
on public.communities for select
using (status = 'active');

create policy "authenticated users can create own communities"
on public.communities for insert
to authenticated
with check (owner_id = auth.uid());

create policy "owners can update own communities"
on public.communities for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());




-- ============================================================
-- 014_community_rooms.sql
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
to authenticated
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
-- 015_community_members.sql
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
to authenticated
with check (user_id = auth.uid());

create policy "members can leave communities"
on public.community_members for delete
to authenticated
using (user_id = auth.uid());




-- ============================================================
-- 016_add_community_id_to_contents.sql
-- ============================================================

alter table public.contents
add column if not exists community_id uuid null references public.communities(id) on delete set null;

create index if not exists contents_community_id_idx on public.contents(community_id);




-- ============================================================
-- 017_seed_native_communities.sql
-- ============================================================

insert into public.communities (slug, name, description, category, is_official, rules)
values
  ('eu-odeio-acordar-cedo', 'Eu odeio acordar cedo', 'Para quem ama a noite, o cafe e reclamar do despertador com bom humor.', 'Humor', true, array['Respeite os membros.', 'Nada de ataques pessoais.', 'Memes sao bem-vindos.', 'Conteudo ofensivo pode ser removido.']),
  ('teorias-da-conspiracao', 'Teorias da conspiracao', 'Debates, hipoteses e conversas curiosas com respeito.', 'Debates', true, array['Debata ideias sem atacar pessoas.', 'Nao incentive violencia.', 'Evite acusacoes sem contexto.', 'Respeite opinioes diferentes.']),
  ('musica', 'Musica', 'Descobertas, playlists, artistas e o que esta tocando agora.', 'Cultura', true, array['Respeite todos os gostos musicais.', 'Credite artistas quando possivel.', 'Evite spam de links.']),
  ('games', 'Games', 'Partidas, dicas, comunidades e cultura gamer sem toxicidade.', 'Games', true, array['Sem ataques pessoais.', 'Evite spoilers sem aviso.', 'Respeite jogadores novos.']),
  ('filmes-e-series', 'Filmes e series', 'Reviews, teorias, recomendacoes e watch parties futuras.', 'Entretenimento', true, array['Avise sobre spoilers.', 'Respeite opinioes diferentes.', 'Nao publique pirataria.']),
  ('relacionamentos', 'Relacionamentos', 'Conversas sobre conexoes, date, amizade e vida social.', 'Social', true, array['Respeite limites.', 'Nao exponha dados pessoais.', 'Denuncie comportamento abusivo.']),
  ('tecnologia', 'Tecnologia', 'Dev, produto, gadgets, IA e futuro digital.', 'Tecnologia', true, array['Compartilhe conhecimento com respeito.', 'Nao faca spam.', 'Ajude iniciantes.']),
  ('humor', 'Humor', 'Memes, piadas e caos leve para respirar.', 'Humor', true, array['Humor sem ataques pessoais.', 'Evite preconceito.', 'Mantenha o clima leve.']),
  ('esportes', 'Esportes', 'Times, resenhas, jogos ao vivo e rivalidade saudavel.', 'Esportes', true, array['Rivalidade sem ofensa.', 'Respeite torcidas diferentes.', 'Evite spam.']),
  ('arte-e-criacao', 'Arte e criacao', 'Design, desenho, escrita, fotografia e criadores da Ocean.', 'Criadores', true, array['Credite trabalhos.', 'Feedback com respeito.', 'Nao copie criacoes sem permissao.'])
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    is_official = excluded.is_official,
    rules = excluded.rules,
    updated_at = now();

insert into public.community_rooms (community_id, name, room_number, capacity, online_count)
select communities.id, 'Sala ' || rooms.room_number, rooms.room_number, 200, rooms.online_count
from public.communities
cross join (
  values
    (1, 0),
    (2, 12),
    (3, 31),
    (4, 77),
    (5, 120)
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
on conflict (community_id, room_number) do update
set online_count = excluded.online_count,
    capacity = excluded.capacity,
    updated_at = now();




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




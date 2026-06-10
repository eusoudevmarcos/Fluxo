-- Ocean MVP social schema.
-- Run in the Supabase SQL editor after Auth is configured.
-- Scope: simple social network MVP. No CPF, KYC, wallet, banking, or age gates.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  bio text,
  theme text not null default 'light',
  aura integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  flow_id uuid references public.flows(id) on delete set null,
  slug text not null unique,
  title text not null,
  description text,
  cover_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  flow_id uuid references public.flows(id) on delete set null,
  moment_id uuid references public.moments(id) on delete set null,
  body text not null,
  media_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dahoras (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.waves (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  flow_id uuid references public.flows(id) on delete set null,
  moment_id uuid references public.moments(id) on delete set null,
  caption text,
  media_url text not null,
  thumbnail_url text,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.presences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  flow_id uuid references public.flows(id) on delete cascade,
  moment_id uuid references public.moments(id) on delete cascade,
  status text not null default 'online',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, flow_id, moment_id)
);

create table if not exists public.fans (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid not null references public.profiles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (fan_id, profile_id),
  check (fan_id <> profile_id)
);

create table if not exists public.selects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  wave_id uuid references public.waves(id) on delete cascade,
  moment_id uuid references public.moments(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  check (
    num_nonnulls(post_id, wave_id, moment_id) = 1
  )
);

create index if not exists posts_author_id_idx on public.posts(author_id);
create index if not exists posts_moment_id_idx on public.posts(moment_id);
create index if not exists comments_post_id_idx on public.comments(post_id);
create index if not exists dahoras_post_id_idx on public.dahoras(post_id);
create index if not exists waves_author_id_idx on public.waves(author_id);
create index if not exists presences_moment_id_idx on public.presences(moment_id);
create index if not exists fans_profile_id_idx on public.fans(profile_id);
create index if not exists selects_user_id_idx on public.selects(user_id);

alter table public.profiles enable row level security;
alter table public.flows enable row level security;
alter table public.moments enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.dahoras enable row level security;
alter table public.waves enable row level security;
alter table public.presences enable row level security;
alter table public.fans enable row level security;
alter table public.selects enable row level security;

create policy "profiles are publicly readable"
on public.profiles for select
using (true);

create policy "users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = user_id);

create policy "users can update their own profile"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "public flows are readable"
on public.flows for select
using (is_public or auth.uid() = owner_id);

create policy "users can manage their flows"
on public.flows for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "moments are publicly readable"
on public.moments for select
using (true);

create policy "authenticated users can create moments"
on public.moments for insert
with check (auth.uid() = creator_id);

create policy "moment creators can update moments"
on public.moments for update
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "posts are publicly readable"
on public.posts for select
using (true);

create policy "authenticated users can create posts"
on public.posts for insert
with check (auth.uid() = author_id);

create policy "authors can update posts"
on public.posts for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "authors can delete posts"
on public.posts for delete
using (auth.uid() = author_id);

create policy "comments are publicly readable"
on public.comments for select
using (true);

create policy "authenticated users can create comments"
on public.comments for insert
with check (auth.uid() = author_id);

create policy "comment authors can update comments"
on public.comments for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "comment authors can delete comments"
on public.comments for delete
using (auth.uid() = author_id);

create policy "dahoras are publicly readable"
on public.dahoras for select
using (true);

create policy "authenticated users can create dahoras"
on public.dahoras for insert
with check (auth.uid() = user_id);

create policy "users can delete their dahoras"
on public.dahoras for delete
using (auth.uid() = user_id);

create policy "waves are publicly readable"
on public.waves for select
using (true);

create policy "authenticated users can create waves"
on public.waves for insert
with check (auth.uid() = author_id);

create policy "wave authors can update waves"
on public.waves for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "wave authors can delete waves"
on public.waves for delete
using (auth.uid() = author_id);

create policy "presences are readable by authenticated users"
on public.presences for select
using (auth.role() = 'authenticated');

create policy "users can upsert their presence"
on public.presences for insert
with check (auth.uid() = user_id);

create policy "users can update their presence"
on public.presences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "fans are publicly readable"
on public.fans for select
using (true);

create policy "authenticated users can fan profiles"
on public.fans for insert
with check (auth.uid() = fan_id);

create policy "users can unfan profiles"
on public.fans for delete
using (auth.uid() = fan_id);

create policy "users can read their selects"
on public.selects for select
using (auth.uid() = user_id);

create policy "users can create their selects"
on public.selects for insert
with check (auth.uid() = user_id);

create policy "users can delete their selects"
on public.selects for delete
using (auth.uid() = user_id);

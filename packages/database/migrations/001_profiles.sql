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

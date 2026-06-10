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
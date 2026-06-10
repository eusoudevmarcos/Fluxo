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

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

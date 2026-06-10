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

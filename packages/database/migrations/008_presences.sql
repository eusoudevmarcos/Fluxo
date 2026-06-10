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

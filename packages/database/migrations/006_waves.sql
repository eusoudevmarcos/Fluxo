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

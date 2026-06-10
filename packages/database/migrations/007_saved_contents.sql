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

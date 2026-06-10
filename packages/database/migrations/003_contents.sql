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

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_text_length_check check (
    char_length(btrim(text)) > 0
    and char_length(text) <= 500
  )
);

alter table public.comments
add column if not exists content_id uuid references public.contents(id) on delete cascade;

alter table public.comments
add column if not exists author_id uuid references auth.users(id) on delete cascade;

alter table public.comments
add column if not exists text text;

alter table public.comments
add column if not exists created_at timestamptz not null default now();

alter table public.comments
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'comments_text_length_check'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
    add constraint comments_text_length_check check (
      char_length(btrim(text)) > 0
      and char_length(text) <= 500
    );
  end if;
end $$;

create index if not exists comments_content_id_idx
on public.comments(content_id);

create index if not exists comments_author_id_idx
on public.comments(author_id);

create index if not exists comments_created_at_idx
on public.comments(created_at desc);

alter table public.comments enable row level security;

drop policy if exists "comments on public contents are readable" on public.comments;
drop policy if exists "authenticated users can create own comment" on public.comments;
drop policy if exists "authenticated users can update own comment" on public.comments;
drop policy if exists "authenticated users can delete own comment" on public.comments;

create policy "comments on public contents are readable"
on public.comments for select
using (
  exists (
    select 1
    from public.contents
    where contents.id = comments.content_id
      and contents.visibility = 'public'
  )
);

create policy "authenticated users can create own comment"
on public.comments for insert
to authenticated
with check (
  auth.uid() = author_id
  and exists (
    select 1
    from public.contents
    where contents.id = comments.content_id
      and contents.visibility = 'public'
  )
);

create policy "authenticated users can update own comment"
on public.comments for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "authenticated users can delete own comment"
on public.comments for delete
to authenticated
using (auth.uid() = author_id);

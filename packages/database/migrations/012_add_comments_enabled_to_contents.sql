alter table public.contents
add column if not exists comments_enabled boolean not null default true;

drop policy if exists "authenticated users can delete own comment" on public.comments;

create policy "authenticated users can delete own comment"
on public.comments for delete
to authenticated
using (
  auth.uid() = author_id
  or exists (
    select 1
    from public.contents
    where contents.id = comments.content_id
      and contents.author_id = auth.uid()
  )
);

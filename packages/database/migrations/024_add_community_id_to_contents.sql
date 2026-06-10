alter table public.contents
add column if not exists community_id uuid null references public.communities(id) on delete set null;

create index if not exists contents_community_id_idx on public.contents(community_id);

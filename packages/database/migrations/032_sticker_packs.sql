create table if not exists public.sticker_packs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  theme_slug text,
  rarity text not null default 'common',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  slug text unique not null,
  name text not null,
  emotion text not null,
  asset_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_sticker_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  source text not null default 'mission',
  granted_by uuid references auth.users(id) on delete set null,
  constraint user_sticker_packs_unique_user_pack unique (user_id, pack_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sticker_packs_rarity_check') then
    alter table public.sticker_packs
    add constraint sticker_packs_rarity_check
    check (rarity in ('common', 'special', 'rare', 'epic', 'secret', 'legendary', 'milenar'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'stickers_emotion_check') then
    alter table public.stickers
    add constraint stickers_emotion_check
    check (emotion in ('medo', 'rindo', 'admirado', 'estressado', 'tirando_onda'));
  end if;
end $$;

create index if not exists sticker_packs_slug_idx on public.sticker_packs(slug);
create index if not exists stickers_pack_id_idx on public.stickers(pack_id);
create index if not exists user_sticker_packs_user_id_idx on public.user_sticker_packs(user_id);

alter table public.sticker_packs enable row level security;
alter table public.stickers enable row level security;
alter table public.user_sticker_packs enable row level security;

drop policy if exists "active sticker packs are public" on public.sticker_packs;
drop policy if exists "active stickers are public" on public.stickers;
drop policy if exists "users can read own sticker packs" on public.user_sticker_packs;

create policy "active sticker packs are public"
on public.sticker_packs for select
using (is_active = true);

create policy "active stickers are public"
on public.stickers for select
using (
  exists (
    select 1 from public.sticker_packs
    where sticker_packs.id = stickers.pack_id
      and sticker_packs.is_active = true
  )
);

create policy "users can read own sticker packs"
on public.user_sticker_packs for select
using (user_id = auth.uid());

insert into public.sticker_packs (slug, name, description, theme_slug, rarity)
values
  ('pack-raio-dourado', 'Raio Dourado', 'Stickers de energia e conquista dourada.', 'raio-dourado', 'special'),
  ('pack-onda-confusa', 'Onda Confusa', 'Stickers de caos leve, dúvida e humor.', 'onda-confusa', 'common'),
  ('pack-broto-prime', 'Broto Prime', 'Stickers de crescimento, foco e evolução.', 'broto-prime', 'rare'),
  ('pack-mare-tatica', 'Maré Tática', 'Stickers de estratégia e presença.', 'mare-tatica', 'rare'),
  ('pack-fogo-lendario', 'Fogo Lendário', 'Stickers de intensidade lendária.', 'fogo-lendario', 'legendary')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  theme_slug = excluded.theme_slug,
  rarity = excluded.rarity,
  is_active = true;

insert into public.stickers (pack_id, slug, name, emotion, sort_order)
select sticker_packs.id, sticker_packs.slug || '-' || emotions.emotion, emotions.name, emotions.emotion, emotions.sort_order
from public.sticker_packs
cross join (
  values
    ('medo', 'Medo', 1),
    ('rindo', 'Rindo', 2),
    ('admirado', 'Admirado', 3),
    ('estressado', 'Estressado', 4),
    ('tirando_onda', 'Tirando onda', 5)
) as emotions(emotion, name, sort_order)
where sticker_packs.slug in (
  'pack-raio-dourado',
  'pack-onda-confusa',
  'pack-broto-prime',
  'pack-mare-tatica',
  'pack-fogo-lendario'
)
on conflict (slug) do update set
  name = excluded.name,
  emotion = excluded.emotion,
  sort_order = excluded.sort_order;

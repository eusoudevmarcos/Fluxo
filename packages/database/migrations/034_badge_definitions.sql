create table if not exists public.badge_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  category text not null,
  rarity text not null,
  color_primary text,
  color_secondary text,
  icon_type text not null default 'trident',
  visual_config jsonb not null default '{}'::jsonb,
  is_purchasable boolean not null default false,
  is_active boolean not null default true,
  unlock_type text not null,
  unlock_conditions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'badge_definitions_category_check') then
    alter table public.badge_definitions
    add constraint badge_definitions_category_check
    check (category in ('verification', 'gamification', 'engagement', 'founder'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'badge_definitions_rarity_check') then
    alter table public.badge_definitions
    add constraint badge_definitions_rarity_check
    check (rarity in ('common', 'special', 'rare', 'epic', 'legendary', 'milenar'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'badge_definitions_unlock_type_check') then
    alter table public.badge_definitions
    add constraint badge_definitions_unlock_type_check
    check (unlock_type in ('purchase', 'engagement', 'manual', 'mission', 'level', 'founder', 'verification_review'));
  end if;
end $$;

create index if not exists badge_definitions_slug_idx on public.badge_definitions(slug);
create index if not exists badge_definitions_category_idx on public.badge_definitions(category);
create index if not exists badge_definitions_active_idx on public.badge_definitions(is_active);

alter table public.badge_definitions enable row level security;

drop policy if exists "active badges are public" on public.badge_definitions;

create policy "active badges are public"
on public.badge_definitions for select
using (is_active = true);

insert into public.badge_definitions (
  slug, name, description, category, rarity, color_primary, color_secondary,
  icon_type, visual_config, is_purchasable, unlock_type, unlock_conditions
)
values
  ('verified-basic', 'Verificado', 'Selo básico de verificação disponível futuramente para compra.', 'verification', 'common', 'silver', 'blue', 'trident', '{"tone":"silver-blue"}', true, 'purchase', '{}'),
  ('verified-pro', 'Verificado Pro', 'Verificação avançada liberada por critérios e análise.', 'verification', 'special', 'blue', 'silver', 'trident', '{"tone":"blue-silver"}', false, 'verification_review', '{"requires_review":true}'),
  ('verified-creator', 'Verificado Creator', 'Selo para criadores com presença, alcance e reputação na Ocean.', 'verification', 'rare', 'cyan', 'gold', 'trident', '{"tone":"cyan-gold"}', false, 'verification_review', '{"requires_review":true}'),
  ('verified-business', 'Verificado Business', 'Selo para marcas, negócios e perfis institucionais analisados.', 'verification', 'rare', 'gold', 'blue', 'trident', '{"tone":"gold-blue"}', false, 'verification_review', '{"requires_review":true}'),
  ('badge-iniciante', 'Iniciante', 'Primeiras conquistas e atividades concluídas na Ocean.', 'gamification', 'common', 'slate', 'cyan', 'trident', '{"tone":"slate-cyan"}', false, 'mission', '{}'),
  ('badge-oceaneiro', 'Oceaneiro', 'Reconhecimento de evolução, presença e criação consistente.', 'gamification', 'special', 'blue', 'cyan', 'trident', '{"tone":"blue-cyan"}', false, 'level', '{"level_min":10}'),
  ('badge-lendario', 'Lendário', 'Selo para perfis com evolução rara e alto impacto social.', 'gamification', 'rare', 'purple', 'gold', 'trident', '{"tone":"purple-gold"}', false, 'level', '{"level_min":50}'),
  ('badge-founder', 'Fundador', 'Selo exclusivo do fundador/CEO e contas liberadas manualmente.', 'founder', 'milenar', 'gold', 'amber', 'trident', '{"tone":"founder-gold"}', false, 'founder', '{}'),
  ('badge-dahora', 'Dahora', 'Reconhecimento por receber interações Dahora de forma consistente.', 'engagement', 'special', 'orange', 'gold', 'trident', '{"tone":"orange-gold"}', false, 'engagement', '{}'),
  ('badge-presenca', 'Presença', 'Reconhecimento por conteúdos com alta Presença.', 'engagement', 'special', 'cyan', 'blue', 'trident', '{"tone":"cyan-blue"}', false, 'engagement', '{}'),
  ('badge-mencoes', 'Menções', 'Reconhecimento por relevância e menções dentro da Ocean.', 'engagement', 'special', 'green', 'cyan', 'trident', '{"tone":"green-cyan"}', false, 'engagement', '{}'),
  ('badge-fas-100k', 'Fãs 100K', 'Elegível para análise de verificação.', 'engagement', 'rare', 'blue', 'gold', 'trident', '{"tone":"blue-gold"}', false, 'engagement', '{"fans_min":100000,"engagement_min":30}')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  color_primary = excluded.color_primary,
  color_secondary = excluded.color_secondary,
  icon_type = excluded.icon_type,
  visual_config = excluded.visual_config,
  is_purchasable = excluded.is_purchasable,
  unlock_type = excluded.unlock_type,
  unlock_conditions = excluded.unlock_conditions,
  is_active = true,
  updated_at = now();

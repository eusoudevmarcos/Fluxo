create table if not exists public.aura_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  rarity text not null,
  color_primary text,
  color_secondary text,
  visual_config jsonb not null default '{}'::jsonb,
  xp_bonus_percent integer not null default 0,
  level_min integer,
  level_max integer,
  unlock_type text not null default 'mission',
  unlock_condition jsonb not null default '{}'::jsonb,
  monthly_drop_limit integer,
  total_supply_limit integer,
  is_active boolean not null default true,
  is_secret boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aura_definitions_rarity_check') then
    alter table public.aura_definitions
    add constraint aura_definitions_rarity_check
    check (rarity in ('common', 'special', 'rare', 'epic', 'secret', 'legendary', 'milenar'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'aura_definitions_unlock_type_check') then
    alter table public.aura_definitions
    add constraint aura_definitions_unlock_type_check
    check (unlock_type in ('level', 'mission', 'monthly_drop', 'milestone', 'founder', 'gift', 'secret'));
  end if;
end $$;

create index if not exists aura_definitions_slug_idx on public.aura_definitions(slug);
create index if not exists aura_definitions_rarity_idx on public.aura_definitions(rarity);
create index if not exists aura_definitions_active_idx on public.aura_definitions(is_active);

alter table public.aura_definitions enable row level security;

drop policy if exists "active auras are public" on public.aura_definitions;

create policy "active auras are public"
on public.aura_definitions for select
using (is_active = true);

insert into public.aura_definitions (
  slug, name, description, rarity, color_primary, color_secondary, visual_config,
  xp_bonus_percent, level_min, level_max, unlock_type, unlock_condition, is_secret
)
values
  ('aura-super-saiyajin-comum', 'Aura Super Saiyajin Comum', 'Aura dourada inicial para quem começou a subir de nível na Ocean.', 'common', 'yellow', 'gold', '{"glow":"gold","motion":"pulse"}', 5, 1, 9, 'level', '{"level_min":1,"level_max":9}', false),
  ('aura-super-saiyajin-blue', 'Aura Super Saiyajin Blue', 'Aura azul/ciano para perfis que mantêm presença e criação.', 'rare', 'blue', 'cyan', '{"glow":"cyan","motion":"wave"}', 10, 10, 24, 'level', '{"level_min":10,"level_max":24}', false),
  ('aura-instinto-superior', 'Aura Instinto Superior', 'Aura branca/violeta para criadores em fase épica.', 'epic', 'white', 'violet', '{"glow":"violet","motion":"spark"}', 20, 25, 49, 'level', '{"level_min":25,"level_max":49}', false),
  ('aura-ego-superior', 'Aura Ego Superior', 'Aura secreta para quem ultrapassa 500% da meta semanal.', 'secret', 'red', 'magenta', '{"glow":"magenta","motion":"burst"}', 35, null, null, 'secret', '{"weekly_goal_percent":500}', true),
  ('raio-dourado', 'Raio Dourado', 'Aura especial para os primeiros 100 usuários a alcançar 1M.', 'special', 'yellow', 'gold', '{"glow":"gold","motion":"bolt"}', 15, null, null, 'milestone', '{"xp_total":1000000,"first_users":100}', false),
  ('onda-confusa', 'Onda Confusa', 'Aura comum para usuários seguintes que alcançarem 1M.', 'common', 'cyan', 'blue', '{"glow":"cyan","motion":"ripple"}', 8, null, null, 'milestone', '{"xp_total":1000000}', false),
  ('broto-prime', 'Broto Prime', 'Aura rara para quem alcançar 3M.', 'rare', 'green', 'lime', '{"glow":"lime","motion":"grow"}', 12, null, null, 'milestone', '{"xp_total":3000000}', false),
  ('mare-tatica', 'Maré Tática', 'Aura rara para quem alcançar 5M com consistência.', 'rare', 'blue', 'teal', '{"glow":"teal","motion":"flow"}', 14, null, null, 'milestone', '{"xp_total":5000000}', false),
  ('fogo-lendario', 'Fogo Lendário', 'Aura lendária para os primeiros 10 usuários a alcançar 5M.', 'legendary', 'orange', 'red', '{"glow":"fire","motion":"flame"}', 30, null, null, 'milestone', '{"xp_total":5000000,"first_users":10}', false),
  ('brasa-epica', 'Brasa Épica', 'Aura épica para os próximos 100 usuários a alcançar 5M.', 'epic', 'orange', 'magenta', '{"glow":"ember","motion":"flare"}', 24, null, null, 'milestone', '{"xp_total":5000000,"next_users":100}', false),
  ('faisca-inicial', 'Faísca Inicial', 'Aura especial para demais usuários que alcançarem 5M.', 'special', 'yellow', 'cyan', '{"glow":"spark","motion":"blink"}', 16, null, null, 'milestone', '{"xp_total":5000000}', false)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  color_primary = excluded.color_primary,
  color_secondary = excluded.color_secondary,
  visual_config = excluded.visual_config,
  xp_bonus_percent = excluded.xp_bonus_percent,
  level_min = excluded.level_min,
  level_max = excluded.level_max,
  unlock_type = excluded.unlock_type,
  unlock_condition = excluded.unlock_condition,
  is_secret = excluded.is_secret,
  is_active = true,
  updated_at = now();

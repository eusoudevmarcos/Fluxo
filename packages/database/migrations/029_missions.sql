create table if not exists public.mission_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  mission_type text not null,
  cadence text not null,
  target_value integer not null,
  xp_reward integer not null default 0,
  aura_reward_slug text,
  sticker_pack_reward_slug text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mission_definitions_type_check') then
    alter table public.mission_definitions
    add constraint mission_definitions_type_check
    check (mission_type in (
      'create_flow',
      'create_moments',
      'create_wave',
      'join_communities',
      'invite_friends',
      'daily_streak',
      'weekly_complete',
      'overachieve_weekly'
    ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'mission_definitions_cadence_check') then
    alter table public.mission_definitions
    add constraint mission_definitions_cadence_check
    check (cadence in ('daily', 'weekly', 'monthly', 'seasonal', 'once'));
  end if;
end $$;

create index if not exists mission_definitions_slug_idx on public.mission_definitions(slug);
create index if not exists mission_definitions_active_idx on public.mission_definitions(is_active);
create index if not exists mission_definitions_cadence_idx on public.mission_definitions(cadence);

alter table public.mission_definitions enable row level security;

drop policy if exists "active missions are public" on public.mission_definitions;

create policy "active missions are public"
on public.mission_definitions for select
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

insert into public.mission_definitions (
  slug, title, description, mission_type, cadence, target_value, xp_reward, aura_reward_slug, metadata
)
values
  ('daily_create_flow', '1 Flow', 'Publique 1 flow', 'create_flow', 'daily', 1, 50, null, '{}'),
  ('daily_create_moments', '1 Moments', 'Compartilhe 1 moment', 'create_moments', 'daily', 1, 50, null, '{}'),
  ('daily_create_wave', '1 Wave', 'Interaja com 1 criação', 'create_wave', 'daily', 1, 40, null, '{}'),
  ('weekly_7_days', '7 dias seguidos', 'Mantenha presença por 7 dias seguidos.', 'daily_streak', 'weekly', 7, 250, null, '{}'),
  ('weekly_join_5_communities', 'Participar de 5 comunidades', 'Entre em 5 comunidades durante a semana.', 'join_communities', 'weekly', 5, 200, null, '{}'),
  ('weekly_invite_10_friends', 'Convidar 10 amigos', 'Convide 10 amigos para a Ocean.', 'invite_friends', 'weekly', 10, 300, null, '{}'),
  ('weekly_overachieve_500', '500% da meta', 'Supere 500% da meta semanal.', 'overachieve_weekly', 'weekly', 500, 1000, 'aura-ego-superior', '{"secret":true}')
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  mission_type = excluded.mission_type,
  cadence = excluded.cadence,
  target_value = excluded.target_value,
  xp_reward = excluded.xp_reward,
  aura_reward_slug = excluded.aura_reward_slug,
  metadata = excluded.metadata,
  is_active = true;

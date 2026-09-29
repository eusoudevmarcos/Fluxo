-- Selos viram historico: todo selo conquistado fica registrado (exibido na bio como linha do
-- tempo de crescimento) e profile_verified_seals passa a guardar so o selo ATUAL, que e o de
-- maior patamar ja conquistado (em empate, o mais recente).
--
-- Campanhas de pioneiro ("os primeiros N") tem contador travado com FOR UPDATE, entao nunca
-- passam do limite mesmo com concessoes simultaneas, e fecham sozinhas quando a plataforma
-- chega ao limite de usuarios (100 mil). Depois disso so valem as regras permanentes (ex: azul
-- com 100 mil fas).

-- 1) Novos selos (arte ainda pendente -- campanhas deles nascem inativas).
alter table public.profile_verified_seals drop constraint if exists profile_verified_seals_seal_check;
alter table public.profile_verified_seals
add constraint profile_verified_seals_seal_check
check (seal in (
  'prime_user', 'azul', 'prime_influencer', 'roxo', 'gold', 'diamante', 'diamante_laranja', 'master', 'fundador'
));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
add constraint notifications_type_check
-- Lista completa (inclui os tipos da 050 e 054) para a migration poder ser reaplicada.
check (type in (
  'dahora', 'comment', 'wave', 'follow', 'mission_reward', 'coin_gift', 'seal_granted',
  'invite_accepted', 'creator_application_reviewed'
));

create or replace function public.seal_rank(seal text)
returns integer
language sql
immutable
as $$
  select case seal
    when 'fundador' then 100
    when 'master' then 90
    when 'diamante_laranja' then 80
    when 'diamante' then 70
    when 'gold' then 60
    when 'roxo' then 50
    when 'prime_influencer' then 40
    when 'azul' then 30
    when 'prime_user' then 10
    else 0
  end;
$$;

-- 2) Historico publico de selos.
create table if not exists public.user_seal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seal text not null,
  campaign_slug text,
  granted_reason text,
  granted_at timestamptz not null default now(),
  constraint user_seal_history_unique_seal unique (user_id, seal),
  constraint user_seal_history_seal_check check (seal in (
    'prime_user', 'azul', 'prime_influencer', 'roxo', 'gold', 'diamante', 'diamante_laranja', 'master', 'fundador'
  ))
);

create index if not exists user_seal_history_user_idx on public.user_seal_history(user_id, granted_at);
create index if not exists user_seal_history_campaign_idx on public.user_seal_history(campaign_slug);

alter table public.user_seal_history enable row level security;

drop policy if exists "seal history is public" on public.user_seal_history;

create policy "seal history is public"
on public.user_seal_history for select
using (true);

-- Selos ja concedidos manualmente entram no historico.
insert into public.user_seal_history (user_id, seal, granted_reason, granted_at)
select user_id, seal, granted_reason, created_at
from public.profile_verified_seals
on conflict (user_id, seal) do nothing;

-- 3) Campanhas.
create table if not exists public.seal_campaigns (
  slug text primary key,
  seal text not null,
  title text not null,
  description text,
  max_grants integer not null,
  granted_count integer not null default 0,
  platform_user_limit integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seal_campaigns_count_check check (granted_count >= 0 and granted_count <= max_grants)
);

alter table public.seal_campaigns enable row level security;

drop policy if exists "seal campaigns are public" on public.seal_campaigns;

-- Publico: a UI mostra "restam X de 1000" para gerar escassez.
create policy "seal campaigns are public"
on public.seal_campaigns for select
using (true);

insert into public.seal_campaigns (slug, seal, title, description, max_grants, platform_user_limit, is_active)
values
  ('pioneiro_azul', 'azul', 'Pioneiro Azul',
   'Os 1.000 primeiros a ter 10 convites aceitos na Fluxo.', 1000, 100000, true),
  ('pioneiro_diamante', 'diamante', 'Diamante Pioneiro',
   'Os 100 primeiros influenciadores a chegar em 10 mil fãs.', 100, 100000, true),
  ('prime_user', 'prime_user', 'Prime',
   'Os 10 mil primeiros a trazer um amigo para a Fluxo.', 10000, 100000, false),
  ('prime_influencer', 'prime_influencer', 'Prime Influencer',
   'Os 5 mil primeiros criadores aprovados no programa de influenciadores.', 5000, null, false)
on conflict (slug) do update set
  seal = excluded.seal,
  title = excluded.title,
  description = excluded.description,
  max_grants = excluded.max_grants,
  platform_user_limit = excluded.platform_user_limit,
  updated_at = now();

-- 4) Recalcula o selo exibido.
create or replace function public.refresh_current_seal(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  top_seal record;
begin
  select seal, granted_reason
  into top_seal
  from public.user_seal_history
  where user_id = target_user_id
  order by public.seal_rank(seal) desc, granted_at desc
  limit 1;

  if top_seal.seal is null then
    delete from public.profile_verified_seals where user_id = target_user_id;
    return;
  end if;

  insert into public.profile_verified_seals (user_id, seal, granted_reason)
  values (target_user_id, top_seal.seal, top_seal.granted_reason)
  on conflict (user_id) do update set
    seal = excluded.seal,
    granted_reason = excluded.granted_reason,
    updated_at = now()
  where profile_verified_seals.seal is distinct from excluded.seal;
end;
$$;

revoke execute on function public.refresh_current_seal(uuid) from public;
revoke execute on function public.refresh_current_seal(uuid) from anon;
revoke execute on function public.refresh_current_seal(uuid) from authenticated;

-- Concessao unica de selo (interna). Retorna false se o usuario ja tinha esse selo.
create or replace function public.grant_seal(
  target_user_id uuid,
  seal_value text,
  source_campaign_slug text default null,
  reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.user_seal_history (user_id, seal, campaign_slug, granted_reason)
  values (target_user_id, seal_value, source_campaign_slug, reason)
  on conflict (user_id, seal) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    return false;
  end if;

  perform public.refresh_current_seal(target_user_id);
  perform public.create_notification(target_user_id, 'seal_granted', null, null, reason);

  return true;
end;
$$;

revoke execute on function public.grant_seal(uuid, text, text, text) from public;
revoke execute on function public.grant_seal(uuid, text, text, text) from anon;
revoke execute on function public.grant_seal(uuid, text, text, text) from authenticated;

-- Reserva uma vaga numa campanha e concede o selo. Interna: quem decide se o usuario cumpriu o
-- criterio e a funcao de elegibilidade de cada campanha.
create or replace function public.claim_seal_campaign(
  target_user_id uuid,
  target_campaign_slug text,
  reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_row public.seal_campaigns;
  platform_users bigint;
begin
  -- Checagem barata antes do lock: evita disputar a linha da campanha a cada novo fa de quem
  -- ja ganhou.
  if exists (
    select 1 from public.user_seal_history
    where user_id = target_user_id and campaign_slug = target_campaign_slug
  ) then
    return false;
  end if;

  select *
  into campaign_row
  from public.seal_campaigns
  where slug = target_campaign_slug
  for update;

  if campaign_row.slug is null or not campaign_row.is_active then
    return false;
  end if;

  if campaign_row.granted_count >= campaign_row.max_grants then
    update public.seal_campaigns set is_active = false, updated_at = now() where slug = campaign_row.slug;
    return false;
  end if;

  if campaign_row.platform_user_limit is not null then
    select count(*) into platform_users from public.profiles;

    if platform_users >= campaign_row.platform_user_limit then
      update public.seal_campaigns set is_active = false, updated_at = now() where slug = campaign_row.slug;
      return false;
    end if;
  end if;

  if not public.grant_seal(
    target_user_id, campaign_row.seal, campaign_row.slug, coalesce(reason, campaign_row.description)
  ) then
    return false;
  end if;

  update public.seal_campaigns
  set granted_count = granted_count + 1,
      updated_at = now()
  where slug = campaign_row.slug;

  return true;
end;
$$;

revoke execute on function public.claim_seal_campaign(uuid, text, text) from public;
revoke execute on function public.claim_seal_campaign(uuid, text, text) from anon;
revoke execute on function public.claim_seal_campaign(uuid, text, text) from authenticated;

-- 5) Elegibilidade por fas (substitui 042): Diamante Pioneiro aos 10 mil fas enquanto houver
-- vaga, e a regra permanente do azul aos 100 mil fas.
create or replace function public.grant_verified_seal_if_eligible(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fans_count integer;
begin
  if target_user_id is null then
    return;
  end if;

  if pg_trigger_depth() = 0 and auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Cannot check seal eligibility for another user';
  end if;

  select count(*) into fans_count
  from public.user_relationships
  where following_id = target_user_id;

  if fans_count >= 10000 then
    perform public.claim_seal_campaign(target_user_id, 'pioneiro_diamante', 'Entre os 100 primeiros a chegar em 10 mil fãs');
  end if;

  if fans_count >= 100000 then
    perform public.grant_seal(target_user_id, 'azul', null, 'Atingiu 100 mil fãs');
  end if;
end;
$$;

revoke execute on function public.grant_verified_seal_if_eligible(uuid) from public;
revoke execute on function public.grant_verified_seal_if_eligible(uuid) from anon;
grant execute on function public.grant_verified_seal_if_eligible(uuid) to authenticated;

-- Avalia no servidor a cada novo fa (antes dependia do app chamar a RPC).
create or replace function public.seals_on_follow_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.grant_verified_seal_if_eligible(new.following_id);
  return new;
end;
$$;

drop trigger if exists user_relationships_seals on public.user_relationships;
create trigger user_relationships_seals
after insert on public.user_relationships
for each row execute function public.seals_on_follow_insert();

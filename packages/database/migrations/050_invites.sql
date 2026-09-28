-- Convites limitados + link pessoal.
--
-- * Cada usuario tem um codigo pessoal (link fluxo/c/CODIGO) e comeca com 5 convites.
-- * Mais convites se ganham com engajamento: cada missao semanal concluida da +1 (ate 5 por semana).
-- * O convite so e "aceito" quando o convidado conclui o cadastro (com data de nascimento) numa
--   conta nova (ate 7 dias). Ai os dois passam a se seguir, quem convidou e notificado, avanca a
--   missao de convites e concorre as campanhas Prime (1o amigo) e Pioneiro Azul (10 aceitos).
-- * Protecao de menores: adulto e conta de 14-15 anos nao sao conectados automaticamente
--   (o convite conta, mas o seguir fica a criterio de cada um).

-- 1) Origem 'invite' em relacoes e novo tipo de notificacao.
alter table public.user_relationships drop constraint if exists user_relationships_source_check;
alter table public.user_relationships
add constraint user_relationships_source_check
check (source in ('manual', 'default_official', 'onboarding', 'invite'));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
add constraint notifications_type_check
check (type in (
  'dahora', 'comment', 'wave', 'follow', 'mission_reward', 'coin_gift', 'seal_granted', 'invite_accepted'
));

-- 2) Tabelas.
create table if not exists public.invite_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text unique not null,
  slots_total integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invite_codes_slots_check check (slots_total >= 0)
);

alter table public.invite_codes enable row level security;

drop policy if exists "users can read own invite code" on public.invite_codes;

create policy "users can read own invite code"
on public.invite_codes for select
using (user_id = auth.uid());

create table if not exists public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null,
  connected boolean not null default false,
  created_at timestamptz not null default now(),
  constraint invite_redemptions_not_self check (inviter_id <> invitee_id)
);

create index if not exists invite_redemptions_inviter_idx
  on public.invite_redemptions(inviter_id, created_at desc);

alter table public.invite_redemptions enable row level security;

drop policy if exists "users can read own invite redemptions" on public.invite_redemptions;

create policy "users can read own invite redemptions"
on public.invite_redemptions for select
using (inviter_id = auth.uid() or invitee_id = auth.uid());

-- 3) Codigo pessoal (8 caracteres, sem letras/numeros ambiguos como 0/O e 1/I).
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  -- gen_random_uuid e nativo (sem depender do schema do pgcrypto no Supabase). Bytes 6 e 8
  -- carregam versao/variante do UUID v4, entao so usa os totalmente aleatorios.
  random_bytes bytea := uuid_send(gen_random_uuid());
  byte_positions constant integer[] := array[0, 1, 2, 3, 4, 5, 10, 11];
  result text := '';
  byte_position integer;
begin
  foreach byte_position in array byte_positions loop
    result := result || substr(alphabet, (get_byte(random_bytes, byte_position) % 32) + 1, 1);
  end loop;

  return result;
end;
$$;

create or replace function public.ensure_invite_code(target_user_id uuid)
returns public.invite_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.invite_codes;
  attempt integer := 0;
begin
  select * into result_row from public.invite_codes where user_id = target_user_id;

  while result_row.user_id is null loop
    attempt := attempt + 1;

    begin
      insert into public.invite_codes (user_id, code)
      values (target_user_id, public.generate_invite_code())
      on conflict (user_id) do nothing;
    exception when unique_violation then
      -- colisao de codigo: tenta outro
      if attempt >= 5 then
        raise;
      end if;
    end;

    select * into result_row from public.invite_codes where user_id = target_user_id;
  end loop;

  return result_row;
end;
$$;

revoke execute on function public.ensure_invite_code(uuid) from public;
revoke execute on function public.ensure_invite_code(uuid) from anon;
revoke execute on function public.ensure_invite_code(uuid) from authenticated;

-- 4) Painel "meus convites".
create or replace function public.get_my_invite_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  code_row public.invite_codes;
  used_count integer;
  azul_campaign public.seal_campaigns;
begin
  if current_user_id is null then
    raise exception 'Entre na Fluxo para convidar amigos.';
  end if;

  code_row := public.ensure_invite_code(current_user_id);

  select count(*) into used_count
  from public.invite_redemptions
  where inviter_id = current_user_id;

  select * into azul_campaign from public.seal_campaigns where slug = 'pioneiro_azul';

  return jsonb_build_object(
    'code', code_row.code,
    'slots_total', code_row.slots_total,
    'slots_used', used_count,
    'slots_available', greatest(code_row.slots_total - used_count, 0),
    'pioneer_azul_target', 10,
    'pioneer_azul_active', coalesce(azul_campaign.is_active, false),
    'pioneer_azul_remaining', greatest(coalesce(azul_campaign.max_grants - azul_campaign.granted_count, 0), 0)
  );
end;
$$;

revoke execute on function public.get_my_invite_status() from public;
revoke execute on function public.get_my_invite_status() from anon;
grant execute on function public.get_my_invite_status() to authenticated;

-- 5) Pre-visualizacao publica do link (pagina /c/CODIGO, antes do cadastro). So dados publicos
-- do perfil de quem convidou.
create or replace function public.get_invite_preview(invite_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  code_row public.invite_codes;
  inviter record;
  used_count integer;
begin
  select * into code_row
  from public.invite_codes
  where code = upper(btrim(invite_code));

  if code_row.user_id is null then
    return null;
  end if;

  select username, display_name, avatar_url
  into inviter
  from public.profiles
  where user_id = code_row.user_id;

  select count(*) into used_count
  from public.invite_redemptions
  where inviter_id = code_row.user_id;

  return jsonb_build_object(
    'code', code_row.code,
    'username', inviter.username,
    'display_name', inviter.display_name,
    'avatar_url', inviter.avatar_url,
    'has_slots', used_count < code_row.slots_total
  );
end;
$$;

revoke execute on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- 6) Resgate do convite pelo convidado (chamado ao concluir o onboarding).
create or replace function public.redeem_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_invitee_id uuid := auth.uid();
  code_row public.invite_codes;
  used_count integer;
  accepted_count integer;
  invitee_created_at timestamptz;
  inviter_band text;
  invitee_band text;
  should_connect boolean;
  inviter_username text;
begin
  if current_invitee_id is null then
    raise exception 'Entre na Fluxo para usar um convite.';
  end if;

  select * into code_row
  from public.invite_codes
  where code = upper(btrim(invite_code))
  for update;

  if code_row.user_id is null then
    raise exception 'Código de convite inválido.';
  end if;

  if code_row.user_id = current_invitee_id then
    raise exception 'Você não pode usar o seu próprio convite.';
  end if;

  if exists (select 1 from public.invite_redemptions where invite_redemptions.invitee_id = current_invitee_id) then
    raise exception 'Você já entrou na Fluxo com um convite.';
  end if;

  if not exists (
    select 1 from public.profiles
    where user_id = current_invitee_id and profile_required_completed = true
  ) then
    raise exception 'Conclua seu cadastro antes de usar o convite.';
  end if;

  select created_at into invitee_created_at from auth.users where id = current_invitee_id;

  if invitee_created_at < now() - interval '7 days' then
    raise exception 'Convites valem só para contas novas.';
  end if;

  select count(*) into used_count
  from public.invite_redemptions
  where inviter_id = code_row.user_id;

  select username into inviter_username from public.profiles where user_id = code_row.user_id;

  if used_count >= code_row.slots_total then
    raise exception 'Os convites de @% acabaram por enquanto.', coalesce(inviter_username, 'fluxo');
  end if;

  inviter_band := public.user_age_band(code_row.user_id);
  invitee_band := public.user_age_band(current_invitee_id);
  should_connect := not (
    (inviter_band = 'adult' and invitee_band = 'teen_14')
    or (inviter_band = 'teen_14' and invitee_band = 'adult')
  );

  insert into public.invite_redemptions (inviter_id, invitee_id, code, connected)
  values (code_row.user_id, current_invitee_id, code_row.code, should_connect);

  if should_connect then
    insert into public.user_relationships (follower_id, following_id, source)
    values
      (current_invitee_id, code_row.user_id, 'invite'),
      (code_row.user_id, current_invitee_id, 'invite')
    on conflict (follower_id, following_id) do nothing;
  end if;

  perform public.create_notification(code_row.user_id, 'invite_accepted', current_invitee_id, null, null);

  -- Recompensas de quem convidou.
  perform public.track_mission_event(code_row.user_id, 'invite_accepted', current_invitee_id::text, 'once', 100);

  perform public.claim_seal_campaign(
    code_row.user_id, 'prime_user', 'Trouxe o primeiro amigo para a Fluxo'
  );

  accepted_count := used_count + 1;

  if accepted_count >= 10 then
    perform public.claim_seal_campaign(
      code_row.user_id, 'pioneiro_azul', 'Pioneiro: 10 amigos trazidos para a Fluxo'
    );
  end if;

  return jsonb_build_object(
    'inviter_username', inviter_username,
    'connected', should_connect
  );
end;
$$;

revoke execute on function public.redeem_invite(text) from public;
revoke execute on function public.redeem_invite(text) from anon;
grant execute on function public.redeem_invite(text) to authenticated;

-- 7) Missao semanal concluida = +1 convite.
alter table public.mission_definitions add column if not exists invite_slot_reward integer not null default 0;

update public.mission_definitions
set invite_slot_reward = 1
where cadence = 'weekly' and invite_slot_reward = 0;

create or replace function public.invite_slots_on_mission_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_reward integer;
begin
  if not new.is_completed or old.is_completed then
    return new;
  end if;

  select invite_slot_reward into slot_reward
  from public.mission_definitions
  where id = new.mission_id;

  if coalesce(slot_reward, 0) > 0 then
    perform public.ensure_invite_code(new.user_id);

    update public.invite_codes
    set slots_total = slots_total + slot_reward,
        updated_at = now()
    where user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists user_mission_progress_invite_slots on public.user_mission_progress;
create trigger user_mission_progress_invite_slots
after update of is_completed on public.user_mission_progress
for each row execute function public.invite_slots_on_mission_complete();

-- 8) A missao "Convidar 10 amigos" passa a contar convites ACEITOS (contados no servidor).
update public.mission_definitions
set mission_type = 'invite_accepted',
    title = '10 amigos na Fluxo',
    description = 'Traga 10 amigos para a Fluxo com o seu link de convite.'
where slug = 'weekly_invite_10_friends';

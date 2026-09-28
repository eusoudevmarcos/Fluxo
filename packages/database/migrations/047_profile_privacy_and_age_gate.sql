-- 1) Privacidade: profiles tem policy de select publica (using true), entao ate aqui qualquer
-- pessoa com a anon key lia location_lat/lng (6 casas = precisao de centimetros) e
-- biological_sex de todo mundo, apesar do onboarding prometer "coordenadas salvas de forma
-- privada". Troca o grant de tabela inteira por grant por coluna, deixando de fora as colunas
-- sensiveis. O proprio usuario le essas colunas so via get_my_private_profile().
--
-- ATENCAO para migrations futuras: toda coluna NOVA em profiles precisa de
--   grant select (nova_coluna) on public.profiles to anon, authenticated;
-- senao ela fica invisivel para o client.
do $$
declare
  public_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into public_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name not in (
      'location_lat',
      'location_lng',
      'location_accuracy_meters',
      'geolocation_consent_at',
      'geolocation_denied_at',
      'biological_sex'
    );

  revoke select on public.profiles from anon, authenticated;
  execute format('grant select (%s) on public.profiles to anon, authenticated', public_columns);
end $$;

-- 2) Idade (modelo TikTok adaptado): data de nascimento declarada uma unica vez, em tela neutra,
-- guardada fora de profiles. Menor de 14 e bloqueado e nao pode tentar de novo com outra data.
-- 14-15 e 16-17 recebem protecoes por padrao; o vinculo com responsavel (ECA Digital, ate 16)
-- fica em guardian_status ate existir o fluxo de e-mail para o responsavel aprovar.
create table if not exists public.user_age_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date not null,
  guardian_status text not null default 'not_required',
  declared_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_age_records_guardian_status_check') then
    alter table public.user_age_records
    add constraint user_age_records_guardian_status_check
    check (guardian_status in ('not_required', 'pending', 'approved'));
  end if;
end $$;

alter table public.user_age_records enable row level security;

drop policy if exists "users can read own age record" on public.user_age_records;

create policy "users can read own age record"
on public.user_age_records for select
using (user_id = auth.uid());

create table if not exists public.age_gate_blocks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  blocked_at timestamptz not null default now()
);

alter table public.age_gate_blocks enable row level security;

drop policy if exists "users can read own age block" on public.age_gate_blocks;

create policy "users can read own age block"
on public.age_gate_blocks for select
using (user_id = auth.uid());

-- 'adult' (18+), 'teen_16' (16-17), 'teen_14' (14-15), 'blocked' (<14) ou 'unknown' (ainda nao
-- declarou -- contas antigas). Interna: nao exposta ao client para nao vazar faixa etaria alheia.
create or replace function public.user_age_band(target_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  record_birth_date date;
  years integer;
begin
  if exists (select 1 from public.age_gate_blocks where user_id = target_user_id) then
    return 'blocked';
  end if;

  select birth_date into record_birth_date
  from public.user_age_records
  where user_id = target_user_id;

  if record_birth_date is null then
    return 'unknown';
  end if;

  years := extract(year from age(current_date, record_birth_date));

  return case
    when years >= 18 then 'adult'
    when years >= 16 then 'teen_16'
    when years >= 14 then 'teen_14'
    else 'blocked'
  end;
end;
$$;

revoke execute on function public.user_age_band(uuid) from public;
revoke execute on function public.user_age_band(uuid) from anon;
revoke execute on function public.user_age_band(uuid) from authenticated;

-- Retorna a faixa em vez de lancar erro no caso <14: um raise desfaria o insert do bloqueio.
create or replace function public.set_my_birth_date(input_birth_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  years integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Entre na Fluxo para continuar.';
  end if;

  if exists (select 1 from public.age_gate_blocks where user_id = current_user_id) then
    return 'blocked';
  end if;

  if exists (select 1 from public.user_age_records where user_id = current_user_id) then
    raise exception 'Sua data de nascimento já foi registrada. Fale com o suporte para corrigir.';
  end if;

  if input_birth_date is null
    or input_birth_date > current_date
    or input_birth_date < date '1900-01-01' then
    raise exception 'Informe uma data de nascimento válida.';
  end if;

  years := extract(year from age(current_date, input_birth_date));

  if years < 14 then
    insert into public.age_gate_blocks (user_id) values (current_user_id)
    on conflict (user_id) do nothing;
    return 'blocked';
  end if;

  insert into public.user_age_records (user_id, birth_date, guardian_status)
  values (
    current_user_id,
    input_birth_date,
    case when years < 16 then 'pending' else 'not_required' end
  );

  return public.user_age_band(current_user_id);
end;
$$;

revoke execute on function public.set_my_birth_date(date) from public;
revoke execute on function public.set_my_birth_date(date) from anon;
grant execute on function public.set_my_birth_date(date) to authenticated;

create or replace function public.get_my_private_profile()
returns table (
  location_lat numeric,
  location_lng numeric,
  location_accuracy_meters numeric,
  geolocation_consent_at timestamptz,
  geolocation_denied_at timestamptz,
  biological_sex text,
  birth_date date,
  age_band text,
  guardian_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.location_lat,
    profiles.location_lng,
    profiles.location_accuracy_meters,
    profiles.geolocation_consent_at,
    profiles.geolocation_denied_at,
    profiles.biological_sex,
    age_records.birth_date,
    public.user_age_band(auth.uid()),
    age_records.guardian_status
  from public.profiles
  left join public.user_age_records age_records on age_records.user_id = profiles.user_id
  where profiles.user_id = auth.uid();
$$;

revoke execute on function public.get_my_private_profile() from public;
revoke execute on function public.get_my_private_profile() from anon;
grant execute on function public.get_my_private_profile() to authenticated;

-- 3) Porta de entrada: o perfil so fica "completo" com data de nascimento valida. Todas as
-- guardas de rota (web e mobile) ja mandam para o onboarding quando profile_required_completed
-- e false, entao contas antigas sem data voltam ao onboarding (ja preenchido) so para informar
-- a data. Versoes antigas do app recebem a mensagem abaixo ao tentar concluir.
create or replace function public.enforce_age_before_profile_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.profile_required_completed is true
    and (tg_op = 'INSERT' or old.profile_required_completed is distinct from true)
    and not exists (select 1 from public.user_age_records where user_id = new.user_id) then
    raise exception 'Informe sua data de nascimento para continuar. Atualize o app se essa etapa não aparecer.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_age on public.profiles;
create trigger profiles_enforce_age
before insert or update of profile_required_completed on public.profiles
for each row execute function public.enforce_age_before_profile_completion();

update public.profiles
set profile_required_completed = false
where profile_required_completed = true
  and not exists (
    select 1 from public.user_age_records where user_age_records.user_id = profiles.user_id
  );

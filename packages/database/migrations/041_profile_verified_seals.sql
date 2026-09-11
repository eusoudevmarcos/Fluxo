-- Selos de identidade/status do perfil (distintos dos badges de conquista em badge_definitions).
-- Concessao e 100% manual por enquanto: os criterios (fas, visualizacoes de stream, compra na
-- store) dependem de sistemas que ainda nao existem no produto (contagem de views, pagamentos),
-- entao esta tabela nao tem policy de insert/update/delete para usuarios -- so e editavel via
-- SQL editor do Supabase (mesmo padrao ja usado em official_accounts).
create table if not exists public.profile_verified_seals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seal text not null,
  granted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profile_verified_seals_seal_check') then
    alter table public.profile_verified_seals
    add constraint profile_verified_seals_seal_check
    check (seal in ('azul', 'roxo', 'gold', 'diamante', 'diamante_laranja', 'master', 'fundador'));
  end if;
end $$;

create index if not exists profile_verified_seals_seal_idx on public.profile_verified_seals(seal);

alter table public.profile_verified_seals enable row level security;

drop policy if exists "verified seals are public" on public.profile_verified_seals;

create policy "verified seals are public"
on public.profile_verified_seals for select
using (true);

comment on table public.profile_verified_seals is
  'Selo de identidade exibido no perfil (azul/roxo/gold/diamante/diamante_laranja/master/fundador). Concedido manualmente ate existir contagem automatica de fas/views e fluxo de compra.';

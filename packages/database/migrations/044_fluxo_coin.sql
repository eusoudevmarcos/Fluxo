-- Fluxo Coin: moeda interna, sem dinheiro real. Acumula por missao/nivel e por presente de
-- outro usuario; gasta so presenteando outro usuario, por enquanto (sem loja/monetizacao).
create table if not exists public.user_coin_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0,
  lifetime_earned bigint not null default 0,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_coin_wallets_balance_check') then
    alter table public.user_coin_wallets
    add constraint user_coin_wallets_balance_check check (balance >= 0);
  end if;
end $$;

alter table public.user_coin_wallets enable row level security;

drop policy if exists "users can read own wallet" on public.user_coin_wallets;

create policy "users can read own wallet"
on public.user_coin_wallets for select
using (user_id = auth.uid());

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null,
  balance_after bigint not null,
  type text not null,
  related_user_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coin_transactions_type_check') then
    alter table public.coin_transactions
    add constraint coin_transactions_type_check
    check (type in ('mission_reward', 'gift_sent', 'gift_received', 'admin_adjustment'));
  end if;
end $$;

create index if not exists coin_transactions_user_id_idx on public.coin_transactions(user_id, created_at desc);

alter table public.coin_transactions enable row level security;

drop policy if exists "users can read own coin transactions" on public.coin_transactions;

create policy "users can read own coin transactions"
on public.coin_transactions for select
using (user_id = auth.uid() or related_user_id = auth.uid());

create or replace function public.ensure_user_coin_wallet(target_user_id uuid)
returns public.user_coin_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.user_coin_wallets;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Cannot ensure wallet for another user';
  end if;

  insert into public.user_coin_wallets (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  select * into result_row from public.user_coin_wallets where user_id = target_user_id;

  return result_row;
end;
$$;

revoke execute on function public.ensure_user_coin_wallet(uuid) from public;
revoke execute on function public.ensure_user_coin_wallet(uuid) from anon;
grant execute on function public.ensure_user_coin_wallet(uuid) to authenticated;

-- Admin/interno apenas -- chamavel por outras funcoes security definer (ex: gift_user_coins,
-- increment_mission_progress) ou pelo SQL editor do Supabase, nunca direto pelo client.
create or replace function public.add_user_coins(
  target_user_id uuid,
  amount bigint,
  transaction_type text,
  transaction_reason text default null,
  target_related_user_id uuid default null
)
returns public.coin_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_row public.user_coin_wallets;
  transaction_row public.coin_transactions;
begin
  if target_user_id is null or amount is null or amount = 0 then
    raise exception 'target_user_id and a non-zero amount are required';
  end if;

  perform public.ensure_user_coin_wallet(target_user_id);

  select * into wallet_row from public.user_coin_wallets where user_id = target_user_id for update;

  if wallet_row.balance + amount < 0 then
    raise exception 'Saldo insuficiente';
  end if;

  update public.user_coin_wallets
  set
    balance = balance + amount,
    lifetime_earned = lifetime_earned + greatest(amount, 0),
    updated_at = now()
  where user_id = target_user_id
  returning * into wallet_row;

  insert into public.coin_transactions (user_id, amount, balance_after, type, related_user_id, reason)
  values (target_user_id, amount, wallet_row.balance, transaction_type, target_related_user_id, transaction_reason)
  returning * into transaction_row;

  return transaction_row;
end;
$$;

revoke execute on function public.add_user_coins(uuid, bigint, text, text, uuid) from public;
revoke execute on function public.add_user_coins(uuid, bigint, text, text, uuid) from anon;
revoke execute on function public.add_user_coins(uuid, bigint, text, text, uuid) from authenticated;

create or replace function public.gift_user_coins(
  to_user_id uuid,
  amount bigint,
  gift_reason text default null
)
returns public.user_coin_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  from_user_id uuid;
  sender_wallet public.user_coin_wallets;
begin
  from_user_id := auth.uid();

  if from_user_id is null then
    raise exception 'Entre na Fluxo para presentear.';
  end if;

  if to_user_id is null or to_user_id = from_user_id then
    raise exception 'Escolha outra pessoa para presentear.';
  end if;

  if amount is null or amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  perform public.ensure_user_coin_wallet(from_user_id);

  select * into sender_wallet from public.user_coin_wallets where user_id = from_user_id;

  if sender_wallet.balance < amount then
    raise exception 'Saldo insuficiente';
  end if;

  perform public.add_user_coins(from_user_id, -amount, 'gift_sent', gift_reason, to_user_id);
  perform public.add_user_coins(to_user_id, amount, 'gift_received', gift_reason, from_user_id);
  perform public.create_notification(to_user_id, 'coin_gift', from_user_id, null, gift_reason);

  select * into sender_wallet from public.user_coin_wallets where user_id = from_user_id;

  return sender_wallet;
end;
$$;

revoke execute on function public.gift_user_coins(uuid, bigint, text) from public;
revoke execute on function public.gift_user_coins(uuid, bigint, text) from anon;
grant execute on function public.gift_user_coins(uuid, bigint, text) to authenticated;

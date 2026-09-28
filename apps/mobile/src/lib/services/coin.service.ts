import type { SupabaseClient } from "@supabase/supabase-js";

export type CoinTransactionType =
  | "mission_reward"
  | "gift_sent"
  | "gift_received"
  | "admin_adjustment";

export type UserCoinWallet = {
  user_id: string;
  balance: number;
  lifetime_earned: number;
  updated_at: string;
};

export type CoinTransactionCounterpart = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type CoinTransaction = {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  type: CoinTransactionType;
  related_user_id: string | null;
  reason: string | null;
  created_at: string;
  counterpart?: CoinTransactionCounterpart | null;
};

export async function getMyCoinWallet(supabase: SupabaseClient): Promise<UserCoinWallet | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("user_coin_wallets")
    .select("*")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) throw error;

  return data as UserCoinWallet | null;
}

export async function ensureMyCoinWallet(supabase: SupabaseClient): Promise<UserCoinWallet> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Fluxo para ver sua carteira.");

  const { data, error } = await supabase.rpc("ensure_user_coin_wallet", {
    target_user_id: userData.user.id,
  });

  if (error) throw error;

  return data as UserCoinWallet;
}

export async function listMyCoinTransactions(supabase: SupabaseClient): Promise<CoinTransaction[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("coin_transactions")
    .select("*")
    .or(`user_id.eq.${userData.user.id},related_user_id.eq.${userData.user.id}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const transactions = (data ?? []) as CoinTransaction[];
  const counterpartIds = [
    ...new Set(transactions.map((transaction) => transaction.related_user_id).filter(Boolean)),
  ] as string[];

  if (!counterpartIds.length) return transactions;

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id,username,display_name,avatar_url")
    .in("user_id", counterpartIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

  return transactions.map((transaction) => ({
    ...transaction,
    counterpart: transaction.related_user_id
      ? (profileMap.get(transaction.related_user_id) ?? null)
      : null,
  }));
}

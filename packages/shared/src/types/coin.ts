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

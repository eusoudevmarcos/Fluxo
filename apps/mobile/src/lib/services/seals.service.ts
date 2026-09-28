import type { SupabaseClient } from "@supabase/supabase-js";

export type VerifiedSeal =
  | "prime_user"
  | "azul"
  | "prime_influencer"
  | "roxo"
  | "gold"
  | "diamante"
  | "diamante_laranja"
  | "master"
  | "fundador";

type SealRow = {
  user_id: string;
  seal: VerifiedSeal;
};

export type SealHistoryItem = {
  seal: VerifiedSeal;
  granted_reason: string | null;
  granted_at: string;
};

export async function getVerifiedSealsByUserIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, VerifiedSeal>> {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueUserIds.length) return new Map();

  const { data, error } = await supabase
    .from("profile_verified_seals")
    .select("user_id,seal")
    .in("user_id", uniqueUserIds);

  if (error) {
    // A tabela ainda nao existe ate a migration 041 ser aplicada no Supabase.
    if (error.code === "42P01") return new Map();
    throw error;
  }

  return new Map(((data ?? []) as SealRow[]).map((row) => [row.user_id, row.seal]));
}

export async function getVerifiedSeal(
  supabase: SupabaseClient,
  userId: string,
): Promise<VerifiedSeal | null> {
  const seals = await getVerifiedSealsByUserIds(supabase, [userId]);
  return seals.get(userId) ?? null;
}

// Linha do tempo de conquistas exibida no perfil (migration 049). Publica; o selo exibido ao
// lado do nome e o de maior patamar.
export async function getSealHistory(
  supabase: SupabaseClient,
  userId: string,
): Promise<SealHistoryItem[]> {
  const { data, error } = await supabase
    .from("user_seal_history")
    .select("seal,granted_reason,granted_at")
    .eq("user_id", userId)
    .order("granted_at", { ascending: true });

  if (error) {
    // Migration 049 ainda nao aplicada.
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }

  return (data ?? []) as SealHistoryItem[];
}

// Desde a migration 049 o banco confere os selos por fas a cada novo fa (trigger); esta chamada
// continua como reforco para bancos sem a 049. Nao lanca se a funcao nao existir.
export async function checkAndGrantVerifiedSeal(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.rpc("grant_verified_seal_if_eligible", {
    target_user_id: userId,
  });

  if (error && error.code !== "42883") throw error;
}

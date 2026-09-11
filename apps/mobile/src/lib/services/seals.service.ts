import type { SupabaseClient } from "@supabase/supabase-js";

export type VerifiedSeal =
  | "azul"
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

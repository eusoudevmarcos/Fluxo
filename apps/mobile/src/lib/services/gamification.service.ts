import type { SupabaseClient } from "@supabase/supabase-js";

export type UserGamification = {
  user_id: string;
  level: number;
  xp_total: number;
  xp_current_level: number;
  xp_next_level: number;
  weekly_xp: number;
  monthly_xp: number;
  streak_days: number;
  is_founder: boolean;
  is_official_profile: boolean;
  has_all_auras: boolean;
};

export async function getMyGamification(supabase: SupabaseClient): Promise<UserGamification | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("user_gamification")
    .select("*")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) throw error;

  return data as UserGamification | null;
}

export async function ensureMyGamification(supabase: SupabaseClient): Promise<UserGamification> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Fluxo para ver seu progresso.");

  const { data, error } = await supabase.rpc("ensure_user_gamification", {
    target_user_id: userData.user.id,
  });

  if (error) throw error;

  return data as UserGamification;
}

export function getLevelTitle(gamification: UserGamification | null) {
  if (gamification?.is_founder) return "Fundador Fluxo";
  if ((gamification?.level ?? 1) >= 25) return "Fluxeiro Elite";
  if ((gamification?.level ?? 1) >= 10) return "Fluxeiro";
  return "Novo Flow";
}

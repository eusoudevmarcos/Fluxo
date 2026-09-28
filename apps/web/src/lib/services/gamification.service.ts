import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserGamification } from "@ocean/shared";

export async function getMyGamification(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Fluxo para ver sua gamificação.");

  const { data, error } = await supabase
    .from("user_gamification")
    .select("*")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) throw error;

  return data as UserGamification | null;
}

export async function ensureMyGamification(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Fluxo para ativar sua gamificação.");

  const { data, error } = await supabase.rpc("ensure_user_gamification", {
    target_user_id: userData.user.id,
  });

  if (error) throw error;

  return data as UserGamification;
}

export async function getMyLevelSummary(supabase: SupabaseClient) {
  const gamification = await ensureMyGamification(supabase);

  return {
    level: gamification.level,
    xp_total: gamification.xp_total,
    xp_current_level: gamification.xp_current_level,
    xp_next_level: gamification.xp_next_level,
    weekly_xp: gamification.weekly_xp,
    monthly_xp: gamification.monthly_xp,
    streak_days: gamification.streak_days,
    is_founder: gamification.is_founder,
  };
}

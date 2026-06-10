import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserGamification } from "@ocean/shared";

export type GamificationAction =
  | "create_flow"
  | "create_moments"
  | "create_wave"
  | "join_community"
  | "daily_activity";

export async function getMyGamification(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Ocean para ver sua gamificação.");

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
  if (!userData.user) throw new Error("Entre na Ocean para ativar sua gamificação.");

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

export async function addXpForAction(
  supabase: SupabaseClient,
  action: GamificationAction,
  metadata: Record<string, unknown> = {},
) {
  const { incrementMissionProgress } = await import("./missions.service");

  if (action === "create_flow") {
    return incrementMissionProgress(supabase, "daily_create_flow", 1, metadata);
  }

  if (action === "create_moments") {
    return incrementMissionProgress(supabase, "daily_create_moments", 1, metadata);
  }

  if (action === "create_wave") {
    return incrementMissionProgress(supabase, "daily_create_wave", 1, metadata);
  }

  if (action === "join_community") {
    return incrementMissionProgress(supabase, "weekly_join_5_communities", 1, metadata);
  }

  if (action === "daily_activity") {
    return incrementMissionProgress(supabase, "weekly_7_days", 1, metadata);
  }

  return null;
}

export async function safelyAddXpForAction(
  supabase: SupabaseClient,
  action: GamificationAction,
  metadata: Record<string, unknown> = {},
) {
  try {
    return await addXpForAction(supabase, action, metadata);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Gamificação não aplicada:", error);
    }
    return null;
  }
}

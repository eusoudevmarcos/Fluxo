import type { SupabaseClient } from "@supabase/supabase-js";

export type MissionType =
  | "create_flow"
  | "create_moments"
  | "create_post"
  | "create_wave"
  | "create_comment"
  | "mention_people"
  | "follow_people"
  | "gain_fans"
  | "receive_waves"
  | "receive_comments"
  | "join_communities"
  | "invite_friends"
  | "invite_accepted"
  | "daily_streak"
  | "daily_active"
  | "weekly_complete"
  | "overachieve_weekly";

export type MissionCadence = "daily" | "weekly" | "monthly" | "seasonal" | "once";

export type MissionDefinition = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  mission_type: MissionType;
  cadence: MissionCadence;
  target_value: number;
  xp_reward: number;
  coin_reward: number;
  aura_reward_slug: string | null;
  sticker_pack_reward_slug: string | null;
  is_active: boolean;
};

export type UserMissionProgress = {
  id: string;
  user_id: string;
  mission_id: string;
  period_key: string;
  current_value: number;
  target_value: number;
  is_completed: boolean;
  completed_at: string | null;
  reward_claimed: boolean;
  reward_claimed_at: string | null;
  mission?: MissionDefinition;
};

// Progresso e recompensa de missao sao aplicados no servidor por trigger (migration 048) a
// partir das acoes reais; o client so le.

function isMissingFunction(error: { code?: string } | null) {
  return error?.code === "42883" || error?.code === "PGRST202";
}

// Missoes da pessoa agora: 3 diarias + 5 semanais sorteadas para ela (migration 051) e os
// desafios fixos. Sem a 051 aplicada, cai na lista completa de missoes ativas.
export async function listActiveMissions(supabase: SupabaseClient): Promise<MissionDefinition[]> {
  const { data, error } = await supabase.rpc("get_my_current_missions");

  if (!error) return (data ?? []) as MissionDefinition[];
  if (!isMissingFunction(error)) throw error;

  const fallback = await supabase
    .from("mission_definitions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (fallback.error) throw fallback.error;

  return (fallback.data ?? []) as MissionDefinition[];
}

// Progresso so do dia/semana atual (antes podia mostrar o progresso de ontem).
export async function getMyMissionProgress(supabase: SupabaseClient): Promise<UserMissionProgress[]> {
  const { data, error } = await supabase
    .rpc("get_my_current_mission_progress")
    .select("*, mission:mission_definitions(*)");

  if (!error) return (data ?? []) as UserMissionProgress[];
  if (!isMissingFunction(error)) throw error;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return [];

  const fallback = await supabase
    .from("user_mission_progress")
    .select("*, mission:mission_definitions(*)")
    .eq("user_id", userData.user.id)
    .order("updated_at", { ascending: false });

  if (fallback.error) throw fallback.error;

  return (fallback.data ?? []) as UserMissionProgress[];
}

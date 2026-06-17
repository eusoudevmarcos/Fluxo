import type { SupabaseClient } from "@supabase/supabase-js";
import type { MissionDefinition, UserMissionProgress } from "@ocean/shared";

export async function listActiveMissions(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("mission_definitions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as MissionDefinition[];
}

export async function getMyMissionProgress(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Wave para ver suas Missões.");

  const { data, error } = await supabase
    .from("user_mission_progress")
    .select("*, mission:mission_definitions(*)")
    .eq("user_id", userData.user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as UserMissionProgress[];
}

export async function incrementMissionProgress(
  supabase: SupabaseClient,
  missionSlug: string,
  amount = 1,
  metadata: Record<string, unknown> = {},
) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Wave para avançar Missões.");

  const { data, error } = await supabase.rpc("increment_mission_progress", {
    target_user_id: userData.user.id,
    mission_slug: missionSlug,
    increment_by: amount,
    progress_metadata: metadata,
  });

  if (error) throw error;

  return data as UserMissionProgress;
}

export async function claimMissionReward(supabase: SupabaseClient, progressId: string) {
  const { data, error } = await supabase.rpc("claim_mission_reward", {
    progress_id: progressId,
  });

  if (error) throw error;

  return data as UserMissionProgress;
}

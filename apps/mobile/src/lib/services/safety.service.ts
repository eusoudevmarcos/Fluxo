import type { SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { Platform } from "react-native";

export type ReportTargetType = "content" | "comment" | "profile" | "message";

export const REPORT_REASONS = [
  { id: "spam", label: "Spam ou golpe" },
  { id: "harassment", label: "Assédio ou bullying" },
  { id: "hate", label: "Discurso de ódio" },
  { id: "nudity", label: "Nudez ou conteúdo sexual" },
  { id: "violence", label: "Violência ou ameaça" },
  { id: "minor_safety", label: "Risco a criança ou adolescente" },
  { id: "self_harm", label: "Automutilação ou suicídio" },
  { id: "fake", label: "Perfil falso ou se passando por alguém" },
  { id: "other", label: "Outro motivo" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

export type BlockedUser = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

// Denuncia (migration 055). Com 5 denuncias um post fica oculto ate a moderacao revisar.
export async function submitReport(
  supabase: SupabaseClient,
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  details = "",
) {
  const { error } = await supabase.rpc("submit_report", {
    input_target_type: targetType,
    input_target_id: targetId,
    input_reason: reason,
    input_details: details,
  });
  if (error) throw error;
}

// Bloquear desfaz o seguir nos dois sentidos e esconde posts, comentarios, busca e privs.
export async function blockUser(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.rpc("block_user", { target_user_id: userId });
  if (error) throw error;
}

export async function unblockUser(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.rpc("unblock_user", { target_user_id: userId });
  if (error) throw error;
}

export async function isUserBlockedByMe(supabase: SupabaseClient, userId: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", userData.user.id)
    .eq("blocked_id", userId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

export async function listBlockedUsers(supabase: SupabaseClient): Promise<BlockedUser[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const ids = ((data ?? []) as { blocked_id: string }[]).map((row) => row.blocked_id);
  if (!ids.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id,username,display_name,avatar_url")
    .in("user_id", ids);

  if (profilesError) throw profilesError;
  return (profiles ?? []) as BlockedUser[];
}

function getAppContext() {
  return {
    platform: Platform.OS,
    app_version: Constants.expoConfig?.version ?? null,
  };
}

export async function sendFeedback(
  supabase: SupabaseClient,
  kind: "bug" | "idea" | "other" | "crash",
  message: string,
  context: Record<string, unknown> = {},
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Entre na Fluxo para enviar feedback.");

  const { platform, app_version } = getAppContext();
  const { error } = await supabase.from("app_feedback").insert({
    user_id: userData.user.id,
    kind,
    message: message.trim().slice(0, 4000),
    platform,
    app_version,
    context,
  });

  if (error) throw error;
}

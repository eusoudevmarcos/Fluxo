import type { SupabaseClient } from "@supabase/supabase-js";

// Servicos do painel administrativo (so contas oficiais; o banco recusa as demais).

export type OpenReport = {
  target_type: "content" | "comment" | "profile" | "message";
  target_id: string;
  target_user_id: string | null;
  target_username: string | null;
  report_count: number;
  reasons: string[];
  details: string[];
  content_text: string | null;
  content_media_url: string | null;
  content_visibility: string | null;
  first_reported_at: string;
};

export type AppFeedback = {
  id: string;
  user_id: string | null;
  kind: "bug" | "idea" | "other" | "crash";
  message: string;
  platform: string | null;
  app_version: string | null;
  context: Record<string, unknown>;
  created_at: string;
};

export type GrowthMetrics = {
  generated_at: string;
  users: Record<string, number>;
  invites: Record<string, number>;
  missions: Record<string, number>;
  content: Record<string, number>;
  seal_campaigns: { slug: string; title: string; granted: number; max: number; active: boolean }[];
  safety: Record<string, number>;
  creators: Record<string, number>;
};

export const REPORT_REASON_LABELS: Record<string, string> = {
  spam: "Spam/golpe",
  harassment: "Assédio",
  hate: "Ódio",
  nudity: "Nudez/sexual",
  violence: "Violência",
  minor_safety: "Risco a menor",
  self_harm: "Automutilação",
  fake: "Perfil falso",
  other: "Outro",
};

export async function listOpenReports(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("list_open_reports");
  if (error) throw error;
  return (data ?? []) as OpenReport[];
}

export async function resolveReports(
  supabase: SupabaseClient,
  targetType: OpenReport["target_type"],
  targetId: string,
  action: "dismiss" | "remove",
) {
  const { error } = await supabase.rpc("resolve_reports", {
    input_target_type: targetType,
    input_target_id: targetId,
    action,
  });
  if (error) throw error;
}

export async function listAppFeedback(supabase: SupabaseClient, kind: AppFeedback["kind"] | null) {
  const { data, error } = await supabase.rpc("list_app_feedback", { filter_kind: kind });
  if (error) throw error;
  return (data ?? []) as AppFeedback[];
}

export async function getGrowthMetrics(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("get_growth_metrics");
  if (error) throw error;
  return data as GrowthMetrics;
}

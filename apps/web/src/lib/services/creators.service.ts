import type { SupabaseClient } from "@supabase/supabase-js";

export const CREATOR_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "twitch", label: "Twitch" },
  { id: "kwai", label: "Kwai" },
  { id: "x", label: "X" },
  { id: "outra", label: "Outra" },
] as const;

export type CreatorPlatform = (typeof CREATOR_PLATFORMS)[number]["id"];
export type CreatorApplicationStatus = "pending" | "approved" | "rejected";

export const CREATOR_MIN_FOLLOWERS = 1000;

export type CreatorApplication = {
  id: string;
  user_id: string;
  platform: CreatorPlatform;
  handle: string;
  profile_url: string | null;
  followers_count: number;
  niche: string | null;
  message: string | null;
  verification_code: string;
  status: CreatorApplicationStatus;
  rewards_granted: boolean;
  review_note: string | null;
  created_at: string;
};

export type CreatorApplicationForReview = CreatorApplication & {
  username: string | null;
  display_name: string | null;
};

export type CreatorApplicationInput = {
  platform: CreatorPlatform;
  handle: string;
  profile_url: string;
  followers_count: number;
  niche: string;
  message: string;
};

export type PrimeInfluencerCampaign = {
  is_active: boolean;
  max_grants: number;
  granted_count: number;
};

export async function getMyCreatorApplication(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("creator_applications")
    .select("*")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) throw error;
  return data as CreatorApplication | null;
}

export async function getPrimeInfluencerCampaign(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("seal_campaigns")
    .select("is_active,max_grants,granted_count")
    .eq("slug", "prime_influencer")
    .maybeSingle();

  if (error) return null;
  return data as PrimeInfluencerCampaign | null;
}

export async function submitCreatorApplication(
  supabase: SupabaseClient,
  input: CreatorApplicationInput,
) {
  const { data, error } = await supabase.rpc("submit_creator_application", {
    input_platform: input.platform,
    input_handle: input.handle,
    input_profile_url: input.profile_url,
    input_followers_count: input.followers_count,
    input_niche: input.niche,
    input_message: input.message,
  });

  if (error) throw error;
  return data as CreatorApplication;
}

export async function isOfficialAccount(supabase: SupabaseClient) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const { data, error } = await supabase.rpc("is_official_account", {
    target_user_id: userData.user.id,
  });

  if (error) return false;
  return Boolean(data);
}

export async function listCreatorApplications(
  supabase: SupabaseClient,
  status: CreatorApplicationStatus | null,
) {
  const { data, error } = await supabase.rpc("list_creator_applications", {
    filter_status: status,
  });

  if (error) throw error;
  return (data ?? []) as CreatorApplicationForReview[];
}

export async function reviewCreatorApplication(
  supabase: SupabaseClient,
  applicationId: string,
  approve: boolean,
  note: string,
) {
  const { data, error } = await supabase.rpc("review_creator_application", {
    application_id: applicationId,
    approve,
    note,
  });

  if (error) throw error;
  return data as { status: CreatorApplicationStatus; rewards_granted: boolean };
}

export async function grantPendingCreatorRewards(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("grant_pending_creator_rewards");
  if (error) throw error;
  return Number(data ?? 0);
}

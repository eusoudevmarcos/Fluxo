import type { SupabaseClient } from "@supabase/supabase-js";
import type { OfficialAccount } from "@ocean/shared";

export async function listOfficialAccounts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("official_accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as OfficialAccount[];
}

export async function applyDefaultOfficialFollowsForCurrentUser(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Ocean para seguir contas oficiais.");

  const { data, error } = await supabase.rpc("apply_default_official_follows", {
    new_user_id: userData.user.id,
  });

  if (error) throw error;

  return Number(data ?? 0);
}

export async function getFounderProfile(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("official_accounts")
    .select("*, profile:profiles(user_id,username,display_name,avatar_url,bio)")
    .eq("kind", "founder")
    .eq("is_founder", true)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function safelyApplyDefaultOfficialFollowsForCurrentUser(supabase: SupabaseClient) {
  try {
    return await applyDefaultOfficialFollowsForCurrentUser(supabase);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Auto-follow oficial não aplicado:", error);
    }
    return 0;
  }
}

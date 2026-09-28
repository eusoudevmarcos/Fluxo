import type { SupabaseClient } from "@supabase/supabase-js";

export type MembershipState = {
  is_member: boolean;
  role: "owner" | "moderator" | "member" | null;
};

export async function getMembershipState(
  supabase: SupabaseClient,
  communityId: string,
): Promise<MembershipState> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user) {
    return { is_member: false, role: null };
  }

  const { data, error } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", communityId)
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;

  return {
    is_member: Boolean(data),
    role: (data?.role as MembershipState["role"]) ?? null,
  };
}

export async function joinCommunity(
  supabase: SupabaseClient,
  communityId: string,
  role: MembershipState["role"] = "member",
) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user) {
    throw new Error("Entre na Fluxo para participar da comunidade.");
  }

  const { error } = await supabase.from("community_members").upsert(
    {
      community_id: communityId,
      user_id: userData.user.id,
      role: role ?? "member",
      status: "active",
    },
    { onConflict: "community_id,user_id" },
  );

  if (error) throw error;
}

export async function leaveCommunity(supabase: SupabaseClient, communityId: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user) {
    throw new Error("Entre na Fluxo para sair da comunidade.");
  }

  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", userData.user.id);

  if (error) throw error;
}

export async function getCommunityMemberCount(
  supabase: SupabaseClient,
  communityId: string,
) {
  const { count, error } = await supabase
    .from("community_members")
    .select("id", { count: "exact", head: true })
    .eq("community_id", communityId)
    .eq("status", "active");

  if (error) throw error;

  return count ?? 0;
}

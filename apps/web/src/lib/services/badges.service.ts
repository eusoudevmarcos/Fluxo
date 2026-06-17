import type { SupabaseClient } from "@supabase/supabase-js";

export type BadgeDefinition = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: "verification" | "gamification" | "engagement" | "founder";
  rarity: "common" | "special" | "rare" | "epic" | "legendary" | "milenar";
  color_primary: string | null;
  color_secondary: string | null;
  icon_type: string;
  visual_config: Record<string, unknown>;
  is_purchasable: boolean;
  is_active: boolean;
  unlock_type: string;
  unlock_conditions: Record<string, unknown>;
};

export type UserBadge = {
  id: string;
  user_id: string;
  badge_id: string;
  is_equipped: boolean;
  source: string;
  granted_reason: string | null;
  unlocked_at: string;
  equipped_at: string | null;
  badge?: BadgeDefinition | null;
};

export type PublicEquippedBadge = {
  user_id: string;
  badge_slug: string;
  badge_name: string;
  category: string;
  rarity: string;
  color_primary: string | null;
  color_secondary: string | null;
  visual_config: Record<string, unknown> | null;
};

export type VerificationEligibility = {
  user_id: string;
  fans_count: number;
  engagement_rate: number;
  eligible: boolean;
  reason: string;
};

export async function listBadgeDefinitions(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("badge_definitions")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as BadgeDefinition[];
}

export async function getMyBadges(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_badges")
    .select("*, badge:badge_definitions(*)")
    .eq("user_id", userData.user.id)
    .order("unlocked_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as UserBadge[];
}

export async function getEquippedBadge(
  supabase: SupabaseClient,
  userId: string,
): Promise<PublicEquippedBadge | null> {
  const badges = await getEquippedBadgesByUserIds(supabase, [userId]);
  return badges.get(userId) ?? null;
}

export async function getEquippedBadgesByUserIds(
  supabase: SupabaseClient,
  userIds: string[],
) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  if (!uniqueUserIds.length) {
    return new Map<string, PublicEquippedBadge>();
  }

  const { data, error } = await supabase
    .from("public_equipped_badges")
    .select("user_id,badge_slug,badge_name,category,rarity,color_primary,color_secondary,visual_config")
    .in("user_id", uniqueUserIds);

  if (error) {
    return new Map<string, PublicEquippedBadge>();
  }

  return new Map(
    ((data ?? []) as PublicEquippedBadge[]).map((badge) => [badge.user_id, badge]),
  );
}

export async function equipBadge(supabase: SupabaseClient, slug: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("Entre na Wave para equipar um selo.");
  }

  const { data, error } = await supabase.rpc("equip_user_badge", {
    target_user_id: userData.user.id,
    badge_slug: slug,
  });

  if (error) {
    throw error;
  }

  return data as UserBadge;
}

export async function getVerificationEligibility(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_verification_eligibility")
    .select("user_id,fans_count,engagement_rate,eligible,reason")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as VerificationEligibility | null;
}

export async function grantBadgeForFounderIfAllowed(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("Entre na Wave para validar seu perfil.");
  }

  const { data, error } = await supabase.rpc("apply_founder_badge", {
    target_user_id: userData.user.id,
  });

  if (error) {
    throw error;
  }

  return data as UserBadge;
}

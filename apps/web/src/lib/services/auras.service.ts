import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuraDefinition, UserAura } from "@ocean/shared";

export type PublicEquippedAura = {
  user_id: string;
  aura_slug: string | null;
  aura_name: string | null;
  rarity: string | null;
  visual_config: Record<string, unknown> | null;
  color_primary: string | null;
  color_secondary: string | null;
};

export async function listAuraDefinitions(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("aura_definitions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as AuraDefinition[];
}

export async function getMyAuras(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Wave para ver suas Auras.");

  const { data, error } = await supabase
    .from("user_auras")
    .select("*, aura:aura_definitions(*)")
    .eq("user_id", userData.user.id)
    .order("unlocked_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as UserAura[];
}

export async function getEquippedAura(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("public_equipped_auras")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data as PublicEquippedAura | null;
}

export async function getEquippedAurasByUserIds(
  supabase: SupabaseClient,
  userIds: string[],
) {
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean);

  if (!uniqueUserIds.length) {
    return new Map<string, PublicEquippedAura>();
  }

  const { data, error } = await supabase
    .from("public_equipped_auras")
    .select("*")
    .in("user_id", uniqueUserIds);

  if (error) {
    if (error.code === "42P01") {
      return new Map<string, PublicEquippedAura>();
    }

    throw error;
  }

  return new Map(
    ((data ?? []) as PublicEquippedAura[]).map((aura) => [aura.user_id, aura]),
  );
}

export async function equipAura(supabase: SupabaseClient, auraSlug: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Wave para equipar uma Aura.");

  const { data, error } = await supabase.rpc("equip_user_aura", {
    target_user_id: userData.user.id,
    aura_slug: auraSlug,
  });

  if (error) throw error;

  return data as UserAura;
}

export async function grantAuraForMission() {
  throw new Error("Grants de Aura por missão ficam no backend/admin na próxima rodada.");
}

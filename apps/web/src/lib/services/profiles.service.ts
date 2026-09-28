import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ensureProfileWithClient,
  getProfileByUserId,
  normalizeUsername,
  updateProfile,
  updateProfileOnboarding,
  updateProfileRequiredInfo,
  type OceanProfile,
  type ProfileUpdateInput,
  type ProfileRequiredOnboardingInput,
} from "@/lib/profiles/ensure-profile";

const PUBLIC_PROFILE_SUMMARY_COLUMNS =
  "id,user_id,username,display_name,avatar_url,bio,theme,aura,created_at,updated_at,onboarding_completed,profile_required_completed,spotify_connected,spotify_label,interests,date_intent,vibe,location_label,looking_for,state,city,country";

export type PublicProfileSummary = OceanProfile & {
  is_following: boolean;
  can_follow: boolean;
  // Presente so nas sugestoes (get_follow_suggestions, migration 053).
  suggestion_reason?: "nearby" | "mutual" | "trending" | "same_city" | "new" | "suggested";
  suggestion_detail?: string;
};

type SuggestionRow = Partial<OceanProfile> & {
  reason: PublicProfileSummary["suggestion_reason"];
  reason_detail: string;
};

export type NearbySettings = {
  nearby_visible: boolean;
  is_adult: boolean;
  has_location: boolean;
};

function isMissingFunction(error: { code?: string } | null) {
  return error?.code === "42883" || error?.code === "PGRST202";
}

export type RelationshipStats = {
  fans: number;
  seletos: number;
};

export type RelationshipState = {
  isFollowing: boolean;
  canFollow: boolean;
};

function normalizePublicProfile(profile: Partial<OceanProfile>): OceanProfile {
  return {
    location_lat: null,
    location_lng: null,
    location_accuracy_meters: null,
    geolocation_permission: null,
    geolocation_consent_at: null,
    geolocation_denied_at: null,
    biological_sex: null,
    birth_date: null,
    age_band: "unknown",
    ...profile,
  } as OceanProfile;
}

function cleanSearchTerm(value: string) {
  return value
    .trim()
    .replace(/^[@~]/, "")
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 64);
}

async function getCurrentUserId(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user?.id ?? null;
}

async function requireCurrentUserId(supabase: SupabaseClient) {
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    throw new Error("Entre na Fluxo para seguir pessoas.");
  }

  return userId;
}

async function withRelationshipState(
  supabase: SupabaseClient,
  profiles: OceanProfile[],
): Promise<PublicProfileSummary[]> {
  const currentUserId = await getCurrentUserId(supabase);
  const targetIds = profiles.map((profile) => profile.user_id).filter(Boolean);

  if (!currentUserId || !targetIds.length) {
    return profiles.map((profile) => ({
      ...profile,
      is_following: false,
      can_follow: Boolean(currentUserId && currentUserId !== profile.user_id),
    }));
  }

  const { data, error } = await supabase
    .from("user_relationships")
    .select("following_id")
    .eq("follower_id", currentUserId)
    .in("following_id", targetIds);

  if (error) {
    throw error;
  }

  const followingIds = new Set(
    ((data ?? []) as { following_id: string }[]).map((relationship) => relationship.following_id),
  );

  return profiles.map((profile) => ({
    ...profile,
    is_following: followingIds.has(profile.user_id),
    can_follow: currentUserId !== profile.user_id,
  }));
}

export async function ensureProfile(supabase: SupabaseClient) {
  return ensureProfileWithClient(supabase);
}

export async function getCurrentProfile(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    return null;
  }

  return getProfileByUserId(supabase, data.user.id);
}

export async function getProfileByUsername(
  supabase: SupabaseClient,
  username: string,
): Promise<OceanProfile | null> {
  const normalizedUsername = normalizeUsername(username);

  // Sem "*": colunas sensiveis de profiles nao sao legiveis pelo client (migration 047).
  const { data, error } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_SUMMARY_COLUMNS)
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizePublicProfile(data as Partial<OceanProfile>) : null;
}

export async function getPublicProfileByUsername(
  supabase: SupabaseClient,
  username: string,
): Promise<OceanProfile | null> {
  const normalizedUsername = normalizeUsername(username);

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,user_id,username,display_name,avatar_url,bio,theme,aura,created_at,updated_at,onboarding_completed,profile_required_completed,spotify_connected,spotify_label,interests,date_intent,vibe,location_label,looking_for,state,city,country",
    )
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? normalizePublicProfile(data as Partial<OceanProfile>)
    : null;
}

// Sugestoes ordenadas no servidor: amigos em comum, alcance ganho com missoes, pessoas
// proximas, mesma cidade (migration 053). Sem a 053 aplicada, cai nos perfis mais recentes.
export async function listPeopleSuggestions(
  supabase: SupabaseClient,
  limit = 4,
): Promise<PublicProfileSummary[]> {
  const { data: suggestionRows, error: suggestionError } = await supabase.rpc(
    "get_follow_suggestions",
    { max_results: limit },
  );

  if (!suggestionError) {
    const rows = (suggestionRows ?? []) as SuggestionRow[];
    const withState = await withRelationshipState(
      supabase,
      rows.map(({ reason, reason_detail, ...profile }) => {
        void reason;
        void reason_detail;
        return normalizePublicProfile(profile);
      }),
    );

    return withState.map((profile, index) => ({
      ...profile,
      suggestion_reason: rows[index]?.reason,
      suggestion_detail: rows[index]?.reason_detail,
    }));
  }

  if (!isMissingFunction(suggestionError)) throw suggestionError;

  const currentUserId = await getCurrentUserId(supabase);
  let query = supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_SUMMARY_COLUMNS)
    .eq("profile_required_completed", true)
    .not("username", "is", null)
    .not("display_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (currentUserId) {
    query = query.neq("user_id", currentUserId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return withRelationshipState(
    supabase,
    ((data ?? []) as Partial<OceanProfile>[]).map(normalizePublicProfile),
  );
}

export async function searchProfiles(
  supabase: SupabaseClient,
  query: string,
  limit = 8,
): Promise<PublicProfileSummary[]> {
  const searchTerm = cleanSearchTerm(query);

  if (searchTerm.length < 2) {
    return listPeopleSuggestions(supabase, limit);
  }

  // Busca no servidor com protecao de menores (migration 054). Sem ela, cai na busca direta.
  const { data: searchRows, error: searchError } = await supabase.rpc("search_profiles", {
    search_term: searchTerm,
    max_results: limit,
  });

  if (!searchError) {
    return withRelationshipState(
      supabase,
      ((searchRows ?? []) as Partial<OceanProfile>[]).map(normalizePublicProfile),
    );
  }

  if (!isMissingFunction(searchError)) throw searchError;

  const currentUserId = await getCurrentUserId(supabase);
  const usernameTerm = normalizeUsername(searchTerm);
  const ilikeTerm = `%${searchTerm}%`;
  const usernameIlikeTerm = `%${usernameTerm}%`;

  let profileQuery = supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_SUMMARY_COLUMNS)
    .eq("profile_required_completed", true)
    .not("username", "is", null)
    .not("display_name", "is", null)
    .or(`display_name.ilike.${ilikeTerm},username.ilike.${usernameIlikeTerm}`)
    .order("display_name", { ascending: true })
    .limit(limit);

  if (currentUserId) {
    profileQuery = profileQuery.neq("user_id", currentUserId);
  }

  const { data, error } = await profileQuery;

  if (error) {
    throw error;
  }

  return withRelationshipState(
    supabase,
    ((data ?? []) as Partial<OceanProfile>[]).map(normalizePublicProfile),
  );
}

export async function getRelationshipState(
  supabase: SupabaseClient,
  targetUserId: string,
): Promise<RelationshipState> {
  const currentUserId = await getCurrentUserId(supabase);

  if (!currentUserId || currentUserId === targetUserId) {
    return { isFollowing: false, canFollow: false };
  }

  const { data, error } = await supabase
    .from("user_relationships")
    .select("id")
    .eq("follower_id", currentUserId)
    .eq("following_id", targetUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return { isFollowing: Boolean(data), canFollow: true };
}

export async function getRelationshipStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<RelationshipStats> {
  const [fansResult, seletosResult] = await Promise.all([
    supabase
      .from("user_relationships")
      .select("id", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase
      .from("user_relationships")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

  if (fansResult.error) {
    throw fansResult.error;
  }

  if (seletosResult.error) {
    throw seletosResult.error;
  }

  return {
    fans: fansResult.count ?? 0,
    seletos: seletosResult.count ?? 0,
  };
}

export async function followProfile(supabase: SupabaseClient, targetUserId: string) {
  const currentUserId = await requireCurrentUserId(supabase);

  if (currentUserId === targetUserId) {
    throw new Error("Você não pode seguir o próprio perfil.");
  }

  const { error } = await supabase.from("user_relationships").upsert(
    {
      follower_id: currentUserId,
      following_id: targetUserId,
      source: "manual",
    },
    {
      onConflict: "follower_id,following_id",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    throw error;
  }
}

export async function unfollowProfile(supabase: SupabaseClient, targetUserId: string) {
  const currentUserId = await requireCurrentUserId(supabase);

  const { error } = await supabase
    .from("user_relationships")
    .delete()
    .eq("follower_id", currentUserId)
    .eq("following_id", targetUserId);

  if (error) {
    throw error;
  }
}

export async function toggleFollowProfile(
  supabase: SupabaseClient,
  targetUserId: string,
  isFollowing: boolean,
) {
  if (isFollowing) {
    await unfollowProfile(supabase, targetUserId);
    return false;
  }

  await followProfile(supabase, targetUserId);
  return true;
}

export async function getMyNearbySettings(supabase: SupabaseClient): Promise<NearbySettings | null> {
  const { data, error } = await supabase.rpc("get_my_private_profile");

  if (error) {
    if (isMissingFunction(error)) return null;
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { nearby_visible?: boolean; age_band?: string; location_lat?: number | null }
    | undefined;
  if (!row || row.nearby_visible === undefined) return null;

  return {
    nearby_visible: Boolean(row.nearby_visible),
    is_adult: row.age_band === "adult",
    has_location: row.location_lat !== null && row.location_lat !== undefined,
  };
}

// O servidor ignora atualizacoes com menos de 10 minutos de intervalo.
export async function updateMyLocation(
  supabase: SupabaseClient,
  coords: { latitude: number; longitude: number; accuracy?: number | null },
) {
  const { error } = await supabase.rpc("update_my_location", {
    input_lat: coords.latitude,
    input_lng: coords.longitude,
    input_accuracy_meters: coords.accuracy ? Math.round(coords.accuracy) : null,
  });
  if (error) throw error;
}

export async function setNearbyVisibility(supabase: SupabaseClient, enabled: boolean) {
  const { error } = await supabase.rpc("set_nearby_visibility", { enabled });
  if (error) throw error;
}

export async function saveProfile(input: ProfileUpdateInput) {
  return updateProfile(input);
}

export async function saveProfileOnboarding(input: ProfileRequiredOnboardingInput) {
  return updateProfileOnboarding(input);
}

export async function saveProfileRequiredInfo(input: ProfileRequiredOnboardingInput) {
  return updateProfileRequiredInfo(input);
}

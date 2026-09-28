import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { getVerifiedSealsByUserIds, type VerifiedSeal } from "./seals.service";

export type GeolocationPermission = "unknown" | "granted" | "denied" | "unavailable";
export type BiologicalSex = "male" | "female" | "intersex" | "prefer_not_to_say";

export type Profile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  theme: string | null;
  aura: string | null;
  location_label: string | null;
  vibe: string | null;
  interests: string[] | null;
  onboarding_completed: boolean | null;
  profile_required_completed: boolean | null;
  state: string | null;
  city: string | null;
  country: string | null;
  geolocation_permission: GeolocationPermission | null;
};

export type AgeBand = "adult" | "teen_16" | "teen_14" | "blocked" | "unknown";

export type ProfileRequiredOnboardingInput = {
  display_name: string;
  username: string;
  avatar_url: string;
  bio: string;
  state: string;
  city: string;
  country: string;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy_meters: number | null;
  geolocation_permission: GeolocationPermission;
  geolocation_consent_at: string | null;
  geolocation_denied_at: string | null;
  biological_sex: BiologicalSex;
};

export type PublicProfile = Profile & {
  is_following: boolean;
  can_follow: boolean;
  verified_seal: VerifiedSeal | null;
  // Presente so nas sugestoes (get_follow_suggestions, migration 053).
  suggestion_detail?: string;
};

export type NearbySettings = {
  nearby_visible: boolean;
  is_adult: boolean;
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

// Sem colunas sensiveis (coordenadas, biological_sex): nao sao legiveis via select em profiles
// (migration 047).
const PROFILE_COLUMNS =
  "user_id,username,display_name,avatar_url,bio,theme,aura,location_label,vibe,interests,onboarding_completed,profile_required_completed,state,city,country,geolocation_permission";

function normalizeUsername(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/^@|^~/, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/[._]{2,}/g, ".")
    .replace(/^[._]+|[._]+$/g, "");

  return normalized || "fluxo";
}

function getEmailBase(email?: string | null) {
  return normalizeUsername(email?.split("@")[0] ?? "fluxo");
}

export function getProfileName(profile: Profile | null, session: Session) {
  return profile?.display_name || profile?.username || session.user.email || "Fluxo";
}

async function getCurrentUserId(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

async function withRelationshipState(
  supabase: SupabaseClient,
  profiles: Profile[],
): Promise<PublicProfile[]> {
  const currentUserId = await getCurrentUserId(supabase);
  const targetIds = profiles.map((profile) => profile.user_id).filter(Boolean);
  const verifiedSeals = await getVerifiedSealsByUserIds(supabase, targetIds);

  if (!currentUserId || !targetIds.length) {
    return profiles.map((profile) => ({
      ...profile,
      is_following: false,
      can_follow: Boolean(currentUserId && currentUserId !== profile.user_id),
      verified_seal: verifiedSeals.get(profile.user_id) ?? null,
    }));
  }

  const { data, error } = await supabase
    .from("user_relationships")
    .select("following_id")
    .eq("follower_id", currentUserId)
    .in("following_id", targetIds);

  if (error) throw error;

  const followingIds = new Set(
    ((data ?? []) as { following_id: string }[]).map((row) => row.following_id),
  );

  return profiles.map((profile) => ({
    ...profile,
    is_following: followingIds.has(profile.user_id),
    can_follow: currentUserId !== profile.user_id,
    verified_seal: verifiedSeals.get(profile.user_id) ?? null,
  }));
}

export async function ensureMobileProfile(supabase: SupabaseClient, session: Session) {
  const userId = session.user.id;

  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (existingProfile) return existingProfile as Profile;

  const username = getEmailBase(session.user.email);
  const payload = {
    user_id: userId,
    username,
    display_name: username,
    avatar_url: null,
    bio: "",
    theme: "sunflow",
    aura: "starter",
    country: "BR",
    updated_at: new Date().toISOString(),
  };

  const { data: createdProfile, error: createError } = await supabase
    .from("profiles")
    .insert(payload)
    .select(PROFILE_COLUMNS)
    .single();

  if (!createError) return createdProfile as Profile;
  if (createError.code !== "23505") throw createError;

  const retryPayload = {
    ...payload,
    username: `${username}.${Date.now().toString(36).slice(-5)}`,
  };
  const { data: retryProfile, error: retryError } = await supabase
    .from("profiles")
    .insert(retryPayload)
    .select(PROFILE_COLUMNS)
    .single();

  if (retryError) throw retryError;
  return retryProfile as Profile;
}

export async function getProfileByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data as Profile | null;
}

export async function searchProfiles(
  supabase: SupabaseClient,
  query: string,
  limit = 20,
): Promise<PublicProfile[]> {
  const currentUserId = await getCurrentUserId(supabase);
  const searchTerm = query.trim().replace(/[%_,()]/g, " ").replace(/\s+/g, " ").slice(0, 64);

  // Sem busca digitada: sugestoes ordenadas no servidor (amigos em comum, alcance por missoes,
  // pessoas proximas). Sem a migration 053, cai nos perfis recentes abaixo.
  if (searchTerm.length < 2) {
    const suggestions = await listFollowSuggestions(supabase, limit);
    if (suggestions) return suggestions;
  } else {
    // Busca no servidor com protecao de menores (migration 054). Sem ela, cai na busca direta.
    const { data, error } = await supabase.rpc("search_profiles", {
      search_term: searchTerm,
      max_results: limit,
    });

    if (!error) return withRelationshipState(supabase, (data ?? []) as Profile[]);
    if (!isMissingFunction(error)) throw error;
  }

  let profileQuery = supabase.from("profiles").select(PROFILE_COLUMNS).limit(limit);

  if (searchTerm.length >= 2) {
    const usernameTerm = normalizeUsername(searchTerm);
    profileQuery = profileQuery
      .or(`display_name.ilike.%${searchTerm}%,username.ilike.%${usernameTerm}%`)
      .order("display_name", { ascending: true });
  } else {
    profileQuery = profileQuery
      .not("username", "is", null)
      .order("updated_at", { ascending: false });
  }

  if (currentUserId) {
    profileQuery = profileQuery.neq("user_id", currentUserId);
  }

  const { data, error } = await profileQuery;
  if (error) throw error;

  return withRelationshipState(supabase, (data ?? []) as Profile[]);
}

async function listFollowSuggestions(
  supabase: SupabaseClient,
  limit: number,
): Promise<PublicProfile[] | null> {
  const { data, error } = await supabase.rpc("get_follow_suggestions", { max_results: limit });

  if (error) {
    if (isMissingFunction(error)) return null;
    throw error;
  }

  const rows = (data ?? []) as (Profile & { reason_detail: string })[];
  const profiles = await withRelationshipState(
    supabase,
    rows.map(({ reason_detail, ...profile }) => {
      void reason_detail;
      return profile as Profile;
    }),
  );

  return profiles.map((profile, index) => ({
    ...profile,
    suggestion_detail: rows[index]?.reason_detail,
  }));
}

export async function getMyNearbySettings(supabase: SupabaseClient): Promise<NearbySettings | null> {
  const { data, error } = await supabase.rpc("get_my_private_profile");

  if (error) {
    if (isMissingFunction(error)) return null;
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { nearby_visible?: boolean; age_band?: AgeBand }
    | undefined;
  if (!row || row.nearby_visible === undefined) return null;

  return { nearby_visible: Boolean(row.nearby_visible), is_adult: row.age_band === "adult" };
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

  if (fansResult.error) throw fansResult.error;
  if (seletosResult.error) throw seletosResult.error;

  return {
    fans: fansResult.count ?? 0,
    seletos: seletosResult.count ?? 0,
  };
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

  if (error) throw error;

  return { isFollowing: Boolean(data), canFollow: true };
}

async function requireCurrentUserId(supabase: SupabaseClient) {
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Entre na Fluxo para seguir pessoas.");
  return userId;
}

export async function followProfile(supabase: SupabaseClient, targetUserId: string) {
  const currentUserId = await requireCurrentUserId(supabase);
  if (currentUserId === targetUserId) throw new Error("Você não pode seguir o próprio perfil.");

  const { error } = await supabase.from("user_relationships").upsert(
    { follower_id: currentUserId, following_id: targetUserId, source: "manual" },
    { onConflict: "follower_id,following_id", ignoreDuplicates: true },
  );

  if (error) throw error;
}

export async function unfollowProfile(supabase: SupabaseClient, targetUserId: string) {
  const currentUserId = await requireCurrentUserId(supabase);

  const { error } = await supabase
    .from("user_relationships")
    .delete()
    .eq("follower_id", currentUserId)
    .eq("following_id", targetUserId);

  if (error) throw error;
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

export async function usernameExists(
  supabase: SupabaseClient,
  username: string,
  currentUserId?: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (error) throw error;

  return Boolean(data && data.user_id !== currentUserId);
}

export async function isUsernameAvailable(
  supabase: SupabaseClient,
  username: string,
  currentUserId?: string,
) {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3) return false;
  return !(await usernameExists(supabase, normalized, currentUserId));
}

export async function getMyAgeBand(supabase: SupabaseClient): Promise<AgeBand> {
  const { data, error } = await supabase.rpc("get_my_private_profile");

  if (error) {
    // Migration 047 ainda nao aplicada.
    if (error.code === "42883" || error.code === "PGRST202") return "unknown";
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as { age_band?: AgeBand } | undefined;
  return row?.age_band ?? "unknown";
}

// Declarada uma unica vez. Retorna "blocked" para menores de 14 (a conta fica bloqueada).
export async function setMyBirthDate(supabase: SupabaseClient, birthDate: string): Promise<AgeBand> {
  const { data, error } = await supabase.rpc("set_my_birth_date", {
    input_birth_date: birthDate,
  });

  if (error) throw error;

  return data as AgeBand;
}

export async function updateProfileRequiredInfo(
  supabase: SupabaseClient,
  input: ProfileRequiredOnboardingInput,
): Promise<Profile> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Usuário não autenticado.");

  const username = normalizeUsername(input.username);
  const displayName = input.display_name.trim();
  const state = input.state.trim();
  const city = input.city.trim();

  if (!displayName) throw new Error("Informe o nome que vai aparecer no perfil.");
  if (username.length < 3) throw new Error("Seu Flow ID precisa ter pelo menos 3 caracteres.");
  if (!state || !city) throw new Error("Informe sua cidade e estado para continuar.");
  if (!input.biological_sex) throw new Error("Selecione uma opção para continuar.");
  if (input.geolocation_permission === "unknown") {
    throw new Error("Avance pela etapa de localização para continuar.");
  }

  if (await usernameExists(supabase, username, userData.user.id)) {
    throw new Error("Esse Flow ID já está em uso.");
  }

  const locationLabel = `${city}, ${state}`;
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      username,
      avatar_url: input.avatar_url.trim() || null,
      bio: input.bio.trim(),
      state,
      city,
      country: input.country || "BR",
      location_label: locationLabel,
      location_lat: input.location_lat,
      location_lng: input.location_lng,
      location_accuracy_meters: input.location_accuracy_meters,
      geolocation_permission: input.geolocation_permission,
      geolocation_consent_at: input.geolocation_consent_at,
      geolocation_denied_at: input.geolocation_denied_at,
      biological_sex: input.biological_sex,
      onboarding_completed: true,
      profile_required_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userData.user.id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Esse Flow ID já está em uso.");
    throw error;
  }

  return data as Profile;
}

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { defaultTheme, type ThemeId } from "@/lib/themes";

export type GeolocationPermission = "unknown" | "granted" | "denied" | "unavailable";
export type BiologicalSex = "male" | "female" | "intersex" | "prefer_not_to_say";

export type OceanProfile = {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  theme: ThemeId | null;
  aura: string | null;
  created_at: string | null;
  updated_at: string | null;
  onboarding_completed: boolean | null;
  spotify_connected: boolean | null;
  spotify_label: string | null;
  interests: string[] | null;
  date_intent: string | null;
  vibe: string | null;
  location_label: string | null;
  looking_for: string | null;
  state: string | null;
  city: string | null;
  country: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy_meters: number | null;
  geolocation_permission: GeolocationPermission | null;
  geolocation_consent_at: string | null;
  geolocation_denied_at: string | null;
  biological_sex: BiologicalSex | null;
  profile_required_completed: boolean | null;
};

export type ProfileUpdateInput = {
  display_name: string;
  username: string;
  avatar_url: string;
  bio: string;
  theme: ThemeId;
  aura: string;
};

const BASE_PROFILE_COLUMNS =
  "id,user_id,username,display_name,avatar_url,bio,theme,aura,created_at,updated_at";
const REQUIRED_PROFILE_COLUMNS =
  "state,city,country,location_lat,location_lng,location_accuracy_meters,geolocation_permission,geolocation_consent_at,geolocation_denied_at,biological_sex,profile_required_completed";
const ONBOARDING_PROFILE_COLUMNS =
  `onboarding_completed,spotify_connected,spotify_label,interests,date_intent,vibe,location_label,looking_for,${REQUIRED_PROFILE_COLUMNS}`;
const PROFILE_COLUMNS = `${BASE_PROFILE_COLUMNS},${ONBOARDING_PROFILE_COLUMNS}`;

function readMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}

export function normalizeUsername(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^@|^~/, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/[._]{2,}/g, ".")
    .replace(/^[._]+|[._]+$/g, "");

  return normalized || "ocean";
}

function getEmailBase(email?: string | null) {
  return normalizeUsername(email?.split("@")[0] ?? "ocean");
}

function getShortSuffix() {
  return Math.random().toString(36).slice(2, 7);
}

function isMissingExtendedProfileColumn(error: unknown) {
  const message = getErrorMessage(error, "");
  return [
    "onboarding_completed",
    "spotify_connected",
    "interests",
    "date_intent",
    "location_label",
    "profile_required_completed",
    "geolocation_permission",
    "biological_sex",
    "location_lat",
  ].some((column) => message.includes(column));
}

export async function usernameExists(
  supabase: SupabaseClient,
  username: string,
  currentUserId?: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,user_id")
    .eq("username", username)
    .maybeSingle();

  if (error) throw error;

  return Boolean(data && data.user_id !== currentUserId);
}

async function getAvailableUsername(supabase: SupabaseClient, baseUsername: string) {
  const normalizedBase = normalizeUsername(baseUsername);

  if (!(await usernameExists(supabase, normalizedBase))) return normalizedBase;

  for (let index = 0; index < 5; index += 1) {
    const nextUsername = `${normalizedBase}.${getShortSuffix()}`;
    if (!(await usernameExists(supabase, nextUsername))) return nextUsername;
  }

  return `${normalizedBase}.${Date.now().toString(36).slice(-5)}`;
}

function getProfilePayload(user: User, username: string) {
  const metadata = user.user_metadata as Record<string, unknown>;
  const emailBase = getEmailBase(user.email);
  const displayName =
    readMetadataString(metadata, "full_name") ??
    readMetadataString(metadata, "name") ??
    readMetadataString(metadata, "display_name") ??
    emailBase;
  const avatarUrl =
    readMetadataString(metadata, "avatar_url") ??
    readMetadataString(metadata, "picture");

  return {
    user_id: user.id,
    username,
    display_name: displayName,
    avatar_url: avatarUrl,
    bio: "",
    theme: defaultTheme,
    aura: "starter",
    updated_at: new Date().toISOString(),
    onboarding_completed: false,
    spotify_connected: false,
    spotify_label: null,
    interests: [],
    date_intent: null,
    vibe: null,
    location_label: null,
    looking_for: null,
    state: null,
    city: null,
    country: "BR",
    location_lat: null,
    location_lng: null,
    location_accuracy_meters: null,
    geolocation_permission: "unknown" as GeolocationPermission,
    geolocation_consent_at: null,
    geolocation_denied_at: null,
    biological_sex: null,
    profile_required_completed: false,
  };
}

function withOnboardingDefaults(profile: Partial<OceanProfile>) {
  return {
    onboarding_completed: false,
    spotify_connected: false,
    spotify_label: null,
    interests: [],
    date_intent: null,
    vibe: null,
    location_label: null,
    looking_for: null,
    state: null,
    city: null,
    country: "BR",
    location_lat: null,
    location_lng: null,
    location_accuracy_meters: null,
    geolocation_permission: "unknown",
    geolocation_consent_at: null,
    geolocation_denied_at: null,
    biological_sex: null,
    profile_required_completed: false,
    ...profile,
  } as OceanProfile;
}

async function selectProfileByUserId(supabase: SupabaseClient, userId: string) {
  const extended = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (!extended.error) return extended;
  if (!isMissingExtendedProfileColumn(extended.error)) return extended;

  const base = await supabase
    .from("profiles")
    .select(BASE_PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    ...base,
    data: base.data ? withOnboardingDefaults(base.data as Partial<OceanProfile>) : null,
  };
}

export async function ensureProfileWithClient(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!userData.user) throw new Error("Usuário não autenticado.");

  const user = userData.user;
  const { data: existingProfile, error: profileError } = await selectProfileByUserId(
    supabase,
    user.id,
  );

  if (profileError) throw profileError;
  if (existingProfile) return withOnboardingDefaults(existingProfile as Partial<OceanProfile>);

  const username = await getAvailableUsername(supabase, getEmailBase(user.email));
  const payload = getProfilePayload(user, username);
  const created = await supabase
    .from("profiles")
    .insert(payload)
    .select(PROFILE_COLUMNS)
    .single();

  if (!created.error) return withOnboardingDefaults(created.data as Partial<OceanProfile>);
  if (!isMissingExtendedProfileColumn(created.error)) throw created.error;

  const {
    onboarding_completed,
    spotify_connected,
    spotify_label,
    interests,
    date_intent,
    vibe,
    location_label,
    looking_for,
    state,
    city,
    country,
    location_lat,
    location_lng,
    location_accuracy_meters,
    geolocation_permission,
    geolocation_consent_at,
    geolocation_denied_at,
    biological_sex,
    profile_required_completed,
    ...basePayload
  } = payload;
  void onboarding_completed;
  void spotify_connected;
  void spotify_label;
  void interests;
  void date_intent;
  void vibe;
  void location_label;
  void looking_for;
  void state;
  void city;
  void country;
  void location_lat;
  void location_lng;
  void location_accuracy_meters;
  void geolocation_permission;
  void geolocation_consent_at;
  void geolocation_denied_at;
  void biological_sex;
  void profile_required_completed;

  const { data: baseCreatedProfile, error: baseCreateError } = await supabase
    .from("profiles")
    .insert(basePayload)
    .select(BASE_PROFILE_COLUMNS)
    .single();

  if (baseCreateError) throw baseCreateError;

  return withOnboardingDefaults(baseCreatedProfile as Partial<OceanProfile>);
}

export async function ensureProfile() {
  return ensureProfileWithClient(createClient());
}

export async function getProfileByUserId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await selectProfileByUserId(supabase, userId);
  if (error) throw error;
  return data ? withOnboardingDefaults(data as Partial<OceanProfile>) : null;
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

export async function updateProfile(input: ProfileUpdateInput) {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!userData.user) throw new Error("Usuário não autenticado.");

  const username = normalizeUsername(input.username);
  const displayName = input.display_name.trim();

  if (!displayName) throw new Error("Informe o nome que vai aparecer no perfil.");
  if (!username) throw new Error("Escolha um username.");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      username,
      avatar_url: input.avatar_url.trim() || null,
      bio: input.bio.trim(),
      theme: input.theme,
      aura: input.aura.trim() || "starter",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userData.user.id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Esse username já está em uso.");
    throw error;
  }

  try {
    await supabase.rpc("apply_default_official_follows", {
      new_user_id: userData.user.id,
    });
  } catch (officialFollowError) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Auto-follow oficial não aplicado:", officialFollowError);
    }
  }

  return withOnboardingDefaults(data as Partial<OceanProfile>);
}

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

export async function updateProfileRequiredInfo(input: ProfileRequiredOnboardingInput) {
  const supabase = createClient();
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

  return withOnboardingDefaults(data as Partial<OceanProfile>);
}

export type ProfileOnboardingInput = ProfileRequiredOnboardingInput;

export async function updateProfileOnboarding(input: ProfileRequiredOnboardingInput) {
  return updateProfileRequiredInfo(input);
}

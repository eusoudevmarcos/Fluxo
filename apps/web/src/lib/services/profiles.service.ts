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

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as OceanProfile | null;
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
    ? ({
        location_lat: null,
        location_lng: null,
        location_accuracy_meters: null,
        geolocation_permission: null,
        geolocation_consent_at: null,
        geolocation_denied_at: null,
        biological_sex: null,
        ...data,
      } as OceanProfile)
    : null;
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

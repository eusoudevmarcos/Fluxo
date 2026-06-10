import type { Profile } from "@ocean/shared";
import type { SupabaseClientLike, SupabaseUserLike } from "./types";

export async function getProfileByUserId(
  supabase: SupabaseClientLike,
  userId: string,
): Promise<Profile | null> {
  void supabase;
  void userId;
  throw new Error("getProfileByUserId will be wired after the shared data layer is adopted.");
}

export async function createProfileForUser(
  supabase: SupabaseClientLike,
  user: SupabaseUserLike,
): Promise<Profile> {
  void supabase;
  void user;
  throw new Error("createProfileForUser will be wired after profile creation is moved from the web app.");
}

export async function ensureProfile(supabase: SupabaseClientLike): Promise<Profile> {
  void supabase;
  throw new Error("ensureProfile is prepared here, but the active web implementation remains in apps/web for now.");
}
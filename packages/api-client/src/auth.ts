import type { SupabaseClientLike } from "./types";

export async function getCurrentUser(supabase: SupabaseClientLike) {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user;
}

export async function signOut(supabase: SupabaseClientLike) {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
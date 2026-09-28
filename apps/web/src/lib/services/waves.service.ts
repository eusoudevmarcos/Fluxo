import type { SupabaseClient } from "@supabase/supabase-js";

export type WaveState = {
  count: number;
  has_waved: boolean;
};

export async function getWaveCount(supabase: SupabaseClient, contentId: string) {
  const { count, error } = await supabase
    .from("waves")
    .select("id", { count: "exact", head: true })
    .eq("content_id", contentId);

  if (error) throw error;

  return count ?? 0;
}

export async function getWaveState(
  supabase: SupabaseClient,
  contentId: string,
): Promise<WaveState> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  const [count, existing] = await Promise.all([
    getWaveCount(supabase, contentId),
    userData.user
      ? supabase
          .from("waves")
          .select("id")
          .eq("content_id", contentId)
          .eq("user_id", userData.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (existing.error) throw existing.error;

  return { count, has_waved: Boolean(existing.data) };
}

export async function toggleWave(
  supabase: SupabaseClient,
  contentId: string,
): Promise<WaveState> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user) {
    throw new Error("Entre na Fluxo para fazer Wave.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("waves")
    .select("id")
    .eq("content_id", contentId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase
      .from("waves")
      .delete()
      .eq("content_id", contentId)
      .eq("user_id", userData.user.id);

    if (error) throw error;
  } else {
    const { error } = await supabase.from("waves").insert({
      content_id: contentId,
      user_id: userData.user.id,
    });

    if (error) throw error;
  }

  return getWaveState(supabase, contentId);
}

export async function listWavedContentsByUser(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("waves")
    .select("content_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

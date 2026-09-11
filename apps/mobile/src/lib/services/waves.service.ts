import type { SupabaseClient } from "@supabase/supabase-js";

type WaveState = {
  count: number;
  has_waved: boolean;
};

async function getWaveCount(supabase: SupabaseClient, contentId: string): Promise<number> {
  const { count, error } = await supabase
    .from("waves")
    .select("id", { count: "exact", head: true })
    .eq("content_id", contentId);

  if (error) throw error;

  return count ?? 0;
}

export async function toggleWave(supabase: SupabaseClient, contentId: string): Promise<WaveState> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Fluxo para fazer Wave.");

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

  const [count, existingAfter] = await Promise.all([
    getWaveCount(supabase, contentId),
    supabase
      .from("waves")
      .select("id")
      .eq("content_id", contentId)
      .eq("user_id", userData.user.id)
      .maybeSingle(),
  ]);

  return {
    count,
    has_waved: Boolean(existingAfter.data),
  };
}

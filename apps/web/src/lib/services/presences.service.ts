import type { SupabaseClient } from "@supabase/supabase-js";

export async function getPresenceCount(
  supabase: SupabaseClient,
  contentId: string,
) {
  const { count, error } = await supabase
    .from("presences")
    .select("id", { count: "exact", head: true })
    .eq("content_id", contentId);

  if (error) throw error;

  return count ?? 0;
}

export async function registerPresence(
  supabase: SupabaseClient,
  contentId: string,
) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return getPresenceCount(supabase, contentId);
  }

  const { error } = await supabase.from("presences").upsert(
    {
      content_id: contentId,
      user_id: userData.user.id,
    },
    {
      ignoreDuplicates: true,
      onConflict: "user_id,content_id",
    },
  );

  if (error) {
    throw error;
  }

  return getPresenceCount(supabase, contentId);
}

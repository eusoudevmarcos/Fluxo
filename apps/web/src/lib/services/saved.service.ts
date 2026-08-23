import type { SupabaseClient } from "@supabase/supabase-js";

export type SavedState = {
  is_saved: boolean;
};

export async function getSavedState(
  supabase: SupabaseClient,
  contentId: string,
): Promise<SavedState> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user) {
    return { is_saved: false };
  }

  const { data, error } = await supabase
    .from("saved_contents")
    .select("id")
    .eq("content_id", contentId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) throw error;

  return { is_saved: Boolean(data) };
}

export async function toggleSaved(
  supabase: SupabaseClient,
  contentId: string,
): Promise<SavedState> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user) {
    throw new Error("Entre na Fluxo para salvar.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("saved_contents")
    .select("id")
    .eq("content_id", contentId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase
      .from("saved_contents")
      .delete()
      .eq("content_id", contentId)
      .eq("user_id", userData.user.id);

    if (error) throw error;
  } else {
    const { error } = await supabase.from("saved_contents").insert({
      content_id: contentId,
      user_id: userData.user.id,
    });

    if (error) throw error;
  }

  return getSavedState(supabase, contentId);
}

export async function saveContent(
  supabase: SupabaseClient,
  contentId: string,
): Promise<SavedState> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user) {
    throw new Error("Entre na Fluxo para salvar.");
  }

  const { error } = await supabase.from("saved_contents").upsert(
    {
      content_id: contentId,
      user_id: userData.user.id,
    },
    { onConflict: "user_id,content_id" },
  );

  if (error) throw error;

  return { is_saved: true };
}

export async function listSavedContentsByCurrentUser(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data, error } = await supabase
    .from("saved_contents")
    .select("content_id,created_at")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

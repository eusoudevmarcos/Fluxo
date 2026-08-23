import type { SupabaseClient } from "@supabase/supabase-js";

type DahoraState = {
  count: number;
  has_dahora: boolean;
};

export async function getDahoraCount(
  supabase: SupabaseClient,
  contentId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("dahoras")
    .select("id", { count: "exact", head: true })
    .eq("content_id", contentId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getDahoraState(
  supabase: SupabaseClient,
  contentId: string,
): Promise<DahoraState> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const [count, existing] = await Promise.all([
    getDahoraCount(supabase, contentId),
    userData.user
      ? supabase
          .from("dahoras")
          .select("id")
          .eq("content_id", contentId)
          .eq("user_id", userData.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (existing.error) {
    throw existing.error;
  }

  return {
    count,
    has_dahora: Boolean(existing.data),
  };
}

export async function toggleDahora(
  supabase: SupabaseClient,
  contentId: string,
): Promise<DahoraState> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("Entre na Fluxo para marcar Dahora.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("dahoras")
    .select("id")
    .eq("content_id", contentId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const { error } = await supabase
      .from("dahoras")
      .delete()
      .eq("content_id", contentId)
      .eq("user_id", userData.user.id);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase.from("dahoras").insert({
      content_id: contentId,
      user_id: userData.user.id,
    });

    if (error) {
      throw error;
    }
  }

  return getDahoraState(supabase, contentId);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sticker, StickerPack } from "@ocean/shared";

export async function listStickerPacks(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("sticker_packs")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as StickerPack[];
}

export async function getMyStickerPacks(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Fluxo para ver seus stickers.");

  const { data, error } = await supabase
    .from("user_sticker_packs")
    .select("*, pack:sticker_packs(*)")
    .eq("user_id", userData.user.id)
    .order("unlocked_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getPackStickers(supabase: SupabaseClient, packSlug: string) {
  const { data: pack, error: packError } = await supabase
    .from("sticker_packs")
    .select("id")
    .eq("slug", packSlug)
    .eq("is_active", true)
    .single();

  if (packError) throw packError;

  const { data, error } = await supabase
    .from("stickers")
    .select("*")
    .eq("pack_id", pack.id)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []) as Sticker[];
}

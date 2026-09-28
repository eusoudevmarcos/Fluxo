import type { SupabaseClient } from "@supabase/supabase-js";

export type InviteStatus = {
  code: string;
  slots_total: number;
  slots_used: number;
  slots_available: number;
  pioneer_azul_target: number;
  pioneer_azul_active: boolean;
  pioneer_azul_remaining: number;
};

export type InvitedFriend = {
  invitee_id: string;
  connected: boolean;
  created_at: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export function normalizeInviteCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

// Sem EXPO_PUBLIC_WEB_URL configurado, compartilha so o codigo (o convidado digita no cadastro).
export function getInviteLink(code: string) {
  const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/+$/, "");
  return webUrl ? `${webUrl}/c/${code}` : null;
}

export function buildInviteShareMessage(code: string) {
  const link = getInviteLink(code);
  return link
    ? `Tô na Fluxo e separei um dos meus convites pra você. Entra por aqui que a gente já fica conectado: ${link}`
    : `Tô na Fluxo e separei um dos meus convites pra você. Baixa o app e usa meu código ${code} no cadastro que a gente já fica conectado.`;
}

export async function getMyInviteStatus(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("get_my_invite_status");
  if (error) throw error;
  return data as InviteStatus;
}

export async function redeemInvite(supabase: SupabaseClient, code: string) {
  const { data, error } = await supabase.rpc("redeem_invite", {
    invite_code: normalizeInviteCode(code),
  });
  if (error) throw error;
  return data as { inviter_username: string | null; connected: boolean };
}

export async function listMyInvitedFriends(supabase: SupabaseClient): Promise<InvitedFriend[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("invite_redemptions")
    .select("invitee_id,connected,created_at")
    .eq("inviter_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Pick<InvitedFriend, "invitee_id" | "connected" | "created_at">[];
  if (!rows.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id,username,display_name,avatar_url")
    .in(
      "user_id",
      rows.map((row) => row.invitee_id),
    );

  if (profilesError) throw profilesError;

  type ProfileRow = {
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  const byId = new Map(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.user_id, profile]));

  return rows.map((row) => {
    const profile = byId.get(row.invitee_id);
    return {
      ...row,
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}

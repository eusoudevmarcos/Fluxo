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

export type InvitePreview = {
  code: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  has_slots: boolean;
};

export type InvitedFriend = {
  invitee_id: string;
  connected: boolean;
  created_at: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

// Codigo guardado entre a pagina /c/CODIGO e o fim do onboarding (o cadastro passa por login
// social e varias telas no meio).
const PENDING_INVITE_KEY = "fluxo:pending-invite-code";

export function normalizeInviteCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function getInviteLink(code: string) {
  return `${window.location.origin}/c/${code}`;
}

export function savePendingInviteCode(code: string) {
  try {
    window.localStorage.setItem(PENDING_INVITE_KEY, normalizeInviteCode(code));
  } catch {
    // armazenamento indisponivel (aba anonima etc.): o campo manual no onboarding cobre
  }
}

export function readPendingInviteCode() {
  try {
    return window.localStorage.getItem(PENDING_INVITE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearPendingInviteCode() {
  try {
    window.localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // ignorado
  }
}

export async function getMyInviteStatus(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("get_my_invite_status");
  if (error) throw error;
  return data as InviteStatus;
}

export async function getInvitePreview(supabase: SupabaseClient, code: string) {
  const { data, error } = await supabase.rpc("get_invite_preview", {
    invite_code: normalizeInviteCode(code),
  });
  if (error) throw error;
  return (data ?? null) as InvitePreview | null;
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

  const byId = new Map(
    ((profiles ?? []) as { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }[]).map(
      (profile) => [profile.user_id, profile],
    ),
  );

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
